// Build only three aligned course-node deltas; original source stays untouched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'artifacts/molecule-m87-m89-20260909/course')
const specs=[['M87','M87-ranking-v1','M87-before-ranking-v1'],['M88','M88-evidence-v1','M88-before-evidence-v1'],['M89','M89-evidence-v1','M89-before-evidence-v1']]
const notes={
 M87:'本节沿用 M86 的 255 个合成幸存候选，新增活性为 ID 确定性构造值。指标的 0–1 刻度不表示概率或相同科学价值；风险先反向。性质初筛保持二元 1。全零权重、非有限值和重复 ID 拒绝计算；按未舍入总分排序，真正同分按 ID。M88 将使用独立结构示例，不能把这些合成 ID 当作真实结构。',
 M88:'本节明确使用独立的 16 个结构教学池，分数人为设定；不是 M87 合成 ID 的真实结构。RDKit 2026.03.3 计算 Morgan radius=2、2048 位指纹与 Murcko 骨架。相似结构可能出现显著性质差异，不能用一次实验代替同族全部实验。普通 MaxMin 不保证十种骨架，也不自动使用阈值。额外约束不可满足时返回实际数量；池中仅有九种骨架。',
 M89:'本节使用原文数值扩展的六行独立教学示例。四项均不超上限是本例教学政策，不等于完整 Lipinski 判据。记录的是本次顺序短路行为，未执行不等于通过。完整诊断可以另外实际运行，但不得冒充原轨迹。缺失数据是暂缓，不静默补零。理由多不自动证明阈值过严，更不证明真实药效或安全。'
}
const questions={
 M87:[['四项相对权重全是 0 时，正确处理是什么？',['暂停排名，要求至少一项非零','把总分都当成 1','沿用上次结果但不说明'],0,'没有正的分量和，不能定义这组归一化权重。'],['只换浓度单位，正确共同范围归一化后的排序会怎样？',['必须改变','保持不变','自动变为安全概率'],1,'数值、最小值和最大值同时按同一单位换算，比例不变。'],['M87 合成 ID 能直接用于分子指纹计算吗？',['可以，ID 就是结构','不可以，需要经验证的结构资料','分数越高结构越明确'],1,'合成 ID 不包含化学连接关系，不能由 ID 编造结构。']],
 M88:[['16 个候选只有 9 种骨架，要求 10 个骨架唯一的结果怎么办？',['复制一个凑数','报告实际只能选 9 个','把相同骨架改名'],1,'不可满足时保存实际数量和约束，不伪造第十个。'],['MaxMin 每一步如何选择？',['最大化到已选集合的最小距离','只比较最高分种子','按两两相似度平均数最高选'],0,'每个候选先找最近的已选邻居，再选择最近距离最大的候选。'],['同一 Murcko 骨架可以证明性质和实验结果相同吗？',['可以','不能；侧基等变化也可能改变性质','只要分数相同就可以'],1,'结构覆盖是一个比较角度，不是实验等效证明。']],
 M89:[['A 的 MW=612、logP=5.2，MW 优先时第一理由是什么？',['MW 612 > 500','logP 更严重，所以报 logP','两项都已在短路中执行'],0,'第一失败由固定顺序决定，不由严重程度决定。'],['短路后未执行，与检查通过是否相同？',['相同','不同，未执行没有该条判断结果','缺数据时才不同'],1,'必须区分原始输入存在、规则已执行和已通过。'],['很多候选都因 logP 被拒，能立刻认定阈值太严吗？',['能，应马上调松','不能，还要核查顺序、数据和任务依据','能证明所有分子有毒'],1,'第一理由频数受执行顺序和数据组成影响，不单独证明政策合理性。']]
}
const report={nodes:[],updated:'2026-09-09',audio:'explicitly-unvoiced',source_sha256:{}}
for(const [module,draftName,snapshotName] of specs){
 const draft=JSON.parse(fs.readFileSync(path.join(__dirname,draftName+'.json'))),registry=JSON.parse(fs.readFileSync(path.join(__dirname,draftName+'.registry.json'))),snap=path.join(__dirname,snapshotName),dest=path.join(out,'knodes',draft.node)
 fs.mkdirSync(dest,{recursive:true})
 const slides=draft.slides,byAnchor=new Map(slides.filter(s=>s.lesson_anchor).map(s=>[s.lesson_anchor.id,s]))
 const objective=module==='M87'?'提交两套权重的排名对比及理由':module==='M88'?'提交分数基线与多样性名单、实际数量及策略说明':'提交候选执行轨迹、第一失败比较及缺数据状态'
 let lesson=`# ${module} · ${slides[0].title}\n\n> 本节产出：${objective}。\n\n## 数据与结论边界\n\n${notes[module]}\n\n`
 for(const s of slides){lesson+=`## ${s.title}\n\n${s.audio_script}\n\n`;if(s.lesson_anchor)lesson+=`[[${s.lesson_anchor.kind==='theory'?'THEORY':'IDEA'}:${s.lesson_anchor.id}]]\n\n`}
 lesson+='## 完成标准\n\n在老师讲课中完成互动，下载实际结果，并写一句说明。精确结构、公式、状态与原始输入都可检查；本节未合成新版语音，阅读逐页讲稿即可。\n'
 const theory=JSON.parse(fs.readFileSync(path.join(snap,'theories.json'))).map(t=>{
  const s=byAnchor.get(t.theory_id),near=s?slides.indexOf(s):0,body=`## ${s?.title||t.title}\n\n${s?.audio_script||notes[module]}\n\n${slides[Math.min(near+1,slides.length-1)].audio_script}\n\n### 方法与适用边界\n\n${notes[module]}\n\n请在老师讲课中核对逐步证据，并保留实际参数和结果。`
  return {...t,title:s?.title||t.title,body_markdown:body,level_bodies:(t.level_bodies||[{level:'K1'},{level:'K3'}]).map(l=>({...l,body_markdown:body})),exercises:questions[module].map(([question,options,correct,explanation])=>({type:'choice',question,options,correct,explanation}))}
 })
 const sections=JSON.parse(fs.readFileSync(path.join(snap,'sections.json')))
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
 for(const [id,r] of Object.entries(sections.rendered_sections||{})){
  if(r.mode==='exercise'){r.exercises=questions[module].map(([question,options,correct,explanation])=>({type:'choice',question,options,correct,explanation}));continue}
  const s=byAnchor.get(id),title=s?.title||`${module} 教学证据核对`
  // Legacy activity views receive an explicitly static reference, never stale
  // contradictory simulation. Live controls are in the reviewed teaching slide.
  r.html=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.8 sans-serif;background:#faf8f2;color:#262620;padding:24px;max-width:900px;margin:auto}td,th{border-bottom:1px solid #d8d2c5;padding:12px;text-align:left}aside{border-left:4px solid #ae6548;padding:15px;background:#f1ecdf}</style><h1>${escape(title)}</h1><p>${escape(s?.audio_script||notes[module])}</p><aside>这是课程正文的静态核对表。可操作的逐步演示、参数实验与下载成果位于本节点“老师讲课”的对应幻灯片。</aside><table><tr><th>核对问题</th><th>依据</th></tr>${questions[module].map(([q,o,c,e])=>`<tr><td>${escape(q)}</td><td>${escape(o[c])}；${escape(e)}</td></tr>`).join('')}</table><p>${escape(notes[module])}</p></html>`
  r.status='ready';r.exercises=null;r.story_paragraphs=null;r.generation_backend='reviewed-static-evidence-companion'
 }
 for(const idea of sections.ideas||[]){idea.topic=byAnchor.get(idea.idea_id)?.title||`${module} 证据核对`;idea.context_summary=notes[module];idea.hands_on_ref=objective;idea.acceptance_ref=objective;idea.style_key='project-theme';idea.mode_reason='正文静态核对；互动由老师讲课对应页提供。'}
 sections.animation_topic='';sections.game_topic='';sections.exercise_topic=objective
 const assignment=`# ${module} · 证据任务\n\n${notes[module]}\n\n${questions[module].map(([q,o,c,e],i)=>`## ${i+1}. ${q}\n\n${o.map((v,j)=>`${String.fromCharCode(65+j)}. ${v}`).join('\n\n')}\n\n<details><summary>核对答案</summary>\n\n${String.fromCharCode(65+c)}。${e}\n\n</details>`).join('\n\n')}\n\n## 动手产出\n\n${objective}。先记录默认条件，再改变一个条件、核对实际结果、写一句理由。下载自己的 JSON 证据包；不要把默认示范当作自己操作后的结果。\n\n${module==='M88'?'如要求骨架唯一，解释为什么这组数据无法选满 10 个。':module==='M89'?'选择 A 与 F，分别解释第一失败和缺数据暂缓的区别。':'比较 5:2:2:1 与 2:6:1:1；记录榜首与 Top10 重合数量。'}\n`
 const outputs={'slides.json':{slides},'lesson.md':lesson,'assignment.md':assignment,'theories.json':theory,'sections.json':sections,'audio_scripts.json':slides.map(s=>({section_title:s.title,audio_script:s.audio_script}))}
 for(const [name,data] of Object.entries(outputs)){fs.writeFileSync(path.join(dest,name),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n')}
 report.nodes.push({module,node:draft.node,slides:slides.length,files:Object.keys(outputs)})
 for(const [name,sha] of Object.entries(registry.source_sha256))report.source_sha256[`knodes/${draft.node}/${name}`]=sha
}
fs.writeFileSync(path.join(root,'artifacts/molecule-m87-m89-20260909/expected-source.json'),JSON.stringify(report,null,2)+'\n')
console.log('Built isolated release: 3 nodes, 32 slides, 18 aligned content files. No source changes.')
