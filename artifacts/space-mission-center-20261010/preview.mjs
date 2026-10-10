import {chromium} from '@playwright/test';
const b=await chromium.launch({headless:true}),p=await b.newPage({viewport:{width:1440,height:1050}});
p.on('pageerror',e=>console.log('PAGEERROR',e.message));
await p.goto('http://127.0.0.1:4000/mission/space/control?task=pick-an-observation-site%3AM01');
await p.locator('[data-task-order]').waitFor();
await p.screenshot({path:new URL('desktop.png',import.meta.url).pathname,fullPage:true});
console.log((await p.locator('[data-learning-status]').innerText()).slice(0,200));
await b.close();
