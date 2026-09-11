// Actual fresh-profile inputs; no debug reads/mutations, save fixtures or battle policy.
// The route follows landmarks observed in the cold audit. It does not prove human comprehension.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('evidence/local', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const walk = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(180); };
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5180');
  assert.equal(await page.locator('#opening [data-tradition]').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Continue', exact: true }).isVisible(), false);
  await page.getByRole('button', { name: 'Begin playing' }).click();
  await walk('w', 700); await walk('a', 500);
  assert.equal(await page.locator('#controls').isVisible(), false);
  await page.getByRole('button', { name: /Talk/ }).click();
  await page.locator('[data-action="accept"]').click();
  await walk('d', 1300); await walk('w', 1450);
  await page.getByRole('button', { name: /Wake lantern/ }).click();
  assert.equal(await page.locator('[role="dialog"]').count(), 0);
  await walk('w', 1500); await walk('a', 550);
  await page.getByRole('button', { name: /Begin practice/ }).click();
  await page.getByRole('button', { name: 'Begin encounter' }).click();
  const cards = [];
  for (let round = 1; round <= 3; round++) {
    await page.waitForSelector('.spell.recommended');
    cards.push(await page.locator('.spell').count());
    await page.locator('.spell.recommended').click();
    await page.getByRole('button', { name: 'Resolve round' }).click();
    // Natural presentation: no skipping this first experience.
    await page.waitForSelector(round === 3 ? '[data-action="leave-battle"]' : '.spell.recommended', { timeout: 15000 });
    await page.screenshot({ path: `evidence/local/ftue-round-${round}.png` });
  }
  assert.deepEqual(cards, [1, 2, 3]);
  await page.getByRole('button', { name: 'Return to the path' }).click();
  await walk('w', 1000); await walk('a', 1000);
  await page.screenshot({ path: 'evidence/local/ftue-book-approach.png' });
  for (let i=0;i<4 && !await page.getByRole('button', {name:/Read field book/}).isVisible();i++) await walk('a',250);
  await page.getByRole('button', { name: /Read field book/ }).click();
  assert.equal(await page.locator('[role="dialog"] [data-tradition]').count(), 2);
  await page.getByRole('button', { name: 'Keep the note' }).click();
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'evidence/local/ftue-after.png' });
  await writeFile('evidence/local/ftue-skimming.json', JSON.stringify({ scenario: 'fresh profile, visible prompts, highlighted choices, no debug or save fixtures', cards, errors, result: 'practice complete; tradition choice reached' }, null, 2));
  console.log('Fresh skimming journey passed: 1 → 2 → 3 cards, practice victory, field-book choice.');
} catch (e) { await page.screenshot({path:'evidence/local/ftue-failure.png'}); throw e; } finally { await browser.close(); }
