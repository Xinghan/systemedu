// Run with the temporary development-only aloha-release-check preview route.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='/Users/xinghan/Dev/systemeduidea/projects_data/aloha-bimanual-apprentice';
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json','utf8'));
const browser=await chromium.launch({args:['--no-proxy-server']});
const page=await browser.newPage();
const checks=[],errors=[];page.on('pageerror',e=>errors.push(String(e)));
const media=process.env.ALOHA_CHECK_MEDIA || 'diagram';
try {
 for (const width of [1280,390]) {
  await page.setViewportSize({width,height:900});
  for(const entry of manifest.knodes) {
   const sections=JSON.parse(await fs.readFile(root+'/'+entry.knode_dir+'/sections.json','utf8')).rendered_sections;
   const slides=JSON.parse(await fs.readFile(root+'/'+entry.knode_dir+'/slides.json','utf8')).slides.filter(s=>media==='canvas' ? sections[s.payload.idea_id || s.payload.diagram_html_id]?.html?.includes('<canvas') : s.kind==='diagram');
   if(!slides.length)continue;
   await page.goto('http://localhost:4000/slide-preview/aloha-release-check?node='+entry.module_id+'&media='+media);
   const player=page.locator('[data-slide-player]');await player.waitFor();
   for(let index=0;index<slides.length;index++) {
    await player.locator('section h3').click();
    const frame=page.frameLocator('iframe');
    await frame.locator('body').waitFor();
    await frame.locator('body').evaluate(async body=>{await Promise.all([...body.querySelectorAll('img')].map(i=>i.decode()));});
    await page.waitForTimeout(150);
    const content=await frame.locator('body').evaluate(body=>({text:body.innerText.length,images:[...body.querySelectorAll('img')].map(i=>({width:i.naturalWidth,height:i.naturalHeight})),svg:body.querySelectorAll('svg').length,canvases:[...body.querySelectorAll('canvas')].map(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}))}));
    assert(content.text>50||content.images.length||content.svg);
    assert(content.images.every(i=>i.width>0&&i.height>0));
    assert(content.canvases.every(c=>c.width>=100&&c.height>=100),JSON.stringify({node:entry.module_id,content}));
    if(index===0&&['M19','M64'].includes(entry.module_id))await page.screenshot({path:`artifacts/aloha-full-course/diagram-${entry.module_id}-${width}.png`});
    checks.push({node:entry.module_id,slide:slides[index].slide_id,width,...content});
    await page.keyboard.press('Escape');await page.locator('iframe').waitFor({state:'detached'});
    if(index+1<slides.length){await player.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(i=>document.querySelector('[data-slide-player]')?.getAttribute('data-slide-index')===String(i),index+1);}
   }
  }
 }
 assert.deepEqual(errors,[]);
 const report={status:'pass',fixture:'Temporary development-only route uses actual SlideDeckPlayer and original course data',checks,pageErrors:errors};
 await fs.writeFile('artifacts/aloha-full-course/'+media+'-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'pass',media,checks:checks.length}));
}finally{await browser.close();}
