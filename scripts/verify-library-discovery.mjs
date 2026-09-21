import { chromium, expect as baseExpect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const expect = baseExpect.configure({ timeout: 20000 });
const origin = "http://localhost:4000", dir = path.resolve("artifacts/biomed-project-line/library-regression");
const lines = JSON.parse(await fs.readFile("packages/student-web/src/lib/project-lines/lines.json", "utf8"));
const snapshots = JSON.parse(await fs.readFile("packages/student-web/src/lib/project-lines/course-snapshots.json", "utf8"));
const spaceCourses = JSON.parse(await fs.readFile("packages/student-web/src/lib/project-lines/space-courses.json", "utf8"));
const biomedCourses = JSON.parse(await fs.readFile("packages/student-web/src/lib/project-lines/biomed-courses.json", "utf8"));
const localProjects = [...["spot-a-world","land-a-probe","drive-and-frame"].map(id=>({id,lineId:"space-exploration",kind:"micro"})),{id:"write-driving-rules",lineId:"space-exploration",kind:"guided"},...spaceCourses,...biomedCourses];
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage(), results = [], errors = [];
page.on("pageerror", error => errors.push(String(error)));
let api = [], count;
const lineUrl = id => origin + "/library?view=lines&line=" + id;
const cards = page.locator("[data-project-card]");
await fs.mkdir(dir, { recursive: true });
async function check(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log("PASS " + name); }
  catch (error) { results.push({ name, passed: false, error: String(error) }); throw error; }
}
async function snapshot(name, p = page) { await p.screenshot({ path: path.join(dir, name + ".png"), fullPage: true }); }
async function ordered(p = page) {
  await expect(p.locator("[data-difficulty-group]").first()).toBeAttached();
  const ranks = await p.locator("[data-difficulty-group]").evaluateAll(nodes => nodes.map(n => Number(n.dataset.difficultyGroup)));
  expect(ranks.length).toBeGreaterThan(0); expect(ranks).toEqual([...ranks].sort((a,b) => a-b));
  const depths = await p.locator('[data-kind="full"][data-project-card]').evaluateAll(nodes => nodes.map(n => Number(n.dataset.difficulty)).filter(Number.isFinite));
  expect(depths).toEqual([...depths].sort((a,b) => a-b));
}
async function imagesAndTitles(p = page) {
  for (const card of await p.locator("[data-line-card], [data-project-card]").all()) {
    const image = card.locator("img").first();
    if (!(await image.count())) continue;
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const a = await image.boundingBox(), b = await card.locator("h3").boundingBox();
    expect(a.bottom ?? a.y + a.height).toBeLessThanOrEqual(b.y + 1);
  }
  await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
}
async function reset() { await page.getByRole("button", { name: "重置筛选", exact: true }).first().click(); }

try {
  await check("项目线首页只展示五个主题入口", async () => {
    const response = page.waitForResponse(r => r.url().endsWith("/api/library/projects") && r.request().method() === "GET");
    await page.goto(origin + "/library?view=lines"); api = await (await response).json();
    count = new Set([...api, ...snapshots].map(p => p.slug)).size + localProjects.length;
    await expect(page.locator("[data-line-card]")).toHaveCount(5);
    await expect(cards).toHaveCount(0); await expect(page.locator("[data-planned-project]")).toHaveCount(0);
    await expect(page.locator(".nav-tabs").getByRole("link", { name: "项目线", exact: true })).toHaveCount(0);
    for (const line of lines) await expect(page.locator('[data-line-card="' + line.id + '"]')).toContainText(line.title.zh);
    await imagesAndTitles(); await snapshot("lines-desktop");
  });
  await check("五个主题都能进入独立路线，八门已有课程都有归属", async () => {
    const slugs = lines.flatMap(line => line.courseSlugs);
    expect(new Set(slugs).size).toBe(8);
    for (const line of lines) {
      await page.locator('[data-line-card="' + line.id + '"]').click();
      await expect(page).toHaveURL(lineUrl(line.id));
      await expect(page.locator("[data-line-detail]")).toHaveAttribute("data-line-detail", line.id);
      await expect(page.locator("[data-line-stage]")).toHaveCount(["biomedicine","space-exploration"].includes(line.id)?5:4);
      for (const slug of line.courseSlugs) await expect(page.locator('[data-project-card="' + slug + '"]')).toBeVisible();
      await expect(page.locator("[data-planned-project] a")).toHaveCount(0);
      await imagesAndTitles(); await snapshot("detail-" + line.id);
      await page.getByRole("link", { name: "所有项目线", exact: true }).click();
      await expect(page.locator("[data-line-card]")).toHaveCount(5);
    }
  });
  await check("三个体验和四节点课程可打开，返回准确的太空探索详情", async () => {
    for (const slug of ["spot-a-world", "land-a-probe", "drive-and-frame", "write-driving-rules"]) {
      await page.goto(lineUrl("space-exploration"));
      await page.locator('[data-project-card="' + slug + '"]').getByRole("link", { name: slug === "write-driving-rules" ? "进入课程" : "开始体验", exact: true }).click();
      await expect(page).toHaveURL(origin + "/explore/space-exploration/" + slug);
      if (slug === "write-driving-rules") {
        await expect(page.locator('[aria-label="课程学习路径"] section a')).toHaveCount(4);
        await expect(page.locator('#lesson-references')).toBeVisible();
        await page.locator('header a').first().click();
        await expect(page).toHaveURL(lineUrl("space-exploration"));
        continue;
      }
      const frame = page.frameLocator("iframe");
      if (slug === "spot-a-world") await expect(frame.locator("#loading")).toBeHidden();
      else await expect(frame.locator("#render-mode")).not.toContainText("正在准备");
      await frame.locator("header a").first().click();
      await expect(page).toHaveURL(lineUrl("space-exploration"));
    }
  });
  await check("全部项目跨线去重并由易到难分层展示", async () => {
    await page.goto(origin + "/library"); await expect(cards).toHaveCount(count);
    await ordered(); await expect(cards.first()).toHaveAttribute("data-project-card", "spot-a-world");
    await expect(page.locator('[data-difficulty-group="0"] [data-project-card]')).toHaveCount(localProjects.filter(p=>p.kind==='micro').length);
    await expect(page.locator('[data-difficulty-group="1"] [data-project-card]')).toHaveCount(localProjects.filter(p=>p.kind==='guided').length);
    for (const p of snapshots) await expect(page.locator('[data-project-card="' + p.slug + '"]')).toHaveCount(1);
    await imagesAndTitles(); await snapshot("projects-desktop");
  });
  await check("最新排序仍保留难度层次", async () => {
    await page.getByRole("combobox", { name: "排序", exact: true }).selectOption("recent");
    await ordered(); await expect(cards.first()).toHaveAttribute("data-kind", "micro");
    await reset();
    const p = await context.newPage();
    const fixture = [
      { slug: "test-easy", title: "Easy", difficulty: 2, status: "published", published_at: "2020-01-01" },
      { slug: "test-easiest", title: "Easiest", difficulty: 1, status: "draft", published_at: "2019-01-01" },
      { slug: "test-hard-old", title: "Hard old", difficulty: 5, status: "published", published_at: "2024-01-01" },
      { slug: "test-hard-new", title: "Hard new", difficulty: 5, status: "published", published_at: "2026-01-01" },
      { slug: "test-unrated", title: "Unrated", status: "published" },
    ];
    await p.route("**/api/library/projects", route => route.fulfill({ json: fixture })); await p.goto(origin + "/library");
    await p.getByRole("combobox", { name: "排序", exact: true }).selectOption("recent"); await ordered(p);
    const ids = await p.locator("[data-project-card]").evaluateAll(nodes => nodes.map(n => n.dataset.projectCard));
    expect(ids.indexOf("test-easy")).toBeLessThan(ids.indexOf("test-hard-new"));
    expect(ids.indexOf("test-hard-new")).toBeLessThan(ids.indexOf("test-hard-old"));
    expect(ids.at(-1)).toBe("test-unrated"); await p.close();
  });
  await check("项目线、领域、挑战与搜索筛选可组合", async () => {
    await page.getByRole("combobox", { name: "项目线筛选", exact: true }).selectOption("biomedicine");
    await expect(cards).toHaveCount(7); await expect(page.locator('[data-project-card="molecule-monster-hunter"]')).toBeVisible();
    await page.getByRole("combobox", { name: "学习层级", exact: true }).selectOption("1"); await expect(cards).toHaveCount(2);
    await reset(); await page.getByRole("searchbox").fill("太空"); await expect(cards).toHaveCount(11);
    await page.getByRole("combobox", { name: "学习层级", exact: true }).selectOption("5"); await expect(cards).toHaveCount(1);
    await reset(); await page.getByRole("combobox", { name: "领域", exact: true }).selectOption("bioscience");
    await expect(page.locator('[data-project-card="molecule-monster-hunter"]')).toBeVisible();
    await reset(); await page.locator('[data-kind-filter="guided"]').click(); await expect(cards).toHaveCount(localProjects.filter(p=>p.kind==="guided").length);
    await page.locator('[data-kind-filter="integration"]').click(); await expect(cards).toHaveCount(localProjects.filter(p=>p.kind==="integration").length);
    await reset();
  });
  await check("草稿与未接入课程显示真实状态，不提供无效启动", async () => {
    for (const card of await page.locator('[data-project-card][data-available="false"]').all()) {
      const slug = await card.getAttribute("data-project-card");
      await expect(card.locator('a[href="/library/' + slug + '"]')).toHaveCount(0);
      await expect(card).toContainText(/筹备中|待接入/);
    }
    await page.getByRole("checkbox", { name: "显示筹备中的课程" }).uncheck();
    await expect(cards).toHaveCount(api.filter(p => p.status !== "draft").length + localProjects.length);
    await reset();
  });
  await check("视图切换保留筛选，主题详情支持历史、刷新与未知 ID", async () => {
    await page.getByRole("searchbox").fill("太空");
    const views = page.getByRole("navigation", { name: "项目库视图" });
    await views.getByRole("link", { name: "项目线", exact: true }).click();
    await expect(page.locator("[data-line-card]")).toHaveCount(5);
    await page.locator('[data-line-card="biomedicine"]').click();
    await expect(page).toHaveURL(lineUrl("biomedicine"));
    await expect(page.locator("[data-line-detail]")).toHaveAttribute("data-line-detail", "biomedicine");
    await page.goBack(); await expect(page.locator("[data-line-card]")).toHaveCount(5);
    await page.goForward(); await expect(page.locator("[data-line-detail]")).toHaveAttribute("data-line-detail", "biomedicine");
    await views.getByRole("link", { name: "全部项目", exact: true }).click(); await expect(page.getByRole("searchbox")).toHaveValue("太空");
    await page.goto(lineUrl("biomedicine")); await page.reload(); await expect(page.locator("[data-line-detail]")).toHaveAttribute("data-line-detail", "biomedicine");
    await page.goto(lineUrl("missing")); await expect(page.getByText("这条项目线暂未收录", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "返回所有项目线", exact: true }).click();
    await page.goto(origin + "/project-lines"); await expect(page).toHaveURL(origin + "/library?view=lines");
    await page.goto(origin + "/library?view=unknown"); await expect(cards).toHaveCount(count);
  });
  await check("四种宽度下主题与项目封面无遮挡、页面无横向溢出", async () => {
    for (const width of [390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1050 });
      for (const url of [origin + "/library?view=lines", lineUrl("space-exploration"), lineUrl("biomedicine"), origin + "/library"]) {
        await page.goto(url); await imagesAndTitles();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (width === 390) await snapshot(url.includes("line=space") ? "detail-space-mobile" : url.includes("line=biomed") ? "detail-biomed-mobile" : url.includes("view=lines") ? "lines-mobile" : "projects-mobile");
      }
    }
  });
  await check("英文主题、难度分层和手机导航可用", async () => {
    await page.setViewportSize({ width: 1440, height: 1050 }); await page.goto(origin + "/library?view=lines");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Life Code Lab", exact: true })).toBeVisible();
    await imagesAndTitles(); await snapshot("lines-english");
    await page.locator('[data-line-card="neuro-bionics"]').click();
    await expect(page.getByRole("heading", { name: "Bionic Inventors", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("navigation", { name: "Library view" }).getByRole("link", { name: "All projects", exact: true }).click();
    await ordered(); await expect(page.getByRole("heading", { name: "Explore and act", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "中", exact: true }).click();
  });
  await check("内容服务故障不隐藏主题与本地体验，重试恢复发布状态", async () => {
    const c = await browser.newContext({ viewport: { width: 1440, height: 1050 } }); const p = await c.newPage(); let fail = true;
    await p.route("**/api/library/projects", route => fail ? route.fulfill({ status: 503, json: { error: "unavailable" } }) : route.continue());
    await p.goto(origin + "/library?view=lines"); await expect(p.locator("main").getByRole("alert")).toBeVisible();
    await expect(p.locator("[data-line-card]")).toHaveCount(5);
    await p.locator('[data-line-card="space-exploration"]').click();
    await expect(p.locator('[data-project-card][data-available="true"]')).toHaveCount(localProjects.filter(p=>p.lineId==="space-exploration").length);
    await expect(p.locator('[data-project-card="mars-analog-rover"] a[href="/library/mars-analog-rover"]')).toHaveCount(0);
    fail = false; await p.getByRole("button", { name: "重新加载", exact: true }).click();
    await expect(p.locator('[data-project-card="mars-analog-rover"]')).toHaveAttribute("data-available", "true");
    await expect(p.locator("main").getByRole("alert")).toHaveCount(0); await c.close();
  });
  await check("原课程详情与故事入口保留", async () => {
    await page.setViewportSize({ width: 1440, height: 1050 }); await page.goto(origin + "/library");
    const story = api.find(p => p.status !== "draft" && p.story?.length);
    if (story) { await page.locator('[data-project-card="' + story.slug + '"] button').first().click(); await expect(page.getByRole("dialog")).toBeVisible(); await page.keyboard.press("Escape"); }
    await page.locator('[data-project-card="mars-analog-rover"]').getByRole("link", { name: "查看项目", exact: true }).click();
    await expect(page).toHaveURL(origin + "/library/mars-analog-rover"); await expect(page.getByRole("heading", { level: 1 })).toContainText("火星");
  });
  expect(errors).toEqual([]);
} catch (error) { console.error(error); process.exitCode = 1; await snapshot("failure").catch(() => {}); }
finally { await fs.writeFile(path.join(dir, "verification.json"), JSON.stringify({ run_at: new Date().toISOString(), source: "automated-browser-not-child-trial", results, errors }, null, 2)); await browser.close(); }
