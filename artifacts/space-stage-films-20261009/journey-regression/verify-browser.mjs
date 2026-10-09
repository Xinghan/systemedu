import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const dir = new URL('./',import.meta.url).pathname;
const origin='http://localhost:4000',hub=origin+'/mission/space';
const stations={
 'first-contact':['spot-a-world','land-a-probe','drive-and-frame'],
 'mission-design':['pick-an-observation-site','plan-a-payload'],
 mechanics:['tune-a-chassis'],perception:['label-the-terrain','write-driving-rules'],
 build:['assemble-a-rover'],expedition:['run-an-expedition'],autonomy:['mars-analog-rover'],'planet-science':['lightkurve-transit-detective']
};
const ids=Object.values(stations).flat();
const taxonomy=JSON.parse(await fs.readFile('packages/student-web/src/lib/project-lines/project-taxonomy.json','utf8'));
expect(ids.slice().sort()).toEqual(Object.entries(taxonomy).filter(([,p])=>p.primary==='aerospace'||p.related.includes('aerospace')).map(([id])=>id).sort());
const key=(owner,scope)=>`systemedu:learning:v1:${encodeURIComponent(owner)}:${encodeURIComponent(JSON.stringify(scope))}`;
const scope=(id,module='M03',version='1.0')=>({library_slug:id,module_id:module,activity_id:'final-deliverable',kind:'assignment',content_version:version});
const jwt=id=>`test.${Buffer.from(JSON.stringify({sub:id})).toString('base64url')}.test`;
const saved={version:1,body:{answers:[]},revision:1,dirty:false,submittedAt:'2026-10-09T00:00:00Z'};
const photo={schema_version:'spot-a-world/1',origin:'simulated',created_at:'2026-10-09T00:00:00Z',artifact_id:'sky-observation',image:'data:image/jpeg;base64,AA==',evidence:{manual_pan:true,manual_zoom:true}};
const browser=await chromium.launch({headless:true});
// This regression verifies the returning learner; first-entry video is covered separately.
async function returningContext(options){
 const context=await browser.newContext(options);
 await context.addInitScript(()=>{for(let i=1;i<=5;i++)localStorage.setItem(`systemedu:mission:space:stage-film:${i}:v1`,'1')});
 return context;
}
const report={passed:false,checks:[],errors:[]};
const observe=p=>p.on('pageerror',e=>report.errors.push(e.message));
async function ready(p){await expect(p.locator('[data-space-journey]')).toBeVisible();await expect(p.getByRole('button',{name:'刷新进展'})).toBeEnabled({timeout:22000});}
async function mapReady(p){await p.locator('#journey-map').scrollIntoViewIfNeeded();await expect(p.getByText('正在展开基地地图…')).toHaveCount(0,{timeout:15000});}
async function portfolio(p){if(await p.locator('details').getAttribute('open')===null)await p.locator('summary').click();}
try{
 const c=await returningContext({viewport:{width:1440,height:1100}}),p=await c.newPage();observe(p);
 let writes=0,videoRequests=0;
 p.on('request',r=>{if(r.url().includes('/api/')&&!['GET','OPTIONS'].includes(r.method()))writes++;if(r.url().endsWith('.mp4'))videoRequests++});
 await p.goto(origin+'/library?view=lines');
 await p.locator('[data-line-card="space-exploration"]').click();await ready(p);
 await expect(p.locator('[data-journey-level]')).toHaveCount(5);await expect(p.locator('[data-mission-node]')).toHaveCount(8);
 await p.screenshot({path:dir+'hub-desktop.png'});
 expect(videoRequests).toBe(0);
 await p.getByRole('button',{name:'火星探索序章 · 29 秒'}).click();await expect(p.locator('dialog')).toBeVisible();await expect(p.locator('video')).toHaveAttribute('src','/mission/rover/video/rover-briefing-v1.mp4');
 await p.keyboard.press('Escape');await expect(p.locator('video')).toHaveCount(0);
 await mapReady(p);
 for(const [station,projects] of Object.entries(stations)){
  await p.locator(`[data-mission-node="${station}"]`).click();
  await expect(p.locator('[data-journey-station]')).toHaveAttribute('data-journey-station',station);
  expect(await p.locator('[data-journey-project]').evaluateAll(els=>els.map(el=>el.dataset.journeyProject))).toEqual(projects);
  for(const id of projects) await expect(p.locator(`[data-journey-project="${id}"] a`)).toHaveAttribute('href',id==='mars-analog-rover'||id==='lightkurve-transit-detective'?'/library/'+id:'/explore/space-exploration/'+id);
 }
 await p.locator('#journey-map').screenshot({path:dir+'map-desktop.png'});
 await portfolio(p);await expect(p.locator('[data-journey-record]')).toHaveCount(12);
 expect(await p.locator('[data-journey-record]').evaluateAll(els=>els.map(e=>e.dataset.journeyRecord).sort())).toEqual(ids.slice().sort());
 expect(writes).toBe(0);
 await p.locator('[data-journey-record="spot-a-world"]').click();await expect(p.locator('iframe')).toHaveAttribute('src','/project-lines/space-exploration/spot-a-world/index.html');
 await expect(p.frameLocator('iframe').getByRole('button',{name:'镜头向左'})).toBeAttached();
 await p.locator('[data-journey-return] a').click();await ready(p);await expect(p.locator('[data-journey-station]')).toHaveAttribute('data-journey-station','first-contact');
 report.checks.push('5 stages, 8 stations and all 12 correct project URLs; optional video loads on request and unmounts on Escape; map browsing never writes progress; three-minute game and return loop');
 // Existing guest work is reused without changing scopes or manufacturing completion.
 await p.evaluate(({photo,saved,k})=>{localStorage.setItem('systemedu:spot-a-world:v1',JSON.stringify([photo]));localStorage.setItem(k,JSON.stringify(saved))},{photo,saved,k:key('guest',scope('pick-an-observation-site'))});
 await p.goto(hub);await ready(p);await portfolio(p);
 await expect(p.locator('[data-journey-record="spot-a-world"]')).toContainText('1 份本机作品');
 await expect(p.locator('[data-journey-record="pick-an-observation-site"]')).toContainText('本机作品已保存');
 await expect(p.getByRole('region',{name:'建议下一步'}).getByRole('link')).toHaveAttribute('href','/explore/space-exploration/plan-a-payload');
 await p.locator('[data-journey-record="write-driving-rules"]').click();await expect(p.locator('[data-guided-course]')).toHaveAttribute('data-guided-course','write-driving-rules');
 for(const selector of ['#lesson-reading','#lesson-videos','#lesson-references','#lesson-notebook'])await expect(p.locator(selector)).toBeAttached();
 await p.locator('[data-journey-return] a').click();await ready(p);await expect(p.locator('[data-journey-station]')).toHaveAttribute('data-journey-station','perception');
 report.checks.push('Guest photo and formal delivery restored; recommended next guided project advances; original multi-node lesson/media/notebook preserved and returns to perception station');
 await c.close();
 for(const width of [390,320]){
  const c=await returningContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),q=await c.newPage();observe(q);
  await q.goto(hub);await ready(q);expect(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===390)await q.screenshot({path:dir+'hub-mobile.png'});
  await mapReady(q);
  await q.locator('[data-mission-node="perception"]').click();await expect(q.locator('[data-journey-station]')).toHaveAttribute('data-journey-station','perception');
  expect(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await q.locator('#journey-map').screenshot({path:dir+`map-${width}.png`});
  await q.locator('[data-journey-project="write-driving-rules"] a').click();await expect(q.locator('[data-journey-return]')).toBeVisible();
  await q.locator('[data-journey-return] a').click();await ready(q);await expect(q.locator('[data-journey-station]')).toHaveAttribute('data-journey-station','perception');
  await c.close();
 }
 report.checks.push('390/320px layouts have no document overflow; touch-sized map controls and original lesson return work');
 // Account snapshots and failures are mocked; no test writes to real accounts.
 const a=await returningContext({viewport:{width:1440,height:1050}}),q=await a.newPage();observe(q);let fail=true,allNodes=false;const requests=[];
 await a.addInitScript(({token,photo})=>{localStorage.setItem('systemedu_token',token);localStorage.setItem('systemedu:spot-a-world:v1',JSON.stringify([photo]))},{token:jwt('journey-a'),photo});
 await a.route('**/api/learning/records?**',async r=>{
  const url=new URL(r.request().url()),id=url.searchParams.get('library_slug');requests.push(Object.fromEntries(url.searchParams));
  const accountA=r.request().headers().authorization===`Bearer ${jwt('journey-a')}`;
  if(accountA&&id==='tune-a-chassis'&&fail)return r.fulfill({status:503,body:'{}',contentType:'application/json'});
  await r.fulfill({contentType:'application/json',body:JSON.stringify({draft:null,submissions:accountA&&id==='pick-an-observation-site'?[{id:'saved',created_at:'2026-10-09T00:00:00Z'}]:[]})});
 });
 await a.route('**/api/library/projects/*/tree',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({modules:[{module_id:'M01'},{module_id:'M02'},{module_id:'M03'}]})}));
 await a.route('**/api/my/knodes/*/complete-status',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({completed_knode_ids:r.request().headers().authorization===`Bearer ${jwt('journey-a')}`?(allNodes?['M01','M02','M03','M03','unrelated-id']:['M01','M01','unrelated-id']):[]})}));
 await q.goto(hub);await ready(q);await portfolio(q);
 await expect(q.locator('[data-journey-record="spot-a-world"]')).toContainText('本机体验');
 await expect(q.locator('[data-journey-record="spot-a-world"]')).not.toContainText('1 份本机作品');
 await expect(q.locator('[data-journey-record="pick-an-observation-site"]')).toContainText('作品已提交 · 待评阅');
 await expect(q.locator('[data-journey-record="mars-analog-rover"]')).toContainText('1 / 3 节点');
 await expect(q.locator('[data-mission-node="mechanics"]')).toHaveAttribute('data-status','unknown');
 expect(requests.every(s=>s.kind==='assignment'&&s.activity_id==='final-deliverable')).toBe(true);
 expect(requests.find(s=>s.library_slug==='assemble-a-rover')).toMatchObject({module_id:'M08',content_version:'2.0'});
 expect(requests.find(s=>s.library_slug==='run-an-expedition')).toMatchObject({module_id:'M05',content_version:'2.0'});
 fail=false;await q.getByRole('button',{name:'刷新进展'}).click();await ready(q);await expect(q.locator('[data-mission-node="mechanics"]')).toHaveAttribute('data-status','new');
 await q.screenshot({path:dir+'account-records.png',fullPage:true});
 allNodes=true;await q.getByRole('button',{name:'刷新进展'}).click();await ready(q);
 await expect(q.locator('[data-journey-record="mars-analog-rover"]')).toContainText('3 / 3 节点');
 await expect(q.locator('[data-journey-record="mars-analog-rover"]')).toContainText('仍需复核完整工程');
 await expect(q.locator('[data-mission-node="autonomy"]')).not.toHaveAttribute('data-status','submitted');
 await q.evaluate(t=>{localStorage.setItem('systemedu_token',t);window.dispatchEvent(new Event('focus'))},jwt('journey-b'));await ready(q);await portfolio(q);
 await expect(q.locator('[data-journey-record="pick-an-observation-site"]')).not.toContainText('作品已提交');
 await expect(q.locator('[data-journey-record="mars-analog-rover"]')).toContainText('0 / 3 节点');
 report.checks.push('Account-scoped delivery/version restored; device album never attributed to account; valid distinct full-course IDs counted only; failed reads stay unknown and retry recovers; account switch clears previous work');
 await a.close();
 const f=await returningContext(),e=await f.newPage();observe(e);await f.route('**/campus-map-v1.webp',r=>r.abort());await e.goto(hub);await ready(e);await mapReady(e);
 await expect(e.getByText('基地图片暂时无法加载。',{exact:false})).toBeVisible();await expect(e.locator('[data-journey-record="lightkurve-transit-detective"]')).toBeVisible();
 await f.close();report.checks.push('Map image failure automatically exposes all 12 project links; all completed nodes remain pending portfolio review; taxonomy coverage matches all 12 aerospace-linked projects');
 expect(report.errors).toEqual([]);report.passed=true;
}catch(error){report.failure=String(error);throw error}finally{await fs.writeFile(dir+'verification.json',JSON.stringify(report,null,2));await browser.close()}
