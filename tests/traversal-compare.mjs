// Same timed real keyboard/mouse route for five controlled profile combinations.
// Diagnostics are read-only. No state mutation, teleport or save fixture.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const root = 'evidence/local/traversal-final'; await mkdir(root, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] });
const runs = [];
try {
  for (const [movement, camera] of [['baseline','manual'], ['snappy','manual'], ['weighty','manual'], ['snappy','gentle'], ['snappy','adventure']]) {
    const name = `${movement}-${camera}`;
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: `${root}/${name}`, size: { width:1280, height:720 } } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:5180/?movement=${movement}&camera=${camera}`);
    await page.getByRole('button', { name: 'Begin playing' }).click();
    await page.waitForTimeout(500);
    const samples = [];
    const sample = async label => {
      samples.push({ label, time: Date.now(), ...await page.evaluate(() => { const d=window.__orrery; return { position:d.position, camera:d.camera, traversal:d.traversal, renderer:d.renderer, loadingErrors:d.loadingErrors }; }) });

    };
    const move = async (keys, ms, label) => {
      for (const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(ms); await sample(label);
      for (const k of keys) await page.keyboard.up(k);
      await page.waitForTimeout(200);
    };
    await move(['w'],700,'forward');
    await move(['d'],850,'around basin');
    await move(['w'],1400,'90 degree turn');
    await move(['a','w'],450,'curve');
    await move(['s'],200,'brief backward');
    await move(['s'],2800,'sustained backward');
    await move(['w','Shift'],1600,'180 turn and sprint');
    await page.keyboard.down('a');
    await page.mouse.move(800,330); await page.mouse.down();
    await page.mouse.move(990,340,{steps:20}); await sample('manual orbit while moving');
    await page.mouse.up(); await page.waitForTimeout(1100); await sample('manual grace');
    await page.waitForTimeout(2400); await sample('follow resumes');
    await page.keyboard.press('r'); await page.waitForTimeout(450); await sample('recenter');
    await page.keyboard.up('a'); await page.waitForTimeout(350); await sample('stop');
    await page.screenshot({ path: `${root}/${name}-end.png` });
    await context.close();
    runs.push({ movement, camera, samples });
    console.log(name, 'recorded');
  }
} finally { await browser.close(); }
await writeFile(`${root}/comparison.json`,JSON.stringify({ scenario:'same real inputs; read-only diagnostics; local D3D11 captures', runs },null,2));
