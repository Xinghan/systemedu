// Isolated release checkout: real TeacherSceneView; only lesson HTTP is fixture-backed.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='/Users/xinghan/Dev/systemeduidea/projects_data/aloha-bimanual-apprentice';
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json','utf8'));
const entry=manifest.knodes.find(k=>k.module_id==='M19');
const value=JSON.parse(await fs.readFile(root+'/'+entry.knode_dir+'/slides.json','utf8'));
const original=value.slides.filter(s=>s.payload.images?.length||s.kind==='diagram');
const slides=[original.find(s=>s.payload.images?.length),original.find(s=>s.kind==='diagram')];assert(slides.every(Boolean));
const sections=JSON.parse(await fs.readFile(root+'/'+entry.knode_dir+'/sections.json','utf8'));
const browser=await chromium.launch({args:['--no-proxy-server']});
const page=await browser.newPage();const errors=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));
try {
 await page.route('**/api/my/projects/aloha-bimanual-apprentice/knodes/M19',r=>r.fulfill({json:{slides,knode_dir:entry.knode_dir,rendered_sections:sections}}));
 await page.route('**/api/library/projects/aloha-bimanual-apprentice/files/**',async r=>{
  const relative=decodeURIComponent(new URL(r.request().url()).pathname.split('/files/')[1]);
  assert(relative.startsWith(entry.knode_dir+'/')&&!relative.includes('..'));
  await r.fulfill({body:await fs.readFile(root+'/'+relative),contentType:'image/png'});
 });
 for(const width of [1280,390]) {
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:4015/slide-preview/aloha-release-check');
  const image=page.locator('main figure img');await image.waitFor();await image.evaluate(i=>i.decode());
  const geometry=await image.evaluate(i=>({loaded:i.naturalWidth>0,width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height}));assert(geometry.loaded&&geometry.width>100&&geometry.height>50);
  await page.screenshot({path:`artifacts/aloha-full-course/release-image-${width}.png`});
  await page.locator('main > div > div:last-child button').last().click();
  await page.locator('main section h3').click();
  const diagram=page.frameLocator('iframe').locator('img').first();await diagram.waitFor();await diagram.evaluate(i=>i.decode());
  assert(await diagram.evaluate(i=>i.naturalWidth>100));
  await page.screenshot({path:`artifacts/aloha-full-course/release-diagram-${width}.png`});
  checks.push({width,image:geometry,diagramLoaded:true});
 }
 assert.deepEqual(errors,[]);
 const report={status:'pass',scope:'Isolated release source, original M19 data via HTTP fixture, original PNG bytes; no live student account used',checks,pageErrors:errors};
 await fs.writeFile('artifacts/aloha-full-course/release-renderer-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
