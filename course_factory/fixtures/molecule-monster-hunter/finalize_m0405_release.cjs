// Run after API verification; sync only the exact twelve deployed course files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'../../..'),art=path.join(root,'artifacts/molecule-m0405-20260911'),course=path.resolve(root,'../systemeduidea/projects_data/molecule-monster-hunter'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),save=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n')
const meta=JSON.parse(fs.readFileSync(path.join(art,'expected-source.json'))),mp=path.join(course,'manifest.json'),manifest=JSON.parse(fs.readFileSync(mp))
// Validate the entire write set before changing any canonical file.
for(const [p,old]of Object.entries(meta.source_sha256)){
 const next=fs.readFileSync(path.join(art,'course',p)),current=sha(fs.readFileSync(path.join(course,p)))
 if(sha(next)!==meta.course_sha256[p])throw Error('Release artifact drift: '+p)
 if(current!==old&&current!==sha(next))throw Error('Canonical changed: '+p)
 if(!manifest.files.some(f=>f.path===p))throw Error('Missing manifest entry: '+p)
}
for(const p of Object.keys(meta.source_sha256)){
 const b=fs.readFileSync(path.join(art,'course',p));fs.writeFileSync(path.join(course,p),b)
 Object.assign(manifest.files.find(f=>f.path===p),{sha256:sha(b),size:b.length})
}
manifest.total_size_bytes=manifest.files.reduce((n,f)=>n+f.size,0);manifest.generated_at=new Date().toISOString();save(mp,manifest)
const record='docs/deployments/2026-09-11-m04-m05.md',build='waPKEnXAC_0_iuGaXjqLc'
for(const [module,version]of [['M04','controlled-v1'],['M05','smiles-v1']]){
 const file=path.join(__dirname,`${module}-${version}.registry.json`),r=JSON.parse(fs.readFileSync(file))
 r.status='production-verified';r.production_deployed=true;r.deployment={date:'2026-09-11',build_id:build,record,new_audio:false}
 r.deployed_sha256=Object.fromEntries(Object.keys(r.source_sha256).map(f=>[f,meta.course_sha256[`knodes/${r.node}/${f}`]]))
 r.followup_python_verification={date:'2026-09-11',python:'3.12.7',rdkit:'2026.03.3',template_executed:true,note:'此次部署验收实际运行发布模板；不更改历史 QA 记录，也不替学生生成运行证据。'};save(file,r)
}
const pp=path.join(root,'docs/slide-image-prompts/molecule-monster-hunter-progress.json'),p=JSON.parse(fs.readFileSync(pp));p.updated='2026-09-11';p.project_complete=false
p.last_production_batch={modules:['M04','M05'],slides:18,production_deployed:true,build_id:build,record,new_audio:false}
for(const module of ['M04','M05'])Object.assign(p.entries.find(e=>e.module===module),{status:'production-verified',production_deployed:true,deployment:record,note:`2026-09-11 定向部署 ${9} 页；课程 API 与草稿一致，其他节点未改。已实际执行 Python 模板；新讲稿暂未配音。`})
p.current_batch={modules:['M04','M05'],slides:18,production_deployed:true,status:'production-verified',generated_raster_images:1,interactive_3d_pages:{M04:[3],M05:[4]},stepwise_playback_pages:{M04:[6],M05:[7]},record};p.next_recommended_nodes=['M06'];
for(const [module,name]of [['M04','M04-controlled-v1'],['M05','M05-smiles-v1']]){const entry=p.entries.find(e=>e.module===module),reg=JSON.parse(fs.readFileSync(path.join(__dirname,name+'.registry.json')));Object.assign(entry,{draft:'course_factory/fixtures/molecule-monster-hunter/'+name+'.json',draft_sha256:reg.draft_sha256,evidence:reg.decision_record,preview:reg.preview_url})}
save(pp,p);console.log('M04/M05: twelve canonical files, manifest, registry and production ledger aligned.')
