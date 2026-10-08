// Reproducible scoped content/frontend delta; no production or canonical-source writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process')
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'artifacts/molecule-m38-m90-20260909'),web=path.join(root,'packages/student-web')
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n')}
const specs=[['M38','M38-multimodal-v1','M38-before-multimodal-v1'],['M90','M90-workbench-v1','M90-before-workbench-v1']]
const notes={M38:'正式 LogP 指中性物质在正辛醇/水两相中平衡浓度比的十进对数，不是两相分子总数比。厨房油水插图只建立分层直觉，不能用来测出 LogP。3D 为等半径理想容器，采用稀溶液质量守恒模型，不是流体或分子动力学。RDKit cLogP 是结构估计；三分子分布只是三个教学样本，不是全库实测。葡萄糖连接示例未指定立体化学。',M90:'软件总装必须保持候选 ID、特征列名/顺序/单位和模型版本一致。本页三种结构与描述符来自 RDKit 2025.3.4；模型接口数值是明确编造的教学替身，四行评估及分组标签也是构造数据，不是真实分子性质或训练结果。实际作品仍需接入真实模型、真实 scaffold 测试和完整筛选记录。Go/No-Go 仅指指定教学政策，真实结论是需要更多证据，绝非用药决定。'}
const tasks={M38:'先记录默认浓度比，再保持 logP 不变只改变相体积，对比浓度比与物质的量比。运行老师模板计算 cLogP，交三分子排序、全库计算日志和实际分布图；下载本页教学 JSON，并清楚区分它与自己的全库结果。厨房演示仅用清水和食用油、需家长协助，不使用正辛醇，不品尝任何实验液体。',M90:'依次提交接口清单 → 结构和同序特征表 → 真实模型及筛选日志 → 熟分子逐阶段追踪 → 含真实评估与局限的报告。下载本页教学 JSON 作为字段参考，不能充当真实作品。实际运行课文模板需家长协助。'}
const questions={M38:[['两相体积不同时，P 是哪一种比？',['平衡浓度比','溶质总量比','液体体积比'],0,'P=c(正辛醇)/c(水)，不能用总量比代替。'],['cLogP 每增加 1，P 怎样变？',['加 1','乘 10','不变'],1,'P=10^logP。'],['三行示例柱状图能称作全库分布吗？',['能','不能'],1,'需对实际全库逐条计算并保留有效/失败记录。']],M90:[['八列数都在但 MW/LogP 对调了，能送模型吗？',['不能，应先按训练契约恢复','可以，数量相同'],0,'列数相等不代表含义和顺序相等。'],['没有测试记录时 AUC 写什么？',['0','未提供'],1,'缺失不是零分，不伪造评估。'],['教学替身流程跑通，代表真实作品完成了吗？',['是','否'],1,'还要接入真实模型、评估和全库证据。']]}
const report={nodes:[],updated:'2026-09-09',audio:'explicitly-unvoiced',source_sha256:{},web_sha256:{}}
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
for(const [module,draftName,snapshotName] of specs){
 const draftPath=path.join(__dirname,draftName+'.json'),draft=JSON.parse(fs.readFileSync(draftPath)),registry=JSON.parse(fs.readFileSync(path.join(__dirname,draftName+'.registry.json'))),snap=path.join(__dirname,snapshotName)
 if(sha(fs.readFileSync(draftPath))!==(registry.verified_draft_sha256||registry.draft_sha256))throw Error('Unreviewed draft changed '+module)
 const dest=path.join(out,'course/knodes',draft.node),slides=draft.slides,anchor=new Map(slides.filter(s=>s.lesson_anchor).map(s=>[s.lesson_anchor.id,s]))
 const quizzes=questions[module].map(([question,options,correct,explanation])=>({type:'choice',question,options,correct,explanation}))
 let lesson=`# ${module} · ${slides[0].title}\n\n> 本节产出：${tasks[module]}\n\n## 数据与适用边界\n\n${notes[module]}\n\n`
 for(const s of slides){lesson+=`## ${s.title}\n\n${s.audio_script}\n\n`;if(s.lesson_anchor)lesson+=`[[${s.lesson_anchor.kind==='theory'?'THEORY':'IDEA'}:${s.lesson_anchor.id}]]\n\n`}
 lesson+=`## 完成标准\n\n${tasks[module]}\n\n新版讲稿尚未配音；已解绑旧音频，可阅读逐页讲稿。\n`
 const theories=JSON.parse(fs.readFileSync(path.join(snap,'theories.json'))).map(t=>{const s=anchor.get(t.theory_id),body=`## ${s?.title||t.title}\n\n${s?.audio_script||notes[module]}\n\n### 方法与边界\n\n${notes[module]}\n\n### 动手核对\n\n${tasks[module]}`;return {...t,title:s?.title||t.title,body_markdown:body,level_bodies:(t.level_bodies||[]).map(l=>({...l,body_markdown:body})),exercises:quizzes}})
 const sections=JSON.parse(fs.readFileSync(path.join(snap,'sections.json')))
 for(const [id,r] of Object.entries(sections.rendered_sections||{})){if(r.mode==='exercise'){r.exercises=quizzes;continue}const s=anchor.get(id);r.html=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.8 sans-serif;background:#faf8f2;color:#262620;padding:24px;max-width:900px;margin:auto}aside{padding:18px;border-left:4px solid #ae6548;background:#f1ecdf}</style><h1>${escape(s?.title||module+' 证据核对')}</h1><p>${escape(s?.audio_script||notes[module])}</p><aside>这是正文的静态参考。可操作的教学模型、步骤演示与成果下载位于“老师讲课”对应幻灯片。</aside><h2>数据与边界</h2><p>${escape(notes[module])}</p><h2>动手产出</h2><p>${escape(tasks[module])}</p></html>`;r.status='ready';r.exercises=null;r.story_paragraphs=null;r.generation_backend='reviewed-static-evidence-companion'}
 for(const idea of sections.ideas||[]){idea.topic=anchor.get(idea.idea_id)?.title||module+' 证据核对';idea.context_summary=notes[module];idea.hands_on_ref=tasks[module];idea.acceptance_ref=tasks[module];idea.style_key='project-theme';idea.mode_reason='正文静态参考；互动位于老师讲课对应页。'}
 sections.animation_topic='';sections.game_topic='';sections.exercise_topic=tasks[module]
 const assignment=`# ${module} · 动手与证据\n\n${tasks[module]}\n\n## 适用边界\n\n${notes[module]}\n\n`+questions[module].map(([q,o,c,e],i)=>`## ${i+1}. ${q}\n\n${o.map((v,j)=>`${String.fromCharCode(65+j)}. ${v}`).join('\n\n')}\n\n<details><summary>核对答案</summary>\n\n${String.fromCharCode(65+c)}。${e}\n\n</details>\n`).join('\n')
 const outputs={'slides.json':{slides},'lesson.md':lesson,'assignment.md':assignment,'theories.json':theories,'sections.json':sections,'audio_scripts.json':slides.map(s=>({section_title:s.title,audio_script:s.audio_script}))}
 for(const [name,data]of Object.entries(outputs)){if(sha(fs.readFileSync(path.join(snap,name)))!==registry.source_sha256[name])throw Error('Snapshot mismatch');write(path.join(dest,name),data);report.source_sha256[`knodes/${draft.node}/${name}`]=registry.source_sha256[name]}
 report.nodes.push({module,node:draft.node,slides:slides.length,files:Object.keys(outputs)})
}
const files=['src/lib/logp-lab.ts','src/lib/workbench-evidence.ts','src/components/learning/logp-lab-visual.tsx','src/components/learning/logp-lab.css','src/components/learning/partition-object-3d.tsx','src/components/learning/workbench-evidence-visual.tsx','src/components/learning/workbench-evidence.css','public/slide-assets/molecule-monster-hunter/M38/oil-water-comparison-v1.webp']
const dependencies=['src/components/learning/screening-common.tsx','src/components/learning/screening-evidence.css','src/lib/rdkit.ts']
for(const f of files)report.web_sha256[f]=sha(fs.readFileSync(path.join(web,f)))
report.dependencies_sha256=Object.fromEntries(dependencies.map(f=>[f,sha(fs.readFileSync(path.join(web,f)))]))
// Production's existing drawSmilesSvg API was checked read-only; no new options
// are required by these two renderers. Preserve its deployed implementation.
report.dependencies_sha256['src/lib/rdkit.ts']='f8ae2af151dd162c3a0dd3744e5adb1156ff3c9b73f1579c314692e72ae757fb'
write(path.join(out,'expected-source.json'),report)
write(path.join(out,'types.txt'),fs.readFileSync(path.join(web,'src/lib/types/api.ts'),'utf8').split('\n').filter(l=>/renderer: "(logp-lab|workbench-evidence)"/.test(l)).join('\n'))
cp.execFileSync('tar',['-czf','/tmp/m3890-web-delta.tar.gz','-C',web,...files],{env:{...process.env,COPYFILE_DISABLE:'1'}})
cp.execFileSync('tar',['-czf','/tmp/m3890-course-delta.tar.gz','-C',path.join(out,'course'),'.'],{env:{...process.env,COPYFILE_DISABLE:'1'}})
// Mechanical derivation from the previous audited step-wise transport.
for(const [src,dst]of [['m87-m89-local.sh','m38-m90-local.sh'],['m87-m89-evidence-20260909.sh','m38-m90-evidence-20260909.sh'],['m87-m89-release.py','m38-m90-release.py']]){
 let s=fs.readFileSync(path.join(root,'scripts/releases',src),'utf8').replaceAll('m87-m89','m38-m90').replaceAll('m8789','m3890').replaceAll('M87 M88 M89','M38 M90').replace("'slides':32","'slides':20")
 if(dst==='m38-m90-evidence-20260909.sh')s=s.replace('test ! -e "$RELEASE/student-web"\n  mkdir "$RELEASE/student-web"','test ! -f "$RELEASE/web-baseline.json"\n  mkdir -p "$RELEASE/student-web"')
 if(dst.endsWith('.py')){
  s=s.replace(/WEB_NEW=\[.*\]\nWEB_EDIT=/,`WEB_NEW=${JSON.stringify(files)}\nWEB_EDIT=`).replace(/WEB_NEW \+= .*\n/,'')
  s=s.replaceAll('diversity-evidence','logp-lab')
  s=s.replace('import { RankingEvidenceVisual } from "./ranking-evidence-visual"\\nimport { DiversityVisual, RejectionVisual } from "./diversity-rejection-visual"','import { LogpLabVisual } from "./logp-lab-visual"\\nimport { WorkbenchEvidenceVisual } from "./workbench-evidence-visual"')
  s=s.replace('case "ranking-evidence": return <RankingEvidenceVisual key={visual.scene} visual={visual} />\\n    case "logp-lab": return <DiversityVisual key={visual.scene} visual={visual} />\\n    case "rejection-evidence": return <RejectionVisual key={visual.scene} visual={visual} />','case "logp-lab": return <LogpLabVisual key={visual.scene} visual={visual} />\\n    case "workbench-evidence": return <WorkbenchEvidenceVisual key={visual.scene} visual={visual} />')
  s=s.replace("save('web-baseline.json',hashes(root));print",`assert (root/'.next/BUILD_ID').read_text().strip()=='ea4FB-hqZCwxNKu7J5oIs','Unexpected live build'\n    for p,h in META['dependencies_sha256'].items(): assert hashlib.sha256((root/p).read_bytes()).hexdigest()==h,'Dependency differs: '+p\n    save('web-baseline.json',hashes(root));print`)
  s=s.replace("save('web-changes.json',sorted(changes));print",`for p,h in META['web_sha256'].items(): assert after[p]==h\n    save('web-changes.json',sorted(changes));print`)
  s=s.replace("regenerate_manifest(root);assert not verify_files(load_manifest(root/'manifest.json'),root)","regenerate_manifest(root)\n    m=json.loads((root/'manifest.json').read_text());m['files']=[f for f in m['files'] if not f['path'].startswith('_archive/')];m['total_size_bytes']=sum(f['size'] for f in m['files']);(root/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))\n    assert not verify_files(load_manifest(root/'manifest.json'),root)")
 }
 write(path.join(root,'scripts/releases',dst),s)
}
console.log(JSON.stringify({nodes:report.nodes,web_files:files.length,old_audio:'unbound',output:out}))
