import fs from 'node:fs/promises'
import path from 'node:path'
import {chromium,expect as baseExpect} from '@playwright/test'
const expect=baseExpect.configure({timeout:30000})
const out=path.resolve('artifacts/future-person-20260930')
const browser=await chromium.launch({headless:true}),checks=[],errors=[]
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:1440,height:1100}})
  await context.addInitScript(locale=>localStorage.setItem('se_locale',locale),locale)
  await context.route('**/api/**',route=>route.fulfill({json:[]}))
  await context.route('**/preview/pvlib/catalog',route=>route.fulfill({json:null}))
  const page=await context.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('http://localhost:4000/library?view=futures&role=molecular-discovery',{waitUntil:'domcontentloaded'})
  const detail=page.locator('[data-future-detail="molecular-discovery"]'),img=detail.locator('img')
  await expect(detail).toBeVisible()
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:2000})
   await expect(img).toHaveAttribute('src','/library/futures/molecular-creator-v1-800.webp')
   await expect.poll(()=>img.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true)
   const resource=await img.evaluate(i=>({src:i.currentSrc,naturalWidth:i.naturalWidth,visibleWidth:i.getBoundingClientRect().width}))
   expect(resource.src).toContain('molecular-creator-v1-')
   await expect(detail.locator('figcaption')).toContainText(locale==='zh'?'职业场景示意':'imagined career scene')
   await expect(detail.locator('[data-future-start]')).toHaveAttribute('href','/explore/biomedicine/turn-a-molecule')
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
   await page.evaluate(()=>scrollTo(0,0))
   if(width!==320)await detail.screenshot({path:path.join(out,`person-${locale}-${width}.png`)})
   checks.push({locale,width,resource,noOverflow:true})
  }
  await page.locator('[data-future-role="robotics"]').click()
  const original=page.locator('[data-future-detail="robotics"] img')
  await expect(original).toBeVisible()
  await expect.poll(()=>original.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true)
  expect(await original.getAttribute('src')).not.toContain('molecular-creator')
  await context.close()
 }
 expect(errors).toEqual([])
 const report={passed:true,checks,pageErrors:errors,firstProjectUnchanged:true,otherRoleCoverUnchanged:true,note:'Local UI and image checks with API fixtures. Fictional creator scene; no identity or career outcome claims.'}
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify(report))
}finally{await browser.close()}
