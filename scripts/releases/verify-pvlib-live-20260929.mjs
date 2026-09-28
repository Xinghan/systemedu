import { chromium, expect } from '@playwright/test'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const origin = 'https://systeme.xin'
const slug = 'pvlib-solar-forecast-station'
const output = path.resolve('artifacts/pvlib-release-20260929/production')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const projectsResponse = await context.request.get(`${origin}/api/library/projects`)
  expect(projectsResponse.status()).toBe(200)
  const project = (await projectsResponse.json()).find(item => item.slug === slug)
  expect(project).toMatchObject({ knode_count: 58, version: '1.0.0', title_zh: '给阳光做一份发电预报' })
  const cover = await context.request.get(`${origin}/api/library/projects/${slug}/cover`)
  expect(cover.status()).toBe(200)
  const sourceCover = await fs.readFile(path.resolve('../systemeduidea/projects_data', slug, project.cover_image_path))
  expect(crypto.createHash('sha256').update(await cover.body()).digest('hex')).toBe(crypto.createHash('sha256').update(sourceCover).digest('hex'))
  for (const suffix of ['/knodes/M01', '/knodes/M58', '/files/downloads/pvlib-practice-kit.zip']) {
    const response = await context.request.get(`${origin}/api/library/projects/${slug}${suffix}`)
    expect(response.status()).toBe(401)
  }
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${origin}/library`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('searchbox').fill('pvlib')
  const card = page.locator(`[data-project-card="${slug}"]`)
  await expect(card).toHaveCount(1)
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
  await card.screenshot({ path: path.join(output, 'project-card.png') })
  await page.goto(`${origin}/library?view=lines&line=energy-motion`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator(`[data-line-stage="5"] [data-project-card="${slug}"]`)).toHaveCount(1)
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
  await page.screenshot({ path: path.join(output, 'energy-line.png') })
  await card.locator(`a[href="/library/${slug}"]`).last().click()
  await expect(page).toHaveURL(`${origin}/library/${slug}`)
  await expect(page.locator('body')).toContainText(project.title_zh)
  await page.screenshot({ path: path.join(output, 'project-detail.png') })
  await page.goto(`${origin}/learn/${slug}/M01`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/login\?next=/)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${origin}/library`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('searchbox').fill('发电预报')
  await expect(card).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await card.screenshot({ path: path.join(output, 'project-card-mobile.png') })
  expect(errors).toEqual([])
  const report = { passed: true, checkedAt: new Date().toISOString(), project: slug, version: project.version, nodes: project.knode_count, checks: ['Public production catalog and unchanged cover hash', 'All-project search and energy line level 05', 'Project details and normal login redirect', 'Unauthenticated lesson and practice files return 401', '390px card and no horizontal overflow'], pageErrors: errors, note: 'Anonymous HTTPS checks. No claim of authenticated production student walkthrough or production student record mutation.' }
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
