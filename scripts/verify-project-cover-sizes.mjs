import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const slug = 'pvlib-solar-forecast-station'
const origin = 'http://127.0.0.1:4000'
const source = path.resolve('../systemeduidea/projects_data', slug)
const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'))
const tree = JSON.parse(await fs.readFile(path.join(source, 'tree/knowledge_tree.json'), 'utf8'))
const project = { slug, title: manifest.title, title_zh: manifest.title_zh, ...manifest.frontmatter, status: 'published', version: manifest.version, knode_count: 58, cover_image_path: manifest.cover_image_path, tags: manifest.tags, knowledge_tree: tree, final_outcomes: tree.final_outcomes }
const output = path.resolve('artifacts/project-cover-sizes-20260929')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const checks = [], errors = [], originalRequests = []
try {
  for (const device of [{ name: 'desktop', width: 1440, dpr: 1 }, { name: 'mobile', width: 390, dpr: 2 }]) {
    const context = await browser.newContext({ viewport: { width: device.width, height: 1000 }, deviceScaleFactor: device.dpr })
    await context.route(/\/preview\/[^/]+\/catalog(?:\?|$)/, route => route.fulfill({ status: 404, body: '' }))
    await context.route('**/api/**', async route => {
      const pathname = new URL(route.request().url()).pathname
      const json = data => route.fulfill({ json: data })
      if (pathname === '/api/library/projects') return json([project])
      if (pathname === `/api/library/projects/${slug}`) return json(project)
      if (pathname.endsWith('/blueprint')) return json({ content: await fs.readFile(path.join(source, 'blueprint/README.zh.md'), 'utf8'), lang_returned: 'zh-CN' })
      if (pathname.endsWith('/tree')) return json(tree)
      if (pathname === `/api/library/projects/${slug}/cover`) {
        originalRequests.push(pathname)
        return route.fulfill({ status: 500, body: 'Original PNG must not be requested in this test' })
      }
      if (pathname.includes('/knowledge-tree') || pathname.includes('/complete')) return json({ completed_knode_ids: [], lit_nodes: [], subjects_used: [] })
      return route.fulfill({ status: 404, body: '' })
    })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`${origin}/library`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('searchbox').fill('pvlib')
    const card = page.locator(`[data-project-card="${slug}"]`)
    await expect(card).toHaveCount(1)
    await card.scrollIntoViewIfNeeded()
    const image = card.locator('img')
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
    const cardImage = await image.evaluate(img => ({ url: img.currentSrc, loading: img.loading, width: img.getBoundingClientRect().width }))
    expect(cardImage.url).toContain(device.dpr === 1 ? '-480.webp' : '-800.webp')
    expect(cardImage.loading).toBe('lazy')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await card.screenshot({ path: path.join(output, `${device.name}-card.png`) })
    await page.goto(`${origin}/library/${slug}`, { waitUntil: 'domcontentloaded' })
    const hero = page.locator('main > header img').first()
    await expect.poll(() => hero.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
    const heroImage = await hero.evaluate(img => ({ url: img.currentSrc, priority: img.fetchPriority }))
    expect(heroImage.url).toContain(device.dpr === 1 ? '-1280.webp' : '-800.webp')
    expect(heroImage.priority).toBe('high')
    await page.locator('main > header').screenshot({ path: path.join(output, `${device.name}-hero.png`) })
    checks.push({ device, card: cardImage, hero: heroImage })
    await context.close()
  }
  expect(errors).toEqual([])
  expect(originalRequests).toEqual([])
  const report = { passed: true, scope: 'Local UI, public project fixtures, actual local static WebP requests. Not a production deployment.', checks, originalRequests, pageErrors: errors }
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
