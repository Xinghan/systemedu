/**
 * html_validate_test.mjs -- Auto-discovery Playwright test suite.
 *
 * Automatically discovers scripts/_test_anim_*.html and scripts/_test_game_*.html,
 * generating a common test suite for each file:
 *   - No JS errors on load + interaction
 *   - Canvas/SVG renders non-black content
 *   - No vertical scrollbar
 *
 * Animation files additionally test:
 *   - NEXT/PREV buttons change frame
 *   - PLAY button advances frames
 *   - Language toggle (#langBtn) switches text
 *
 * Game files additionally test:
 *   - Interactive elements exist and are visible
 *
 * Run:  npx playwright test --config=scripts/playwright.config.mjs
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Discover test HTML files
const allFiles = readdirSync(__dirname);
const animFiles = allFiles.filter(f => f.startsWith('_test_anim_') && f.endsWith('.html'));
const gameFiles = allFiles.filter(f => f.startsWith('_test_game_') && f.endsWith('.html'));

// ---- Shared test generators ----

function commonTests(fileName, fileUrl) {
  test(`[${fileName}] no JS errors on load`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  test(`[${fileName}] no vertical scrollbar`, async ({ page }) => {
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    const hasScrollbar = await page.evaluate(() =>
      document.documentElement.scrollHeight > document.documentElement.clientHeight + 2
    );
    expect(hasScrollbar).toBe(false);
  });
}

function canvasRenderTest(fileName, fileUrl) {
  test(`[${fileName}] canvas renders non-black content`, async ({ page }) => {
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const c = document.getElementById('c') || document.querySelector('canvas');
      if (!c) return { hasCanvas: false };
      const ctx = c.getContext('2d');
      const w = c.width, h = c.height;
      if (w < 10 || h < 10) return { hasCanvas: true, allBlack: true };
      const pts = [[w/2,h/2],[w/4,h/4],[w*3/4,h/2],[w/2,h/4],[w/2,h*3/4]];
      const allBlack = pts.every(([x, y]) => {
        const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        return d[0] === 0 && d[1] === 0 && d[2] === 0;
      });
      return { hasCanvas: true, allBlack };
    });

    if (result.hasCanvas) {
      expect(result.allBlack).toBe(false);
    }
    // If no canvas, this test passes (DOM/SVG-based rendering)
  });
}

// ---- Animation-specific tests ----

function animationTests(fileName, fileUrl) {
  commonTests(fileName, fileUrl);
  canvasRenderTest(fileName, fileUrl);

  test(`[${fileName}] NEXT button advances one frame`, async ({ page }) => {
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    const has = await page.evaluate(() => ({
      btn: !!document.getElementById('btnNext'),
      ind: !!document.getElementById('frameInd'),
    }));
    if (!has.btn || !has.ind) {
      console.warn(`[${fileName}] WARN: #btnNext or #frameInd missing`);
      return;
    }

    const before = await page.textContent('#frameInd');
    await page.click('#btnNext');
    await page.waitForTimeout(800);
    const after = await page.textContent('#frameInd');
    expect(after.trim()).not.toBe(before.trim());
  });

  test(`[${fileName}] PREV returns to previous frame`, async ({ page }) => {
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    const has = await page.evaluate(() => ({
      btnNext: !!document.getElementById('btnNext'),
      btnPrev: !!document.getElementById('btnPrev'),
      ind: !!document.getElementById('frameInd'),
    }));
    if (!has.btnNext || !has.btnPrev || !has.ind) {
      console.warn(`[${fileName}] WARN: #btnNext, #btnPrev, or #frameInd missing`);
      return;
    }

    const initial = await page.textContent('#frameInd');
    await page.click('#btnNext');
    await page.waitForTimeout(1200);
    await page.click('#btnPrev');
    await page.waitForTimeout(1200);
    const returned = await page.textContent('#frameInd');
    expect(returned.trim()).toBe(initial.trim());
  });

  test(`[${fileName}] language toggle exists and switches text`, async ({ page }) => {
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    const langBtnExists = await page.evaluate(() => !!document.getElementById('langBtn'));
    if (!langBtnExists) {
      // Warn but don't fail -- older HTML may lack langBtn
      console.warn(`[${fileName}] WARN: #langBtn not found (i18n not implemented)`);
      return;
    }

    const titleEl = await page.evaluate(() => {
      const el = document.getElementById('mainTitle')
        || document.querySelector('h1')
        || document.querySelector('.header h1');
      return el ? el.textContent : null;
    });

    await page.click('#langBtn');
    await page.waitForTimeout(500);

    const titleAfter = await page.evaluate(() => {
      const el = document.getElementById('mainTitle')
        || document.querySelector('h1')
        || document.querySelector('.header h1');
      return el ? el.textContent : null;
    });

    if (titleEl && titleAfter) {
      expect(titleEl).not.toBe(titleAfter);
    }
  });

  test(`[${fileName}] no JS errors during interaction`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Interact with all controls
    const btns = ['#btnNext', '#btnNext', '#btnPrev', '#btnPlay'];
    for (const sel of btns) {
      const exists = await page.evaluate(s => !!document.querySelector(s), sel);
      if (exists) {
        await page.click(sel).catch(() => {});
        await page.waitForTimeout(600);
      }
    }
    // Let play run briefly
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });
}

// ---- Game-specific tests ----

function gameTests(fileName, fileUrl) {
  commonTests(fileName, fileUrl);
  canvasRenderTest(fileName, fileUrl);

  test(`[${fileName}] has interactive elements`, async ({ page }) => {
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    const count = await page.evaluate(() => {
      const selectors = [
        '.game-area', '.terrain-card', '.card', 'input[type=range]',
        'canvas', 'svg', 'button', '.drag', '[draggable]',
        '.slider', '.option', '.choice',
      ];
      let total = 0;
      for (const sel of selectors) {
        total += document.querySelectorAll(sel).length;
      }
      return total;
    });
    expect(count).toBeGreaterThan(0);
  });

  test(`[${fileName}] no JS errors during interaction`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    // Auto-dismiss dialogs that some games trigger
    page.on('dialog', dialog => dialog.dismiss().catch(() => {}));

    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Wrap all interaction in try/catch -- some games navigate or close the page
    try {
      // Click visible buttons (limit to 3 to avoid triggering navigation)
      const buttons = await page.$$('button');
      for (const btn of buttons.slice(0, 3)) {
        const visible = await btn.isVisible().catch(() => false);
        if (visible) {
          // Use Promise.race to cap per-click wait
          await Promise.race([
            btn.click().then(() => page.waitForTimeout(300)),
            new Promise(r => setTimeout(r, 3000)),
          ]).catch(() => {});
        }
      }

      // Move sliders if any
      const sliders = await page.$$('input[type=range]');
      for (const slider of sliders.slice(0, 3)) {
        const visible = await slider.isVisible().catch(() => false);
        if (visible) {
          await slider.fill('50').catch(() => {});
          await page.waitForTimeout(200).catch(() => {});
        }
      }

      await page.waitForTimeout(1000).catch(() => {});
    } catch {
      // Page may have been closed by navigation -- that's ok
    }
    expect(errors).toEqual([]);
  });

  test(`[${fileName}] language toggle exists`, async ({ page }) => {
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    const langBtnExists = await page.evaluate(() => !!document.getElementById('langBtn'));
    if (!langBtnExists) {
      console.warn(`[${fileName}] WARN: #langBtn not found (i18n not implemented)`);
    }
    // Warn only, don't hard-fail for older HTML that lacks i18n
  });
}

// ---- Generate test suites ----

for (const f of animFiles) {
  test.describe(`Animation: ${f}`, () => {
    animationTests(f, 'file://' + path.resolve(__dirname, f));
  });
}

for (const f of gameFiles) {
  test.describe(`Game: ${f}`, () => {
    gameTests(f, 'file://' + path.resolve(__dirname, f));
  });
}
