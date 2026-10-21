import {createRequire} from 'node:module';
const {chromium,expect}=createRequire(new URL('../../package.json',import.meta.url))('@playwright/test');
import fs from 'node:fs/promises';
import path from 'node:path';
import {mockAccount} from '../space-mission-center-20261010/mock-account.mjs';
const browser=await chromium.launch({headless:true}),dir=new URL('./',import.meta.url).pathname;
const report={passed:false,checks:[],errors:[]};
try{
 const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await mockAccount(c,'energy-classroom');
 await c.addInitScript(()=>{for(const s of ['measurement','forecast','validation','handover'])localStorage.setItem(`systemedu:energy-stage-film:v1:user:energy-classroom:${s}`,'seen')});
 const slug='pvlib-solar-forecast-station',root=path.resolve('../systemeduidea/projects_data/'+slug),tree=JSON.parse(await fs.readFile(root+'/tree/knowledge_tree.json')),manifest=JSON.parse(await fs.readFile(root+'/manifest.json'));
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
  if(p.includes('/files/')){if(!enrolled)return send({message:'pull_required'},403);const relative=decodeURIComponent(p.split('/files/')[1]),file=path.resolve(root,relative);if(!file.startsWith(root+'/'))return send({},404);try{return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream'})}catch{return send({},404)}}
  if(p.includes('/knodes/')){
   if(!enrolled)return send({message:'pull_required'},403);
   const id=p.split('/knodes/')[1],m=tree.modules.find(m=>m.module_id===id),k=manifest.knodes.find(k=>k.module_id===id);if(!k)return send({},404);const folder=root+'/'+k.knode_dir;
   const read=async name=>JSON.parse(await fs.readFile(folder+'/'+name,'utf8'));
   return send({project_slug:slug,knode_id:id,title:m.title,summary:m.summary,knode_dir:k.knode_dir,version:manifest.version,plan_markdown:await fs.readFile(folder+'/lesson.md','utf8'),assignment_md:await fs.readFile(folder+'/assignment.md','utf8'),rendered_sections:await read('sections.json'),theories:await read('theories.json'),slides:await read('slides.json')});
  }
  return route.fallback();
 });
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto('http://127.0.0.1:4017/learn/'+slug+'/M20?mission=energy');
 await expect(p.locator('[data-pvlib-classroom="M20"]')).toBeVisible({timeout:30000});
 await expect(p.locator('[data-energy-context="measurement"]')).toBeVisible();
 await expect(p.locator('[data-unified-course]')).toBeVisible();
 await expect(p.locator('[data-energy-footer] a').last()).toHaveAttribute('href',/M21\?mission=energy/);
 await expect(p.locator('[data-pvlib-notebook]')).toBeAttached();
 await p.getByRole('button',{name:'下载 pvlib 实践包 ↓',exact:true}).scrollIntoViewIfNeeded();
 const downloadPromise=p.waitForEvent('download');await p.getByRole('button',{name:'下载 pvlib 实践包 ↓',exact:true}).click();
 const download=await downloadPromise;expect(download.suggestedFilename()).toBe('pvlib-practice-kit.zip');expect(await download.failure()).toBeNull();
 await p.screenshot({path:dir+'full-classroom.png',fullPage:false});
 await p.locator('[data-energy-footer] a').last().click();
 await expect(p.locator('[data-energy-context="forecast"]')).toBeVisible();
 await expect(p.getByRole('navigation',{name:'课程位置'}).locator('a')).toHaveAttribute('href',/mission=energy&node=M21/);
 enrolled=false;await p.goto('http://127.0.0.1:4017/learn/'+slug+'/M41?mission=energy');
 await expect(p).toHaveURL(/\/library\/pvlib-solar-forecast-station\?mission=energy&node=M41/);
 await c.close();
 const guest=await browser.newContext(),g=await guest.newPage();
 await g.goto('http://127.0.0.1:4017/learn/'+slug+'/M41?mission=energy');
 await expect.poll(()=>new URL(g.url()).pathname).toBe('/login');
 expect(new URL(g.url()).searchParams.get('next')).toBe('/learn/'+slug+'/M41?mission=energy');
 await guest.close();
 report.checks.push('Published shared pvlib classroom loads real M20 content through authorized file requests and downloads actual practice ZIP; next task crosses to M21 forecast station; enrollment and guest login retain M41 mission context');
 expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'full-course-verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
