import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Battle } from '../src/simulation/battle';

test.use({ actionTimeout: 10_000 });

type Inspection = { stage: number; battle: Battle | null; playing: boolean; started: boolean; modal: string; position: { x: number; z: number; yaw: number }; camera: { yaw: number; distance: number }; loadingErrors: string[]; loadedAtMs: number; effectChildren: number; [key: string]: unknown };
const inspect = (page: Page): Promise<Inspection> => page.evaluate(() => (window as unknown as { __orrery: Inspection }).__orrery);

/** Navigation uses only keyboard input. Diagnostics are read-only; no saves or gameplay state are injected. */
async function walkTo(page: Page, x: number, z: number) {
  await page.keyboard.press('KeyR');
  for (let tries = 0; tries < 80; tries++) {
    const { position } = await inspect(page);
    const dx = x - position.x, dz = z - position.z;
    if (Math.hypot(dx, dz) < 1.25) return;
    const keys = [...(Math.abs(dx) > .65 ? [dx > 0 ? 'KeyD' : 'KeyA'] : []), ...(Math.abs(dz) > .65 ? [dz > 0 ? 'KeyS' : 'KeyW'] : [])];
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(250);
    for (const key of keys) await page.keyboard.up(key);
  }
  throw new Error(`Input navigation failed reaching ${x},${z}; last position ${JSON.stringify((await inspect(page)).position)}`);
}
async function interactAndAccept(page: Page, x: number, z: number) {
  await walkTo(page, x, z);
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('[data-action="accept"]').click();
}
async function cast(page: Page, spell: string, screenshot?: string) {
  const before = await inspect(page);
  await page.locator(`[data-spell="${spell}"]`).click();
  await expect(page.locator('[data-action="confirm"]')).toBeEnabled();
  await page.locator('[data-action="confirm"]').click();
  await expect(page.locator('[data-action="skip"]')).toBeVisible();
  const committed = await inspect(page);
  expect(committed.battle!.revision).toBe(before.battle!.revision + 1);
  // Repeated real input while playback is running must not apply a second round.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  if (screenshot) { await page.waitForTimeout(950); await page.screenshot({ path: screenshot }); }
  // The panel can replace its button between consecutive spell events. Send real mouse input
  // without waiting for two stable animation frames; a naturally completed round is also safe.
  try { await page.locator('[data-action="skip"]').click({ force: true, timeout: 1500 }); }
  catch (error) { if ((await inspect(page)).playing) throw error; }
  await page.keyboard.press('Enter'); // No prepared plan after skip.
  const skipped = await inspect(page);
  expect(skipped.battle).toEqual(committed.battle);
  expect(skipped.playing).toBe(false);
  expect(skipped.effectChildren).toBe(0);
}

async function castToCompletion(page: Page, spell: string, minimumMs: number, screenshot?: string) {
  const before = await inspect(page);
  await page.locator(`[data-spell="${spell}"]`).click();
  const start = Date.now();
  await page.locator('[data-action="confirm"]').click();
  await expect(page.locator('[data-action="skip"]')).toBeVisible();
  const committed = await inspect(page);
  expect(committed.battle!.revision).toBe(before.battle!.revision + 1);
  await page.keyboard.press('Enter');
  if (screenshot) { await page.waitForTimeout(950); await page.screenshot({ path: screenshot }); }
  await expect.poll(async () => (await inspect(page)).playing, { timeout: 15_000 }).toBe(false);
  const elapsedMs = Date.now() - start;
  expect(elapsedMs).toBeGreaterThanOrEqual(minimumMs);
  const finished = await inspect(page);
  expect(finished.battle).toEqual(committed.battle);
  expect(finished.effectChildren).toBe(0);
  return { spell, elapsedMs, skipped: false, revision: committed.battle!.revision };
}

test('actual-input solo chapter, settings gates, committed playback skip, and save reload', async ({ page }) => {
  await mkdir('evidence', { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const started = Date.now();
  await page.goto('/');
  await expect(page.locator('[data-action="begin"]')).toBeVisible();
  await expect.poll(async () => (await inspect(page))?.loadedAtMs, { timeout: 60_000 }).toBeGreaterThan(0);
  expect((await inspect(page)).loadingErrors).toEqual([]);
  await page.screenshot({ path: 'evidence/runtime-01-opening.png' });
  await page.locator('[data-action="coral"]').click();
  await page.locator('[data-action="begin"]').click();
  await expect(page.locator('#objective')).toHaveText('Speak with Keeper Iona');

  // Actual orbit and recenter input; no pointer lock is used.
  await page.mouse.move(900, 390); await page.mouse.down(); await page.mouse.move(1020, 410, { steps: 8 }); await page.mouse.up();
  expect(Math.abs((await inspect(page)).camera.yaw)).toBeGreaterThan(.2);
  await page.keyboard.press('KeyR'); expect((await inspect(page)).camera.yaw).toBe(0);
  await page.mouse.wheel(0, 3000); expect((await inspect(page)).camera.distance).toBe(13);
  await page.keyboard.press('KeyR');

  // Modal gates movement and orbit. Essential forward input is remapped through the UI.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const gated = await inspect(page);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
  expect((await inspect(page)).position).toEqual(gated.position);
  await page.locator('[data-bind="forward"]').click(); await page.keyboard.press('ArrowUp');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const remapStart = (await inspect(page)).position.z;
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500); await page.keyboard.up('ArrowUp');
  expect((await inspect(page)).position.z).toBeLessThan(remapStart - .1);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('[data-bind="forward"]').click(); await page.keyboard.press('KeyW');
  await page.locator('#reduced').check();
  await page.locator('#mute').check();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await interactAndAccept(page, -3, 6);
  expect((await inspect(page)).stage).toBe(1);
  await interactAndAccept(page, 4, 1);
  expect((await inspect(page)).stage).toBe(2);
  await page.screenshot({ path: 'evidence/runtime-02-lantern-path.png' });
  await interactAndAccept(page, 0, -4);
  await expect(page.locator('[data-spell="mark"]')).toBeVisible();
  await page.screenshot({ path: 'evidence/runtime-03-lesson-planning.png' });
  const fullPlayback = [await castToCompletion(page, 'mark', 2100), await castToCompletion(page, 'unfold', 3200, 'evidence/runtime-04-folded-sky.png')];
  expect((await inspect(page)).battle?.phase).toBe('victory');
  expect((await inspect(page)).stage).toBe(3);
  await page.locator('[data-action="leave-battle"]').click();
  await interactAndAccept(page, -5, -9);
  expect((await inspect(page)).stage).toBe(4);
  await interactAndAccept(page, 0, -14);
  expect((await inspect(page)).battle?.upgraded).toBe(true);
  await page.screenshot({ path: 'evidence/runtime-05-guardian-planning.png' });
  for (const spell of ['unseal', 'mark', 'unfold', 'unseal', 'mark', 'spark']) await cast(page, spell, spell === 'unfold' ? 'evidence/runtime-06-guardian-signature.png' : undefined);
  const victory = await inspect(page);
  expect(victory.battle?.phase).toBe('victory'); expect(victory.stage).toBe(5);
  await page.screenshot({ path: 'evidence/runtime-07-victory.png' });
  await page.waitForTimeout(3600); // Any old skipped cinematic completion must remain harmless.
  expect((await inspect(page)).battle).toEqual(victory.battle);
  await page.locator('[data-action="leave-battle"]').click();
  await walkTo(page, 0, -18);
  await page.screenshot({ path: 'evidence/runtime-08-awakened-orrery.png' });
  const completed = await inspect(page);

  await page.reload();
  await page.locator('[data-action="continue"]').click();
  expect((await inspect(page)).stage).toBe(5);
  expect((await inspect(page)).battle).toBeNull();
  await expect(page.locator('#objective')).toHaveText('Bellweather is awake');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('#reduced')).toBeChecked(); await expect(page.locator('#mute')).toBeChecked();
  await page.locator('#quality').check();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.waitForTimeout(1800);
  const low = await inspect(page);
  await page.screenshot({ path: 'evidence/runtime-09-low-settings.png' });

  // Export the actual completed visit, reset through Settings, then import that downloaded file.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.locator('[data-action="export"]').click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('sleeping-orrery-solo.json');
  await download.saveAs('evidence/solo-export.json');
  const exported = JSON.parse(await readFile('evidence/solo-export.json', 'utf8'));
  expect(exported.stage).toBe(5); expect(exported.mode).toBe('solo');
  await page.locator('[data-action="restart"]').click();
  expect((await inspect(page)).stage).toBe(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#import').setInputFiles('evidence/solo-export.json');
  await expect(page.locator('#toast')).toHaveText('Your solo visit is restored.');
  const imported = await inspect(page);
  expect(imported.stage).toBe(5); expect(imported.battle).toBeNull();
  expect(imported.position).toEqual(exported.position);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#import').setInputFiles({ name: 'malformed-solo.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.locator('#toast')).toContainText('SyntaxError');
  const rejected = await inspect(page);
  expect(rejected.stage).toBe(imported.stage); expect(rejected.battle).toEqual(imported.battle); expect(rejected.position).toEqual(imported.position);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(errors).toEqual([]);
  await writeFile('evidence/solo-input-runtime.json', JSON.stringify({ scenario: 'actual-input-solo-full-loop', endpoint: page.url(), mockedNetwork: false, stateFixtures: false, elapsedMs: Date.now() - started, browser: 'Playwright bundled Chromium, headless', performanceCaveat: 'Renderer identity is recorded below. This one local headless D3D11 run is not a general hardware certification; low sample includes reload startup.', checks: ['keyboard exploration', 'drag orbit/recenter/zoom clamp', 'modal movement gate', 'remapped movement', 'NPC', 'lantern', 'lesson victory', 'signature observed', 'spell discovery', 'guardian victory', 'skip/repeated Enter no duplicate commit', 'ordinary and signature natural callback no duplicate commit', 'changed world', 'save reload', 'settings persistence', 'actual save export download and import roundtrip', 'malformed JSON rejected without gameplay mutation'], fullPlayback, high: completed, low, errors }, null, 2));
});

test('actual-input free-attack defeat and fresh guardian retry without state fixtures', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const started = Date.now();
  await page.goto('/');
  await expect.poll(async () => (await inspect(page))?.loadedAtMs, { timeout: 60_000 }).toBeGreaterThan(0);
  await page.locator('[data-action="begin"]').click();
  await interactAndAccept(page, -3, 6);
  await interactAndAccept(page, 4, 1);
  await interactAndAccept(page, 0, -4);
  await cast(page, 'mark'); await cast(page, 'unfold');
  await page.locator('[data-action="leave-battle"]').click();
  await interactAndAccept(page, -5, -9);
  await interactAndAccept(page, 0, -14);
  let rounds = 0;
  while ((await inspect(page)).battle?.phase === 'planning' && rounds < 20) { await cast(page, 'spark'); rounds++; }
  const defeated = await inspect(page);
  expect(defeated.battle?.phase).toBe('defeat'); expect(defeated.stage).toBe(4);
  expect(defeated.battle?.rewardGranted).toBe(false);
  expect(defeated.battle?.actors.find(a => a.id === 'mage1')?.hp).toBe(0);
  await page.screenshot({ path: 'evidence/runtime-10-defeat.png' });
  await page.locator('[data-action="leave-battle"]').click();
  expect((await inspect(page)).battle).toBeNull();
  await interactAndAccept(page, 0, -14);
  const retried = await inspect(page);
  expect(retried.stage).toBe(4); expect(retried.battle?.phase).toBe('planning');
  expect(retried.battle?.round).toBe(1); expect(retried.battle?.revision).toBe(0);
  expect(retried.battle?.id).not.toBe(defeated.battle?.id);
  expect(retried.battle?.actors.find(a => a.id === 'mage1')?.hp).toBe(38);
  expect(retried.battle?.rewardGranted).toBe(false);
  await page.screenshot({ path: 'evidence/runtime-11-retry.png' });
  expect(errors).toEqual([]);
  await writeFile('evidence/solo-defeat-retry.json', JSON.stringify({ scenario: 'actual-input-free-attack-defeat-and-retry', endpoint: page.url(), stateFixtures: false, mockedNetwork: false, elapsedMs: Date.now() - started, guardianRounds: rounds, defeated, retried, errors }, null, 2));
});
