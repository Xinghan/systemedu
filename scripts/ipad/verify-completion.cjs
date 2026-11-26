const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { buildSync } = require('../../packages/learning-runtime/node_modules/esbuild');
const repo = path.resolve(__dirname, '../..'), runtime = path.join(repo, 'packages/learning-runtime');
const out = path.join(repo, 'artifacts/space-expedition-20261126/transition-fix');
fs.mkdirSync(out, {recursive:true});
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'systemedu-completion-'));
const catalog = JSON.parse(fs.readFileSync(path.join(runtime, 'dist/content/catalog.json')));
const course = catalog.courses.find(c => c.id === 'lightkurve-transit-detective');
const lesson = JSON.parse(fs.readFileSync(path.join(runtime,'dist',course.modules[1].path)));
lesson.lesson = '# 阅读\n\n观察一条记录。\n\n## 本节结束\n\n保存笔记后继续。';
fs.writeFileSync(path.join(scratch,'lesson.json'),JSON.stringify(lesson));
buildSync({absWorkingDir:runtime,bundle:true,jsx:'automatic',format:'iife',outfile:path.join(scratch,'fixture.js'),loader:{'.woff2':'file','.woff':'file','.ttf':'file'},stdin:{resolveDir:runtime,loader:'tsx',contents:`
import React from 'react'; import {createRoot} from 'react-dom/client';
import {CourseReader} from './src/mobile/course-reader'; import './src/shell.css'; import './src/tablet-reader.css';
const lesson=await fetch('/lesson.json').then(r=>r.json());
window.__systemeduMissionNavigation={continueLabel:'完成本节，进入下一步'};
document.documentElement.dataset.presentation='tablet';
window.qa={attempts:0,advances:0,saved:[],changes:[],fail:false};
function Harness(){const [mode,setMode]=React.useState(0);window.resetCase=(m)=>setMode(m);
 return <div className="classroom-shell tablet-classroom"><CourseReader key={mode} tablet lesson={lesson} initial={{note:'保留原笔记',content_revision:lesson.content_revision,self_completed:mode===2}}
 onChange={React.useCallback(state=>{window.qa.changes.push(state)},[])}
 onCommit={async state=>{window.qa.attempts++;await new Promise(resolve=>window.qa.release=resolve);if(window.qa.fail)throw new Error('模拟保存失败');window.qa.saved.push(state)}}
 onAdvance={mode===3?undefined:async()=>{if(!window.qa.saved.at(-1)?.self_completed)throw new Error('Advanced before persisted completion');window.qa.advances++}}/></div>}
createRoot(document.getElementById('root')).render(<Harness/>);
`.replace("const lesson=await fetch('/lesson.json').then(r=>r.json());",`const lesson=${JSON.stringify(lesson)};`)}});
fs.writeFileSync(path.join(scratch,'index.html'),'<meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>');
const server = http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname, file=path.resolve(scratch,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(scratch+'/')||!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1180,height:820},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  async function ending(){await page.getByRole('button',{name:'打开课文目录'}).click();await page.getByRole('button',{name:'阅读部分 2：本节结束',exact:true}).click()}
  await ending();const finish=page.locator('[data-testid="finish-lesson"]');
  assert.equal(await finish.count(),1,JSON.stringify({errors,body:await page.locator('body').innerText()}));
  await page.evaluate(()=>window.qa.fail=true);await finish.click();
  assert.equal(await finish.isDisabled(),true);assert.equal(await page.evaluate(()=>window.qa.advances),0);
  await page.evaluate(()=>window.qa.release());await page.getByRole('alert').filter({hasText:'模拟保存失败'}).waitFor();
  assert.equal(await page.evaluate(()=>window.qa.advances),0);assert.equal(await finish.isEnabled(),true);
  await page.evaluate(()=>window.qa.fail=false);await finish.click();
  // Even programmatic duplicate clicks during the in-flight write cannot enqueue a second completion.
  await finish.evaluate(e=>{e.click();e.click()});assert.equal(await page.evaluate(()=>window.qa.attempts),2);
  await page.evaluate(()=>window.qa.release());await page.waitForFunction(()=>window.qa.advances===1);
  const saved=await page.evaluate(()=>window.qa.saved.at(-1));assert.equal(saved.self_completed,true);assert.equal(saved.note,'保留原笔记');
  // Reopening an already-completed lesson is continuation, never an undo toggle.
  await page.evaluate(()=>window.resetCase(2));await ending();await finish.click();await page.evaluate(()=>window.qa.release());await page.waitForFunction(()=>window.qa.advances===2);
  assert.equal(await page.evaluate(()=>window.qa.saved.at(-1).self_completed),true);
  // Ordinary non-mission reading stays in place, with an idempotent completion label.
  await page.evaluate(()=>window.resetCase(3));await ending();await finish.click();await page.evaluate(()=>window.qa.release());
  await page.getByRole('button',{name:'本节已读完',exact:true}).waitFor();assert.equal(await finish.isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.qa.advances),2);assert.deepEqual(errors,[]);
  await page.locator('.reading-card').evaluate(async element=>{await Promise.all(element.getAnimations().map(animation=>animation.finished))});
  await page.screenshot({path:path.join(out,'completion-persisted.png')});
  fs.writeFileSync(path.join(out,'browser-completion.json'),JSON.stringify({status:'pass',checks:['save failure stays on current lesson with retry','advance only after save acknowledgement','duplicate taps produce one commit','completed lesson never toggles unfinished','standalone reading completes without mission navigation','note retained'],errors},null,2)+'\n');
  console.log('PASS completion save/advance ordering, retry, duplicate taps and standalone reader');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(scratch,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
