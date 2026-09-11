// Actual-input benchmark: two real browser clients, real local SQLite authority.
// Pure rules score detached read-only snapshots; all gameplay changes use DOM/WASD.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';

const base = process.env.GAME_URL || 'http://127.0.0.1:5180';
const recordVideo = process.env.RECORD_VIDEO === '1';
const scenarios = [
  { id: 'mixed-book', variant: 'book', traditions: ['margin', 'hearth'] },
  { id: 'same-hand', variant: 'hand', traditions: ['margin', 'margin'] },
].filter(s => !process.env.SCENARIO || process.env.SCENARIO === s.id);
const report = { version: 1, scenario: 'benchmark-actual-input-duo', started: new Date().toISOString(), endpoint: base, mockedSockets: false, injectedCommands: false, stateFixtures: false, policy: 'One-round deterministic diagnostic scoring of detached battle snapshots; selected commands applied only through spell/target/confirm UI. This is completion/correctness evidence, not human enjoyment.', results: [] };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const inspect = page => page.evaluate(() => window.__orrery);
const action = (page, name) => page.locator(`[data-action="${name}"]`).click();
const until = (page, predicate, timeout = 20000) => page.waitForFunction(predicate, null, { timeout });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function walkTo(page, x, z) {
  await page.keyboard.press('KeyR');
  for (let attempt = 0; attempt < 100; attempt++) {
    const { position } = await inspect(page); const dx = x - position.x, dz = z - position.z;
    if (Math.hypot(dx, dz) < 1.1) return;
    const keys = [...(Math.abs(dx) > .5 ? [dx > 0 ? 'KeyD' : 'KeyA'] : []), ...(Math.abs(dz) > .5 ? [dz > 0 ? 'KeyS' : 'KeyW'] : [])];
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(220);
    for (const key of keys) await page.keyboard.up(key);
  }
  throw new Error(`WASD navigation could not reach ${x},${z}; actual ${JSON.stringify((await inspect(page)).position)}`);
}
async function openInteraction(page) { await page.keyboard.press('KeyE'); await page.getByRole('dialog').waitFor({ state: 'visible' }); }
async function interact(page) { await openInteraction(page); await action(page, 'accept'); }
async function closePanel(page) { await page.getByRole('button', { name: 'Close', exact: true }).click(); }
const factsOf = diagnostic => diagnostic.facts ?? diagnostic.shared?.facts;

async function configure(page, tradition, variant) {
  await action(page, 'journal');
  await page.locator(`.paper-panel [data-tradition="${tradition}"]`).click();
  if (variant) {
    const laboratory = page.locator('details.laboratory');
    if (!await laboratory.evaluate(node => node.open)) await laboratory.locator('summary').click();
    await page.locator('#combat-model').selectOption(variant);
  }
  await closePanel(page);
}

async function choosePlans(page) {
  return page.evaluate(async () => {
    const rules = await import('/src/simulation/battle.ts');
    const b = window.__orrery.battle; // The debug getter returns a detached snapshot.
    const mages = b.actors.filter(a => a.team === 'mage' && a.hp > 0);
    const enemies = b.actors.filter(a => a.team === 'enemy' && a.hp > 0);
    const options = mages.map(mage => rules.availableSpells(b, mage.id).filter(spell => spell.cost <= mage.ember).flatMap(spell => b.actors.filter(target => target.team === spell.target && target.hp > 0).map(target => ({ actorId: mage.id, spellId: spell.id, targetId: target.id }))));
    const combinations = options.reduce((sets, choices) => sets.flatMap(set => choices.map(choice => [...set, choice])), [[]]);
    let best = null;
    for (const plans of combinations) {
      const result = rules.resolveRound(b, plans), next = result.battle;
      let score = next.phase === 'victory' ? 100000 : next.phase === 'defeat' ? -100000 : 0;
      for (const enemy of enemies) {
        const after = next.actors.find(a => a.id === enemy.id);
        score += (enemy.hp - after.hp) * 1.2 + (enemy.ward - after.ward) * .3;
        if (after.hp <= 0) score += 16;
        else if (after.markedUntil >= next.round && enemy.markedUntil < b.round) score += 5;
      }
      for (const mage of mages) {
        const after = next.actors.find(a => a.id === mage.id);
        score += (after.hp - mage.hp) * 1.65 + Math.min(after.ward, 11) * .22 + after.ember * .18;
        if (after.hp <= 0) score -= 65;
      }
      if (!best || score > best.score) best = { score, plans, signatureName: result.events.find(e => e.kind === 'cast' && e.spellId === 'unfold')?.name ?? null };
    }
    // BattleEvent text can carry a traditional name while its optional queue name is absent.
    if (best) {
      const signature = best.plans.find(p => p.spellId === 'unfold');
      const actual = rules.resolveRound(b, best.plans).events.some(e => e.kind === 'cast' && e.spellId === 'unfold');
      best.signatureName = signature && actual ? rules.getSpell(b, signature.actorId, 'unfold').name : null;
    }
    return best;
  });
}
async function selectPlan(page, plan) {
  await page.locator(`[data-spell="${plan.spellId}"]`).click();
  await page.waitForFunction(spellId => window.__orrery.plan?.spellId === spellId, plan.spellId);
  if ((await inspect(page)).plan.targetId !== plan.targetId) await page.locator(`[data-target="${plan.targetId}"]`).click();
  await page.waitForFunction(p => window.__orrery.plan?.spellId === p.spellId && window.__orrery.plan?.targetId === p.targetId, plan);
}

try {
  for (const scenario of scenarios) {
    const directory = `evidence/local/benchmark-duo/${scenario.id}`;
    await mkdir(directory, { recursive: true });
    const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 1280, height: 720 }, ...(recordVideo ? { recordVideo: { dir: directory, size: { width: 1280, height: 720 } } } : {}) })));
    const pages = await Promise.all(contexts.map(c => c.newPage())); const [host, guest] = pages;
    const evidence = { ...scenario, recordVideo, started: new Date().toISOString(), checks: [], encounters: [], errors: [], screenshots: [] };
    const bothUntil = predicate => Promise.all(pages.map(page => until(page, predicate)));
    const transportErrors = [];
    pages.forEach((page, i) => {
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => evidence.errors.push({ client: i, message: error.message }));
      page.on('websocket', socket => socket.on('framereceived', event => {
        try { const message = JSON.parse(String(event.payload));
          if (message.type === 'error' || message.type === 'ack' && !message.accepted) {
            transportErrors.push({ client: i, type: message.type, reason: message.reason, at: Date.now() });
            if (transportErrors.length > 24) transportErrors.shift();
          }
        } catch { /* Non-JSON transport frame is not a gameplay assertion. */ }
      }));
    });
    const capture = async (page, name) => { const path = `${directory}/${name}.png`; await page.screenshot({ path }); evidence.screenshots.push(path); };
    async function walkBoth(x, z) { await Promise.all(pages.map(page => walkTo(page, x, z))); }
    async function skipBoth() {
      for (const page of pages) if ((await inspect(page)).playing) {
        try { await page.locator('[data-action="skip"]').click({ force: true, timeout: 1200 }); }
        catch (error) {
          // Natural completion can remove the button between the read and click.
          // Accept only that completed presentation, never a still-playing failure.
          if ((await inspect(page)).playing) throw error;
        }
      }
      await bothUntil(() => !window.__orrery.playing);
    }
    async function encounter(kind) {
      await interact(host); await host.waitForTimeout(180);
      assert.equal((await inspect(host)).battle, null, 'Host consent must not force the guest into battle.');
      await interact(guest); await bothUntil(() => !!window.__orrery.battle);
      const initial = (await inspect(host)).battle;
      assert.equal(initial.variant, scenario.variant);
      assert.deepEqual(initial.actors.filter(a => a.team === 'mage').map(a => a.tradition), scenario.traditions);
      const run = { kind, variant: initial.variant, seed: initial.seed, rounds: [], signatureInspected: false };
      await capture(host, `${kind}-planning`);
      for (let guard = 0; guard < 25; guard++) {
        const before = (await inspect(host)).battle;
        if (before.phase !== 'planning') break;
        const choice = await choosePlans(host); assert.ok(choice?.plans.length, 'A worthwhile legal action must remain available.');
        await Promise.all(choice.plans.map(plan => selectPlan(plan.actorId === 'mage1' ? host : guest, plan)));
        await bothUntil(() => /after this round/i.test(document.querySelector('.round-forecast')?.textContent ?? ''));
        if (kind === 'guardian' && before.round === 1) await capture(host, 'guardian-joint-forecast');
        if (kind === 'lesson' && before.round === 1) {
          await action(host, 'confirm'); await bothUntil(() => !!window.__orrery.shared.ready.mage1);
          const guestOriginal = choice.plans.find(p => p.actorId === 'mage2');
          const alternate = { actorId: 'mage2', spellId: guestOriginal.spellId === 'spark' ? 'mark' : 'spark', targetId: before.actors.find(a => a.team === 'enemy' && a.hp > 0).id };
          await selectPlan(guest, alternate); await bothUntil(() => Object.keys(window.__orrery.shared.ready).length === 0);
          await selectPlan(guest, guestOriginal);
          evidence.checks.push('concurrent personal plans accepted; edit after ready cleared joint readiness');
        }
        await Promise.all(pages.map(page => action(page, 'confirm')));
        await Promise.all(pages.map(page => page.waitForFunction(revision => window.__orrery.battle?.revision === revision + 1, before.revision)));
        const committed = (await inspect(host)).battle;
        assert.deepEqual((await inspect(guest)).battle, committed);
        await Promise.all(pages.map(page => page.keyboard.press('Enter')));
        if (choice.signatureName && !run.signatureInspected) {
          await host.locator('.resolution h3').filter({ hasText: choice.signatureName }).waitFor({ state: 'visible', timeout: 18000 });
          await host.waitForTimeout(250); await capture(host, `${kind}-signature-early`);
          await host.waitForTimeout(650); await capture(host, `${kind}-signature-middle`);
          run.signatureInspected = true;
        }
        await skipBoth();
        assert.deepEqual((await inspect(host)).battle, committed); assert.deepEqual((await inspect(guest)).battle, committed);
        run.rounds.push({ round: before.round, plans: choice.plans, intentions: before.intentions, ending: committed.actors.map(a => ({ id: a.id, hp: a.hp, ward: a.ward, ember: a.ember, hand: a.hand })) });
      }
      const final = (await inspect(host)).battle;
      assert.equal(final.phase, 'victory', `${scenario.id} ${kind} diagnostic policy must finish the encounter.`);
      assert.equal(final.rewardGranted, true);
      assert.equal((await inspect(host)).stage, kind === 'lesson' ? 3 : 5);
      await capture(host, `${kind}-victory`);
      run.result = final.phase; evidence.encounters.push(run);
      evidence.checks.push(`${kind} completed through real spell/target/confirm UI; both committed states matched; skip/repeated Enter harmless`);
      await action(host, 'leave-battle'); await bothUntil(() => window.__orrery.battle === null);
    }
    try {
      await Promise.all(pages.map(page => page.goto(base)));
      await Promise.all(pages.map(page => until(page, () => window.__orrery?.loadedAtMs > 0, 60000)));
      for (const page of pages) { assert.deepEqual((await inspect(page)).loadingErrors, []); await action(page, 'begin'); }
      await action(host, 'shared'); await action(host, 'host');
      const invitation = await host.locator('#invite-output').inputValue(); await closePanel(host);
      await action(guest, 'shared'); await guest.locator('#join-input').fill(invitation); await action(guest, 'join');
      await bothUntil(() => window.__orrery.shared?.paused === false);
      await configure(host, scenario.traditions[0], scenario.variant); await configure(guest, scenario.traditions[1]);
      await sleep(200); // Allow acknowledged configuration snapshots to settle before proximity consent.
      evidence.checks.push('session created/joined and model/personal traditions selected through DOM');
      await walkBoth(-3, 6); await Promise.all(pages.map(openInteraction));
      await action(host, 'accept'); await bothUntil(() => window.__orrery.stage === 1);
      assert.equal((await inspect(guest)).modal, 'npc'); await closePanel(guest);
      await walkTo(host, -3, 14); await walkTo(host, -10, 14); await walkTo(host, -10, 11.7); await interact(host); await host.waitForTimeout(250);
      assert.equal((await inspect(host)).stage, 1); assert.equal((await inspect(guest)).stage, 1);
      assert.equal(factsOf(await inspect(host))?.echo, true); assert.equal(factsOf(await inspect(guest))?.echo, true);
      await capture(host, 'optional-echo'); evidence.checks.push('optional echo shared once without advancing required chapter; local NPC dialogue preserved');
      await walkTo(host, -10, 14); await walkTo(host, -3, 14); await walkBoth(3, 7); await walkBoth(4, 1); await interact(host); await bothUntil(() => window.__orrery.stage === 2);
      await walkBoth(2.5, -4); await walkBoth(0, -4); await encounter('lesson');
      await walkBoth(-4, -9); await interact(host); await bothUntil(() => window.__orrery.stage === 4);
      await walkBoth(0, -14); await encounter('guardian');
      const won = await inspect(host); assert.equal(factsOf(won).echo, true);
      await guest.reload(); await until(host, () => window.__orrery.shared?.paused === true);
      await until(guest, () => window.__orrery?.loadedAtMs > 0, 60000);
      await action(guest, 'begin'); await action(guest, 'shared'); await action(guest, 'resume-shared');
      await bothUntil(() => window.__orrery.shared?.paused === false && window.__orrery.stage === 5);
      assert.equal(factsOf(await inspect(guest)).echo, true); assert.equal((await inspect(guest)).playing, false);
      const received = (await inspect(guest)).metrics.received;
      await action(guest, 'shared'); await action(guest, 'rejoin');
      await guest.waitForFunction(before => window.__orrery.metrics.received > before && !window.__orrery.shared.paused, received);
      assert.equal((await inspect(guest)).stage, 5); assert.equal((await inspect(guest)).playing, false);
      evidence.checks.push('fresh-page and same-client seat rejoin restored completed quest plus optional fact without cinematic replay');
      await capture(guest, 'rejoined-completion');
      evidence.final = await Promise.all(pages.map(async page => { const s = await inspect(page); return { stage: s.stage, facts: factsOf(s), renderer: s.renderer, viewport: s.viewport, drawingBuffer: s.drawingBuffer, loadingErrors: s.loadingErrors, resources: s.resources, network: s.metrics }; }));
      assert.deepEqual(evidence.errors, []); evidence.result = 'passed';
    } catch (error) {
      evidence.result = 'failed'; evidence.failure = String(error); evidence.transportErrors = transportErrors; process.exitCode = 1;
      evidence.failureState = await Promise.all(pages.map(async page => { try { return await inspect(page); } catch { return null; } }));
      await Promise.all(pages.map((page, i) => capture(page, `failure-client-${i}`).catch(() => {})));
      console.error(`${scenario.id}:`, error);
    } finally {
      await Promise.all(contexts.map(context => context.close()));
      evidence.videos = recordVideo ? await Promise.all(pages.map(async page => relative(process.cwd(), await page.video().path()).replaceAll('\\', '/'))) : [];
      evidence.completed = new Date().toISOString(); report.results.push(evidence);
      await writeFile(`${directory}/report.json`, JSON.stringify(evidence, null, 2));
      console.log(JSON.stringify({ scenario: scenario.id, result: evidence.result, rounds: evidence.encounters.map(e => ({ kind: e.kind, rounds: e.rounds.length })), failure: evidence.failure }));
    }
    if (process.exitCode) break;
  }
} finally {
  await browser.close(); report.completed = new Date().toISOString();
  report.performanceCaveat = 'Two real game clients share one local GPU; optional RECORD_VIDEO=1 adds recording cost. Screenshots are always captured. No benchmark performance claims are drawn from this walkthrough. No two-device internet validation.';
  await writeFile(process.env.EVIDENCE_FILE || 'evidence/benchmark-duo.json', JSON.stringify(report, null, 2));
}
