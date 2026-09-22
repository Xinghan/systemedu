import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const out = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch({args:['--no-proxy-server']});
const page = await browser.newPage();
const results = [];
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height:1000});
    await page.goto('http://localhost:4000/library?view=lines');
    await page.locator('[data-line-card="energy-motion"] img').waitFor();
    for (const id of ['neuro-bionics','energy-motion']) {
      const card = page.locator(`[data-line-card="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.locator('img').evaluate(img => img.decode());
      const geometry = await card.locator('img').evaluate(img => ({
        src: img.currentSrc, loaded:img.complete && img.naturalWidth > 0,
        width:img.getBoundingClientRect().width, height:img.getBoundingClientRect().height,
      }));
      if (!geometry.loaded || Math.abs(geometry.width/geometry.height-1.5) > .02) throw Error('Image geometry '+id);
      await card.screenshot({path:`${out}${id}-${width}.png`});
      results.push({id, viewport:width, ...geometry});
    }
    if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('Page overflows');
  }
  await fs.writeFile(out+'covers-check.json', JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
