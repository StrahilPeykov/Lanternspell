// Real local workerd movement regression. No rendering or state injection.
// Condenses legal walking updates into an application delivery burst; this is
// not a measurement of geographic latency or real network packet loss.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { build } from 'esbuild';

const base = process.env.GAME_URL || 'http://127.0.0.1:5180';
assert.ok(/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(base), 'Local authority only for this benchmark.');
const response = await fetch(base + '/api/session', { method: 'POST' });
assert.equal(response.status, 200);
const credential = await response.json();
const ws = new WebSocket(base.replace('http:', 'ws:') + '/api/session/' + credential.sessionId, ['wizard-v1', 'seat.' + credential.token]);
let snapshot, snapshotCount = 0;
const errors = [], corrections = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.type === 'snapshot') { snapshot = message; snapshotCount++; }
  if (message.type === 'error') errors.push(message.reason);
  if (message.type === 'movement' && message.correction) corrections.push(message);
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(condition) {
  const deadline = Date.now() + 5000;
  while (!condition()) { assert.ok(Date.now() < deadline, 'Timed out waiting for authority snapshot'); await wait(20); }
}
function send(body) { ws.send(JSON.stringify({ ...body, version: 1, commandId: crypto.randomUUID() })); }
async function sync() { const before = snapshotCount; send({ kind: 'sync' }); await until(() => snapshotCount > before); }
let client, guestSocket;
try {
  await until(() => snapshot && ws.readyState === WebSocket.OPEN);
  const start = { ...snapshot.positions.mage1 };
  await wait(1200);
  for (let i = 1; i <= 8; i++) send({ kind: 'move', position: { x: start.x + i * 0.4, z: start.z, yaw: 0 } });
  await sync();
  const expected = { x: start.x + 3.2, z: start.z, yaw: 0 };
  const actual = { ...snapshot.positions.mage1 };
  assert.ok(Math.abs(actual.x - expected.x) < 0.000001, `Final burst position lost: expected ${expected.x}, got ${actual.x}`);
  assert.equal(errors.length, 0);
  // A new packet cannot replenish its own distance tolerance.
  send({ kind: 'move', position: { x: actual.x + 5.1, z: actual.z, yaw: 0 } });
  await sync();
  assert.deepEqual(snapshot.positions.mage1, actual);
  assert.equal(corrections.length, 1);
  assert.deepEqual(corrections[0].position, actual);
  assert.equal(errors.length, 0);

  // Exercise the actual SharedClient, compiled in memory for Node. No replacement
  // transport logic or mocked sockets; only application receipt delay is injected.
  const bundle = await build({ entryPoints: ['src/network.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
  const { SharedClient } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  globalThis.location = new URL(base);
  const joined = await fetch(base + '/api/session/' + credential.sessionId + '/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invitation: credential.invitation }) });
  assert.equal(joined.status, 200);
  const guest = await joined.json();
  guestSocket = new WebSocket(base.replace('http:', 'ws:') + '/api/session/' + credential.sessionId, ['wizard-v1', 'seat.' + guest.token]);
  await until(() => guestSocket.readyState === WebSocket.OPEN);
  const clientCorrections = [], clientErrors = [];
  client = new SharedClient(credential, { onSnapshot() {}, onMovementCorrection: (position, reason) => clientCorrections.push({ position, reason }), onError: reason => clientErrors.push(reason) });
  client.applicationDelayMs = 600;
  client.connect();
  await until(() => client.snapshot?.paused === false);
  const clientStart = { ...client.snapshot.positions.mage1 };
  client.move({ x: clientStart.x - 0.4, z: clientStart.z, yaw: 0 });
  for (let i = 1; i <= 100; i++) client.move({ x: clientStart.x - 4 * i / 100, z: clientStart.z, yaw: 0 });
  client.interact('npc'); // Deferred until its final walking position is acknowledged.
  assert.equal(client.metrics.sent, 1);
  await until(() => !client.metrics.movementPending && client.snapshot?.stage === 1);
  assert.equal(client.metrics.sent, 3); // Initial movement, latest movement, then NPC.
  const clientFinal = { ...client.snapshot.positions.mage1 };
  assert.ok(Math.abs(clientFinal.x - (clientStart.x - 4)) < 0.000001);
  client.move({ x: 13, z: clientFinal.z, yaw: 0 });
  await until(() => clientCorrections.length === 1);
  assert.deepEqual(clientCorrections[0].position, clientFinal);
  assert.equal(client.metrics.movementPending, false);
  client.move({ x: clientFinal.x + 0.4, z: clientFinal.z, yaw: 0 });
  await until(() => !client.metrics.movementPending);
  assert.ok(Math.abs(client.snapshot.positions.mage1.x - (clientFinal.x + 0.4)) < 0.000001);
  assert.deepEqual(clientErrors, []);
  const result = {
    version: 1, scenario: 'real-local-authority-bunched-movement', endpoint: base,
    timestamp: new Date().toISOString(), result: 'passed', mockedSockets: false,
    gameplayInput: false, stateInjection: false, applicationDeliveryBurst: true,
    realPacketLoss: false, separateDevices: false,
    burst: { waitMs: 1200, updates: 8, distancePerUpdate: 0.4, start, expected, actual },
    clientBackpressure: { source: 'actual SharedClient', applicationReceiptDelayMs: 600, inputPositions: 101, movementPacketsBeforeAck: 1, movementPacketsToReachFinal: 2, start: clientStart, final: clientFinal, correctionCount: clientCorrections.length },
    checks: ['Final position of ordered burst accepted', 'Over-5m jump returns explicit authoritative correction', 'One movement in flight and one coalesced latest position', 'NPC interaction waits for final movement and succeeds', 'Correction clears pending state and subsequent legal walking succeeds'],
  };
  const path = process.env.EVIDENCE_FILE || 'evidence/local/network-movement-real.json';
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { client?.close(); guestSocket?.close(); ws.close(); }
