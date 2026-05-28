// object.mjs — Playwright verification for 3D object HTML (course_factory F3 品类).
//
// 3D object 与 animation/game 不同: 它是"可旋转探索的实物 3D 展示", 不是自动播放动画,
// 也不是调参游戏。因此**不**用 animation.mjs 的"帧差 ≥ 2% 自动播放"判活 (那会逼 3D 去
// 自动旋转, 违背交互探索本质)。这里主动模拟 OrbitControls 拖拽, 验证 3D 真能被转动。
//
// Checks (all must pass for exit 0):
//   1. No fatal JS errors
//   2. WebGL canvas 存在且非空白 (有渲染内容)
//   3. **拖拽前后画面真变** — 在 canvas 上模拟鼠标拖拽 (OrbitControls 转视角), 截图差 ≥ 2%
//      (这是验"可旋转", 而非验"自动播放")
//   4. 米黄手册风: body 背景接近 #f3ecdc, 不是深空 oklch 深蓝紫
//   5. 同时通过 standalone + iframe
//
// Usage: node course_factory/validate/verify/object.mjs <html-path> [--out DIR]

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node course_factory/validate/verify/object.mjs <html-path> [--out DIR]');
  process.exit(1);
}
const htmlPath = path.resolve(args[0]);
const outArg = args.indexOf('--out');
const outDir = outArg >= 0 ? args[outArg + 1] : path.join(os.tmpdir(), 'verify_3d');
fs.mkdirSync(outDir, { recursive: true });

const NETWORK_NOISE = /Failed to load resource|net::ERR_|favicon\.ico/i;
const kname = path.basename(htmlPath).replace('test_3d_', '').replace('test_', '').replace('.html', '');

function pngDiffRatio(buf1, buf2) {
  if (!buf1 || !buf2 || buf1.length === 0 || buf2.length === 0) return 0;
  const minLen = Math.min(buf1.length, buf2.length);
  const sizeDiffRatio = Math.abs(buf1.length - buf2.length) / Math.max(buf1.length, buf2.length);
  if (sizeDiffRatio > 0.05) return Math.min(1.0, sizeDiffRatio + 0.1);
  let diffBytes = 0;
  const step = Math.max(1, Math.floor(minLen / 5000));
  for (let i = 0; i < minLen; i += step) if (buf1[i] !== buf2[i]) diffBytes++;
  return diffBytes / (minLen / step);
}

async function sceneStats(targetFrame) {
  return await targetFrame.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    // WebGL canvas 检测
    let hasWebGL = false;
    for (const c of canvases) {
      const ctx = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (ctx) { hasWebGL = true; break; }
    }
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const text = document.body ? (document.body.innerText || '').trim() : '';
    return {
      canvasCount: canvases.length,
      hasWebGL,
      bodyBg,
      textLen: text.length,
      buttons: document.querySelectorAll('button').length,
    };
  });
}

// 判断 body 背景是否米黄系 (R,G 高, 偏暖) 而非深空 (暗蓝紫)
function isWarmPaper(rgbStr) {
  const m = rgbStr && rgbStr.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return false;
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  // #f3ecdc ≈ (243,236,220): 亮且 R≥G≥B 暖色
  return r > 180 && g > 170 && b > 150 && r >= b;
}

async function verify(browser, mode) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (NETWORK_NOISE.test(t)) return;
    errors.push('console.error: ' + t);
  });

  let targetFrame = page;
  if (mode === 'iframe') {
    const shell = path.join(os.tmpdir(), `verify_3d_shell_${Date.now()}.html`);
    fs.writeFileSync(shell, `<!doctype html><html><body style="margin:0"><iframe src="file://${htmlPath}" style="width:100vw;height:100vh;border:0" sandbox="allow-scripts allow-same-origin"></iframe></body></html>`);
    await page.goto('file://' + shell, { timeout: 20000 });
    await page.waitForTimeout(2500);
    const f = page.frames().find(fr => fr !== page.mainFrame());
    if (f) targetFrame = f;
  } else {
    await page.goto('file://' + htmlPath, { timeout: 20000 });
    await page.waitForTimeout(2500);
  }

  const issues = [];
  const stats = await sceneStats(targetFrame);

  if (stats.canvasCount === 0) issues.push('no <canvas> (3D object needs a Three.js canvas)');
  if (!stats.hasWebGL) issues.push('no WebGL context found (Three.js renderer not initialized)');
  if (stats.textLen < 20) issues.push(`page text too short (${stats.textLen})`);
  if (!isWarmPaper(stats.bodyBg)) {
    issues.push(`body bg not warm paper (got ${stats.bodyBg}, expected ~#f3ecdc; 3D object 用米黄手册风非深空)`);
  }

  // 拖拽前截图
  const t1 = path.join(outDir, `${kname}_${mode}_before.png`);
  const buf1 = await page.screenshot({ path: t1 });
  if (buf1.length < 8000) issues.push(`screenshot too small (${buf1.length} bytes), likely blank`);

  // 模拟在 canvas 中心拖拽 (OrbitControls 转视角)
  try {
    const box = await (mode === 'iframe'
      ? (await targetFrame.$('canvas'))?.boundingBox()
      : (await page.$('canvas'))?.boundingBox());
    const cx = box ? box.x + box.width / 2 : 640;
    const cy = box ? box.y + box.height / 2 : 400;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 220, cy + 120, { steps: 12 });
    await page.mouse.move(cx + 120, cy - 80, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(600);
  } catch (e) {
    issues.push('drag simulation failed: ' + e.message);
  }

  const t2 = path.join(outDir, `${kname}_${mode}_after.png`);
  const buf2 = await page.screenshot({ path: t2 });
  const diff = pngDiffRatio(buf1, buf2);
  if (diff < 0.02) {
    issues.push(`3D not rotatable: drag produced no view change (diff=${(diff * 100).toFixed(1)}%, expected ≥ 2% — OrbitControls 未生效?)`);
  }

  if (errors.length) issues.push(`${errors.length} JS error(s)`);
  await ctx.close();

  return {
    mode, ok: issues.length === 0, issues,
    errors: errors.slice(0, 5),
    stats, dragDiff: Math.round(diff * 1000) / 10 + '%',
  };
}

console.log(`Verifying 3D object: ${kname}`);
console.log(`  HTML: ${htmlPath}`);

const browser = await chromium.launch();
const standalone = await verify(browser, 'standalone');
console.log(`  standalone: ${standalone.ok ? 'PASS' : 'FAIL'} (canvas=${standalone.stats.canvasCount}, webgl=${standalone.stats.hasWebGL}, bg=${standalone.stats.bodyBg}, drag-diff=${standalone.dragDiff})`);
if (!standalone.ok) standalone.issues.forEach(i => console.log(`    - ${i}`));

const iframe = await verify(browser, 'iframe');
console.log(`  iframe:     ${iframe.ok ? 'PASS' : 'FAIL'} (canvas=${iframe.stats.canvasCount}, webgl=${iframe.stats.hasWebGL}, drag-diff=${iframe.dragDiff})`);
if (!iframe.ok) iframe.issues.forEach(i => console.log(`    - ${i}`));

await browser.close();

const allOk = standalone.ok && iframe.ok;
console.log('\n' + JSON.stringify({ file: path.basename(htmlPath), kname, allOk, standalone, iframe, outDir }, null, 2));
console.log(`\nRESULT: ${allOk ? 'PASS' : 'FAIL'}`);
process.exit(allOk ? 0 : 1);
