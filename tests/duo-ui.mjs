// Real two-game-client integration. Gameplay changes use only DOM, mouse and keyboard.
// __orrery is read-only inspection; no protocol injection or state/save fixtures.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
const base = process.env.GAME_URL || 'http://127.0.0.1:5180';
await mkdir('evidence/duo-video', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: 'evidence/duo-video', size: { width: 1280, height: 720 } } })));
const pages = await Promise.all(contexts.map(c => c.newPage()));
const [host, guest] = pages;
const errors = [];
pages.forEach((page, i) => { page.on('pageerror', error => errors.push({ client: i, message: error.message })); page.setDefaultTimeout(12000); });
const evidence = { scenario: 'actual-input-two-game-clients', endpoint: base, started: new Date().toISOString(), mockedNetwork: false, stateFixtures: false, protocolInjection: false, viewport: [1280, 720], browser: 'Playwright Chromium, headless, D3D11 requested; actual renderer recorded below', browserVersion: browser.version(), platform: process.platform, checks: [], errors };
const inspect = page => page.evaluate(() => window.__orrery);
const until = (page, predicate, timeout = 20000) => page.waitForFunction(predicate, null, { timeout });
const bothUntil = predicate => Promise.all(pages.map(p => until(p, predicate)));
const action = (page, name) => page.locator(`[data-action="${name}"]`).click();
async function walkTo(page, x, z) {
  await page.keyboard.press('KeyR');
  for (let tries = 0; tries < 90; tries++) {
    const { position } = await inspect(page); const dx = x - position.x, dz = z - position.z;
    if (Math.hypot(dx, dz) < 1.15) return;
    const keys = [...(Math.abs(dx) > .55 ? [dx > 0 ? 'KeyD' : 'KeyA'] : []), ...(Math.abs(dz) > .55 ? [dz > 0 ? 'KeyS' : 'KeyW'] : [])];
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(240);
    for (const key of keys) await page.keyboard.up(key);
  }
  throw new Error(`Keyboard navigation failed at ${JSON.stringify((await inspect(page)).position)} while reaching ${x},${z}.`);
}
async function interact(page) { await page.keyboard.press('KeyE'); await page.getByRole('dialog').waitFor({ state: 'visible' }); }
async function skipBoth() {
  for (const page of pages) { if ((await inspect(page)).playing) await action(page, 'skip'); }
  await bothUntil(() => !window.__orrery.playing);
}
try {
  await Promise.all(pages.map(p => p.goto(base)));
  await Promise.all(pages.map(p => until(p, () => window.__orrery?.loadedAtMs > 0, 60000)));
  for (const page of pages) { assert.deepEqual((await inspect(page)).loadingErrors, []); await action(page, 'begin'); }
  evidence.initial = await Promise.all(pages.map(inspect));
  await action(host, 'shared'); await action(host, 'host');
  await host.locator('#invite-output').waitFor({ state: 'visible' });
  const privateInvite = await host.locator('#invite-output').inputValue();
  assert.ok(privateInvite.includes('#join=')); // Never record private invitation/seat tokens.
  await host.getByRole('button', { name: 'Close', exact: true }).click();
  await action(guest, 'shared'); await guest.locator('#join-input').fill(privateInvite); await action(guest, 'join');
  await bothUntil(() => window.__orrery.shared?.paused === false);
  evidence.checks.push('host and guest created/joined through friend-menu DOM in independent browser contexts');
  await Promise.all(pages.map(p => walkTo(p, -3, 6)));
  await Promise.all(pages.map(interact));
  await action(host, 'accept');
  await bothUntil(() => window.__orrery.stage === 1);
  assert.equal((await inspect(guest)).modal, 'npc');
  await guest.getByRole('dialog').waitFor({ state: 'visible' });
  await guest.getByRole('button', { name: 'Close', exact: true }).click();
  evidence.checks.push('shared NPC outcome applied once while guest read-only dialogue stayed open');
  await Promise.all(pages.map(p => walkTo(p, 4, 1)));
  await interact(host); await action(host, 'accept');
  await bothUntil(() => window.__orrery.stage === 2);
  await host.screenshot({ path: 'evidence/duo-01-lantern-path.png' });
  evidence.checks.push('both mages walked through real WASD input; one lantern interaction updated both clients');
  await Promise.all(pages.map(p => walkTo(p, 0, -4)));
  await interact(host); await action(host, 'accept');
  await host.waitForTimeout(250);
  assert.equal((await inspect(host)).battle, null); assert.equal((await inspect(guest)).battle, null);
  await interact(guest); await action(guest, 'accept');
  await bothUntil(() => window.__orrery.battle?.round === 1);
  evidence.checks.push('first encounter consent did not start battle; guest explicitly consented from own dialogue');
  await Promise.all(pages.map(p => p.locator('[data-spell="spark"]').click()));
  await bothUntil(() => window.__orrery.shared?.planRevisions.mage1 === 1 && window.__orrery.shared?.planRevisions.mage2 === 1);
  await action(host, 'confirm');
  await bothUntil(() => !!window.__orrery.shared?.ready.mage1);
  await guest.locator('[data-spell="mark"]').click();
  await bothUntil(() => window.__orrery.shared?.planRevisions.mage2 === 2 && Object.keys(window.__orrery.shared.ready).length === 0);
  assert.equal((await inspect(host)).battle.round, 1);
  await host.screenshot({ path: 'evidence/duo-02-edited-joint-plan.png' });
  await guest.screenshot({ path: 'evidence/duo-03-guest-plan.png' });
  evidence.checks.push('concurrent DOM spell choices accepted; guest edited after host ready and both readiness states cleared');
  await Promise.all(pages.map(p => action(p, 'confirm')));
  await bothUntil(() => window.__orrery.battle?.revision === 1 && window.__orrery.playing);
  const firstCommitted = (await inspect(host)).battle;
  assert.deepEqual((await inspect(guest)).battle, firstCommitted);
  await Promise.all(pages.map(async p => { await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }));
  await skipBoth();
  for (const page of pages) { assert.deepEqual((await inspect(page)).battle, firstCommitted); assert.equal((await inspect(page)).effectChildren, 0); }
  evidence.checks.push('both confirmed the same joint queue; committed result matched before playback; skip/repeated Enter did not double-apply');
  await Promise.all([host.locator('[data-spell="unfold"]').click(), guest.locator('[data-spell="spark"]').click()]);
  await bothUntil(() => window.__orrery.shared?.planRevisions.mage1 === 1 && window.__orrery.shared?.planRevisions.mage2 === 1);
  await Promise.all(pages.map(p => action(p, 'confirm')));
  await bothUntil(() => window.__orrery.battle?.phase === 'victory' && window.__orrery.playing);
  await host.locator('.resolution h3').filter({ hasText: 'Folded Sky' }).waitFor({ state: 'visible' });
  await host.waitForTimeout(350); await host.screenshot({ path: 'evidence/duo-04-signature-early.png' });
  await host.waitForTimeout(700); await host.screenshot({ path: 'evidence/duo-05-signature-middle.png' });
  await host.waitForTimeout(700); await host.screenshot({ path: 'evidence/duo-06-resolution-end.png' });
  await skipBoth();
  await bothUntil(() => window.__orrery.stage === 3 && window.__orrery.battle?.phase === 'victory');
  const victorious = (await inspect(host)).battle;
  assert.equal(victorious.rewardGranted, true); assert.deepEqual((await inspect(guest)).battle, victorious);
  await host.screenshot({ path: 'evidence/duo-07-shared-victory.png' });
  await host.keyboard.press('Enter'); await guest.keyboard.press('Enter');
  await host.waitForTimeout(250);
  assert.deepEqual((await inspect(host)).battle, victorious);
  evidence.checks.push('setup plus partner exploit won lesson; shared victory and reward flag remained single after repeated actual confirm input');
  await guest.reload();
  await until(host, () => window.__orrery.shared?.paused === true);
  assert.deepEqual((await inspect(host)).battle, victorious);
  await until(guest, () => window.__orrery?.loadedAtMs > 0, 60000);
  await action(guest, 'begin'); await action(guest, 'shared'); await action(guest, 'resume-shared');
  await bothUntil(() => window.__orrery.shared?.paused === false && window.__orrery.stage === 3);
  assert.deepEqual((await inspect(guest)).battle, victorious);
  assert.equal((await inspect(guest)).playing, false);
  evidence.checks.push('guest page reload paused partner; Rejoin saved seat DOM restored committed victory without replay');
  await action(host, 'leave-battle');
  await bothUntil(() => window.__orrery.battle === null && window.__orrery.stage === 3);
  await guest.screenshot({ path: 'evidence/duo-08-rejoined-path.png' });
  evidence.final = await Promise.all(pages.map(inspect));
  assert.deepEqual(errors, []);
  evidence.result = 'passed'; evidence.completed = new Date().toISOString();
  console.log(JSON.stringify({ result: evidence.result, checks: evidence.checks, renderers: evidence.final.map(s => s.renderer) }, null, 2));
} catch (error) {
  evidence.result = 'failed'; evidence.failure = String(error);
  evidence.failureState = await Promise.all(pages.map(async p => { try { return await inspect(p); } catch { return null; } }));
  for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: `evidence/duo-failure-${i}.png` }).catch(() => {});
  console.error(error); process.exitCode = 1;
} finally {
  await Promise.all(contexts.map(c => c.close()));
  const videos = await Promise.all(pages.map(p => p.video()?.path()));
  for (let i = 0; i < videos.length; i++) if (videos[i]) { await copyFile(videos[i], `evidence/duo-client-${i + 1}.webm`); await rm(videos[i]); }
  evidence.videos = ['evidence/duo-client-1.webm', 'evidence/duo-client-2.webm'];
  evidence.performanceCaveat = 'Two concurrent headless game clients on one Intel D3D11 GPU. Metrics include loading, dialogs and captures; not a stable single-client benchmark or two-device internet evidence.';
  await writeFile('evidence/duo-ui.json', JSON.stringify(evidence, null, 2));
  await browser.close();
}
