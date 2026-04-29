// batch_visual_verify.mjs
// Usage: node course_factory/validate/verify/batch_visual_verify.mjs [--type anim|game|all] [--out DIR]
// Batch-verifies ALL v2 animation/game HTML files by:
//   1. Launching each in Playwright (1280x800 viewport)
//   2. Taking screenshots of each frame (anim) or initial state (game)
//   3. Checking canvas pixel content (black-screen detection)
//   4. Collecting JS errors
//   5. Generating a summary report
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

const args = process.argv.slice(2);
const typeArg = args.indexOf('--type');
const type = typeArg >= 0 ? args[typeArg + 1] : 'all';
const outArg = args.indexOf('--out');
const outDir = outArg >= 0 ? args[outArg + 1] : '/tmp/verify_v2';
const filterArg = args.indexOf('--filter');
const filter = filterArg >= 0 ? args[filterArg + 1] : null; // e.g. "k17" to only test k17

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'anim'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'game'), { recursive: true });

function findFiles(subdir, pattern) {
  const dir = path.join(ROOT, 'course_factory/tests', subdir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.match(pattern))
    .filter(f => !filter || f.includes(filter))
    .sort()
    .map(f => ({ name: f, path: path.join(dir, f) }));
}

async function checkCanvasContent(frame) {
  // Sample pixels from canvas to detect black screen
  return await frame.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')];
    if (!canvases.length) return { hasCanvas: false, isBlack: true, details: 'no canvas found' };

    const results = canvases.map(cv => {
      const ctx = cv.getContext('2d');
      if (!ctx) return { w: cv.width, h: cv.height, isBlack: true, reason: 'no 2d context' };

      // Sample 100 random pixels
      const w = cv.width, h = cv.height;
      if (w < 10 || h < 10) return { w, h, isBlack: true, reason: 'canvas too small' };

      // Check for truly blank canvas by looking for pixel diversity.
      // A canvas with actual drawn content will have many distinct colors.
      // A truly blank/unrendered canvas will have 0-2 distinct colors.
      const colorSet = new Set();
      let nonBgCount = 0;
      const sampleSize = 300;
      // Sample the background color from corner
      const bgPixel = ctx.getImageData(2, 2, 1, 1).data;
      const bgKey = bgPixel[0] + ',' + bgPixel[1] + ',' + bgPixel[2];

      for (let i = 0; i < sampleSize; i++) {
        const sx = Math.floor(Math.random() * w * 0.8 + w * 0.1);
        const sy = Math.floor(Math.random() * h * 0.8 + h * 0.1);
        const pixel = ctx.getImageData(sx, sy, 1, 1).data;
        // Quantize to reduce noise (group similar colors)
        const key = (pixel[0] >> 4) + ',' + (pixel[1] >> 4) + ',' + (pixel[2] >> 4);
        colorSet.add(key);
        // Check if different from background
        const pKey = pixel[0] + ',' + pixel[1] + ',' + pixel[2];
        if (pKey !== bgKey) nonBgCount++;
      }

      const uniqueColors = colorSet.size;
      const nonBgRatio = nonBgCount / sampleSize;
      return {
        w, h,
        clientWidth: cv.clientWidth,
        clientHeight: cv.clientHeight,
        // Truly blank = fewer than 3 distinct quantized colors AND less than 1% non-bg pixels
        isBlack: uniqueColors < 3 && nonBgRatio < 0.01,
        uniqueColors,
        nonBgRatio: Math.round(nonBgRatio * 100) + '%',
      };
    });

    const mainCanvas = results[0];
    return {
      hasCanvas: true,
      canvasCount: results.length,
      isBlack: mainCanvas.isBlack,
      mainCanvas: mainCanvas,
      allCanvases: results,
    };
  });
}

async function verifyAnimation(browser, file) {
  const result = { file: file.name, type: 'anim', errors: [], frames: [], canvasChecks: [] };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  page.on('pageerror', e => result.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') result.errors.push('console.error: ' + m.text()); });

  try {
    await page.goto('file://' + file.path, { timeout: 10000 });
    await page.waitForTimeout(1500); // Wait for boot + first render

    // Screenshot frame 0
    const kname = file.name.replace('test_', '').replace('_anim_v2.html', '');
    const ssPath = path.join(outDir, 'anim', `${kname}_f0.png`);
    await page.screenshot({ path: ssPath });
    result.frames.push(ssPath);

    // Check canvas content
    const check0 = await checkCanvasContent(page);
    result.canvasChecks.push({ frame: 0, ...check0 });

    // Navigate through frames (up to 6)
    for (let i = 1; i <= 6; i++) {
      const nextBtn = await page.$('#btnNext, #btn-next, button:has-text("NEXT"), button:has-text("Next")');
      if (!nextBtn) break;

      try {
        await nextBtn.click();
        await page.waitForTimeout(800);

        const fPath = path.join(outDir, 'anim', `${kname}_f${i}.png`);
        await page.screenshot({ path: fPath });
        result.frames.push(fPath);

        const checkN = await checkCanvasContent(page);
        result.canvasChecks.push({ frame: i, ...checkN });
      } catch (e) {
        result.errors.push(`frame ${i} navigation error: ${e.message}`);
        break;
      }
    }
  } catch (e) {
    result.errors.push('load error: ' + e.message);
  }

  await ctx.close();

  result.ok = result.errors.length === 0
    && result.canvasChecks.length > 0
    && result.canvasChecks.every(c => c.hasCanvas && !c.isBlack);
  result.issues = [];
  if (result.errors.length) result.issues.push('JS errors');
  result.canvasChecks.forEach(c => {
    if (!c.hasCanvas) result.issues.push(`frame ${c.frame}: no canvas`);
    else if (c.isBlack) result.issues.push(`frame ${c.frame}: BLANK CANVAS (${c.mainCanvas?.uniqueColors || 0} colors, ${c.mainCanvas?.nonBgRatio || '0%'} non-bg)`);
  });

  return result;
}

async function verifyGame(browser, file) {
  const result = { file: file.name, type: 'game', errors: [], screenshots: [], canvasChecks: [] };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  page.on('pageerror', e => result.errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') result.errors.push('console.error: ' + m.text()); });

  try {
    await page.goto('file://' + file.path, { timeout: 10000 });
    await page.waitForTimeout(1500);

    const kname = file.name.replace('test_', '').replace('_game_v2.html', '');

    // Screenshot initial state
    const ssPath = path.join(outDir, 'game', `${kname}_initial.png`);
    await page.screenshot({ path: ssPath });
    result.screenshots.push(ssPath);

    // Check canvas content
    const check0 = await checkCanvasContent(page);
    result.canvasChecks.push({ state: 'initial', ...check0 });

    // Check canvas dimensions
    const canvasDims = await page.evaluate(() => {
      const cv = document.querySelector('canvas');
      if (!cv) return null;
      return {
        width: cv.width, height: cv.height,
        clientWidth: cv.clientWidth, clientHeight: cv.clientHeight,
        parentTag: cv.parentElement?.tagName,
        parentDisplay: cv.parentElement ? getComputedStyle(cv.parentElement).display : null,
        parentFlexDir: cv.parentElement ? getComputedStyle(cv.parentElement).flexDirection : null,
      };
    });
    result.canvasDims = canvasDims;

    // Check sidebar elements
    const sidebarCheck = await page.evaluate(() => {
      const sidebar = document.querySelector('.game-sidebar');
      const langBtn = document.querySelector('#langBtn, .sidebar-lang');
      const guide = document.querySelector('#guideContent, .sidebar-guide');
      return {
        hasSidebar: !!sidebar,
        sidebarWidth: sidebar ? sidebar.clientWidth : 0,
        hasLangBtn: !!langBtn,
        hasGuide: !!guide,
      };
    });
    result.sidebarCheck = sidebarCheck;

    // Try to also test in iframe mode (like the actual frontend)
    const iframeShell = path.join(outDir, `_iframe_shell_${kname}.html`);
    fs.writeFileSync(iframeShell, `<!doctype html><html><body style="margin:0;background:#0c0e14"><iframe src="file://${file.path}" style="width:100vw;height:100vh;border:0" sandbox="allow-scripts allow-same-origin"></iframe></body></html>`);

    const iframePage = await ctx.newPage();
    iframePage.on('pageerror', e => result.errors.push('iframe-pageerror: ' + e.message));

    try {
      await iframePage.goto('file://' + iframeShell, { timeout: 10000 });
      await iframePage.waitForTimeout(1500);

      const iframeSS = path.join(outDir, 'game', `${kname}_iframe.png`);
      await iframePage.screenshot({ path: iframeSS });
      result.screenshots.push(iframeSS);

      // Check canvas in iframe
      const iframe = iframePage.frames().find(f => f !== iframePage.mainFrame());
      if (iframe) {
        const iframeCheck = await checkCanvasContent(iframe);
        result.canvasChecks.push({ state: 'iframe', ...iframeCheck });
      }
    } catch (e) {
      result.errors.push('iframe test error: ' + e.message);
    }
    await iframePage.close();

  } catch (e) {
    result.errors.push('load error: ' + e.message);
  }

  await ctx.close();

  result.ok = result.errors.length === 0
    && result.canvasChecks.length > 0
    && result.canvasChecks.every(c => c.hasCanvas && !c.isBlack)
    && (result.canvasDims?.clientHeight > 100);
  result.issues = [];
  if (result.errors.length) result.issues.push(`${result.errors.length} JS error(s)`);
  result.canvasChecks.forEach(c => {
    if (!c.hasCanvas) result.issues.push(`${c.state}: no canvas`);
    else if (c.isBlack) result.issues.push(`${c.state}: BLANK CANVAS (${c.mainCanvas?.uniqueColors || 0} colors)`);
  });
  if (result.canvasDims && result.canvasDims.clientHeight <= 100) {
    result.issues.push(`canvas collapsed: ${result.canvasDims.clientWidth}x${result.canvasDims.clientHeight}`);
  }
  if (result.sidebarCheck && !result.sidebarCheck.hasSidebar) result.issues.push('missing sidebar');
  if (result.sidebarCheck && !result.sidebarCheck.hasLangBtn) result.issues.push('missing lang button');

  return result;
}

// --- Main ---
console.log(`Batch visual verify: type=${type}, outDir=${outDir}, filter=${filter || 'none'}`);

const animFiles = (type === 'all' || type === 'anim') ? findFiles('anim', /test_k\d+_anim_v2\.html$/) : [];
const gameFiles = (type === 'all' || type === 'game') ? findFiles('game', /test_k\d+_game_v2\.html$/) : [];

console.log(`Found: ${animFiles.length} animations, ${gameFiles.length} games`);

const browser = await chromium.launch();
const allResults = [];

// Process animations
for (const f of animFiles) {
  process.stdout.write(`  anim: ${f.name} ... `);
  const r = await verifyAnimation(browser, f);
  allResults.push(r);
  console.log(r.ok ? 'OK' : `FAIL [${r.issues.join(', ')}]`);
}

// Process games
for (const f of gameFiles) {
  process.stdout.write(`  game: ${f.name} ... `);
  const r = await verifyGame(browser, f);
  allResults.push(r);
  console.log(r.ok ? 'OK' : `FAIL [${r.issues.join(', ')}]`);
}

await browser.close();

// Summary
const passed = allResults.filter(r => r.ok);
const failed = allResults.filter(r => !r.ok);

console.log('\n=== SUMMARY ===');
console.log(`Total: ${allResults.length} | Passed: ${passed.length} | Failed: ${failed.length}`);

if (failed.length) {
  console.log('\nFailed files:');
  for (const r of failed) {
    console.log(`  ${r.file}: ${r.issues.join(', ')}`);
    if (r.errors.length) {
      for (const e of r.errors.slice(0, 3)) console.log(`    err: ${e.substring(0, 120)}`);
    }
  }
}

// Write JSON report
const reportPath = path.join(outDir, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify({ summary: { total: allResults.length, passed: passed.length, failed: failed.length }, results: allResults }, null, 2));
console.log(`\nReport: ${reportPath}`);
console.log(`Screenshots: ${outDir}/anim/ and ${outDir}/game/`);

process.exit(failed.length > 0 ? 1 : 0);
