import {createRequire} from 'node:module';
const {chromium,expect}=createRequire(import.meta.url)('@playwright/test');
import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url).pathname,origin='http://127.0.0.1:4020';
const presenters=JSON.parse(await fs.readFile('packages/student-web/src/lib/project-lines/stage-presenters.json'));
const browser=await chromium.launch({headless:true});const report={passed:false,checks:[],errors:[]};
try {
 for (const [line,person] of Object.entries(presenters)) {
  const stations=Object.keys(person.dialogues);const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await ctx.addInitScript(({line,stations})=>{for(const station of stations)localStorage.setItem(`systemedu:${line}-stage-film:v1:guest:${station}`,'seen')},{line,stations});
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${origin}/mission/${line}?station=${stations[0]}`);
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible({timeout:60000});
  await expect(dialog).toContainText(person.name);await expect(dialog).toContainText('AI 生成的虚构任务搭档');
  const video=dialog.locator('video');await expect(video).toHaveAttribute('src',`/mission/${line}/video/${stations[0]}-v2.mp4`);
  await expect(video).toHaveAttribute('poster',`/mission/${line}/video/posters/presenter-v2.webp`);
  await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(1);
  await expect(video).toHaveJSProperty('paused',true);
  await dialog.getByText('阅读完整任务简报',{exact:true}).click();await expect(dialog).toContainText(person.dialogues[stations[0]]);
  await page.screenshot({path:dir+line+'-briefing.png'});
  await dialog.getByRole('button',{name:'关闭任务短片',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(({line,station})=>localStorage.getItem(`systemedu:${line}-stage-film:v2:guest:${station}`),{line,station:stations[0]})).toBe('seen');
  await page.reload();await expect(page.locator('[data-integrated-journey]')).toBeVisible({timeout:60000});await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:/任务短片 ·/}).click();await expect(dialog).toBeVisible();
  await video.evaluate(v=>v.dispatchEvent(new Event('ended')));await expect(dialog).toHaveCount(0);
  await page.goto(`${origin}/mission/${line}?station=${stations[1]}`);await expect(dialog).toBeVisible();
  await expect(dialog.locator('video')).toHaveAttribute('src',`/mission/${line}/video/${stations[1]}-v2.mp4`);
  await expect(dialog).toContainText(person.dialogues[stations[1]]);
  await ctx.close();report.checks.push(`${line}: v1 watching does not suppress new character; close/reload/replay/end/next station work; poster, identity, transcript and metadata load`);
 }
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',isMobile:true,hasTouch:true});const page=await ctx.newPage();await page.goto(origin+'/mission/energy');await expect(page.getByRole('dialog')).toBeVisible({timeout:60000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:dir+'mobile-briefing.png'});await ctx.close();report.checks.push('390px dialog fits viewport');
 expect(report.errors).toEqual([]);report.passed=true;
} catch(e) {report.failure=String(e);throw e;} finally {await fs.writeFile(dir+'browser-verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
