const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),root=path.join(repo,'packages/learning-runtime/dist'),out=process.env.SYSTEMEDU_IPAD_ARTIFACTS || path.join(repo,'artifacts/ipad-mars');
fs.mkdirSync(out,{recursive:true});
const {chromium}=require(path.join(repo,'node_modules/playwright'));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('content/catalog.json'),mission=read('content/missions/space.json');
const nodes=catalog.courses.flatMap(c=>c.modules),node=(slug,mid)=>catalog.courses.find(c=>c.id===slug).modules.find(m=>m.moduleId===mid);
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+rel);if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.mp4':'video/mp4','.m4a':'audio/mp4'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});const errors=[];
 try{
 for(const [width,height] of [[1194,750],[834,1080],[600,800]]){
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));
  const go=async n=>{await page.goto(`http://127.0.0.1:${server.address().port}/index.html?activity=${n.id}&presentation=tablet`);await page.locator('.tablet-reader .reading-card').waitFor();};
  await go(node('pick-an-observation-site','M01'));
  assert.ok(await page.locator('.reading-card').innerText());
  const accent=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  assert.equal(accent.toUpperCase(),catalog.courses.find(c=>c.id==='pick-an-observation-site').accentHex);
  assert.equal(await page.locator('body').evaluate(b=>getComputedStyle(b).backgroundColor),'rgb(9, 17, 27)');
  await page.getByRole('button',{name:'练习与笔记',exact:true}).click();
  await page.locator('#course-note').fill('iPad trial: compare source and scale before selecting a site.');
  assert.equal(await page.locator('dialog[open]').count(),0,'Notes must not make reading inert');
  const reader=await page.locator('.reading-card').boundingBox(),inspector=await page.locator('.tablet-inspector').boundingBox();
  if(width>=730)assert.ok(reader.x+reader.width<=inspector.x+1,'Reading and notes must sit beside one another');
  await page.getByRole('status').filter({hasText:'已保存到本机'}).waitFor();
  await page.screenshot({path:path.join(out,`reading-notes-${width}.png`)});
  await page.reload();await page.getByRole('button',{name:'练习与笔记',exact:true}).click();
  assert.match(await page.locator('#course-note').inputValue(),/compare source/);
  await page.getByRole('button',{name:'关闭面板',exact:true}).click();
  await page.getByRole('button',{name:'动画与互动',exact:true}).click();
  await page.getByRole('button',{name:'进入实验：本节实验工作台',exact:true}).click();
  const frame=page.frameLocator('.mobile-activity iframe');await frame.locator('body').waitFor();
  await frame.locator('#root').locator(':scope > *').first().waitFor({timeout:15000});
  assert.equal(await frame.locator('body').evaluate(b=>getComputedStyle(b).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await frame.locator('html').evaluate(e=>e.style.getPropertyValue('--project-accent')),accent);
  assert.ok((await frame.locator('body').innerText()).length>100,'Embedded experiment must render content: '+(await frame.locator('body').innerText()));
  const bounds=await page.locator('.mobile-activity iframe').boundingBox();assert.ok(bounds.width>=width-8&&bounds.height>height*.75);
  if(width>=730) {
    const action=await frame.getByRole('button',{name:'记录这个候选地点',exact:true}).boundingBox();
    assert.ok(action.y+action.height<=height,'Primary experiment action must be visible without scrolling');
    await frame.getByRole('button',{name:'确认当前位置标记',exact:true}).click();
    await frame.getByRole('button',{name:'记录这个候选地点',exact:true}).click();
    await frame.locator('[data-space-result]').waitFor();
  }
  await page.screenshot({path:path.join(out,`workspace-${width}.png`)});
  await page.getByRole('button',{name:'关闭面板',exact:true}).click();
  await go(node('mars-analog-rover','M02'));
  await page.getByRole('button',{name:'讲课',exact:true}).click();await page.locator('.lecture-card').waitFor();assert.ok((await page.locator('.lecture-card').innerText()).length>30);
  const picture=page.locator('.lecture-visual');if(await picture.count()){const b=await picture.boundingBox();assert.ok(b.height<=height*.45,'Lecture visual must fit the presentation');}
  await page.screenshot({path:path.join(out,`lecture-${width}.png`)});
  await page.close();
 }
 const tableNode=nodes.find(n=>mission.nodes.some(m=>m.activityId===n.id)&&/\|.+\|\s*\n\|?\s*:?-/.test(read(n.path).lesson));
 assert.ok(tableNode,'At least one original table must exist');
 const page=await browser.newPage({viewport:{width:1194,height:750}});
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html?activity=${tableNode.id}&presentation=tablet`);
 const contents=page.getByRole('button',{name:'打开课文目录'});
 await contents.click();
 const sections=page.locator('.contents-list button');
 const count=await sections.count();
 for(let i=0;i<count;i++){
   if(i)await contents.click();
   await sections.nth(i).click();
   if(await page.locator('.tablet-table table').count())break;
 }
 assert.ok(await page.locator('.tablet-table th').count());assert.ok(await page.locator('.tablet-table td').count());await page.screenshot({path:path.join(out,'table-landscape.png')});
 await page.close();assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({status:'pass',viewports:[[1194,750],[834,1080],[600,800]],checks:['concurrent notes and reading','reload restoration','full-size original experiment','lecture mode','original table structure'],errors},null,2)+'\n');
 console.log('PASS iPad reading, notes, restoration, experiments, lecture and tables');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
