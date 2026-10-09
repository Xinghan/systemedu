import {chromium, expect} from '@playwright/test';
import fs from 'node:fs/promises';
const dir = new URL('./', import.meta.url).pathname;
const url = 'http://localhost:4000/explore/space-exploration/assemble-a-rover';
const course = JSON.parse(await fs.readFile('packages/student-web/public/project-lines/space-exploration/assemble-a-rover/course/tree/knowledge_tree.json', 'utf8'));
const digital = JSON.parse(await fs.readFile('artifacts/rover-mission-center-20261009/digital-fixture.json', 'utf8'));
const scope = id => ({library_slug:'assemble-a-rover',module_id:id,activity_id:'reflection',kind:'classroom',content_version:'2.0'});
const key = (owner,s) => `systemedu:learning:v1:${encodeURIComponent(owner)}:${encodeURIComponent(JSON.stringify(s))}`;
const body = id => ({answers:course.modules.find(n=>n.module_id===id).questions.map((q,i)=>({question_id:'q'+(i+1),question:q,answer:'地图恢复检查：已有测试记录'}))});
const cache = b => ({version:1,body:b,revision:0,dirty:false});
const browser = await chromium.launch({headless:true});
const report = {passed:false,checks:[],errors:[]};
const observe = p => p.on('pageerror',e=>report.errors.push(e.message));
const ready = async p => {
  await expect(p.locator('main')).toBeVisible();
  await expect(p.locator('[data-campus-map]')).toBeVisible();
  await p.locator('[data-campus-map]').scrollIntoViewIfNeeded();
  await expect(p.getByText('正在展开基地地图…')).toHaveCount(0,{timeout:15000});
};
const select = async (p,id) => {await p.locator(`[data-mission-node="${id}"]`).click();await expect(p.locator('[data-campus-task]')).toHaveAttribute('data-campus-task',id)};
try {
  const ctx=await browser.newContext({viewport:{width:1440,height:1200}}),p=await ctx.newPage();observe(p);
  let writes=0; p.on('request',r=>{if(r.url().includes('/api/learning/') && !['GET','OPTIONS'].includes(r.method()))writes++});
  await p.goto(url+'#mission-map');await ready(p);
  await expect(p.locator('[data-mission-node]')).toHaveCount(8);
  await expect(p.locator('[data-mission-record-progress]')).toHaveText('0 / 8 节记录已提交');
  await p.locator('[data-campus-map]').screenshot({path:dir+'map-desktop.png'});
  for (const n of course.modules) {
    await select(p,n.module_id);
    await expect(p.locator('[data-campus-task]')).toContainText(n.output);
    await expect(p.locator('[data-campus-enter]')).toHaveAttribute('href',`/explore/space-exploration/assemble-a-rover?node=${n.module_id}`);
  }
  await expect(p.locator('[data-mission-record-progress]')).toHaveText('0 / 8 节记录已提交');
  expect(writes).toBe(0);
  await p.getByRole('button',{name:'定位当前任务'}).click();await expect(p.locator('[data-campus-task]')).toHaveAttribute('data-campus-task','M01');
  await p.locator('[data-mission-node="M01"]').focus();await p.keyboard.press('ArrowRight');await expect(p.locator('[data-mission-node="M02"]')).toBeFocused();await expect(p.locator('[data-campus-task]')).toHaveAttribute('data-campus-task','M02');
  await p.keyboard.press('End');await expect(p.locator('[data-mission-node="M08"]')).toBeFocused();await p.keyboard.press('Home');await expect(p.locator('[data-mission-node="M01"]')).toBeFocused();
  await p.getByRole('button',{name:'放大地图',exact:true}).click();await expect(p.getByRole('status',{name:'地图缩放比例'})).toHaveText('125%');
  const vp=p.locator('[data-campus-viewport]');await vp.scrollIntoViewIfNeeded();const vb=await vp.boundingBox();
  const before=await vp.evaluate(el=>el.scrollLeft);
  await p.mouse.move(vb.x+vb.width*.7,vb.y+vb.height*.45);await p.mouse.down();await p.mouse.move(vb.x+vb.width*.7-140,vb.y+vb.height*.45,{steps:12});await p.mouse.up();
  expect(await vp.evaluate(el=>el.scrollLeft)).toBeGreaterThan(before+80);
  await expect(p.locator('[data-campus-task]')).toHaveAttribute('data-campus-task','M01');
  await p.getByRole('button',{name:'缩小地图',exact:true}).click();await expect(p.getByRole('status',{name:'地图缩放比例'})).toHaveText('100%');
  await p.getByText('简洁目录 · 查看全部 8 个节点',{exact:true}).click();await expect(p.locator('[data-directory-node]')).toHaveCount(8);await expect(p.locator('[data-directory-node="M08"]')).toBeVisible();
  report.checks.push('Eight real node outputs and URLs; selecting/exploring never changes completion or writes records; keyboard arrow/Home/End navigation; desktop drag, zoom and current-task recenter; simple directory');

  await ctx.addInitScript(({items})=>{for(const [k,v] of items)localStorage.setItem(k,JSON.stringify(v))},{items:[
    [key('guest',scope('M01')),{...cache(body('M01')),submittedAt:'2026-10-09T00:00:00Z'}],
    [key('guest',scope('M02')),{...cache(body('M02')),dirty:true}],
    [key('guest',{...scope('WORK'),activity_id:'system-build'}),cache(digital)]
  ]});
  await p.reload();await ready(p);
  await expect(p.locator('[data-mission-node="M01"]')).toHaveAttribute('data-status','submitted');
  await expect(p.locator('[data-mission-node="M02"]')).toHaveAttribute('data-status','draft');
  await expect(p.locator('[data-mission-node="M02"]')).toHaveAttribute('aria-current','step');
  await expect(p.locator('[data-campus-task]')).toHaveAttribute('data-campus-task','M02');
  await expect(p.locator('[data-digital-progress]')).toHaveText('5 / 5');await expect(p.locator('[data-physical-progress]')).toHaveText('0 / 6');await expect(p.locator('[data-mission-delivery]')).toHaveText('尚未交付');
  await p.locator('[data-campus-map]').screenshot({path:dir+'map-progress.png'});
  await p.locator('[data-campus-enter]').click();await expect(p.locator('[data-module]')).toHaveAttribute('data-module','M02');await expect(p.locator('#lesson-notebook')).toContainText('地图恢复检查');
  await expect(p.locator('#lesson-reading')).toBeAttached();await expect(p.locator('#lesson-videos')).toBeAttached();await expect(p.locator('#lesson-references')).toBeAttached();await expect(p.locator('[data-rover-workshop]')).toBeAttached();
  await p.getByText('展开任务地图，查看我的进展',{exact:true}).click();await ready(p);await expect(p.locator('[data-mission-node="M02"]')).toHaveAttribute('aria-current','step');
  await select(p,'M06');await p.locator('[data-campus-enter]').click();await expect(p.locator('[data-rover-workshop]')).toHaveAttribute('data-stage','6');
  const stl=await ctx.request.get('http://localhost:4000/project-lines/space-exploration/assemble-a-rover/hardware/reference-stl.zip');expect(stl.status()).toBe(200);
  report.checks.push('Guest submitted/draft states and suggested current task restored; digital evidence remains 5/5 without claiming physical delivery; node selection enters original classroom with prior reflection, media, workbench and printable files intact; initially closed in-lesson map measures correctly');
  await ctx.close();

  for(const width of [390,320]){
    const c=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),q=await c.newPage();observe(q);
    await q.goto(url+'#mission-map');await ready(q);expect(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await q.locator('[data-campus-map]').screenshot({path:dir+`map-${width}.png`});
    const v=q.locator('[data-campus-viewport]');await v.scrollIntoViewIfNeeded();const bounds=await v.boundingBox();
    const session=await c.newCDPSession(q),x=bounds.x+bounds.width*.75,y=bounds.y+190;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*20,y}],timestamp:Date.now()/1000+i*.025});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>v.evaluate(el=>el.scrollLeft)).toBeGreaterThan(50);
    await expect(q.locator('[data-campus-task]')).toHaveAttribute('data-campus-task','M01');
    await q.getByRole('button',{name:'下一个地点'}).click();await expect(q.locator('[data-campus-task]')).toHaveAttribute('data-campus-task','M02');
    await q.getByRole('button',{name:'定位当前任务'}).click();await expect(q.locator('[data-campus-task]')).toHaveAttribute('data-campus-task','M01');
    await select(q,'M06');await q.locator('[data-campus-enter]').click();await expect(q.locator('[data-module]')).toHaveAttribute('data-module','M06');
    await q.getByText('展开任务地图，查看我的进展',{exact:true}).click();await ready(q);expect(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(q.locator('[data-mission-node="M06"]')).toHaveAttribute('aria-current','step');await expect(q.locator('[data-mission-node="M06"]')).toBeInViewport();
    await q.locator('[data-campus-map]').screenshot({path:dir+`lesson-map-${width}.png`});await c.close();
  }
  report.checks.push('320px/390px: no document overflow; native touch drag does not select a station; next/current controls; node M06 in-lesson map initially centers current station; reduced-motion layout');

  const account=await browser.newContext(),a=await account.newPage();observe(a);
  const jwt=`test.${Buffer.from(JSON.stringify({sub:'campus-test'})).toString('base64url')}.test`;
  await account.addInitScript(token=>localStorage.setItem('systemedu_token',token),jwt);
  await account.route('**/api/learning/records?**',async route=>{
    const id=new URL(route.request().url()).searchParams.get('module_id');
    if(id==='M04')return route.fulfill({status:503,contentType:'application/json',body:'{"message":"offline test"}'});
    await route.fulfill({contentType:'application/json',body:JSON.stringify({draft:null,submissions:[]})});
  });
  await a.goto(url+'#mission-map');await ready(a);await expect(a.locator('[data-mission-node="M04"]')).toHaveAttribute('data-status','unknown');await select(a,'M04');await expect(a.locator('[data-campus-task]')).toContainText('进度待读取');await account.close();
  report.checks.push('Failed account reads remain unknown on both map station and task card, never presented as unstarted/completed');

  const offline=await browser.newContext({viewport:{width:390,height:844}});await offline.route('**/campus-map-v1.webp',r=>r.abort());const e=await offline.newPage();observe(e);
  await e.goto(url+'#mission-map');await expect(e.getByText('基地图片暂时无法加载。',{exact:false})).toBeVisible();await expect(e.locator('[data-directory-node="M04"]')).toBeVisible();await e.locator('[data-directory-node="M04"]').click();await expect(e.locator('[data-module]')).toHaveAttribute('data-module','M04');await offline.close();
  report.checks.push('Image failure exposes the full simple directory and still enters the original lesson');
  expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'verification.json',JSON.stringify(report,null,2));await browser.close()}
