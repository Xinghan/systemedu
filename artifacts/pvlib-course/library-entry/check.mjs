import { chromium, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const output = path.dirname(fileURLToPath(import.meta.url))
const origin = 'http://localhost:4000'
const selector = '[data-project-card="pvlib-solar-forecast-station"]'
const browser = await chromium.launch({ headless: true })
const checks = []
const errors = []
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  const response = await context.request.get(`${origin}/preview/pvlib/catalog`)
  expect(response.status()).toBe(200)
  const catalog = await response.json()
  expect(catalog).toMatchObject({ title: '给阳光做一份发电预报', nodeCount: 58, firstModuleId: 'M01' })
  checks.push('Catalog reads the current manifest: title, 58 nodes and first lesson.')
  const blocked = await context.request.get(`${origin}/preview/pvlib/catalog`, { headers: { Host: 'example.invalid' } })
  expect(blocked.status()).toBe(404)
  checks.push('Catalog rejects non-loopback hosts.')

  await page.goto(`${origin}/library`)
  const card = page.locator(selector)
  await expect(card).toHaveCount(1)
  await expect(card).toContainText(catalog.title)
  await expect(card).toContainText('58 章')
  await expect(card).toContainText('本地预览')
  await expect(page.locator(`[data-difficulty-group="4"] ${selector}`)).toHaveCount(1)
  for (const term of ['pvlib', '发电预报']) {
    await page.getByRole('searchbox').fill(term)
    await expect(page.locator('[data-project-card]')).toHaveCount(1)
    await expect(card).toBeVisible()
  }
  await page.locator('[data-kind-filter="full"]').click()
  await page.getByLabel('学习层级', { exact: true }).selectOption('5')
  await page.getByLabel('领域', { exact: true }).selectOption('energy')
  await page.getByLabel('项目线筛选', { exact: true }).selectOption('energy-motion')
  await page.getByLabel('显示筹备中的课程', { exact: true }).uncheck()
  await expect(card).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
  await card.screenshot({ path: path.join(output, 'project-card-desktop.png') })
  checks.push('All-projects view: one card, correct level, searchable in Chinese/English, filters and loaded cover.')

  await page.goto(`${origin}/library?view=lines&line=energy-motion`)
  await expect(page.locator(`[data-line-stage="5"] ${selector}`)).toHaveCount(1)
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
  await page.screenshot({ path: path.join(output, 'energy-line-desktop.png') })
  await card.getByRole('link', { name: '进入课程', exact: true }).click()
  await expect(page).toHaveURL(`${origin}/preview/pvlib/M01`)
  await expect(page.locator('body')).toContainText(catalog.title)
  await expect(page.locator('select option[value="M58"]')).toHaveCount(1)
  checks.push('Energy line: level 05 card opens M01 and the course includes M58.')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${origin}/library`)
  await page.getByRole('searchbox').fill('pvlib')
  await expect(card).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await card.screenshot({ path: path.join(output, 'project-card-mobile.png') })
  checks.push('390px mobile: loaded cover, course button visible, no horizontal page overflow.')

  await page.route('**/api/library/projects', route => route.fulfill({ status: 503, body: '{}' }))
  await page.goto(`${origin}/library`)
  await expect(card).toHaveCount(1)
  await expect(page.getByRole('alert').filter({ hasText: '完整课程暂时没有载入' })).toBeVisible()
  await card.getByRole('link', { name: '进入课程', exact: true }).click()
  await expect(page).toHaveURL(`${origin}/preview/pvlib/M01`)
  checks.push('Service failure: local course remains available and navigable.')
  expect(errors).toEqual([])
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'Local development catalog only; no deployment or learner record mutations.', checks, pageErrors: errors }, null, 2) + '\n')
  console.log(JSON.stringify({ passed: checks.length, checks, pageErrors: errors }, null, 2))
} finally {
  await browser.close()
}
