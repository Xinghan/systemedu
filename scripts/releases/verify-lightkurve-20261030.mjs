import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(path.resolve(process.env.SYSTEMEDU_TEST_MODULE_ROOT || '.', 'package.json'))
const { chromium, expect: baseExpect } = require('@playwright/test')
const expect = baseExpect.configure({ timeout: 30000 })
const [origin, phase, build] = process.argv.slice(2)
if (!origin || !['candidate', 'production'].includes(phase) || !build) throw Error('Usage: <origin> <candidate|production> <build>')
const slug = 'lightkurve-transit-detective'
const output = path.resolve(process.env.LIGHTKURVE_RELEASE_OUTPUT || 'artifacts/lightkurve-release-20261030', phase)
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = [], checks = []
const report = { passed: false, origin, phase, build, checks, pageErrors: errors }
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' })
  const projectResponse = await context.request.get(`https://systeme.xin/api/library/projects/${slug}`)
  expect(projectResponse.status()).toBe(200)
  const project = await projectResponse.json()
  expect(project).toMatchObject({ slug, knode_count: 32, version: '0.2.0' })
  const treeResponse = await context.request.get(`https://systeme.xin/api/library/projects/${slug}/tree`)
  expect(treeResponse.status()).toBe(200)
  expect((await treeResponse.json()).modules).toHaveLength(32)
  for (const file of ['manifest.json', 'downloads/lightkurve-practice-kit.zip', 'practice/browser/holdout.json']) {
    expect((await context.request.get(`https://systeme.xin/api/my/projects/${slug}/files/${file}`)).status()).toBe(401)
  }
  // Public checks never send a token or write to production. Only anonymous GETs are forwarded.
  await context.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url())
    expect(req.method()).toBe('GET')
    expect(req.headers().authorization).toBeUndefined()
    await route.fulfill({ response: await context.request.get(`https://systeme.xin${url.pathname}${url.search}`) })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.goto(`${origin}/mission/space?route=transit`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-transit-journey]')).toBeVisible()
    await expect(page.locator('[data-mission-node]')).toHaveCount(6)
    const refs = new Set()
    for (let i = 1; i <= 6; i++) {
      await page.locator(`[data-mission-node="transit-p${i}"]`).click()
      await expect(page.locator(`[data-transit-station="transit-p${i}"]`)).toBeVisible()
      for (const ref of await page.locator('[data-mission-step]').evaluateAll(els => els.map(el => el.getAttribute('data-mission-step')))) refs.add(ref)
    }
    expect(refs.size).toBe(32)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator('[data-mission-node="transit-p1"]').click()
    await page.screenshot({ path: path.join(output, `transit-map-${width}.png`) })
    await page.goto(`${origin}/mission/space/control?task=${encodeURIComponent(`${slug}:M23`)}`, { waitUntil: 'domcontentloaded' })
    const task = page.locator(`[data-task-order="${slug}:M23"]`)
    await expect(task).toBeVisible()
    await expect(task.locator('[data-task-classroom]')).toHaveAttribute('href', `/learn/${slug}/M23?mission=space`)
    await expect(page.locator('[aria-label="任务站选择"] button')).toHaveCount(6)
    if (width === 1440) {
      await page.getByLabel('我的证据摘要').fill('发布验收访客记录：保留首次预测及证据文件，不代表学生成果。')
      for (const checkbox of await task.getByRole('checkbox').all()) await checkbox.check()
      await task.getByRole('button', { name: '标记这一步自检完成', exact: true }).click()
    }
    await expect(page.locator('[data-main-progress]')).toHaveText(/1\s*\/\s*32/)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByLabel('我的证据摘要')).toHaveValue(/发布验收访客记录/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: path.join(output, `transit-control-${width}.png`) })
    await page.getByRole('navigation', { name: '星际远航研究路线' }).getByRole('link', { name: /火星地形/ }).click()
    await expect(page.locator('[data-main-progress]')).toHaveText(/0\s*\/\s*62/)
    await expect(page.locator('[aria-label="任务站选择"] button')).toHaveCount(8)
  }
  await page.goto(`${origin}/learn/${slug}/M24?mission=space`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login\?next=/)
  expect(new URL(page.url()).searchParams.get('next')).toBe(`/learn/${slug}/M24?mission=space`)
  expect((await page.request.get(`${origin}/preview/lightkurve/M01`)).status()).toBe(404)
  if (phase === 'production') {
    const html = await (await page.request.get(`${origin}/mission/space?route=transit`)).text()
    expect(html).toContain(build)
  }
  checks.push('Real public catalog/tree: 32 nodes; protected files require login; login return URL preserved; preview closed.', 'Six stations expose all 32 formal lessons at 1440px and 390px without overflow.', 'Guest task evidence survives reload and route switch; transit 1/32 remains separate from rover 0/62 and eight stations.')
  report.public_passed = true
  report.mobile_verified = true
  await context.close()

  if (phase === 'candidate') {
    const source = path.resolve(process.env.LIGHTKURVE_SOURCE || '../systemeduidea/projects_data/lightkurve-transit-detective')
    const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'))
    const tree = JSON.parse(await fs.readFile(path.join(source, 'tree/knowledge_tree.json'), 'utf8'))
    const token = `fixture.${Buffer.from(JSON.stringify({ sub: 'lightkurve-release-fixture' })).toString('base64url')}.not-a-real-token`
    const fixture = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    await fixture.addInitScript(value => { if (window === window.top) localStorage.setItem('systemedu_token', value) }, token)
    const versions = new Map(), drafts = new Map(), recordRequests = [], denied = [], files = new Set()
    const entries = []
    for (const entry of manifest.knodes) {
      const dir = path.join(source, entry.knode_dir)
      const record = JSON.parse(await fs.readFile(path.join(dir, 'learning-record.json'), 'utf8'))
      const assignment = await fs.readFile(path.join(dir, 'assignment.md'), 'utf8')
      const sections = JSON.parse(await fs.readFile(path.join(dir, 'sections.json'), 'utf8'))
      versions.set(entry.module_id, crypto.createHash('sha256').update(JSON.stringify({ record, assignment })).digest('hex').slice(0, 32))
      entries.push({ ...entry, record, sections })
    }
    drafts.set('M01:lightkurve-notebook:classroom', { body: { answers: [{ question_id: 'q1', question: entries[0].record.questions[0], answer: '既有课堂记录：保留一次独立预测。' }] }, revision: 1, updated_at: new Date().toISOString() })
    // Every API call in this context is intercepted. This verifies browser contracts,
    // not authenticated production persistence; the fake token never leaves the browser.
    await fixture.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()), pathname = decodeURIComponent(url.pathname)
      const json = data => route.fulfill({ status: 200, json: data })
      const relative = pathname.match(new RegExp(`/api/(?:library|my)/projects/${slug}/files/(.+)$`))?.[1]
      if (relative) {
        expect(req.headers().authorization).toBe(`Bearer ${token}`)
        if (relative === 'manifest.json') return json(manifest)
        expect(manifest.files.some(file => file.path === relative)).toBe(true)
        files.add(relative)
        return route.fulfill({ status: 200, contentType: ({ '.json': 'application/json', '.md': 'text/plain', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.zip': 'application/zip', '.mp4': 'video/mp4' })[path.extname(relative)] || 'application/octet-stream', body: await fs.readFile(path.join(source, relative)) })
      }
      if (pathname === `/api/library/projects/${slug}/tree`) return json(tree)
      if (pathname === `/api/library/projects/${slug}`) return json(project)
      if (pathname === '/api/my/projects') return json([{ slug, title: manifest.title, last_module_id: null }])
      if (pathname === '/api/knowledge/drill') return json({ drills: [] })
      if (pathname.includes('/learning/')) {
        const body = req.method() === 'GET' ? Object.fromEntries(url.searchParams) : req.postDataJSON()
        if (body.library_slug === slug) {
          expect(body.content_version).toBe(versions.get(body.module_id))
          recordRequests.push({ module: body.module_id, activity: body.activity_id, version: body.content_version })
        }
        const key = `${body.module_id}:${body.activity_id}:${body.kind}`
        if (req.method() === 'GET') return json({ draft: drafts.get(key) || null, submissions: [] })
        const draft = { body: body.body, revision: (body.expected_revision || 0) + 1, updated_at: new Date().toISOString() }
        drafts.set(key, draft)
        return json({ draft })
      }
      if (pathname.includes('/progress')) return json({ ok: true })
      if (pathname.includes('/complete') || pathname.includes('/knowledge-tree')) return json({ completed_knode_ids: [], lit_nodes: [], subjects_used: [] })
      if (pathname.includes('/auth/')) return json({ user_id: 'lightkurve-release-fixture', username: 'Release QA' })
      denied.push(`${req.method()} ${pathname}`)
      return route.fulfill({ status: 404, json: { error: 'unhandled_fixture' } })
    })
    const lesson = await fixture.newPage()
    lesson.on('pageerror', error => errors.push(error.message))
    for (const entry of entries) {
      console.log('Checking classroom', entry.module_id)
      if (entry === entries[0]) await lesson.goto(`${origin}/learn/${slug}/${entry.module_id}`, { waitUntil: 'domcontentloaded' })
      else await lesson.getByLabel('切换课程节点').selectOption(entry.module_id)
      await expect(lesson.locator('[data-lightkurve-classroom]')).toHaveAttribute('data-lightkurve-classroom', entry.module_id)
      await expect(lesson.getByLabel('切换课程节点').locator('option')).toHaveCount(32)
      await expect(lesson.locator('[data-lightkurve-notebook]')).toBeVisible()
      await expect(lesson.locator('[data-lightkurve-delivery]')).toBeVisible()
      await expect(lesson.locator('[data-lesson-carousel]')).toBeVisible()
      await expect(lesson.getByRole('navigation', { name: '课程内容视图' })).toHaveCount(0)
      await expect(lesson.locator('a[href*="/preview/lightkurve/"]')).toHaveCount(0)
      for (const idea of entry.sections.ideas.filter(i => ['game', 'animation'].includes(i.mode))) await expect(lesson.locator(`[id="idea-${idea.idea_id}"]`)).toHaveCount(1)
    }
    checks.push('32/32 formal lesson routes use the unified classroom, lecture, original notebook, assignment, and inline media; original content versions checked.')
    await lesson.goto(`${origin}/learn/${slug}/M01?view=lab&mode=game`, { waitUntil: 'domcontentloaded' })
    const modal = lesson.getByRole('dialog').filter({ has: lesson.locator('[data-lightkurve-experiment]') })
    await expect(modal).toBeVisible()
    await expect(modal.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-downloads')
    await lesson.evaluate(() => window.postMessage({ type: 'systemedu-lightkurve-artifact', moduleId: 'M01', artifact: { title: 'wrong source', kind: 'experiment' } }, '*'))
    await expect(modal.getByRole('button', { name: '关联到本节作业' })).toBeDisabled()
    let frame = await (await modal.locator('iframe').elementHandle()).contentFrame()
    await frame.locator('#a').evaluate(el => { el.value = '90'; el.dispatchEvent(new Event('input', { bubbles: true })) })
    await frame.locator('#save').click()
    await modal.getByRole('button', { name: '关联到本节作业' }).click()
    await expect.poll(() => drafts.get('M01:lightkurve-delivery:assignment')?.body.artifact?.module_id).toBe('M01')
    await modal.getByRole('button', { name: '关闭互动内容' }).click()
    await expect(lesson.locator('[data-lightkurve-notebook]')).toContainText('既有课堂记录')
    const savedArtifact = JSON.stringify(drafts.get('M01:lightkurve-delivery:assignment').body.artifact)
    await lesson.goto(`${origin}/learn/${slug}/M01`, { waitUntil: 'domcontentloaded' })
    await expect(lesson.locator('[data-lightkurve-delivery]')).toContainText('已关联实验操作产物')
    expect(JSON.stringify(drafts.get('M01:lightkurve-delivery:assignment').body.artifact)).toBe(savedArtifact)
    await lesson.locator('[data-lesson-carousel]').getByRole('button', { name: /下一张/ }).click()
    await expect(lesson.locator('[data-lesson-carousel]')).toContainText('2 / 10')
    await lesson.getByRole('button', { name: '幻灯片', exact: true }).click()
    await expect(lesson.getByRole('dialog').locator('[data-slide-surface] h2')).toBeVisible()
    await lesson.keyboard.press('Escape')
    const downloadPromise = lesson.waitForEvent('download')
    await lesson.getByRole('button', { name: '下载 lightkurve 实践包 ↓' }).click()
    const download = await downloadPromise
    report.download_sha256 = crypto.createHash('sha256').update(await fs.readFile(await download.path())).digest('hex')
    expect(report.download_sha256).toBe(manifest.files.find(f => f.path === 'downloads/lightkurve-practice-kit.zip').sha256)
    checks.push('M01 original notebook restored; experiment artifact saved/reloaded; wrong-window message rejected; shared inline/floating lecture works; authenticated download matches source SHA-256.')
    await lesson.goto(`${origin}/learn/${slug}/M24?view=lab&mode=game`, { waitUntil: 'domcontentloaded' })
    await expect(modal).toBeVisible()
    frame = await (await modal.locator('iframe').elementHandle()).contentFrame()
    await frame.locator('#a').evaluate(el => { el.value = '1.1'; el.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(files.has('practice/browser/holdout.json')).toBe(false)
    await frame.locator('#freeze').click()
    await expect.poll(() => drafts.get('M24:lightkurve-notebook:classroom')?.body.artifact?.data.freeze?.period).toBe(1.1)
    await lesson.goto(`${origin}/learn/${slug}/M25?view=lab&mode=game`, { waitUntil: 'domcontentloaded' })
    await expect(modal).toBeVisible()
    frame = await (await modal.locator('iframe').elementHandle()).contentFrame()
    await expect(frame.locator('#a')).toHaveValue('1.1')
    await expect(frame.locator('#a')).toBeDisabled()
    await frame.locator('#reveal').click()
    await expect.poll(() => !!drafts.get('M25:lightkurve-notebook:classroom')?.body.artifact?.data.firstResult).toBe(true)
    await modal.getByRole('button', { name: '关联到本节作业' }).click()
    await expect.poll(() => !!drafts.get('M25:lightkurve-delivery:assignment')?.body.artifact).toBe(true)
    const firstResult = JSON.stringify(drafts.get('M25:lightkurve-notebook:classroom').body.artifact.data.firstResult)
    await lesson.reload({ waitUntil: 'domcontentloaded' })
    await expect(modal).toBeVisible()
    frame = await (await modal.locator('iframe').elementHandle()).contentFrame()
    await expect(frame.locator('#reveal')).toBeDisabled()
    expect(JSON.stringify(drafts.get('M25:lightkurve-notebook:classroom').body.artifact.data.firstResult)).toBe(firstResult)
    checks.push('M24 freeze persisted before Q4 request; M25 restored immutable period; first result and delivery retained after reload.')
    await lesson.setViewportSize({ width: 390, height: 844 })
    await lesson.goto(`${origin}/learn/${slug}/M01`, { waitUntil: 'domcontentloaded' })
    await expect(lesson.locator('[data-lightkurve-notebook]')).toBeVisible()
    expect(await lesson.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await lesson.screenshot({ path: path.join(output, 'classroom-390.png') })
    expect(denied).toEqual([])
    report.classroom_fixture_passed = true
    report.modules = entries.length
    report.record_scopes_checked = recordRequests.length
    report.unhandled_fixture_requests = denied
    checks.push('Formal classroom renders at 390px without horizontal overflow. Authenticated browser API is a reviewed file fixture; no real student persistence claim.')
    await fixture.close()
  }
  expect(errors).toEqual([])
  report.passed = true
} finally {
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
