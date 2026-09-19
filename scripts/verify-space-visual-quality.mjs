import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

// 运行态截图和操作证据；美术质量仍需逐张查看，不能由像素差或面数判定。
const dir = path.resolve("artifacts/space-visual-quality");
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ["--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [], checks = [], stats = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const url = slug => `http://localhost:4000/project-lines/space-exploration/${slug}/index.html`;
const canvasImage = () => page.locator("#scene>canvas").evaluate(c => c.toDataURL());
try {
  for (const [slug, kind] of [["land-a-probe", "lander"], ["drive-and-frame", "rover"]]) {
    await page.goto(url(slug));
    await expect(page.locator("#scene")).toHaveAttribute("data-renderer", "webgl");
    await expect(page.locator("#scene")).toHaveAttribute("data-draw-calls", /\d+/);
    await page.screenshot({ path: path.join(dir, `${kind}-desktop.png`), fullPage: true });
    const initial = await canvasImage(), pose = await page.locator("#scene").getAttribute("data-pose");
    await page.locator('[data-view="inspect"]').click();
    await expect(page.locator(".mission-instruments")).toBeHidden();
    await expect.poll(canvasImage).not.toBe(initial);
    await page.locator("#scene").screenshot({ path: path.join(dir, `${kind}-detail.png`) });
    const near = await canvasImage();
    await page.getByRole("button", { name: "向右环视", exact: true }).click();
    await expect.poll(canvasImage).not.toBe(near);
    expect(await page.locator("#scene").getAttribute("data-pose")).toBe(pose);
    checks.push(`${kind}：近看、环视改变画面且不改变任务位置`);
    const svg = await page.evaluate(async kind => (await import("../_shared/mission-vector.js")).vehicleSVG(kind), kind);
    await fs.writeFile(path.join(dir, `${kind}-vector.svg`), svg);
    stats.push({ kind, ...await page.locator("#scene").evaluate(n => ({ ...n.dataset })) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-view="follow"]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(dir, `${kind}-mobile.png`), fullPage: true });
    await page.locator('[data-view="inspect"]').click();
    await expect(page.locator(".mission-instruments")).toBeHidden();
    await page.locator("#scene").screenshot({ path: path.join(dir, `${kind}-mobile-detail.png`) });
    await page.setViewportSize({ width: 1440, height: 1050 });
  }
  await page.goto(url("drive-and-frame"));
  await expect(page.locator("#scene")).toHaveAttribute("data-renderer", "webgl");
  // 快速连续输入后立刻拍摄，验证导出对齐逻辑位置而非动画中间态。
  await page.evaluate(() => {
    for (const d of ["north", "north", "north", "east", "east", "east", "east"]) document.querySelector(`[data-direction="${d}"]`).click();
    document.querySelector("#capture").click();
  });
  const record = () => page.evaluate(() => JSON.parse(localStorage.getItem("systemedu:drive-and-frame:v1"))[0]);
  const first = await record();
  expect(first.pose).toEqual({ x: 5, z: 1, yaw: Math.PI / 2 });
  expect(first.visual_version).toBe("mars-expedition/2");
  const dimensions = await page.locator("#photo").evaluate(async img => { await img.decode(); return [img.naturalWidth, img.naturalHeight]; });
  expect(dimensions).toEqual([960, 600]);
  await fs.writeFile(path.join(dir, "rover-export.jpg"), Buffer.from(first.image.split(",")[1], "base64"));
  await page.locator('[data-view="overview"]').click();
  await page.getByRole("button", { name: "向右环视", exact: true }).click();
  await page.locator("#capture").click();
  expect((await record()).image).toBe(first.image);
  checks.push("快速移动后导出 960×600；主观察视角不改变车载相机照片");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("#scene")).toHaveAttribute("data-renderer", "webgl");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#moves")).toHaveText("1");
  checks.push("减少动态效果时键盘驾驶仍可用");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(url("land-a-probe"));
  await expect(page.locator("#scene")).toHaveAttribute("data-renderer", "webgl");
  const performance = await page.evaluate(async () => {
    const gl = document.querySelector("#scene>canvas").getContext("webgl2"), ext = gl.getExtension("WEBGL_debug_renderer_info");
    document.querySelector("#start").click(); document.querySelector("#brake").click();
    const intervals = []; let before = await new Promise(requestAnimationFrame);
    for (let i = 0; i < 60; i++) { const now = await new Promise(requestAnimationFrame); intervals.push(now - before); before = now; }
    intervals.sort((a, b) => a - b);
    return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unavailable", median_ms: intervals[30], p95_ms: intervals[57], mean_fps: 60000 / intervals.reduce((a, b) => a + b), scene: { ...document.querySelector("#scene").dataset } };
  });
  await page.locator("#scene").screenshot({ path: path.join(dir, "lander-braking.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [slug, kind] of [["land-a-probe", "lander"], ["drive-and-frame", "rover"]]) {
    await page.goto(url(slug) + "?renderer=canvas");
    await expect(page.locator("#scene")).toHaveAttribute("data-renderer", "canvas");
    await expect(page.locator(".orbit-options")).toBeHidden();
    await page.locator("#scene").screenshot({ path: path.join(dir, `${kind}-fallback.png`) });
    await page.locator('[data-view="inspect"]').click();
    await expect(page.locator(".mission-instruments")).toBeHidden();
    await page.locator("#scene").screenshot({ path: path.join(dir, `${kind}-fallback-detail.png`) });
  }
  checks.push("手机矢量兼容画面可近看；隐藏不可用的三维旋转按钮");
  expect(errors).toEqual([]);
  await fs.writeFile(path.join(dir, "visual-inspection.json"), JSON.stringify({ checks, stats, performance, errors }, null, 2));
  console.log(JSON.stringify({ checks, performance, errors }, null, 2));
} finally { await browser.close(); }
