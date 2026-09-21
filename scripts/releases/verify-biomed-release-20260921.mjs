import { chromium, expect as baseExpect } from '@playwright/test'
import fs from 'node:fs/promises'

const origin=process.env.RELEASE_ORIGIN||'http://127.0.0.1:14001'
const out=process.env.RELEASE_OUTPUT||'artifacts/biomed-release-20260921/preview'
const expect=baseExpect.configure({timeout:25000}),checks=[],errors=[]
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({args:['--no-proxy-server']})
const page=await browser.newPage({viewport:{width:1440,height:1000}})
page.on('pageerror',error=>errors.push(String(error)))
const projects=['turn-a-molecule','sort-molecule-cards','build-a-candidate-filter','check-a-prediction','assemble-a-discovery-desk','challenge-an-unseen-library']
const courses=[['build-a-candidate-filter',4],['check-a-prediction',4],['assemble-a-discovery-desk',6],['challenge-an-unseen-library',5]]
async function check(name,fn){await fn();checks.push({name,passed:true});console.log('PASS '+name)}
async function open(id,node='M01'){
  expect((await page.goto(`${origin}/explore/biomedicine/${id}?node=${node}`,{waitUntil:'domcontentloaded'})).status()).toBe(200)
  await expect(page.locator('main')).toBeVisible()
}
async function covers(){
  const images=page.locator('[data-line-detail="biomedicine"] img[src*="cover-molecular-v5"]')
  await expect(images).toHaveCount(7)
  for(const image of await images.all()){
    await image.scrollIntoViewIfNeeded()
    await expect.poll(()=>image.evaluate(el=>el.complete&&el.naturalWidth>0),{timeout:180000}).toBe(true)
  }
}
try{
  await check('项目线入口、六项目封面及五级项目库',async()=>{
    await page.goto(origin+'/library?view=lines&line=biomedicine')
    await expect(page.locator('[data-line-detail="biomedicine"] [data-line-stage]')).toHaveCount(5)
    for(const id of projects)await expect(page.locator(`[data-project-card="${id}"]`)).toBeVisible()
    for(const id of projects)await expect(page.locator(`[data-project-card="${id}"] img`)).toHaveAttribute('src',/^\/_next\/image\?/)
    await covers();await page.screenshot({path:out+'/biomed-line-desktop.png',fullPage:true})
    await page.goto(origin+'/library?view=projects')
    await expect(page.locator('[data-difficulty-group]')).toHaveCount(5)
    await expect(page.locator('[data-project-card="assemble-a-rover"]')).toBeVisible()
    await expect(page.locator('[data-project-card="challenge-an-unseen-library"]')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('转动第一台发电机')
  })
  await check('19 个课程节点的教材、参考、自检与最终作品入口',async()=>{
    for(const [id,count] of courses)for(let i=1;i<=count;i++){
      await open(id,`M${String(i).padStart(2,'0')}`)
      expect((await page.locator('#lesson-reading').innerText()).length).toBeGreaterThan(350)
      expect(await page.locator('#lesson-references a').count()).toBeGreaterThan(0)
      await expect(page.locator('[data-biomed-check]')).toBeVisible()
      await expect(page.locator('[data-biomed-workspace] fieldset').first()).toBeEnabled()
      if(i===count)await expect(page.locator('[data-biomed-delivery]')).toBeVisible()
    }
  })
  await check('3D 分子操作与观察卡刷新恢复',async()=>{
    await open('turn-a-molecule')
    await expect(page.locator('canvas')).toBeVisible()
    await page.getByRole('button',{name:'标记 O 原子 4',exact:true}).click()
    await page.getByRole('button',{name:'保存我的观察卡',exact:true}).click()
    await expect(page.locator('[data-learning-status]')).toContainText('本机')
    await page.reload()
    await expect(page.getByRole('button',{name:'标记 O 原子 4',exact:true})).toHaveAttribute('aria-pressed','true')
    await expect(page.getByText('我的观察卡 · 咖啡因')).toBeVisible()
    await page.screenshot({path:out+'/molecule-desktop.png',fullPage:true})
    await open('sort-molecule-cards')
    await page.getByRole('button',{name:'咖啡因往后移'}).click()
    await page.getByRole('button',{name:'揭开数值，保存这次排序'}).click()
    await expect(page.locator('main')).toContainText('这次尝试已保留')
    await page.getByRole('button',{name:'咖啡因往后移'}).click()
    await page.getByRole('button',{name:'核对新排序并保存'}).click()
    await expect(page.locator('main')).toContainText('顺序与分子量相符')
  })
  await check('形成性反馈、真实筛选、作品验收及不可被草稿覆盖的报告',async()=>{
    await open('build-a-candidate-filter')
    const quiz=page.locator('[data-biomed-check]')
    await quiz.getByRole('radio').nth(0).check()
    await quiz.getByRole('button',{name:'检查我的理解',exact:true}).click()
    await expect(quiz.locator('[data-correct=false]')).toContainText('没有提供药效证据')
    await quiz.getByRole('radio').nth(1).check()
    await quiz.getByRole('button',{name:'检查我的理解',exact:true}).click()
    await expect(quiz.locator('[data-correct=true]')).toBeVisible()
    await page.reload();await expect(quiz.locator('[data-correct=true]')).toBeVisible()
    await open('build-a-candidate-filter','M02')
    const work=page.locator('[data-biomed-workspace]')
    await work.getByRole('button',{name:'运行这套筛选条件'}).click()
    await work.getByLabel('分子量上限',{exact:true}).fill('450')
    await work.getByRole('button',{name:'运行这套筛选条件'}).click()
    await open('build-a-candidate-filter','M04')
    const delivery=page.locator('[data-biomed-delivery]')
    await expect(delivery.getByRole('button',{name:'保存最终作品到本机',exact:true})).toBeDisabled()
    await work.getByLabel('我的选择理由',{exact:true}).fill('发布验证：比较两版条件与实际结果。')
    await work.getByLabel('我的作品还不能说明什么',{exact:true}).fill('发布验证：这些计算不能证明药效。')
    await delivery.getByRole('button',{name:'保存最终作品到本机',exact:true}).click()
    await expect(delivery.getByRole('button',{name:'作品已保存 · 待评阅'})).toBeVisible()
    await work.getByLabel('分子量上限',{exact:true}).fill('425')
    await expect(delivery.getByRole('button',{name:'保存最终作品到本机',exact:true})).toBeDisabled()
    await delivery.locator('[data-biomed-submission] > summary').click()
    const report=delivery.locator('[data-biomed-report]')
    await expect(report).toContainText('MW ≤ 450 g/mol')
    await expect(report).not.toContainText('MW ≤ 425 g/mol')
    await expect(report.locator('[data-report-comparison] tbody tr')).toHaveCount(2)
    await report.screenshot({path:out+'/filter-report.png'})
  })
  await check('移动端、封面加载与无 WebGL 降级',async()=>{
    await page.setViewportSize({width:390,height:844})
    await page.goto(origin+'/library?view=lines&line=biomedicine');await covers()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:out+'/biomed-line-mobile.png',fullPage:true})
    await open('build-a-candidate-filter','M01')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.locator('[data-biomed-check]').screenshot({path:out+'/concept-mobile.png'})
    const fallback=await browser.newContext({viewport:{width:390,height:844}})
    await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return original.call(this,type,...args)}})
    const p=await fallback.newPage();await p.goto(origin+'/explore/biomedicine/turn-a-molecule')
    await expect(p.getByText('二维结构模式',{exact:true})).toBeVisible()
    await p.getByRole('button',{name:'标记 O 原子 4',exact:true}).click()
    await p.getByRole('button',{name:'保存我的观察卡'}).click()
    await expect(p.locator('[data-learning-status]')).toContainText('本机')
    await fallback.close()
  })
  await check('已上线太空课程、旧生物课程及学习接口仍可访问',async()=>{
    for(const path of ['/library/molecule-monster-hunter','/explore/space-exploration/assemble-a-rover?node=M04','/explore/space-exploration/run-an-expedition?node=M05']){
      expect((await page.goto(origin+path)).status()).toBe(200)
      await expect(page.locator('main').first()).toBeVisible()
      expect(await page.locator('body').innerText()).not.toContain('Application error')
    }
    for(const file of ['reference.scad','reference-stl.zip','controller.py'])expect((await page.request.get(origin+'/project-lines/space-exploration/assemble-a-rover/hardware/'+file)).status()).toBe(200)
    expect((await page.request.get(origin+'/project-lines/biomedicine/data/esol-classroom.csv')).status()).toBe(200)
    expect((await page.request.get(origin+'/api/health')).status()).toBe(200)
    expect((await page.request.get(origin+'/api/learning/records?library_slug=build-a-candidate-filter&module_id=WORK&activity_id=molecular-workbench&kind=classroom&content_version=1.0')).status()).toBe(401)
  })
  expect(errors).toEqual([])
  await fs.writeFile(out+'/verification.json',JSON.stringify({origin,passed:true,checks,errors,checkedAt:new Date().toISOString(),scope:'浏览器匿名软件验证，未写入生产学生数据；账号隔离沿用已验证的生产学习记录服务。'},null,2))
}catch(error){
  await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{})
  await fs.writeFile(out+'/verification.json',JSON.stringify({origin,passed:false,checks,errors,failure:String(error)},null,2))
  throw error
}finally{await browser.close()}
