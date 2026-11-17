const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const out=path.resolve(__dirname,'../../artifacts/mars-landing-20261110'),origin=process.env.MARS_ORIGIN||'http://127.0.0.1:4000';
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(origin+'/standalone/mars-landing',{waitUntil:'networkidle'});
 const model=page.locator('[data-model="blender-glb"]');await expect(model).toHaveCount(1);await expect(page.getByRole('button',{name:'播放演示'})).toBeEnabled();
 assert.equal(await model.getAttribute('data-animations'),'1');
 await page.screenshot({path:out+'/desktop-skycrane.png',fullPage:true});
 for(const [index,label]of ['降落伞减速','抛掉隔热罩','动力下降','缆绳放下火星车','触地后飞离'].entries()){
  await page.getByRole('button',{name:new RegExp(label+'$')}).click();
  await expect(model).toHaveAttribute('data-phase',String(index));
  await page.screenshot({path:out+`/phase-${index+1}.png`,fullPage:false});
 }
 // Exact slider endpoints, including backwards from the final frame.
 const scrub=async t=>page.getByRole('slider',{name:'着陆演示时间轴'}).fill(String(t));
 await scrub(42);await expect(model).toHaveAttribute('data-time','42.00');await scrub(0);await expect(model).toHaveAttribute('data-time','0.00');
 await page.getByRole('checkbox',{name:'隐藏外壳，看内部'}).check();await page.screenshot({path:out+'/shell-hidden.png'});
 await page.getByRole('checkbox',{name:'隐藏外壳，看内部'}).uncheck();
 await page.getByRole('button',{name:'播放演示'}).click();await expect.poll(async()=>Number(await model.getAttribute('data-time'))).toBeGreaterThan(.3);
 await page.getByRole('button',{name:'暂停演示'}).click();const stopped=await model.getAttribute('data-time');await page.waitForTimeout(300);assert.equal(await model.getAttribute('data-time'),stopped);
 for(const name of ['侧面','俯视','整体'])await page.getByRole('button',{name,exact:true}).click();
 await page.getByRole('button',{name:'承重缆绳与连接线',exact:true}).click();await expect(model).toHaveAttribute('data-phase','3');
 await expect(page.getByRole('button',{name:'承重缆绳与连接线',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:/为什么把火星车吊在下面/}).click();await expect(page.getByText('这样可以让六个轮子直接接地',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'切换静态结构图'}).click();await expect(page.locator('[data-mars-fallback]')).toBeVisible();await expect(page.getByRole('button',{name:'播放演示'})).toBeDisabled();
 await page.screenshot({path:out+'/fallback.png'});
 await page.getByRole('button',{name:'重新加载三维模型'}).click();await expect(page.getByRole('button',{name:'播放演示'})).toBeEnabled();await expect(page.locator('canvas[data-mars-canvas]')).toHaveCount(1);
 await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'networkidle'});await expect(page.getByRole('button',{name:'播放演示'})).toBeEnabled();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert((await page.locator('canvas[data-mars-canvas]').boundingBox()).height>=500,'Mobile model must not collapse');
 await page.screenshot({path:out+'/mobile.png',fullPage:true});
 await page.getByRole('button',{name:/降落伞减速$/}).click();await page.screenshot({path:out+'/mobile-parachute.png',fullPage:true});
 for(const file of ['mars-landing.glb','mars-landing.blend','poster.png']){const res=await page.request.get(origin+'/mars-landing/'+file);assert.equal(res.status(),200);assert((await res.body()).length>1000)}
 // Context loss must preserve the explanatory page and offer retry.
 await page.locator('canvas[data-mars-canvas]').evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
 await expect(page.locator('[data-mars-fallback]')).toBeVisible();
 assert.deepEqual(errors,[]);
 const report={passed:true,checks:['Actual Blender GLB loaded with a 42-second animation','All five stages and reversible timeline','Play/pause and three camera presets','Cutaway control, semantic selection and explanatory reveal','Explicit fallback, retry without duplicate canvas, and WebGL context loss','390px mobile layout with no horizontal overflow','Source model, GLB and fallback image downloadable'],pageErrors:errors};
 fs.writeFileSync(out+'/browser-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
