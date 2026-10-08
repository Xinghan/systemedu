// Build a scoped content/web delta. Does not modify canonical sources or production.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),ts=require('../../../packages/student-web/node_modules/typescript')
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'artifacts/molecule-m0203-20260910'),web=path.join(root,'packages/student-web')
const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n')}
const cache={};function load(file){if(cache[file])return cache[file];const m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,p=>p.endsWith('.json')?require(path.resolve(path.dirname(file),p)):p.startsWith('.')?load(path.resolve(path.dirname(file),p+'.ts')):require(p),m);return cache[file]=m.exports}
const runtime=load(path.join(web,'src/lib/rdkit-runtime.ts')),skeleton=load(path.join(web,'src/lib/skeleton-evidence.ts'))
const specs=[
 {module:'M02',name:'M02-runtime-v1',snap:'M02-before-runtime-v1',title:'运行环境与证据',script:runtime.CHECK_SCRIPT,scriptName:'check_rdkit.py',exercise:'ex_1781595481194_xmpd',
  notes:'安装发生在选定 Python 环境，导入把名字绑定到当前会话；重启会话不等于卸载包。Jupyter 的 %pip 是 IPython magic，不是普通 Python 语法；终端应针对选定解释器使用 python -m pip install rdkit。浏览器 RDKit.js 绘图不证明本机 Python 已安装。读取版本是最小检查，不能证明所有化学算法和后续模型正确。教学状态机不是后台 Python 解释器。个人输出为学习者自报，网页仅做格式校验；本机记录可下载备份，不自动跨设备同步。',
  task:'在家长协助下确认 Python/Notebook 环境，在相应位置安装 RDKit，重启 kernel 后导入并读取版本。运行下方检查模板，保留实际输出和必要截图；回到老师讲课第 7 页粘贴 JSON、确认来源、保存并下载。记录 Python 版本、解释器路径与 RDKit 版本，交给 M03。没有实际输出时不填写示例版本。遇错保留完整错误类别，区分未导入与装在别的环境。',
  quiz:[['网页能画出分子，是否证明本机 Python 已装 RDKit？',['是','否'],1,'浏览器 WASM 和本机 Python 是不同运行环境。'],['重启当前 Python 会话后，包仍在但名字未绑定，应先做什么？',['重新购买电脑','重新导入','删除所有包'],1,'重启清除会话状态，不等于卸载。'],['运行记录来自哪里？',['照抄页面示例','自己的实际脚本输出'],1,'不能用教学值冒充本人环境。']]},
 {module:'M03',name:'M03-spatial-evidence-v2',snap:'M03-before-spatial-v1',title:'分子骨架与空间证据',script:skeleton.SKELETON_SCRIPT,scriptName:'m03_read_skeletons.py',exercise:'ex_1782289507301_aluz',
  notes:'二维结构表达连接，三维坐标表达某个计算构象；PubChem 计算坐标不是实验照片或唯一姿态，浏览器不进行分子动力学。原子不是不可再分的最小粒子。这里在常见中性闭壳层分子中讨论碳的键级和为 4，不把规则绝对化。双键对应两个原子间一条连接，键级为 2；环计数与芳香性使用 RDKit 的定义。苯的离域不表示电子像小球绕圈，更不表示不可反应。显隐氢只改变显示，统计完整分子时仍含氢。质量使用平均原子量求和；单分子平均质量以 Da 表示，摩尔质量以 g/mol 表示，不能混为同一物理量。',
  task:'接续 M02 的环境记录。观察水、甲烷、乙醇、苯：定位原子、检查邻接、切换视角，并记录重原子、全部原子、连接、环四项计数和自己的观察句。在第 8 页分别保存四份观察；运行第 9 页完整 Python 模板，把实际 JSON 输出粘贴回来并确认来源。核对环境是否与 M02 一致；四份观察和本人输出齐全后下载骨架报告。网页只能检查字段与参考值一致，不独立证明执行来源。下一节 M04 在保留骨架的前提下比较官能团与性质。仅做软件学习，不接触或尝试水以外的示例化学品，不做合成、饮用或药效试验。',
  quiz:[['隐藏氢原子会改变分子的总原子数吗？',['会','不会'],1,'隐藏只改变显示。乙醇完整分子仍为 9 个原子。'],['双键在两原子连接数与键级上如何计数？',['两条连接、键级 1','一条连接、键级 2'],1,'连接数与键级是不同口径。'],['一张六边形结构图是否证明物体一定共面且芳香？',['是','否'],1,'二维连接、三维几何和芳香判定需要分别核对。']]}
]
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const report={nodes:[],updated:'2026-09-10',audio:'explicitly-unvoiced',source_sha256:{},course_sha256:{},web_sha256:{}}
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
const files=['src/lib/rdkit-runtime.ts','src/components/learning/rdkit-runtime-visual.tsx','src/components/learning/rdkit-runtime.css','src/lib/skeleton-evidence.ts','src/lib/molecule-skeleton.ts','src/lib/data/m03-molecules.json','src/components/learning/molecular-object-3d.tsx','src/components/learning/molecule-skeleton-visual.tsx','src/components/learning/molecular-funnel.css','src/components/learning/skeleton-evidence-visual.tsx','src/components/learning/skeleton-evidence.css','src/lib/rdkit.ts']
for(const f of files)report.web_sha256[f]=sha(fs.readFileSync(path.join(web,f)))
report.dependencies_sha256=Object.fromEntries(['src/components/learning/screening-common.tsx','src/components/learning/screening-evidence.css','src/lib/discovery-brief.ts'].map(f=>[f,sha(fs.readFileSync(path.join(web,f)))]))
report.web_before_sha256={'src/lib/rdkit.ts':'f8ae2af151dd162c3a0dd3744e5adb1156ff3c9b73f1579c314692e72ae757fb'}
write(path.join(out,'expected-source.json'),report)
write(path.join(out,'types.txt'),'  | { renderer: "rdkit-runtime"; scene: "goal" | "places" | "library" | "binding" | "trace" | "terminal" | "evidence" | "next"; aria_label?: string }\n  | { renderer: "molecule-skeleton"; scene: "overview" | "vocabulary" | "mass" | "bonds" | "skeleton" | "aromatic" | "scan" | "lab" | "report" | "handoff"; aria_label?: string }\n  | { renderer: "molecule-skeleton-evidence"; scene: "overview" | "vocabulary" | "mass" | "bonds" | "skeleton" | "aromatic" | "scan" | "lab" | "report" | "handoff"; aria_label?: string }\n')
cp.execFileSync('tar',['-czf','/tmp/m0203-web-delta.tar.gz','-C',web,...files],{env:{...process.env,COPYFILE_DISABLE:'1'}})
cp.execFileSync('tar',['-czf','/tmp/m0203-course-delta.tar.gz','-C',path.join(out,'course'),'.'],{env:{...process.env,COPYFILE_DISABLE:'1'}})
console.log(JSON.stringify({nodes:report.nodes,web_files:files.length,output:out}))
