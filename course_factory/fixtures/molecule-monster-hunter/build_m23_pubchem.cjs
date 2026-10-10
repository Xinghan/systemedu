const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'../../..'),src=path.resolve(root,'../systemeduidea/projects_data/molecule-monster-hunter/knodes/M23-w0-pubchem-smiles'),snap=path.join(__dirname,'M23-before-pubchem-v1'),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
fs.mkdirSync(snap,{recursive:true});const hashes={};for(const f of ['slides.json','lesson.md','assignment.md','theories.json','sections.json','audio_scripts.json']){if(!fs.existsSync(path.join(snap,f)))fs.copyFileSync(path.join(src,f),path.join(snap,f));hashes[f]=sha(fs.readFileSync(path.join(snap,f)))}
const old=JSON.parse(fs.readFileSync(path.join(snap,'slides.json'))).slides
const rows=[
  [
    "overview",
    "从给定结构到自己取数：为分子库保留来源",
    "M05 和 M06 已经让你能表达、识读给定结构。进入 S2，接下来要自己从公开来源获取结构。以 aspirin 为线索，核对 PubChem CID 2244，再取得原始 SMILES，留下来源链接、字段和取得日期。前一节的分子卡不会自动算作这一节的取数成果。"
  ],
  [
    "names",
    "名字是检索线索，CID 才让你回到具体记录",
    "在六条官方来源的离线教学索引中，观察别名、多个候选和未命中。paracetamol 与 acetaminophen 指向同一个 CID 1983，不是两个分子；一个短词可能出现多个候选，需要核对后选择。教学表没收录不代表 PubChem 没有。乙醇和苯是分子练习例子，不统称药物。"
  ],
  [
    "record",
    "读懂来源字段：CID、SMILES 与取得日期",
    "这是教学字段视图，不是 PubChem 网站截图。现行网页主要显示 SMILES，可包含立体化学和同位素信息；旧 Canonical SMILES 已改称 Connectivity SMILES，只保留连接层。保留你实际看到的字段和原始值，不假设页面位置永远不变。取得日期是你取回数据的日期，不是数据库修改日期。"
  ],
  [
    "syntax",
    "原始写法与规范写法不同，不等于结构不同",
    "检查阿司匹林原始 SMILES 中的双键符号、支链括号和成对环标记。等号说明键级，括号说明分支，环数字闭合连接而不增加原子。RDKit 可以给出另一种规范写法，两者表达同一连接结构。保留原始来源值，另存规范结果；本页只教入门语法，不声称覆盖全部规则。"
  ],
  [
    "trace",
    "逐步看取数证据出现，而不是看图标移动",
    "播放、暂停、单步或重置六个阶段，依次查看检索词、候选、CID、结构字段、RDKit 核验与来源卡。固定样例可离线重复播放，不是实时网络请求。没有候选时，下游没有结构和成功卡。网络打不开与检索未命中是不同问题，不能伪造成功结果。"
  ],
  [
    "workbench",
    "个人取数台：复制、核对、标注，再保存",
    "选择本节目标，必要时请家长协助打开官方记录。复制 CID 与原始 SMILES，填写实际取得日期和字段，然后实际运行 RDKit 核对。标注至少两类语法标记，写自己的识读和来源依据，最后如实声明来源并保存。网页打不开可使用明确标注的离线练习；它不会被标作真实取数完成。这里只查软件数据，不接触或服用物质。"
  ],
  [
    "card",
    "让记录卡说明：来自哪里，核对过什么",
    "读取真正保存的取数卡，重新核验结构与 CID，显示来源方式、链接、原始字符串、标注和本人说明。来源方式是本人声明，系统不能据此证明访问过网页；离线样例明确标为练习。下载 JSON 备份或独立 HTML 卡，方便回查。没有记录时不填默认成果，解释仍需老师复核。"
  ],
  [
    "handoff",
    "把有来源的原始字符串交给变量学习",
    "由你实际保存的原始 SMILES 生成变量模板，逐步显示从记录取字段、赋给 smiles、打印变量的关系。网页上是教学回放，不是在执行 Python。下载完整模板，在自己的 Python 环境运行并留存输出，才是你的运行证据。M24 将继续字符串变量，之后用列表和循环管理更多分子。"
  ]
]
const slides=old.map((s,i)=>({slide_id:s.slide_id||`s${i+1}`,kind:s.kind,title:rows[i][1],audio_script:rows[i][2],audio_path:null,...((s.lesson_anchor||s.payload?.theory_id||s.payload?.idea_id)?{lesson_anchor:s.lesson_anchor||(s.payload.theory_id?{kind:'theory',id:s.payload.theory_id}:{kind:'idea',id:s.payload.idea_id})}:{}),payload:{technical_visual:{renderer:'pubchem-retrieval',scene:rows[i][0],aria_label:rows[i][1]}}}))
const file=path.join(__dirname,'M23-pubchem-v1.json');fs.writeFileSync(file,JSON.stringify({project:'molecule-monster-hunter',node:'M23-w0-pubchem-smiles',slides},null,2)+'\n')
const registry={project:'molecule-monster-hunter',node:'M23-w0-pubchem-smiles',version:'pubchem-v1',status:'integrated-awaiting-browser-qa',production_deployed:false,source_sha256:hashes,draft_sha256:sha(fs.readFileSync(file)),decision_record:'docs/slide-image-prompts/molecule-monster-hunter-M23-pubchem-v1.md',preview_url:'http://127.0.0.1:4173/slide-preview/m23-pubchem',slides:slides.map((s,i)=>({page:i+1,source_index:i,source_slide_id:old[i].slide_id||null,source_title:old[i].title,slide_id:s.slide_id,title:s.title,anchor:s.lesson_anchor,scene:rows[i][0]})),media:{generated_raster_pages:[],interactive_three_pages:[],timed_state_pages:[5,8],actual_rdkit_pages:[1,2,3,4,5,6,7,8]},audio_status:'new narration, unvoiced'}
fs.writeFileSync(path.join(__dirname,'M23-pubchem-v1.registry.json'),JSON.stringify(registry,null,2)+'\n');console.log('M23 8 pages mapped; canonical unchanged.')


