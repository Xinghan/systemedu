import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url).pathname,url='http://127.0.0.1:4000/mission/space/control?task=pick-an-observation-site%3AM01';
const b=await chromium.launch({headless:true}),report={passed:false,checks:[],errors:[]};
const settled=p=>expect(p.locator('[data-room-arrival]')).toHaveAttribute('data-phase','finished',{timeout:8500});
const tab=(p,label)=>p.getByRole('navigation',{name:'任务中心模块'}).getByRole('button',{name:label,exact:true});
const watch=p=>p.on('pageerror',e=>report.errors.push(e.message));
try{
 const c=await b.newContext({viewport:{width:1440,height:950}}),p=await c.newPage();watch(p);await p.goto(url);await settled(p);
 await p.getByLabel('我的证据摘要').fill('显示屏启动验收：输入和计时保持连续。');
 await p.getByRole('button',{name:'开始本次工作',exact:true}).click();await expect(p.getByLabel('本次工作用时')).toHaveAttribute('data-running','true');
 await p.evaluate(()=>{window.savedOrder=document.querySelector('[data-task-order]');window.savedClock=document.querySelector('[data-mission-clock]')});
 await p.getByRole('button',{name:'重播入场',exact:true}).click();await expect(p.locator('[data-room-arrival]')).toHaveAttribute('data-phase','playing');
 const initial=await p.evaluate(()=>({time:performance.now(),duration:document.querySelector('[data-room-arrival]').dataset.arrivalDuration}));expect(initial.duration).toBe('5600');
 // Measure real time, rather than merely checking CSS duration declarations.
 await p.waitForTimeout(2100);
 const mid=await p.locator('[data-room-arrival]').evaluate(e=>({phase:e.dataset.phase,opacity:getComputedStyle(e).opacity,animations:e.getAnimations({subtree:true}).map(a=>({name:a.animationName,iterations:a.effect.getTiming().iterations}))}));
 expect(mid.phase).toBe('playing');expect(Number(mid.opacity)).toBe(1);expect(mid.animations.every(a=>a.iterations!==Infinity)).toBe(true);
 await p.screenshot({path:dir+'terminal-ignition.png'});
 await p.waitForTimeout(1400);
 expect(await p.locator('[data-room-arrival]').evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
 expect(await p.locator('[data-room-arrival] h2 > span > span').evaluateAll(es=>es.every(e=>getComputedStyle(e).opacity==='1'))).toBe(true);
 await p.screenshot({path:dir+'terminal-ready.png'});await settled(p);
 const elapsed=await p.evaluate(t=>performance.now()-t,initial.time);expect(elapsed).toBeGreaterThan(5000);expect(elapsed).toBeLessThan(8000);report.elapsedMs=elapsed;
 expect(await p.evaluate(()=>window.savedOrder===document.querySelector('[data-task-order]')&&window.savedClock===document.querySelector('[data-mission-clock]'))).toBe(true);
 await expect(p.getByLabel('本次工作用时')).toHaveAttribute('data-running','true');await expect(p.getByLabel('我的证据摘要')).toHaveValue(/显示屏启动验收/);
 await p.getByRole('button',{name:'暂停计时',exact:true}).click();
 report.checks.push('Real full-background hold exceeds 3.5s; complete arrival lasts approximately 5.6s; characters settle to full opacity; effects have finite iterations; timer/form instances persist');
 for(const key of ['Escape','Tab']){await p.getByRole('button',{name:'重播入场',exact:true}).click();await expect(p.locator('[data-room-arrival]')).toBeVisible();await p.keyboard.press(key);await settled(p)}
 await tab(p,'任务地图').click();await expect(p.locator('[data-room-arrival]')).toContainText('进入任务地图');await p.getByRole('button',{name:/跳过入场/}).click();await settled(p);
 await expect(p.locator('[data-mission-node]')).toHaveCount(8);report.checks.push('Escape, Tab and visible skip still dismiss immediately; module switch retains map functionality');await c.close();
 for(const width of [390,320]){
  const c=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});const p=await c.newPage();watch(p);await p.goto(url.replace('pick-an-observation-site%3AM01','mars-analog-rover%3AM25'));await settled(p);
  await p.getByRole('button',{name:'重播入场',exact:true}).click();await expect(p.locator('[data-room-arrival]')).toHaveAttribute('data-phase','playing');
  await p.waitForTimeout(3400);
  await expect(p.getByRole('heading',{name:'自主系统联调区',exact:true})).toBeVisible();
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&innerWidth<=visualViewport.width+1)).toBe(true);
  const rect=await p.getByRole('button',{name:/跳过入场/}).boundingBox();expect(rect.y+rect.height).toBeLessThanOrEqual(844);
  await p.screenshot({path:dir+`terminal-${width}.png`});await p.getByRole('button',{name:/跳过入场/}).click();await settled(p);await c.close();
 }
 report.checks.push('390px and 320px: longest station heading fits, no horizontal viewport expansion, skip remains fully visible');
 const c2=await b.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'}),q=await c2.newPage();watch(q);await q.goto(url);await settled(q);
 await expect(q.locator('[data-room-arrival]')).not.toBeVisible();expect(await q.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
 await expect(q.getByLabel('我的子任务状态',{exact:true})).toBeEnabled();await c2.close();report.checks.push('Reduced motion skips every display effect and leaves the task ready for input');
 expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'verification.json',JSON.stringify(report,null,2)+'\n');await b.close()}
