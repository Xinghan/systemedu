import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(path.resolve(process.env.SYSTEMEDU_TEST_MODULE_ROOT || '.', 'package.json'))
const { chromium, expect: baseExpect } = require('@playwright/test')
const expect = baseExpect.configure({ timeout: 30000 })
const [origin, phase, build] = process.argv.slice(2)
if (!origin || !['candidate', 'production', 'before'].includes(phase) || !build) throw Error('Usage: origin phase build')
const output = path.resolve('artifacts/api-origin-20261030', phase)
await fs.mkdir(output, { recursive: true })
const report = { passed: false, origin, phase, build, checks: [], offOriginRequests: [], pageErrors: [], unexpectedFixtureRequests: [] }
const browser = await chromium.launch({ headless: true })
const siteOrigin = new URL(origin).origin
function track(context) {
  context.on('page', page => page.on('pageerror', e => report.pageErrors.push(e.message)))
  context.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/') && url.origin !== siteOrigin) report.offOriginRequests.push(request.url())
  })
}
try {
  const publicContext = await browser.newContext()
  track(publicContext)
  if (phase === 'candidate') await publicContext.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== siteOrigin || request.method() !== 'GET' || request.headers().authorization) return route.abort()
    await route.fulfill({ response: await publicContext.request.get(`https://systeme.xin${url.pathname}${url.search}`) })
  })
  const publicPage = await publicContext.newPage()
  const catalog = publicPage.waitForResponse(r => new URL(r.url()).pathname === '/api/library/projects' && r.status() === 200)
  await publicPage.goto(`${origin}/library`, { waitUntil: 'domcontentloaded' })
  const projects = await (await catalog).json()
  expect(Array.isArray(projects)).toBe(true)
  expect(projects.some(p => p.slug === 'lightkurve-transit-detective')).toBe(true)
  await expect(publicPage.getByText(/Application error/)).toHaveCount(0)
  await publicPage.goto(`${origin}/my-projects`, { waitUntil: 'domcontentloaded' })
  await expect(publicPage).toHaveURL(/\/login(?:\?|$)/)
  expect(await (await publicPage.request.get(`${origin}/my-projects`)).text()).toContain(build)
  expect(report.offOriginRequests).toEqual([])
  report.checks.push('Anonymous catalog loads real production data; project shelf redirects to login; no request to localhost or another origin.')
  report.public_passed = true
  await publicContext.close()

  const now = new Date().toISOString(), old = new Date(Date.now() - 30 * 86400000).toISOString()
  const projectsFixture = [
    { slug: 'lightkurve-transit-detective', title: '凌星调查', domain: 'Aerospace', knode_count: 32, pulled_at: now, last_module_id: 'M02' },
    { slug: 'paused-project', title: '暂停项目验收', domain: 'CS', knode_count: 10, pulled_at: old, last_module_id: 'M03' },
    { slug: 'completed-project', title: '完成项目验收', domain: 'Robotics', knode_count: 8, pulled_at: now, last_module_id: 'M08' },
  ]
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    track(context)
    await context.addInitScript(() => localStorage.setItem('systemedu_token', 'isolated-api-origin-fixture'))
    let empty = false
    const seen = new Set()
    await context.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url())
      if (url.origin !== siteOrigin || req.method() !== 'GET') return route.abort()
      seen.add(url.pathname)
      if (url.pathname === '/api/my/projects') return route.fulfill({ json: empty ? [] : projectsFixture })
      if (url.pathname === '/api/my/badges') return route.fulfill({ json: { chapters: [] } })
      report.unexpectedFixtureRequests.push(url.pathname)
      return route.fulfill({ status: 503, json: { error: 'Unexpected isolated fixture request' } })
    })
    const page = await context.newPage()
    await page.goto(`${origin}/my-projects`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '凌星调查', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /继续学习/ })).toHaveAttribute('href', '/learn/lightkurve-transit-detective/M02')
    await page.screenshot({ path: path.join(output, `my-projects-grid-${width}.png`) })
    await page.getByRole('button', { name: /^已暂停/ }).click()
    await expect(page.getByRole('heading', { name: '暂停项目验收' })).toBeVisible()
    await page.getByRole('button', { name: /^已完成/ }).click()
    await expect(page.getByRole('heading', { name: '完成项目验收' })).toBeVisible()
    await page.getByRole('button', { name: /^全部/ }).click()
    await page.getByRole('button', { name: '列表', exact: true }).click()
    await expect(page.getByRole('link', { name: /暂停项目验收/ })).toBeVisible()
    await page.screenshot({ path: path.join(output, `my-projects-list-${width}.png`) })
    empty = true
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible()
    expect(await page.locator('body').innerText()).not.toContain('Application error')
    expect(seen.has('/api/my/projects') && seen.has('/api/my/badges')).toBe(true)
    report.checks.push(`${width}px: isolated authenticated shelf renders active, paused, completed, grid/list and empty states; existing lesson URL retained; every API URL checked before fixture fulfillment.`)
    await context.close()
  }
  expect(report.offOriginRequests).toEqual([])
  expect(report.pageErrors).toEqual([])
  expect(report.unexpectedFixtureRequests).toEqual([])
  report.fixture_passed = true
  report.api_origin_passed = true
  report.passed = true
} finally {
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
