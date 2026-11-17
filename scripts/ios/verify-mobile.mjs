import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
const directory = 'packages/ios-app/build/mobile-check'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = []
async function onScreen(page, locator) {
  const box = await locator.boundingBox(), viewport = page.viewportSize()
  assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `Off screen: ${await locator.getAttribute('aria-label') || await locator.innerText()} ${JSON.stringify(box)}`)
  assert.ok(await locator.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) }), 'Control is obscured')
}
async function noPageScroll(page) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, x: scrollX, y: scrollY }))
  assert.ok(dimensions.width <= page.viewportSize().width + 1)
  assert.ok(dimensions.height <= page.viewportSize().height + 1)
  assert.equal(dimensions.x, 0); assert.equal(dimensions.y, 0)
}
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 704 }, { width: 844, height: 390 }, { width: 844, height: 300 }, { width: 834, height: 1000 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
    const page = await context.newPage(), errors = [], external = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => { if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue(); external.push(route.request().url()); return route.abort() })
    await page.goto('http://127.0.0.1:4181/?activity=mechanical-hand')
    await page.locator('[data-model="blender-hand"]').waitFor({ timeout: 30000 })
    for (const button of await page.locator('.control-deck button:visible, .control-deck input:visible').all()) await onScreen(page, button)
    for (const name of ['张开手掌', '五指合拢', '包握参考球', '更多操作', '动作原理']) await onScreen(page, page.getByRole('button', { name, exact: true }))
    const model = await page.locator('.model-frame').boundingBox(); assert.ok(model.height >= 190)
    await page.getByRole('button', { name: '五指合拢', exact: true }).click()
    await page.waitForFunction(() => JSON.parse(document.querySelector('[data-model="blender-hand"]').dataset.pose).index === 1)
    if (await page.getByRole('button', { name: '查看收绳计算' }).isVisible()) await page.getByRole('button', { name: '查看收绳计算' }).click()
    else { await page.getByRole('button', { name: '动作原理', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: '下一页', exact: true }).click() }
    await page.getByRole('dialog').waitFor()
    assert.equal(await page.locator('.katex').count(), 1); assert.equal(await page.locator('.katex-error').count(), 0)
    await onScreen(page, page.getByRole('button', { name: '关闭面板' }))
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('dialog').count(), 0)
    await page.getByRole('button', { name: '更多操作', exact: true }).click()
    await page.getByLabel('拇指对掌', { exact: true }).fill('67')
    await page.getByRole('button', { name: '关闭面板' }).click()
    await page.getByRole('button', { name: '看内部', exact: true }).click()
    await page.locator('.session-bar').getByRole('status').filter({ hasText: '已保存到本机' }).waitFor()
    await page.reload()
    await page.locator('[data-model="blender-hand"]').waitFor({ timeout: 30000 })
    assert.equal(await page.locator('[data-model="blender-hand"]').getAttribute('data-shells'), 'false')
    assert.equal(await page.getByRole('button', { name: '拇指', exact: true }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: '张开手掌', exact: true }).click()
    await page.getByRole('button', { name: '显示外壳', exact: true }).click()
    await noPageScroll(page)
    await page.screenshot({ path: `${directory}/hand-${viewport.width}x${viewport.height}.png` })
    await page.goto('http://127.0.0.1:4181/?activity=mars-landing')
    await page.locator('[data-model="blender-glb"]').waitFor({ timeout: 30000 })
    for (const control of await page.locator('.control-deck button, .control-deck input').all()) await onScreen(page, control)
    await page.getByRole('button', { name: '播放演示', exact: true }).click()
    await page.waitForFunction(() => Number(document.querySelector('[data-model="blender-glb"]').dataset.time) > 25.3)
    await page.getByRole('button', { name: '暂停演示', exact: true }).click()
    await page.getByRole('button', { name: '抛掉隔热罩', exact: true }).click()
    assert.equal(await page.locator('[data-model="blender-glb"]').getAttribute('data-time'), '6.00')
    await page.getByRole('button', { name: '部件目录', exact: true }).click()
    await page.getByRole('button', { name: '动力下降级', exact: true }).click()
    assert.equal(await page.locator('[data-model="blender-glb"]').getAttribute('data-time'), '14.00')
    await page.getByRole('button', { name: '缆绳放下火星车', exact: true }).click()
    await noPageScroll(page)
    await page.screenshot({ path: `${directory}/landing-${viewport.width}x${viewport.height}.png` })
    await page.goto('http://127.0.0.1:4181/?activity=driving-intro')
    await page.locator('.reading-card').waitFor()
    const cards = [], locallyScrolling = []
    for (;;) {
      const card = page.locator('.reading-card')
      await onScreen(page, page.getByRole('button', { name: /记笔记|我的笔记/, exact: true }))
      await onScreen(page, page.getByRole('button', { name: '下一页', exact: true }))
      await noPageScroll(page)
      const size = await card.evaluate(el => ({ horizontal: el.scrollWidth > el.clientWidth + 1, vertical: el.scrollHeight > el.clientHeight + 1 }))
      assert.equal(size.horizontal, false)
      if (size.vertical) locallyScrolling.push(await card.getAttribute('data-reading-page'))
      assert.equal(await page.locator('table').count(), 0)
      if (await page.locator('.comparison-card').count()) {
        assert.equal(await page.locator('.comparison-card dt').count(), 3)
        const text = await page.locator('.comparison-card').innerText()
        assert.ok(!text.includes('|')); cards.push(text)
        if (cards.length === 2) await page.screenshot({ path: `${directory}/table-${viewport.width}x${viewport.height}.png` })
      }
      if (await page.getByRole('button', { name: '下一页', exact: true }).isDisabled()) break
      await page.getByRole('button', { name: '下一页', exact: true }).click()
    }
    assert.equal(cards.length, 4)
    assert.ok(cards[3].includes('能否据此宣称前面安全？'))
    // Reading state and existing note format survive a reload, including immediate export.
    await page.getByRole('button', { name: '记笔记', exact: true }).click()
    const note = `移动端验证 ${viewport.width}`
    await page.getByLabel('看不清路面时，你还需要什么信息？').fill(note)
    await page.getByRole('button', { name: '关闭面板' }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出记录', exact: false }).click()
    const exported = JSON.parse(await readFile(await (await download).path(), 'utf8'))
    assert.equal(exported.note, note); assert.equal(exported.reader_page, 's4-p1')
    await page.reload(); await page.locator('[data-reading-page="s4-p1"]').waitFor()
    await page.getByRole('button', { name: '我的笔记', exact: true }).click()
    assert.equal(await page.getByLabel('看不清路面时，你还需要什么信息？').inputValue(), note)
    await onScreen(page, page.getByRole('button', { name: '关闭面板' }))
    assert.deepEqual(errors, []); assert.deepEqual(external, [])
    report.push({ viewport, keyControlsOnScreen: true, noHorizontalTables: true, rowsPreserved: cards.length, restored: true, locallyScrollingReadingCards: locallyScrolling, errors })
    await context.close()
  }
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
