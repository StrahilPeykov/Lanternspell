import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function sample(){
 return page.evaluate(async()=>{
  const values=[];let last=performance.now();const start=last;
  await new Promise(resolve=>{function frame(t){values.push(t-last);last=t;if(t-start<12000)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});
  const sorted=values.slice(1).sort((a,b)=>a-b);const q=p=>sorted[Math.floor((sorted.length-1)*p)];
  return {inspection:window.__orrery,steadyFrameMs:{p50:q(.5),p95:q(.95),p99:q(.99),samples:sorted.length,durationMs:last-start}};
 });
}
try{
 await page.goto('http://127.0.0.1:5180');await page.waitForFunction(()=>window.__orrery?.loadedAtMs>0);
 await page.click('[data-action=begin]');await page.waitForTimeout(2500);
 const high=await sample();await page.screenshot({path:'evidence/local/benchmark-high.png'});
 await page.setViewportSize({width:1280,height:720});await page.click('[data-action=settings]');await page.check('#quality');await page.click('[data-action=close]');await page.waitForTimeout(2500);
 const low=await sample();await page.screenshot({path:'evidence/local/benchmark-low.png'});
 const report={scenario:'steady-state-courtyard-two-settings',date:new Date().toISOString(),build:'0.1.0 development',fixtures:false,input:'UI starts solo and selects low graphics; stationary courtyard sampling excludes loading warmup',browser:await browser.version(),headless:true,requestedBackend:'D3D11; actual identity below',high,low,errors,caveat:'One Intel machine. Stationary exploration, not worst-case combat; no broad GPU/device guarantee.'};
 await writeFile(process.env.PERF_OUTPUT??'evidence/local/benchmark-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify({high:high.steadyFrameMs,low:low.steadyFrameMs,renderer:high.inspection.renderer,errors}));
}finally{await browser.close()}

