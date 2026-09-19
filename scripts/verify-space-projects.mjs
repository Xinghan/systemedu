import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
const origin = "http://localhost:4000", dir = path.resolve(process.env.SPACE_VERIFY_DIR || "artifacts/project-line/space-batch");
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const results = [], errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const page = await context.newPage(); page.on("pageerror", e => errors.push(String(e)));
const url = slug => origin + "/project-lines/space-exploration/" + slug + "/index.html";
async function check(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log("PASS " + name); }
  catch (error) { results.push({ name, passed: false, error: String(error) }); throw error; }
}
async function ready(p, slug, suffix = "") {
  await p.goto(url(slug) + suffix);
  await expect(p.locator("#render-mode")).not.toContainText("正在准备");
}
async function download(p, button, filename) {
  const pending = p.waitForEvent("download"); await p.getByRole("button", { name: button, exact: true }).click();
  const item = await pending; await item.saveAs(path.join(dir, filename));
  return path.join(dir, filename);
}
async function move(p, direction, times = 1) { for (let i = 0; i < times; i++) await p.locator('[data-direction="' + direction + '"]').click(); }
async function runRoute(p, id) { await p.locator("#run-" + id).click(); await expect(p.locator("#run-" + id)).toBeEnabled({ timeout: 20000 }); }
try {
  await check("着陆：真实下落、失败保存、回放与轨迹下载", async () => {
    await ready(page, "land-a-probe"); await expect(page.locator("#scene")).toHaveAttribute("data-renderer", "webgl");
    await page.locator("#scene").screenshot({ path: path.join(dir, "landing-cover.png") });
    await page.locator("#start").click(); await expect(page.locator("#result")).toBeVisible({ timeout: 25000 });
    await expect(page.locator("#result-title")).toHaveText("落地有点快");
    const r = await page.evaluate(() => JSON.parse(localStorage.getItem("systemedu:land-a-probe:v1"))[0]);
    expect(r.result.status).toBe("hard"); expect(r.result.impact).toBeGreaterThan(20); expect(r.frames.length).toBeGreaterThan(20);
    await page.locator("#replay").fill("0"); await expect(page.locator("#height")).toHaveText("60.0");
    await download(page, "下载着陆记录", "sample-landing.json");
    await page.reload(); await expect(page.locator("#records button")).toHaveCount(1);
  });
  await check("着陆：切换真实制动按钮改变结果，成功与失败一起保留", async () => {
    await page.locator("#start").click();
    // 决策和点击在同一个页面时钟内执行，避免自动化协议的往返延迟使读数过期。
    // 仍只读取可见仪表、点击同一按钮；不访问或改写私有模型状态。
    const completed = await page.evaluate(() => new Promise(resolve => {
      const began = performance.now();
      const timer = setInterval(() => {
        if (!document.querySelector("#result").hidden) { clearInterval(timer); resolve(true); return; }
        if (performance.now() - began > 65000) { clearInterval(timer); resolve(false); return; }
        const height = Number(document.querySelector("#height").textContent);
        const velocity = Number(document.querySelector("#speed").textContent) * (document.querySelector("#speed-label").textContent === "上升速度" ? 1 : -1);
        const brake = document.querySelector("#brake"), braking = brake.getAttribute("aria-pressed") === "true";
        const desired = velocity < -1.7 && (height < velocity ** 2 / 10.6 + 4 || height < 6);
        if (desired !== braking && !brake.disabled) brake.click();
      }, 90);
    }));
    expect(completed).toBe(true);
    await expect(page.locator("#result-title")).toHaveText("柔和着陆");
    await expect(page.locator("#records button")).toHaveCount(2);
    await page.screenshot({ path: path.join(dir, "landing-desktop.png"), fullPage: true });
  });
  await check("驾驶：障碍、绕行、取景、下载与刷新恢复", async () => {
    await ready(page, "drive-and-frame"); await expect(page.locator("#capture")).toBeDisabled();
    await move(page, "east"); await move(page, "east");
    await expect(page.locator("#guide")).toContainText("挡住"); await expect(page.locator("#scene")).toHaveAttribute("data-pose", "2,4");
    await move(page, "north", 3); await move(page, "east", 3); await expect(page.locator("#capture")).toBeEnabled();
    await page.locator("#scene").screenshot({ path: path.join(dir, "driving-cover.png") });
    await page.locator("#capture").click();
    const r = await page.evaluate(() => JSON.parse(localStorage.getItem("systemedu:drive-and-frame:v1"))[0]);
    expect(r.pose.x).toBe(5); expect(r.pose.z).toBe(1); expect(r.path.length).toBe(8); expect(r.actions.some(a => a.blocked)).toBe(true);
    expect(await page.locator("#photo").getAttribute("src")).toBe(r.image);
    await download(page, "下载照片", "sample-rover-photo.jpg"); await download(page, "下载路线", "sample-drive.json");
    await page.screenshot({ path: path.join(dir, "driving-desktop.png"), fullPage: true });
    await page.reload(); await expect(page.locator("#records button")).toHaveCount(1);
    await page.locator("#records button").first().click(); await expect(page.locator("#photo")).toBeVisible();
    await page.locator("#replay").fill("0"); await expect(page.locator("#capture")).toBeDisabled();
  });
  await check("驾驶：换目标和镜头方向确实影响拍照", async () => {
    await page.locator("#reset").click(); await page.locator('[data-target="dune"]').click();
    await move(page, "south", 2); await move(page, "east", 4); await move(page, "north");
    await expect(page.locator("#capture")).toBeDisabled();
    await page.locator("#look-right").click(); await page.locator("#look-right").click(); await expect(page.locator("#capture")).toBeEnabled(); await page.locator("#capture").click();
    const records = await page.evaluate(() => JSON.parse(localStorage.getItem("systemedu:drive-and-frame:v1")));
    expect(records[0].target).toBe("dune"); expect(records[0].image).not.toBe(records[1].image);
  });
  await check("规则：失败、修改、两条路线、unknown 与版本作证", async () => {
    await ready(page, "write-driving-rules"); await expect(page.locator("#save")).toBeDisabled();
    await runRoute(page, "training"); await expect(page.locator("#log")).toContainText("打滑");
    await page.locator("#rule-sand").selectOption("slow"); await page.locator("#rule-rock").selectOption("detour");
    await runRoute(page, "transfer"); await expect(page.locator("#log")).toContainText("没有看清");
    await page.locator("#rule-unknown").selectOption("stop");
    await runRoute(page, "training"); await expect(page.locator("#save")).toBeDisabled();
    await runRoute(page, "transfer"); await expect(page.locator("#save")).toBeEnabled();
    await page.locator("#scene").screenshot({ path: path.join(dir, "rules-cover.png") });
    await page.locator("#save").click();
    await download(page, "下载规则程序", "sample-driving-rules.json");
    const r = JSON.parse(await fs.readFile(path.join(dir, "sample-driving-rules.json"), "utf8"));
    expect(r.program.rules.unknown).toBe("stop"); expect(r.evidence.runs.filter(v => v.passed)).toHaveLength(2);
    await page.screenshot({ path: path.join(dir, "rules-desktop.png"), fullPage: true });
    await page.locator("#rule-clear").selectOption("slow"); await expect(page.locator("#save")).toBeDisabled();
    await page.reload(); await expect(page.locator("#rule-clear")).toHaveValue("slow"); await expect(page.locator("#save")).toBeDisabled();
  });
  await check("规则：程序导入真实执行，不信任完成标记；错误文件不覆盖", async () => {
    await page.locator("#import").setInputFiles(path.join(dir, "sample-driving-rules.json"));
    await expect(page.locator("#guide")).toContainText("导入草稿"); await expect(page.locator("#save")).toBeDisabled();
    await runRoute(page, "training"); await runRoute(page, "transfer"); await expect(page.locator("#save")).toBeEnabled();
    await page.locator("#import").setInputFiles({ name: "wrong.json", mimeType: "application/json", buffer: Buffer.from('{"completed":true}') });
    await expect(page.locator("#guide")).toContainText("不兼容"); await expect(page.locator("#rule-unknown")).toHaveValue("stop");
  });
  await check("手机、简化场景、可操作按钮及无横向溢出", async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await c.newPage(); p.on("pageerror", e => errors.push(String(e)));
    for (const slug of ["land-a-probe", "drive-and-frame", "write-driving-rules"]) {
      await ready(p, slug, "?renderer=canvas");
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await p.screenshot({ path: path.join(dir, slug + "-mobile.png"), fullPage: true });
      if (slug === "land-a-probe") { await p.locator("#start").tap(); await p.locator("#brake").tap(); await expect(p.locator("#brake")).toHaveAttribute("aria-pressed", "true"); }
      if (slug === "drive-and-frame") { await p.locator('[data-direction="north"]').tap(); await expect(p.locator("#moves")).toHaveText("1"); }
      if (slug === "write-driving-rules") { await p.locator("#rule-unknown").selectOption("stop"); await expect(p.locator("#rule-unknown")).toHaveValue("stop"); }
    }
    await c.close();
  });
  await check("存储损坏或配额失败时，不虚报保存成功", async () => {
    for (const mode of ["corrupt", "quota"]) {
      const c = await browser.newContext({ viewport: { width: 1000, height: 800 } });
      await c.addInitScript(mode => {
        if (mode === "quota") Storage.prototype.setItem = function() { throw new DOMException("quota", "QuotaExceededError"); };
        else localStorage.setItem("systemedu:land-a-probe:v1", "{broken");
      }, mode);
      const p = await c.newPage(); await ready(p, "land-a-probe", "?renderer=canvas");
      await p.locator("#start").click(); await p.locator("#restart").click();
      await expect(p.locator("#storage-status")).toContainText("没有写入");
      await expect(p.locator("#records button")).toHaveCount(1);
      if (mode === "corrupt") await p.evaluate(() => localStorage.setItem("systemedu:drive-and-frame:v1", "{broken"));
      await ready(p, "drive-and-frame", "?renderer=canvas");
      await move(p, "north", 3); await move(p, "east", 4); await p.locator("#capture").click();
      await expect(p.locator("#storage-status")).toContainText("没有写入");
      await expect(p.locator("#photo")).toBeVisible();
      if (mode === "corrupt") await p.evaluate(() => localStorage.setItem("systemedu:write-driving-rules:draft:v1", "{broken"));
      await ready(p, "write-driving-rules");
      if (mode === "corrupt") await expect(p.locator("#storage-status")).toContainText("旧草稿无法读取");
      await p.locator("#rule-sand").selectOption("slow");
      if (mode === "quota") await expect(p.locator("#storage-status")).toContainText("草稿没有写入");
      else expect(await p.evaluate(() => localStorage.getItem("systemedu:write-driving-rules:draft:v1"))).toBe("{broken");
      await c.close();
    }
  });
  await check("项目线入口、手机 3D、键盘及图形中断后继续操作", async () => {
    await page.goto(origin + "/library?view=lines&line=space-exploration");
    for (const slug of ["land-a-probe", "drive-and-frame", "write-driving-rules"]) {
      const href = "/explore/space-exploration/" + slug;
      await expect(page.locator('a[href="' + href + '"]').first()).toBeVisible();
      const p = await context.newPage(); p.on("pageerror", e => errors.push(String(e)));
      await p.goto(origin + href);
      await expect(p.frameLocator("iframe").locator("#render-mode")).not.toContainText("正在准备");
      await p.close();
    }
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await c.newPage(); p.on("pageerror", e => errors.push(String(e)));
    await ready(p, "drive-and-frame");
    await expect(p.locator("#scene")).toHaveAttribute("data-renderer", "webgl");
    await p.locator('[data-direction="north"]').tap();
    await expect(p.locator("#scene")).toHaveAttribute("data-pose", "1,3");
    await p.screenshot({ path: path.join(dir, "driving-mobile-webgl.png"), fullPage: true });
    await p.evaluate(() => document.querySelector("#camera-view canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
    await expect(p.locator("#scene")).toHaveAttribute("data-renderer", "canvas");
    await expect(p.locator("#scene")).toHaveAttribute("data-pose", "1,3");
    await p.keyboard.press("ArrowUp");
    await expect(p.locator("#scene")).toHaveAttribute("data-pose", "1,2");
    await move(p, "north"); await move(p, "east", 4); await p.locator("#capture").click();
    await expect(p.locator("#photo")).toBeVisible();
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await c.close();
  });
  expect(errors).toEqual([]);
} catch (error) { console.error(error); process.exitCode = 1; await page.screenshot({ path: path.join(dir, "failure.png"), fullPage: true }).catch(() => {}); }
finally {
  await fs.writeFile(path.join(dir, "verification.json"), JSON.stringify({ run_at: new Date().toISOString(), source: "automated-browser-not-child-trial", results, errors }, null, 2));
  await browser.close();
}
