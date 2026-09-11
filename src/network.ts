import type { BattleEvent, Plan } from './simulation/battle';
import type { Ack, Command, CommandBody, Configuration, Encounter, Interaction, Position, Seat, Snapshot } from '../server/protocol';
export type SharedSnapshot = Snapshot;
export type Credential = { sessionId: string; token: string; seat: Seat; invitation?: string };
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export interface SharedCallbacks {
  onSnapshot: (snapshot: SharedSnapshot) => void;
  onConnection?: (status: ConnectionStatus) => void;
  onError?: (message: string) => void;
  onResult?: (events: BattleEvent[]) => void;
  onMovement?: (seat: Seat, position: Position) => void;
  onMovementCorrection?: (position: Position, reason: string) => void;
  onNotice?: (message: string) => void;
  onAck?: (ack: Ack) => void;
}
export class SharedClient {
  private socket?: WebSocket;
  snapshot: SharedSnapshot | null = null;
  private lastMovement = 0;
  private pendingMovement: Position | null = null;
  private lastSentPosition: Position | null = null;
  private movementTimer: ReturnType<typeof setTimeout> | null = null;
  private movementWatchdog: ReturnType<typeof setTimeout> | null = null;
  private movementInFlight: { commandId: string; started: number } | null = null;
  private pending = new Map<string, { command: Command; started: number; deferred?: boolean }>();
  private seenResult: string | null = null;
  private initialized = false;
  metrics = { sent: 0, received: 0, lastAckMs: 0, maxQueueBytes: 0, movementPending: false, movementCorrections: 0, lastMovementAckMs: 0 };
  /** Development-only application delay, not packet loss or geographic latency. */
  applicationDelayMs = 0;
  constructor(public credential: Credential, private callbacks: SharedCallbacks) {}
  static async create(): Promise<Credential> { return this.post('/api/session', {}); }
  static async join(sessionId: string, invitation: string): Promise<Credential> { return this.post(`/api/session/${sessionId}/join`, { invitation }); }
  private static async post(path: string, body: unknown) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json() as Credential & { error?: string }; if (!response.ok) throw new Error(data.error ?? 'Session request failed.'); return data;
  }
  connect() {
    const previous = this.socket;
    this.socket = undefined;
    previous?.close();
    this.resetMovement();
    this.callbacks.onConnection?.('connecting'); this.initialized = false;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (protocol === 'ws:' && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new Error('Shared play requires HTTPS outside localhost.');
    const ws = new WebSocket(`${protocol}//${location.host}/api/session/${this.credential.sessionId}`, ['wizard-v1', `seat.${this.credential.token}`]);
    this.socket = ws;
    ws.onopen = () => {
      if (this.socket !== ws) return;
      this.callbacks.onConnection?.('connected');
      // Retried commands retain their IDs; the authority replays acknowledgements.
      for (const { command, deferred } of this.pending.values()) if (!deferred) this.transmit(command);
    };
    ws.onclose = () => {
      if (this.socket !== ws) return;
      this.socket = undefined;
      this.resetMovement();
      this.callbacks.onConnection?.('disconnected');
    };
    ws.onerror = () => { if (this.socket === ws) this.callbacks.onError?.('Shared connection interrupted. Rejoin keeps your seat and committed results.'); };
    ws.onmessage = e => {
      this.metrics.received++;
      const handle = () => {
        if (this.socket !== ws) return;
        const message = JSON.parse(e.data);
        if (message.type === 'snapshot') {
          this.snapshot = message;
          const result = message.lastResult;
          // First snapshot after rejoin restores state without requiring cinematic replay.
          if (!this.initialized) { this.seenResult = result?.id ?? null; this.initialized = true; }
          this.callbacks.onSnapshot(message);
          if (result && result.id !== this.seenResult) { this.seenResult = result.id; this.callbacks.onResult?.(result.events); }
        } else if (message.type === 'movement') {
          if (message.seat === this.credential.seat) this.acceptMovement(message);
          else this.callbacks.onMovement?.(message.seat, message.position);
        }
        else if (message.type === 'ack') {
          const pending = this.pending.get(message.commandId);
          if (pending) this.metrics.lastAckMs = performance.now() - pending.started;
          this.pending.delete(message.commandId); this.callbacks.onAck?.(message);
          if (!message.accepted) this.callbacks.onError?.(message.reason);
          this.flushMovement();
        } else if (message.type === 'error') this.callbacks.onError?.(message.reason);
      };
      if (this.applicationDelayMs > 0) setTimeout(handle, Math.min(2000, this.applicationDelayMs)); else handle();
    };
  }
  private transmit(command: Command) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.metrics.maxQueueBytes = Math.max(this.metrics.maxQueueBytes, this.socket.bufferedAmount);
    if (this.socket.bufferedAmount > 64 * 1024) { this.callbacks.onError?.('Connection queue is full. Rejoin to retry safely.'); return; }
    this.socket.send(JSON.stringify(command)); this.metrics.sent++;
  }
  command(body: CommandBody, commandId: string = crypto.randomUUID()): string {
    const command = { ...body, version: 1 as const, commandId };
    if (body.kind !== 'move' && body.kind !== 'sync') {
      if (this.pending.size >= 32) { this.callbacks.onError?.('Too many pending actions. Wait for the connection.'); return commandId; }
      this.pending.set(commandId, { command, started: performance.now() });
      if ((body.kind === 'interact' || body.kind === 'consent') && this.metrics.movementPending) {
        this.pending.get(commandId)!.deferred = true;
        this.callbacks.onNotice?.('Waiting for your walking position to catch up…');
        return commandId;
      }
    }
    this.transmit(command); return commandId;
  }
  plan(plan: Plan) {
    const s = this.snapshot; if (!s?.battle) return;
    return this.command({ kind: 'plan', roundId: s.roundId, revision: s.battle.revision, planRevision: s.planRevisions[this.credential.seat], plan });
  }
  ready() {
    const s = this.snapshot; if (!s?.battle) return;
    return this.command({ kind: 'ready', roundId: s.roundId, revision: s.battle.revision, jointPlanKey: s.jointPlanKey });
  }
  interact(interaction: Interaction) { return this.command({ kind: 'interact', interaction }); }
  configure(configuration: Configuration) { return this.command({ kind: 'configure', configuration }); }
  consent(encounter: Encounter) { return this.command({ kind: 'consent', encounter, configRevision: this.snapshot?.configRevision ?? 0 }); }
  leaveBattle() { return this.command({ kind: 'leaveBattle' }); }
  move(position: Position) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    // One replaceable latest position, never a history of render-frame updates.
    this.pendingMovement = this.lastSentPosition && this.samePosition(position, this.lastSentPosition) ? null : { ...position };
    this.metrics.movementPending = !!(this.pendingMovement || this.movementInFlight);
    this.flushMovement();
  }
  private samePosition(a: Position, b: Position) {
    return Math.hypot(a.x - b.x, a.z - b.z) < 0.01 && Math.abs(a.yaw - b.yaw) < 0.01;
  }
  private resetMovement() {
    if (this.movementTimer) clearTimeout(this.movementTimer);
    if (this.movementWatchdog) clearTimeout(this.movementWatchdog);
    this.movementTimer = null; this.movementWatchdog = null;
    this.pendingMovement = null; this.movementInFlight = null; this.lastSentPosition = null;
    this.metrics.movementPending = false;
    // These proximity actions were never sent; do not replay them from a new checkpoint.
    for (const [id, pending] of this.pending) if (pending.deferred) this.pending.delete(id);
  }
  private watchMovement() {
    if (this.movementWatchdog) return;
    const socket = this.socket;
    this.movementWatchdog = setTimeout(() => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.resetMovement();
      socket?.close(4000, 'Walking acknowledgement timed out; rejoin safely');
      this.callbacks.onConnection?.('disconnected');
      this.callbacks.onError?.('Shared movement stopped responding. Rejoin your saved seat to continue safely.');
    }, 10000);
  }
  private flushMovement() {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.metrics.movementPending = !!(this.pendingMovement || this.movementInFlight);
    if (!this.metrics.movementPending) {
      if (this.movementWatchdog) clearTimeout(this.movementWatchdog);
      this.movementWatchdog = null;
      for (const pending of this.pending.values()) if (pending.deferred) {
        pending.deferred = false; this.transmit(pending.command);
      }
      return;
    }
    this.watchMovement();
    if (this.movementInFlight || this.movementTimer || !this.pendingMovement) return;
    // Already-sent decisions have priority. Deferred proximity actions must not
    // deadlock the movement they are waiting for. Backpressure retries UNSENT
    // latest data only; the watchdog bounds this waiting, with no resend loop.
    const essentialInFlight = [...this.pending.values()].filter(pending => !pending.deferred).length;
    const wait = Math.max(0, 100 - (performance.now() - this.lastMovement));
    if (wait > 0 || this.socket.bufferedAmount >= 8192 || essentialInFlight >= 8) {
      this.movementTimer = setTimeout(() => { this.movementTimer = null; this.flushMovement(); }, Math.max(100, wait));
      return;
    }
    const commandId = crypto.randomUUID();
    const position = this.pendingMovement;
    this.pendingMovement = null;
    this.movementInFlight = { commandId, started: performance.now() };
    this.lastSentPosition = { ...position }; this.lastMovement = performance.now();
    this.command({ kind: 'move', position }, commandId);
  }
  private acceptMovement(message: { commandId?: string; position: Position; correction?: boolean; reason?: string }) {
    if (!this.movementInFlight || message.commandId !== this.movementInFlight.commandId) return;
    this.metrics.lastMovementAckMs = performance.now() - this.movementInFlight.started;
    this.movementInFlight = null;
    if (this.movementWatchdog) clearTimeout(this.movementWatchdog);
    this.movementWatchdog = null;
    if (this.snapshot) this.snapshot.positions[this.credential.seat] = { ...message.position };
    if (message.correction) {
      this.resetMovement();
      this.lastSentPosition = { ...message.position };
      this.metrics.movementCorrections++;
      this.callbacks.onMovementCorrection?.(message.position, message.reason ?? 'Your walking position was restored. Please try the interaction again.');
    } else {
      this.flushMovement();
    }
  }
  close() {
    // Permanent departure (including switching to solo) invalidates queued receive
    // callbacks before closing. A later close event must not pause the new game.
    const previous = this.socket;
    this.socket = undefined;
    this.resetMovement();
    this.pending.clear(); this.snapshot = null; this.initialized = false;
    previous?.close(1000, 'Left shared session');
  }
}
