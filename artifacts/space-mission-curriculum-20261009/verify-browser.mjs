import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const dir=new URL('./',import.meta.url).pathname,origin='http://localhost:4000';
const config=JSON.parse(await fs.readFile('packages/student-web/src/lib/project-lines/space-curriculum.json','utf8'));
const sourceRoot=path.resolve('../systemeduidea/projects_data/mars-analog-rover');
const manifest=JSON.parse(await fs.readFile(sourceRoot+'/manifest.json','utf8'));
const tree=JSON.parse(await fs.readFile('artifacts/space-curriculum-audit-20261009/mars-analog-rover-tree.json','utf8'));
const project=JSON.parse(await fs.readFile('artifacts/space-curriculum-audit-20261009/mars-analog-rover-summary.json','utf8'));
const scope=(id,module='M03',version='1.0')=>({library_slug:id,module_id:module,activity_id:'final-deliverable',kind:'assignment',content_version:version});
const dossierScope={library_slug:'space-exploration',module_id:'JOURNEY',activity_id:'mission-dossier',kind:'assignment',content_version:'1.0'};
const cacheKey=(owner,s)=>`systemedu:learning:v1:${encodeURIComponent(owner)}:${encodeURIComponent(JSON.stringify(s))}`;
const jwt=id=>`test.${Buffer.from(JSON.stringify({sub:id})).toString('base64url')}.test`;
const browser=await chromium.launch({headless:true});
const report={passed:false,checks:[],errors:[]};
const watch=p=>p.on('pageerror',e=>report.errors.push(e.message));
async function context(options={}){const c=await browser.newContext(options);await c.addInitScript(()=>{for(let i=1;i<=5;i++)localStorage.setItem(`systemedu:mission:space:stage-film:${i}:v1`,'1')});return c;}
async function hubReady(p){await expect(p.locator('[data-space-journey]')).toBeVisible();await expect(p.getByRole('button',{name:'刷新进展',exact:true})).toBeEnabled({timeout:25000});}
const overflow=async p=>expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
async function mockAccount(c,id){
 const histories=new Map(),calls=[],scopeKey=s=>JSON.stringify(['library_slug','module_id','activity_id','kind','content_version'].map(k=>s[k]));
 let fail=false,enrolled=true,revision=0;
 const work={answers:[{question_id:'choice',question:'为什么选择这条路线？',answer:'保留两次同条件测试。'}],artifact:{schema_version:'test-submission',revision:1}};
 histories.set(`${jwt(id)}:${scopeKey(scope('tune-a-chassis'))}`,{draft:null,submissions:[{...scope('tune-a-chassis'),id:'source-1',created_at:'2026-10-09T00:00:00Z',revision:1,body:work}]});
 await c.addInitScript(token=>localStorage.setItem('systemedu_token',token),jwt(id));
 await c.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),p=url.pathname,method=request.method(),token=request.headers().authorization?.replace('Bearer ','');calls.push({path:p,method,token});
  const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(body)});
  if(method==='OPTIONS')return send({});
  if(p==='/api/learning/records'){
   const s=Object.fromEntries(url.searchParams);calls.at(-1).scope=s;
   if(fail&&s.library_slug==='plan-a-payload')return send({message:'Test unavailable'},503);
   return send(histories.get(`${token}:${scopeKey(s)}`)||{draft:null,submissions:[]});
  }
  if(p==='/api/learning/drafts'||p==='/api/learning/submissions'){
   const body=request.postDataJSON(),key=`${token}:${scopeKey(body)}`,old=histories.get(key)||{draft:null,submissions:[]};calls.at(-1).body=body;
   if(body.expected_revision!==(old.draft?.revision||0))return send({error:'conflict',message:'另一页面已有新版'},409);
   const s=Object.fromEntries(['library_slug','module_id','activity_id','kind','content_version'].map(k=>[k,body[k]]));
   const sub=p.endsWith('submissions'),draft={...s,id:'draft-'+(++revision),body:body.body,revision:body.expected_revision+1,status:sub?'submitted':'draft',updated_at:new Date().toISOString()};
   const submission={...s,id:'submission-'+revision,body:body.body,revision:draft.revision,created_at:new Date().toISOString(),request_id:body.request_id,grading_status:'ungraded'};
   histories.set(key,{draft,submissions:sub?[submission,...old.submissions]:old.submissions});return send(sub?{draft,submission}:{draft});
  }
  if(p.includes('/complete-status'))return send({completed_knode_ids:token===jwt(id)?['M35']:[]});
  if(p==='/api/my/projects')return send(enrolled?[{slug:'mars-analog-rover',title:'火星类比探测车',last_module_id:'M35'}]:[]);
  if(p==='/api/my/projects/mars-analog-rover'&&method==='POST'){enrolled=true;return send({slug:'mars-analog-rover'})}
  if(p.includes('/api/my/progress/'))return send({last_module_id:p.split('/').at(-1)});
  if(p.endsWith('/knowledge-tree'))return send({lit_nodes:[],nodes:[],edges:[]});
  if(p.endsWith('/tree'))return send(tree);
  if(p.endsWith('/blueprint'))return send({content:'课程介绍',lang_returned:'zh-CN'});
  if(p==='/api/library/projects/mars-analog-rover')return send(project);
  if(p.includes('/files/')){
   const relative=decodeURIComponent(p.split('/files/')[1]),file=path.resolve(sourceRoot,relative);
   if(!file.startsWith(sourceRoot+'/'))return send({},404);
   try{return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.json')?'application/json':'application/octet-stream',headers:{'access-control-allow-origin':'*'}})}catch{return send({},404)}
  }
  if(p.includes('/knodes/')&&!p.includes('/complete-status')){
   if(!enrolled)return send({error:'pull_required',message:'pull_required'},403);
   const mid=decodeURIComponent(p.split('/knodes/')[1]),k=manifest.knodes.find(n=>n.module_id===mid),m=tree.modules.find(n=>n.module_id===mid);
   if(!k)return send({},404);
   const root=path.join(sourceRoot,k.knode_dir),read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
   return send({project_slug:'mars-analog-rover',knode_id:mid,title:m.title,summary:m.summary||'',knode_dir:k.knode_dir,version:'1.1.1',plan_markdown:await fs.readFile(root+'/lesson.md','utf8'),assignment_md:await fs.readFile(root+'/assignment.md','utf8'),rendered_sections:await read('sections.json'),theories:await read('theories.json'),slides:await read('slides.json')});
  }
  if(p.includes('/chat/'))return send([]);
  return send({});
 });
 return {histories,calls,scopeKey,work,setFail:v=>fail=v,setEnrolled:v=>enrolled=v,updateSource:()=>{const h=histories.get(`${jwt(id)}:${scopeKey(scope('tune-a-chassis'))}`);h.submissions.unshift({...h.submissions[0],id:'source-2',body:{...work,artifact:{revision:2}}})}};
}
try{
 const c=await context({viewport:{width:1440,height:1100}}),p=await c.newPage();watch(p);
 await p.goto(origin+'/mission/space');await hubReady(p);
 await expect(p.locator('[data-mission-node]')).toHaveCount(8);
 for(const station of config.stations){
  await p.locator(`[data-mission-node="${station.id}"]`).click();
  await expect(p.locator('[data-journey-station]')).toHaveAttribute('data-journey-station',station.id);
  expect(await p.locator('[data-mission-step]').evaluateAll(els=>els.map(e=>e.dataset.missionStep))).toEqual(station.steps);
 }
 await p.locator('[data-mission-node="build"]').click();await p.locator('#journey-map').screenshot({path:dir+'map-desktop.png'});
 await p.locator('[data-mission-step="assemble-a-rover:M06"]').click();
 await expect(p.locator('[data-mission-context]')).toHaveAttribute('data-mission-context','build');
 await expect(p.locator('[data-mission-context]').getByRole('link',{name:'查看我的最终作品'})).toHaveAttribute('href','/explore/space-exploration/assemble-a-rover?node=M08&mission=space#project-delivery');
 for(const selector of ['#lesson-reading','#lesson-videos','#lesson-references','#lesson-notebook','[data-rover-workshop]'])await expect(p.locator(selector)).toBeAttached();
 await expect(p.getByRole('link',{name:'下载参考 STL 与试配片'})).toHaveAttribute('href',/reference-stl.zip/);
 await expect(p.locator('[data-mission-footer] a').last()).toHaveAttribute('href','/explore/space-exploration/assemble-a-rover?node=M07&mission=space');
 await p.goto(origin+'/explore/space-exploration/tune-a-chassis?node=M03&mission=space');
 await expect(p.locator('[data-mission-footer] a').last()).toHaveAttribute('href','/explore/space-exploration/assemble-a-rover?node=M01&mission=space');
 await expect(p.locator('[data-project-delivery] a').last()).toHaveAttribute('href','/explore/space-exploration/assemble-a-rover?node=M01&mission=space');
 await p.locator('[data-mission-footer] a').last().click();await expect(p.locator('[data-mission-context]')).toHaveAttribute('data-mission-context','mechanics');
 await p.goto(origin+'/explore/space-exploration/assemble-a-rover?node=M08&mission=space');
 await expect(p.locator('[data-system-delivery] a').last()).toHaveAttribute('href','/learn/mars-analog-rover/M02?mission=space');
 await p.goto(origin+'/mission/space#mission-dossier');await hubReady(p);
 const dossier=p.locator('[data-mission-dossier]');
 await dossier.getByLabel('01 / 这次远征要观察什么？').fill('比较两块地垫的纹理');
 await dossier.getByLabel('02 / 在哪里测试，场地有什么边界？').fill('教室地面，长 2 米的软边界');
 await dossier.getByLabel('03 / 留下哪些证据来判断结果？').fill('两次日志、照片与误判记录');
 await dossier.getByRole('button',{name:'保存这版任务档案',exact:true}).click();
 await p.reload();await hubReady(p);await expect(dossier.getByLabel('01 / 这次远征要观察什么？')).toHaveValue('比较两块地垫的纹理');
 await p.goto(origin+'/explore/space-exploration/run-an-expedition?node=M01&mission=space');
 await expect(p.getByRole('button',{name:'将简报带入这个空白任务',exact:true})).toBeEnabled();
 await p.getByRole('button',{name:'将简报带入这个空白任务',exact:true}).click();await expect(p.getByLabel('我的观察任务',{exact:true})).toHaveValue('比较两块地垫的纹理');
 await p.reload();await expect(p.getByLabel('我的观察任务',{exact:true})).toHaveValue('比较两块地垫的纹理');await expect(p.getByRole('button',{name:'将简报带入这个空白任务',exact:true})).toBeDisabled();
 await p.goto(origin+'/learn/mars-analog-rover/M11?mission=space');await expect(p).toHaveURL(/login\?next=.*M11.*mission/);
 await p.goto(origin+'/explore/space-exploration/tune-a-chassis?node=M03');await expect(p.locator('[data-mission-context]')).toHaveCount(0);await expect(p.locator('[data-guided-notebook="M03"]')).toBeVisible();
 report.checks.push('All eight map stations match the curriculum; internal and footer links follow cross-course order; media/notebook/STL links retained; guest dossier and adopted expedition goal survive refresh; original standalone classroom remains');
 await c.close();
 const a=await context({viewport:{width:1440,height:1100}}),backend=await mockAccount(a,'mission-a'),q=await a.newPage();watch(q);
 await q.goto(origin+'/mission/space?station=autonomy');await hubReady(q);
 expect(await q.locator('[data-mission-step][data-recorded=true]').count()).toBe(1);
 const d=q.locator('[data-mission-dossier]');await d.getByLabel('01 / 这次远征要观察什么？').fill('账号 A 的观察任务');await d.getByLabel('02 / 在哪里测试，场地有什么边界？').fill('桌面软围栏');await d.getByLabel('03 / 留下哪些证据来判断结果？').fill('真实轨迹和停止记录');
 await d.locator('summary').filter({hasText:'关联已有作品'}).click();
 await d.locator('[data-evidence-project="tune-a-chassis"]').getByRole('button',{name:'关联我的提交'}).click();
 await expect(d.locator('[data-evidence-project="tune-a-chassis"]')).toContainText('已关联这个提交版本');
 await expect(d.getByRole('button',{name:'保存这版任务档案',exact:true})).toBeEnabled();await d.getByRole('button',{name:'保存这版任务档案',exact:true}).click();
 await expect.poll(()=>backend.histories.get(`${jwt('mission-a')}:${backend.scopeKey(dossierScope)}`)?.submissions.length).toBe(1);
 backend.updateSource();await d.getByRole('button',{name:'检查来源是否有更新'}).click();await expect(d.locator('[data-evidence-project="tune-a-chassis"]')).toContainText('来源已有新版');
 await expect.poll(()=>backend.histories.get(`${jwt('mission-a')}:${backend.scopeKey(dossierScope)}`)?.draft.body.artifact.checks?.['tune-a-chassis']?.state).toBe('changed');
 await q.reload();await hubReady(q);await d.locator('summary').filter({hasText:'关联已有作品'}).click();await expect(d.locator('[data-evidence-project="tune-a-chassis"]')).toContainText('来源已有新版');
 const state=backend.histories.get(`${jwt('mission-a')}:${backend.scopeKey(dossierScope)}`);expect(state.draft.body.artifact.links[0].submissionId).toBe('source-1');expect(state.submissions[0].body.artifact.checks['tune-a-chassis'].state).toBe('current');
 await q.goto(origin+'/learn/mars-analog-rover/M11?mission=space');await expect(q.locator('[data-mission-classroom]')).toBeVisible({timeout:30000});await expect(q.locator('[data-mission-footer] a').last()).toHaveAttribute('href','/explore/space-exploration/write-driving-rules?node=M01&mission=space');
 await expect(q.locator('[data-mission-outline]').first()).toContainText('接线与控制程序');
 await q.screenshot({path:dir+'full-classroom-desktop.png'});
 await q.goto(origin+'/learn/mars-analog-rover/M44?mission=space');await expect(q.locator('[data-mission-merged-assignment]')).toBeVisible({timeout:30000});await expect(q.locator('[data-node-assignment]')).toContainText('现场精度对比报告');await expect(q.locator('[data-capstone-record]')).toHaveCount(0);await expect(q.locator('[data-mission-footer] a').last()).toHaveAttribute('href','/explore/space-exploration/run-an-expedition?node=M05&mission=space');
 await q.locator('[data-mission-merged-assignment]').screenshot({path:dir+'merged-assignment.png'});
 await q.goto(origin+'/learn/mars-analog-rover/M10?mission=space');await expect(q.locator('[data-persistent-question]').first()).toBeAttached({timeout:15000});await expect(q.locator('[data-mission-merged-assignment]')).toBeVisible();
 await q.goto(origin+'/mission/space');await hubReady(q);await q.evaluate(t=>{localStorage.setItem('systemedu_token',t);window.dispatchEvent(new Event('focus'))},jwt('mission-b'));await hubReady(q);await expect(q.locator('[data-mission-dossier]').getByLabel('01 / 这次远征要观察什么？')).toHaveValue('');
 expect(backend.calls.filter(c=>c.body?.library_slug==='space-exploration').every(c=>c.body.module_id==='JOURNEY'&&c.body.activity_id==='mission-dossier'&&c.body.content_version==='1.0')).toBe(true);
 report.checks.push('Mocked account: explicit completion only, account dossier save/restore, source revision warning persists without replacing historical submission, account switch isolation, original full-course rendering and quizzes preserved with merged hands-on delivery');
 backend.setEnrolled(false);await q.goto(origin+'/learn/mars-analog-rover/M11?mission=space');await expect(q).toHaveURL(/library\/mars-analog-rover\?mission=space&node=M11/);await q.getByRole('button',{name:'加入我的项目'}).click();await expect(q).toHaveURL(/learn\/mars-analog-rover\/M11\?mission=space/);await expect(q.locator('[data-mission-classroom]')).toBeVisible();
 report.checks.push('Enrollment returns to the requested mission node, rather than M01 or last visited');
 await q.setViewportSize({width:390,height:844});await overflow(q);await q.locator('[data-mission-context] summary').filter({hasText:'查看本站任务步骤'}).click();await expect(q.locator('[data-mission-context] [data-mission-outline]')).toBeVisible();await expect(q.locator('[data-sonner-toast]')).toHaveCount(0,{timeout:10000});await q.screenshot({path:dir+'full-classroom-mobile.png'});
 await a.close();
 for(const width of [390,320]){
  const c=await context({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await c.newPage();watch(p);
  await p.goto(origin+'/mission/space?station=perception');await hubReady(p);await overflow(p);await p.locator('#journey-map').screenshot({path:dir+`map-${width}.png`});
  await p.goto(origin+'/explore/space-exploration/plan-a-payload?node=M03&mission=space');await expect(p.locator('#lesson-notebook')).toBeVisible();await expect(p.getByText('正在进入任务课程...', {exact:true})).toHaveCount(0);await p.locator('[data-mission-context]').scrollIntoViewIfNeeded();await overflow(p);if(width===390)await p.screenshot({path:dir+'guided-mobile.png'});
  await c.close();
 }
 report.checks.push('390px and 320px map/task/dossier and guided classroom layouts without horizontal overflow');
 for(const [station,film] of [['first-contact',1],['expedition',4],['autonomy',null],['delivery',null]]){
  const c=await browser.newContext(),p=await c.newPage();watch(p);let writes=0;
  p.on('request',r=>{if(r.method()==='POST'&&/learning\/(drafts|submissions)/.test(r.url()))writes++});
  await p.goto(origin+'/mission/space?station='+station);await hubReady(p);
  if(film){await expect(p.locator(`dialog[data-stage-film="${film}"]`)).toBeVisible();await p.getByRole('button',{name:'跳过短片，开始任务',exact:true}).click();await p.reload();await hubReady(p);await expect(p.locator('dialog[data-stage-film]')).toHaveCount(0)}
  else await expect(p.locator('dialog[data-stage-film]')).toHaveCount(0);
  expect(writes).toBe(0);await c.close();
 }
 report.checks.push('First arrivals reuse compatible observation/expedition films once; no old branching finale in autonomy or delivery; film viewing creates no learning submission');
 expect(report.errors).toEqual([]);report.passed=true;
}catch(e){report.failure=String(e);throw e}finally{await fs.writeFile(dir+'browser-verification.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
