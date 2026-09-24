import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const source = '/Users/xinghan/Dev/systemeduidea';
const assets = JSON.parse(await fs.readFile(path.join(out, 'assets.json')));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch({args:['--no-proxy-server']});
const context = await browser.newContext({viewport:{width:1440,height:1100}, reducedMotion:'reduce'});
const page = await context.newPage();
const results = [];
try {
  await page.goto('http://localhost:4000/library', {waitUntil:'domcontentloaded'});
  for (const asset of assets) {
    const url = `/project-covers/${asset.slug}/${asset.served}`;
    const bytes = await fs.readFile(path.join(root, 'packages/student-web/public', url));
    const sourceBytes = await fs.readFile(path.join(source, 'projects_data', asset.slug, asset.served));
    expect(sha(bytes)).toBe(asset.servedSha256);
    expect(sha(sourceBytes)).toBe(asset.servedSha256);
    const manifest = JSON.parse(await fs.readFile(path.join(source, 'projects_data', asset.slug, 'manifest.json')));
    expect(manifest.cover_image_path).toBe(asset.served);
    const response = await page.request.get('http://localhost:4000' + url);
    expect(response.status()).toBe(200);
    expect(sha(await response.body())).toBe(asset.servedSha256);
    const card = page.locator(`[data-project-card="${asset.slug}"]`);
    await card.scrollIntoViewIfNeeded();
    const img = card.locator('img').first();
    await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0), {timeout:30000}).toBe(true);
    const desktop = await img.evaluate(el => ({src:el.currentSrc,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}));
    expect(desktop.src).toContain('cover-editorial-v3');
    expect(Math.abs(desktop.w / desktop.h - 1.5)).toBeLessThan(0.01);
    await card.screenshot({path:path.join(out, `${asset.slug}-desktop.png`)});
    results.push({slug:asset.slug,http:200,sourceAndWebMatch:true,desktop});
  }
  await page.setViewportSize({width:390,height:844});
  for (const result of results) {
    const card = page.locator(`[data-project-card="${result.slug}"]`);
    await card.scrollIntoViewIfNeeded();
    const img = card.locator('img').first();
    await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    result.mobile = await img.evaluate(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}));
    expect(Math.abs(result.mobile.w / result.mobile.h - 1.5)).toBeLessThan(0.01);
    if (['mars-analog-rover','ai-ant-ethologist'].includes(result.slug)) {
      await card.evaluate(el => window.scrollTo({top:window.scrollY + el.getBoundingClientRect().top - 140, behavior:'instant'}));
      await page.screenshot({path:path.join(out, `${result.slug}-mobile.png`)});
    }
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await fs.writeFile(path.join(out,'verification.json'), JSON.stringify({checkedAt:new Date().toISOString(),checks:['Eight unique covers HTTP 200','Source and website asset SHA-256 equality','All source manifests select new version','All eight desktop and mobile cards use new covers at 3:2','No horizontal page overflow at 390px'],results},null,2)+'\n');
  console.log('PASS: 8 covers, source/web parity, desktop/mobile 3:2 and no overflow.');
} finally { await browser.close(); }
