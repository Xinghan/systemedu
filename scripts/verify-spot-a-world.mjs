import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

// 使用真实按钮和拖动操作验证完整作品流程；不注入游戏内部状态。
const origin = "http://localhost:4000";
const gamePath = "/project-lines/space-exploration/spot-a-world/index.html";
const key = "systemedu:spot-a-world:v1";
const dir = path.resolve("artifacts/project-line/spot-a-world");
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const results = [];
const errors = [];

async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: String(error) }); throw error; }
}
async function ready(page, url = gamePath) {
  await page.goto(origin + url);
  await expect(page.locator("#loading")).toBeHidden();
}
async function aimMoon(page) {
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "镜头向左", exact: true }).click();
  await page.getByRole("button", { name: "镜头向上", exact: true }).click();
  await page.getByRole("button", { name: "放大", exact: true }).click();
  await expect(page.locator("#shutter")).toBeEnabled();
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(String(error)));
  await check("学生系统项目线入口与体验路由", async () => {
    await page.goto(origin + "/project-lines");
    await expect(page).toHaveURL(/\/library\?view=lines$/);
    await expect(page.getByRole("heading", { name: "一个小项目，一件自己的作品。" })).toBeVisible();
    await page.screenshot({ path: path.join(dir, "project-line-desktop.png"), fullPage: true });
    await page.getByRole("link", { name: /我的第一张星球照片/ }).click();
    await expect(page.frameLocator("iframe").locator("#loading")).toBeHidden();
  });
  await check("3D 场景加载与亲手操作门槛", async () => {
    await ready(page);
    await expect(page.locator("#sky")).toHaveAttribute("data-renderer", "webgl");
    await expect(page.locator("#shutter")).toBeDisabled();
    await page.getByRole("button", { name: "给我一个提示" }).click();
    await expect(page.locator("#shutter")).toBeDisabled();
    await aimMoon(page);
    await page.screenshot({ path: path.join(dir, "observatory-desktop.png"), fullPage: true });
  });
  await check("实际取景裁剪、作品保存、照片和 JSON 下载", async () => {
    const before = await page.locator("#universe").screenshot();
    await page.locator("#shutter").click();
    await expect(page.locator("#photo-dialog")).toBeVisible();
    await expect(page.locator("#save-status")).toContainText("已保存");
    await page.getByRole("button", { name: "明暗交界", exact: true }).click();
    const photo = await page.evaluate(key => JSON.parse(localStorage.getItem(key))[0], key);
    expect(photo.origin).toBe("simulated");
    expect(photo.evidence.manual_pan && photo.evidence.manual_zoom && photo.evidence.target_fully_in_frame).toBe(true);
    expect(photo.evidence.actions.some(action => action.type === "pan")).toBe(true);
    expect(photo.note).toBe("明暗交界");
    const cropMatches = await page.evaluate(image => {
      const source = document.querySelector("#universe"), frame = document.querySelector("#capture-frame").getBoundingClientRect(), canvasBox = source.getBoundingClientRect();
      const output = document.createElement("canvas"); output.width = output.height = 720;
      output.getContext("2d").drawImage(source, (frame.left - canvasBox.left) * source.width / canvasBox.width, (frame.top - canvasBox.top) * source.height / canvasBox.height, frame.width * source.width / canvasBox.width, frame.height * source.height / canvasBox.height, 0, 0, 720, 720);
      return image === output.toDataURL("image/jpeg", .91);
    }, photo.image);
    expect(cropMatches).toBe(true);
    expect(before.length).toBeGreaterThan(10000);
    let downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载照片" }).click();
    let download = await downloadPromise;
    await download.saveAs(path.join(dir, "sample-observation.png"));
    expect((await fs.stat(path.join(dir, "sample-observation.png"))).size).toBeGreaterThan(10000);
    downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载观测记录", exact: true }).click();
    download = await downloadPromise;
    await download.saveAs(path.join(dir, "sample-observation.json"));
    const exported = JSON.parse(await fs.readFile(path.join(dir, "sample-observation.json"), "utf8"));
    expect(exported.image).toBe(photo.image);
    expect(exported.artifact_id).toBe("sky-observation");
    await page.screenshot({ path: path.join(dir, "photo-result-desktop.png"), fullPage: true });
  });
  await check("刷新恢复相册与镜头，恢复不冒充新的操作", async () => {
    await page.reload(); await expect(page.locator("#loading")).toBeHidden();
    await expect(page.locator("#album-count")).toHaveText("1");
    await page.locator("#open-album").click();
    await expect(page.locator(".album-item")).toHaveCount(1);
    await page.getByRole("button", { name: "恢复这个镜头" }).click();
    await expect(page.locator("#zoom-value")).toHaveText("1.2×");
    await expect(page.locator("#shutter")).toBeDisabled();
    await page.locator("#universe").press("ArrowRight");
    await page.locator("#universe").press("ArrowLeft");
    await page.getByRole("button", { name: "缩小", exact: true }).click();
    await expect(page.locator("#shutter")).toBeEnabled();
  });
  await check("火星选择、不同取景与越界禁拍", async () => {
    await ready(page);
    await page.locator('[data-target="mars"]').click();
    for (let i = 0; i < 4; i++) await page.locator('[data-direction="right"]').click();
    await page.getByRole("button", { name: "放大", exact: true }).click();
    await expect(page.locator("#shutter")).toBeEnabled();
    await page.locator("#shutter").click();
    await expect(page.locator("#photo-target")).toHaveText("火星");
    await page.locator("#retake").click();
    for (let i = 0; i < 12; i++) await page.locator('[data-direction="left"]').click();
    await expect(page.locator("#shutter")).toBeDisabled();
    const photos = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    expect(photos[0].image).not.toBe(photos[1].image);
  });
  await check("简化画面、触屏拖动与窄屏布局", async () => {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await mobile.newPage(); p.on("pageerror", error => errors.push(String(error)));
    await p.goto(origin + "/project-lines");
    await expect(p.getByRole("navigation", { name: "项目库视图" }).getByRole("link", { name: "项目线", exact: true })).toHaveAttribute("aria-current", "page");
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await p.screenshot({ path: path.join(dir, "project-line-mobile.png"), fullPage: true });
    await ready(p, gamePath + "?renderer=canvas");
    await expect(p.locator("#sky")).toHaveAttribute("data-renderer", "canvas");
    const box = await p.locator("#universe").boundingBox();
    const client = await mobile.newCDPSession(p);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 140, y: box.y + 300 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + 250, y: box.y + 300 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await p.locator('[data-direction="up"]').click();
    await p.locator("#zoom-in").click();
    await expect(p.locator("#shutter")).toBeEnabled();
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await p.screenshot({ path: path.join(dir, "observatory-mobile.png"), fullPage: true });
    await p.locator("#shutter").click();
    await expect(p.locator("#save-status")).toContainText("已保存");
    await p.screenshot({ path: path.join(dir, "photo-result-mobile.png"), fullPage: true });
    await mobile.close();
  });
  await check("存储损坏和配额不足均不虚报保存成功", async () => {
    for (const mode of ["corrupt", "quota"]) {
      const c = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await c.addInitScript(({ mode, key }) => {
        if (mode === "corrupt") localStorage.setItem(key, "{broken");
        else Storage.prototype.setItem = function() { throw new DOMException("test quota", "QuotaExceededError"); };
      }, { mode, key });
      const p = await c.newPage();
      await ready(p, gamePath + "?renderer=canvas"); await aimMoon(p); await p.locator("#shutter").click();
      await expect(p.locator("#save-status")).toContainText("没有写入");
      await expect(p.locator("#download-photo")).toBeEnabled();
      await c.close();
    }
  });
  expect(errors).toEqual([]);
  await context.close();
} catch (error) {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      await page.screenshot({ path: path.join(dir, "failure.png"), fullPage: true }).catch(() => {});
      console.log(await page.locator("#guide-text").textContent().catch(() => "no guide"));
    }
  }
  console.error(error); process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(dir, "verification.json"), JSON.stringify({ run_at: new Date().toISOString(), browser: browser.version(), source: "automated-browser-test-not-child-trial", results, errors }, null, 2));
  await browser.close();
}
