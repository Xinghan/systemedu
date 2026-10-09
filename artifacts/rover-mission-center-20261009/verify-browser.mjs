import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url).pathname;
const url='http://localhost:4000/explore/space-exploration/assemble-a-rover';
const course=JSON.parse(await fs.readFile('packages/student-web/public/project-lines/space-exploration/assemble-a-rover/course/tree/knowledge_tree.json','utf8'));
const digital=JSON.parse(await fs.readFile(dir+'digital-fixture.json','utf8'));
const scope=id=>({library_slug:'assemble-a-rover',module_id:id,activity_id:'reflection',kind:'classroom',content_version:'2.0'});
const workScope={...scope('WORK'),activity_id:'system-build'};
const cacheKey=(owner,s)=>`systemedu:learning:v1:${encodeURIComponent(owner)}:${encodeURIComponent(JSON.stringify(s))}`;
const body=id=>({answers:course.modules.find(n=>n.module_id===id).questions.map((q,i)=>({question_id:'q'+(i+1),question:q,answer:'已有测试记录'}))});
const cache=b=>({version:1,body:b,revision:0,dirty:false});
const browser=await chromium.launch({headless:true});const report={passed:false,checks:[],errors:[]};
const shot=async(p,n)=>{await expect(p.locator('main')).toBeVisible();await p.screenshot({path:dir+n+'.png',fullPage:true})};
try{
 const c=await browser.newContext({viewport:{width:1440,height:1050}}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));let media=0;p.on('request',r=>{if(r.url().endsWith('rover-briefing-v1.mp4'))media++});
 await p.goto(url);await expect(p.locator('[data-mission-record-progress]')).toHaveText('0 / 8 节记录已提交');await expect(p.locator('[data-mission-node]')).toHaveCount(8);expect(media).toBe(0);
 await shot(p,'center-desktop');
 await p.getByRole('button',{name:'前导任务短片 · 29 秒'}).click();await expect(p.getByRole('dialog')).toBeVisible();const v=p.locator('dialog video');await expect.poll(()=>v.evaluate(v=>v.readyState),{timeout:15000}).toBeGreaterThan(1);await v.evaluate(async v=>{window.savedVideo=v;await v.play()});await expect.poll(()=>v.evaluate(v=>v.currentTime)).toBeGreaterThan(.1);
 await p.keyboard.press('Escape');await expect(p.getByRole('dialog')).toHaveCount(0);expect(await p.evaluate(()=>window.savedVideo.paused)).toBe(true);
 await p.locator('[data-mission-node="M01"]').click();await expect(p.locator('[data-module]')).toHaveAttribute('data-module','M01');await expect(p.locator('#lesson-reading')).toBeVisible();expect(await p.locator('#lesson-references a[target="_blank"]').count()).toBeGreaterThan(0);await expect(p.locator('#lesson-videos')).toBeAttached();await expect(p.locator('[data-rover-workshop]')).toBeAttached();
 await p.getByRole('link',{name:'返回任务中心'}).click();await expect(p.locator('[data-mission-record-progress]')).toHaveText('0 / 8 节记录已提交');
 report.checks.push('All eight original nodes; videos fetched only on demand; modal Escape stops playback; opening a lesson does not complete it; original reading, reference, video and workbench remain');
 await p.locator('[data-mission-node="M01"]').click();const book=p.locator('#lesson-notebook');
 for(let i=1;i<=2;i++){
  const fields=book.locator(`[data-response-step="${i}"] input`);await fields.nth(0).fill('测试：测量桌面路线长 60 cm');await fields.nth(1).fill('测试：比较修改前后的实际结果');if(i===1)await book.getByRole('button',{name:'继续下一步'}).click();
 }
 await book.getByRole('button',{name:'提交本节学习记录',exact:true}).click();await expect(book.getByRole('button',{name:'再次提交本节记录'})).toBeVisible();
 await p.getByRole('link',{name:'返回任务中心'}).click();await expect(p.locator('[data-mission-record-progress]')).toHaveText('1 / 8 节记录已提交');await p.reload();await expect(p.locator('[data-mission-node="M01"]')).toContainText('记录已提交');
 await p.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:cacheKey('guest',workScope),value:cache(digital)});await p.reload();await expect(p.locator('[data-digital-progress]')).toHaveText('5 / 5');await expect(p.locator('[data-mission-delivery]')).toHaveText('尚未交付');await expect(p.locator('[data-physical-progress]')).toHaveText('0 / 6');await shot(p,'progress-restored');
 await p.locator('[data-mission-node="M01"]').click();await p.locator('[data-response-step="1"] input').nth(0).fill('测试：重新测量 65 cm');await p.getByRole('link',{name:'返回任务中心'}).click();await expect(p.locator('[data-mission-node="M01"]')).toContainText('有草稿');await expect(p.locator('[data-mission-record-progress]')).toHaveText('0 / 8 节记录已提交');
 report.checks.push('Actual notebook submission and refresh restore map progress; editing clears current submitted state; validated digital fixture passes 5 checks without claiming physical completion');
 const materials=await c.request.get('http://localhost:4000/project-lines/space-exploration/assemble-a-rover/hardware/reference-stl.zip');expect(materials.status()).toBe(200);
 await p.goto(url+'?node=M06');await expect(p.locator('[data-rover-workshop]')).toHaveAttribute('data-stage','6');await expect(p.locator('[aria-label="本节任务简报"]')).toHaveAttribute('data-scene','S3');await expect(p.getByRole('region',{name:'本节任务简报'})).toBeVisible();await p.screenshot({path:dir+'manufacturing-brief.png',fullPage:false});
 await p.goto(url+'?edition=1');await expect(p.locator('[data-mission-center]')).toHaveCount(0);await expect(p.locator('[data-module]')).toHaveAttribute('data-module','M01');await p.goto('http://localhost:4000/explore/space-exploration/write-driving-rules');await expect(p.locator('[data-mission-center]')).toHaveCount(0);await expect(p.locator('#lesson-notebook')).toBeAttached();await c.close();
 report.checks.push('Manufacturing workspace and actual STL download retained; legacy edition and other guided course unchanged');
 for(const width of [390,320]){
  const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});const q=await ctx.newPage();q.on('pageerror',e=>report.errors.push(e.message));await q.goto(url);await expect(q.locator('[data-mission-node]')).toHaveCount(8);expect(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await shot(q,'center-'+width);
  await q.locator('[data-mission-node="M04"]').click();await expect(q.locator('[data-module]')).toHaveAttribute('data-module','M04');await q.getByText('展开任务地图，查看我的进展').click();await expect(q.locator('[data-mission-node="M04"]')).toHaveAttribute('aria-current','step');expect(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await q.screenshot({path:dir+'node-'+width+'.png',fullPage:false});await ctx.close();
 }
 report.checks.push('320px and 390px mission center and in-lesson map: usable links, current node and no horizontal overflow');
 const ctx=await browser.newContext(),q=await ctx.newPage();q.on('pageerror',e=>report.errors.push(e.message));
 const jwt=name=>`test.${Buffer.from(JSON.stringify({sub:name})).toString('base64url')}.test`,a=jwt('mission-test-a'),b=jwt('mission-test-b');let failed=true;
 await ctx.addInitScript(({a,k,record})=>{localStorage.setItem('systemedu_token',a);localStorage.setItem(k,JSON.stringify(record))},{a,k:cacheKey('user:mission-test-a',scope('M02')),record:{...cache(body('M02')),dirty:true}});
 await ctx.route('**/api/learning/records?**',async route=>{
  const req=route.request(),id=new URL(req.url()).searchParams.get('module_id'),isA=req.headers().authorization===`Bearer ${a}`;
  if(isA&&failed&&['M04','WORK'].includes(id))return route.fulfill({status:503,contentType:'application/json',body:'{"message":"test offline"}'});
  const filled=isA&&['M01','M02'].includes(id),data=filled?{draft:{...scope(id),body:body(id),status:'submitted',revision:1},submissions:[{body:body(id),created_at:'2026-10-09T00:00:00Z'}]}:{draft:null,submissions:[]};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await q.goto(url);await expect(q.locator('[data-mission-record-progress]')).toHaveText('1 / 8 节记录已提交');await expect(q.locator('[data-mission-node="M02"]')).toContainText('有草稿');await expect(q.locator('[data-mission-node="M04"]')).toContainText('进度待读取');await expect(q.locator('[data-digital-progress]')).toHaveText('待读取');
 failed=false;await q.getByRole('button',{name:'重新读取节点进度'}).click();await q.getByRole('button',{name:'重新读取作品进度'}).click();await expect(q.locator('[data-mission-node="M04"]')).toContainText('待开始');await expect(q.locator('[data-digital-progress]')).toHaveText('0 / 5');
 await q.evaluate(b=>{localStorage.setItem('systemedu_token',b);window.dispatchEvent(new Event('focus'))},b);await expect(q.locator('[data-mission-record-progress]')).toHaveText('0 / 8 节记录已提交');await expect(q.locator('[data-mission-node="M02"]')).toContainText('待开始');await ctx.close();
 report.checks.push('Mocked account records: own dirty draft overrides prior submission; failed reads show unknown and retry; switching account clears previous user progress');
 const off=await browser.newContext();await off.route('**/rover-briefing-v1.mp4',r=>r.abort());const e=await off.newPage();await e.goto(url);await e.getByRole('button',{name:'前导任务短片 · 29 秒'}).click();await expect(e.getByText('短片未加载成功，可以直接开始课程。')).toBeVisible();await e.getByRole('button',{name:'关闭任务短片'}).click();await e.locator('[data-mission-node="M01"]').click();await expect(e.locator('[data-module]')).toHaveAttribute('data-module','M01');await off.close();
 report.checks.push('Failed video has a visible fallback and never blocks the course');expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'verification.json',JSON.stringify(report,null,2));await browser.close()}
