import { chromium, expect as baseExpect } from '@playwright/test'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const origin=process.env.RELEASE_ORIGIN||'http://127.0.0.1:14001'
const output=process.env.RELEASE_OUTPUT||'artifacts/rover-release-20260920/smoke-preview'
const {users:[a,b]}=JSON.parse(await fs.readFile('/private/tmp/rover-release-test-accounts.json'))
const expect=baseExpect.configure({timeout:25000}),checks=[]
await fs.mkdir(output,{recursive:true})
async function call(path,{token=a.token,method='GET',body,numbered=true}={}){
 const response=await fetch(origin+'/api/'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...(numbered?{'X-Course-Numbering':'consecutive-v2'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 return {status:response.status,data:await response.json()}
}
function scope(p){return Object.fromEntries(['library_slug','module_id','activity_id','kind','content_version'].map(k=>[k,p[k]]))}
for(const kind of ['classroom','assignment','quiz','exam']){
 const body={library_slug:'assemble-a-rover',module_id:'M08',activity_id:'release-check-'+crypto.randomUUID(),kind,content_version:'release-test-only',expected_revision:0,body:{answers:[{question_id:'release-check',question:'发布验证数据',answer:'软件测试，不是学生作业'}]}}
 const read='learning/records?'+new URLSearchParams(scope(body))
 expect((await call(read,{token:null})).status).toBe(401)
 const saved=await call('learning/drafts',{method:'PUT',body});expect(saved.status).toBe(200);expect(saved.data.draft.revision).toBe(1)
 expect((await call('learning/drafts',{method:'PUT',body})).status).toBe(409)
 const submit={...body,expected_revision:1,request_id:crypto.randomUUID()}
 const posted=await call('learning/submissions',{method:'POST',body:submit});expect(posted.status).toBe(201);expect(posted.data.submission.grading_status).toBe('ungraded')
 const retry=await call('learning/submissions',{method:'POST',body:submit});expect(retry.status).toBe(200);expect(retry.data.submission.id).toBe(posted.data.submission.id)
 const restored=await call(read);expect(restored.data.submissions).toHaveLength(1);expect(restored.data.draft.body).toMatchObject(body.body)
 const isolated=await call(read,{token:b.token});expect(isolated.data.draft).toBeNull();expect(isolated.data.submissions).toHaveLength(0)
 checks.push({name:kind+' 草稿、提交、恢复、冲突、幂等与隔离',passed:true})
}
const molecule={library_slug:'molecule-monster-hunter',module_id:'M04',activity_id:'release-check-'+crypto.randomUUID(),kind:'quiz',content_version:'release-test-only',expected_revision:0,body:{answers:[{question_id:'q',question:'发布验证',answer:'软件测试'}]}}
expect((await call('learning/drafts',{method:'PUT',body:molecule,numbered:false})).status).toBe(409)
expect((await call('learning/drafts',{method:'PUT',body:molecule})).status).toBe(200)
checks.push({name:'已上线连续编号课程保存兼容',passed:true})
const browser=await chromium.launch({args:['--no-proxy-server']})
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
page.on('pageerror',e=>errors.push(String(e)))
try{
 for(const path of ['/library?view=lines','/library?view=projects','/library?view=lines&line=space-exploration','/explore/space-exploration/write-driving-rules?node=M01','/explore/space-exploration/assemble-a-rover?node=M04','/explore/space-exploration/run-an-expedition?node=M05']){
  expect((await page.goto(origin+path,{waitUntil:'domcontentloaded'})).status()).toBe(200)
  await expect(page.locator('main').first()).toBeVisible()
  expect(await page.locator('body').innerText()).not.toContain('Application error')
 }
 for(const project of ['spot-a-world','land-a-probe','drive-and-frame']){
  expect((await page.goto(origin+'/project-lines/space-exploration/'+project+'/index.html')).status()).toBe(200)
  await expect(page.locator('canvas').first()).toBeVisible()
 }
 await page.goto(origin+'/library?view=lines',{waitUntil:'domcontentloaded'});await expect(page.locator('main')).not.toContainText('正在载入开放状态');await page.screenshot({path:output+'/library-lines.png',fullPage:true})
 await page.goto(origin+'/explore/space-exploration/assemble-a-rover?node=M03',{waitUntil:'domcontentloaded'});await expect(page.locator('[data-renderer]')).toHaveAttribute('data-renderer','webgl');await page.screenshot({path:output+'/rover-system-design.png',fullPage:true})
 for(const file of ['reference.scad','reference-stl.zip','dimension-sheet.svg','wiring.svg','controller.py','build-guide.md'])expect((await page.request.get(origin+'/project-lines/space-exploration/assemble-a-rover/hardware/'+file)).status()).toBe(200)
 checks.push({name:'项目库视图、三款小游戏、课程、3D 与制造资料',passed:true})
 expect(errors).toEqual([])
 console.log('PASS '+checks.map(x=>x.name).join('；'))
 await fs.writeFile(output+'/verification.json',JSON.stringify({origin,checks,errors,passed:true},null,2))
}finally{await browser.close()}
