// game.mjs — Playwright verification for game HTML files (fogsight 风格).
//
// Checks (all must pass for exit 0):
//   1. No fatal JS errors (pageerror / console.error, ignoring network noise)
//   2. Page is non-blank: 文字 + DOM 元素或 svg/canvas 任一即可
//   3. **Real interactivity**: 必须有 button/input/slider/draggable 至少一种 (game 必须能玩)
//   4. **Page responds to interaction**: 点击主按钮 / 拨滑块后页面有变化 (≥ 2% 截图差)
//   5. 同时通过 standalone + iframe 模式
//
// 不再检查:
//   - .game-sidebar (fogsight 不强制 sidebar)
//   - canvas 必须存在 (game 可以纯 SVG/DOM 实现)
//   - level 推进 (复杂多关卡是可选的, 不是硬要求)
//
// Usage:
//   node course_factory/validate/verify/game.mjs <html-path> [--out DIR]
//
// Output: structured JSON to stdout, screenshots to <out>/, exit 0=pass 1=fail.

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node course_factory/validate/verify/game.mjs <html-path> [--out DIR]');
  process.exit(1);
}
const htmlPath = path.resolve(args[0]);
const outArg = args.indexOf('--out');
const outDir = outArg >= 0 ? args[outArg + 1] : path.join(os.tmpdir(), 'verify_game');
fs.mkdirSync(outDir, { recursive: true });

const NETWORK_NOISE = /Failed to load resource|net::ERR_|favicon\.ico/i;
const kname = path.basename(htmlPath).replace('test_', '').replace('_game_v2.html', '').replace('.html', '');

// ---------------------------------------------------------------------------
// 页面内容 + 控件统计
// ---------------------------------------------------------------------------
async function pageContentScore(targetFrame) {
  return await targetFrame.evaluate(() => {
    const text = document.body ? (document.body.innerText || '').trim() : '';
    const cn = (text.match(/[一-龥]/g) || []).length;
    const en = (text.match(/[a-zA-Z]+/g) || []).length;
    const visibleEls = document.querySelectorAll('div, span, svg, canvas, p, h1, h2, h3, section').length;
    const svgPaths = document.querySelectorAll('svg path, svg circle, svg rect, svg line, svg text').length;
    const canvasCount = document.querySelectorAll('canvas').length;
    // 互动控件 — game 必须有
    const buttons = document.querySelectorAll('button').length;
    const inputs = document.querySelectorAll('input').length;
    const sliders = document.querySelectorAll('input[type=range]').length;
    const selects = document.querySelectorAll('select').length;
    const draggables = document.querySelectorAll('[draggable=true]').length;
    return {
      textLen: text.length, cn, en, visibleEls, svgPaths, canvasCount,
      buttons, inputs, sliders, selects, draggables,
    };
  });
}

// PNG 字节差异 (复用 anim 的逻辑)
function pngDifferenceRatio(buf1, buf2) {
  if (!buf1 || !buf2 || buf1.length === 0 || buf2.length === 0) return 0;
  const minLen = Math.min(buf1.length, buf2.length);
  const sizeDiffRatio = Math.abs(buf1.length - buf2.length) / Math.max(buf1.length, buf2.length);
  if (sizeDiffRatio > 0.05) return Math.min(1.0, sizeDiffRatio + 0.1);
  let diffBytes = 0;
  const step = Math.max(1, Math.floor(minLen / 5000));
  for (let i = 0; i < minLen; i += step) {
    if (buf1[i] !== buf2[i]) diffBytes++;
  }
  return diffBytes / (minLen / step);
}

// 触发首个可用交互 (滑块拨一下 / 按钮点击 / 拖拽元素 mousedown)
async function triggerInteraction(page, targetFrame, mode) {
  const target = mode === 'iframe' ? targetFrame : page;

  // 1. 优先滑块
  const sliders = await target.$$('input[type=range]');
  if (sliders.length > 0) {
    const sl = sliders[0];
    try {
      await sl.evaluate(el => {
        const min = parseFloat(el.min) || 0;
        const max = parseFloat(el.max) || 100;
        el.value = (min + max) / 2;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      return 'slider';
    } catch {}
  }

  // 2. 数字输入 + 任意提交按钮
  const numInputs = await target.$$('input[type=number]');
  if (numInputs.length > 0) {
    try {
      await numInputs[0].fill('5');
      const btn = await target.$('button');
      if (btn) await btn.click();
      return 'input+button';
    } catch {}
  }

  // 3. 任意按钮
  const buttons = await target.$$('button');
  if (buttons.length > 0) {
    try {
      // 优先非 lang/reset 按钮
      for (const b of buttons) {
        const txt = (await b.textContent() || '').trim();
        if (/lang|EN|中文|reset|重置/i.test(txt)) continue;
        await b.click({ timeout: 2000 });
        return `button:${txt.substring(0, 20)}`;
      }
      await buttons[0].click({ timeout: 2000 });
      return 'button:first';
    } catch {}
  }

  return 'none';
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
    const shell = path.join(os.tmpdir(), `verify_game_shell_${Date.now()}.html`);
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

  // (1) 初始截图 + 内容检查
  const t1Path = path.join(outDir, `${kname}_${mode}_t1.png`);
  const buf1 = await page.screenshot({ path: t1Path, fullPage: false });
  const content = await pageContentScore(targetFrame);

  // 内容非空白
  if (content.textLen < 30) issues.push(`page text too short (${content.textLen} chars)`);
  if (content.visibleEls < 5) issues.push(`too few DOM elements (${content.visibleEls})`);
  if (buf1.length < 8000) issues.push(`screenshot too small (${buf1.length} bytes), likely blank`);

  // (2) 真交互检测: game 必须有控件 (滑块/按钮/输入/拖拽 任一)
  const interactiveCount = content.buttons + content.inputs + content.sliders + content.draggables;
  if (interactiveCount === 0) {
    issues.push(`no interactive controls (game must have buttons/sliders/inputs/draggables)`);
  }

  // (3) 触发交互, 看页面是否有变化
  let interactionMethod = 'skipped';
  let buf2 = buf1;
  let interactionDiff = 0;
  if (interactiveCount > 0) {
    interactionMethod = await triggerInteraction(page, targetFrame, mode);
    await page.waitForTimeout(2000);
    const t2Path = path.join(outDir, `${kname}_${mode}_t2.png`);
    buf2 = await page.screenshot({ path: t2Path, fullPage: false });
    interactionDiff = pngDifferenceRatio(buf1, buf2);
    if (interactionMethod !== 'none' && interactionDiff < 0.02) {
      issues.push(`page does not respond to interaction (${interactionMethod}, diff=${(interactionDiff * 100).toFixed(1)}%, expected ≥ 2%)`);
    }
  }

  // (4) JS 致命错误
  if (errors.length) issues.push(`${errors.length} JS error(s)`);

  await ctx.close();

  return {
    mode,
    ok: issues.length === 0,
    issues,
    errors: errors.slice(0, 5),
    contentStats: content,
    interactionMethod,
    interactionDiff: Math.round(interactionDiff * 1000) / 10 + '%',
    t1Bytes: buf1.length,
    t2Bytes: buf2.length,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log(`Verifying game: ${kname}`);
console.log(`  HTML: ${htmlPath}`);
console.log(`  Out:  ${outDir}`);

const browser = await chromium.launch();
const standalone = await verify(browser, 'standalone');
console.log(`  standalone: ${standalone.ok ? 'PASS' : 'FAIL'} (text=${standalone.contentStats.textLen}, btns=${standalone.contentStats.buttons}, sliders=${standalone.contentStats.sliders}, interaction=${standalone.interactionMethod}, diff=${standalone.interactionDiff})`);
if (!standalone.ok) standalone.issues.forEach(i => console.log(`    - ${i}`));

const iframe = await verify(browser, 'iframe');
console.log(`  iframe:     ${iframe.ok ? 'PASS' : 'FAIL'} (text=${iframe.contentStats.textLen}, btns=${iframe.contentStats.buttons}, interaction=${iframe.interactionMethod}, diff=${iframe.interactionDiff})`);
if (!iframe.ok) iframe.issues.forEach(i => console.log(`    - ${i}`));

await browser.close();

const allOk = standalone.ok && iframe.ok;
const report = { file: path.basename(htmlPath), kname, allOk, standalone, iframe, outDir };
console.log('\n' + JSON.stringify(report, null, 2));
console.log(`\nRESULT: ${allOk ? 'PASS' : 'FAIL'}`);
process.exit(allOk ? 0 : 1);
