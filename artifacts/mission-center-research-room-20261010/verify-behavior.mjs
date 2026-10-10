import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {mockAccount,jwt,cacheKey} from '../space-mission-center-20261010/mock-account.mjs';
const dir='/tmp/systemedu-mission-room-regression/',origin='http://127.0.0.1:4000',url=origin+'/mission/space/control';
const scope={library_slug:'space-exploration',module_id:'JOURNEY',activity_id:'mission-operations',kind:'classroom',content_version:'1.0'};
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true}),report={passed:false,checks:[],errors:[]};
const watch=p=>p.on('pageerror',e=>report.errors.push(e.message));
async function context(options={}){const c=await browser.newContext(options);await c.addInitScript(()=>{for(let i=1;i<=5;i++)localStorage.setItem(`systemedu:mission:space:stage-film:${i}:v1`,'1')});return c}
const body=async(p,owner='guest')=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null')?.body,cacheKey(owner,scope));
const ready=async p=>{await expect(p.locator('[data-task-order]')).toBeVisible();await expect(p.getByLabel('我的子任务状态',{exact:true})).toBeEnabled()};
const tab=(p,name)=>p.getByRole('navigation',{name:'任务中心模块'}).getByRole('button',{name,exact:true});
const time=async(p,owner='guest')=>Object.values((await body(p,owner))?.artifact.time.totals||{}).reduce((a,b)=>a+b,0);
const overflow=async p=>expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
try{
 const c=await context({viewport:{width:1440,height:1050}}),p=await c.newPage();watch(p);
 await p.goto(url+'?task=pick-an-observation-site%3AM01');await ready(p);
 const complete=p.getByRole('button',{name:'标记这一步自检完成',exact:true});await expect(complete).toBeDisabled();
 await p.getByLabel('我的子任务状态',{exact:true}).selectOption('active');
 await p.getByLabel('我的证据摘要').fill('我记录了 PIA23386 来源卡；轨道视角不能代替地面相机。');
 await p.getByLabel('交给下一步的提醒').fill('继续比较尺度，不把模拟场景作为实测。');
 for(const check of await p.locator('[data-task-order] input[type=checkbox]').all())await check.check();
 await complete.click();await expect(p.locator('[data-main-progress]')).toContainText('1 / 62');
 await p.getByLabel('现在卡在哪里？').fill('影像编号需要再次核对');await expect(p.getByLabel('我的子任务状态',{exact:true})).toHaveValue('review');
 await p.getByRole('button',{name:'标记为遇到阻碍',exact:true}).click();await expect(p.getByLabel('我的子任务状态',{exact:true})).toHaveValue('blocked');
 await p.getByLabel('这一步计划完成日期').fill('2026-11-01');
 await p.reload();await ready(p);await expect(p.getByLabel('我的证据摘要')).toHaveValue(/PIA23386/);await expect(p.getByLabel('我的子任务状态',{exact:true})).toHaveValue('blocked');
 await tab(p,'时间表').click();await p.getByLabel('每周计划投入').selectOption('180');await p.getByLabel('原型制造区目标日期').fill('2026-11-10');
 await expect(p.getByRole('button',{name:/2026-11-01.*读懂影像的身份/})).toBeVisible();
 await p.reload();await expect(p.getByLabel('每周计划投入')).toHaveValue('180');await expect(p.getByLabel('原型制造区目标日期')).toHaveValue('2026-11-10');
 await p.screenshot({path:dir+'schedule-desktop.png',fullPage:true});
 await tab(p,'工作日志').click();await expect(p.getByRole('button',{name:/影像编号需要再次核对/})).toBeVisible();
 await tab(p,'工作台').click();await ready(p);await p.getByLabel('现在卡在哪里？').fill('');await complete.click();
 await p.getByLabel('搜索全部子任务').fill('M');expect(await p.locator('[data-task-choice]').count()).toBe(88);
 await p.getByLabel('搜索全部子任务').fill('');
 // Explicit timing, checkpoint restore and task changes preserve totals.
 await p.getByRole('button',{name:'开始本次工作',exact:true}).click();await expect(p.getByLabel('本次工作用时')).toHaveAttribute('data-running','true');
 await expect.poll(()=>time(p),{timeout:16000}).toBeGreaterThanOrEqual(9);
 await p.getByRole('button',{name:'暂停计时',exact:true}).click();const first=await time(p);expect(first).toBeGreaterThanOrEqual(9);
 await p.reload();await ready(p);expect(await time(p)).toBe(first);await expect(p.getByLabel('本次工作用时')).toHaveAttribute('data-running','false');
 // Deterministic visibility event: hold the lock but simulate a hidden document.
 await p.getByRole('button',{name:'开始本次工作',exact:true}).click();await expect(p.getByLabel('本次工作用时')).toHaveAttribute('data-running','true');
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
 await expect(p.getByLabel('本次工作用时')).toHaveAttribute('data-running','false');await p.evaluate(()=>{delete document.hidden});
 // A held account-scoped Web Lock prevents another timer, without creating a fake work segment.
 const lockPage=await c.newPage();await lockPage.goto(origin+'/mission/space/control');
 await lockPage.evaluate(()=>{window.timerLockHeld=false;void navigator.locks.request('systemedu:space-work:guest',async()=>{window.timerLockHeld=true;await new Promise(r=>window.releaseTimerLock=r)})});
 await expect.poll(()=>lockPage.evaluate(()=>window.timerLockHeld)).toBe(true);await p.bringToFront();
 await p.getByRole('button',{name:'开始本次工作',exact:true}).click();await expect(p.locator('[data-mission-clock]')).toContainText('另一标签页正在计时');await expect(p.getByLabel('本次工作用时')).toHaveAttribute('data-running','false');
 await lockPage.evaluate(()=>window.releaseTimerLock());await lockPage.close();
 await tab(p,'任务地图').click();await expect(p.locator('[data-mission-node]')).toHaveCount(8);await p.locator('[data-mission-node="perception"]').click();
 await expect(p.locator('#selected-station-order')).toContainText('视觉训练站');await p.getByRole('button',{name:'打开本站任务单'}).click();await expect(p.locator('[data-task-order]')).toHaveAttribute('data-task-order','mars-analog-rover:M02');
 await tab(p,'工程档案').click();await expect(p.locator('[data-mission-dossier]')).toBeVisible();
 await p.goto(url+'?task=pick-an-observation-site%3AM01');await ready(p);await p.screenshot({path:dir+'desktop.png',fullPage:true});
 await p.locator('[data-task-classroom]').click();await expect(p.locator('[data-mission-work-strip]')).toBeVisible();
 for(const selector of ['#lesson-videos','#lesson-references','#lesson-notebook'])await expect(p.locator(selector)).toBeAttached();
 await p.locator('[data-mission-work-strip] a').first().click();await ready(p);await expect(p.getByLabel('我的子任务状态',{exact:true})).toHaveValue('done');
 await p.goto(origin+'/mission/space');await expect(p.locator('[data-mission-center-entry]')).toHaveAttribute('href','/mission/space/control');
 report.checks.push('Guest: task checks/evidence/blocker transitions, 88-node search, schedule persistence, timer checkpoint/reload, explicit hidden pause and exclusive cross-tab lock, map selection, dossier reuse, original classroom links and home entry');await c.close();
 const a=await context({viewport:{width:1440,height:1050}}),backend=await mockAccount(a,'control-a'),q=await a.newPage();watch(q);
 const remote=()=>backend.histories.get(`${jwt('control-a')}:${backend.scopeKey(scope)}`);
 await q.goto(url+'?task=pick-an-observation-site%3AM01');await ready(q);await q.getByLabel('我的证据摘要').fill('账号 A 的测试证据');
 await expect.poll(()=>remote()?.draft?.body.artifact.tasks['pick-an-observation-site:M01'].evidence).toBe('账号 A 的测试证据');
 // Restore in a genuinely fresh browser storage context using the same mocked account API.
 await q.evaluate(k=>localStorage.removeItem(k),cacheKey('user:control-a',scope));await q.reload();await ready(q);await expect(q.getByLabel('我的证据摘要')).toHaveValue('账号 A 的测试证据');
 // Explicit original full-course mark does not inflate personal self-check progress.
 await q.goto(url+'?task=mars-analog-rover%3AM35');await ready(q);await expect(q.locator('[data-main-progress]')).toContainText('0 / 62');await expect(q.locator('[data-task-order]')).toContainText('原课堂状态：原课已标记');
 await q.getByRole('button',{name:'开始本次工作',exact:true}).click();await expect(q.getByLabel('本次工作用时')).toHaveAttribute('data-running','true');
 await expect.poll(()=>remote()?.draft?.body.artifact.time.totals['mars-analog-rover:M35']||0,{timeout:16000}).toBeGreaterThanOrEqual(9);
 await q.getByRole('button',{name:'暂停计时',exact:true}).click();
 // Competing device revision must preserve local draft and expose a recoverable conflict.
 await expect.poll(()=>q.locator('[data-mission-control]').innerText()).toContain('已保存到账号');
 remote().draft.revision++;remote().draft.body={...remote().draft.body,artifact:{...remote().draft.body.artifact,plan:{...remote().draft.body.artifact.plan,weeklyMinutes:240}}};
 await q.getByLabel('交给下一步的提醒').fill('本机保留的提醒');
 await expect(q.locator('[data-mission-control]')).toContainText('另一页面已有新版');
 expect((await body(q,'user:control-a')).artifact.tasks['mars-analog-rover:M35'].next).toBe('本机保留的提醒');await expect(q.getByRole('button',{name:'开始本次工作',exact:true})).toBeDisabled();
 await q.locator('summary').filter({hasText:'保存与恢复'}).click();await q.getByRole('button',{name:'读取服务器版本（替换本机草稿）',exact:true}).click();await ready(q);await expect(q.getByLabel('交给下一步的提醒')).toHaveValue('');
 await q.evaluate(t=>{localStorage.setItem('systemedu_token',t);window.dispatchEvent(new Event('focus'))},jwt('control-b'));await ready(q);
 await q.getByLabel('搜索全部子任务').fill('pick-an-observation-site:M01');await q.locator('[data-task-choice="pick-an-observation-site:M01"]').click();await ready(q);await expect(q.getByLabel('我的证据摘要')).toHaveValue('');expect(await time(q,'user:control-b')).toBe(0);
 expect(backend.calls.filter(c=>c.body?.activity_id==='mission-operations').every(c=>c.path==='/api/learning/drafts'&&c.body.module_id==='JOURNEY'&&c.body.kind==='classroom')).toBe(true);
 report.checks.push('Account API mock: drafts and time restore after cache deletion; source completion not equated with self-check; CAS conflict preserves local input and pauses edits; explicit remote recovery and account isolation');await a.close();
 for(const width of [390,320]){
  const c=await context({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await c.newPage();watch(p);
  await p.goto(url+'?task=assemble-a-rover%3AM06');await ready(p);await overflow(p);await p.screenshot({path:dir+`mobile-${width}.png`,fullPage:true});
  for(const view of ['任务地图','时间表','工作日志','工程档案']){await tab(p,view).click();await overflow(p);if(view==='任务地图')await expect(p.locator('[data-mission-node]')).toHaveCount(8)}
  await p.goto(origin+'/mission/space');await expect(p.locator('[data-mission-center-entry]')).toBeVisible();await overflow(p);
  await p.goto(origin+'/explore/space-exploration/spot-a-world?mission=space');await expect(p.locator('[data-mission-work-strip]')).toBeVisible();await overflow(p);
  await c.close();
 }
 report.checks.push('390px and 320px: all five modules, existing homepage entry and micro-classroom strip have no horizontal overflow');
 expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'browser-verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
