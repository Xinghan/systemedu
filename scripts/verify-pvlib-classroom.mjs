import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium, expect as baseExpect } from '@playwright/test'

const expect = baseExpect.configure({ timeout: 30000 })

const origin = process.env.PVLIB_ORIGIN || 'http://127.0.0.1:4000'
const source = path.resolve(process.env.PVLIB_SOURCE || '../systemeduidea/projects_data/pvlib-solar-forecast-station')
const output = path.resolve(process.env.PVLIB_OUTPUT || 'artifacts/pvlib-classroom-repair')
const canonicalOnly = process.env.PVLIB_CANONICAL_ONLY === '1'
await fs.mkdir(output, { recursive: true })
const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'))
const tree = JSON.parse(await fs.readFile(path.join(source, 'tree/knowledge_tree.json'), 'utf8'))
const slug = manifest.slug
const project = { slug, title: manifest.title, title_zh: manifest.title_zh, ...manifest.frontmatter, status: 'published', version: manifest.version, knode_count: 58, cover_image_path: manifest.cover_image_path, tags: manifest.tags, knowledge_tree: tree, final_outcomes: tree.final_outcomes }
const token = `fixture.${Buffer.from(JSON.stringify({ sub: 'pvlib-deployment-fixture' })).toString('base64url')}.not-a-real-token`
const browser = await chromium.launch({ headless: true })
const checks = [], errors = [], recordRequests = [], denied = []
const contentTypes = { '.json': 'application/json', '.md': 'text/plain', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.zip': 'application/zip', '.mp4': 'video/mp4' }
const versions = new Map()
const drafts = new Map()
const reviewedModules = process.env.PVLIB_NODES?.split(',')
try {
  const anonymous = await browser.newPage()
  await anonymous.goto(`${origin}/learn/${slug}/M01`, { waitUntil: "domcontentloaded" })
  await expect(anonymous).toHaveURL(/\/login\?next=/)
  checks.push('Anonymous canonical lesson entry redirects to normal login.')
  await anonymous.close()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(value => { if (window === window.top) localStorage.setItem('systemedu_token', value) }, token)
  // All API traffic is fulfilled from this reviewed course fixture. The fake
  // token never reaches a backend; this does not claim production account QA.
  await context.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), pathname = decodeURIComponent(url.pathname)
    const json = data => route.fulfill({ status: 200, json: data })
    const relative = pathname.match(new RegExp(`/api/(?:library|my)/projects/${slug}/files/(.+)$`))?.[1]
    if (relative) {
      expect(req.headers().authorization).toMatch(/^Bearer fixture\..+\.not-a-real-token$/)
      if (relative === 'manifest.json') return json(manifest)
      if (!manifest.files.some(file => file.path === relative)) return route.fulfill({ status: 404 })
      return route.fulfill({ status: 200, contentType: contentTypes[path.extname(relative)] || 'application/octet-stream', body: await fs.readFile(path.join(source, relative)) })
    }
    if (pathname === '/api/library/projects') return json([project])
    if (pathname === `/api/library/projects/${slug}`) return json(project)
    if (pathname === `/api/library/projects/${slug}/cover`) return route.fulfill({ contentType: 'image/png', body: await fs.readFile(path.join(source, manifest.cover_image_path)) })
    if (pathname === `/api/library/projects/${slug}/tree`) return json(tree)
    if (pathname.endsWith('/blueprint')) return json({ content: await fs.readFile(path.join(source, 'blueprint/README.zh.md'), 'utf8'), lang_returned: 'zh-CN' })
    if (pathname === '/api/my/projects') return json([{ slug, title: manifest.title, last_module_id: null }])
    if (pathname === '/api/knowledge/drill') return json({drills:[]})
    if (pathname.includes('/learning/')) {
      const body = req.method() === 'GET' ? Object.fromEntries(url.searchParams) : req.postDataJSON()
      if (body.library_slug) {
        recordRequests.push({ kind: body.kind, module: body.module_id, version: body.content_version })
        if (body.library_slug === slug && versions.has(body.module_id)) expect(body.content_version).toBe(versions.get(body.module_id))
      }
      const key = `${body.module_id}:${body.activity_id}:${body.kind}`
      if (req.method() === 'GET') return json({ draft: req.headers().authorization === `Bearer ${token}` ? drafts.get(key) || null : null, submissions: [] })
      const draft = { body: body.body, revision: body.expected_revision + 1, updated_at: new Date().toISOString() }
      drafts.set(key, draft)
      return json({ draft })
    }
    if (pathname.includes('/progress')) return json({ ok: true })
    if (pathname.includes('/complete') || pathname.includes('/knowledge-tree')) return json({ completed_knode_ids: [], lit_nodes: [], subjects_used: [] })
    if (pathname.includes('/auth/')) return json({ user_id: 'pvlib-deployment-fixture', username: 'Release QA' })
    denied.push(`${req.method()} ${pathname}`)
    return route.fulfill({ status: 404, json: { error: 'unhandled_fixture' } })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  const entries = []
  for (const entry of manifest.knodes) {
    const dir = path.join(source, entry.knode_dir)
    const [rawSlides, sections, rawTheories, plan, assignment, record] = await Promise.all(['slides.json','sections.json','theories.json','lesson.md','assignment.md','learning-record.json'].map(async name => {
      const value = await fs.readFile(path.join(dir, name), 'utf8'); return name.endsWith('.json') ? JSON.parse(value) : value
    }))
    versions.set(entry.module_id, crypto.createHash('sha256').update(JSON.stringify({ record, assignment, plan, rawSlides, rawTheories, sections })).digest('hex').slice(0,32))
    entries.push({ ...entry, record, sections })
  }
  drafts.set('M08:pvlib-notebook:classroom', { body: { answers: [{question_id:'q1',question:entries[7].record.questions[0],answer:'修复前保存的课堂记录'}] }, revision:1, updated_at:new Date().toISOString() })
  const tested = entries.filter(entry => !reviewedModules || reviewedModules.includes(entry.module_id))
  for (const entry of tested) {
    console.log('Checking classroom',entry.module_id)
    if (entry === tested[0]) await page.goto(`${origin}/learn/${slug}/${entry.module_id}`, {waitUntil:'domcontentloaded'})
    else await page.getByLabel('切换课程节点').selectOption(entry.module_id)
    await expect(page.locator('[data-pvlib-classroom]')).toBeVisible()
    await expect(page.locator('h1').first()).toContainText(entry.title)
    await expect(page.getByLabel('切换课程节点')).toHaveValue(entry.module_id)
    await expect(page.getByLabel('切换课程节点').locator('option')).toHaveCount(58)
    await expect(page.getByRole('navigation',{name:'课程内容视图'})).toHaveCount(0)
    await expect(page.locator('[data-pvlib-notebook]')).toBeVisible()
    await expect(page.locator('[data-pvlib-delivery]')).toBeVisible()
    await expect(page.locator('[data-lesson-carousel]')).toBeVisible()
    await expect(page.locator('a[href*="/preview/pvlib/"]')).toHaveCount(0)
    await expect(page.locator('a[href="#course-downloads"]')).not.toHaveCount(0)
    for(const idea of entry.sections.ideas.filter(i=>['game','animation'].includes(i.mode))) await expect(page.locator(`[id="idea-${idea.idea_id}"]`)).toHaveCount(1)
    if(['M01','M08','M58'].includes(entry.module_id)) await page.screenshot({path:path.join(output,`${entry.module_id}-classroom.png`)})
  }
  checks.push(`${tested.length} lessons navigate through the course directory and use shared classroom, lecture carousel, inline media, notebook and assignment; no media tabs or preview download URLs.`)
  await page.goto(`${origin}/learn/${slug}/M08?view=lab&mode=game`,{waitUntil:'domcontentloaded'})
  const modal=page.getByRole('dialog').filter({has:page.locator('[data-pvlib-experiment]')})
  await expect(modal).toBeVisible()
  const experiment=modal.locator('iframe')
  await expect(experiment).toHaveAttribute('sandbox','allow-scripts allow-downloads')
  const ideaId=await modal.locator('[data-pvlib-experiment]').getAttribute('data-pvlib-experiment')
  const payload={kind:'format-repair-test',title:'课堂实验回归记录',runs:[{voltage:5,current:0.2}]}
  await page.evaluate(payload=>window.postMessage({type:'systemedu-pvlib-artifact',moduleId:'M08',artifact:payload},'*'),payload)
  await expect(modal.getByRole('button',{name:'关联到本节作业'})).toBeDisabled()
  const frame=await (await experiment.elementHandle()).contentFrame()
  await frame.evaluate(payload=>parent.postMessage({type:'systemedu-pvlib-artifact',moduleId:'M08',artifact:payload},'*'),payload)
  await expect(modal.getByRole('button',{name:'关联到本节作业'})).toBeEnabled()
  await modal.getByRole('button',{name:'关联到本节作业'}).click()
  await expect.poll(()=>drafts.get('M08:pvlib-delivery:assignment')?.body.artifact?.payload.title).toBe(payload.title)
  await page.screenshot({path:path.join(output,'M08-inline-game.png')})
  await modal.getByRole('button',{name:'关闭互动内容'}).click()
  await expect(page.locator('[data-pvlib-delivery]')).toContainText('已关联实验操作产物')
  await expect(page.locator('[data-pvlib-notebook]')).toContainText('修复前保存的课堂记录')
  // Capture the actual restore handshake before the new iframe scripts run.
  await page.addInitScript(()=>{if(window!==window.top)addEventListener('message',e=>{if(e.data?.type==='systemedu-pvlib-artifact-restore')window.__restore=e.data})})
  await page.reload({waitUntil:'domcontentloaded'})
  await expect(modal).toBeVisible()
  const restoredFrame=await (await modal.locator('iframe').elementHandle()).contentFrame()
  await restoredFrame.evaluate(ideaId=>parent.postMessage({type:'systemedu-pvlib-artifact-ready',module_id:'M08',idea_id:ideaId},'*'),ideaId)
  await expect.poll(()=>restoredFrame.evaluate(()=>window.__restore?.artifact?.title)).toBe(payload.title)
  await modal.getByRole('button',{name:'关闭互动内容'}).click()
  await page.locator(`[id="idea-${ideaId}"]`).click()
  await expect(modal).toBeVisible()
  await modal.getByRole('button',{name:'关闭互动内容'}).click()
  checks.push('Unchanged record versions and prior notebook restored; inline iframe artifact saves and restores; wrong-window messages rejected; same card reopens.')
  await page.goto(`${origin}/learn/${slug}/M10?view=lab&mode=object`,{waitUntil:'domcontentloaded'})
  await expect(page.locator('[data-pvlib-experiment="M10-hardware-object"] iframe')).toBeVisible()
  await expect(page.getByRole('button',{name:'关联到本节作业'})).toHaveCount(0)
  await page.getByRole('button',{name:'关闭互动内容'}).click()
  checks.push('Hardware 3D legacy URL opens the classroom modal without game-artifact submission.')
  await page.goto(`${origin}/learn/${slug}/M48?view=lab&mode=animation`,{waitUntil:'domcontentloaded'})
  await expect(page.locator('[data-pvlib-experiment] iframe')).toBeVisible()
  await page.screenshot({path:path.join(output,'M48-inline-animation.png')})
  await page.getByRole('button',{name:'关闭互动内容'}).click()
  await page.goto(`${origin}/learn/${slug}/M01?view=slides`,{waitUntil:'domcontentloaded'})
  await expect(page.locator('[data-lesson-carousel]')).toBeVisible()
  await page.locator('[data-lesson-carousel]').getByRole('button',{name:/下一张/}).click()
  await expect(page.locator('[data-lesson-carousel]')).toContainText('2 / 10')
  await page.getByRole('button',{name:'幻灯片',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // The fitted sheet stays hidden until ResizeObserver completes layout.
  await expect(page.getByRole('dialog').locator('[data-slide-surface] h2')).toBeVisible()
  await expect(page.getByRole('dialog').locator('[data-slide-surface] h2')).not.toHaveText('')
  await page.screenshot({path:path.join(output,'M01-shared-slideshow.png')})
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-pvlib-notebook]')).toBeVisible()
  await page.locator('a[href="#course-downloads"]').first().click()
  const downloadPromise=page.waitForEvent('download')
  await page.getByRole('button',{name:'下载 pvlib 实践包 ↓'}).click()
  const download=await downloadPromise
  expect(crypto.createHash('sha256').update(await fs.readFile(await download.path())).digest('hex')).toBe(manifest.files.find(f=>f.path==='downloads/pvlib-practice-kit.zip').sha256)
  checks.push('Shared lecture player and floating slides work; body link leads to authenticated ZIP, matching reviewed hash.')
  await page.setViewportSize({width:390,height:844})
  await page.goto(`${origin}/learn/${slug}/M01`,{waitUntil:'domcontentloaded'})
  await expect(page.locator('[data-pvlib-notebook]')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:path.join(output,'M01-mobile.png')})
  checks.push('390px mobile has no horizontal overflow.')
  await page.setViewportSize({width:1440,height:1000})
  await page.goto(`${origin}/${canonicalOnly ? `learn/${slug}` : 'preview/pvlib'}/M08`,{waitUntil:'domcontentloaded'})
  await expect(page.locator('[data-pvlib-classroom]')).toBeVisible()
  await expect(page.getByRole('navigation',{name:'课程内容视图'})).toHaveCount(0)
  await expect(page.locator('[data-pvlib-notebook]')).toContainText('修复前保存的课堂记录')
  const otherToken=`fixture.${Buffer.from(JSON.stringify({sub:'another-fixture-account'})).toString('base64url')}.not-a-real-token`
  await page.evaluate(value=>{localStorage.setItem('systemedu_token',value);window.dispatchEvent(new Event('focus'))},otherToken)
  await expect(page.locator('[data-pvlib-notebook]')).not.toContainText('修复前保存的课堂记录')
  await expect(page.locator('[data-pvlib-delivery]')).not.toContainText('课堂实验回归记录')
  checks.push(`${canonicalOnly ? 'Canonical classroom' : 'Local preview'}: switching account removes prior account notebook and artifacts.`)

  if (!canonicalOnly) {
  await page.goto(`${origin}/preview/lightkurve/M15`,{waitUntil:'domcontentloaded'})
  const otherCard=page.locator('[id^="idea-"] [role="button"][aria-haspopup="dialog"]').first()
  await expect(otherCard).toBeVisible()
  await otherCard.focus()
  await page.keyboard.press('Enter')
  const otherDialog=page.getByRole('dialog').filter({has:page.locator('iframe')})
  await expect(otherDialog).toBeVisible()
  await expect(otherDialog.locator('iframe')).toHaveAttribute('sandbox','allow-scripts allow-same-origin')
  await expect(otherDialog.locator('[data-pvlib-experiment]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(otherDialog).toHaveCount(0)
  checks.push('Shared reader regression: another course opens media by keyboard using its original iframe, no pvlib persistence adapter.')
  }
  expect(errors).toEqual([])
  expect([...new Set(denied)]).toEqual([])
  const report={passed:true,origin,build:process.env.PVLIB_BUILD || null,modules:tested.map(e=>e.module_id),checks,pageErrors:errors,recordScopesChecked:recordRequests.length,unhandledFixtureRequests:[...new Set(denied)],note:canonicalOnly ? 'Deployed frontend bytes with authored course fixtures and intercepted API. Tests browser save/restore contracts without real account or backend writes. Public access and server integrity are verified separately.' : 'Local app with authored files and intercepted API fixtures. No real account/API writes; not production deployment QA.'}
  await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
} finally { await browser.close() }
