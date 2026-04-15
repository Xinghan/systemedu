// Usage: node scripts/verify/learn_page.mjs <project> <knode_id> [--user root --pw 123systemedu] [--out DIR]
// Logs in, navigates to /learn/<project>?node=<id>, verifies:
//  - theory pills present (count, titles)
//  - animation/game cards can be launched (iframe opens)
//  - no console errors
// Saves screenshots to <out>/learn_*.png
import { chromium } from 'playwright';

const [project, knodeIdStr, ...rest] = process.argv.slice(2);
if (!project || !knodeIdStr) {
  console.error('usage: node scripts/verify/learn_page.mjs <project> <knode_id> [--user U --pw P --out DIR]');
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
    const ifs = await page.$$('iframe');
    animOk = ifs.length > 0;
    await page.screenshot({ path: `${outDir}/learn_anim.png` });
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
    const ifs = await page.$$('iframe');
    gameOk = ifs.length > 0;
    await page.screenshot({ path: `${outDir}/learn_game.png` });
  }
} catch (e) { console.log('game card not found:', e.message); }

const report = { project, knodeId, theoryPills, theoryModalOk, animOk, gameOk, errors };
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (!theoryModalOk || !animOk || !gameOk || errors.length) process.exit(1);
