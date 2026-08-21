// Usage: node course_factory/validate/verify/stage_deliverables_page.mjs <slug> <S1-product> [--base URL] [--out DIR]
// Opens the public student project page, expands S1/S2, and confirms that the
// child-visible stage product card is present rather than only the overview grid.
import { chromium } from "playwright"
import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"

const [slug, expectedProduct, ...rest] = process.argv.slice(2)
if (!slug || !expectedProduct) {
  console.error("usage: node stage_deliverables_page.mjs <slug> <S1-product> [--base URL] [--out DIR]")
  process.exit(2)
}

function option(name, fallback) {
  const index = rest.indexOf(name)
  return index >= 0 ? rest[index + 1] : fallback
}

const baseUrl = option("--base", "http://localhost:4000").replace(/\/$/, "")
const outputDir = resolve(option("--out", "/tmp/stage-deliverables-page"))
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = []
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`))
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`)
})

try {
  await page.goto(`${baseUrl}/library/${encodeURIComponent(slug)}`, { waitUntil: "networkidle", timeout: 30_000 })

  const stageOne = page.getByRole("button", { name: /S1/ })
  const productLabel = page.getByText("本关作品", { exact: true })
  // The learner page opens the current stage by default. Only click when S1
  // is actually collapsed, otherwise this audit would hide the very card it
  // is meant to check.
  if (!(await productLabel.isVisible())) {
    await stageOne.click({ timeout: 10_000 })
  }
  await productLabel.waitFor({ state: "visible", timeout: 10_000 })

  for (const label of ["完成时会拿到", "自己检查", "下一关会用到它"]) {
    await page.getByText(label, { exact: true }).waitFor({ state: "visible", timeout: 10_000 })
  }
  await page.getByText(expectedProduct, { exact: true }).waitFor({ state: "visible", timeout: 10_000 })
  const firstCardText = await page.locator("main").innerText()
  if (!/S2/.test(firstCardText)) throw new Error("S1 card does not name the S2 hand-off")
  await page.screenshot({ path: resolve(outputDir, `${slug}-s1.png`), fullPage: true })

  const stageTwo = page.getByRole("button", { name: /S2/ })
  await stageTwo.click({ timeout: 10_000 })
  const productCount = await page.getByText("本关作品", { exact: true }).count()
  if (productCount < 2) throw new Error("S2 stage product card is not visible after expanding S2")
  await page.screenshot({ path: resolve(outputDir, `${slug}-s1-s2.png`), fullPage: true })

  if (errors.length) throw new Error(errors.join("\n"))
  console.log(`${slug}: stage product cards verified; screenshots=${outputDir}`)
} finally {
  await browser.close()
}
