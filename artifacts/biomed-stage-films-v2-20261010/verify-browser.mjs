import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url).pathname,origin='http://127.0.0.1:4000',home=origin+'/mission/biomedicine';
const scripts=JSON.parse(await fs.readFile(dir+'scripts.json'));
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const report={passed:false,checks:[],errors:[]},watch=p=>p.on('pageerror',e=>report.errors.push(e.message));
const dialog=p=>p.locator('[data-biomed-briefing]');
const playing=async p=>expect.poll(()=>dialog(p).locator('video').evaluate(v=>!v.paused&&v.currentTime>0),{timeout:20000}).toBe(true);
const close=async p=>{await p.getByRole('button',{name:'关闭任务短片',exact:true}).click();await expect(dialog(p)).toHaveCount(0)};
const key=(station,owner='guest')=>`systemedu:biomed-stage-film:v2:${owner}:${station}`;
try {
 const c=await browser.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();watch(p);
 await c.addInitScript(()=>{localStorage.setItem('systemedu:biomed-briefing:1:guest:observation','seen');localStorage.setItem('systemedu:biomed-stage-film:v1:guest:observation','seen')});
 const media=new Set();let writes=0;p.on('request',r=>{if(r.url().endsWith('.mp4'))media.add(new URL(r.url()).pathname);if(r.url().includes('/api/learning/')&&!['GET','OPTIONS'].includes(r.method()))writes++});
 await p.goto(home);await expect(dialog(p)).toHaveAttribute('data-biomed-briefing','observation');await playing(p);expect(media.size).toBe(1);
 await expect(dialog(p)).toContainText('陈澄');await expect(dialog(p)).not.toContainText('林岚');await p.screenshot({path:dir+'opening-desktop.png'});await close(p);
 await expect(p.locator('[data-biomed-briefing-replay]')).toBeFocused();await p.reload();await expect(p.locator('[data-biomed-briefing-replay]')).toBeVisible();await expect(dialog(p)).toHaveCount(0);
 for(const item of scripts.slice(1)){
  await p.getByRole('button',{name:`0${item.level} ${item.title}`,exact:true}).click();await expect(dialog(p)).toHaveAttribute('data-biomed-briefing',item.station);await playing(p);
  const video=dialog(p).locator('video');await expect(video).toHaveAttribute('poster',`/mission/biomedicine/video/posters/${item.frame}-v2.webp`);await expect(video).toHaveAttribute('src',`/mission/biomedicine/video/${item.station}-v2.mp4`);
  expect(await video.evaluate(v=>v.duration)).toBeGreaterThan(18);
  await expect.poll(()=>video.evaluate(v=>v.textTracks[0]?.cues?.length||0)).toBeGreaterThan(4);
  if(item.level===5)await p.screenshot({path:dir+'protocol-desktop.png'});
  await video.evaluate(v=>v.currentTime=v.duration-.2);await expect(dialog(p)).toHaveCount(0,{timeout:10000});
  expect(await p.evaluate(k=>localStorage.getItem(k),key(item.station))).toBe('seen');
 }
 expect(media.size).toBe(8);expect(writes).toBe(0);
 await p.locator('[data-biomed-briefing-replay]').click();await playing(p);await p.keyboard.press('Escape');await expect(dialog(p)).toHaveCount(0);
 await p.goto(home+'/control?task=teachopencadd-candidate-research%3AM37');await expect(p.locator('[data-room-arrival]')).toHaveAttribute('data-phase','playing');await p.keyboard.press('Escape');await expect(p.getByLabel('我的子任务状态',{exact:true})).toBeEnabled();await expect(dialog(p)).toHaveCount(0);await c.close();
 report.checks.push('Old image-only and v1 video seen keys do not consume new laboratory film; all eight distinct actual MP4s and captions play, end and deduplicate; replay/Escape/focus work; only current film requested; watching never writes learning completion');
 const direct=await browser.newContext(),d=await direct.newPage();watch(d);
 await d.goto(home+'/control?task=teachopencadd-candidate-research%3AM24');await expect(d.locator('[data-room-arrival]')).toHaveAttribute('data-phase','playing');await expect(dialog(d)).toHaveCount(0);await expect(dialog(d)).toHaveAttribute('data-biomed-briefing','evaluation',{timeout:12000});await expect(d.locator('[data-room-arrival]')).toBeHidden();await playing(d);await close(d);
 await d.getByRole('navigation',{name:'任务中心模块'}).getByRole('button',{name:'时间表',exact:true}).click();await d.keyboard.press('Escape');await expect(dialog(d)).toHaveCount(0);
 await d.goto(origin+'/explore/biomedicine/build-a-candidate-filter?node=M01&mission=biomedicine');await expect(dialog(d)).toHaveAttribute('data-biomed-briefing','filter');await close(d);
 for(const id of ['lesson-reading','lesson-videos','lesson-references','lesson-notebook'])await expect(d.locator('#'+id)).toBeAttached();
 await d.goto(origin+'/explore/biomedicine/build-a-candidate-filter?node=M02&mission=biomedicine');await expect(d.locator('[data-biomed-context]')).toBeAttached();await expect(dialog(d)).toHaveCount(0);
 await d.goto(origin+'/explore/biomedicine/turn-a-molecule?mission=biomedicine');await expect(dialog(d)).toHaveAttribute('data-biomed-briefing','observation');await close(d);await direct.close();
 report.checks.push('Direct center entry waits for full room arrival, then plays its own stage; changing center module or classroom node within station does not repeat film; guided and micro entries trigger and original classroom remains intact');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),m=await mobile.newPage();watch(m);
 await mobile.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;let clicked=false;window.addEventListener('click',e=>{if(e.isTrusted)clicked=true},{capture:true});HTMLMediaElement.prototype.play=function(){return clicked?play.call(this):Promise.reject(new DOMException('Test policy','NotAllowedError'))}});
 await m.goto(home+'?station=data');await expect(m.getByRole('button',{name:'播放阶段任务',exact:true})).toBeVisible();expect(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await m.screenshot({path:dir+'data-mobile.png'});await m.getByRole('button',{name:'播放阶段任务',exact:true}).click();await playing(m);await close(m);await mobile.close();
 const reduced=await browser.newContext({viewport:{width:320,height:720},reducedMotion:'reduce'}),r=await reduced.newPage();watch(r);await r.goto(home+'?station=systems');await expect(r.getByRole('button',{name:'播放阶段任务',exact:true})).toBeVisible();expect(await dialog(r).locator('video').evaluate(v=>v.paused)).toBe(true);await r.getByText('阅读完整任务简报',{exact:true}).click();await expect(dialog(r)).toContainText('第一次结果要留下');expect(await r.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await r.screenshot({path:dir+'reduced-320.png'});await close(r);await reduced.close();
 report.checks.push('390px blocked autoplay offers real click-to-play; 320px reduced motion starts paused with full readable script; both fit viewport');
 const offline=await browser.newContext(),o=await offline.newPage();watch(o);await offline.route('**/prediction-v2.mp4',r=>r.abort());await o.goto(home+'?station=prediction');await expect(dialog(o).getByRole('alert')).toContainText('短片未加载成功');await expect(dialog(o).locator('details')).toHaveAttribute('open','');await expect(dialog(o)).toContainText('预测始终不等于测量');await o.getByRole('button',{name:'跳过短片，开始任务'}).click();await offline.close();
 const denied=await browser.newContext(),a=await denied.newPage();watch(a);await denied.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k.includes('biomed-stage-film'))throw new DOMException('Denied','SecurityError');return get.call(this,k)};Storage.prototype.setItem=function(k,v){if(k.includes('biomed-stage-film'))throw new DOMException('Denied','SecurityError');return set.call(this,k,v)}});await a.goto(home);await expect(dialog(a)).toBeVisible();await close(a);await a.getByRole('button',{name:'02 规则筛选室',exact:true}).click();await close(a);await a.getByRole('button',{name:'01 分子观察窗',exact:true}).click();await expect(dialog(a)).toHaveCount(0);await denied.close();
 const background=await browser.newContext(),b=await background.newPage();watch(b);await background.addInitScript(()=>{window.__hidden=true;Object.defineProperty(document,'hidden',{get:()=>window.__hidden,configurable:true})});await b.goto(home+'?station=protocol');await expect(b.locator('[data-biomed-briefing-replay]')).toBeVisible();await expect(dialog(b)).toHaveCount(0);await b.evaluate(()=>{window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'))});await playing(b);await b.evaluate(()=>{window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'))});await expect.poll(()=>dialog(b).locator('video').evaluate(v=>v.paused)).toBe(true);await background.close();
 report.checks.push('Failure expands full written briefing and retains skip; denied storage deduplicates within app session; background arrival waits, visible arrival plays, hidden playback pauses');
 expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
