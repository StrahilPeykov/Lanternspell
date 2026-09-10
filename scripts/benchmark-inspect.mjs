import {chromium} from 'playwright';
const b=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});const p=await b.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>console.log('ERROR',e.message));
await p.goto('http://127.0.0.1:5180');await p.waitForFunction(()=>window.__orrery?.loadedAtMs>0,null,{timeout:60000});await p.click('[data-action=begin]');await p.waitForTimeout(2200);console.log(JSON.stringify(await p.evaluate(()=>window.__orrery)));await p.screenshot({path:'evidence/local/integrated-first.png'});await b.close();
