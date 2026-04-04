#!/usr/bin/env node
/**
 * html_validate.mjs -- Headless Chromium validator for animation/game HTML.
 *
 * Usage:
 *   node scripts/html_validate.mjs <file.html> --mode animation|game
 *
 * Checks (all modes):
 *   1. No JS errors (pageerror)
 *   2. No console.error
 *   3. Canvas/SVG not all-black (5-point sampling)
 *   4. No vertical scrollbar
 *
 * Animation-specific:
 *   5. #btnNext exists and clicking it changes frame indicator
 *   6. #langBtn exists
 *
 * Game-specific:
 *   5. At least one interactive element is visible (.game-area, .terrain-card, input[type=range], canvas, svg)
 *
 * Output: JSON report to stdout.  Exit 0 = pass, 1 = fail.
 */
import { chromium } from 'playwright';
import path from 'path';
import { existsSync } from 'fs';

const args = process.argv.slice(2);
let filePath = null;
let mode = 'auto'; // auto-detect from filename

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mode' && args[i + 1]) {
    mode = args[i + 1];
    i++;
  } else if (!args[i].startsWith('--')) {
    filePath = args[i];
  }
}

if (!filePath) {
  console.error('Usage: node html_validate.mjs <file.html> [--mode animation|game]');
  process.exit(2);
}

const resolved = path.resolve(filePath);
if (!existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(2);
}

// Auto-detect mode from filename
if (mode === 'auto') {
  const base = path.basename(resolved);
  if (base.includes('_anim_')) mode = 'animation';
  else if (base.includes('_game_')) mode = 'game';
  else mode = 'animation'; // default
}

const fileUrl = 'file://' + resolved;

async function validate() {
  const report = {
    file: path.basename(resolved),
    mode,
    pass: true,
    checks: [],
  };

  function check(name, passed, detail) {
    report.checks.push({ name, passed, detail: detail || '' });
    if (!passed) report.pass = false;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // Collect JS errors and console.error
  const jsErrors = [];
  const consoleErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    check('page_load', false, `Failed to load: ${e.message}`);
    report.pass = false;
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    process.exit(1);
  }

  // Wait for rendering (fonts, delayed resize, etc.)
  await page.waitForTimeout(2000);

  // --- Check 1: No JS errors ---
  check('no_js_errors', jsErrors.length === 0,
    jsErrors.length > 0 ? jsErrors.slice(0, 5).join('; ') : '');

  // --- Check 2: No console.error ---
  // Filter out benign errors (font loading, favicon)
  const realErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('Failed to load resource'));
  check('no_console_errors', realErrors.length === 0,
    realErrors.length > 0 ? realErrors.slice(0, 5).join('; ') : '');

  // --- Check 3: Canvas/SVG not all-black ---
  const canvasCheck = await page.evaluate(() => {
    const c = document.getElementById('c') || document.querySelector('canvas');
    if (!c) return { hasCanvas: false, allBlack: false };
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    if (w < 10 || h < 10) return { hasCanvas: true, allBlack: true, detail: `canvas too small: ${w}x${h}` };
    const pts = [[w/2,h/2],[w/4,h/4],[w*3/4,h/2],[w/2,h/4],[w/2,h*3/4]];
    const allBlack = pts.every(([x, y]) => {
      const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      return d[0] === 0 && d[1] === 0 && d[2] === 0;
    });
    return { hasCanvas: true, allBlack };
  });

  if (canvasCheck.hasCanvas) {
    check('canvas_not_black', !canvasCheck.allBlack,
      canvasCheck.allBlack ? (canvasCheck.detail || 'All 5 sample points are black') : '');
  } else {
    // Check if there's an SVG or DOM-based rendering
    const hasSvgOrDom = await page.evaluate(() => {
      return document.querySelector('svg') !== null
        || document.querySelector('.game-area') !== null
        || document.querySelector('.main') !== null;
    });
    check('has_visual_content', hasSvgOrDom, hasSvgOrDom ? '' : 'No canvas, SVG, or game DOM found');
  }

  // --- Check 4: No vertical scrollbar ---
  const hasScrollbar = await page.evaluate(() => {
    return document.documentElement.scrollHeight > document.documentElement.clientHeight + 2;
  });
  check('no_vertical_scrollbar', !hasScrollbar,
    hasScrollbar ? `scrollHeight=${await page.evaluate(() => document.documentElement.scrollHeight)}, clientHeight=${await page.evaluate(() => document.documentElement.clientHeight)}` : '');

  // --- Mode-specific checks ---
  if (mode === 'animation') {
    // Check 5: #btnNext clickable and frame changes
    const btnNextExists = await page.evaluate(() => !!document.getElementById('btnNext'));
    check('btnNext_exists', btnNextExists);

    if (btnNextExists) {
      const frameIndicator = await page.evaluate(() => {
        const el = document.getElementById('frameInd');
        return el ? el.textContent.trim() : null;
      });
      await page.click('#btnNext').catch(() => {});
      await page.waitForTimeout(800);
      const frameAfter = await page.evaluate(() => {
        const el = document.getElementById('frameInd');
        return el ? el.textContent.trim() : null;
      });
      if (frameIndicator !== null && frameAfter !== null) {
        check('btnNext_changes_frame', frameIndicator !== frameAfter,
          `before="${frameIndicator}" after="${frameAfter}"`);
      }
    }

    // Check 6: #langBtn exists
    const langBtnExists = await page.evaluate(() => !!document.getElementById('langBtn'));
    check('langBtn_exists', langBtnExists);

  } else if (mode === 'game') {
    // Check 5: Interactive elements visible
    const interactiveInfo = await page.evaluate(() => {
      const selectors = [
        '.game-area', '.terrain-card', '.card', 'input[type=range]',
        'canvas', 'svg', 'button', '.drag', '[draggable]',
      ];
      const found = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) found.push(`${sel}(${els.length})`);
      }
      return found;
    });
    check('has_interactive_elements', interactiveInfo.length > 0,
      interactiveInfo.length > 0 ? interactiveInfo.join(', ') : 'No interactive elements found');
  }

  await browser.close();

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

validate().catch(e => {
  console.error(`Validator crashed: ${e.message}`);
  process.exit(2);
});
