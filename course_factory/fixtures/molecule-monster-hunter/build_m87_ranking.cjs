// Versioned teaching artifact builder. Original course files are read-only.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const here = __dirname, root = path.resolve(here, '../../..')
const source = path.resolve(root, '../systemeduidea/projects_data/molecule-monster-hunter/knodes/M87-w0-top10')
const snapshot = path.join(here, 'M87-before-ranking-v1')
const hash = data => crypto.createHash('sha256').update(data).digest('hex')
const briefs = [
  ['overview','从 M86 幸存名单，到可解释的 Top10','同一批 ID 从未排序输入变为带贡献的排名','输入原始字段与默认 Top6 并列，五步数据链可见','这一节接住上一节筛选留下的候选。我们沿用 M86 的同一批固定合成数据和幸存 ID，风险与溶解指标不变，另补充明确标注的教学活性分。先统一每列刻度与方向，再按权重计算贡献和总分，最后排序取前十名。左边按 ID 展示，右边才是名次。所有数值都用于理解程序，不是药物效果或安全结论。'],
  ['eligibility','硬约束先筛人，软评分只给幸存者排序','筛选集合是排序输入的必要边界','真实重算 5000→255；被拒 ID 及最先失败规则可追溯','M86 决定谁能进入比较集合，M87 只对这个集合排序。屏幕列出真实运行时被拒绝的教学 ID，以及最先没有通过的规则。就算人为给它们很高的活性分，也不能把它们放回排名。加权可以权衡合格集合内部的差异，却不能替代必要的硬约束。通过这些合成规则，也不代表真实分子已经安全有效。'],
  ['scales','几项分数冲突时，先检查尺度、方向和目标','各指标不能未经声明就直接相加','三行构造数据展示低风险/高活性/高溶解之间的取舍','观察 A、B、C 三个独立教学候选。A 的风险低、活性高，C 的溶解量高，没有一个在每项上都领先。首先检查每列的数值范围，然后检查哪一端更符合本例目标，最后决定该项占多少分量。把几个数都写成零到一，不会自动让它们拥有相同的科学意义，也不表示零点八就是百分之八十的好或安全。'],
  ['normalize','用同一把尺子归一化，再统一偏好方向','同列共同 min/max 与方向翻转','播放/单步计算 10、30、50；切换越大/越小越好，刻度点同步','沿用原文的十、三十、五十数例。所有行都减去同一个最小值十，再除以共同范围四十，就得到零、零点五、一。这不是把不同的数变成一样大。如果原指标越小越好，再用一减去这个结果，原来的十就获得最高偏好分。你可以播放、暂停或单步核对表格和刻度。当整列相同时，不能直接除以零，需要另行约定。'],
  ['weighted','0.81 从哪里来：逐项看见加权贡献','总分是四个非负加权贡献之和','逐项累加 0.45、0.12、0.14、0.10；公式与条形同步','这页保留课文给出的四项偏好分：零点九、零点六、零点七和一。对应权重为零点五、零点二、零点二和零点一。逐项相乘得到零点四五、零点一二、零点一四和零点一零，相加是零点八一。这里零点九已经是低风险偏好分，不是原始毒性。只有给其他候选也计算相同规则的总分，才能比较名次；零点八一不是成功概率。'],
  ['units','只换浓度单位，错误的排行榜为什么会变','未统一刻度时单位会暗中改变指标权重','切换 mg/L 与 g/L；原值加权排序变化，归一化排序不变','这里用独立构造的三行数例做一个检查。把毫克每升换成克每升，浓度本身没有变，只是数字除以一千。如果不统一尺度，原始浓度直接进入总分，就可能让第一名随着单位变化。右边同时换算该列最小值和最大值，归一化后的偏好分和名次保持不变。这说明需要检查尺度，不是声称任何未归一化的数据都一定排错。'],
  ['lab','你来配权重：留下两份真正可比较的 Top10','固定数据与映射，观察权重敏感性','四滑块真实重算 255 行；记录 A、调整 B、写理由、导出两套完整结果','现在使用 M86 的全部二百五十五个幸存教学候选。滑块表示相对分量，页面会除以分量总和，显示实际百分比。先记录方案 A，再只改变权重，观察名次和前十名的重合数量，写一句调整理由后导出 A、B 两份完整证据。权重改变可能影响名次，但不保证每次都会换榜，也不保证某个候选的绝对总分总会上升。四项都是零时，排名会明确停止。'],
  ['pipeline','跟着执行顺序，把整批分数变为 Top10','计算顺序与中间表可检查','播放/暂停/单步：读取、映射、求和、排序、截取；完成才可导出','按照五个步骤观察真实运算的中间结果。第一步读取幸存者，第二步拟合共同范围并统一方向，第三步算各项贡献和总分，第四步对整批候选排序，最后才取前十名。不能先取 ID 最前面的十行再排序。左边代码是对应流程说明，页面实际用 TypeScript 计算；表格和进度同步，播放完成后可以下载默认规则的示范执行记录。'],
  ['audit','榜单能算出来还不够：检查四类边界','极端值、常数、越界、同分/缺失需明确政策','拖动最大值看中间分数压缩；切换边界证据卡','一个程序不报错，并不表示排名设置合理。把最大值拉高，看看三十这个原值在新范围里如何被压缩。常数列没有区分能力，不应该除以零。固定旧范围来了更大的新数据，归一化可能超过一，不能悄悄隐藏。显示都为零点八的两行也可能并非真正同分，所以要按未舍入总分排序。缺失值需要明确处理，本例拒绝计算，不默默补零。'],
  ['handoff','交付排名证据包，把多样性问题留给 M88','排名成果递进到结构多样性审查','导出原始字段/范围/权重/全榜/Top10；声明下一节点所需结构数据','这一节交付的不只是一张榜单，还包括原始输入、共同刻度、方向、实际权重、各项贡献与同分规则。第七页可以下载你自己的权重对比；这里提供的是默认权重的示范包。下一节要检查前十名是否结构过于相似，需要接入经过验证的真实结构或指纹。当前合成 ID 不能直接证明分子多样性，更不能把排名当作药物安全或疗效结论。'],
]
fs.mkdirSync(snapshot, { recursive: true })
const sourceSha = {}
for (const name of ['slides.json','lesson.md','theories.json','sections.json','assignment.md','audio_scripts.json']) {
  const data = fs.readFileSync(path.join(source,name)), dest = path.join(snapshot,name)
  if (fs.existsSync(dest) && !fs.readFileSync(dest).equals(data)) throw new Error('Snapshot changed: '+name)
  if (!fs.existsSync(dest)) fs.writeFileSync(dest,data)
  sourceSha[name] = hash(data)
}
const original = JSON.parse(fs.readFileSync(path.join(source,'slides.json'),'utf8'))
if (original.slides.length !== briefs.length) throw new Error('Unexpected slide count')
const slides = briefs.map(([scene,title,claim,behavior,narration], i) => {
  const old = original.slides[i], p=old.payload||{}
  const anchor=p.theory_id?{kind:'theory',id:p.theory_id}:p.idea_id?{kind:'idea',id:p.idea_id}:null
  return {slide_id:old.slide_id||`M87-slide-${i+1}`,kind:old.kind,title,body_markdown:'',audio_script:narration,audio_path:null,payload:{technical_visual:{renderer:'ranking-evidence',scene,aria_label:title}},...(anchor?{lesson_anchor:anchor}:{})}
})
const registry={project:'molecule-monster-hunter',node:'M87-w0-top10',version:'ranking-v1',status:'implemented-awaiting-browser-QA',source_snapshot:path.relative(root,snapshot),source_sha256:sourceSha,
  sources:['https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.MinMaxScaler.html','https://katex.org/docs/options.html'],
  release_blockers:['Original related lesson/theory/exercise wording must be aligned before release','Updated narration is not voiced; old audio is deliberately unbound'],
  slides:briefs.map(([scene,title,claim,behavior],i)=>({page:i+1,slide_id:slides[i].slide_id,source_slide_id:original.slides[i].slide_id||null,source_index:i,source_title:original.slides[i].title||original.slides[i].payload?.title,teaching_claim:claim,entities:'候选 ID、原始指标、范围、偏好方向、权重、贡献、名次与阶段记录',relationship_and_behavior:behavior,method:'Deterministic interactive DOM + KaTeX/MathML',runtime:'React typed ranking-evidence renderer',scene,fallback:'Readable tables and exact formulas; pause/step controls; no automated motion required',nearest_alternative_rejected:'No source-supported spatial/material question. Raster/3D cannot expose exact weights, scores and ranking changes.',epistemic_status:'M86 seeded synthetic survivors + deterministic added activity; independent toy A/B/C and original 0.81 worked example explicitly separated.',audio:'updated-narration-no-audio'}))}
for(const [name,data] of [['M87-ranking-v1.json',{project:'molecule-monster-hunter',node:'M87-w0-top10',version:'ranking-v1',slides}],['M87-ranking-v1.registry.json',registry]])fs.writeFileSync(path.join(here,name),JSON.stringify(data,null,2)+'\n')
console.log('M87: 10 versioned slides built; original source unchanged')
