// Usage: node scripts/verify/game.mjs <html-path> [--iframe] [--out DIR]
// Renders the game HTML either standalone or wrapped in an iframe (which exercises the flex-chain rule).
// Verifies canvas is present AND has clientHeight > 100 (catches the "canvas collapses in iframe" bug).
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node scripts/verify/game.mjs <html-path> [--iframe] [--out DIR]');
  process.exit(1);
}
const htmlPath = path.resolve(args[0]);
const useIframe = args.includes('--iframe');
const outArg = args.indexOf('--out');
const outDir = outArg >= 0 ? args[outArg + 1] : '/tmp';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

if (useIframe) {
  const tmpShell = path.join(os.tmpdir(), `verify_shell_${Date.now()}.html`);
  fs.writeFileSync(tmpShell, `<!doctype html><html><body style="margin:0"><iframe src="file://${htmlPath}" style="width:100vw;height:100vh;border:0" onload="window.__iframeLoaded=true"></iframe></body></html>`);
  await page.goto('file://' + tmpShell);
  await page.waitForFunction(() => window.__iframeLoaded === true, { timeout: 10000 }).catch(() => {});
} else {
  await page.goto('file://' + htmlPath);
}
await page.waitForTimeout(800);

const frame = useIframe ? (page.frames().find(f => f !== page.mainFrame()) || page) : page;
const canvasInfo = await frame.evaluate(() => {
  const cs = [...document.querySelectorAll('canvas')];
  return cs.map(c => {
    const cs_ = getComputedStyle(c);
    // Also check parents: canvas inside display:none overlay must be skipped.
    let hidden = cs_.display === 'none' || cs_.visibility === 'hidden';
    let p = c.parentElement;
    while (p && !hidden) {
      const ps = getComputedStyle(p);
      if (ps.display === 'none' || ps.visibility === 'hidden') { hidden = true; break; }
      p = p.parentElement;
    }
    return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, hidden };
  });
});
// Ignore canvases that are initially hidden (e.g. result overlays).
const visibleCanvases = canvasInfo.filter(c => !c.hidden);
await page.screenshot({ path: `${outDir}/game_r1.png` });
const chip2 = await frame.$('#chip2, [data-round="2"]');
if (chip2) { await chip2.click().catch(() => {}); await page.waitForTimeout(400); await page.screenshot({ path: `${outDir}/game_r2.png` }); }
const chip3 = await frame.$('#chip3, [data-round="3"]');
if (chip3) { await chip3.click().catch(() => {}); await page.waitForTimeout(400); await page.screenshot({ path: `${outDir}/game_r3.png` }); }

const ok = visibleCanvases.length > 0 && visibleCanvases.every(c => c.ch > 100) && errors.length === 0;
console.log(JSON.stringify({ ok, useIframe, canvasInfo, visibleCanvases, errors, outDir }, null, 2));
await browser.close();
if (!ok) process.exit(1);
