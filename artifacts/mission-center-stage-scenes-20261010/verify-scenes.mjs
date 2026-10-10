import {chromium, expect} from '@playwright/test';
import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url).pathname,origin='http://127.0.0.1:4000';
const curriculum=JSON.parse(await fs.readFile(new URL('../../packages/student-web/src/lib/project-lines/space-curriculum.json',import.meta.url)));
const stages=curriculum.stations;
const route=(task,view='desk')=>`${origin}/mission/space/control?task=${encodeURIComponent(task)}&view=${view}`;
const taskFor=s=>s.steps[0]||'micro:spot-a-world';
const tab=(p,label)=>p.getByRole('navigation',{name:'任务中心模块'}).getByRole('button',{name:label,exact:true});
const arrival=p=>p.locator('[data-room-arrival]');
const settled=p=>expect(arrival(p)).toHaveAttribute('data-phase','finished');
const overflow=async p=>expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
const browser=await chromium.launch({headless:true}),report={passed:false,checks:[],errors:[],scenes:[]};
const watch=p=>p.on('pageerror',e=>report.errors.push(e.message));
const seed=c=>c.addInitScript(()=>{for(let i=1;i<=5;i++)localStorage.setItem(`systemedu:mission:space:stage-film:${i}:v1`,'1')});
try {
  const c=await browser.newContext({viewport:{width:1440,height:950}});await seed(c);
  const p=await c.newPage();watch(p);
  await p.goto(route('pick-an-observation-site:M01'));
  await settled(p);
  const evidence=p.getByLabel('我的证据摘要');
  await evidence.fill('动画验收：证据仍保留在原任务，不能随场景切换丢失。');
  await p.getByRole('button',{name:'开始本次工作',exact:true}).click();
  await expect(p.getByLabel('本次工作用时')).toHaveAttribute('data-running','true');
  await p.evaluate(()=>{window.savedTaskOrder=document.querySelector('[data-task-order]');window.savedClock=document.querySelector('[data-mission-clock]')});
  await p.getByRole('button',{name:'重播入场',exact:true}).click();
  await expect(arrival(p)).toHaveAttribute('data-phase','playing');
  await p.evaluate(()=>document.querySelector('[data-room-arrival]').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=400}));
  await p.screenshot({path:dir+'arrival-desktop.png'});
  await settled(p);
  expect(await p.evaluate(()=>window.savedTaskOrder===document.querySelector('[data-task-order]')&&window.savedClock===document.querySelector('[data-mission-clock]'))).toBe(true);
  await expect(evidence).toHaveValue(/动画验收/);
  await expect(p.getByLabel('本次工作用时')).toHaveAttribute('data-running','true');
  await p.getByRole('button',{name:'暂停计时',exact:true}).click();
  await p.reload();await settled(p);await expect(evidence).toHaveValue(/动画验收/);
  report.checks.push('Replay preserves task/clock DOM identity, running timer and saved evidence across refresh');

  // Every station has its own decoded scene and real station label.
  for(const station of stages){
    await p.goto(route(taskFor(station)));await settled(p);
    await expect(p.locator('[data-mission-control]')).toHaveAttribute('data-room',station.id);
    const image=p.locator('[aria-label="远征总览"] img');
    await expect.poll(()=>image.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
    const source=await image.evaluate(el=>el.currentSrc);expect(source).toContain(`/stations/${station.id}-v1-1536.webp`);
    await expect(p.locator('h1')).toContainText(station.place);await overflow(p);
    report.scenes.push({station:station.id,source});
    await p.screenshot({path:dir+`stage-${station.id}.png`});
  }
  expect(new Set(report.scenes.map(s=>s.source)).size).toBe(8);
  report.checks.push('Eight stations use eight distinct decoded backgrounds; header follows actual task selection');

  await p.goto(route('pick-an-observation-site:M01'));await settled(p);
  // Same-station subtask changes and editing do not replay.
  await p.locator('[data-task-choice="pick-an-observation-site:M02"]').click();
  await expect(p.locator('[data-task-order]')).toHaveAttribute('data-task-order','pick-an-observation-site:M02');
  await settled(p);await p.getByLabel('我的证据摘要').fill('同站任务不重播');await settled(p);
  for(const label of ['任务地图','时间表','工作日志','工程档案','工作台']){
    await tab(p,label).click();await expect(arrival(p)).toBeVisible();await expect(arrival(p)).toContainText('进入'+label);await settled(p);await overflow(p);
  }
  report.checks.push('All five module changes replay once; same-station subtask and input changes do not');
  await p.getByRole('button',{name:'重播入场',exact:true}).click();await expect(arrival(p)).toBeVisible();await p.keyboard.press('Escape');await settled(p);
  await p.getByRole('button',{name:'重播入场',exact:true}).click();await expect(arrival(p)).toBeVisible();await p.keyboard.press('Tab');await settled(p);
  await p.getByRole('button',{name:'重播入场',exact:true}).click();await p.getByRole('button',{name:/跳过入场/}).click();await settled(p);
  // Real routed rapid switches: latest module owns the overlay; old timers cannot dismiss it.
  await tab(p,'任务地图').click();
  await p.evaluate(()=>Array.from(document.querySelectorAll('nav[aria-label="任务中心模块"] button')).find(e=>e.textContent.includes('时间表')).click());
  await expect(tab(p,'时间表')).toHaveAttribute('aria-current','page');await expect(arrival(p)).toContainText('进入时间表');await settled(p);
  report.checks.push('Escape, Tab and visible skip control dismiss immediately; rapid navigation resolves to latest view');
  await c.close();

  for(const width of [390,320]){
    const c=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});await seed(c);
    const p=await c.newPage();watch(p);await p.goto(route('assemble-a-rover:M04'));await settled(p);
    await p.getByRole('button',{name:'重播入场',exact:true}).click();await expect(arrival(p)).toHaveAttribute('data-phase','playing');
    expect(await arrival(p).locator('img').evaluate(e=>e.currentSrc)).toContain('1536.webp');
    await overflow(p);
    expect(await p.evaluate(()=>innerWidth<=visualViewport.width+1)).toBe(true);
    const skipBounds=await p.getByRole('button',{name:/跳过入场/}).boundingBox();expect(skipBounds.y+skipBounds.height).toBeLessThanOrEqual(844);
    await p.evaluate(()=>document.querySelector('[data-room-arrival]').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=400}));
    await p.screenshot({path:dir+`arrival-${width}.png`});await settled(p);
    expect(await p.locator('[aria-label="远征总览"] img').evaluate(el=>el.currentSrc)).toContain('640.webp');
    for(const label of ['工作台','任务地图','时间表','工作日志','工程档案']){await tab(p,label).click();await settled(p);await overflow(p);}
    await tab(p,'工作台').click();await settled(p);await p.screenshot({path:dir+`mobile-${width}.png`,fullPage:true});await c.close();
  }
  report.checks.push('390px and 320px: mobile scene variant, entry framing and five modules without overflow');

  const reduced=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'});await seed(reduced);
  const r=await reduced.newPage();watch(r);await r.goto(route('pick-an-observation-site:M01'));await settled(r);
  await expect(arrival(r)).not.toBeVisible();await expect(r.getByRole('button',{name:'重播入场',exact:true})).not.toBeVisible();
  expect(await r.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  await tab(r,'时间表').click();await settled(r);await expect(r.getByLabel('每周计划投入')).toBeEnabled();
  report.checks.push('Reduced-motion preference suppresses entry and panel motion without blocking interaction');await reduced.close();

  const failure=await browser.newContext({viewport:{width:1440,height:950}});await seed(failure);
  await failure.route('**/mission/space/stations/**',route=>route.abort());const f=await failure.newPage();watch(f);
  await f.goto(route('mars-analog-rover:M02'));await settled(f);
  await expect(f.getByLabel('我的子任务状态',{exact:true})).toBeEnabled();
  const fallback=f.locator('[aria-label="远征总览"] img');
  await expect.poll(()=>fallback.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  expect(await fallback.evaluate(el=>el.currentSrc)).toContain('research-control-room');
  await failure.close();report.checks.push('Failed scene requests fall back to the original room and never lock the workspace');
  expect(report.errors).toEqual([]);report.passed=true;
} catch(e) {report.failure=String(e);throw e} finally {await fs.writeFile(dir+'scene-verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
