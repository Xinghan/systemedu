// Build a scoped content/web delta. Does not modify canonical sources or production.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),ts=require('../../../packages/student-web/node_modules/typescript')
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'artifacts/molecule-m06-20260911'),web=path.join(root,'packages/student-web')
const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n')}
const cache={};function load(file){if(cache[file])return cache[file];const m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,p=>p.endsWith('.json')?require(path.resolve(path.dirname(file),p)):p.startsWith('.')?load(path.resolve(path.dirname(file),p+'.ts')):require(p),m);return cache[file]=m.exports}
const reading=load(path.join(web,'src/lib/molecule-reading.ts'))
const specs=[{...{"module":"M06","name":"M06-capstone-v1","snap":"M06-before-capstone-v1","title":"S1 双分子识读报告","scriptName":"m06_read.py","exercise":"ex_1782313982244_ocos","notes":"用公开记录核对阿司匹林 CID 2244 与对乙酰氨基酚 CID 1983 的结构身份，不根据药名猜结构。解析后，绘图、计数与 SMARTS 匹配读取同一个 Mol，可分别执行。阿司匹林 C9H8O4，13 重原子、13 条重原子间键、1 环；对乙酰氨基酚 C8H9NO2，11 重原子、11 条重原子间键、1 环。双键仍是一条图连接边。四条匹配规则只针对限定例子；局部结构不能证明药效、安全性或实测溶解度。只做软件，不制备、接触或服用示例物质。示例不计本人完成，浏览器记录不冒充 Python 运行，文字说明需老师复核。","task":"接续 M05 的结构输入。第 6 页分别输入并运行两个目标，填写 C/N/O、重原子间键数与环数，按连接选择官能团，确认 PubChem 来源，写至少 15 字的识读依据与有限结论，保存两张卡。可以查看计数提示、回到第 3 页识别局部连接，并按反馈修正。第 7 页重新核验并下载含结构、来源和本人说明的独立 HTML 报告及 JSON 备份。两张不同目标齐全才标为完整；未齐全是草稿。下一阶段把相同字段排成数据表做批量计算。","quiz":[["解析成功是否说明就是目标分子？",["是","还需核对来源与规范结构"],1,"合法输入也可能表达另一个分子。"],["计数是否必须先生成图片？",["必须","不必，计数读取连接对象 Mol"],1,"绘图与计数都可以从 Mol 读取。"],["阿司匹林有哪些本节官能团？",["羧基与酯基","普通胺与酚羟基"],0,"根据羰基碳与氧的邻接结构识别。"],["双键在重原子连接图里算几条边？",["一条连接边","两条边"],0,"键级与连接数是不同字段。"],["点击过五个工位算完成作品吗？",["算","还需自己的可复核记录与说明"],1,"示例、页面访问与个人成果必须区分。"]]},script:reading.READING_PYTHON}]
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
const files=['src/lib/molecule-reading.ts','src/components/learning/molecule-reading-visual.tsx','src/components/learning/molecule-reading.css']
for(const f of files)report.web_sha256[f]=sha(fs.readFileSync(path.join(web,f)))
report.dependencies_sha256=Object.fromEntries(['src/components/learning/screening-common.tsx','src/components/learning/screening-evidence.css','src/lib/molecule-skeleton.ts','src/lib/data/m03-molecules.json','src/components/learning/molecular-object-3d.tsx','src/lib/rdkit.ts','src/lib/skeleton-evidence.ts','src/lib/smiles-reading.ts','src/components/learning/functional-group.css','src/components/learning/molecular-funnel.css','src/components/learning/skeleton-evidence.css'].map(f=>[f,sha(fs.readFileSync(path.join(web,f)))]))
report.web_before_sha256={}
write(path.join(out,'expected-source.json'),report)
write(path.join(out,'types.txt'),fs.readFileSync(path.join(web,'src/lib/types/api.ts'),'utf8').split('\n').filter(l=>l.includes('renderer: "molecule-reading"')).join('\n')+'\n')
cp.execFileSync('tar',['-czf','/tmp/m06-web-delta.tar.gz','-C',web,...files],{env:{...process.env,COPYFILE_DISABLE:'1'}})
cp.execFileSync('tar',['-czf','/tmp/m06-course-delta.tar.gz','-C',path.join(out,'course'),'.'],{env:{...process.env,COPYFILE_DISABLE:'1'}})
console.log(JSON.stringify({nodes:report.nodes,web_files:files.length,output:out}))

