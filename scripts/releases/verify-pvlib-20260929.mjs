import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium, expect } from '@playwright/test'

const origin = process.env.PVLIB_ORIGIN || 'http://127.0.0.1:14888'
const source = path.resolve('../systemeduidea/projects_data/pvlib-solar-forecast-station')
const output = path.resolve('artifacts/pvlib-release-20260929/candidate')
await fs.mkdir(output, { recursive: true })
const manifest = JSON.parse(await fs.readFile('/private/tmp/pvlib-release-20260929/manifest.json', 'utf8'))
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
      expect(req.headers().authorization).toBe(`Bearer ${token}`)
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
    if (pathname.includes('/learning/')) {
      const body = req.method() === 'GET' ? Object.fromEntries(url.searchParams) : req.postDataJSON()
      if (body.library_slug) {
        recordRequests.push({ kind: body.kind, module: body.module_id, version: body.content_version })
        if (versions.has(body.module_id)) expect(body.content_version).toBe(versions.get(body.module_id))
      }
      const key = `${body.module_id}:${body.activity_id}:${body.kind}`
      if (req.method() === 'GET') return json({ draft: drafts.get(key) || null, submissions: [] })
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
  await page.goto(`${origin}/library?view=lines&line=energy-motion`, { waitUntil: "domcontentloaded" })
  const card = page.locator(`[data-line-stage="5"] [data-project-card="${slug}"]`)
  await expect(card).toHaveCount(1)
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
  await expect(card).not.toContainText('本地预览')
  await card.screenshot({ path: path.join(output, 'project-card.png') })
  await card.locator(`a[href="/library/${slug}"]`).last().click()
  await expect(page).toHaveURL(`${origin}/library/${slug}`)
  await expect(page.locator('body')).toContainText(manifest.title)
  await page.screenshot({ path: path.join(output, 'project-detail.png') })
  checks.push('Published card appears at energy line level 05 with cover, deliverable and normal project details.')

  const tested = manifest.knodes.filter(entry => !reviewedModules || reviewedModules.includes(entry.module_id))
  for (const entry of tested) {
    console.log("Checking", entry.module_id)
    const dir = path.join(source, entry.knode_dir)
    const [rawSlides, sections, rawTheories, plan, assignment, record] = await Promise.all(['slides.json', 'sections.json', 'theories.json', 'lesson.md', 'assignment.md', 'learning-record.json'].map(async name => {
      const value = await fs.readFile(path.join(dir, name), 'utf8'); return name.endsWith('.json') ? JSON.parse(value) : value
    }))
    versions.set(entry.module_id, crypto.createHash('sha256').update(JSON.stringify({ record, assignment, plan, rawSlides, rawTheories, sections })).digest('hex').slice(0, 32))
    await page.goto(`${origin}/learn/${slug}/${entry.module_id}`, { waitUntil: "domcontentloaded" })
    await expect(page.locator('h1').first()).toContainText(entry.title)
    await expect(page.getByLabel('切换课程节点')).toHaveValue(entry.module_id)
    await expect(page.getByLabel('切换课程节点').locator('option')).toHaveCount(58)
    await expect(page.locator('[data-pvlib-notebook]')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('本地课程验收')
    if (['M01', 'M21', 'M58'].includes(entry.module_id)) await page.screenshot({ path: path.join(output, `${entry.module_id}-reading.png`) })
  }
  checks.push(`${tested.length} published lessons render their authored reading, notebook, ordered navigation and unchanged record version.`)

  for (const [module, mode] of [['M08', 'game'], ['M14', 'game'], ['M48', 'game'], ['M48', 'animation']]) {
    await page.goto(`${origin}/learn/${slug}/${module}?view=lab&mode=${mode}`, { waitUntil: "domcontentloaded" })
    await expect(page.locator('[data-preview-lab] iframe')).toBeVisible()
    const frame = page.frameLocator('[data-preview-lab] iframe')
    await expect(frame.locator('body')).not.toBeEmpty()
    await expect(page.locator('[data-preview-lab] iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-downloads')
    await page.screenshot({ path: path.join(output, `${module}-${mode}.png`) })
  }
  checks.push('Representative animations and games render in the opaque sandbox on canonical production URLs.')
  await page.goto(`${origin}/learn/${slug}/M48?view=slides`, { waitUntil: "domcontentloaded" })
  await expect(page.locator('[data-preview-slides]')).toBeVisible()
  await expect(page.locator('[data-preview-slides]')).not.toBeEmpty()
  await page.screenshot({ path: path.join(output, 'M48-slides.png') })
  await page.goto(`${origin}/learn/${slug}/M57?view=assignment`, { waitUntil: "domcontentloaded" })
  await expect(page.locator('[data-pvlib-delivery]')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载 pvlib 实践包 ↓' }).click()
  const downloaded = await downloadPromise
  expect(crypto.createHash('sha256').update(await fs.readFile(await downloaded.path())).digest('hex')).toBe(manifest.files.find(file => file.path === 'downloads/pvlib-practice-kit.zip').sha256)
  checks.push('Slide player and final assignment render; authenticated practice download matches the reviewed ZIP hash.')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${origin}/learn/${slug}/M01`, { waitUntil: "domcontentloaded" })
  await expect(page.locator('[data-pvlib-notebook]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: path.join(output, 'M01-mobile.png') })
  checks.push('390px mobile lesson has no horizontal overflow.')
  expect(errors).toEqual([])
  expect(recordRequests.some(record => record.kind === 'classroom')).toBe(true)
  expect(recordRequests.some(record => record.kind === 'assignment')).toBe(true)
  const report = { passed: true, build: process.env.PVLIB_BUILD, modules: tested.map(entry => entry.module_id), checks, pageErrors: errors, recordScopesChecked: recordRequests.length, unhandledFixtureRequests: [...new Set(denied)], note: 'Production candidate frontend, reviewed source fixtures and fake auth. No real student/API writes; production login and file authorization are verified separately.' }
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
