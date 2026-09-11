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
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function clientFixture() {
  const callbacks = { onSnapshot: vi.fn(), onResult: vi.fn(), onConnection: vi.fn(), onError: vi.fn() };
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
