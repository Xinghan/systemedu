import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url).pathname,origin='http://localhost:4000',hub=origin+'/mission/space';
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const report={passed:false,checks:[],errors:[]};
const watch=p=>p.on('pageerror',e=>report.errors.push(e.message));
const film=(p,n)=>p.locator(`[data-stage-film="${n}"]`);
const playing=async p=>expect.poll(()=>p.locator('video').evaluate(v=>!v.paused&&v.currentTime>0),{timeout:20000}).toBe(true);
const close=async p=>{await p.getByRole('button',{name:'关闭任务短片',exact:true}).click();await expect(p.locator('dialog[open]')).toHaveCount(0)};
const key=n=>`systemedu:mission:space:stage-film:${n}:v1`;
try {
 const c=await browser.newContext({viewport:{width:1440,height:1050}}),p=await c.newPage();watch(p);let writes=0;const requested=new Set();
 p.on('request',r=>{if(r.url().includes('/api/learning/')&&!['GET','OPTIONS'].includes(r.method()))writes++;if(r.url().endsWith('.mp4'))requested.add(new URL(r.url()).pathname)});
 await p.goto(origin+'/library?view=lines');await p.locator('[data-line-card="space-exploration"]').click();
 await expect(film(p,1)).toBeVisible();await playing(p);expect(requested.size).toBe(1);
 expect(await p.evaluate(k=>localStorage.getItem(k),key(1))).toBe('1');
 await p.screenshot({path:dir+'stage-1-desktop.png'});await close(p);
 await expect(p.locator('[data-stage-replay]')).toBeFocused();
 await p.reload();await expect(p.getByRole('button',{name:'刷新进展'})).toBeEnabled();await expect(p.locator('dialog')).toHaveCount(0);
 for(const n of [2,3,4,5]) {
  await p.locator(`[data-journey-level="${n}"]`).click();await expect(film(p,n)).toBeVisible();await playing(p);
  await expect(p.locator('video')).toHaveAttribute('src',`/mission/space/video/stage-${n}-v1.mp4`);
  expect(await p.locator('video').evaluate(v=>v.duration)).toBeGreaterThan(18);
  await p.locator('video').evaluate(v=>v.currentTime=v.duration-.3);await expect(film(p,n)).toHaveCount(0,{timeout:10000});
 }
 expect([...requested].filter(s=>s.includes('/mission/space/')).length).toBe(5);
 for(const station of ['mission-design','mechanics','perception','autonomy','planet-science']) {
  await p.locator(`[data-mission-node="${station}"]`).click();await expect(p.locator('[data-journey-station]')).toHaveAttribute('data-journey-station',station);await expect(p.locator('dialog')).toHaveCount(0);
 }
 await p.locator('[data-stage-replay]').click();await expect(film(p,5)).toBeVisible();await playing(p);await close(p);
 expect(writes).toBe(0);await c.close();
 report.checks.push('Line entrance plays only stage 1; five distinct actual videos play and end back at task; same-stage stations and both final specialisms deduplicate; reload and replay work; no completion writes; other videos are not prefetched');
 const direct=await browser.newContext(),d=await direct.newPage();watch(d);
 await d.goto(hub+'?station=expedition');await expect(film(d,4)).toBeVisible();await playing(d);expect(await d.evaluate(k=>localStorage.getItem(k),key(1))).toBeNull();await close(d);
 await d.goto(origin+'/explore/space-exploration/write-driving-rules?node=M01');await expect(film(d,2)).toBeVisible();await close(d);
 for(const id of ['lesson-reading','lesson-videos','lesson-references','lesson-notebook'])await expect(d.locator('#'+id)).toBeAttached();
 await d.locator('[data-journey-return] a').click();await expect(d.locator('[data-journey-station]')).toHaveAttribute('data-journey-station','perception');await expect(d.locator('dialog')).toHaveCount(0);
 await d.goto(origin+'/explore/space-exploration/assemble-a-rover');await expect(film(d,3)).toBeVisible();await close(d);await expect(d.locator('[data-mission-center]')).toBeVisible();
 await d.goto(origin+'/explore/space-exploration/spot-a-world');await expect(film(d,1)).toBeVisible();await close(d);await expect(d.locator('iframe')).toBeVisible();
 await direct.close();report.checks.push('Direct station arrives at its own stage without playing earlier stages; direct guided course, rover center and micro game trigger, preserving the original classroom and return route');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),m=await mobile.newPage();watch(m);
 await mobile.addInitScript(()=>{const original=HTMLMediaElement.prototype.play;let activated=false;window.addEventListener('click',e=>{if(e.isTrusted)activated=true},{capture:true});HTMLMediaElement.prototype.play=function(){return activated?original.call(this):Promise.reject(new DOMException('Test policy','NotAllowedError'))}});
 await m.goto(hub+'?station=build');await expect(film(m,3)).toBeVisible();await expect(m.getByRole('button',{name:'播放阶段任务',exact:true})).toBeVisible();
 expect(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await m.screenshot({path:dir+'stage-3-mobile.png'});
 await m.getByRole('button',{name:'播放阶段任务',exact:true}).click();await playing(m);
 const handle=await m.locator('video').elementHandle();
 await mobile.route('**/api/learning/records?**',r=>r.fulfill({contentType:'application/json',body:'{"draft":null,"submissions":[]}'}));
 await mobile.route('**/api/library/projects/*/tree',r=>r.fulfill({contentType:'application/json',body:'{"modules":[{"module_id":"M01"}]}'}));
 await mobile.route('**/api/my/knodes/*/complete-status',r=>r.fulfill({contentType:'application/json',body:'{"completed_knode_ids":[]}'}));
 await m.evaluate(t=>{localStorage.setItem('systemedu_token',t);window.dispatchEvent(new Event('focus'))},`test.${Buffer.from('{"sub":"stage-review"}').toString('base64url')}.test`);
 await expect(m.getByRole('button',{name:'刷新进展'})).toBeEnabled();expect(await handle.evaluate(v=>v===document.querySelector('video'))).toBe(true);
 await m.keyboard.press('Escape');await expect(m.locator('dialog')).toHaveCount(0);await mobile.close();
 report.checks.push('390px clear autoplay fallback and real click playback; no overflow; identity hydration does not replace playing video; Escape exits');
 const offline=await browser.newContext(),o=await offline.newPage();watch(o);await offline.route('**/stage-2-v1.mp4',r=>r.abort());
 await o.goto(hub+'?station=perception');await expect(film(o,2).getByRole('alert')).toContainText('短片未加载成功');await expect(film(o,2)).toContainText('经过测试的方法');
 await o.getByRole('button',{name:'跳过短片，开始任务'}).click();await expect(o.locator('dialog')).toHaveCount(0);await offline.close();
 const denied=await browser.newContext(),a=await denied.newPage();watch(a);
 await denied.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k.includes(':stage-film:'))throw new DOMException('Denied','SecurityError');return get.call(this,k)};Storage.prototype.setItem=function(k,v){if(k.includes(':stage-film:'))throw new DOMException('Denied','SecurityError');return set.call(this,k,v)}});
 await a.goto(hub);await expect(film(a,1)).toBeVisible();await close(a);await a.getByRole('link',{name:'所有项目线',exact:true}).click();await a.locator('[data-line-card="space-exploration"]').click();await expect(a.getByRole('button',{name:'刷新进展'})).toBeEnabled();await expect(a.locator('dialog')).toHaveCount(0);await denied.close();
 const background=await browser.newContext(),b=await background.newPage();watch(b);
 await background.addInitScript(()=>{window.__hidden=true;Object.defineProperty(document,'hidden',{get:()=>window.__hidden,configurable:true})});
 await b.goto(hub+'?station=autonomy');await expect(b.getByRole('button',{name:'刷新进展'})).toBeEnabled();await expect(b.locator('dialog')).toHaveCount(0);expect(await b.evaluate(k=>localStorage.getItem(k),key(5))).toBeNull();
 await b.evaluate(()=>{window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'))});await expect(film(b,5)).toBeVisible();await playing(b);
 await b.evaluate(()=>{window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'))});await expect.poll(()=>b.locator('video').evaluate(v=>v.paused)).toBe(true);await background.close();
 report.checks.push('Video failure still offers mission text and skip; denied storage uses session memory; background entry does not consume arrival, visible arrival opens video, hidden playback pauses');
 expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'verification.json',JSON.stringify(report,null,2));await browser.close()}
