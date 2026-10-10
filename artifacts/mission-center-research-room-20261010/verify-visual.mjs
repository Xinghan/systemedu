import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url).pathname,origin='http://127.0.0.1:4000';
const browser=await chromium.launch({headless:true}),report={passed:false,checks:[],errors:[],scenes:[]};
const views=['工作台','任务地图','时间表','工作日志','工程档案'];
const tab=(p,label)=>p.getByRole('navigation',{name:'任务中心模块'}).getByRole('button',{name:label,exact:true});
const overflow=async p=>expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
try {
 for (const width of [1440,390,320]) {
  const c=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',...(width<500?{isMobile:true,hasTouch:true}:{})});
  const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await c.addInitScript(()=>{for(let i=1;i<=5;i++)localStorage.setItem(`systemedu:mission:space:stage-film:${i}:v1`,'1')});
  await p.goto(origin+'/mission/space/control?task=pick-an-observation-site%3AM01');
  await expect(p.getByLabel('我的子任务状态',{exact:true})).toBeEnabled();
  const scene=p.locator('[aria-label="远征总览"] img');
  await expect.poll(()=>scene.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  const sceneData=await scene.evaluate(el=>({source:el.currentSrc,width:el.naturalWidth}));report.scenes.push({viewport:width,...sceneData});
  expect(sceneData.source).toContain(width===1440?'1536.webp':'640.webp');
  expect(await p.locator('[data-task-order]').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  for(const [i,label] of views.entries()) {
   await tab(p,label).click();await expect(tab(p,label)).toHaveAttribute('aria-current','page');await overflow(p);
   await p.screenshot({path:dir+`view-${i}-${width}.png`,fullPage:true});
   if(i===0) await p.screenshot({path:dir+`entrance-${width}.png`});
  }
  await tab(p,'工作台').click();await expect(tab(p,'工作台')).toHaveAttribute('aria-current','page');await p.getByLabel('我的证据摘要').fill('科研工作台样式验收：检查来源、尺度与场景限制。');
  await p.reload();await expect(p.getByLabel('我的证据摘要')).toHaveValue('科研工作台样式验收：检查来源、尺度与场景限制。');
  await p.getByLabel('我的证据摘要').focus();expect(await p.getByLabel('我的证据摘要').evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  await p.getByRole('button',{name:/T05.*视觉训练站/}).click();await expect(p.locator('[data-task-order]')).toHaveAttribute('data-task-order','mars-analog-rover:M02');
  await expect(p.locator('[aria-label="当前任务站"]')).toContainText('T05 · 视觉训练站');
  if(width===1440){
   await p.goto(origin+'/explore/space-exploration/pick-an-observation-site?node=M01&mission=space');
   await expect(p.locator('[data-mission-work-strip]')).toBeVisible();
   expect(await p.locator('[data-mission-work-strip]').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(240, 242, 232)');
   await p.locator('[data-mission-work-strip]').screenshot({path:dir+'classroom-strip-unchanged.png'});
  }
  await c.close();
 }
 report.checks.push('Five center modules render without horizontal overflow at 1440, 390 and 320 px','Responsive image decodes at 1536 desktop / 640 mobile; reduced motion disables scene/task arrival','Task evidence survives refresh; keyboard focus is visible; station selection and live current-station label agree','Shared work strip in the existing classroom retains its original light styling');
 expect(report.errors).toEqual([]);report.passed=true;
} catch(e) {report.failure=String(e);throw e} finally {await fs.writeFile(dir+'visual-verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
