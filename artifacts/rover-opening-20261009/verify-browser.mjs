import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const dir = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch({headless:true});
const results = {screens:[], errors:[], checks:[]};
async function shot(page,name) {await page.screenshot({path:dir+name+'.png',fullPage:true});results.screens.push(name)}
async function stage(page,value) {await expect(page.locator('main')).toHaveAttribute('data-stage',value)}
async function noOverflow(page) {expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
async function survey(page) {
 await page.getByRole('button',{name:'跳过简报'}).click();await stage(page,'survey');
 for (const name of ['观察连续岩面','观察松软沙地','观察目标岩层']) await page.getByRole('button',{name,exact:true}).click();
 await page.getByRole('button',{name:'观察完成，制定路线'}).click();await stage(page,'plan');
}
try {
 const context=await browser.newContext({viewport:{width:1440,height:960}});
 const page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));
 await page.goto('http://localhost:4000/mission/rover');
 await page.getByRole('button',{name:'静音进入 · 保留字幕'}).waitFor();await page.waitForTimeout(1500);
 await expect(page.getByText('正在进入控制席')).toHaveCount(0);
 await shot(page,'lobby-desktop');
 await page.getByRole('button',{name:'戴上耳机，进入现场'}).click();
 await expect.poll(()=>page.locator('audio').evaluate(a=>!a.paused && a.currentTime>0)).toBe(true);
 results.checks.push('Chinese narration plays after explicit user gesture');
 await shot(page,'briefing-desktop');
 await page.getByRole('button',{name:'我 我准备好了。'}).click();
 await page.waitForTimeout(1400);await shot(page,'pointing-desktop');
 await page.getByRole('button',{name:'关闭声音'}).click();
 await survey(page);await noOverflow(page);await shot(page,'plan-desktop');
 await page.getByRole('button',{name:/直接穿越/}).click();
 await page.getByRole('button',{name:'发送这份计划'}).click();await stage(page,'execute');
 await page.waitForTimeout(750);await page.getByRole('button',{name:'暂停',exact:true}).click();
 await page.waitForTimeout(11000);await stage(page,'execute');
 await page.getByRole('button',{name:'继续',exact:true}).click();
 await expect(page.locator('main')).toHaveAttribute('data-stage','stopped',{timeout:13000});await shot(page,'stopped-desktop');
 results.checks.push('Direct route stops; pause holds state; resume completes one attempt');
 await page.getByRole('button',{name:'返回起点，重新规划'}).click();
 await page.getByRole('button',{name:/沿岩面绕行/}).click();
 await page.getByRole('button',{name:'发送这份计划'}).click();
 await expect(page.locator('main')).toHaveAttribute('data-stage','capture',{timeout:13000});
 await page.getByRole('button',{name:'取景向右'}).click();await shot(page,'capture-desktop');
 await page.getByRole('button',{name:'按下快门'}).click();await stage(page,'complete');
 await shot(page,'complete-desktop');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'带走我的照片'}).click();
 await (await download).saveAs(dir+'sample-photo.jpg');
 await page.reload();await page.getByRole('button',{name:'继续我的任务'}).click();await stage(page,'complete');
 results.checks.push('Detour arrives, photo can be captured and downloaded; completed guest record survives reload');
 expect(await page.getByRole('link',{name:/把判断，写成/}).getAttribute('href')).toBe('/explore/space-exploration/write-driving-rules');
 await context.close();
 for (const [width,height] of [[390,844],[320,720],[844,390]]) {
   const ctx=await browser.newContext({viewport:{width,height}, reducedMotion:'reduce'});
   const p=await ctx.newPage();p.on('pageerror',e=>results.errors.push(e.message));
   await p.goto('http://localhost:4000/mission/rover');await p.getByRole('button',{name:'静音进入 · 保留字幕'}).click();
   await noOverflow(p);await shot(p,`briefing-${width}`);
   await survey(p);await noOverflow(p);await shot(p,`plan-${width}`);
   await p.reload();await p.getByRole('button',{name:'继续我的任务'}).click();await stage(p,'plan');
   results.checks.push(`Layout, all hotspots, keyboard-sized targets and restoration at ${width}x${height}`);
   await ctx.close();
 }
 expect(results.errors).toEqual([]);
 results.passed=true;
} catch(error){results.passed=false;results.failure=String(error);throw error}
finally {await fs.writeFile(dir+'browser-verification.json',JSON.stringify(results,null,2));await browser.close()}
