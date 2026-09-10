import { DurableObject } from 'cloudflare:workers';
import { applyCommand, hydrateCampaign, initialCampaign, parseCommand, snapshot, type CampaignState, type Seat, type Ack } from './protocol';

interface Env { CAMPAIGNS: DurableObjectNamespace<Campaign>; ASSETS: Fetcher; SESSION_CREATION: RateLimit }
interface Stored { state: CampaignState; tokens: Partial<Record<Seat, string>>; invitation: string; acknowledgements: { seat: Seat; ack: Ack }[] }
interface Attachment { seat: Seat; window: number; count: number; movementAt: number; position: { x: number; z: number; yaw: number } }
const opaque = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
async function limitedBody(request: Request): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader(); const decoder = new TextDecoder(); let text = '', bytes = 0;
  for (;;) {
    const chunk = await reader.read(); if (chunk.done) return text + decoder.decode();
    bytes += chunk.value.byteLength;
    if (bytes > 4096) { await reader.cancel(); return null; }
    text += decoder.decode(chunk.value, { stream: true });
  }
}

export class Campaign extends DurableObject<Env> {
  private saved: Stored | null;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS campaign (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)');
    const row = ctx.storage.sql.exec<{ payload: string }>('SELECT payload FROM campaign WHERE id=1').toArray()[0];
    this.saved = row ? JSON.parse(row.payload) : null;
    if (this.saved) this.saved.state = hydrateCampaign(this.saved.state);
    // Movement attachments survive hibernation; disk positions are safe checkpoints.
    if (this.saved) for (const ws of ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment;
      if (attachment?.seat && attachment.position) this.saved.state.positions[attachment.seat] = attachment.position;
    }
  }
  private persist(next: Stored) {
    this.ctx.storage.transactionSync(() => this.ctx.storage.sql.exec('INSERT INTO campaign(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload', JSON.stringify(next)));
    this.saved = next;
  }
  private connected(): Seat[] { return this.ctx.getWebSockets().filter(ws => ws.readyState === 1).map(ws => (ws.deserializeAttachment() as Attachment).seat); }
  private broadcast() {
    if (!this.saved) return;
    const data = JSON.stringify(snapshot(this.saved.state, this.connected()));
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(data); } catch { /* Closing peer; next message supplies authoritative state. */ } }
  }
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === '/initialize' && request.method === 'POST') {
      if (this.saved) return json({ error: 'Already initialized.' }, 409);
      const { sessionId } = await request.json() as { sessionId: string };
      const token = opaque(), invitation = opaque();
      this.persist({ state: initialCampaign(sessionId), tokens: { mage1: token }, invitation, acknowledgements: [] });
      return json({ sessionId, token, invitation, seat: 'mage1' });
    }
    if (!this.saved) return json({ error: 'Unknown session.' }, 404);
    if (url.pathname === '/join' && request.method === 'POST') {
      const { invitation } = await request.json() as { invitation?: string };
      if (!invitation || invitation !== this.saved.invitation || this.saved.tokens.mage2) return json({ error: 'Invitation is invalid or has already been used. Rejoin with the saved seat credential.' }, 403);
      const token = opaque();
      this.persist({ ...this.saved, invitation: '', tokens: { ...this.saved.tokens, mage2: token } });
      return json({ sessionId: this.saved.state.sessionId, token, seat: 'mage2' });
    }
    if (url.pathname !== '/socket' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'Expected WebSocket.' }, 400);
    const protocols = (request.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map(v => v.trim());
    const token = protocols.find(v => v.startsWith('seat.'))?.slice(5);
    const seat = (Object.entries(this.saved.tokens) as [Seat, string][]).find(([, t]) => t === token)?.[0];
    if (!seat || !protocols.includes('wizard-v1')) return json({ error: 'Invalid seat credential.' }, 403);
    // A rejoin replaces the prior connection; it cannot create a third participant.
    for (const previous of this.ctx.getWebSockets(seat)) previous.close(4001, 'Seat resumed in another connection');
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [seat]);
    pair[1].serializeAttachment({ seat, window: Date.now(), count: 0, movementAt: Date.now(), position: this.saved.state.positions[seat] } satisfies Attachment);
    this.broadcast();
    return new Response(null, { status: 101, webSocket: pair[0], headers: { 'Sec-WebSocket-Protocol': 'wizard-v1' } });
  }
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (!this.saved) return;
    const a = ws.deserializeAttachment() as Attachment;
    // Superseded socket messages cannot change a seat.
    if (ws.readyState !== 1 || !a || this.ctx.getWebSockets(a.seat).filter(p => p.readyState === 1).at(-1) !== ws) return;
    const now = Date.now();
    if (typeof message !== 'string' || message.length > 4096) { ws.close(1009, 'JSON message limit: 4096 characters'); return; }
    if (now - a.window >= 1000) { a.window = now; a.count = 0; }
    if (++a.count > 30) { ws.close(1008, 'Message rate limit exceeded'); return; }
    ws.serializeAttachment(a);
    const command = parseCommand(message);
    if (!command) { ws.send(JSON.stringify({ type: 'error', version: 1, reason: 'Invalid versioned command.' })); return; }
    const previous = this.saved.acknowledgements.find(x => x.seat === a.seat && x.ack.commandId === command.commandId);
    if (previous) { ws.send(JSON.stringify(previous.ack)); ws.send(JSON.stringify(snapshot(this.saved.state, this.connected()))); return; }
    if (command.kind === 'move') {
      if (now - a.movementAt < 65) return;
      const distance = Math.hypot(command.position.x - a.position.x, command.position.z - a.position.z);
      if (distance > Math.min(5, (now - a.movementAt) / 1000 * 7 + 0.7)) {
        ws.send(JSON.stringify({ type: 'error', version: 1, reason: 'Movement exceeded the walking bounds.' }));
        ws.send(JSON.stringify(snapshot(this.saved.state, this.connected()))); return;
      }
      const result = applyCommand(this.saved.state, a.seat, command, this.connected());
      if (result.ack.accepted) {
        this.saved.state = result.state;
        a.movementAt = now; a.position = command.position; ws.serializeAttachment(a);
        const movement = JSON.stringify({ type: 'movement', version: 1, seat: a.seat, position: command.position });
        for (const other of this.ctx.getWebSockets()) if (other !== ws) other.send(movement);
      }
      return;
    }
    if (command.kind === 'sync') { ws.send(JSON.stringify(snapshot(this.saved.state, this.connected()))); return; }
    const result = applyCommand(this.saved.state, a.seat, command, this.connected());
    const acknowledgements = [...this.saved.acknowledgements, { seat: a.seat, ack: result.ack }].slice(-128);
    // No await/external I/O between validation, rule resolution and durable commit.
    this.persist({ ...this.saved, state: result.state, acknowledgements });
    ws.send(JSON.stringify(result.ack));
    this.broadcast();
  }
  webSocketClose(ws: WebSocket, code: number, reason: string) {
    try { ws.close(code === 1005 ? 1000 : code, reason); } catch { /* already closed */ }
    // Readiness is no longer current after participant loss. A committed result stays committed.
    if (this.saved) this.persist({ ...this.saved, state: { ...this.saved.state, ready: {}, consent: {} } });
    this.broadcast();
  }
  webSocketError(ws: WebSocket) { this.webSocketClose(ws, 1011, 'Connection interrupted; rejoin the saved seat.'); }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ error: 'Same-origin access required.' }, 403);
    if (Number(request.headers.get('Content-Length') || 0) > 4096) return json({ error: 'Request too large.' }, 413);
    if (url.pathname === '/api/health') return json({ version: 1, authority: 'sqlite-durable-object', transport: 'websocket', build: 'deployment-1' });
    if (url.pathname === '/api/session' && request.method === 'POST') {
      // Only new campaign creation is limited; never interfere with an existing
      // party's plans or reconnects. This anonymous prototype has no account ID.
      const { success } = await env.SESSION_CREATION.limit({ key: `lanternspell:create:${request.headers.get('CF-Connecting-IP') ?? 'local'}` });
      if (!success) return Response.json({ error: 'Too many new visits. Please wait a minute, or rejoin your saved visit.' }, { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
      const id = env.CAMPAIGNS.newUniqueId();
      return env.CAMPAIGNS.get(id).fetch(new Request('https://internal/initialize', { method: 'POST', body: JSON.stringify({ sessionId: id.toString() }) }));
    }
    const match = url.pathname.match(/^\/api\/session\/([a-f0-9]{64})(\/join)?$/);
    if (!match) return json({ error: 'Unknown route.' }, 404);
    let id: DurableObjectId; try { id = env.CAMPAIGNS.idFromString(match[1]); } catch { return json({ error: 'Invalid session.' }, 400); }
    const target = new URL(request.url); target.pathname = match[2] ? '/join' : '/socket'; target.search = '';
    if (match[2]) {
      if (request.method !== 'POST') return json({ error: 'POST required.' }, 405);
      const body = await limitedBody(request);
      if (body === null) return json({ error: 'Request too large.' }, 413);
      try {
        const value = JSON.parse(body);
        if (!value || typeof value.invitation !== 'string' || !/^[a-f0-9]{64}$/.test(value.invitation)) return json({ error: 'Invalid invitation format.' }, 400);
      } catch { return json({ error: 'Invalid JSON.' }, 400); }
      return env.CAMPAIGNS.get(id).fetch(new Request(target, { method: request.method, headers: request.headers, body: request.method === 'POST' ? body : undefined }));
    }
    return env.CAMPAIGNS.get(id).fetch(new Request(target, request));
  },
} satisfies ExportedHandler<Env>;
