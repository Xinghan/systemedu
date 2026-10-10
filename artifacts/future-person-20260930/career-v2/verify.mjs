import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, expect as baseExpect } from '@playwright/test'

const expect = baseExpect.configure({ timeout: 30000 })
const out = path.dirname(new URL(import.meta.url).pathname)
const cases = [
  ['robotics', 'robotics', '/explore/neuro-bionics/grasp-a-virtual-block'],
  ['space', 'space', '/explore/space-exploration/drive-and-frame'],
  ['molecular-discovery', 'molecular', '/explore/biomedicine/turn-a-molecule'],
  ['clean-energy', 'energy', '/explore/energy-motion/catch-a-sunbeam'],
  ['earth-research', 'earth', '/explore/earth-discovery/spot-a-landscape-change'],
]
const browser = await chromium.launch({ headless: true })
const checks = [], errors = []
try {
  for (const locale of ['zh', 'en']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 2000 } })
    await context.addInitScript(value => localStorage.setItem('se_locale', value), locale)
    await context.route('**/api/**', route => route.fulfill({ json: [] }))
    await context.route('**/preview/pvlib/catalog', route => route.fulfill({ json: null }))
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    for (const [role, asset, firstHref] of cases) {
      await page.goto(`http://localhost:4000/library?view=futures&role=${role}`, { waitUntil: 'domcontentloaded' })
      const detail = page.locator(`[data-future-detail="${role}"]`)
      const img = detail.locator('img')
      await expect(detail).toBeVisible()
      await expect(page.locator(`[data-future-role="${role}"]`)).toHaveAttribute('aria-current', 'true')
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 2000 })
        await expect(img).toHaveAttribute('src', `/library/futures/${asset}-career-v2-800.webp`)
        await expect.poll(() => img.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true)
        await expect(img).toHaveAttribute('alt', /AI/)
        await expect(detail.locator('figcaption')).toHaveText(locale === 'zh' ? '未来职业场景 · AI 生成' : 'A future career scene · AI-generated')
        await expect(detail.locator('[data-future-start]')).toHaveAttribute('href', firstHref)
        const image = await img.evaluate(i => ({ src: i.currentSrc, naturalWidth: i.naturalWidth, width: i.getBoundingClientRect().width, height: i.getBoundingClientRect().height }))
        expect(image.src).toContain(`${asset}-career-v2-`)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        if (locale === 'zh' && width !== 320) {
          await page.evaluate(() => scrollTo(0, 0))
          await detail.locator(':scope > section').first().screenshot({ path: path.join(out, `${asset}-${width}.png`) })
        }
        checks.push({ locale, role, width, image, firstHref, noOverflow: true })
      }
    }
    await context.close()
  }
  // A fresh high-DPI context checks responsive selection, rather than a cached desktop source.
  const retina = await browser.newContext({ viewport: { width: 390, height: 1200 }, deviceScaleFactor: 2 })
  await retina.route('**/api/**', route => route.fulfill({ json: [] }))
  await retina.route('**/preview/pvlib/catalog', route => route.fulfill({ json: null }))
  const page = await retina.newPage()
  page.on('pageerror', error => errors.push(error.message))
  for (const [role, asset] of cases) {
    await page.goto(`http://localhost:4000/library?view=futures&role=${role}`, { waitUntil: 'domcontentloaded' })
    const img = page.locator(`[data-future-detail="${role}"] img`)
    await expect.poll(() => img.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true)
    const currentSrc = await img.evaluate(i => i.currentSrc)
    expect(currentSrc).toContain(`${asset}-career-v2-800.webp`)
    checks.push({ role, width: 390, dpr: 2, currentSrc })
  }
  await retina.close()
  expect(errors).toEqual([])
  const report = { passed: true, checks, pageErrors: errors, note: 'Local browser checks with catalog API fixtures. No student data writes. Generated career imagery is separate from course project covers; visual review is recorded in README.md.' }
  await fs.writeFile(path.join(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ passed: true, checks: checks.length, pageErrors: errors }))
} finally {
  await browser.close()
}
