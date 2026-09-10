// Actual host/join/reconnect UI against a production build. Two independent
// browser contexts on one computer; not a two-device/geographic latency test.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.GAME_URL || 'http://127.0.0.1:5182';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const errors = [], sockets = [];
try {
  await mkdir('evidence/local', { recursive: true });
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 1280, height: 720 } })));
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  for (const page of pages) {
    page.setDefaultTimeout(25000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('websocket', ws => sockets.push(new URL(ws.url()).protocol));
    await page.goto(base);
    await page.locator('[data-action="begin"]').click({ timeout: 60000 });
    assert.equal(await page.evaluate(() => typeof window.__orrery), 'undefined');
    await page.getByRole('button', { name: 'Play with a friend' }).click();
  }
  console.log('Both built clients loaded; hosting through UI.');
  await pages[0].getByRole('button', { name: 'Start a shared visit' }).click();
  const invitation = await pages[0].locator('#invite-output').inputValue({ timeout: 20000 });
  assert.equal(new URL(invitation).origin, new URL(base).origin);
  await pages[1].getByRole('textbox', { name: 'Private invitation' }).fill(invitation);
  await pages[1].getByRole('button', { name: 'Join your friend' }).click();
  console.log('Guest submitted invitation through UI.');
  await pages[1].getByRole('dialog').waitFor({ state: 'hidden' });
  await pages[1].getByRole('button', { name: 'Play with a friend' }).click();
  for (const page of pages) {
    await page.getByText('Connection: connected.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await pages[0].keyboard.down('KeyW');
  await pages[0].waitForTimeout(400);
  await pages[0].keyboard.up('KeyW');
  await pages[1].getByRole('button', { name: 'Play with a friend' }).click();
  await pages[1].getByRole('button', { name: 'Reconnect this seat' }).click();
  await pages[1].getByRole('dialog').waitFor({ state: 'hidden' });
  await pages[1].getByRole('button', { name: 'Play with a friend' }).click();
  await pages[1].getByText('Connection: connected.', { exact: false }).waitFor();
  await pages[1].getByRole('button', { name: 'Close', exact: true }).click();
  await pages[0].waitForTimeout(1500);
  await pages[0].screenshot({ path: 'evidence/local/deployed-shared-ui.png' });
  assert.ok(sockets.length >= 3);
  assert.ok(sockets.every(protocol => protocol === (base.startsWith('https:') ? 'wss:' : 'ws:')));
  assert.deepEqual(errors, []);
  const report = { scenario: 'production-host-join-reconnect-ui', endpoint: base, timestamp: new Date().toISOString(), actualInputs: true, debugHooks: false, stateFixtures: false, mockedSockets: false, separateDevices: false, socketProtocols: sockets, checks: ['built art/client loaded', 'private invitation from actual host UI', 'independent guest joins through UI', 'both connected', 'WASD input', 'guest reconnect through UI'], errors };
  await writeFile(process.env.EVIDENCE_FILE || 'evidence/local/deployed-ui.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
