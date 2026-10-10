import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { chromium, expect as baseExpect } from '@playwright/test'
const expect=baseExpect.configure({timeout:30000}),out=path.dirname(new URL(import.meta.url).pathname)
const dataDir='packages/student-web/src/lib/project-lines/'
const taxonomy=JSON.parse(await fs.readFile(dataDir+'project-taxonomy.json','utf8'))
const lines=JSON.parse(await fs.readFile(dataDir+'taxonomy-lines.json','utf8'))
const snapshots=JSON.parse(await fs.readFile(dataDir+'course-snapshots.json','utf8'))
const complete=['lightkurve-transit-detective','teachopencadd-candidate-research','pvlib-solar-forecast-station']
const projects=[...snapshots.map(p=>({...p,status:'published'})),...complete.map(slug=>({slug,title:slug,status:'published',domain:'Other'}))]
assert.equal(lines.length,7);assert.equal(Object.keys(taxonomy).length,49)
const fields=new Set(lines.map(l=>l.fieldId))
for(const [id,a] of Object.entries(taxonomy)){
 assert(fields.has(a.primary),id);assert.equal(new Set([a.primary,...a.related]).size,1+a.related.length,id)
 assert(a.related.every(f=>fields.has(f)),id)
}
for(const p of projects)assert.equal(lines.filter(l=>l.courseSlugs.includes(p.slug)).length,1,p.slug)
const roles=[['robotics','robotics','/explore/neuro-bionics/grasp-a-virtual-block'],['space','space-exploration','/explore/space-exploration/drive-and-frame'],['molecular-discovery','biomedicine','/explore/biomedicine/turn-a-molecule'],['clean-energy','energy-motion','/explore/energy-motion/catch-a-sunbeam'],['earth-research','earth-discovery','/explore/earth-discovery/spot-a-landscape-change'],['computing-ai','computing-ai','/explore/biomedicine/sort-molecule-cards'],['brain-science','neuro-bionics','/explore/neuro-bionics/open-a-signal-gate']]
const browser=await chromium.launch({headless:true}),checks=[],errors=[]
try{
 for(const locale of ['zh','en']){
  const context=await browser.newContext({viewport:{width:1440,height:2200}})
  await context.addInitScript(v=>localStorage.setItem('se_locale',v),locale)
  await context.route('**/api/**',route=>route.fulfill({json:route.request().url().endsWith('/library/projects')?projects:[]}))
  await context.route('**/preview/pvlib/catalog',route=>route.fulfill({json:null}))
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://localhost:4000/library?view=futures',{waitUntil:'domcontentloaded'})
  await expect(page.locator('[data-future-role]')).toHaveCount(7)
  for(const [role,line,firstHref] of roles){
   await page.locator(`[data-future-role="${role}"]`).click()
   const detail=page.locator(`[data-future-detail="${role}"]`)
   await expect(detail).toBeVisible();await expect(detail.locator('[data-future-start]')).toHaveAttribute('href',firstHref)
   await expect(detail.locator('[data-career-branch]')).toHaveCount(2)
   await expect.poll(()=>detail.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true)
   if(role==='computing-ai'){
    const planned=detail.locator('[data-career-branch="domain-llm-finetune"]');await expect(planned.locator('a')).toHaveCount(0)
    await expect(planned).toContainText(locale==='zh'?'课程待生成':'Course not yet created')
   }
   for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:2400});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    if(locale==='zh'&&['brain-science','computing-ai'].includes(role)&&width!==320){await page.evaluate(()=>scrollTo(0,0));await detail.screenshot({path:path.join(out,`${role}-${width}.png`)})}
   }
   await page.setViewportSize({width:1440,height:2200});checks.push({locale,role,line,firstHref,branches:2})
  }
  await page.goto('http://localhost:4000/library?view=lines',{waitUntil:'domcontentloaded'})
  await expect(page.locator('[data-line-card]')).toHaveCount(7)
  for(const line of lines){
   await expect(page.locator(`[data-line-card="${line.id}"]`)).toContainText(line.title[locale])
   await expect.poll(()=>page.locator(`[data-line-card="${line.id}"] img`).evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true)
  }
  if(locale==='zh')await page.screenshot({path:path.join(out,'seven-lines-desktop.png'),fullPage:true})
  for(const line of lines){
   await page.goto(`http://localhost:4000/library?view=lines&line=${line.id}`,{waitUntil:'domcontentloaded'})
   await expect(page.locator('[data-line-detail]')).toHaveAttribute('data-line-detail',line.id)
   const cards=page.locator('[data-project-card]');await expect.poll(()=>cards.count()).toBeGreaterThan(0)
   const ids=await cards.evaluateAll(els=>els.map(e=>e.dataset.projectCard))
   expect(new Set(ids).size).toBe(ids.length)
   for(const id of ids){const a=taxonomy[id];expect([a.primary,...a.related]).toContain(line.fieldId)}
   if(line.id==='neuro-bionics'){
    expect(ids).toContain('eeg-minecraft-bci');expect(ids).toContain('emg-prosthetic-hand');expect(ids).not.toContain('aloha-bimanual-apprentice')
    if(locale==='zh')await page.screenshot({path:path.join(out,'brain-line.png'),fullPage:true})
   }
   if(line.id==='robotics'){
    expect(ids).toContain('aloha-bimanual-apprentice');expect(ids).not.toContain('eeg-minecraft-bci')
    await expect(page.locator('[data-project-card="emg-prosthetic-hand"]')).toHaveAttribute('data-line','neuro-bionics')
   }
   await page.setViewportSize({width:390,height:1700});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
   await page.setViewportSize({width:1440,height:2200});checks.push({locale,line:line.id,count:ids.length,unique:true})
  }
  await page.goto('http://localhost:4000/library',{waitUntil:'domcontentloaded'})
  await expect(page.locator('[data-project-card]')).toHaveCount(49)
  const allIds=await page.locator('[data-project-card]').evaluateAll(els=>els.map(e=>e.dataset.projectCard));expect(new Set(allIds).size).toBe(49)
  const field=page.getByRole('combobox',{name:locale==='zh'?'领域':'Field',exact:true})
  await expect(field.locator('option')).toHaveCount(8)
  for(const line of lines){
   await field.selectOption(line.fieldId)
   const ids=await page.locator('[data-project-card]').evaluateAll(els=>els.map(e=>e.dataset.projectCard))
   const expected=Object.entries(taxonomy).filter(([,a])=>[a.primary,...a.related].includes(line.fieldId)).map(([id])=>id).sort()
   expect(ids.sort()).toEqual(expected)
  }
  await field.selectOption('all')
  const search=page.getByRole('searchbox');await search.fill(locale==='zh'?'超能机械师':'Bionic Inventors')
  expect(await page.locator('[data-project-card]').count()).toBeGreaterThan(0)
  await search.fill('')
  await expect(page.locator('[data-project-card="eeg-minecraft-bci"]')).toHaveAttribute('data-line','neuro-bionics')
  await expect(page.locator('[data-project-card="ai-ant-ethologist"]')).toHaveAttribute('data-line','earth-discovery')
  await expect(page.locator('[data-project-card="label-the-terrain"]')).toHaveAttribute('data-line','computing-ai')
  await context.close()
 }
 // Existing classroom URLs still render and return to the new primary line.
 const c=await browser.newContext()
 await c.addInitScript(()=>localStorage.setItem('se_locale','zh'))
 await c.route('**/api/**',r=>{
  const url=new URL(r.request().url())
  if(url.pathname.endsWith('/platform/knowledge-tree'))return r.fulfill({json:{schema_version:'1',subjects:[]}})
  if(url.pathname.endsWith('/knowledge-tree'))return r.fulfill({json:{slug:url.pathname.split('/').at(-2),lit_nodes:[],subjects_used:[],missing_concepts:[]}})
  if(url.pathname.endsWith('/blueprint'))return r.fulfill({json:{content:'',lang_returned:'zh-CN'}})
  return r.fulfill({json:[]})
 })
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message))
 for(const [url,line,title] of [['/explore/neuro-bionics/grasp-a-virtual-block','robotics','机器人觉醒'],['/explore/neuro-bionics/open-a-signal-gate','neuro-bionics','大脑解码'],['/explore/space-exploration/label-the-terrain','computing-ai','智能造物'],['/explore/neuro-bionics/write-a-grasp-rule','robotics','机器人觉醒']]){
  await p.goto('http://localhost:4000'+url,{waitUntil:'domcontentloaded'});await expect(p.getByRole('link',{name:new RegExp(title)}).first()).toHaveAttribute('href',`/library?view=lines&line=${line}`);checks.push({legacyUrl:url,backLink:line})
 }
 for(const [slug,field] of [['eeg-minecraft-bci','脑科学'],['ai-ant-ethologist','环境']]){
  await c.route(`**/api/library/projects/${slug}`,r=>r.fulfill({json:projects.find(v=>v.slug===slug)}))
  await p.goto(`http://localhost:4000/library/${slug}`,{waitUntil:'domcontentloaded'})
  await expect(p.getByText(field,{exact:true})).toBeVisible();checks.push({detailSlug:slug,field})
 }
 await c.close()
 const failure=await browser.newContext();await failure.route('**/api/**',r=>r.fulfill({status:503,json:{error:'fixture'}}));await failure.route('**/preview/pvlib/catalog',r=>r.fulfill({json:null}));const f=await failure.newPage()
 await f.goto('http://localhost:4000/library?view=futures&role=brain-science',{waitUntil:'domcontentloaded'})
 await expect(f.locator('[data-future-start]')).toHaveAttribute('href','/explore/neuro-bionics/open-a-signal-gate')
 await expect(f.locator('[data-career-branch="eeg-minecraft-bci"] a')).toHaveCount(0)
 await failure.close();expect(errors).toEqual([])
 const report={passed:true,classificationCount:49,fullCourseCount:12,fields:7,careerBranches:14,checks,pageErrors:errors,notes:'Catalog fixtures exercise published courses and service failure separately. Courses and progress IDs are unchanged. No student records submitted.'}
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,fields:7,careerBranches:14}))
}finally{await browser.close()}
