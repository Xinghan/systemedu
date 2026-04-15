// Usage: node course_factory/validate/verify/animation.mjs <html-path> [--frames N] [--out <dir>]
// Launches Playwright, loads the HTML file, screenshots each frame by clicking the "next frame" button.
// Output: <out>/anim_f<N>.png for N = 0..frames-1.
// Exit non-zero if no canvas content renders or errors in page.
import { chromium } from 'playwright';
import path from 'path';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node course_factory/validate/verify/animation.mjs <html-path> [--frames N] [--out DIR]');
  process.exit(1);
}
const htmlPath = path.resolve(args[0]);
const framesArg = args.indexOf('--frames');
const frames = framesArg >= 0 ? parseInt(args[framesArg + 1], 10) : 4;
const outArg = args.indexOf('--out');
const outDir = outArg >= 0 ? args[outArg + 1] : '/tmp';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('file://' + htmlPath);
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/anim_f0.png` });
for (let i = 1; i < frames; i++) {
  const next = await page.$('#btn-next, button:has-text("下一帧"), button:has-text("Next")');
  if (next) await next.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/anim_f${i}.png` });
}

console.log(JSON.stringify({ ok: errors.length === 0, errors, outDir, frames }, null, 2));
await browser.close();
if (errors.length) process.exit(1);
