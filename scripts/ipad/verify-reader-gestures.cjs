const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'../..'),root=path.join(repo,'packages/learning-runtime/dist'),out=process.env.SYSTEMEDU_IPAD_ARTIFACTS||path.join(repo,'artifacts/space-expedition-20261126/ipad-reader');
fs.mkdirSync(out,{recursive:true});
const catalog=JSON.parse(fs.readFileSync(path.join(root,'content/catalog.json'))),course=catalog.courses.find(c=>c.id==='lightkurve-transit-detective'),activity=course.modules[0].id;
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();const errors=[],checks=[];
try{
for(const [width,height] of [[1180,700],[820,1020],[600,800]]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html?activity=${activity}&presentation=tablet`);
 const card=page.locator('.reading-card');await card.waitFor();const cdp=await page.context().newCDPSession(page);
 async function swipe(x,y,dx,dy){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/10,y:y+dy*i/10}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 const current=()=>card.getAttribute('data-section');
 await swipe(width*.7,110,-width*.42,4);await page.waitForFunction(()=>document.querySelector('.reading-card').dataset.section==='1');
 assert.equal(await card.locator('h1').innerText(),'为什么并非每颗行星都能产生可见的凌星');
 assert.equal(await card.evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');
 assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(9, 17, 27)');
 assert.equal(await page.getByRole('button',{name:'下一页',exact:true}).innerText(),'');
 await card.evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished))});
 await page.screenshot({path:path.join(out,`reader-${width}.png`)});
 // Vertical reading and tiny/diagonal movements must never change sections.
 await swipe(width*.6,height*.68,5,-170);assert.equal(await current(),'1');
 await swipe(width*.6,180,25,2);assert.equal(await current(),'1');
 await swipe(width*.6,height*.6,-120,-160);assert.equal(await current(),'1');
 await card.evaluate(e=>e.scrollTop=0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width*.65,y:130}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width*.45,y:130}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await current(),'1');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width*.65,y:130,id:1},{x:width*.65,y:180,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width*.35,y:130,id:1},{x:width*.35,y:180,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await current(),'1');
 // Keyboard access uses the same stable bookmark, independent of touch gestures.
 await card.focus();await page.keyboard.press('ArrowRight');assert.equal(await current(),'2');
 await page.keyboard.press('ArrowLeft');assert.equal(await current(),'1');
 await page.locator('.classroom-shell[data-save-state="saved"]').waitFor();await page.reload();await card.waitFor();assert.equal(await current(),'1');
 await page.getByRole('button',{name:'练习与笔记',exact:true}).click();const note=page.locator('#course-note');await note.fill('Swipe keeps my notes and source bookmark.');
 const nb=await note.boundingBox();await swipe(nb.x+nb.width*.7,nb.y+50,-nb.width*.5,0);assert.equal(await current(),'1');
 assert.equal(await note.inputValue(),'Swipe keeps my notes and source bookmark.');
 if(width>=730){const a=await card.boundingBox(),b=await page.locator('.tablet-inspector').boundingBox();assert.ok(a.x+a.width<=b.x,'Notes must sit beside the readable text');}
 await page.screenshot({path:path.join(out,`notes-${width}.png`)});
 await page.getByRole('button',{name:'关闭面板',exact:true}).click();
 // Text selection and an in-prose activity button own their horizontal gestures.
 await card.evaluate(e=>{const r=document.createRange();r.selectNodeContents(e.querySelector('h1'));getSelection().removeAllRanges();getSelection().addRange(r)});await swipe(width*.7,110,-width*.42,0);assert.equal(await current(),'1');await page.evaluate(()=>getSelection().removeAllRanges());
 const entry=card.locator('.content-entry').first();await entry.scrollIntoViewIfNeeded();const eb=await entry.boundingBox();await swipe(eb.x+eb.width*.7,eb.y+20,-eb.width*.4,0);assert.equal(await current(),'1');
 await card.evaluate(e=>e.scrollTop=0);await swipe(width*.3,110,width*.42,0);await page.waitForFunction(()=>document.querySelector('.reading-card').dataset.section==='0');
 await swipe(width*.3,110,width*.42,0);assert.equal(await current(),'0');
 await page.getByRole('button',{name:'打开课文目录'}).click();const buttons=page.locator('.contents-list button');const count=await buttons.count();await buttons.last().click();assert.equal(await current(),String(count-1));assert.equal(await page.getByRole('button',{name:'下一页',exact:true}).isEnabled(),false);
 await swipe(width*.7,110,-width*.42,0);assert.equal(await current(),String(count-1));
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await card.evaluate(e=>getComputedStyle(e).animationName),'none');
 // Locate an original table and ensure horizontal scrolling cannot flip reading pages.
 const tableNode=course.modules.find(n=>/\|.+\|\s*\n\|?\s*:?-/.test(JSON.parse(fs.readFileSync(path.join(root,n.path))).lesson));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html?activity=${tableNode.id}&presentation=tablet`);await card.waitFor();
 await page.getByRole('button',{name:'打开课文目录'}).click();const n=await buttons.count();for(let i=0;i<n;i++){if(i)await page.getByRole('button',{name:'打开课文目录'}).click();await buttons.nth(i).click();if(await card.locator('.tablet-table').count())break}
 const table=card.locator('.tablet-table').first();await table.scrollIntoViewIfNeeded();const before=await current(),tb=await table.boundingBox();await swipe(tb.x+tb.width*.7,Math.min(tb.y+40,height-130),-tb.width*.4,0);assert.equal(await current(),before);
 // Formal downloads and lecture remain reachable from the same tools.
 await page.getByRole('button',{name:'动画与互动',exact:true}).click();assert.ok(await page.getByRole('heading',{name:'资料与下载'}).count());await page.getByRole('button',{name:'关闭面板',exact:true}).click();
 checks.push(`${width}x${height}: left/right swipes, vertical intent, short/diagonal/cancel/multitouch guard, reduced motion, boundaries, keyboard, stable bookmark reload, notes/selection/entry/table gesture ownership, tools and downloads`);
 await page.close();
}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'gesture-verification.json'),JSON.stringify({status:'pass',checks,errors},null,2)+'\n');console.log('PASS iPad reader gesture, restoration and tools checks');
}finally{await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
