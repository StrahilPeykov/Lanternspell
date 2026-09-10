import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
 for(const mode of ['courtyard','pocket','guardian','mages']){await page.goto('http://127.0.0.1:5180/art/benchmark-preview.html?mode='+mode);await page.waitForFunction(()=>window.artReady);await page.waitForTimeout(700);await page.screenshot({path:'art/preview-benchmark-'+mode+'.png'});console.log('captured',mode);}
}finally{await browser.close()}
