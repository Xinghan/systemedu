import {chromium,expect as baseExpect} from '@playwright/test';
import fs from 'node:fs/promises';
const expect=baseExpect.configure({timeout:20000});
const courses=JSON.parse(await fs.readFile('packages/student-web/src/lib/project-lines/space-courses.json'));
const {users:[user,other]}=JSON.parse(await fs.readFile('/private/tmp/learning-records-e2e.json'));
const out=process.env.SPACE_TEST_OUTPUT||'artifacts/space-courses';await fs.mkdir(out,{recursive:true});
const resume=Number(process.env.SPACE_TEST_FROM||1);let checkIndex=0;
const browser=await chromium.launch({args:['--no-proxy-server']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(t=>localStorage.setItem('systemedu_token',t),user.token);
const page=await context.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(String(e)));
if(resume>1)results.push(...JSON.parse(await fs.readFile(out+'/verification.json')).results.filter(r=>r.passed).slice(0,resume-1));
const work=page.locator('[data-space-workbench]'),delivery=page.locator('[data-project-delivery]');
async function check(name,fn){if(++checkIndex<resume)return;await fn();results.push({name,passed:true});console.log('PASS '+name)}
async function open(id,node='M03',p=page){await p.goto(`http://localhost:4000/explore/space-exploration/${id}?${["assemble-a-rover","run-an-expedition"].includes(id)?"edition=1&":""}node=${node}`);await expect(p.locator('[data-space-workbench] [data-learning-status]')).not.toContainText('正在读取');await expect(p.locator('[data-space-workbench] fieldset')).toBeEnabled();}
async function run(name='运行并留下证据'){await work.getByRole('button',{name,exact:true}).click();await expect(work.locator('[data-space-result]')).toBeVisible();}
async function explain(){for(const [label,value] of [['我作出的关键选择','我根据本次两版结果调整配置，并保留原始失败。'],['证据支持什么，还不能证明什么','只验证了当前教学模型条件，尚未进行真实设备试验。'],['我制作与平台提供的部分','我作出选择和解释，平台提供模型、影像与工具。']])await work.getByRole('textbox',{name:label,exact:true}).fill(value)}
async function submit(){await explain();await expect(delivery.getByRole('button',{name:'提交项目作品',exact:true})).toBeEnabled();await delivery.getByRole('button',{name:'提交项目作品',exact:true}).click();await expect(delivery.getByRole('button',{name:'当前版本已保存'})).toBeVisible();await expect(delivery.locator('[data-learning-status]')).toContainText('已提交');}
try{
 await check('四门引导课与两门旧版整合课、18 个节点、视频及交付验收',async()=>{
  for(const c of courses){for(const node of ['M01','M02','M03']){await open(c.id,node);await expect(page.locator('[data-module]')).toHaveAttribute('data-module',node);await expect(page.locator('#lesson-reading')).not.toBeEmpty();await expect(page.locator('[data-course-video]')).toHaveCount(1);await expect(page.getByRole('region',{name:'最终作品目标'})).toBeVisible();}await expect(delivery.getByRole('button',{name:'提交项目作品',exact:true})).toBeDisabled();}
  await page.goto('http://localhost:4000/library?view=lines&line=space-exploration');for(const c of courses){await expect(page.locator(`[data-project-card="${c.id}"]`)).toBeVisible();await expect.poll(()=>page.locator(`[data-project-card="${c.id}"] img`).evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true)}await expect(page.locator('[data-planned-project]')).toHaveCount(0);await page.screenshot({path:out+'/line-desktop.png',fullPage:true});
 });
 await check('观察选址：两处实际影像标记、切换失效与交付',async()=>{
  await open('pick-an-observation-site');await work.getByRole('button',{name:'确认当前位置标记'}).click();await run('记录这个候选地点');await work.getByLabel('比较哪处影像').selectOption('dunes');await run('记录这个候选地点');await expect(work.locator('[data-space-result]')).toContainText('请先');await work.getByRole('button',{name:'确认当前位置标记'}).click();await run('记录这个候选地点');await submit();await work.screenshot({path:out+'/site-workbench.png'});
 });
 await check('运载方案：保留超限版本、移除机械臂后核对预算',async()=>{
  await open('plan-a-payload');await run('核对这版预算');await expect(work.locator('[data-space-result]')).toContainText('超过');await work.getByLabel('采样机械臂 · 5 kg').uncheck();await run('核对这版预算');await submit();await work.screenshot({path:out+'/payload-workbench.png'});
 });
 await check('越野底盘：单变量对照、3D 结构和当前证据失效',async()=>{
  await open('tune-a-chassis');await run();await work.getByLabel('离地间隙',{exact:true}).selectOption('14');await run();await explain();await expect(delivery.getByRole('button',{name:'提交项目作品',exact:true})).toBeEnabled();await work.getByLabel('速度档',{exact:true}).selectOption('2');await expect(delivery.getByRole('button',{name:'提交项目作品',exact:true})).toBeDisabled();await work.getByLabel('速度档',{exact:true}).selectOption('1');await submit();await expect(page.frameLocator('iframe[title^="六轮探测车"]').locator('body')).toHaveAttribute('data-renderer',/webgl|vector/);await work.screenshot({path:out+'/chassis-workbench.png'});
 });
 await check('地形样本：独立测试保留不一致，不把全部正确作为交付门槛',async()=>{
  await open('label-the-terrain');await work.getByRole('button',{name:'放大查看 PIA20755',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'放大细节',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('可横向和纵向滚动');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);for(const [id,label] of [['PIA20755','sand'],['PIA20281','sand'],['PIA20169','sand'],['PIA02896','rock'],['PIA06323','rock'],['PIA05921','rock']])await work.getByLabel(id+' 标签').selectOption(label);await run('用独立影像测试');await expect(work).toContainText('PIA08492：预测');await submit();await work.screenshot({path:out+'/terrain-workbench.png'});
 });
 await check('探测车组装：从账号读取真实底盘快照、正常与故障运行',async()=>{
  await open('assemble-a-rover');await work.getByRole('button',{name:'读取我已交付的作品',exact:true}).click();await expect(work).toContainText('已载入我的作品快照');await work.getByLabel('地形识别器来源').selectOption('platform');await run();await expect(work.locator('[data-space-result]')).toContainText('抵达');await work.getByLabel('本次条件').selectOption('camera');await run();await expect(work.locator('[data-space-result]')).toContainText('停止');await work.getByLabel('本次条件').selectOption('normal');await run();await submit();await work.screenshot({path:out+'/assembly-workbench.png'});
 });
 await check('远征：实际消费探测车与选址、修订预算后独立提交',async()=>{
  await open('run-an-expedition');await work.getByRole('button',{name:'读取我已交付的作品',exact:true}).click();await expect(work).toContainText('已载入我的作品快照');await expect(work.getByLabel('观察目标')).toHaveValue('dunes');await run();await expect(work.locator('[data-space-result]')).toContainText('未完成');await work.getByLabel('初始能量').selectOption('24');await work.getByLabel('路线方案').selectOption('safe');await run();await submit();await work.locator('[data-space-artifact-preview]>details').last().locator('summary').click();const replay=work.locator('[data-expedition-replay]').last();await expect(replay).toBeVisible();await replay.getByRole('slider',{name:'远征回放进度'}).fill('8');await expect(replay.locator('[data-observation-frame]')).toBeVisible();await work.screenshot({path:out+'/expedition-workbench.png'});await delivery.screenshot({path:out+'/expedition-delivery.png'});
 });
 await check('新浏览器恢复完整交付、账号隔离与版本快照',async()=>{
  const c=await browser.newContext();await c.addInitScript(t=>localStorage.setItem('systemedu_token',t),user.token);const p=await c.newPage();await open('run-an-expedition','M03',p);await expect(p.locator('[data-delivered-version]')).toBeVisible();await p.locator('[data-delivered-version]>summary').click();await expect(p.locator('[data-delivered-version]')).toContainText('沙丘波纹');await p.getByLabel('观察目标').selectOption('delta');await expect(p.locator('[data-space-workbench]')).toContainText('参数已修改');await expect(p.locator('[data-space-workbench] svg[role=img]')).toContainText('配置预览');await expect(p.locator('[data-delivered-version]')).toContainText('沙丘波纹');await c.close();
  const isolated=await browser.newContext();await isolated.addInitScript(t=>localStorage.setItem('systemedu_token',t),other.token);const p2=await isolated.newPage();await open('run-an-expedition','M03',p2);await expect(p2.locator('[data-delivered-version]')).toHaveCount(0);await expect(p2.locator('[data-project-delivery] button').first()).toBeDisabled();await isolated.close();
 });
 await check('手机布局、游客范围、3D 降级和视频弹窗',async()=>{
  const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true});const p=await c.newPage();for(const item of courses){await open(item.id,'M03',p);await expect(p.locator('[data-project-delivery]')).toContainText('保存项目作品到本机');expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await p.locator('[data-space-workbench]').screenshot({path:out+'/'+item.id+'-mobile.png'});}await p.locator('[data-course-video] button').first().click();await expect(p.getByRole('dialog')).toBeVisible();await p.getByRole('button',{name:'关闭视频',exact:true}).click();await p.goto('http://localhost:4000/project-lines/space-exploration/_course-assets/rover-inspector.html?renderer=canvas');await expect(p.locator('body')).toHaveAttribute('data-renderer','vector');await c.close();
 });
 await check('跨课程切换不沿用上一课进度，手机 3D 控件不遮挡画布',async()=>{
  const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true});const p=await c.newPage();await open('tune-a-chassis','M01',p);
  const frame=p.frameLocator('iframe[title^="六轮探测车"]');await expect(frame.locator('body')).toHaveAttribute('data-renderer','webgl');
  expect(await frame.locator('body').evaluate(()=>{const canvas=document.querySelector('canvas').getBoundingClientRect();return [...document.querySelectorAll('button')].every(b=>b.getBoundingClientRect().bottom<=canvas.top+1)&&document.querySelector('#status').getBoundingClientRect().top>=canvas.bottom-1})).toBe(true);
  await p.locator('[data-space-workbench]').screenshot({path:out+'/tune-a-chassis-mobile.png'});
  const notebook=p.locator('[data-guided-notebook]');for(const field of await notebook.getByRole('textbox').all())await field.fill('本次观察用于验证课程之间的记录隔离。');await notebook.getByRole('button',{name:'继续下一步',exact:true}).click();for(const field of await notebook.getByRole('textbox').all())await field.fill('保留我的本课说明，下一门课程需要独立填写。');await notebook.getByRole('button',{name:'提交本节学习记录',exact:true}).click();await expect(p.locator('[data-course-progress]')).toHaveText('1 / 3');
  await p.getByRole('link',{name:'查看我的最终作品',exact:true}).click();await p.getByRole('link',{name:'下一站：让作品继续工作',exact:true}).click();await expect(p.locator('[data-guided-course]')).toHaveAttribute('data-guided-course','assemble-a-rover');await expect(p.locator('[data-course-progress]')).toHaveText('0 / 8');await expect(p.locator('[data-rover-workshop]')).toBeVisible();await p.locator('[data-rover-workshop]').screenshot({path:out+'/assemble-a-rover-mobile.png'});await c.close();
 });
 expect(errors).toEqual([]);
}catch(error){await page.screenshot({path:out+'/failure.png',fullPage:true});results.push({error:String(error)});throw error}finally{await fs.writeFile(out+'/verification.json',JSON.stringify({date:new Date().toISOString(),results,errors},null,2));await browser.close()}
