// Build a scoped content/web delta. Does not modify canonical sources or production.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),ts=require('../../../packages/student-web/node_modules/typescript')
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'artifacts/molecule-m0405-20260911'),web=path.join(root,'packages/student-web')
const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n')}
const cache={};function load(file){if(cache[file])return cache[file];const m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,p=>p.endsWith('.json')?require(path.resolve(path.dirname(file),p)):p.startsWith('.')?load(path.resolve(path.dirname(file),p+'.ts')):require(p),m);return cache[file]=m.exports}
const group=load(path.join(web,'src/lib/functional-group.ts')),smiles=load(path.join(web,'src/lib/smiles-reading.ts'))
const specs=[
 {module:'M04',name:'M04-controlled-v1',snap:'M04-before-controlled-v1',title:'官能团与计算对照',script:group.GROUP_SCRIPT,scriptName:'m04_compare.py',exercise:'ex_1782308849318_dams',
 notes:'乙烷在常温常压下是气体，不是浮在水面的液态油珠；乙醇与水可形成均一液体。cLogP 是同一结构算法返回的无量纲计算描述符，不是实测水中溶解度。局部结构替换帮助解释比较，但一次计算不证明真实因果、毒性或药效；电离状态、温度及溶液条件需另行研究。3D 为有来源的计算构象，图片为相态示意，不做真实实验。浏览器计算记录不冒充本人 Python 输出。',
 task:'接续 M03 骨架观察，比较 CC 与 CCO，保留输入、RDKit 版本、Crippen cLogP 前后值与差值。在第 8 页写出自己的有限结论并确认计算边界，保存并下载个人对照记录；可下载完整 Python 模板在已有环境中复算。对照 CC 与 CCCO 时说明多了碳链变化，不把所有差异归给 OH。成果交给 M05 的结构输入学习。',
 quiz:[['cLogP 是不是实测水中溶解度？',['是，单位 g/L','不是，它是计算描述符'],1,'cLogP 没有 g/L 单位，不能代替指定条件下的实测溶解度。'],['CC 与 CCCO 比较时，只有 OH 变化吗？',['只有 OH','碳链长度也变了'],1,'它同时改变碳数与局部原子组。'],['乙烷在常温常压下是什么物态？',['气体','浮在水面的液态油珠'],0,'不能用液态油珠图替代乙烷的常温气态。']]},
 {module:'M05',name:'M05-smiles-v1',snap:'M05-before-smiles-v1',title:'SMILES 结构表达与制图',script:smiles.smilesPython(smiles.TARGETS[1].smiles),scriptName:'m05_draw.py',exercise:'ex_1782311125833_hwsl',
 notes:'SMILES 用字符表示结构，但不是一个字母一个原子：Cl 与 Br 是完整元素符号，方括号内可说明氢、电荷等。同一分子可有多种写法；规范字符串与工具和版本有关。隐式氢须考虑价态、电荷和芳香规则。环数字成对闭合键，不添加原子；C1CCCCC1 是六碳环。RDKit 解析通过不等于目标正确，更不证明合成、药效或安全。教学轨迹不冒充 RDKit 内部算法或化学反应；3D 取自预先核验计算坐标。',
 task:'先用乙醇练习，再从咖啡因或阿司匹林选择一个目标。第 8 页实际输入 SMILES 并运行核对，保留一次解析或目标核对失败的尝试，以及自己至少 12 字的修正说明。下载实际 RDKit 结构 SVG、个人记录 JSON，可另行运行完整 Python 模板。第 9 页重新核验本机保存记录。请备份个人成果；不在软件外制备、服用或测试这些物质。',
 quiz:[['CCO 与 OCC 是不同分子吗？',['连接相同，可表示同一乙醇','一定不同'],0,'遍历方向不同，不改变连接。'],['ClC 包含几个重原子？',['3 个','2 个'],1,'Cl 是氯的完整符号，另一个 C 是碳。'],['C1CCCCC1 中数字 1 增加几个碳？',['2 个','0 个'],1,'数字配对闭合一条键，不添加原子。'],['一个输入可以被解析，是否就证明它是目标且有药效？',['是','否'],1,'还需核对目标连接，药效需要独立证据。']]}
]
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const report={nodes:[],updated:'2026-09-11',audio:'explicitly-unvoiced',source_sha256:{},course_sha256:{},web_sha256:{}}
for(const spec of specs){
 const dpath=path.join(__dirname,spec.name+'.json'),draft=JSON.parse(fs.readFileSync(dpath)),registry=JSON.parse(fs.readFileSync(path.join(__dirname,spec.name+'.registry.json'))),snap=path.join(__dirname,spec.snap)
 if(sha(fs.readFileSync(dpath))!==registry.verified_draft_sha256)throw Error('Reviewed draft changed: '+spec.module)
 const slides=draft.slides,anchor=new Map(slides.filter(s=>s.lesson_anchor).map(s=>[s.lesson_anchor.id,s]))
 if(!slides.every(s=>s.audio_path===null))throw Error('Obsolete audio remains')
 const quiz=spec.quiz.map(([question,options,correct,explanation])=>({type:'choice',question,options,correct,explanation}))
 let lesson=`# ${spec.module} · ${spec.title}\n\n> 本节产出：${spec.task}\n\n## 数据与边界\n\n${spec.notes}\n\n`
 for(const s of slides){lesson+=`## ${s.title}\n\n${s.audio_script}\n\n`;if(s.lesson_anchor)lesson+=`[[${s.lesson_anchor.kind==='theory'?'THEORY':'IDEA'}:${s.lesson_anchor.id}]]\n\n`}
 lesson+=`## 完整运行模板\n\n保存为 ${spec.scriptName}。在 M02 中确认的 Python 环境执行；不会自动在网页运行。\n\n\`\`\`python\n${spec.script}\`\`\`\n\n## 知识自测\n\n[[IDEA:${spec.exercise}]]\n\n## 完成标准\n\n${spec.task}\n\n新版讲稿尚未配音，旧音频已解绑。\n`
 const theories=JSON.parse(fs.readFileSync(path.join(snap,'theories.json'))).map(t=>{const s=anchor.get(t.theory_id);if(!s)throw Error('Theory mapping missing '+t.theory_id);const body=`## ${s.title}\n\n${s.audio_script}\n\n### 数据与边界\n\n${spec.notes}\n\n### 动手核对\n\n${spec.task}`;return {...t,title:s.title,body_markdown:body,level_bodies:(t.level_bodies||[]).map(l=>({...l,body_markdown:body})),exercises:quiz}})
 const sections=JSON.parse(fs.readFileSync(path.join(snap,'sections.json')))
 for(const [id,r]of Object.entries(sections.rendered_sections||{})){
  if(r.mode==='exercise'){r.exercises=quiz;continue}
  const s=anchor.get(id);r.html=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.8 sans-serif;background:#faf8f2;color:#262620;padding:24px;max-width:900px;margin:auto}aside{padding:18px;border-left:4px solid #ae6548;background:#f1ecdf}</style><h1>${esc(s?.title||spec.title)}</h1><p>${esc(s?.audio_script||spec.notes)}</p><aside>正文静态参考；可操作的模型、状态变化和个人记录在“老师讲课”对应幻灯片中。</aside><h2>数据与边界</h2><p>${esc(spec.notes)}</p><h2>动手产出</h2><p>${esc(spec.task)}</p></html>`;r.status='ready';r.exercises=null;r.story_paragraphs=null;r.generation_backend='reviewed-static-evidence-companion'
 }
 for(const i of sections.ideas||[]){i.topic=anchor.get(i.idea_id)?.title||spec.module+' 知识自测';i.context_summary=spec.notes;i.hands_on_ref=spec.task;i.acceptance_ref=spec.task;i.style_key='project-theme';i.mode_reason='正文静态参考，交互位于老师讲课。'}
 sections.animation_topic='';sections.game_topic='';sections.exercise_topic=spec.task
 const outputs={'slides.json':{slides},'lesson.md':lesson,'assignment.md':`# ${spec.module} · 动手与证据\n\n[HANDS_ON] ${spec.task}\n\n## 数据与边界\n\n${spec.notes}\n\n## 可运行模板\n\n\`\`\`python\n${spec.script}\`\`\`\n\n`+quiz.map((q,i)=>`## ${i+1}. ${q.question}\n\n${q.options.map((x,j)=>`${String.fromCharCode(65+j)}. ${x}`).join('\n\n')}\n\n答案：${String.fromCharCode(65+q.correct)}。${q.explanation}\n`).join('\n'),'theories.json':theories,'sections.json':sections,'audio_scripts.json':slides.map(s=>({section_title:s.title,audio_script:s.audio_script}))}
 report.nodes.push({module:spec.module,node:draft.node,slides:slides.length,files:Object.keys(outputs),draft_sha256:sha(fs.readFileSync(dpath))})
 for(const [n,v]of Object.entries(outputs)){if(sha(fs.readFileSync(path.join(snap,n)))!==registry.source_sha256[n])throw Error('Source snapshot changed');const rel=`knodes/${draft.node}/${n}`,target=path.join(out,'course',rel);write(target,v);report.source_sha256[rel]=registry.source_sha256[n];report.course_sha256[rel]=sha(fs.readFileSync(target))}
 write(path.join(out,spec.scriptName),spec.script)
}
const files=['src/lib/functional-group.ts','src/components/learning/functional-group-visual.tsx','src/components/learning/functional-group.css','public/slide-assets/molecule-monster-hunter/M04/phase-comparison-v1.webp','src/lib/smiles-reading.ts','src/components/learning/smiles-reading-visual.tsx','src/components/learning/smiles-reading.css']
for(const f of files)report.web_sha256[f]=sha(fs.readFileSync(path.join(web,f)))
report.dependencies_sha256=Object.fromEntries(['src/components/learning/screening-common.tsx','src/components/learning/screening-evidence.css','src/lib/molecule-skeleton.ts','src/lib/data/m03-molecules.json','src/components/learning/molecular-object-3d.tsx','src/lib/rdkit.ts','src/lib/skeleton-evidence.ts','src/components/learning/molecular-funnel.css','src/components/learning/skeleton-evidence.css'].map(f=>[f,sha(fs.readFileSync(path.join(web,f)))]))
report.web_before_sha256={}
write(path.join(out,'expected-source.json'),report)
write(path.join(out,'types.txt'),fs.readFileSync(path.join(web,'src/lib/types/api.ts'),'utf8').split('\n').filter(l=>l.includes('renderer: "functional-group"')||l.includes('renderer: "smiles-reading"')).join('\n')+'\n')
cp.execFileSync('tar',['-czf','/tmp/m0405-web-delta.tar.gz','-C',web,...files],{env:{...process.env,COPYFILE_DISABLE:'1'}})
cp.execFileSync('tar',['-czf','/tmp/m0405-course-delta.tar.gz','-C',path.join(out,'course'),'.'],{env:{...process.env,COPYFILE_DISABLE:'1'}})
console.log(JSON.stringify({nodes:report.nodes,web_files:files.length,output:out}))
