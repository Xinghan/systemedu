import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(path.resolve(process.env.SYSTEMEDU_TEST_MODULE_ROOT || '.', 'package.json'))
const { chromium, expect: baseExpect } = require('@playwright/test')
const expect = baseExpect.configure({ timeout: 30000 })
const origin = process.argv[2] || 'http://127.0.0.1:4002'
const phase = process.argv[3] || 'local'
const output = path.resolve(`artifacts/transit-format-20261030/${phase}`)
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = { passed: false, origin, phase, build: process.argv[4] || null, checks: [], errors: [] }
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await context.addInitScript(() => { for (let i = 1; i <= 5; i++) localStorage.setItem(`systemedu:mission:space:stage-film:${i}:v1`, '1') })
  await context.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url())
    expect(url.origin).toBe(new URL(origin).origin)
    expect(req.method()).toBe('GET')
    expect(req.headers().authorization).toBeUndefined()
    await route.fulfill({ response: await context.request.get(`https://systeme.xin${url.pathname}${url.search}`) })
  })
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  const style = async () => page.evaluate(() => {
    const attrs = el => { const s = getComputedStyle(el); return { font: s.fontFamily, size: s.fontSize, leading: s.lineHeight, color: s.color, background: s.backgroundColor } }
    return { page: attrs(document.querySelector('[data-space-journey]')), heading: attrs(document.querySelector('h1')), next: attrs(document.querySelector('[data-journey-section="next"]')), heroClass: document.querySelector('[data-journey-section="hero"]').className, stageClass: document.querySelector('[data-journey-section="stages"] > div').className }
  })
  // Wait for real decoded pixels before capture; preserve diagnostics on a timeout.
  const imagesReady = async () => {
    try {
      await page.waitForFunction(() => Array.from(document.images).filter(img => { const r = img.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && r.width > 0 }).every(img => img.complete && img.naturalWidth > 0), null, { timeout: phase === 'candidate' ? 120000 : 60000 })
    } catch (error) {
      report.pendingImages = await page.evaluate(() => Array.from(document.images).filter(img => !img.complete || !img.naturalWidth).map(img => ({ src: img.src, currentSrc: img.currentSrc, complete: img.complete, top: img.getBoundingClientRect().top })))
      console.error(JSON.stringify(report.pendingImages))
      await page.screenshot({ path: path.join(output, 'image-timeout.png') })
      throw error
    }
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${origin}/mission/space?route=rover`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-journey-format="space-v1"]')).toBeVisible()
    await expect(page.locator('[data-journey-level]')).toHaveCount(5)
    await expect(page.locator('[data-mission-node]')).toHaveCount(8)
    const roverStyle = await style()
    await imagesReady()
    await page.screenshot({ path: path.join(output, `rover-hero-${width}.png`) })
    await page.getByRole('navigation', { name: '星际远航研究路线' }).getByRole('link', { name: /抓住行星/ }).click()
    await expect(page.locator('[data-transit-journey]')).toBeVisible()
    await expect(page.locator('[data-journey-level]')).toHaveCount(6)
    expect(await style()).toEqual(roverStyle)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('[data-journey-start]')).toHaveAttribute('href', '/learn/lightkurve-transit-detective/M01?mission=space')
    await imagesReady()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: path.join(output, `transit-hero-${width}.png`) })
    await page.getByRole('button', { name: '凌星调查简报 · 文字' }).click()
    await expect(page.locator('[data-transit-briefing]')).toContainText('我是林岚')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '凌星调查简报 · 文字' })).toBeFocused()
    await page.locator('#journey-map').scrollIntoViewIfNeeded()
    await imagesReady()
    const refs = new Set()
    for (let i = 1; i <= 6; i++) {
      const id = `transit-p${i}`
      await page.locator(`[data-journey-level="${id}"]`).click()
      await expect(page.locator(`[data-transit-station="${id}"]`)).toBeVisible()
      await expect(page.locator(`[data-mission-node="${id}"]`)).toHaveAttribute('aria-pressed', 'true')
      await page.locator(`[data-stage-briefing="${id}"]`).click()
      await expect(page.locator(`[data-transit-briefing="${id}"]`)).toBeVisible()
      await page.keyboard.press('Escape')
      for (const ref of await page.locator('[data-mission-step]').evaluateAll(els => els.map(el => el.getAttribute('data-mission-step')))) refs.add(ref)
    }
    expect(refs.size).toBe(32)
    await page.locator('[data-mission-node="transit-p6"]').focus()
    await page.keyboard.press('Home')
    await expect(page.locator('[data-transit-station="transit-p1"]')).toBeVisible()
    await page.getByRole('button', { name: '放大地图', exact: true }).click()
    await expect(page.getByLabel('地图缩放比例')).toHaveText('125%')
    await page.getByRole('button', { name: '缩小地图', exact: true }).click()
    await page.locator('#journey-map').scrollIntoViewIfNeeded()
    await imagesReady()
    await page.screenshot({ path: path.join(output, `transit-map-${width}.png`) })
    await expect(page.locator('[data-transit-evidence]')).toHaveCount(6)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    report.checks.push(`${width}px: same shared hero/stage/next styles as rover; 6 stages/32 original links; briefing focus restore, map keyboard and zoom; no horizontal overflow.`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${origin}/mission/space/control?route=transit`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-task-order]')).toBeVisible()
  await expect(page.locator('[data-main-progress]')).toHaveText(/0\s*\/\s*32/)
  const scenes = new Set()
  for (let i = 0; i < 6; i++) {
    await page.getByLabel('任务站选择').getByRole('button').nth(i).click()
    const id = `transit-p${i + 1}`
    await expect(page.locator('[data-mission-control]')).toHaveAttribute('data-room', id)
    await page.locator(`[data-stage-briefing="${id}"]`).click()
    await expect(page.locator(`[data-transit-briefing="${id}"]`)).toBeVisible()
    await page.keyboard.press('Escape')
    const image = page.locator(`[data-room-background="${id}"] img`).first()
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
    const src = await image.getAttribute('src')
    expect(src).not.toContain('research-control-room')
    scenes.add(src)
  }
  expect(scenes.size).toBeGreaterThanOrEqual(4)
  report.checks.push('All six task rooms resolve designated unoccupied scenes and matching text briefings; none uses the generic missing-station fallback.')
  await page.goto(`${origin}/mission/space?route=rover&station=mission-design`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-stage-replay="2"]').click()
  const film = page.getByRole('dialog').locator('video')
  await expect(film).toHaveAttribute('src', '/mission/space/video/stage-2-v1.mp4')
  await film.evaluate(async video => { video.muted = true; await video.play() })
  await expect.poll(() => film.evaluate(video => video.currentTime)).toBeGreaterThan(0.2)
  await page.keyboard.press('Escape')
  await page.getByRole('navigation', { name: '星际远航研究路线' }).getByRole('link', { name: /抓住行星/ }).click()
  await expect(page.locator('[data-transit-journey]')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  report.checks.push('Original rover stage film still plays; switching to transit unmounts rover film state.')
  if (phase === 'production') expect(await (await page.request.get(`${origin}/mission/space?route=transit`)).text()).toContain(report.build)
  expect(report.errors).toEqual([])
  report.passed = true
} finally {
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log(JSON.stringify(report, null, 2))
