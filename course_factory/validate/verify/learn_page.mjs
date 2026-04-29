// Usage: node course_factory/validate/verify/learn_page.mjs <project> <knode_id> [--user root --pw 123systemedu] [--out DIR]
// Logs in, navigates to /learn/<project>?node=<id>, verifies:
//  - theory pills present (count, titles)
//  - animation/game cards can be launched (iframe opens)
//  - no console errors
// Saves screenshots to <out>/learn_*.png
import { chromium } from 'playwright';

const [project, knodeIdStr, ...rest] = process.argv.slice(2);
if (!project || !knodeIdStr) {
  console.error('usage: node course_factory/validate/verify/learn_page.mjs <project> <knode_id> [--user U --pw P --out DIR]');
  process.exit(1);
}
const knodeId = parseInt(knodeIdStr, 10);
const userArg = rest.indexOf('--user');
const pwArg = rest.indexOf('--pw');
const outArg = rest.indexOf('--out');
const user = userArg >= 0 ? rest[userArg + 1] : 'root';
const pw = pwArg >= 0 ? rest[pwArg + 1] : '123systemedu';
const outDir = outArg >= 0 ? rest[outArg + 1] : '/tmp';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// Log in
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(500);
await page.fill('input[name="username"], input[type="text"]', user);
await page.fill('input[type="password"]', pw);
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);

// Go to learn page
await page.goto(`http://localhost:3000/learn/${project}?node=${knodeId}`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${outDir}/learn_top.png` });

// Scroll the main content container and capture mid-page
async function scrollMain(y) {
  await page.evaluate((ty) => {
    const el = document.querySelector('.flex-1.min-h-0.overflow-y-auto');
    if (el) el.scrollTop = ty;
  }, y);
}

// Count theory pills (buttons with "物理"/"化学"/... suffix from theory tags)
const theoryPills = await page.$$eval('button', btns =>
  btns.map(b => b.textContent?.trim() || '').filter(t => /物理|化学|数学|生物|工程$/.test(t))
);
console.log('theory pills:', theoryPills);

// Click first theory pill to confirm modal opens
let theoryModalOk = false;
if (theoryPills.length) {
  const first = await page.$(`button:has-text("${theoryPills[0]}")`);
  if (first) {
    await first.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${outDir}/learn_theory_modal.png` });
    theoryModalOk = true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

// Helper: check if canvas inside an iframe has actual rendered content (non-blank)
async function checkIframeCanvas(page, label) {
  const ifs = await page.$$('iframe');
  if (ifs.length === 0) return { found: false, hasContent: false, reason: 'no iframe' };
  const iframe = ifs[ifs.length - 1]; // last iframe is the modal one
  let frame;
  try {
    frame = await iframe.contentFrame();
  } catch { return { found: true, hasContent: false, reason: 'cannot access iframe contentFrame' }; }
  if (!frame) return { found: true, hasContent: false, reason: 'iframe contentFrame is null' };
  await frame.waitForTimeout(1500); // let canvas render
  const result = await frame.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { hasCanvas: false, w: 0, h: 0, nonBg: 0 };
    const ctx = c.getContext('2d');
    if (!ctx) return { hasCanvas: true, w: c.width, h: c.height, nonBg: 0 };
    // Sample pixels to check if canvas has real content
    const w = c.width, h = c.height;
    if (w === 0 || h === 0) return { hasCanvas: true, w, h, nonBg: 0 };
    const samples = 200;
    const colors = new Set();
    for (let i = 0; i < samples; i++) {
      const sx = Math.floor(Math.random() * w);
      const sy = Math.floor(Math.random() * h);
      const px = ctx.getImageData(sx, sy, 1, 1).data;
      colors.add(`${px[0]},${px[1]},${px[2]}`);
    }
    return { hasCanvas: true, w, h, uniqueColors: colors.size };
  }).catch(() => ({ hasCanvas: false, w: 0, h: 0, uniqueColors: 0 }));
  const hasContent = result.hasCanvas && result.uniqueColors >= 3;
  if (!hasContent) {
    console.log(`  ${label} canvas check FAIL:`, result);
  } else {
    console.log(`  ${label} canvas check OK: ${result.uniqueColors} unique colors, ${result.w}x${result.h}`);
  }
  return { found: true, hasContent, ...result };
}

// Open animation (scroll to it first)
await scrollMain(1200);
await page.waitForTimeout(600);
let animOk = false;
try {
  const animCard = await page.getByText('动画演示', { exact: false }).first();
  await animCard.scrollIntoViewIfNeeded();
  const box = await animCard.boundingBox();
  if (box) {
    await page.mouse.click(box.x + 100, box.y + 20);
    await page.waitForTimeout(2000);
    const animCheck = await checkIframeCanvas(page, 'anim');
    animOk = animCheck.found && animCheck.hasContent;
    await page.screenshot({ path: `${outDir}/learn_anim.png` });
    if (!animOk) errors.push(`anim canvas blank or missing (uniqueColors=${animCheck.uniqueColors || 0})`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }
} catch (e) { console.log('anim card not found:', e.message); }

// Open game
await scrollMain(3200);
await page.waitForTimeout(600);
let gameOk = false;
try {
  const gameCard = await page.getByText('互动游戏', { exact: false }).first();
  await gameCard.scrollIntoViewIfNeeded();
  const box = await gameCard.boundingBox();
  if (box) {
    await page.mouse.click(box.x + 100, box.y + 20);
    await page.waitForTimeout(2000);
    const gameCheck = await checkIframeCanvas(page, 'game');
    gameOk = gameCheck.found && gameCheck.hasContent;
    await page.screenshot({ path: `${outDir}/learn_game.png` });
    if (!gameOk) errors.push(`game canvas blank or missing (uniqueColors=${gameCheck.uniqueColors || 0})`);
  }
} catch (e) { console.log('game card not found:', e.message); }

const report = { project, knodeId, theoryPills, theoryModalOk, animOk, gameOk, errors };
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (!theoryModalOk || !animOk || !gameOk || errors.length) process.exit(1);
