import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const dir=new URL('./',import.meta.url).pathname;
const report={passed:false, checks:[], errors:[]};
try {
 const page=await browser.newPage({viewport:{width:1440,height:1080}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:4000/mission/rover/video');
 const video=page.locator('video');
 await expect.poll(()=>video.evaluate(v=>v.readyState),{timeout:15000}).toBeGreaterThanOrEqual(2);
 const metadata=await video.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,playsInline:v.playsInline,paused:v.paused}));
 expect(metadata.duration).toBeGreaterThanOrEqual(8.5);expect(metadata.width).toBeGreaterThanOrEqual(1900);expect(metadata.paused).toBe(true);expect(metadata.playsInline).toBe(true);report.metadata=metadata;
 await page.getByRole('button',{name:'播放有声样片'}).click();
 await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(.5);
 expect(await video.evaluate(v=>v.muted)).toBe(false);
 await video.evaluate(v=>v.pause());const at=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(400);expect(await video.evaluate(v=>v.currentTime)).toBe(at);
 await page.getByRole('button',{name:'从头播放'}).click();await expect.poll(()=>video.evaluate(v=>!v.paused)).toBe(true);
 await video.evaluate(v=>{v.currentTime=v.duration-.4});await expect(page.getByRole('button',{name:'再看一遍'})).toBeVisible({timeout:5000});
 await page.getByRole('button',{name:'再看一遍'}).click();await video.evaluate(v=>{v.pause();v.currentTime=3.5});
 await page.screenshot({path:dir+'video-desktop.png',fullPage:true});
 report.checks.push('1080P video metadata, opt-in sound, inline playback, pause, ending and replay');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:dir+'video-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.getByRole('link',{name:'进入可操作的火星任务'}).getAttribute('href')).toBe('/mission/rover');
 report.checks.push('390px layout without horizontal overflow and link to interactive mission');
 const context=await browser.newContext();await context.route('**/lin-lan-welcome-v1.mp4',r=>r.abort());const failed=await context.newPage();await failed.goto('http://localhost:4000/mission/rover/video');await expect(failed.getByRole('button',{name:'重新加载'})).toBeVisible();await context.unroute('**/lin-lan-welcome-v1.mp4');await failed.getByRole('button',{name:'重新加载'}).click();await expect.poll(()=>failed.locator('video').evaluate(v=>!v.paused&&v.currentTime>0),{timeout:15000}).toBe(true);await context.close();report.checks.push('Video-load failure is visible and retry recovers playback');
 expect(report.errors).toEqual([]);report.passed=true;
}catch(error){report.failure=String(error);throw error}finally{await fs.writeFile(dir+'verification.json',JSON.stringify(report,null,2));await browser.close()}
