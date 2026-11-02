const {chromium,expect}=require('@playwright/test');
const fs=require('fs'),crypto=require('crypto'),assert=require('node:assert/strict');
const path=require('node:path'),repo=path.resolve(__dirname,'../..'),source=process.env.LIGHTKURVE_SOURCE,out=process.env.LIGHTKURVE_REPORT_DIR,origin=process.env.LIGHTKURVE_ORIGIN || 'http://127.0.0.1:4002';
assert(source && out,'Set LIGHTKURVE_SOURCE and LIGHTKURVE_REPORT_DIR');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(source+'/manifest.json')),previous=JSON.parse(fs.readFileSync(source+'/audit/language-revision-20261101/previous-assessments.json')),compat=JSON.parse(fs.readFileSync(repo+'/packages/student-web/src/lib/lightkurve-language-revision.json'));
const key=(m,kind,activity)=>`systemedu:learning:v1:guest:${encodeURIComponent(JSON.stringify({library_slug:'lightkurve-transit-detective',module_id:m,activity_id:activity,kind,content_version:compat.records[m].previous}))}`;
(async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 const old=previous.M23.record,seeds={};
 seeds[key('M23','quiz','lightkurve-quiz')]={version:1,revision:0,dirty:true,body:{answers:old.quiz.map(q=>({question_id:q.id,question:q.question,answer:`${q.correct+1}. ${q.options[q.correct]}`}))}};
 seeds[key('M23','classroom','lightkurve-notebook')]={version:1,revision:0,dirty:true,body:{answers:old.questions.map((q,i)=>({question_id:'q'+(i+1),question:q,answer:'语言修订前保存的完整回答 '+(i+1)}))}};
 await context.addInitScript(s=>{if(window!==window.top)return;for(const[k,v]of Object.entries(s))if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify(v))},seeds);
 for(const [i,e]of manifest.knodes.entries()){
  await page.goto(`${origin}/preview/lightkurve/${e.module_id}`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('[data-lightkurve-classroom]')).toHaveAttribute('data-lightkurve-classroom',e.module_id);
  await expect(page.getByLabel('切换课程节点').locator('option')).toHaveCount(32);
  await expect(page.locator('[data-lightkurve-notebook]')).toBeVisible();await expect(page.locator('[data-lightkurve-delivery]')).toBeVisible();await expect(page.locator('[data-lesson-carousel]')).toBeVisible();
  const sections=JSON.parse(fs.readFileSync(`${source}/${e.knode_dir}/sections.json`));for(const idea of sections.ideas.filter(x=>['game','animation'].includes(x.mode)))await expect(page.locator(`[id="idea-${idea.idea_id}"]`)).toHaveCount(1);
  if((i+1)%8===0)console.log(`Classroom ${i+1}/32`);
 }
 await page.goto(origin+'/preview/lightkurve/M23',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-lightkurve-assessment="quiz"] input:checked')).toHaveCount(3);
 await expect(page.locator('[data-lightkurve-notebook] textarea').first()).toHaveValue('语言修订前保存的完整回答 1');
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('[data-lightkurve-assessment="quiz"] input:checked')).toHaveCount(3);
 await page.goto(origin+'/preview/lightkurve/M02',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-lightkurve-notebook] input:not([type=checkbox])').first()).toBeEnabled();
 await page.locator('[data-lesson-carousel]').getByRole('button',{name:/下一张/}).click();await expect(page.locator('[data-lesson-carousel]')).toContainText('2 / 10');
 await page.getByRole('button',{name:'幻灯片',exact:true}).click();await expect(page.getByRole('dialog').locator('[data-slide-surface] h2')).toBeVisible();await page.keyboard.press('Escape');
 await page.screenshot({path:out+'/classroom-M02-desktop.png'});
 const kit=await page.request.get(origin+'/preview/lightkurve/media?path=downloads%2Flightkurve-practice-kit.zip');assert.equal(kit.status(),200);const bytes=await kit.body();assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.files.find(x=>x.path==='downloads/lightkurve-practice-kit.zip').sha256);
 // Test the actual parent/iframe protocol with a fresh guest state and no Q4 prefetch.
 const modal=page.getByRole('dialog').filter({has:page.locator('[data-lightkurve-experiment]')});
 await page.goto(origin+'/preview/lightkurve/M24?view=lab&mode=game',{waitUntil:'domcontentloaded'});await expect(modal).toBeVisible();let frame=await(await modal.locator('iframe').elementHandle()).contentFrame();
 await frame.locator('#a').evaluate(el=>{el.value='1.1';el.dispatchEvent(new Event('input',{bubbles:true}))});assert(!requests.some(x=>x.includes('holdout.json')));await frame.locator('#freeze').click();
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('systemedu:lightkurve-validation:v1:guest')));
 await expect.poll(async()=>(await state())?.freeze?.period).toBe(1.1);
 await page.goto(origin+'/preview/lightkurve/M25?view=lab&mode=game',{waitUntil:'domcontentloaded'});await expect(modal).toBeVisible();frame=await(await modal.locator('iframe').elementHandle()).contentFrame();await expect(frame.locator('#a')).toHaveValue('1.1');await expect(frame.locator('#a')).toBeDisabled();await frame.locator('#reveal').click();await expect.poll(async()=>!!(await state())?.firstResult).toBe(true);
 const first=JSON.stringify((await state()).firstResult);await modal.getByRole('button',{name:'关联到本节作业'}).click();await page.reload({waitUntil:'domcontentloaded'});await expect(modal).toBeVisible();frame=await(await modal.locator('iframe').elementHandle()).contentFrame();await expect(frame.locator('#reveal')).toBeDisabled();assert.equal(JSON.stringify((await state()).firstResult),first);
 await page.screenshot({path:out+'/classroom-M25-first-result.png'});
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/preview/lightkurve/M02',{waitUntil:'domcontentloaded'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/classroom-M02-mobile.png'});
 assert.deepEqual(errors,[]);const report={passed:true,nodes:32,checks:['Shared classroom, notebook, assignment and inline rich-media links at all 32 nodes','Old M23 answers and old quiz option wording restore and survive reload','Inline and modal slide playback','Practice download matches manifest SHA256','M24 saves methods before Q4 request; M25 restores configuration; first result and linked artifact survive reload','390px page has no horizontal overflow'],pageErrors:errors};fs.writeFileSync(out+'/browser-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
