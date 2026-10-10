import fs from 'node:fs/promises';
import path from 'node:path';
const sourceRoot=path.resolve('../systemeduidea/projects_data/mars-analog-rover');
const manifest=JSON.parse(await fs.readFile(sourceRoot+'/manifest.json','utf8'));
const tree=JSON.parse(await fs.readFile('artifacts/space-curriculum-audit-20261009/mars-analog-rover-tree.json','utf8'));
const project=JSON.parse(await fs.readFile('artifacts/space-curriculum-audit-20261009/mars-analog-rover-summary.json','utf8'));
const scope=(id,module='M03',version='1.0')=>({library_slug:id,module_id:module,activity_id:'final-deliverable',kind:'assignment',content_version:version});
const dossierScope={library_slug:'space-exploration',module_id:'JOURNEY',activity_id:'mission-dossier',kind:'assignment',content_version:'1.0'};
const cacheKey=(owner,s)=>`systemedu:learning:v1:${encodeURIComponent(owner)}:${encodeURIComponent(JSON.stringify(s))}`;
const jwt=id=>`test.${Buffer.from(JSON.stringify({sub:id})).toString('base64url')}.test`;
export async function mockAccount(c,id){
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
export {jwt,cacheKey};
