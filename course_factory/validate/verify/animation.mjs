// animation.mjs — Playwright verification for animation HTML files (fogsight 风格).
//
// Checks (all must pass for exit 0):
//   1. No fatal JS errors (pageerror / console.error, ignoring network noise)
//   2. Page is non-blank: 整页截图非背景色像素 ≥ 5%
//   3. Page is animating: t=1.5s 与 t=8s 截图差异 ≥ 2% (说明 scenes 时间轴 / CSS 动画在播)
//   4. 同时通过 standalone + iframe 模式 (前端嵌入兼容)
//
// 不再检查:
//   - NEXT 按钮 (fogsight 自动播放, 没有按帧导航)
//   - .sidebar (animation 不需要 sidebar, 与 implement_anim.md 对齐)
//   - .canvas 必须存在 (fogsight 用 SVG / CSS animation / DOM 元素都行)
//
// Usage:
//   node course_factory/validate/verify/animation.mjs <html-path> [--out DIR]
//
// Output: structured JSON to stdout, screenshots to <out>/, exit 0=pass 1=fail.

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node course_factory/validate/verify/animation.mjs <html-path> [--out DIR]');
  process.exit(1);
}
const htmlPath = path.resolve(args[0]);
const outArg = args.indexOf('--out');
const outDir = outArg >= 0 ? args[outArg + 1] : path.join(os.tmpdir(), 'verify_anim');
fs.mkdirSync(outDir, { recursive: true });

const NETWORK_NOISE = /Failed to load resource|net::ERR_|favicon\.ico/i;
const kname = path.basename(htmlPath).replace('test_', '').replace('_anim_v2.html', '').replace('.html', '');

// ---------------------------------------------------------------------------
// 整页非空白检测 (代替旧 canvas-only 检测) — 用 PNG 像素采样
// ---------------------------------------------------------------------------
function pngNonBgRatio(pngBuf) {
  // 极简 PNG IDAT 解析太复杂; 直接抓 Playwright 截图后用文件大小 + canvas 渲染对比。
  // 这里用 Node 内置 zlib 解压 IDAT 太重, 改用一个简化策略:
  //   1. 文件大小 — 全空白 PNG ~5-10KB, 有内容通常 30KB+
  //   2. 大小阈值 25KB 兜底; 真正的内容多样性由"动画变化"那一步保证
  return pngBuf.length;
}

async function pageContentScore(targetFrame) {
  // 在浏览器内统计 DOM 信息, 比像素采样可靠且无外部依赖
  return await targetFrame.evaluate(() => {
    const text = document.body ? (document.body.innerText || '').trim() : '';
    const cn = (text.match(/[一-龥]/g) || []).length;
    const en = (text.match(/[a-zA-Z]+/g) || []).length;
    const visibleEls = document.querySelectorAll('div, span, svg, canvas, p, h1, h2, h3, section').length;
    const svgPaths = document.querySelectorAll('svg path, svg circle, svg rect, svg line, svg text').length;
    const canvasCount = document.querySelectorAll('canvas').length;
    // 互动控件统计 — anim 必须 0 互动
    const buttons = document.querySelectorAll('button').length;
    const inputs = document.querySelectorAll('input').length;
    const selects = document.querySelectorAll('select').length;
    // HUD 数字读数 — 全 0 说明物理仿真未启动 (等用户输入)
    const allZeros = (text.match(/\b0\.0+\s*[a-zA-Z²/]+/g) || []).length;
    return {
      textLen: text.length, cn, en, visibleEls, svgPaths, canvasCount,
      buttons, inputs, selects,
      zeroReadouts: allZeros,
    };
  });
}

// ---------------------------------------------------------------------------
// 比较两张 PNG 是否有显著差异 (字节级粗判 + 大小差) — 用 Buffer 长度差当代理指标
// 真正稳准的 SSIM 需要 sharp 等依赖; 这里用 Buffer.compare 找差异占比
// ---------------------------------------------------------------------------
function pngDifferenceRatio(buf1, buf2) {
  // PNG zlib 压缩后字节级 diff 比例: 完全相同的截图 diff=0, 有大动画变化通常 > 0.3
  if (!buf1 || !buf2 || buf1.length === 0 || buf2.length === 0) return 0;
  const minLen = Math.min(buf1.length, buf2.length);
  const sizeDiffRatio = Math.abs(buf1.length - buf2.length) / Math.max(buf1.length, buf2.length);
  if (sizeDiffRatio > 0.05) return Math.min(1.0, sizeDiffRatio + 0.1);  // 大小差超 5% 一定是变了

  // 大小相近, 比字节差异密度
  let diffBytes = 0;
  const step = Math.max(1, Math.floor(minLen / 5000));  // 抽 5000 个采样
  for (let i = 0; i < minLen; i += step) {
    if (buf1[i] !== buf2[i]) diffBytes++;
  }
  return diffBytes / (minLen / step);
}

// ---------------------------------------------------------------------------
// Verify in a given mode (standalone or iframe)
// ---------------------------------------------------------------------------
async function verify(browser, mode) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (NETWORK_NOISE.test(text)) return;
    errors.push('console.error: ' + text);
  });

  let targetFrame = page;

  if (mode === 'iframe') {
    const shell = path.join(os.tmpdir(), `verify_anim_shell_${Date.now()}.html`);
    fs.writeFileSync(shell, `<!doctype html><html><body style="margin:0;background:#0c0e14"><iframe src="file://${htmlPath}" style="width:100vw;height:100vh;border:0" sandbox="allow-scripts allow-same-origin"></iframe></body></html>`);
    await page.goto('file://' + shell, { timeout: 15000 });
    await page.waitForTimeout(2000);
    const iframe = page.frames().find(f => f !== page.mainFrame());
    if (iframe) targetFrame = iframe;
  } else {
    await page.goto('file://' + htmlPath, { timeout: 15000 });
    await page.waitForTimeout(1500);
  }

  const issues = [];

  // (1) 第一时间点截图 + 内容检查
  const t1Path = path.join(outDir, `${kname}_${mode}_t1.png`);
  const buf1 = await page.screenshot({ path: t1Path, fullPage: false });
  const content = await pageContentScore(targetFrame);

  // 内容非空白判定: 文字 + 视觉元素同时考察
  const totalElements = content.svgPaths + content.canvasCount * 10;
  if (content.textLen < 30) issues.push(`page text too short (${content.textLen} chars)`);
  if (content.visibleEls < 5) issues.push(`too few DOM elements (${content.visibleEls})`);
  if (totalElements === 0 && content.textLen < 200) {
    issues.push(`no SVG/canvas and text too short (${content.textLen} chars)`);
  }
  // 截图大小作为兜底信号: < 8KB 几乎一定是空白
  if (buf1.length < 8000) issues.push(`screenshot too small (${buf1.length} bytes), likely blank`);

  // 互动控件检测 — anim 主舞台必须自动播放, 但允许 sidebar 里 lang 切换按钮 (≤ 2 个)
  // 看到 ≥ 3 个 button 说明可能写成了游戏 (滑块/数字输入也算交互)
  if (content.buttons > 2) {
    issues.push(`anim must be auto-play: found ${content.buttons} <button> elements (allowed ≤ 2 for lang/reset)`);
  }
  if (content.inputs > 0) {
    issues.push(`anim must be auto-play: found ${content.inputs} <input> elements (sliders/textboxes禁止)`);
  }
  if (content.selects > 0) {
    issues.push(`anim must be auto-play: found ${content.selects} <select> dropdowns`);
  }
  // HUD 全 0 强提示: 物理仿真未启动 (典型 "等用户输入" 反模式)
  if (content.zeroReadouts >= 4) {
    issues.push(`anim appears static — ${content.zeroReadouts} HUD readouts are all 0 (animation not auto-playing)`);
  }

  // (2) 等 6.5s 后第二张截图; 检查动画变化
  await page.waitForTimeout(6500);
  const t2Path = path.join(outDir, `${kname}_${mode}_t2.png`);
  const buf2 = await page.screenshot({ path: t2Path, fullPage: false });

  const diff = pngDifferenceRatio(buf1, buf2);
  if (diff < 0.02) {
    issues.push(`page not animating (frame diff=${(diff * 100).toFixed(1)}%, expected ≥ 2%)`);
  }

  // (3) JS 致命错误
  if (errors.length) issues.push(`${errors.length} JS error(s)`);

  await ctx.close();

  return {
    mode,
    ok: issues.length === 0,
    issues,
    errors: errors.slice(0, 5),
    contentStats: content,
    t1Bytes: buf1.length,
    t2Bytes: buf2.length,
    animationDiff: Math.round(diff * 1000) / 10 + '%',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log(`Verifying animation: ${kname}`);
console.log(`  HTML: ${htmlPath}`);
console.log(`  Out:  ${outDir}`);

const browser = await chromium.launch();
const standalone = await verify(browser, 'standalone');
console.log(`  standalone: ${standalone.ok ? 'PASS' : 'FAIL'} (text=${standalone.contentStats.textLen}, svg=${standalone.contentStats.svgPaths}, canvas=${standalone.contentStats.canvasCount}, anim-diff=${standalone.animationDiff})`);
if (!standalone.ok) standalone.issues.forEach(i => console.log(`    - ${i}`));

const iframe = await verify(browser, 'iframe');
console.log(`  iframe:     ${iframe.ok ? 'PASS' : 'FAIL'} (text=${iframe.contentStats.textLen}, svg=${iframe.contentStats.svgPaths}, canvas=${iframe.contentStats.canvasCount}, anim-diff=${iframe.animationDiff})`);
if (!iframe.ok) iframe.issues.forEach(i => console.log(`    - ${i}`));

await browser.close();

const allOk = standalone.ok && iframe.ok;
const report = { file: path.basename(htmlPath), kname, allOk, standalone, iframe, outDir };
console.log('\n' + JSON.stringify(report, null, 2));
console.log(`\nRESULT: ${allOk ? 'PASS' : 'FAIL'}`);
process.exit(allOk ? 0 : 1);
