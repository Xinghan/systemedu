// game_level_test.mjs
// Tests game level/round transition by simulating basic interactions.
// For each game, attempts to complete round 1 and checks if round 2 appears.
// Usage: node course_factory/validate/verify/game_level_test.mjs <html-path> [--out DIR]
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node game_level_test.mjs <html-path> [--out DIR]');
  process.exit(1);
}
const htmlPath = path.resolve(args[0]);
const outArg = args.indexOf('--out');
const outDir = outArg >= 0 ? args[outArg + 1] : '/tmp/game_level_test';
fs.mkdirSync(outDir, { recursive: true });

const kname = path.basename(htmlPath).replace('test_', '').replace('_game_v2.html', '');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
const logs = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => {
  if (m.type() === 'error') errors.push('console.error: ' + m.text());
  logs.push(`[${m.type()}] ${m.text()}`);
});

await page.goto('file://' + htmlPath, { timeout: 15000 });
await page.waitForTimeout(2000);

// Screenshot initial state
await page.screenshot({ path: path.join(outDir, `${kname}_r1_before.png`) });

// Detect game type by looking for common UI patterns
const gameInfo = await page.evaluate(() => {
  const doc = document;
  // Check for round/level indicators
  const roundInfo = doc.querySelector('#roundInfo, .info');
  const levelText = roundInfo?.textContent || '';

  // Check for input fields (calculation games)
  const numInputs = [...doc.querySelectorAll('input[type=number]')];
  const textInputs = [...doc.querySelectorAll('input[type=text]')];

  // Check for buttons
  const allBtns = [...doc.querySelectorAll('button, .btn, .btn-secondary')];
  const btnTexts = allBtns.map(b => b.textContent?.trim());

  // Check for sliders
  const sliders = [...doc.querySelectorAll('input[type=range]')];

  // Check for clickable cards/options
  const cards = [...doc.querySelectorAll('[data-option], .option-card, .choice-btn')];

  // Check for canvas
  const canvas = doc.querySelector('canvas');
  const canvasH = canvas?.clientHeight || 0;

  // Check for drag elements
  const dragItems = [...doc.querySelectorAll('[draggable=true]')];

  return {
    levelText,
    numInputCount: numInputs.length,
    textInputCount: textInputs.length,
    btnTexts,
    sliderCount: sliders.length,
    cardCount: cards.length,
    canvasHeight: canvasH,
    dragItemCount: dragItems.length,
    hasSubmitBtn: btnTexts.some(t => t && (t.includes('确认') || t.includes('提交') || t.includes('Submit') || t.includes('CHECK'))),
    hasLaunchBtn: btnTexts.some(t => t && (t.includes('发射') || t.includes('Launch') || t.includes('推') || t.includes('GO'))),
    hasResetBtn: btnTexts.some(t => t && (t.includes('重新') || t.includes('Reset') || t.includes('重置'))),
    hasNextBtn: btnTexts.some(t => t && (t.includes('下一') || t.includes('Next') || t.includes('继续'))),
  };
});

console.log(`Game: ${kname}`);
console.log(`  Level: ${gameInfo.levelText}`);
console.log(`  Inputs: ${gameInfo.numInputCount} num, ${gameInfo.textInputCount} text`);
console.log(`  Buttons: ${gameInfo.btnTexts.join(', ')}`);
console.log(`  Sliders: ${gameInfo.sliderCount}, Cards: ${gameInfo.cardCount}, Drag: ${gameInfo.dragItemCount}`);
console.log(`  Submit: ${gameInfo.hasSubmitBtn}, Launch: ${gameInfo.hasLaunchBtn}, Reset: ${gameInfo.hasResetBtn}, Next: ${gameInfo.hasNextBtn}`);

// Try to interact based on game type
let interacted = false;

// Type 1: Calculation games (input + submit)
if (gameInfo.numInputCount > 0 && gameInfo.hasSubmitBtn) {
  console.log('  -> Trying: input number + submit');
  const input = await page.$('input[type=number]');
  if (input) {
    await input.fill('100');
    const submitBtn = await page.$('button:has-text("确认"), button:has-text("提交"), button:has-text("Submit"), button:has-text("CHECK")');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(1500);
      interacted = true;
    }
  }
}

// Type 2: Slider + launch games
if (!interacted && gameInfo.sliderCount > 0 && gameInfo.hasLaunchBtn) {
  console.log('  -> Trying: adjust slider + launch');
  const launchBtn = await page.$('button:has-text("发射"), button:has-text("Launch"), button:has-text("推"), button:has-text("GO")');
  if (launchBtn) {
    await launchBtn.click();
    await page.waitForTimeout(3000); // Wait for animation
    interacted = true;
  }
}

// Type 3: Card/option selection games
if (!interacted && gameInfo.cardCount > 0) {
  console.log('  -> Trying: click first card option');
  const card = await page.$('[data-option], .option-card, .choice-btn');
  if (card) {
    await card.click();
    await page.waitForTimeout(1500);
    interacted = true;
  }
}

// Type 4: Canvas click games
if (!interacted) {
  console.log('  -> Trying: click canvas center');
  const canvas = await page.$('canvas');
  if (canvas) {
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1500);
      interacted = true;
    }
  }
}

await page.screenshot({ path: path.join(outDir, `${kname}_r1_after.png`) });

// Check if level/round changed
const afterInfo = await page.evaluate(() => {
  const roundInfo = document.querySelector('#roundInfo, .info');
  const resultPanel = document.querySelector('.result-panel, #resultPanel');
  const isResultVisible = resultPanel && getComputedStyle(resultPanel).display !== 'none';

  // Look for "next level" or "continue" buttons in result panel
  const nextBtns = [...document.querySelectorAll('button')].filter(b => {
    const t = b.textContent?.trim() || '';
    return t.includes('下一') || t.includes('Next') || t.includes('继续');
  });

  return {
    levelText: roundInfo?.textContent || '',
    resultVisible: isResultVisible,
    resultText: resultPanel?.textContent?.substring(0, 200) || '',
    nextBtnCount: nextBtns.length,
    nextBtnTexts: nextBtns.map(b => b.textContent?.trim()),
  };
});

console.log(`  After interaction:`);
console.log(`    Level: ${afterInfo.levelText}`);
console.log(`    Result panel visible: ${afterInfo.resultVisible}`);
if (afterInfo.resultVisible) {
  console.log(`    Result: ${afterInfo.resultText.substring(0, 100)}`);
  console.log(`    Next buttons: ${afterInfo.nextBtnTexts.join(', ')}`);

  // Try clicking "next level" button
  if (afterInfo.nextBtnCount > 0) {
    console.log('  -> Clicking next level button...');
    const nextBtn = await page.$('button:has-text("下一"), button:has-text("Next"), button:has-text("继续")');
    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(outDir, `${kname}_r2.png`) });

      const r2Info = await page.evaluate(() => {
        const roundInfo = document.querySelector('#roundInfo, .info');
        return { levelText: roundInfo?.textContent || '' };
      });
      console.log(`    After next: ${r2Info.levelText}`);
    }
  }
}

console.log(`  JS errors: ${errors.length}`);
if (errors.length) errors.forEach(e => console.log(`    ${e.substring(0, 120)}`));

await browser.close();
console.log(`  Screenshots: ${outDir}/${kname}_*.png`);
