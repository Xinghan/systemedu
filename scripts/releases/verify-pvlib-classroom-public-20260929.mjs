import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, expect as baseExpect } from '@playwright/test'

const expect = baseExpect.configure({ timeout: 30000 })

const [origin, phase, build] = process.argv.slice(2)
if (!origin || !['candidate', 'production'].includes(phase) || !build) throw new Error('Usage: <origin> <candidate|production> <build>')
const slug = 'pvlib-solar-forecast-station'
const output = path.resolve('artifacts/pvlib-classroom-release-20260929', phase)
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = [], checks = []
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const response = await context.request.get(`https://systeme.xin/api/library/projects/${slug}`)
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ slug, knode_count: 58, version: '1.0.0' })
  for (const suffix of ['/files/manifest.json', '/knodes/M01', '/files/downloads/pvlib-practice-kit.zip']) {
    const response = await context.request.get(`https://systeme.xin/api/library/projects/${slug}${suffix}`)
    expect(response.status()).toBe(401)
    checks.push({ path: suffix, anonymousStatus: response.status() })
  }
  if (phase === 'candidate') {
    await context.route('**/api/**', async route => {
      if (route.request().method() !== 'GET') return route.abort()
      const url = new URL(route.request().url())
      const response = await context.request.get(`https://systeme.xin${url.pathname}${url.search}`)
      return route.fulfill({ response })
    })
  }
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${origin}/library`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('searchbox').fill('pvlib')
    const card = page.locator(`[data-project-card="${slug}"]`)
    await expect(card).toBeVisible({ timeout: 30000 })
    await card.scrollIntoViewIfNeeded()
    const image = card.locator('img').first()
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
    expect(await image.evaluate(img => img.currentSrc)).toContain(`/project-covers/${slug}/cover-`)
    await card.screenshot({ path: path.join(output, `public-card-${width}.png`) })
    await page.goto(`${origin}/library/${slug}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main > header img')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('body')).toContainText('给阳光做一份发电预报')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    checks.push({ width, catalogAndIntroduction: true })
  }
  await page.goto(`${origin}/learn/${slug}/M01`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login\?next=/)
  expect(errors).toEqual([])
  const report = { passed: true, origin, phase, build, checks, anonymousLessonRedirect: true, pageErrors: errors, note: 'Anonymous real public API and page checks; candidate proxies public GET responses only. No real student data writes.' }
  await fs.writeFile(path.join(output, 'public-verification.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report))
} finally { await browser.close() }
