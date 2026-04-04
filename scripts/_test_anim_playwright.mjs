import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANIM_URL = 'file://' + path.resolve(__dirname, '_test_anim_mars_route.html');

test('animation canvas renders non-black content', async ({ page }) => {
  await page.goto(ANIM_URL);
  await page.waitForTimeout(1500);

  const allBlack = await page.evaluate(() => {
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    if (w < 10 || h < 10) return true; // too small = broken
    const pts = [[w/2,h/2],[w/4,h/4],[w*3/4,h/2],[w/2,h/4],[w/2,h*3/4]];
    return pts.every(([x,y]) => {
      const d = ctx.getImageData(Math.floor(x),Math.floor(y),1,1).data;
      return d[0]===0 && d[1]===0 && d[2]===0;
    });
  });
  expect(allBlack).toBe(false);
});

test('PLAY button advances frames', async ({ page }) => {
  await page.goto(ANIM_URL);
  await page.waitForTimeout(1000);

  const frameBefore = await page.textContent('#frameInd');
  expect(frameBefore.trim()).toBe('1 / 4');

  await page.click('#btnPlay');
  await page.waitForTimeout(3500);

  const frameAfter = await page.textContent('#frameInd');
  // Should have advanced past frame 1
  expect(frameAfter.trim()).not.toBe('1 / 4');
});

test('NEXT button advances one frame', async ({ page }) => {
  await page.goto(ANIM_URL);
  await page.waitForTimeout(1000);

  await page.click('#btnNext');
  await page.waitForTimeout(700);
  const frame = await page.textContent('#frameInd');
  expect(frame.trim()).toBe('2 / 4');
});

test('PREV button goes back one frame', async ({ page }) => {
  await page.goto(ANIM_URL);
  await page.waitForTimeout(1000);

  // Go to frame 2 and wait for transition to finish
  await page.click('#btnNext');
  await page.waitForTimeout(1200);
  // Go back and wait for transition to finish
  await page.click('#btnPrev');
  await page.waitForTimeout(1200);
  const frame = await page.textContent('#frameInd');
  expect(frame.trim()).toBe('1 / 4');
});

test('language toggle switches text', async ({ page }) => {
  await page.goto(ANIM_URL);
  await page.waitForTimeout(1000);

  const titleCN = await page.textContent('#mainTitle');
  await page.click('#langBtn');
  await page.waitForTimeout(300);
  const titleEN = await page.textContent('#mainTitle');
  expect(titleCN).not.toBe(titleEN);
});

test('no JavaScript errors on page load and interaction', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(ANIM_URL);
  await page.waitForTimeout(1000);

  // Interact with controls
  await page.click('#btnNext');
  await page.waitForTimeout(600);
  await page.click('#btnNext');
  await page.waitForTimeout(600);
  await page.click('#btnPrev');
  await page.waitForTimeout(600);
  await page.click('#btnPlay');
  await page.waitForTimeout(3000);

  expect(errors).toEqual([]);
});
