import { chromium } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const catalog=JSON.parse(await readFile('packages/learning-runtime/dist/content/catalog.json'))
const directory='packages/ios-app/build/content-check';await mkdir(directory,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const report=[]
try {
 const context=await browser.newContext({viewport:{width:390,height:704}}),page=await context.newPage()
 for(const id of ['lightkurve-transit-detective','mars-analog-rover','pvlib-solar-forecast-station','llm-post-training-professional','build-a-solar-tracker','grasp-a-virtual-block','transformer-lab']) {
  const course=catalog.courses.find(c=>c.id===id),node=course.modules[0],errors=[]
  const listener=error=>errors.push(error.message);page.on('pageerror',listener)
  await page.goto(`http://127.0.0.1:4181/?activity=${encodeURIComponent(node.id)}`)
  await page.locator('.reading-card').waitFor()
  const size=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}))
  assert.ok(size.w<=391 && size.h<=705,JSON.stringify(size))
  await page.getByRole('button',{name:'练习与笔记',exact:true}).click()
  await page.locator('#course-note').fill('iOS 全课程恢复测试 '+id)
  await page.getByRole('button',{name:'关闭面板'}).click()
  await page.getByRole('status').filter({hasText:'已保存到本机'}).waitFor()
  await page.reload();await page.getByRole('button',{name:'练习与笔记',exact:true}).click()
  assert.equal(await page.locator('#course-note').inputValue(),'iOS 全课程恢复测试 '+id)
  await page.getByRole('button',{name:'关闭面板'}).click()
  await page.getByRole('button',{name:'资料与实践',exact:true}).click()
  const labs=page.getByRole('dialog').locator('.content-entry')
  if(await labs.count()) {
   await labs.last().click();const iframe=page.locator('iframe').first()
   if(await iframe.count()) {
    await iframe.waitFor();await page.waitForTimeout(1800)
    const frame=page.frames().find(f=>f!==page.mainFrame()&&f.url().includes('#'))
    if(frame) {
     await frame.evaluate(()=>localStorage.setItem('ios-roundtrip','retained'))
     await page.getByRole('status').filter({hasText:'已保存到本机'}).waitFor()
     await page.getByRole('button',{name:'关闭面板'}).click()
     await page.getByRole('button',{name:'资料与实践',exact:true}).click();await page.getByRole('dialog').locator('.content-entry').last().click();await page.waitForTimeout(1000)
     const reopened=page.frames().find(f=>f!==page.mainFrame()&&f.url().includes('#'))
     assert.equal(await reopened.evaluate(()=>localStorage.getItem('ios-roundtrip')),'retained')
    }
   }
  }
  await page.screenshot({path:`${directory}/${id}.png`})
  report.push({id,errors});page.off('pageerror',listener)
 }
 await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2))
 console.log(JSON.stringify(report,null,2))
 assert.equal(report.reduce((n,r)=>n+r.errors.length,0),0)
} finally {await browser.close()}
