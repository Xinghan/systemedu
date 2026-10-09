import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url).pathname;
const report={passed:false,checks:[],errors:[]};
const browser=await chromium.launch({headless:true});
const url='http://localhost:4000/mission/rover';
async function start(context,silent=false){const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);await p.getByRole('button',{name:silent?'静音进入 · 保留字幕':'戴上耳机，进入现场'}).click();return p}
async function seek(v,time){await v.evaluate((n,t)=>new Promise(resolve=>{n.addEventListener('seeked',()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)),{once:true});n.currentTime=t}),time)}
async function shot(p,name){await p.screenshot({path:dir+name+'.png',fullPage:true})}
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:960}});
 const p=await start(ctx),v=p.locator('video');
 await expect.poll(()=>v.evaluate(n=>n.currentTime),{timeout:15000}).toBeGreaterThan(.3);
 const meta=await v.evaluate(n=>({width:n.videoWidth,height:n.videoHeight,duration:n.duration,muted:n.muted,inline:n.playsInline}));
 expect(meta.duration).toBeCloseTo(28.6,0);expect(meta.height).toBe(1080);expect(meta.muted).toBe(false);expect(meta.inline).toBe(true);report.metadata=meta;
 expect(await p.locator('audio').evaluate(n=>n.paused)).toBe(true);
 await p.getByRole('button',{name:'暂停简报',exact:true}).click();const t=await v.evaluate(n=>n.currentTime);await p.waitForTimeout(350);expect(await v.evaluate(n=>n.currentTime)).toBe(t);
 await seek(v,3);await p.waitForTimeout(150);await shot(p,'welcome-desktop');
 await p.getByRole('button',{name:'关闭声音'}).click();expect(await v.evaluate(n=>n.muted)).toBe(true);
 await p.getByRole('button',{name:'开启声音'}).click();expect(await v.evaluate(n=>n.muted)).toBe(false);expect(await v.evaluate(n=>n.currentTime)).toBeGreaterThan(2.9);
 await seek(v,12);await expect(p.getByText('带回岩层的照片',{exact:true})).toBeVisible();await shot(p,'terrain-desktop');
 await seek(v,23);await expect(p.getByText('现在，交给你',{exact:true})).toBeVisible();await shot(p,'handover-desktop');
 await p.getByRole('button',{name:'播放简报',exact:true}).click();
 await p.getByRole('button',{name:'查看保存状态'}).click();await expect.poll(()=>v.evaluate(n=>n.paused)).toBe(true);await p.getByRole('button',{name:'关闭记录'}).click();
 await p.getByRole('button',{name:'从头播放简报'}).click();await expect.poll(()=>v.evaluate(n=>n.currentTime<2&&!n.paused)).toBe(true);
 await v.evaluate(n=>{n.currentTime=n.duration-.3});await expect(p.getByRole('button',{name:'重播简报',exact:true})).toBeVisible({timeout:4000});
 report.checks.push('1080P continuous film, sound without duplicate narration, three chapter captions, pause, seek, mute without restart, dialog pause, ending and replay');
 await p.getByRole('button',{name:'我 打开前视相机。'}).click();await expect(v).toHaveCount(0);await expect(p.locator('main')).toHaveAttribute('data-stage','survey');
 for(const name of ['观察连续岩面','观察松软沙地','观察目标岩层'])await p.getByRole('button',{name,exact:true}).click();
 await p.getByRole('button',{name:'观察完成，制定路线'}).click();await p.getByRole('button',{name:/沿岩面绕行/}).click();await p.getByRole('button',{name:'发送这份计划'}).click();
 await expect(p.locator('main')).toHaveAttribute('data-stage','capture',{timeout:13000});await p.getByRole('button',{name:'按下快门'}).click();await expect(p.locator('main')).toHaveAttribute('data-stage','complete');
 await p.reload();await p.getByRole('button',{name:'继续我的任务'}).click();await expect(p.locator('main')).toHaveAttribute('data-stage','complete');
 report.checks.push('Film hands off to original observation, route execution, photograph and persisted guest record');await ctx.close();
 for(const width of [390,320]){
  const c=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});const q=await start(c,true),m=q.locator('video');
  await expect.poll(()=>m.evaluate(n=>n.currentTime),{timeout:15000}).toBeGreaterThan(.2);expect(await m.evaluate(n=>n.muted)).toBe(true);
  await m.evaluate(n=>n.pause());await seek(m,12);await q.waitForTimeout(200);expect(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await shot(q,'terrain-'+width);
  await seek(m,23);await q.waitForTimeout(150);await shot(q,'handover-'+width);
  await q.getByRole('button',{name:'跳过简报'}).click();await expect(q.locator('main')).toHaveAttribute('data-stage','survey');await c.close();
 }
 report.checks.push('320px and 390px silent inline playback, captions, no horizontal overflow, working skip');
 const c=await browser.newContext();await c.route('**/rover-briefing-v1.mp4',r=>r.abort());const q=await start(c,true);
 await expect(q.getByRole('button',{name:'重新加载视频'})).toBeVisible();await c.unroute('**/rover-briefing-v1.mp4');await q.getByRole('button',{name:'重新加载视频'}).click();await expect.poll(()=>q.locator('video').evaluate(n=>n.currentTime),{timeout:15000}).toBeGreaterThan(.2);await c.close();
 report.checks.push('Failed media shows readable mission and retry successfully loads the same film');expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'verification.json',JSON.stringify(report,null,2));await browser.close()}
