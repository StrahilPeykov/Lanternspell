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
  onAck?: (ack: Ack) => void;
}
export class SharedClient {
  private socket?: WebSocket;
  snapshot: SharedSnapshot | null = null;
  private lastMovement = 0;
  private pendingMovement: Position | null = null;
  private lastSentPosition: Position | null = null;
  private movementTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Map<string, { command: Command; started: number }>();
  private seenResult: string | null = null;
  private initialized = false;
  metrics = { sent: 0, received: 0, lastAckMs: 0, maxQueueBytes: 0 };
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
    this.socket?.close(); this.callbacks.onConnection?.('connecting'); this.initialized = false;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (protocol === 'ws:' && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new Error('Shared play requires HTTPS outside localhost.');
    const ws = new WebSocket(`${protocol}//${location.host}/api/session/${this.credential.sessionId}`, ['wizard-v1', `seat.${this.credential.token}`]);
    this.socket = ws;
    ws.onopen = () => {
      this.callbacks.onConnection?.('connected');
      // Retried commands retain their IDs; the authority replays acknowledgements.
      for (const { command } of this.pending.values()) this.transmit(command);
    };
    ws.onclose = () => { if (this.socket === ws) this.callbacks.onConnection?.('disconnected'); };
    ws.onerror = () => this.callbacks.onError?.('Shared connection interrupted. Rejoin keeps your seat and committed results.');
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
        } else if (message.type === 'movement') this.callbacks.onMovement?.(message.seat, message.position);
        else if (message.type === 'ack') {
          const pending = this.pending.get(message.commandId);
          if (pending) this.metrics.lastAckMs = performance.now() - pending.started;
          this.pending.delete(message.commandId); this.callbacks.onAck?.(message);
          if (!message.accepted) this.callbacks.onError?.(message.reason);
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
  command(body: CommandBody, commandId = crypto.randomUUID()): string {
    const command = { ...body, version: 1 as const, commandId };
    if (body.kind !== 'move' && body.kind !== 'sync') {
      if (this.pending.size >= 32) { this.callbacks.onError?.('Too many pending actions. Wait for the connection.'); return commandId; }
      this.pending.set(commandId, { command, started: performance.now() });
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
    if (this.lastSentPosition && Math.hypot(position.x - this.lastSentPosition.x, position.z - this.lastSentPosition.z) < 0.01 && Math.abs(position.yaw - this.lastSentPosition.yaw) < 0.01) return;
    this.pendingMovement = position;
    if (this.movementTimer) return;
    const flush = () => {
      this.movementTimer = null;
      if (!this.pendingMovement || this.socket?.readyState !== WebSocket.OPEN) return;
      // Drop obsolete movement under backpressure. Essential commands have priority.
      if (this.socket.bufferedAmount < 8192 && this.pending.size < 8) {
        this.command({ kind: 'move', position: this.pendingMovement }); this.lastMovement = performance.now(); this.lastSentPosition = { ...this.pendingMovement };
      }
      this.pendingMovement = null;
    };
    const wait = Math.max(0, 100 - (performance.now() - this.lastMovement));
    if (wait === 0) flush(); else this.movementTimer = setTimeout(flush, wait);
  }
  close() { if (this.movementTimer) clearTimeout(this.movementTimer); this.socket?.close(1000, 'Left shared session'); this.pendingMovement = null; }
}
