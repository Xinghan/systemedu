// DB regression verifier for all animation/game HTML saved in lesson_content.
//
// Usage (after Python extract step writes manifest):
//   node scripts/verify/db_regression.mjs <manifest-json> [--out DIR] [--json PATH]
//
// manifest-json format (produced by scripts/verify/_extract_db_html.py):
//   {
//     "items": [
//       { "project": "...", "knode_id": 0, "key": "anim_...", "kind": "animation", "htmlFile": "/tmp/.../file.html" },
//       ...
//     ]
//   }
//
// Output: JSON report to stdout (summary at end), optional --json PATH.
// Exit code: 0 if all pass, 1 if any fail.

import { chromium } from "playwright";
import fs from "fs";
import os from "os";
import path from "path";

const args = process.argv.slice(2);
const manifestPath = args[0];
if (!manifestPath || manifestPath.startsWith("--")) {
  console.error(
    "usage: node scripts/verify/db_regression.mjs <manifest-json> [--json PATH] [--out DIR]",
  );
  process.exit(2);
}
function arg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const jsonPath = arg("--json");
const outDir = arg("--out") || path.join(os.tmpdir(), "db_regression");
fs.mkdirSync(outDir, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const items = manifest.items || [];
if (!items.length) {
  console.log("no items to verify");
  process.exit(0);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

async function verifyHtml(htmlFile, kind) {
  const page = await ctx.newPage();
  const errors = [];
  // 忽略外部资源加载失败（Google Fonts / CDN 偶发 net::ERR_*）—
  // 这是网络环境问题，不是页面代码 bug。
  const NETWORK_NOISE = /Failed to load resource|net::ERR_|favicon\.ico/i;
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (NETWORK_NOISE.test(text)) return;
    errors.push("console: " + text);
  });

  let info = null;
  let ok = false;
  let reason = "";
  try {
    await page.goto("file://" + htmlFile, { timeout: 15000 });
    await page.waitForTimeout(1500);
    info = await page.evaluate(() => {
      // 选"最大"的 canvas — 有些游戏有装饰性小 canvas + 主 canvas
      const canvases = Array.from(document.querySelectorAll("canvas"));
      const c = canvases
        .slice()
        .sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0] || null;
      const title = document.getElementById("title")?.textContent || "";
      // DOM-only 游戏回退信号：可见交互元素数量
      const interactiveCount =
        document.querySelectorAll("button,input,select,[role=button],.clickable").length;
      const bodyText = (document.body?.innerText || "").trim();
      const result = {
        hasCanvas: !!c,
        canvasCount: canvases.length,
        canvasW: c ? c.width : 0,
        canvasH: c ? c.height : 0,
        clientW: c ? c.clientWidth : 0,
        clientH: c ? c.clientHeight : 0,
        hasAnimRuntime: typeof AnimRuntime !== "undefined",
        title,
        nonBlackPixels: 0,
        sampled: 0,
        interactiveCount,
        bodyTextLen: bodyText.length,
      };
      if (c) {
        try {
          const cctx = c.getContext("2d");
          const sampleW = Math.min(c.width || 200, 400);
          const sampleH = Math.min(c.height || 200, 400);
          if (sampleW > 0 && sampleH > 0) {
            const data = cctx.getImageData(0, 0, sampleW, sampleH).data;
            let n = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i] + data[i + 1] + data[i + 2] > 30) n++;
            }
            result.nonBlackPixels = n;
            result.sampled = data.length / 4;
          }
        } catch (e) {
          result.pixelError = String(e);
        }
      }
      return result;
    });

    const checks = [];
    // DOM-rich 信号：有可交互元素 + 足够文本。游戏首帧 canvas 可能是空的
    // （等用户交互才绘制），但只要 UI 已构建完整就说明没有 JS 层 crash。
    const isDomRich = info.interactiveCount >= 2 && info.bodyTextLen >= 20;
    if (kind === "game") {
      // game：canvas 可选；只要（a）canvas 有像素 或（b）DOM 已充分渲染 即可。
      if (!info.hasCanvas && !isDomRich) checks.push("no canvas and no DOM UI");
      if (info.hasCanvas && !isDomRich) {
        if (info.clientH <= 100) checks.push(`canvas clientH=${info.clientH}`);
        if (info.clientW <= 100) checks.push(`canvas clientW=${info.clientW}`);
        if (info.nonBlackPixels < 50)
          checks.push(`only ${info.nonBlackPixels} non-black pixels (black)`);
      }
    } else {
      // animation：canvas 必须存在、有尺寸、有非黑像素
      if (!info.hasCanvas) checks.push("no canvas");
      if (info.hasCanvas) {
        if (info.clientH <= 100) checks.push(`canvas clientH=${info.clientH}`);
        if (info.clientW <= 100) checks.push(`canvas clientW=${info.clientW}`);
        if (info.nonBlackPixels < 50)
          checks.push(`only ${info.nonBlackPixels} non-black pixels (black)`);
      }
    }
    // AnimRuntime 与 #title 仅新格式动画有，不强制要求。
    if (errors.length) checks.push(`${errors.length} JS errors`);

    ok = checks.length === 0;
    reason = checks.join("; ");
  } catch (e) {
    reason = "navigation failed: " + e.message;
  } finally {
    await page.close();
  }

  return { ok, reason, info, errors: errors.slice(0, 5) };
}

const results = [];
for (const item of items) {
  const verdict = await verifyHtml(item.htmlFile, item.kind);
  results.push({ ...item, ...verdict });
  const mark = verdict.ok ? "PASS" : "FAIL";
  console.log(
    `[${mark}] ${item.project} k${item.knode_id} ${item.kind} ${item.key}: ${verdict.reason || "ok"}`,
  );
}

await browser.close();

const summary = {
  total: results.length,
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  byProject: {},
};
for (const r of results) {
  const p = (summary.byProject[r.project] ||= { total: 0, passed: 0, failed: 0 });
  p.total++;
  if (r.ok) p.passed++;
  else p.failed++;
}

const report = { summary, results };
if (jsonPath) fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(summary, null, 2));

process.exit(summary.failed > 0 ? 1 : 0);
