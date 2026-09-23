import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const slug='aloha-bimanual-apprentice';
const dir=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({args:['--no-proxy-server']});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const result={slug,localOnly:true,checks:[]};
try {
 const response=await page.request.get(`http://127.0.0.1:18820/api/library/projects/${slug}`);
 assert.equal(response.status(),200);
 const p=await response.json();assert.equal(p.knode_count,82);assert.equal(p.difficulty,5);assert.equal(p.stage_count,11);
 result.project={title:p.title_zh,knode_count:p.knode_count,stage_count:p.stage_count,difficulty:p.difficulty,status:p.status};
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  await page.goto('http://localhost:4000/library?view=lines&line=neuro-bionics');
  const card=page.locator(`[data-project-card="${slug}"]`);
  await card.waitFor();await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(s=>document.querySelector(`[data-project-card="${s}"]`)?.getAttribute('data-available')==='true',slug);
  const img=card.locator('img[alt=""]');await img.evaluate(i=>i.decode());
  const geometry=await img.evaluate(i=>({width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height,loaded:i.complete&&i.naturalWidth>0}));
  assert(geometry.loaded);assert(Math.abs(geometry.width/geometry.height-1.5)<.025);
  assert((await card.innerText()).includes('82'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await card.screenshot({path:dir+`course-card-${width}.png`});
  result.checks.push({view:'line-card',width,...geometry});
  await page.goto(`http://localhost:4000/library/${slug}`);
  await page.getByRole('heading',{level:1}).waitFor();
  await page.waitForTimeout(600);
  assert((await page.locator('body').innerText()).includes('82'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:dir+`course-detail-${width}.png`});
  result.checks.push({view:'course-detail',width,noHorizontalOverflow:true});
 }
 const zip=await page.request.get('http://localhost:4000/project-lines/neuro-bionics/aloha/aloha-practice-kit.zip');
 assert.equal(zip.status(),200);const bytes=await zip.body();assert.equal(bytes.subarray(0,2).toString(),'PK');result.practiceZipBytes=bytes.length;
 assert.deepEqual(errors,[]);result.pageErrors=errors;result.status='pass';
 await fs.writeFile(dir+'course-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
