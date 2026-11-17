// Desktop/web regression. Mobile-specific journeys live in verify-mobile.mjs.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const directory = 'packages/ios-app/build/browser-check'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = []
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const errors = [], requests = []
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => requests.push(request.url()))
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  await page.goto('http://127.0.0.1:4000/standalone/mechanical-hand')
  await page.locator('[data-model="blender-hand"]').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: /五指合拢/ }).click()
  await page.waitForFunction(() => JSON.parse(document.querySelector('[data-model="blender-hand"]').dataset.pose).index === 1)
  assert.equal(await page.locator('.katex').count(), 1); assert.equal(await page.locator('.katex-error').count(), 0)
  await page.screenshot({ path: `${directory}/website-hand.png`, fullPage: true })
  await page.goto('http://127.0.0.1:4000/standalone/mars-landing')
  await page.locator('[data-model="blender-glb"]').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: '播放演示', exact: true }).click()
  await page.waitForFunction(() => Number(document.querySelector('[data-model="blender-glb"]').dataset.time) > 26)
  await page.getByRole('button', { name: '暂停演示', exact: true }).click()
  await page.screenshot({ path: `${directory}/website-landing.png`, fullPage: true })
  assert.deepEqual(errors, [])
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
  report.push({ route: 'website-models', errors, externalRequests: requests.filter(url => new URL(url).hostname !== '127.0.0.1'), passed: true })
  await page.goto('http://127.0.0.1:4000/explore/space-exploration/write-driving-rules?node=M01')
  await page.locator('#lesson-reading').waitFor({ timeout: 30000 })
  assert.ok((await page.locator('#lesson-reading').innerText()).includes('输入是什么'))
  assert.equal(await page.locator('#lesson-reading table').count(), 1)
  assert.deepEqual(errors, [])
  report.push({ route: 'driving-course-M01', markdown: true, table: true, errors, passed: true })
  await context.close()
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
} finally { await browser.close() }
