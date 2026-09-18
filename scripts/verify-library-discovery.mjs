import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const origin = "http://localhost:4000";
const dir = path.resolve("artifacts/library-discovery");
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const results = [], errors = [];
let apiData = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: String(error) }); throw error; }
}
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
page.on("pageerror", error => errors.push(String(error)));
const cards = page.locator("[data-project-card]");
async function reset() { await page.getByRole("button", { name: "重置筛选", exact: true }).first().click(); }

try {
  await check("真实课程数据、醒目主题入口和默认可开始项目", async () => {
    const response = page.waitForResponse(r => r.url().endsWith("/api/library/projects") && r.request().method() === "GET");
    await page.goto(origin + "/library"); apiData = await (await response).json();
    expect(Array.isArray(apiData)).toBe(true);
    await expect(cards).toHaveCount(apiData.filter(p => p.status !== "draft").length + 1);
    await expect(page.getByRole("heading", { name: "太空探索", exact: true })).toBeVisible();
    const heroStart = page.getByRole("link", { name: "从 3 分钟开始", exact: true }).first();
    const box = await heroStart.boundingBox(); expect(box.y + box.height).toBeLessThan(1050);
    await expect(cards.first()).toHaveAttribute("data-project-card", "spot-a-world");
    await page.screenshot({ path: path.join(dir, "library-desktop.png"), fullPage: true });
  });
  await check("从项目库直接进入三分钟体验及项目线", async () => {
    await page.getByRole("link", { name: "从 3 分钟开始", exact: true }).first().click();
    await expect(page).toHaveURL(/\/explore\/space-exploration\/spot-a-world$/);
    await expect(page.frameLocator("iframe").locator("#loading")).toBeHidden();
    await page.goto(origin + "/library");
    await page.getByRole("link", { name: "查看项目线", exact: true }).click();
    await expect(page).toHaveURL(/\/project-lines$/);
    await expect(page.getByRole("heading", { name: "一个小项目，一件自己的作品。" })).toBeVisible();
    await page.goto(origin + "/library");
    await expect(cards).toHaveCount(apiData.filter(p => p.status !== "draft").length + 1);
  });
  await check("项目类型、真实筹备状态及恢复筛选", async () => {
    await page.locator('[data-kind-filter="micro"]').click(); await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("轻量操作");
    await page.locator('[data-kind-filter="guided"]').click(); await expect(cards).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "这一站，正在制作中。" })).toBeVisible();
    await expect(page.getByText(/给探测车制作地形样本/)).toBeVisible();
    await page.screenshot({ path: path.join(dir, "guided-planning.png"), fullPage: true });
    await page.locator('[data-kind-filter="integration"]').click();
    await expect(page.getByText(/组装我的第一辆自主探测车/)).toBeVisible();
    await reset();
    await expect(cards).toHaveCount(apiData.filter(p => p.status !== "draft").length + 1);
  });
  await check("搜索、领域、难度、排序和空态", async () => {
    await page.getByRole("searchbox").fill("太空"); await expect(cards).toHaveCount(2);
    await page.getByRole("combobox", { name: "挑战程度", exact: true }).selectOption("4-5");
    await expect(cards).toHaveCount(1); await expect(cards.first()).toHaveAttribute("data-project-card", "mars-analog-rover");
    await page.getByRole("combobox", { name: "领域", exact: true }).selectOption("climate");
    await expect(page.getByRole("heading", { name: "暂时没有符合条件的项目" })).toBeVisible();
    await reset();
    await page.locator('[data-kind-filter="full"]').click();
    await page.getByRole("combobox", { name: "排序", exact: true }).selectOption("difficulty");
    const depths = await cards.evaluateAll(nodes => nodes.map(n => Number(n.dataset.difficulty)).filter(Number.isFinite));
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
    await page.getByRole("combobox", { name: "排序", exact: true }).selectOption("recent");
    const expected = apiData.filter(p => p.status !== "draft").sort((a,b) => (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0) || (a.title_zh || a.title).localeCompare(b.title_zh || b.title,"zh"));
    expect(await cards.first().getAttribute("data-project-card")).toBe(expected[0].slug);
    await reset();
  });
  await check("草稿不可启动、旧格式成果和生物领域别名", async () => {
    await page.getByRole("checkbox", { name: "显示筹备中的课程" }).check();
    await expect(cards).toHaveCount(apiData.length + 1);
    for (const project of apiData.filter(p => p.status === "draft")) {
      const card = page.locator(`[data-project-card="${project.slug}"]`);
      await expect(card).toContainText("筹备中");
      await expect(card.locator(`a[href="/library/${project.slug}"]`)).toHaveCount(0);
    }
    await page.getByRole("combobox", { name: "领域", exact: true }).selectOption("bioscience");
    await expect(page.locator('[data-project-card="alphafold-novel-mushroom"]')).toBeVisible();
    await expect(page.locator('[data-project-card="alphafold-novel-mushroom"]')).not.toContainText("[object Object]");
    await reset();
  });
  await check("已有开篇故事与课程详情可达", async () => {
    const storyProject = apiData.find(p => p.status !== "draft" && p.story?.length);
    if (storyProject) {
      await page.locator(`[data-project-card="${storyProject.slug}"] button`).first().click();
      await expect(page.getByRole("dialog")).toBeVisible(); await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await page.locator('[data-project-card="mars-analog-rover"]').getByRole("link", { name: "查看项目", exact: true }).click();
    await expect(page).toHaveURL(/\/library\/mars-analog-rover$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("火星");
    await page.goto(origin + "/library");
  });
  await check("中英文和手机布局，不产生横向溢出", async () => {
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Project library", exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(dir, "library-english.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-kind-filter="micro"]').click(); await expect(cards).toHaveCount(1);
    await page.getByRole("button", { name: "中", exact: true }).click();
    await reset();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const box = await page.getByRole("link", { name: "从 3 分钟开始", exact: true }).first().boundingBox();
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.height).toBeLessThan(844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(dir, "library-mobile.png"), fullPage: true });
    await page.screenshot({ path: path.join(dir, "library-mobile-first-screen.png") });
  });
  await check("内容服务故障仍能体验、重试后恢复课程", async () => {
    const c = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const p = await c.newPage(); let fail = true;
    await p.route("**/api/library/projects", route => fail ? route.fulfill({ status: 503, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ error: "test unavailable" }) }) : route.continue());
    await p.goto(origin + "/library"); await expect(p.locator("main").getByRole("alert")).toContainText("完整课程暂时没有载入");
    await expect(p.locator('[data-project-card="spot-a-world"]')).toBeVisible();
    fail = false; await p.getByRole("button", { name: "重新加载", exact: true }).click();
    await expect(p.locator("[data-project-card]")).toHaveCount(apiData.filter(p => p.status !== "draft").length + 1);
    await expect(p.locator("main").getByRole("alert")).toHaveCount(0); await c.close();
  });
  expect(errors).toEqual([]);
} catch (error) {
  console.log(await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, wide: [...document.querySelectorAll("body *")].map(node => ({ tag: node.tagName, class: node.className, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })).filter(node => node.right > innerWidth + 1 && node.left < innerWidth).slice(0, 20) })));
  console.error(error); process.exitCode = 1;
  await page.screenshot({ path: path.join(dir, "failure.png"), fullPage: true }).catch(() => {});
} finally {
  await fs.writeFile(path.join(dir, "verification.json"), JSON.stringify({ run_at: new Date().toISOString(), browser: browser.version(), source: "automated-browser-validation", results, errors }, null, 2));
  await browser.close();
}
