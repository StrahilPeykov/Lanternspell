import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedClient } from '../src/network';
import { initialCampaign, snapshot } from '../server/protocol';

// Transport lifecycle fixtures only. These mocks do not establish real
// WebSocket/SQLite behavior; the local two-browser tests cover integration.
vi.mock('cloudflare:workers', () => ({ DurableObject: class {} }));
import { Campaign } from '../server/index';

class SocketFixture {
  static OPEN = 1;
  static sockets: SocketFixture[] = [];
  readyState = 1;
  bufferedAmount = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(..._args: unknown[]) { SocketFixture.sockets.push(this); }
  send(message: string) { this.sent.push(message); }
  close() { this.readyState = 3; }
  receive(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

beforeEach(() => {
  SocketFixture.sockets = [];
  vi.stubGlobal('WebSocket', SocketFixture);
  vi.stubGlobal('location', { protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1:5180' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function clientFixture() {
  const callbacks = { onSnapshot: vi.fn(), onResult: vi.fn(), onConnection: vi.fn(), onError: vi.fn(), onMovementCorrection: vi.fn(), onNotice: vi.fn() };
  const client = new SharedClient({ sessionId: 'fixture', token: 'fixture', seat: 'mage1' }, callbacks);
  client.connect();
  const socket = SocketFixture.sockets.at(-1)!;
  socket.onopen?.();
  return { client, socket, callbacks };
}

describe('client connection ownership', () => {
  it('permanent close ignores delayed shared state and late close/error events', () => {
    vi.useFakeTimers();
    const { client, socket, callbacks } = clientFixture();
    client.applicationDelayMs = 250;
    socket.receive(snapshot(initialCampaign('fixture'), ['mage1', 'mage2']));
    client.close();
    socket.onclose?.(); socket.onerror?.();
    vi.advanceTimersByTime(300);
    expect(callbacks.onSnapshot).not.toHaveBeenCalled();
    expect(callbacks.onResult).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onConnection.mock.calls.map(call => call[0])).toEqual(['connecting', 'connected']);
    expect(client.snapshot).toBeNull();
  });

  it('reconnect retains retry IDs but suppresses callbacks from the replaced socket', () => {
    const { client, socket: old, callbacks } = clientFixture();
    client.command({ kind: 'interact', interaction: 'npc' }, 'retry-command');
    client.connect();
    const replacement = SocketFixture.sockets.at(-1)!;
    old.onopen?.(); old.onerror?.(); old.onclose?.();
    expect(replacement.sent).toHaveLength(0);
    replacement.onopen?.();
    expect(JSON.parse(replacement.sent[0]).commandId).toBe('retry-command');
    const restored = snapshot(initialCampaign('fixture'), ['mage1', 'mage2']);
    restored.lastResult = { id: 'previous-round', events: [] };
    replacement.receive(restored);
    expect(callbacks.onResult).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onConnection.mock.calls.map(call => call[0])).toEqual(['connecting', 'connected', 'connecting', 'connected']);
  });

  it('actual current transport loss pauses and ignores queued late snapshots', () => {
    vi.useFakeTimers();
    const { client, socket, callbacks } = clientFixture();
    client.applicationDelayMs = 100;
    socket.receive(snapshot(initialCampaign('fixture'), ['mage1', 'mage2']));
    socket.onclose?.();
    vi.advanceTimersByTime(100);
    expect(callbacks.onConnection).toHaveBeenLastCalledWith('disconnected');
    expect(callbacks.onSnapshot).not.toHaveBeenCalled();
  });

  it('permanent close discards commands instead of replaying them in a new visit', () => {
    const { client } = clientFixture();
    client.command({ kind: 'interact', interaction: 'npc' }, 'abandoned-command');
    client.close(); client.connect();
    const replacement = SocketFixture.sockets.at(-1)!;
    replacement.onopen?.();
    expect(replacement.sent).toEqual([]);
  });
});

describe('authority close ownership (mock sockets/storage)', () => {
  function fixture(replaced: boolean) {
    const state = initialCampaign('fixture');
    state.ready = { mage1: 'reviewed-on-replacement' };
    state.consent = { mage1: 'lesson' };
    state.lastResult = { id: 'committed', events: [] };
    const ws = { close: vi.fn(), deserializeAttachment: () => ({ seat: 'mage1' }), readyState: 3 };
    const replacement = { readyState: 1 };
    const target = Object.create(Campaign.prototype);
    target.saved = { state };
    target.ctx = { getWebSockets: () => replaced ? [ws, replacement] : [ws] };
    target.persist = vi.fn((next: unknown) => { target.saved = next; });
    target.broadcast = vi.fn();
    return { target, ws, state };
  }

  it('late close of a superseded socket cannot erase replacement readiness', () => {
    const { target, ws, state } = fixture(true);
    target.webSocketClose(ws, 4001, 'replaced');
    expect(target.persist).not.toHaveBeenCalled();
    expect(target.saved.state).toBe(state);
  });

  it('required participant loss clears readiness/consent and retains committed results', () => {
    const { target, ws, state } = fixture(false);
    target.webSocketClose(ws, 1000, 'left');
    expect(target.persist).toHaveBeenCalledTimes(1);
    expect(target.saved.state.ready).toEqual({});
    expect(target.saved.state.consent).toEqual({});
    expect(target.saved.state.lastResult).toEqual(state.lastResult);
  });

  it('a seat replacement invalidates old readiness before the new socket is accepted', async () => {
    const { target, ws } = fixture(false);
    target.saved.tokens = { mage1: 'opaque-test-token' };
    const accepted = { serializeAttachment: vi.fn() };
    target.ctx.acceptWebSocket = vi.fn(() => {
      expect(target.saved.state.ready).toEqual({});
      expect(target.saved.state.consent).toEqual({});
    });
    vi.stubGlobal('WebSocketPair', class { 0 = {}; 1 = accepted; });
    // Node Response rejects 101; this handshake fixture records the response
    // options only. The real workerd test owns actual upgrade validation.
    vi.stubGlobal('Response', class { constructor(public body: unknown, public options: { status: number }) {} });
    const response = await target.fetch(new Request('http://local/socket', {
      headers: { Upgrade: 'websocket', 'Sec-WebSocket-Protocol': 'wizard-v1, seat.opaque-test-token' },
    }));
    expect(response.options.status).toBe(101);
    expect(ws.close).toHaveBeenCalledWith(4001, 'Seat resumed in another connection');
    expect(target.ctx.acceptWebSocket).toHaveBeenCalledTimes(1);
    expect(target.persist).toHaveBeenCalledTimes(1);
  });
});

describe('movement arrival timing (mock socket/storage)', () => {
  function fixture() {
    vi.useFakeTimers(); vi.setSystemTime(10000);
    const state = initialCampaign('movement-fixture');
    let attachment = { seat: 'mage1', window: Date.now(), count: 0, movementAt: Date.now(), movementCredit: 0.7, position: { ...state.positions.mage1 } };
    const ws = { readyState: 1, deserializeAttachment: () => structuredClone(attachment), serializeAttachment: (value: typeof attachment) => { attachment = structuredClone(value); }, send: vi.fn(), close: vi.fn() };
    const target = Object.create(Campaign.prototype);
    target.saved = { state, acknowledgements: [] };
    target.ctx = { getWebSockets: () => [ws] };
    target.persist = vi.fn();
    let serial = 0;
    const move = (x: number) => target.webSocketMessage(ws, JSON.stringify({ version: 1, commandId: `move-${++serial}`, kind: 'move', position: { x, z: 10, yaw: 0 } }));
    return { target, ws, move, x: () => target.saved.state.positions.mage1.x, attachment: () => attachment };
  }

  it('retains the final legal position when eight walking updates arrive together after a stall', () => {
    const { move, x, target, ws } = fixture();
    vi.advanceTimersByTime(1200);
    for (let i = 1; i <= 8; i++) move(-0.7 + i * 0.4);
    expect(x()).toBeCloseTo(2.5);
    expect(ws.send).toHaveBeenCalledTimes(8);
    expect(JSON.parse(ws.send.mock.calls.at(-1)![0])).toMatchObject({ type: 'movement', commandId: 'move-8', correction: false, position: { x: 2.5 } });
    expect(target.persist).not.toHaveBeenCalled();
  });

  it('a burst cannot multiply the per-packet tolerance into unlimited movement', () => {
    const { move, x, ws } = fixture();
    vi.advanceTimersByTime(1200);
    for (let i = 1; i <= 9; i++) move(-0.7 + i * 0.6);
    expect(x()).toBeCloseTo(4.1); // 4.8m consumed; another 0.6m exceeds 5m credit.
    expect(ws.send.mock.calls.some(([data]) => JSON.parse(data).correction === true)).toBe(true);
    vi.advanceTimersByTime(100);
    move(4.7);
    expect(x()).toBeCloseTo(4.7);
  });

  it('allows normal 10Hz walking while rejecting an over-5m jump even after long idle', () => {
    const { move, x, attachment } = fixture();
    for (let i = 1; i <= 20; i++) { vi.advanceTimersByTime(100); move(-0.7 + i * 0.48); }
    expect(x()).toBeCloseTo(8.9);
    vi.advanceTimersByTime(10000);
    move(2.9);
    expect(x()).toBeCloseTo(8.9);
    expect(attachment().movementCredit).toBe(5);
  });
});

describe('client movement backpressure (mock transport)', () => {
  function fixture() {
    vi.useFakeTimers(); vi.setSystemTime(10000);
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
    const result = clientFixture();
    const movements = () => result.socket.sent.map(data => JSON.parse(data)).filter(command => command.kind === 'move');
    const ack = (command = movements().at(-1), correction = false, position = command.position) => result.socket.receive({ type: 'movement', version: 1, seat: 'mage1', commandId: command.commandId, position, correction, reason: correction ? 'Position restored; retry interaction.' : undefined });
    return { ...result, movements, ack };
  }

  it('bounds stalled transport to one in-flight movement and sends only the final coalesced position after ack', () => {
    const { client, movements, ack } = fixture();
    client.move({ x: 0, z: 10, yaw: 0 });
    for (let i = 1; i <= 100; i++) { vi.advanceTimersByTime(10); client.move({ x: i * 0.02, z: 10, yaw: 0 }); }
    expect(movements()).toHaveLength(1);
    expect(client.metrics.movementPending).toBe(true);
    ack();
    expect(movements()).toHaveLength(2);
    expect(movements()[1].position.x).toBe(2);
    ack();
    expect(client.metrics.movementPending).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(movements()).toHaveLength(2);
  });

  it('retains a stationary final position under buffered transport pressure', () => {
    const { client, socket, movements, ack } = fixture();
    socket.bufferedAmount = 9000;
    client.move({ x: 1, z: 10, yaw: 0 });
    vi.advanceTimersByTime(200);
    expect(movements()).toHaveLength(0);
    socket.bufferedAmount = 0;
    vi.advanceTimersByTime(100);
    expect(movements()).toHaveLength(1);
    ack();
    expect(client.metrics.movementPending).toBe(false);
  });

  it('waits for final movement before sending a queued proximity action', () => {
    const { client, socket, ack, callbacks } = fixture();
    client.move({ x: 1, z: 10, yaw: 0 });
    client.move({ x: 2, z: 10, yaw: 0 });
    client.interact('npc');
    expect(socket.sent.map(data => JSON.parse(data).kind)).toEqual(['move']);
    expect(callbacks.onNotice).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100); ack();
    expect(socket.sent.map(data => JSON.parse(data).kind)).toEqual(['move', 'move']);
    ack();
    expect(socket.sent.map(data => JSON.parse(data).kind)).toEqual(['move', 'move', 'interact']);
  });

  it('correction discards obsolete latest movement/unsent interactions and allows walking again', () => {
    const { client, socket, movements, ack, callbacks } = fixture();
    client.move({ x: 12, z: 10, yaw: 0 });
    client.move({ x: 13, z: 10, yaw: 0 });
    client.interact('npc');
    ack(undefined, true, { x: -0.7, z: 10, yaw: 0 });
    expect(callbacks.onMovementCorrection).toHaveBeenCalledWith({ x: -0.7, z: 10, yaw: 0 }, 'Position restored; retry interaction.');
    expect(client.metrics.movementPending).toBe(false);
    expect(client.metrics.movementCorrections).toBe(1);
    vi.advanceTimersByTime(200);
    expect(socket.sent).toHaveLength(1);
    client.move({ x: -0.3, z: 10, yaw: 0 });
    expect(movements()).toHaveLength(2); ack();
    expect(client.metrics.movementPending).toBe(false);
  });

  it('caps normal movement at 10Hz even with immediate receipts and many render updates', () => {
    const { client, movements, ack } = fixture();
    for (let i = 0; i < 20; i++) {
      client.move({ x: i * 0.02, z: 10, yaw: 0 });
      if (movements().length) ack();
      vi.advanceTimersByTime(10);
    }
    expect(movements().length).toBeLessThanOrEqual(3);
    client.close();
  });

  it('times out once into a safe rejoin instead of resending or queuing movement forever', () => {
    const { client, socket, movements, callbacks } = fixture();
    client.move({ x: 0, z: 10, yaw: 0 });
    client.move({ x: 10, z: 10, yaw: 0 });
    vi.advanceTimersByTime(20000);
    expect(movements()).toHaveLength(1);
    expect(socket.readyState).toBe(3);
    expect(client.metrics.movementPending).toBe(false);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onConnection).toHaveBeenLastCalledWith('disconnected');
  });
});
