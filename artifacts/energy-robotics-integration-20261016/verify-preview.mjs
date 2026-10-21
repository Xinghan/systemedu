import { createRequire } from 'node:module';const {chromium,expect}=createRequire(import.meta.url)('@playwright/test');
import fs from 'node:fs/promises';
const dir=new URL('./',import.meta.url).pathname, origin='http://127.0.0.1:4020',report={passed:false,checks:[],errors:[]},browser=await chromium.launch({headless:true});
try{
 const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await c.addInitScript(()=>{for(const s of ['discovery','specification','fabrication','control','demonstration','learning','validation','handover'])localStorage.setItem(`systemedu:robotics-stage-film:v1:guest:${s}`,'seen')});
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(origin+'/preview/aloha/M10?mission=robotics');await expect(p.locator('[data-aloha-preview]')).toHaveAttribute('data-aloha-preview','M10',{timeout:45000});await expect(p.locator('[data-lesson-carousel]')).toBeVisible();await expect(p.locator('[data-preview-assignment]')).toBeVisible();await expect(p.getByRole('navigation',{name:'课程内容视图'})).toHaveCount(0);await expect(p.locator('[data-engineering-footer] a').last()).toHaveAttribute('href','/explore/neuro-bionics/design-a-printed-gripper?node=M03&mission=robotics');
 const imgs=p.locator('[data-lesson-carousel] img');if(await imgs.count())await expect.poll(()=>imgs.first().evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
 const source='/Users/xinghan/Dev/systemeduidea/projects_data/aloha-bimanual-apprentice',manifest=JSON.parse(await fs.readFile(source+'/manifest.json'));for(const ext of ['.mp3','.png']){const file=manifest.files.find(f=>f.path.startsWith('knodes/')&&f.path.endsWith(ext));if(file){const res=await c.request.get(origin+'/preview/aloha/media?path='+encodeURIComponent(file.path));expect(res.status()).toBe(200)}}
 for(const bad of ['../manifest.json','manifest.json','/etc/passwd','knodes/../../../outside.png'])expect((await c.request.get(origin+'/preview/aloha/media?path='+encodeURIComponent(bad))).status()).toBe(404);
 expect((await c.request.get(origin+'/preview/aloha/M10',{headers:{host:'example.com'}})).status()).toBe(404);
 await p.screenshot({path:dir+'aloha-local-preview.png'});
 await p.goto(origin+'/preview/aloha/M58?view=lab&mode=animation');await expect(p.locator('[data-unified-course]')).toBeVisible({timeout:45000});await expect(p.locator('iframe')).not.toHaveCount(0);await expect(p.getByRole('navigation',{name:'课程内容视图'})).toHaveCount(0);
 report.checks.push('Local real-source ALOHA M10 uses unified reader, inline slides, original assignment, mission next step','Local manifest media returns 200; traversal, JSON and non-loopback Host return 404','Legacy M58 animation URL opens inline media without separate student tabs');expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'preview-verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
