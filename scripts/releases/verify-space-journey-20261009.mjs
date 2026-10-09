import fs from 'node:fs/promises'
import path from 'node:path'
import {chromium,expect as baseExpect} from '@playwright/test'
const expect=baseExpect.configure({timeout:20000})
// Font requests can outlive video decoding over a slow release-review link.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1'
const [origin,phase,build]=process.argv.slice(2)
if(!origin||!['candidate','production'].includes(phase)||!build)throw new Error('origin phase build required')
const out=path.resolve('artifacts/space-journey-release-20261009',phase)
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']})
const report={passed:false,origin,phase,build,stageFilms:0,checks:[],errors:[]}
let lastPage,currentStep='start'
async function context(options){
 const c=await browser.newContext(options)
 c.setDefaultNavigationTimeout(120000);c.setDefaultTimeout(30000)
 await c.route('**/api/**',async route=>{
  const r=route.request(),u=new URL(r.url())
  // Anonymous, read-only release review; never forward account or fixture credentials.
  if(r.method()!=='GET'||r.headers().authorization){report.errors.push('Blocked non-public API request');return route.abort()}
  if(phase==='candidate')return route.fulfill({response:await c.request.get(`https://systeme.xin${u.pathname}${u.search}`)})
  return route.continue()
 })
 c.on('page',p=>{lastPage=p;p.on('pageerror',e=>report.errors.push(e.message))})
 return c
}
const film=(p,n)=>p.locator(`[data-stage-film="${n}"]`)
const close=async p=>{await p.getByRole('button',{name:'关闭任务短片',exact:true}).click();await expect(p.locator('dialog[open]')).toHaveCount(0)}
const playing=async p=>expect.poll(()=>p.locator('video').evaluate(v=>!v.paused&&v.currentTime>0),{timeout:120000}).toBe(true)
try{
 const c=await context({viewport:{width:1440,height:1050}}),p=await c.newPage()
 await p.goto(origin+'/library?view=lines',{waitUntil:'domcontentloaded'})
 await expect(p.locator('[data-line-card="space-exploration"]')).toHaveAttribute('href','/mission/space')
 await p.locator('[data-line-card="space-exploration"]').click();await expect(film(p,1)).toBeVisible();await playing(p)
 await p.screenshot({path:path.join(out,'stage-1-desktop.png')});await close(p)
 await p.reload({waitUntil:'domcontentloaded'});await expect(p.getByRole('button',{name:'刷新进展'})).toBeEnabled();await expect(p.locator('dialog')).toHaveCount(0)
 const films=[]
 for(const level of [1,2,3,4,5]){
  currentStep=`stage-${level}`;console.log(currentStep)
  if(level===1)await p.locator('[data-stage-replay]').click()
  else await p.locator(`[data-journey-level="${level}"]`).click()
  await expect(film(p,level)).toBeVisible();await playing(p)
  const info=await p.locator('video').evaluate(v=>{v.pause();return {src:v.currentSrc,duration:v.duration,width:v.videoWidth,height:v.videoHeight}})
  expect(info.width).toBe(1920);expect(info.height).toBe(1080);expect(info.duration).toBeGreaterThan(18);expect(info.src).toContain(`/stage-${level}-v1.mp4`)
  const range=await c.request.get(origin+`/mission/space/video/stage-${level}-v1.mp4`,{headers:{Range:'bytes=0-1023'}})
  expect(range.status()).toBe(206);expect(range.headers()['content-type']).toContain('video/mp4');expect((await range.body()).length).toBe(1024)
  const captions=await c.request.get(origin+`/mission/space/video/stage-${level}-zh.vtt`);expect(captions.status()).toBe(200);expect(await captions.text()).toContain('WEBVTT')
  films.push({...info,range:206,captions:200})
  await p.locator('video').evaluate(v=>{v.currentTime=v.duration-.25;void v.play()});await expect(film(p,level)).toHaveCount(0,{timeout:120000})
 }
 report.stageFilms=films.length;report.checks.push({name:'Five real stage films, captions, seek/range, replay, first-visit deduplication and ended return',films})
 currentStep='map-and-courses';console.log(currentStep)
 for(const station of ['mission-design','mechanics','perception','autonomy','planet-science']){
  await p.locator(`[data-mission-node="${station}"]`).click();await expect(p.locator('[data-journey-station]')).toHaveAttribute('data-journey-station',station);await expect(p.locator('dialog')).toHaveCount(0)
 }
 await expect(p.locator('[data-mission-node]')).toHaveCount(8)
 await p.locator('#journey-map').screenshot({path:path.join(out,'map-desktop.png')})
 await p.goto(origin+'/explore/space-exploration/write-driving-rules?node=M01',{waitUntil:'domcontentloaded'});await expect(p.locator('[data-guided-course]')).toHaveAttribute('data-guided-course','write-driving-rules')
 for(const section of ['lesson-reading','lesson-videos','lesson-references','lesson-notebook'])await expect(p.locator('#'+section)).toBeAttached()
 await p.locator('[data-journey-return] a').click();await expect(p).toHaveURL(/\/mission\/space\?station=perception#journey-map$/)
 await p.goto(origin+'/explore/space-exploration/assemble-a-rover',{waitUntil:'domcontentloaded'});await expect(p.locator('[data-mission-center]')).toBeVisible()
 await expect(p.locator('[data-mission-record-progress]')).toContainText('0 / 8')
 await p.goto(origin+'/explore/space-exploration/spot-a-world',{waitUntil:'domcontentloaded'});await expect(p.frameLocator('iframe').getByRole('button',{name:'镜头向左'})).toBeAttached()
 await p.goto(origin+'/library?view=lines&line=space-exploration',{waitUntil:'domcontentloaded'});await expect(p).toHaveURL(origin+'/mission/space');await expect(p.locator('dialog')).toHaveCount(0)
 await p.getByRole('button',{name:'火星探索序章 · 29 秒'}).click();await expect(p.getByRole('dialog',{name:'前导任务短片'})).toBeVisible();await playing(p);await close(p)
 report.checks.push({name:'8 stations, same-stage deduplication, micro game, guided media/notebook, 8-node build hub, legacy line redirect and original prologue intact'})
 await c.close()
 for(const width of [390,320]){
  currentStep=`mobile-${width}`;console.log(currentStep)
  const c=await context({viewport:{width,height:844},isMobile:true,hasTouch:true}),p=await c.newPage()
  await p.goto(origin+'/mission/space?station=build',{waitUntil:'domcontentloaded'});await expect(film(p,3)).toBeVisible();await playing(p)
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await p.screenshot({path:path.join(out,`stage-3-${width}.png`)});await close(p)
  await p.locator('[data-journey-level="4"]').click();await expect(film(p,4)).toBeVisible();await close(p)
  await c.close();report.checks.push({name:`${width}px direct stage 3 entry and new-stage popup; no horizontal overflow`})
 }
 expect(report.errors).toEqual([]);report.passed=true
}catch(e){report.failure=String(e);report.step=currentStep;if(lastPage&&!lastPage.isClosed()){report.media=await lastPage.locator('video').evaluateAll(videos=>videos.map(v=>({src:v.currentSrc,paused:v.paused,time:v.currentTime,readyState:v.readyState,networkState:v.networkState,error:v.error?.message,hidden:document.hidden,buffered:Array.from({length:v.buffered.length},(_,i)=>[v.buffered.start(i),v.buffered.end(i)])})));await lastPage.screenshot({path:path.join(out,'failure.png')}).catch(error=>{report.screenshotFailure=String(error)})}throw e}finally{await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');await browser.close()}
