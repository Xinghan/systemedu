const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'../..'),root=path.join(repo,'packages/learning-runtime/dist'),out=process.env.SYSTEMEDU_IPAD_ARTIFACTS||path.join(repo,'artifacts/space-expedition-20261126/orientation');
fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('content/catalog.json'),story=read('content/missions/space-expedition.json');
const node=(id)=>catalog.courses.find(c=>c.id===id).modules[0];
// A generated test swatch, never a student's photograph or saved identity.
const jpeg=execFileSync(path.join(repo,'.venv/bin/python'),['-c',"import io,sys;from PIL import Image,ImageDraw;i=Image.new('RGB',(160,160),'#143247');d=ImageDraw.Draw(i);d.ellipse((45,20,115,90),fill='#ffd288');d.rectangle((30,100,130,160),fill='#5bb9b0');o=io.BytesIO();i.save(o,'JPEG');sys.stdout.buffer.write(o.getvalue())"]);
const avatar='data:image/jpeg;base64,'+jpeg.toString('base64');
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});const errors=[],checks=[];
 try {
  assert.equal(story.overview.acts.flatMap(a=>a.chapters).length,14);
  assert.equal(new Set(story.overview.acts.flatMap(a=>a.chapters)).size,14);
  const refs=story.chapters.flatMap(c=>c.refs);assert.equal(refs.length,120);assert.equal(new Set(refs).size,120);
  for(const chapter of story.chapters)assert.equal(chapter.actions.length,3);
  checks.push('14 chapters / 120 retained nodes / complete act map and action instructions');
  for(const [width,height] of [[1180,680],[820,1050],[700,660]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(crew=>{window.__systemeduCrew=crew;},{name:'Nova',role:'工程师',duty:'动手验证，让方案工作',avatar});
   const activity=node('spot-a-world').id,url=`http://127.0.0.1:${server.address().port}/index.html?activity=${activity}&presentation=tablet`;
   await page.goto(url);await page.getByText('Nova，这是你的任务',{exact:true}).waitFor();
   assert.equal(await page.locator('.mission-action-steps li').count(),3);
   assert.equal(await page.locator('.mission-crew-portrait').getAttribute('src'),avatar);
   await page.locator('.reading-card').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished))});
   await page.screenshot({path:path.join(out,`classroom-${width}.png`)});
   const entry=page.getByRole('button',{name:'进入实验：我的第一张星球照片',exact:true});await entry.tap();
   await page.locator('.activity-loading').waitFor({state:'hidden'});
   const frame=page.frameLocator('iframe');await frame.getByText('Nova的观测席',{exact:true}).waitFor();
   const surface=await page.locator('iframe').boundingBox();assert.ok(surface.height>=height*.8,'The activity must own at least 80% of the available classroom');
   const layout=await frame.locator('body').evaluate(()=>({height:innerHeight,scroll:document.documentElement.scrollHeight,buttons:[...document.querySelectorAll('[data-direction],#zoom-in,#zoom-out,#shutter')].map(el=>{const r=el.getBoundingClientRect();return {name:el.getAttribute('aria-label')||el.id,x:r.x,y:r.y,width:r.width,height:r.height}})}));
   assert.ok(layout.scroll<=layout.height+1,'Observatory must fit vertically');
   for(const rect of layout.buttons){assert.ok(rect.y>=0&&rect.y+rect.height<=layout.height+1,rect.name+' must be visible without scrolling');assert.ok(rect.width>=44&&rect.height>=44,rect.name+' must be touch sized');}
   await page.screenshot({path:path.join(out,`observatory-${width}.png`)});
   assert.equal(await frame.locator('[data-crew-portrait]').getAttribute('src'),avatar);
   assert.ok(!(await page.locator('iframe').getAttribute('src')).includes('base64'));
   for(let i=0;i<5;i++)await frame.getByRole('button',{name:'镜头向左',exact:true}).click();
   for(let i=0;i<2;i++)await frame.getByRole('button',{name:'镜头向上',exact:true}).click();
   await frame.getByRole('button',{name:'放大',exact:true}).click();
   await frame.locator('#shutter').click();
   await frame.getByText('Nova · 亲手取景',{exact:true}).waitFor();
   await page.locator('.interactive-viewport[data-artifact-saved="true"]').waitFor();
   await page.screenshot({path:path.join(out,`signed-observation-${width}.png`)});
   await frame.getByRole('button',{name:'关闭照片',exact:true}).click();
   await page.getByRole('button',{name:'关闭面板',exact:true}).click();
   await page.getByRole('button',{name:'练习与笔记',exact:true}).click();await page.locator('#course-note').fill('Nova observed the moon; keep this note.');
   await page.locator('.classroom-shell[data-save-state="saved"]').waitFor();
   const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),`systemedu:runtime-preview:v1:${activity}`);
   assert.ok(!JSON.stringify(saved).includes('Nova的'));assert.ok(!JSON.stringify(saved).includes(avatar));
   assert.equal(JSON.parse(saved.shared_workspace['systemedu:spot-a-world:v1']).length,1);
   await page.reload();await page.getByRole('button',{name:'练习与笔记',exact:true}).click();assert.match(await page.locator('#course-note').inputValue(),/keep this note/);
   await page.getByRole('button',{name:'关闭面板',exact:true}).click();await entry.tap();await page.locator('.activity-loading').waitFor({state:'hidden'});
   assert.equal(await frame.locator('#album-count').innerText(),'1');
   await page.getByRole('button',{name:'关闭面板',exact:true}).click();
   checks.push(`${width}x${height}: controls visible without scrolling, 44px touch targets, personalized observer seat and photo, committed artifact, no identity in learning state, reload restoration`);
   await page.close();
  }
  const failure=await browser.newPage({viewport:{width:1180,height:680}});
  await failure.route('**/project-lines/space-exploration/spot-a-world/index.html*',route=>route.abort());
  await failure.goto(`http://127.0.0.1:${server.address().port}/index.html?activity=${node('spot-a-world').id}&presentation=tablet`);
  await failure.getByRole('button',{name:'进入实验：我的第一张星球照片',exact:true}).click();
  await failure.getByRole('button',{name:'重新打开活动',exact:true}).waitFor({timeout:16000});
  await failure.unrouteAll();await failure.getByRole('button',{name:'重新打开活动',exact:true}).click();
  await failure.locator('.activity-loading').waitFor({state:'hidden'});await failure.frameLocator('iframe').getByRole('button',{name:'镜头向左',exact:true}).waitFor();
  checks.push('Failed iframe visibly reports error and retries successfully');
  await failure.close();assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({status:'pass',checks,errors,identity:'synthetic test swatch only'},null,2)+'\n');
  console.log('PASS expedition touch entry, map metadata, portrait integration, saved works, restore and retry.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
