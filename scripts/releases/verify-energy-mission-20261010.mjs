import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium,expect:baseExpect}=createRequire(new URL('../../package.json',import.meta.url))('@playwright/test');
const expect=baseExpect.configure({timeout:30000});
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const [origin,phase,build]=process.argv.slice(2);
if(!origin||!['candidate','production'].includes(phase)||!build)throw Error('origin phase build required');
const out=path.resolve('artifacts/energy-mission-release-20261010',phase);await fs.mkdir(out,{recursive:true});
const films=JSON.parse(await fs.readFile('packages/student-web/src/lib/project-lines/energy-stage-films.json'));
const bioFilms=JSON.parse(await fs.readFile('packages/student-web/src/lib/project-lines/biomed-stage-films.json'));
const report={passed:false,origin,phase,build,stageFilms:0,checks:[],errors:[]};
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
let lastPage,step='start';
async function context(options={}){
 const c=await browser.newContext(options);c.setDefaultNavigationTimeout(120000);c.setDefaultTimeout(30000);
 await c.route('**/api/**',async r=>{const q=r.request(),u=new URL(q.url());if(q.method()!=='GET'||q.headers().authorization){report.errors.push('Non-public request blocked: '+u.pathname);return r.abort()}
  if(phase==='candidate')return r.fulfill({response:await c.request.get('https://systeme.xin'+u.pathname+u.search)});return r.continue()});
 c.on('page',p=>{lastPage=p;p.on('pageerror',e=>report.errors.push(e.message))});return c;
}
const dialog=p=>p.locator('[data-biomed-briefing]');
const close=async p=>{await p.getByRole('button',{name:'关闭任务短片',exact:true}).click();await expect(dialog(p)).toHaveCount(0)};
const playing=async p=>expect.poll(()=>dialog(p).locator('video').evaluate(v=>!v.paused&&v.currentTime>0),{timeout:120000}).toBe(true);
async function media(c,url,caption){const r=await c.request.get(origin+url,{headers:{Range:'bytes=0-1023'},timeout:120000});expect(r.status()).toBe(206);expect((await r.body()).length).toBe(1024);expect(r.headers()['content-type']).toContain('video/mp4');const v=await c.request.get(origin+caption);expect(v.status()).toBe(200);expect(await v.text()).toContain('WEBVTT')}
try{
 const c=await context({viewport:{width:1440,height:1000}}),p=await c.newPage();
 await p.goto(origin+'/library?view=lines',{waitUntil:'domcontentloaded'});
 for(const [id,href] of [['space-exploration','/mission/space'],['biomedicine','/mission/biomedicine'],['energy-motion','/mission/energy']])await expect(p.locator(`[data-line-card="${id}"]`)).toHaveAttribute('href',href);
 await p.locator('[data-line-card="energy-motion"]').click();await expect(dialog(p)).toHaveAttribute('data-biomed-briefing','discovery');await playing(p);await close(p);
 await p.reload({waitUntil:'domcontentloaded'});await expect(p.locator('[data-energy-journey]')).toBeVisible();await expect(dialog(p)).toHaveCount(0);
 for(const f of films){step='energy-'+f.station;console.log(step);
  if(f.level===1)await p.locator('[data-energy-briefing-replay]').click();else await p.getByRole('button',{name:`0${f.level} ${f.title}`,exact:true}).click();
  await expect(dialog(p)).toHaveAttribute('data-biomed-briefing',f.station);await playing(p);
  const v=dialog(p).locator('video');expect(await v.evaluate(v=>v.videoWidth)).toBe(1920);expect(await v.evaluate(v=>v.videoHeight)).toBe(1080);await expect(v).toHaveAttribute('poster',`/mission/energy/stations/${f.frame}-v1-1536.webp`);
  await expect.poll(()=>v.evaluate(v=>v.textTracks[0]?.cues?.length||0)).toBeGreaterThan(4);
  if(f.level===1)await p.screenshot({path:out+'/energy-opening.png'});
  await v.evaluate(v=>v.pause());await media(c,`/mission/energy/video/${f.station}-v1.mp4`,`/mission/energy/video/${f.station}-zh-v1.vtt`);
  const image=await c.request.get(origin+`/mission/energy/stations/${f.frame}-v1-960.webp`);expect(image.status()).toBe(200);expect(image.headers()['content-type']).toContain('image/webp');
  await close(p);report.stageFilms++;
 }
 report.checks.push('Eight energy stage films decode 1080p, play, load captions and accept Range; distinct indoor posters; first arrival, repeat suppression and replay');
 await expect(p.locator('[data-mission-node]')).toHaveCount(8);await p.locator('#journey-map').scrollIntoViewIfNeeded();await p.screenshot({path:out+'/energy-map.png'});
 await p.goto(origin+'/mission/energy/control?task=build-a-solar-tracker%3AM01',{waitUntil:'domcontentloaded'});
 await expect(p.locator('[data-task-order]')).toBeVisible();await expect(p.getByLabel('我的子任务状态',{exact:true})).toBeEnabled();await expect(dialog(p)).toHaveCount(0);await p.screenshot({path:out+'/energy-center.png'});
 for(const name of ['任务地图','时间表','工作日志','工程档案']){await p.getByRole('navigation',{name:'任务中心模块'}).getByRole('button',{name,exact:true}).click();if(name==='工程档案')await expect(p.locator('[data-energy-dossier] textarea')).toHaveCount(5)}
 await p.goto(origin+'/explore/energy-motion/build-a-solar-tracker?node=M05&mission=energy',{waitUntil:'domcontentloaded'});
 for(const id of ['lesson-reading','lesson-videos','lesson-references','lesson-notebook'])await expect(p.locator('#'+id)).toBeAttached();await expect(p.locator('[data-energy-footer] a').last()).toHaveAttribute('href',/design-a-wind-rotor\?node=M01&mission=energy/);
 await p.goto(origin+'/learn/pvlib-solar-forecast-station/M41?mission=energy',{waitUntil:'domcontentloaded'});await expect.poll(()=>new URL(p.url()).pathname).toBe('/login');expect(new URL(p.url()).searchParams.get('next')).toBe('/learn/pvlib-solar-forecast-station/M41?mission=energy');
 report.checks.push('Library routes, eight-room map, five center modules, guided classroom resources and course handoff; pvlib login retains requested mission node');
 step='biomed-regression';console.log(step);
 await p.goto(origin+'/mission/biomedicine',{waitUntil:'domcontentloaded'});await expect(dialog(p)).toHaveAttribute('data-biomed-briefing','observation');await playing(p);await close(p);
 await expect(p.locator('img[src="/mission/biomedicine/stations/observation-v2-1536.webp"]')).toBeVisible();
 for(const f of bioFilms){await media(c,`/mission/biomedicine/video/${f.station}-v2.mp4`,`/mission/biomedicine/video/${f.station}-zh-v2.vtt`)}
 await p.goto(origin+'/mission/space',{waitUntil:'domcontentloaded'});await expect(p.locator('[data-stage-film]')).toBeVisible();await p.getByRole('button',{name:'关闭任务短片',exact:true}).click();await expect(p.locator('[data-mission-node]')).toHaveCount(8);
 report.checks.push('Biomed laboratory arrival and eight v2 video/caption endpoints; existing space mission still opens with eight stations');await c.close();
 for(const width of [390,320]){step='mobile-'+width;console.log(step);const m=await context({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),q=await m.newPage();await q.goto(origin+'/mission/energy?station=storage',{waitUntil:'domcontentloaded'});await expect(dialog(q)).toHaveAttribute('data-biomed-briefing','storage');expect(await dialog(q).locator('video').evaluate(v=>v.paused)).toBe(true);await close(q);expect(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await q.screenshot({path:out+`/energy-${width}.png`});await q.goto(origin+'/mission/energy/control?task=store-energy-for-later%3AM01',{waitUntil:'domcontentloaded'});await expect(q.getByLabel('我的子任务状态',{exact:true})).toBeEnabled();expect(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await m.close()}
 report.checks.push('320px and 390px mission and center fit viewport; reduced-motion briefings start paused');
 expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);report.step=step;if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}finally{await fs.writeFile(out+'/verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
