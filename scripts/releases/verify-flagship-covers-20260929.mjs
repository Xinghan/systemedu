import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium, expect } from '@playwright/test'

const [origin, phase, build] = process.argv.slice(2)
if (!origin || !['candidate', 'production'].includes(phase) || !build) throw new Error('Usage: node scripts/releases/verify-flagship-covers-20260929.mjs <origin> <candidate|production> <build>')
const output = path.resolve('artifacts/flagship-covers-live-20260929', phase)
const web = path.resolve('packages/student-web')
const variants = JSON.parse(await fs.readFile(path.join(web, 'src/lib/project-lines/project-cover-variants.json'), 'utf8'))
const flagship = JSON.parse(await fs.readFile(path.join(web, 'src/lib/project-lines/flagship-covers.json'), 'utf8'))
const slugs = Object.keys(flagship)
const detailBaseline = JSON.parse(await fs.readFile('artifacts/flagship-covers-live-20260929/detail-api-baseline.json', 'utf8'))
const preExistingIssues = []
const lines = {
  'space-exploration': ['mars-analog-rover'],
  biomedicine: ['molecule-monster-hunter'],
  'neuro-bionics': ['emg-prosthetic-hand', 'eeg-minecraft-bci'],
  'energy-motion': ['pvlib-solar-forecast-station'],
  'earth-discovery': ['ai-ant-ethologist', 'satellite-archaeology', 'purpleair-airquality-node'],
}
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const checks = [], errors = [], originalRequests = [], staticChecks = []
let activePage
const hash = data => crypto.createHash('sha256').update(data).digest('hex')
try {
  const http = await browser.newContext()
  const assets = [...slugs, 'pvlib-solar-forecast-station'].flatMap(slug => variants[slug].variants)
  for (let i = 0; i < assets.length; i += 6) {
    await Promise.all(assets.slice(i, i + 6).map(async variant => {
      const response = await http.request.get(origin + variant.src)
      expect(response.status(), variant.src).toBe(200)
      expect(response.headers()['content-type']).toContain('image/webp')
      const bytes = await response.body()
      expect(bytes.length).toBe(variant.bytes)
      expect(hash(bytes)).toBe(hash(await fs.readFile(path.join(web, 'public', variant.src))))
      staticChecks.push({ src: variant.src, bytes: bytes.length, sha256: hash(bytes) })
    }))
  }
  await Promise.all(detailBaseline.map(async baseline => {
    const response = await http.request.get(`https://systeme.xin/api/library/projects/${baseline.slug}`)
    expect(response.status(), `${baseline.slug}: changed detail API status`).toBe(baseline.status)
    if (baseline.status !== 200) {
      expect(baseline.slug).toBe('molecule-monster-hunter')
      expect(response.status()).toBe(409)
      expect((await response.json()).error).toBe('course_numbering_mismatch')
      preExistingIssues.push({ slug: baseline.slug, status: 409, error: 'course_numbering_mismatch', note: 'Present before this cover release. Card cover is checked; detail page cannot load until course numbering is repaired separately.' })
    }
  }))
  await http.close()
  console.log(JSON.stringify({ staticFilesVerified: staticChecks.length }))
  for (const device of [{ name: 'desktop', width: 1440, dpr: 1 }, { name: 'mobile', width: 390, dpr: 2 }]) {
    for (const offline of [false, true]) {
      const context = await browser.newContext({ viewport: { width: device.width, height: 1000 }, deviceScaleFactor: device.dpr })
      let catalogRead = false
      await context.route('**/api/**', async route => {
        const request = route.request()
        // Verification never submits student data or uses an authenticated session.
        if (request.method() !== 'GET') return route.abort()
        const url = new URL(request.url())
        if (slugs.some(slug => url.pathname === `/api/library/projects/${slug}/cover`)) originalRequests.push(url.pathname)
        if (offline) return route.fulfill({ status: 503, body: 'Catalog unavailable in deliberate fallback test' })
        if (phase === 'candidate') {
          // Preview is loopback-only; proxy anonymous public data, not local course fixtures.
          const response = await context.request.get(`https://systeme.xin${url.pathname}${url.search}`)
          if (url.pathname === '/api/library/projects') {
            expect(response.status()).toBe(200)
            const catalog = await response.json()
            expect(catalog.map(project => project.slug)).toEqual(expect.arrayContaining(slugs))
            catalogRead = true
          }
          return route.fulfill({ response })
        }
        const response = await route.fetch()
        if (url.pathname === '/api/library/projects') {
          expect(response.status()).toBe(200)
          expect((await response.json()).map(project => project.slug)).toEqual(expect.arrayContaining(slugs))
          catalogRead = true
        }
        return route.fulfill({ response })
      })
      const page = await context.newPage()
      activePage = page
      page.on('pageerror', error => errors.push(error.message))
      const cards = []
      async function inspectCard(slug) {
        const card = page.locator(`[data-project-card="${slug}"]`)
        await expect(card).toHaveCount(1, { timeout: 30000 })
        await card.scrollIntoViewIfNeeded()
        const image = card.locator('img').first()
        await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0), { timeout: 45000 }).toBe(true)
        const result = await image.evaluate(img => {
          const r = img.parentElement.getBoundingClientRect()
          return { src: img.currentSrc, srcSet: img.srcset, loading: img.loading, objectFit: getComputedStyle(img).objectFit, width: r.width, height: r.height }
        })
        const variant = variants[slug].variants.find(item => origin + item.src === result.src)
        expect(variant, `${slug}: expected individual responsive cover, got ${result.src}`).toBeTruthy()
        expect(variant.width).toBeLessThanOrEqual(800)
        expect(result.srcSet.split(',')).toHaveLength(3)
        expect(result.loading).toBe('lazy')
        expect(result.objectFit).toBe('cover')
        expect(result.width).toBeGreaterThan(0)
        expect(result.height).toBeGreaterThan(0)
        expect(Math.abs(result.width / result.height - 1.5)).toBeLessThan(0.02)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        return { slug, ...result, variantWidth: variant.width }
      }
      await page.goto(`${origin}/library`, { waitUntil: 'domcontentloaded' })
      if (!offline) {
        await expect.poll(() => catalogRead, { timeout: 45000 }).toBe(true)
        await expect(page.locator('[data-project-card="pvlib-solar-forecast-station"]')).toHaveCount(1)
      }
      for (const slug of slugs) cards.push(await inspectCard(slug))
      expect(new Set(cards.map(card => card.src)).size).toBe(8)
      // Complete-engineering covers use one frame across all project lines.
      expect(Math.max(...cards.map(card => card.height)) - Math.min(...cards.map(card => card.height))).toBeLessThan(1)
      if (!offline) await inspectCard('pvlib-solar-forecast-station')
      await page.locator('[data-project-card="purpleair-airquality-node"]').evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 95))
      await page.screenshot({ path: path.join(output, `${device.name}-${offline ? 'fallback' : 'catalog'}.png`) })
      checks.push({ device, offline, cards })
      if (!offline) {
        for (const [line, lineSlugs] of Object.entries(lines)) {
          await page.goto(`${origin}/library?view=lines&line=${line}`, { waitUntil: 'domcontentloaded' })
          const lineCards = []
          for (const slug of lineSlugs) lineCards.push(await inspectCard(slug))
          checks.push({ device: device.name, line, cards: lineCards })
        }
        console.log(JSON.stringify({ device: device.name, projectLinesVerified: 5 }))
        for (const slug of slugs) {
          if (preExistingIssues.some(issue => issue.slug === slug)) continue
          console.log(JSON.stringify({ device: device.name, checkingDetail: slug }))
          await page.goto(`${origin}/library/${slug}`, { waitUntil: 'networkidle' })
          const hero = page.locator('main > header img').first()
          await expect(hero).toBeAttached({ timeout: 45000 })
          await expect.poll(() => hero.evaluate(img => img.complete && img.naturalWidth > 0), { timeout: 45000 }).toBe(true)
          const src = await hero.evaluate(img => img.currentSrc)
          expect(variants[slug].variants.map(item => origin + item.src)).toContain(src)
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
          checks.push({ device: device.name, detail: slug, src })
          if (slug === 'mars-analog-rover') await page.locator('main > header').screenshot({ path: path.join(output, `${device.name}-detail.png`) })
        }
      }
      await context.close()
      console.log(JSON.stringify({ device: device.name, offline, checked: true }))
    }
  }
  expect(errors).toEqual([])
  expect(originalRequests).toEqual([])
  const report = { passed: true, checkedAt: new Date().toISOString(), origin, phase, build, staticChecks, checks, preExistingIssues, pageErrors: errors, originalRequests, note: 'Anonymous read-only cover checks. Candidate uses live public metadata; deliberate API failure verifies snapshot covers. Seven accessible detail heroes checked; molecule detail is blocked by a verified pre-existing course numbering conflict. No course content or student records changed.' }
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: true, phase, build, staticFiles: staticChecks.length, checks: checks.length, pageErrors: errors.length }))
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
    console.error(JSON.stringify({ failedAt: activePage.url(), visibleText: (await activePage.locator('body').innerText()).slice(0, 500) }))
  }
  throw error
} finally { await browser.close() }
