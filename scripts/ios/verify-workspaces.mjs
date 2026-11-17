import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const catalog=JSON.parse(await readFile('packages/learning-runtime/dist/content/catalog.json'))
const cases=[]
for(const course of catalog.courses) {
 for(const node of [course.modules[0], ...(course.kind==='guided' ? [course.modules.at(-1)] : [])]) {
  const lesson=JSON.parse(await readFile('packages/learning-runtime/dist'+node.path))
  for(const lab of lesson.interactions) if(lab.path?.startsWith('/embedded')) cases.push({course:course.id,node:node.moduleId,path:lab.path})
 }
}
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const report=[]
try {
 let cursor=0
 await Promise.all(Array.from({length:3},async()=>{
  const context=await browser.newContext({viewport:{width:390,height:700}}),page=await context.newPage()
  while(cursor<cases.length) {
   const item=cases[cursor++],errors=[];const listener=e=>errors.push(e.message);page.on('pageerror',listener)
   await page.goto('http://127.0.0.1:4181'+item.path+'#'+encodeURIComponent(JSON.stringify({channel:'test',storage:{}})))
   await page.waitForTimeout(700)
   if(!await page.locator('#root').innerText()) errors.push('Empty workspace')
   report.push({...item,errors});page.off('pageerror',listener)
  }
  await context.close()
 }))
 await writeFile('packages/ios-app/build/content-check/workspaces.json',JSON.stringify(report,null,2))
 const failures=report.filter(r=>r.errors.length);console.log(JSON.stringify({checked:report.length,failures},null,2));assert.equal(failures.length,0)
} finally {await browser.close()}
