import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, expect as baseExpect } from '@playwright/test'
const expect=baseExpect.configure({timeout:20000})
const [origin,phase,build]=process.argv.slice(2)
if(!origin||!['candidate','production'].includes(phase)||!build) throw new Error('Usage: <origin> <candidate|production> <build>')
const out=path.resolve('artifacts/library-learning-path-release-20260929',phase)
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true})
const errors=[],checks=[]
try {
 for(const locale of ['zh','en']) {
  const context=await browser.newContext({viewport:{width:1440,height:1100}})
  await context.addInitScript(locale=>localStorage.setItem('se_locale',locale),locale)
  if(phase==='candidate') await context.route('**/api/**',async route=>{
   if(route.request().method()!=='GET') return route.abort()
   const url=new URL(route.request().url())
   const response=await context.request.get(`https://systeme.xin${url.pathname}${url.search}`)
   return route.fulfill({response})
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`${origin}/library`,{waitUntil:'domcontentloaded'})
  const hero=page.locator('[data-learning-path]')
  await expect(hero).toBeVisible()
  await expect(hero.getByRole('listitem')).toHaveCount(4)
  await expect(hero).toContainText(locale==='zh'?'从 3 分钟开始':'Start with 3 minutes')
  for(const width of [1440,1024,390,320]) {
   await page.setViewportSize({width,height:width<=700?2000:1100})
   if(width>700) await expect.poll(()=>hero.locator('img[src*="space-journey"]').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true)
   if(width>700) await expect.poll(()=>hero.locator('[data-learning-process] img').evaluate(img=>img.complete&&img.naturalWidth===1200)).toBe(true)
   if(width<=700) {
    const background = await hero.getByRole('listitem').first().locator('div[aria-hidden="true"]').first().evaluate(el=>getComputedStyle(el).backgroundImage)
    expect(background).toContain('space-journey-v1-1440.webp')
    const vector = await hero.getByRole('listitem').first().locator('div[aria-hidden="true"]').last().evaluate(el=>getComputedStyle(el).backgroundImage)
    expect(vector).toContain('learning-process-stages-v1.svg')
    await page.evaluate(async bg=>{const img=new Image();img.src=bg.slice(5,-2);await img.decode()},vector)
    await page.evaluate(async background=>{const img=new Image();img.src=background.slice(5,-2);await img.decode()},background)
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
   if(width===1440||width===390) await hero.screenshot({path:path.join(out,`journey-${locale}-${width}.png`)})
   const picture=await hero.locator('img[src*="space-journey"]').evaluate(img=>({src:img.currentSrc,hidden:getComputedStyle(img.parentElement).display==='none'}))
   if(width>700) expect(picture.src).toContain('space-journey-arrows-v3')
   else expect(picture.hidden).toBe(true)
   checks.push({locale,width,noOverflow:true,stages:4,vectorLoaded:true,picture})
  }
  await page.setViewportSize({width:1440,height:1100})
  await page.evaluate(()=>scrollTo(0,0))
  await page.screenshot({path:path.join(out,`library-${locale}.png`)})
  await page.locator('[data-kind-filter="micro"]').click()
  await expect(page.locator('[data-project-card]').first()).toHaveAttribute('data-kind','micro')
  expect(await page.locator('[data-project-card]').evaluateAll(nodes=>nodes.every(n=>n.dataset.kind==='micro'))).toBe(true)
  await page.locator('[data-kind-filter="all"]').click()
  await page.getByRole('searchbox').fill('this-is-not-a-real-project-20260929')
  await expect(page.locator('[data-project-card]')).toHaveCount(0)
  await page.getByRole('searchbox').fill('')
  await expect(page.locator('[data-project-card]').first()).toBeVisible()
  await hero.getByRole('link').click()
  await expect(page).toHaveURL(/\/library\?view=lines$/)
  await expect(page.locator('[data-learning-path]')).toHaveCount(0)
  await expect(page.locator('[data-line-card]')).toHaveCount(5)
  await context.close()
 }
 const loading=await browser.newContext({viewport:{width:1280,height:800}})
 const token=`fixture.${Buffer.from(JSON.stringify({sub:'loading-review'})).toString('base64url')}.not-a-real-token`
 await loading.addInitScript(token=>localStorage.setItem('systemedu_token',token),token)
 let release; const held=new Promise(resolve=>{release=resolve})
 // Intercept every API request in this isolated context. No fixture token or student write reaches production.
 await loading.route('**/api/**',async route=>{
  if(route.request().url().includes('/files/')) {
   await held
   return route.fulfill({status:401,json:{error:'fixture_expired'}})
  }
  const pathname=new URL(route.request().url()).pathname
  return route.fulfill({json:pathname.includes('/auth/')?{user_id:'loading-review',username:'Release QA'}:[]})
 })
 const lesson=await loading.newPage()
 lesson.on('pageerror',e=>errors.push(e.message))
 try {
  await lesson.goto(`${origin}/learn/pvlib-solar-forecast-station/M01`,{waitUntil:'domcontentloaded'})
  const status=lesson.locator('main[role="status"][aria-busy="true"]')
  await expect(status).toContainText('正在载入课程')
  await expect(status.locator('svg[width="64"]')).toBeVisible()
  await expect.poll(()=>status.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBeGreaterThan(0)
  await status.screenshot({path:path.join(out,'course-loading.png')})
  release()
  await expect(lesson).toHaveURL(/\/login\?next=/)
 } finally { release(); await loading.close() }
 expect(errors).toEqual([])
 const report={passed:true,origin,phase,build,loadingIndicator:true,checks,filterAndSearchUnchanged:true,projectLinesLink:true,errors,note:'Public catalog uses real anonymous GET responses (proxied for candidate); only loading test uses isolated intercepted fixtures. No student data writes.'}
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify(report))
} finally { await browser.close() }
