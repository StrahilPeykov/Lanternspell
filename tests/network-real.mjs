// Real local Durable Object protocol test using two independent Chromium contexts.
// Uses browser WebSocket API directly; no routeWebSocket mocks and no gameplay-UI claims.
import { chromium } from 'playwright';
import { writeFile, readFile, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.GAME_URL || 'http://127.0.0.1:5180';
const browser = await chromium.launch({ headless: true });
const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
const pages = await Promise.all(contexts.map(c => c.newPage()));
const applicationDelayMs = Math.min(2000, Number(process.env.APPLICATION_DELAY_MS || 0));
const evidence = { scenario: base.startsWith('https:') ? 'deployed-do-two-browser-protocol' : 'real-local-do-two-browser-protocol', endpoint: base, mocking: false, gameplayInput: false, separateDevices: false, applicationDelayMs, delayIsPacketLoss: false, started: new Date().toISOString(), checks: [], timings: [] };
try {
  await Promise.all(pages.map(p => p.goto(base + '/api/health')));
  if (process.env.REJOIN === '1') {
    const saved = JSON.parse(await readFile('.wrangler/network-rejoin.json', 'utf8'));
    for (let i = 0; i < 2; i++) {
      await pages[i].evaluate(async credential => {
        window.__restored = null;
        const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/session/${credential.sessionId}`, ['wizard-v1', `seat.${credential.token}`]);
        window.__socket = ws;
        ws.onmessage = e => { const data = JSON.parse(e.data); if (data.type === 'snapshot') window.__restored = data; };
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
      }, i ? saved.guest : saved.host);
    }
    await pages[0].waitForFunction(() => window.__restored?.paused === false);
    const restored = await pages[0].evaluate(() => window.__restored);
    assert.deepEqual(restored.battle, saved.state.battle); assert.equal(restored.stage, saved.state.stage); assert.deepEqual(restored.rewardIds, saved.state.rewardIds);
    const result = { scenario: 'process-restart-sqlite-reconstruction', result: 'passed', checked: ['battle including revision', 'shared quest stage', 'reward IDs', 'both persisted seat credentials'], timestamp: new Date().toISOString() };
    await writeFile(process.env.EVIDENCE_FILE || 'evidence/network-reconstruction.json', JSON.stringify(result, null, 2));
    await rm('.wrangler/network-rejoin.json');
    console.log(JSON.stringify(result));
    await browser.close();
    process.exit(0);
  }
  const host = await pages[0].evaluate(async () => (await fetch('/api/session', { method: 'POST' })).json());
  const guest = await pages[1].evaluate(async ({ sessionId, invitation }) => (await fetch(`/api/session/${sessionId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invitation }) })).json(), host);
  assert.equal((await fetch(base + '/api/session', { method: 'POST', headers: { Origin: 'https://unrelated.invalid' } })).status, 403);
  assert.equal((await fetch(`${base}/api/session/${host.sessionId}/join`, { method: 'POST', body: 'null' })).status, 400);
  assert.equal((await fetch(`${base}/api/session/${host.sessionId}/join`, { method: 'POST', body: JSON.stringify({ invitation: host.invitation }) })).status, 403);
  evidence.checks.push('cross-origin creation, malformed join, and consumed invitation rejected');
  async function connect(page, credential) {
    await page.evaluate(async ({ credential, applicationDelayMs }) => {
      window.__wire = { messages: [], snapshot: null, ws: null };
      const wire = window.__wire;
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/session/${credential.sessionId}`, ['wizard-v1', `seat.${credential.token}`]);
      wire.ws = ws;
      ws.onmessage = event => { const receive = () => { const msg = JSON.parse(event.data); wire.messages.push(msg); if (msg.type === 'snapshot') wire.snapshot = msg; }; if (applicationDelayMs) setTimeout(receive, applicationDelayMs); else receive(); };
      await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    }, { credential, applicationDelayMs });
    // An open transport does not imply that this client has received its snapshot.
    await page.waitForFunction(() => window.__wire.snapshot !== null);
  }
  await Promise.all([connect(pages[0], host), connect(pages[1], guest)]);
  const state = async (page = pages[0]) => page.evaluate(() => window.__wire.snapshot);
  const waitState = async (predicate, page = pages[0]) => { await page.waitForFunction(predicate, null, { timeout: 10000 }); return state(page); };
  await waitState(() => window.__wire.snapshot?.paused === false);
  evidence.checks.push('two independently authenticated seats connected');
  async function send(page, body, id = crypto.randomUUID()) {
    const t = performance.now();
    await page.evaluate(({ body, id }) => window.__wire.ws.send(JSON.stringify({ ...body, commandId: id, version: 1 })), { body, id });
    if (body.kind === 'move') return;
    await page.waitForFunction(id => window.__wire.messages.some(m => m.type === 'ack' && m.commandId === id), id);
    const ack = await page.evaluate(id => window.__wire.messages.find(m => m.type === 'ack' && m.commandId === id), id);
    evidence.timings.push({ kind: body.kind, ms: Math.round(performance.now() - t), accepted: ack.accepted });
    return ack;
  }
  async function walk(page, seat, destination) {
    let p = (await state(page)).positions[seat];
    while (Math.hypot(p.x - destination.x, p.z - destination.z) > 0.1) {
      const d = Math.hypot(p.x - destination.x, p.z - destination.z), step = Math.min(0.9, d);
      p = { x: p.x + (destination.x - p.x) / d * step, z: p.z + (destination.z - p.z) / d * step, yaw: 0 };
      await new Promise(r => setTimeout(r, 160));
      await send(page, { kind: 'move', position: p });
    }
  }
  assert.equal((await send(pages[0], { kind: 'interact', interaction: 'npc' })).accepted, true);
  await Promise.all(pages.map((p, i) => walk(p, i ? 'mage2' : 'mage1', { x: 4, z: 1 })));
  assert.equal((await send(pages[0], { kind: 'interact', interaction: 'lantern' })).accepted, true);
  await Promise.all(pages.map((p, i) => walk(p, i ? 'mage2' : 'mage1', { x: 0, z: -4 })));
  assert.equal((await send(pages[0], { kind: 'consent', encounter: 'lesson' })).accepted, true);
  assert.equal((await state()).battle, null);
  assert.equal((await send(pages[1], { kind: 'consent', encounter: 'lesson' })).accepted, true);
  await waitState(() => window.__wire.snapshot?.battle?.round === 1);
  evidence.checks.push('proximity-validated shared progression and independent encounter consent');
  const makePlan = (s, seat, spellId = 'spark') => ({ kind: 'plan', roundId: s.roundId, revision: s.battle.revision, planRevision: s.planRevisions[seat], plan: { actorId: seat, spellId, targetId: 'moth1' } });
  const makeReady = s => ({ kind: 'ready', roundId: s.roundId, revision: s.battle.revision, jointPlanKey: s.jointPlanKey });
  let s = await state();
  assert.equal((await send(pages[0], makePlan(s, 'mage1', '__proto__'))).accepted, false);
  assert.equal((await state()).battle.revision, s.battle.revision);
  evidence.checks.push('unknown/prototype spell ID rejected without resolving or disconnecting');
  const plans = await Promise.all([send(pages[0], makePlan(s, 'mage1')), send(pages[1], makePlan(s, 'mage2'))]);
  assert.ok(plans.every(x => x.accepted));
  await waitState(() => window.__wire.snapshot?.planRevisions.mage1 === 1 && window.__wire.snapshot?.planRevisions.mage2 === 1);
  evidence.checks.push('simultaneous plan submission against common battle revision accepted');
  s = await state(); const staleReady = makeReady(s);
  assert.equal((await send(pages[0], staleReady)).accepted, true);
  assert.equal((await send(pages[1], makePlan(await state(), 'mage2', 'mark'))).accepted, true);
  assert.equal((await send(pages[1], staleReady)).accepted, false);
  assert.deepEqual((await state()).ready, {});
  evidence.checks.push('plan edit invalidates joint readiness; stale confirm rejected');
  await send(pages[0], makeReady(await state()));
  await connect(pages[1], guest); // Live seat replacement, not a prior manual disconnect.
  await waitState(() => window.__wire.snapshot?.paused === false && Object.keys(window.__wire.snapshot.ready).length === 0);
  await send(pages[0], makeReady(await state()));
  await new Promise(r => setTimeout(r, 300 + applicationDelayMs));
  assert.equal((await state()).ready.mage1, (await state()).jointPlanKey);
  evidence.checks.push('live seat replacement clears old readiness; replacement remains usable after old socket closes');
  await pages[1].evaluate(() => window.__wire.ws.close());
  await waitState(() => window.__wire.snapshot?.paused === true);
  assert.equal((await send(pages[0], makeReady(await state()))).accepted, false);
  await connect(pages[1], guest); await waitState(() => window.__wire.snapshot?.paused === false);
  evidence.checks.push('disconnect before commit pauses, opaque credential resumes original seat');
  s = await state(); const readyBody = makeReady(s), repeatId = crypto.randomUUID();
  await send(pages[0], readyBody);
  assert.equal((await send(pages[1], readyBody, repeatId)).accepted, true);
  await waitState(() => window.__wire.snapshot?.battle?.round === 2);
  const committed = await state();
  await send(pages[1], readyBody, repeatId);
  await new Promise(r => setTimeout(r, 150));
  assert.equal((await state()).battle.revision, committed.battle.revision);
  assert.equal((await send(pages[0], readyBody)).accepted, false);
  evidence.checks.push('duplicate command acknowledgement and old-round rejection cannot double-resolve');
  await pages[1].evaluate(() => window.__wire.ws.close()); await waitState(() => window.__wire.snapshot?.paused === true);
  await connect(pages[1], guest); await waitState(() => window.__wire.snapshot?.paused === false);
  assert.deepEqual((await state(pages[1])).battle, committed.battle);
  evidence.checks.push('disconnect after committed result restores authoritative state');
  // Play legal basic spells until victory, with no state injection.
  while ((await state()).battle.phase === 'planning') {
    s = await state(); await Promise.all([send(pages[0], makePlan(s, 'mage1')), send(pages[1], makePlan(s, 'mage2'))]);
    await waitState(() => Object.keys(window.__wire.snapshot.plans).length === 2);
    s = await state(); await send(pages[0], makeReady(s)); await send(pages[1], makeReady(s));
    await waitState(() => Object.keys(window.__wire.snapshot.plans).length === 0);
  }
  s = await state(); assert.equal(s.battle.phase, 'victory'); assert.equal(s.stage, 3); assert.equal(s.rewardIds.length, 1);
  if (process.env.KEEP_STATE === '1') await writeFile('.wrangler/network-rejoin.json', JSON.stringify({ host, guest, state: s }));
  evidence.checks.push('legal complete teaching encounter awards shared progression once');
  evidence.completed = new Date().toISOString(); evidence.result = 'passed';
  await writeFile(process.env.EVIDENCE_FILE || (applicationDelayMs ? 'evidence/network-delayed.json' : 'evidence/network-real.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ result: evidence.result, checks: evidence.checks, commandCount: evidence.timings.length }, null, 2));
} finally { await browser.close(); }
