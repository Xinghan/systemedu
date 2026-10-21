const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:14921';
const root=process.env.SYSTEMEDU_ROOT||process.cwd();
const output=path.join(root,'artifacts/mission-sync-release-20261021');
const mode=process.env.RELEASE_MODE||'candidate';
const report={passed:false,build:process.env.BUILD_ID,mission_lines:0,films:0,checks:[],errors:[]};
const lines=['space','biomedicine','energy','robotics','earth','computing','brain'];
const titles=['星际远航','分子寻药','未来能源','机器人觉醒','地球脉动','智能造物','大脑解码'];
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 if(process.env.API_BASE_URL && process.env.API_BASE_URL!==base){
  await context.route('**/api/**',async route=>{
   assert.equal(route.request().method(),'GET','Candidate validation must not write production data');
   const url=new URL(route.request().url());
   const response=await route.fetch({url:process.env.API_BASE_URL+url.pathname+url.search});
   await route.fulfill({response});
  });
 }
 const page=await context.newPage();
 page.on('pageerror',error=>report.errors.push(error.message));
 try {
  for(let i=0;i<lines.length;i++){
   const response=await page.goto(base+'/mission/'+lines[i],{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200);
   await page.getByRole('heading').first().waitFor();
   const skip=page.getByRole('button',{name:/跳过短片|开始任务|回到当前任务/}).first();
   if(await skip.isVisible().catch(()=>false))await skip.click();
   assert((await page.locator('body').innerText()).includes(titles[i]),lines[i]);
   await page.waitForFunction(()=>Array.from(document.images).filter(img=>{const r=img.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.width>0}).every(img=>img.complete&&img.naturalWidth>0),null,{timeout:60000});
   await page.screenshot({path:path.join(output,`${mode}-${lines[i]}.png`)});
   const response2=await page.goto(base+'/mission/'+lines[i]+'/control',{waitUntil:'domcontentloaded'});
   assert.equal(response2.status(),200);
   await page.waitForFunction(()=>document.body.innerText.length>180);
   report.mission_lines++;
   report.checks.push(lines[i]+': mission map and control center render');
  }
  await page.goto(base+'/library?view=lines',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(names=>names.every(n=>document.body.innerText.includes(n)),titles);
  report.checks.push('Library exposes all seven project lines');
  for(const slug of ['aloha-bimanual-apprentice','teachopencadd-candidate-research','lightkurve-transit-detective']){
   const r=await page.request.get((process.env.API_BASE_URL||base)+'/api/library/projects/'+slug+'/tree');
   assert.equal(r.status(),200,slug);const d=await r.json();assert(d.modules.length>20);
   const detail=await page.goto(base+'/library/'+slug,{waitUntil:'domcontentloaded'});assert.equal(detail.status(),200);
   report.checks.push(slug+': published tree '+d.modules.length+' and course entry');
  }
  const scripts=JSON.parse(fs.readFileSync(path.join(root,'artifacts/presenter-briefings-20261018/scripts.json')));
  for(let index=0;index<scripts.length;index+=4){
   await Promise.all(scripts.slice(index,index+4).map(async item=>{
   const prefix='/mission/'+item.line+'/video/'+item.station;
   const r=await page.request.get(base+prefix+'-v2.mp4',{headers:{Range:'bytes=0-2047'}});
   assert.equal(r.status(),206,prefix);assert(r.headers()['content-type'].includes('video/mp4'));
   assert.equal((await r.body()).length,2048);assert((await r.body()).includes(Buffer.from('moov')));
   const vtt=await page.request.get(base+prefix+'-zh-v2.vtt');assert.equal(vtt.status(),200);
   assert((await vtt.text()).startsWith('WEBVTT'));report.films++;
   }));
   console.log('Validated films: '+report.films);
  }
  report.checks.push('All 40 new films support byte ranges, fast start and captions');
  for(const line of ['energy','robotics','earth','computing','brain']){
   await page.goto(base+'/mission/'+line,{waitUntil:'domcontentloaded'});
   const play=page.getByRole('button',{name:/任务短片/}).first();
   if(!await page.locator('video').count())await play.click();
   const video=page.locator('video').first();await video.waitFor();
   await video.evaluate(async el=>{if(el.readyState<1)await new Promise((resolve,reject)=>{el.addEventListener('loadedmetadata',resolve,{once:true});el.addEventListener('error',reject,{once:true});});await el.play();});
   await page.waitForFunction(()=>document.querySelector('video')?.currentTime>0.4);
   assert.equal(await video.evaluate(v=>v.videoWidth),1920);
  }
  await page.setViewportSize({width:390,height:844});
  for(const line of ['robotics','brain']){
   await page.goto(base+'/mission/'+line+'/control',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.body.innerText.length>180);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
   await page.screenshot({path:path.join(output,`${mode}-${line}-390.png`)});
  }
  const preview=await page.request.get(base+'/preview/aloha/M01');
  assert.notEqual(preview.status(),200,'Local preview must not be enabled in production');
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));
  report.checks.push('Five speakers play; narrow control pages fit; no page errors');
  report.passed=true;
 } finally {
  fs.writeFileSync(path.join(output,mode+'-verification.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();console.log(JSON.stringify(report));
 }
})().catch(e=>{console.error(e);process.exit(1)});
