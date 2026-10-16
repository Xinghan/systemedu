import {createRequire} from 'node:module';const {chromium,expect}=createRequire(import.meta.url)('@playwright/test');
import fs from 'node:fs/promises';
import path from 'node:path';
import {mockAccount} from './mock-account.mjs';
const browser=await chromium.launch({headless:true}),dir=new URL('./',import.meta.url).pathname;
const report={passed:false,checks:[],errors:[]};
try{
 const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await mockAccount(c,'bio-classroom');
 await c.addInitScript(()=>{for(const s of ['protocol','data','filter','prediction','systems','evaluation','delivery'])for(const owner of ['guest','user:bio-classroom'])for(const v of ['v2','v3'])localStorage.setItem(`systemedu:biomed-stage-film:${v}:${owner}:${s}`,'seen')});
 const slug='teachopencadd-candidate-research',root=path.resolve('/Users/xinghan/Dev/systemeduidea/projects_data/'+slug),tree=JSON.parse(await fs.readFile(root+'/tree/knowledge_tree.json')),manifest=JSON.parse(await fs.readFile(root+'/manifest.json'));
 let enrolled=true;
 await c.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  if(!p.includes(slug))return route.fallback();
  const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(body)});
  if(req.method()==='OPTIONS')return send({});
  if(p.endsWith('/complete-status'))return send({completed_knode_ids:['M05']});
  if(p.endsWith('/tree'))return send(tree);
  if(p.endsWith('/blueprint'))return send({content:'已有课程的真实研究任务',lang_returned:'zh-CN'});
  if(p.includes('/api/my/projects/')&&req.method()==='POST'){enrolled=true;return send({slug})}
  if(p.endsWith('/'+slug))return send({...manifest,status:'published',availability:'available',price:0});
  if(p.includes('/files/')){const relative=decodeURIComponent(p.split('/files/')[1]),file=path.resolve(root,relative);if(!file.startsWith(root+'/'))return send({},404);try{return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream'})}catch{return send({},404)}}
  if(p.includes('/knodes/')){
   if(!enrolled)return send({message:'pull_required'},403);
   const id=p.split('/knodes/')[1],m=tree.modules.find(m=>m.module_id===id),k=manifest.knodes.find(k=>k.module_id===id);if(!k)return send({},404);const folder=root+'/'+k.knode_dir;
   const read=async name=>JSON.parse(await fs.readFile(folder+'/'+name,'utf8'));
   return send({project_slug:slug,knode_id:id,title:m.title,summary:m.summary,knode_dir:k.knode_dir,version:manifest.version,plan_markdown:await fs.readFile(folder+'/lesson.md','utf8'),assignment_md:await fs.readFile(folder+'/assignment.md','utf8'),rendered_sections:await read('sections.json'),theories:await read('theories.json'),slides:(await read('slides.json')).slides});
  }
  return route.fallback();
 });
 const molecule='molecule-monster-hunter',mroot='/Users/xinghan/Dev/systemeduidea/projects_data/'+molecule,mt=JSON.parse(await fs.readFile(dir+'molecule-monster-hunter-published-tree.json')),mm=JSON.parse(await fs.readFile(mroot+'/manifest.json'));
 await c.route('**/api/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;if(!p.includes(molecule))return route.fallback();
  const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(body)});
  if(req.method()==='OPTIONS')return send({});if(p.endsWith('/complete-status'))return send({completed_knode_ids:['M07']});if(p.endsWith('/tree'))return send(mt);if(p.endsWith('/'+molecule))return send({...mm,status:'published',availability:'available',price:0});
  if(p.includes('/files/')){const file=path.resolve(mroot,decodeURIComponent(p.split('/files/')[1]));if(!file.startsWith(mroot+'/'))return send({},404);try{return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html':'application/octet-stream'})}catch{return send({},404)}}
  if(p.includes('/knodes/')){const id=p.split('/knodes/')[1],k=mm.knodes.find(k=>k.module_id===id),m=mt.modules.find(m=>m.module_id===id);if(!k||!m)return send({},404);const folder=mroot+'/'+k.knode_dir,read=async n=>JSON.parse(await fs.readFile(folder+'/'+n)),slides=await read('slides.json');return send({project_slug:molecule,knode_id:id,title:m.title,summary:m.summary,knode_dir:k.knode_dir,version:mm.version,plan_markdown:await fs.readFile(folder+'/lesson.md','utf8'),assignment_md:await fs.readFile(folder+'/assignment.md','utf8'),rendered_sections:await read('sections.json'),theories:await read('theories.json'),slides:Array.isArray(slides)?slides:slides.slides})}return route.fallback();
 });
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto('http://127.0.0.1:4020/learn/'+slug+'/M05?mission=biomedicine');
 await expect(p.locator('[data-mission-classroom="biomedicine"]')).toBeVisible();await expect(p.locator('[data-biomed-context="protocol"]')).toBeVisible();await expect(p.locator('[data-biomed-footer] a').last()).toHaveAttribute('href','/learn/molecule-monster-hunter/v2/M07?mission=biomedicine');await expect(p.getByText('封存靶点与研究协议阶段成品',{exact:true}).first()).toBeVisible();await expect(p.locator('[data-node-assignment]')).toBeVisible();await expect(p.locator('[data-lesson-carousel]')).toBeVisible();await expect(p.getByRole('navigation',{name:'课程内容视图'})).toHaveCount(0);await p.screenshot({path:dir+'full-classroom.png',fullPage:false});
 await p.locator('[data-biomed-footer] a').last().click();await expect(p).toHaveURL(/molecule-monster-hunter\/v2\/M07/);await expect(p.locator('[data-biomed-context="data"]')).toBeVisible();await expect(p.locator('[data-node-assignment]')).toBeVisible();await expect(p.locator('[data-biomed-task-context]')).toHaveAttribute('data-biomed-task-context','collect-and-read');
 await p.goto('http://127.0.0.1:4020/learn/'+slug+'/M17?mission=biomedicine');await expect(p.locator('[data-biomed-task-context]')).toHaveAttribute('data-biomed-task-context','compare-filters');await expect(p.locator('[data-biomed-footer] a').first()).toHaveAttribute('href','/explore/biomedicine/build-a-candidate-filter?node=M04&mission=biomedicine');await expect(p.locator('[data-biomed-footer] a').last()).toHaveAttribute('href','/learn/'+slug+'/M18?mission=biomedicine');
 enrolled=false;await p.goto('http://127.0.0.1:4020/learn/'+slug+'/M24?mission=biomedicine');await expect(p).toHaveURL(/\/library\/teachopencadd-candidate-research\?mission=biomedicine&node=M24/);
 report.checks.push('Unified classroom renders original real M05 lesson/slides/assignment; M05 opens original molecule M07 v2 classroom with original assignment, M17 follows guided filter M04; no preview media tabs; unjoined M24 preserves mission and node through enrollment redirect');
 expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'full-course-verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
