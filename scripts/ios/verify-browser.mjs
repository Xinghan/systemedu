import { chromium } from "@playwright/test"
import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"

const directory = "packages/ios-app/build/browser-check"
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] })
const report = []
try {
  for (const base of ["http://127.0.0.1:4181", "http://127.0.0.1:4000"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
    const errors = [], requests = []
    const page = await context.newPage()
    page.on("pageerror", error => { errors.push(error.message); console.error(base, error.message) })
    page.on("console", message => { if (message.type() === "error") console.error(base, message.text()) })
    page.on("request", request => requests.push(request.url()))
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort())
    const runtime = base.endsWith("4181")
    await page.goto(base + (runtime ? "/?activity=mechanical-hand" : "/standalone/mechanical-hand"))
    await page.locator('[data-model="blender-hand"]').waitFor({ timeout: 30000 })
    await page.getByRole("button", { name: /五指合拢/ }).click()
    await page.waitForFunction(() => JSON.parse(document.querySelector('[data-model="blender-hand"]').dataset.pose).index === 1)
    const formula = page.locator(".katex"); assert.equal(await formula.count(), 1)
    assert.equal(await page.locator(".katex-error").count(), 0)
    await page.screenshot({ path: `${directory}/${runtime ? "runtime" : "website"}-hand.png`, fullPage: true })
    if (runtime) {
      await page.getByRole("status").filter({ hasText: "已保存到本机" }).waitFor()
      await page.reload()
      await page.waitForFunction(() => JSON.parse(document.querySelector('[data-model="blender-hand"]')?.dataset.pose || "{}").index === 1)
    }
    await page.goto(base + (runtime ? "/?activity=mars-landing" : "/standalone/mars-landing"))
    await page.locator('[data-model="blender-glb"]').waitFor({ timeout: 30000 })
    await page.getByRole("button", { name: "播放演示", exact: true }).click()
    await page.waitForFunction(() => Number(document.querySelector('[data-model="blender-glb"]').dataset.time) > 26)
    await page.getByRole("button", { name: "暂停演示", exact: true }).click()
    await page.screenshot({ path: `${directory}/${runtime ? "runtime" : "website"}-landing.png`, fullPage: true })
    if (runtime) {
      await page.goto(base + "/?activity=driving-intro")
      await page.getByLabel("看不清路面时，你还需要什么信息？").fill("先确认路面是否连续，再选择动作。")
      const download = page.waitForEvent("download")
      await page.getByRole("button", { name: "导出记录" }).click()
      const file = await download
      const exported = JSON.parse(await readFile(await file.path(), "utf8"))
      assert.equal(exported.note, "先确认路面是否连续，再选择动作。")
      await page.getByRole("status").filter({ hasText: "已保存到本机" }).waitFor()
      await page.reload()
      assert.equal(await page.getByLabel("看不清路面时，你还需要什么信息？").inputValue(), "先确认路面是否连续，再选择动作。")
      await page.screenshot({ path: `${directory}/runtime-reader.png`, fullPage: true })
    }
    assert.deepEqual(errors, [])
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    report.push({ base, errors, externalRequests: requests.filter(url => new URL(url).hostname !== "127.0.0.1"), passed: true })
    await context.close()
  }
  const course = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const courseErrors = []
  course.on("pageerror", error => courseErrors.push(error.message))
  await course.goto("http://127.0.0.1:4000/explore/space-exploration/write-driving-rules?node=M01")
  await course.locator("#lesson-reading").waitFor({ timeout: 30000 })
  assert.ok((await course.locator("#lesson-reading").innerText()).includes("输入是什么"))
  assert.equal(await course.locator("#lesson-reading table").count(), 1)
  assert.deepEqual(courseErrors, [])
  report.push({ route: "driving-course-M01", markdown: true, table: true, errors: courseErrors, passed: true })
  await course.close()
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally { await browser.close() }
