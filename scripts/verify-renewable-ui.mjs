import {chromium,expect as baseExpect} from '@playwright/test'
import fs from 'node:fs/promises'
const expect=baseExpect.configure({timeout:20000}),origin='http://localhost:4000',out='artifacts/renewable-project-line'
const {users:[user,other]}=JSON.parse(await fs.readFile('/private/tmp/renewable-test-users.json'))
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({args:['--no-proxy-server']}),ctx=await browser.newContext({viewport:{width:1440,height:1080}})
await ctx.addInitScript(token=>localStorage.setItem('systemedu_token',token),user.token)
const page=await ctx.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(String(e)))
const work=page.locator('[data-renewable-workspace]'),run=()=>work.getByRole('button',{name:'运行并保留这次实验'}).click()
const slider=async(label,value)=>{const el=page.getByRole('slider',{name:label});await el.fill(String(value))}
async function open(id,node){await page.goto(`${origin}/explore/energy-motion/${id}${node?'?node='+node:''}`);await expect(work.getByRole('button',{name:'运行并保留这次实验'})).toBeEnabled()}
async function check(name,fn){await fn();results.push({name,passed:true});console.log('PASS '+name)}
try{
 await check('3 个微体验真实操作、提交和账号保存',async()=>{
  for(const [id,label,value] of [['catch-a-sunbeam','面板倾角 / °',45],['tune-a-wind-rotor','叶片安装角 / °',40],['keep-the-beacon-on','可暂停负载 / mW',1]]){
   await open(id);await run();await slider(label,value);await run();const submit=page.getByRole('button',{name:'保存我的发现'});await expect(submit).toBeEnabled();await submit.click();await expect(page.locator('#project-delivery [data-learning-status]')).toContainText('已提交到账号');await page.reload();await expect(page.locator('#project-delivery')).toContainText('已交付版本');await page.getByRole('slider',{name:label}).scrollIntoViewIfNeeded();await work.screenshot({path:`${out}/${id}.png`})
  }
 })
 await check('另一浏览器恢复与账号隔离',async()=>{
  for(const [who,expected] of [[user,'45'],[other,'25']]){const c=await browser.newContext();await c.addInitScript(t=>localStorage.setItem('systemedu_token',t),who.token);const p=await c.newPage();await p.goto(origin+'/explore/energy-motion/catch-a-sunbeam');await expect(p.getByRole('button',{name:'运行并保留这次实验'})).toBeEnabled();await expect(p.getByRole('slider',{name:'面板倾角 / °'})).toHaveValue(expected);if(who===other)await expect(p.locator('[data-renewable-report]')).toHaveCount(0);await c.close()}
 })
 await check('02 数字原型可提交，缺少实物时不能完成实物作品',async()=>{
  await open('build-a-solar-tracker','M05');await run();await slider('面板倾角 / °',45);await run();await page.getByLabel('我选择这一版的依据',{exact:true}).fill('相同负载对照两个倾角，选择本次平均输入较高的版本。');await page.getByLabel('这些结果还不能证明什么',{exact:true}).fill('模型尚未经过实际光伏板校准，需要打印后重新测量。');await page.getByRole('button',{name:'保存数字原型',exact:true}).click();await expect(page.locator('#digital-prototype [data-learning-status]')).toContainText('已提交到账号');await expect(page.getByRole('button',{name:'提交最终作品',exact:true})).toBeDisabled();await slider('面板倾角 / °',55);await expect(page.getByRole('button',{name:'保存数字原型',exact:true})).toBeDisabled();await page.locator('#digital-prototype > details > summary').filter({hasText:'已交付版本'}).click();await expect(page.locator('#digital-prototype [data-renewable-report]')).toContainText('45°');await page.screenshot({path:out+'/solar-delivery.png',fullPage:true})
 })
 await check('规则实际应用；非法程序不覆盖；本人前作参数导入',async()=>{
  await open('write-energy-dispatch-rules','M02');await page.getByLabel('我的四行规则').fill('pause = 2.32\nresume = 2.58\nmissing = off\ncontrol = hysteresis');await page.getByRole('button',{name:'应用我的规则'}).click();await expect(page.getByRole('slider',{name:'暂停阈值 / V'})).toHaveValue('2.32');await page.getByLabel('我的四行规则').fill('pause = 2.68\nresume = 2.3\nmissing = off\ncontrol = hysteresis');await page.getByRole('button',{name:'应用我的规则'}).click();await expect(work).toContainText('pause 必须低于 resume');await expect(page.getByRole('slider',{name:'暂停阈值 / V'})).toHaveValue('2.32');await open('build-a-wind-solar-station','M02');await page.getByRole('button',{name:'接入本人已保存的前作'}).click();await expect(work).toContainText('已应用 1 份');await expect(page.getByRole('slider',{name:'面板倾角 / °'})).toHaveValue('45');await expect(page.getByRole('button',{name:'检查数据接口'})).toBeDisabled();await page.getByLabel('我先怀疑什么').fill('怀疑发来的电压单位与接收程序解释的单位不同，需要检查原始读数。');await page.getByRole('button',{name:'检查数据接口'}).click();await expect(page.getByLabel('接收端字段单位')).toBeEnabled();await page.getByLabel('接收端字段单位').selectOption('mV');await work.getByLabel('测试工况').selectOption('unit');await run();await expect(work).toContainText('接口单位故障复测')
 })
 await check('04 冻结与首轮结果刷新后不变，修订不覆盖',async()=>{
  await open('run-an-energy-mission','M03');await page.getByLabel('事前任务、条件与停止标准').fill('使用相同负载完成 120 秒输入波动任务，至少保持关键服务 90 秒，实物记录停止时刻。');await page.getByRole('button',{name:'冻结当前方案'}).click();await page.getByRole('button',{name:'打开新工况，保存第一次数字结果'}).click();await expect(page.getByRole('button',{name:'第一次数字结果已固定'})).toBeDisabled();const first=await page.getByText(/首次关键服务 .* 秒/).innerText();await slider('面板倾角 / °',50);await page.reload();await expect(page.getByRole('button',{name:'第一次数字结果已固定'})).toBeDisabled();await expect(page.getByText(/首次关键服务 .* 秒/)).toHaveText(first);await expect(page.getByLabel('事前任务、条件与停止标准')).toBeDisabled()
 })
 await check('29 个节点的正文、资料与节点任务都能打开',async()=>{
  const catalog=JSON.parse(await fs.readFile('packages/student-web/src/lib/project-lines/renewable-courses.json'));
  for(const c of catalog.filter(c=>c.kind!=='micro'))for(let i=1;i<=c.learningNodes;i++){await open(c.id,`M${String(i).padStart(2,'0')}`);expect((await page.locator('#lesson-reading').innerText()).length).toBeGreaterThan(300);await expect(page.locator('#lesson-references a').first()).toBeVisible()}
 })
 await check('手机布局、3D 回退、项目线封面与打印文件',async()=>{
  await page.setViewportSize({width:390,height:844});await open('tune-a-wind-rotor');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:out+'/wind-mobile.png',fullPage:true});await page.goto(origin+'/library?view=lines&line=energy-motion');await expect(page.getByRole('link',{name:/接住一束阳光/}).first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:out+'/line-mobile.png',fullPage:true});
  const c=await browser.newContext();await c.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:get.call(this,type,...args)}});const p=await c.newPage();await p.goto(origin+'/explore/energy-motion/catch-a-sunbeam');await expect(p.getByText('二维替代视图 · 参数仍可操作')).toBeVisible();await p.getByRole('button',{name:'运行并保留这次实验'}).click();await expect(p.getByText('平均采集前输入')).toBeVisible();await c.close();for(const name of ['build-guide.html','parts.zip','dispatch.ino'])expect((await page.request.get(origin+'/project-lines/energy-motion/renewable-hardware/'+name)).ok()).toBe(true)
 })
 expect(errors).toEqual([])
}catch(e){results.push({name:'Failure',passed:false,error:String(e)});await page.screenshot({path:out+'/failure.png',fullPage:true});throw e}finally{await fs.writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));await browser.close()}
