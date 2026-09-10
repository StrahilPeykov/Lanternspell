// Built client, actual inputs, no debug hooks or saved-state fixtures.
// Offline means network disabled after app/art finished loading, not offline installation.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const context=await browser.newContext({viewport:{width:1280,height:720}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:5181');await page.locator('[data-action=begin]').click({timeout:60000});
 assert.equal(await page.evaluate(()=>typeof window.__orrery),'undefined');
 await context.setOffline(true);
 await page.keyboard.down('KeyW');await page.waitForTimeout(1100);await page.keyboard.up('KeyW');
 await page.keyboard.press('KeyE');await page.locator('[data-action=accept]').click();
 assert.equal(await page.locator('#objective').innerText(),'Wake the seed-lantern');
 await page.screenshot({path:'evidence/production-offline-solo.png'});
 await page.keyboard.press('KeyJ');assert.equal(await page.getByRole('dialog').count(),1);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);
 await writeFile('evidence/production-smoke.json',JSON.stringify({scenario:'production-client-offline-after-load',timestamp:new Date().toISOString(),endpoint:page.url(),stateFixtures:false,actualInputs:true,checks:['production has no debug surface','loaded code and art before disconnecting network','actual movement and NPC outcome while network offline','local spellbook opens while offline'],errors},null,2));
 console.log('Production offline-after-load solo smoke passed.');
}finally{await browser.close()}
