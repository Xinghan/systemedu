const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'../../..'),src=path.resolve(root,'../systemeduidea/projects_data/molecule-monster-hunter/knodes/M06-w0-module'),snap=path.join(__dirname,'M06-before-capstone-v1'),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
fs.mkdirSync(snap,{recursive:true});const hashes={};for(const f of ['slides.json','lesson.md','assignment.md','theories.json','sections.json','audio_scripts.json']){if(!fs.existsSync(path.join(snap,f)))fs.copyFileSync(path.join(src,f),path.join(snap,f));hashes[f]=sha(fs.readFileSync(path.join(snap,f)))}
const old=JSON.parse(fs.readFileSync(path.join(snap,'slides.json'))).slides
const rows=[
  [
    "overview",
    "S1 成品：两张可复核的分子卡",
    "接续 M05 的结构输入，本节交付阿司匹林与对乙酰氨基酚两张分子卡，以及一份可独立打开的报告。每张卡使用同样字段：来源、输入、精确结构、原子计数、官能团和本人说明。示例不自动计入个人成果。"
  ],
  [
    "dataflow",
    "连接对象产生多种证据，不必先画图才能计数",
    "从公开记录确认目标，把 SMILES 输入 RDKit，得到连接对象 Mol。结构绘制、原子与键计数、官能团匹配都可以读取同一个 Mol，不要求先生成图片才计算。把每路输出连同输入、来源和工具版本保存在报告中。"
  ],
  [
    "groups",
    "同样含氧，连接不同就是不同官能团",
    "用真实 SMARTS 规则高亮局部连接。阿司匹林匹配羧基与酯基；对乙酰氨基酚匹配酚羟基与酰胺。看羰基碳邻接的是 OH、O-C 还是 N，不把所有含氮部分都叫普通氨基。规则仅覆盖本节例子，结构识别不能预测药效、安全性或实测溶解度。"
  ],
  [
    "audit",
    "作品自检：每个通过都要有证据",
    "检查缺少来源、无法解析、合法但非目标、计数错误四种样本。修复后重新核验具体字段；未执行不等于通过。点击过页面或勾选所有框不能证明完成。机器核验结构和字段，本人的解释仍需要老师复核。此页故障演示不会写入个人记录。"
  ],
  [
    "trace",
    "观看一条输入变成报告证据",
    "播放、暂停、单步或重置六个步骤，查看来源、输入、解析、计数、官能团、报告字段依次出现。实际结果由浏览器 RDKit 计算，动画仅逐步揭示证据，不代表运行速度、Python 后端或化学反应。选择无效环输入时，解析失败将阻断下游输出。"
  ],
  [
    "workbench",
    "亲自完成两个目标的识读卡",
    "选择目标并输入 SMILES，运行核对结构。第二步填写碳、氮、氧、重原子间键与环数，选择实际存在的官能团。可以查看计数提示并回看匹配页。第三步确认来源、写自己的识读依据与结论边界，再保存。输入或目标变化后需要重新运行。完成两个不同目标才凑齐阶段报告；所有操作仅在软件中进行。"
  ],
  [
    "handoff",
    "带走可以独立打开的双分子报告",
    "重新读取并核验本人保存的两张卡，比较相同字段。下载独立 HTML 报告，里面有真实 RDKit 结构图、来源、计数和本人说明；也可备份 JSON。未完成两张卡时明确标作草稿，不把示例自动当作品。下一阶段把相同字段整理成表，再做批量计算。新讲稿尚未配音，不沿用旧音频。"
  ]
]
const slides=old.map((s,i)=>({slide_id:s.slide_id||`s${i+1}`,kind:s.kind,title:rows[i][1],audio_script:rows[i][2],audio_path:null,...((s.lesson_anchor||s.payload?.theory_id||s.payload?.idea_id)?{lesson_anchor:s.lesson_anchor||(s.payload.theory_id?{kind:'theory',id:s.payload.theory_id}:{kind:'idea',id:s.payload.idea_id})}:{}),payload:{technical_visual:{renderer:'molecule-reading',scene:rows[i][0],aria_label:rows[i][1]}}}))
const file=path.join(__dirname,'M06-capstone-v1.json');fs.writeFileSync(file,JSON.stringify({project:'molecule-monster-hunter',node:'M06-w0-module',slides},null,2)+'\n')
const registry={project:'molecule-monster-hunter',node:'M06-w0-module',version:'capstone-v1',status:'integrated-awaiting-browser-qa',production_deployed:false,source_sha256:hashes,draft_sha256:sha(fs.readFileSync(file)),decision_record:'docs/slide-image-prompts/molecule-monster-hunter-M06-capstone-v1.md',preview_url:'http://127.0.0.1:4173/slide-preview/m06-capstone',slides:slides.map((s,i)=>({page:i+1,source_index:i,source_slide_id:old[i].slide_id||null,source_title:old[i].title,slide_id:s.slide_id,title:s.title,anchor:s.lesson_anchor,scene:rows[i][0]})),media:{generated_raster_pages:[],interactive_three_pages:[],timed_state_pages:[5],actual_rdkit_pages:[1,2,3,4,5,6,7]},audio_status:'new narration, unvoiced'}
fs.writeFileSync(path.join(__dirname,'M06-capstone-v1.registry.json'),JSON.stringify(registry,null,2)+'\n');console.log('M06 7 pages mapped; canonical unchanged.')

