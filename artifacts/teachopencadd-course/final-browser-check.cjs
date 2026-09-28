const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {chromium}=require('/Users/xinghan/Dev/systemedu/node_modules/playwright-core');
const mediaOnly=process.argv.includes('--media-only');
const course='/Users/xinghan/Dev/systemeduidea/projects_data/teachopencadd-candidate-research';
const base='http://127.0.0.1:4000/preview/teachopencadd';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 const manifest=JSON.parse(fs.readFileSync(path.join(course,'manifest.json')));
 assert.equal(manifest.knodes.length,46);
 for(const node of mediaOnly?[]:manifest.knodes){
  const response=await page.goto(`${base}/${node.module_id}?view=reading`,{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200,node.module_id);
  await page.locator(`[data-teachopencadd-preview="${node.module_id}"]`).waitFor();
  assert(!(await page.locator('body').innerText()).includes('Application error'));
  checks.push({module:node.module_id,reading:'visible'});
 }
 for(const mid of ['M03','M08','M11','M14','M17','M19','M20','M23','M26','M27','M29','M32','M33']){
  await page.goto(`${base}/${mid}?view=lab&mode=game`,{waitUntil:'networkidle'});
  const frame=page.frameLocator('[data-preview-lab] iframe');
  if(mid==='M33'){
   await frame.getByRole('button',{name:'登记并锁定计划',exact:true}).click();
   const reveal=frame.getByRole('button',{name:'揭示下一条结果',exact:true});
   for(let i=0;i<6;i++)await reveal.click();
  }
  await frame.getByRole('button',{name:/^(保存本次证据|保存这次实验)$/}).click();
  await page.getByRole('button',{name:'关联到本节作业',exact:true}).click();
  await page.getByText('已关联实验操作产物',{exact:true}).waitFor();
  checks.push({module:mid,artifact:'accepted and attached through actual opaque iframe'});
  if(mid==='M33'){
   const section=page.locator('[data-teachopencadd-delivery]');
   for(const [label,value] of [['作品文件或共享链接','QA-local/M33/registered-plan.json'],['我用了什么输入，亲手做了哪一步','先登记抽样计划，再逐条揭示6条结果'],['哪项证据支持我的结果','保存抽样编号、种子与两层实际分母'],['还不能确定什么','教学样本不能替代真实保留评价']])await section.getByLabel(label,{exact:true}).fill(value);
   await section.getByRole('button',{name:'保存本节作业到本机',exact:true}).click();
   await page.waitForTimeout(600);await page.reload({waitUntil:'networkidle'});
   assert.equal(await page.locator('[data-teachopencadd-delivery]').getByLabel('作品文件或共享链接',{exact:true}).inputValue(),'QA-local/M33/registered-plan.json');
   assert(await page.getByText('已关联实验操作产物',{exact:true}).isVisible());
   checks.push({module:mid,guest_record:'completed experiment and assignment restored after reload'});
  }
 }
 for(const [mid,label]of [['M01','查看图解'],['M15','观看动画']]){
  await page.goto(`${base}/${mid}?view=lab&mode=animation`,{waitUntil:'networkidle'});
  assert(await page.getByRole('button',{name:label,exact:true}).isVisible());
  assert.equal(await page.getByRole('button',{name:'关联到本节作业',exact:true}).count(),0);
 }
 checks.push({read_only_media:'M01 diagram and M15 animation show accurate labels and no artifact-save demand'});
 const assets=manifest.files.filter(f=>/\.(png|zip)$/.test(f.path)&&/^(knodes\/|downloads\/|images\/)/.test(f.path));
 for(const file of assets){
  const r=await page.request.get(`${base}/media?path=${encodeURIComponent(file.path)}`);
  assert.equal(r.status(),200,file.path);assert.equal(sha(await r.body()),sha(fs.readFileSync(path.join(course,file.path))),file.path);
 }
 checks.push({asset_count:assets.length,media:'all rendered lesson images, cover and practice archive match current source bytes'});
 for(const [mid,view]of [['M01','reading'],['M33','lab'],['M46','assignment']]){
  await page.setViewportSize({width:390,height:844});await page.goto(`${base}/${mid}?view=${view}&mode=game`,{waitUntil:'networkidle'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${mid} phone overflow`);
 }
 checks.push({mobile:'M01 reading, M33 lab, M46 assignment have no document overflow at390px'});
 const shotDir='/private/tmp/cadd-authoring/final-preview';fs.mkdirSync(shotDir,{recursive:true});
 for(const [mid,view]of [['M03','lab'],['M33','lab'],['M46','assignment']]){
  await page.setViewportSize({width:1440,height:1100});await page.goto(`${base}/${mid}?view=${view}&mode=game`,{waitUntil:'networkidle'});
  if(view==='lab')await page.locator('[data-preview-lab]').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(shotDir,`${mid}-${view}.png`)});
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync('/private/tmp/cadd-authoring/'+(mediaOnly?'final-browser-media-delta.json':'final-browser-check.json'),JSON.stringify({status:'pass',checks,errors,scope:'local preview; isolated guest browser; signed-account database not impersonated; source bytes and real iframe attachment validated'},null,2));
 await browser.close();console.log((mediaOnly?'Final media delta':'46 reading pages')+', 13 iframe artifact paths, current image/archive bytes and mobile layout passed');
})().catch(e=>{console.error(e);process.exit(1)});
