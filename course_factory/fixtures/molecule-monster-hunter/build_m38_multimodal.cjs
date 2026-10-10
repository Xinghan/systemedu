const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const root = path.resolve(__dirname, '../../..'), node = 'M38-w0-rdkit-logp'
const source = path.resolve(root, '../systemeduidea/projects_data/molecule-monster-hunter/knodes', node)
const snapshot = path.join(__dirname, 'M38-before-multimodal-v1')
const hash = b => crypto.createHash('sha256').update(b).digest('hex')
fs.mkdirSync(snapshot, { recursive: true })
const hashes = {}
for (const name of ['slides.json','lesson.md','assignment.md','theories.json','sections.json','audio_scripts.json']) {
  const bytes = fs.readFileSync(path.join(source, name)), target = path.join(snapshot, name)
  if (fs.existsSync(target) && !fs.readFileSync(target).equals(bytes)) throw Error('Source snapshot changed: ' + name)
  if (!fs.existsSync(target)) fs.writeFileSync(target, bytes)
  hashes[name] = hash(bytes)
}
const rows = [
  ['overview','先看见分层，再定义 LogP','生成图片 + HTML','对比左边搅拌后分散的油滴和右边静置后形成的上层油。分散不等于溶解。这是一张生成的定性示意图，不是实验照片，也没有量出任何浓度。厨房里的食用油和水帮助我们建立直觉，但正式的 LogP 使用正辛醇和水，比较同一种溶质在两相中的平衡浓度。接下来用三维模型观察，再把关系写成可计算的数。'],
  ['phases','剖开容器：液层位置与溶质偏好是两件事','Three.js 3D','这是可以拖动旋转的真实三维教学物体，不是静态效果图。金色表示正辛醇相，蓝色表示水相，颜色只用于区分。剖开外壁、切换正视和俯视，检查界面和容器内部。此页固定 logP 为零，所以两相浓度相等；改变上层体积后，溶质在上层的总量会变，但浓度仍相等。不能把“上层有更多”直接当成更亲油。'],
  ['partition','改变 logP，看两相浓度怎样一起变化','Three.js 3D + KaTeX','拖动 logP，观察三维容器内的示踪份额和右边的浓度表同步改变。模型固定水相十毫升、溶质总量十微摩尔。logP 为一时，正辛醇相浓度是水相的十倍；为负一时，则是十分之一。改变正辛醇体积后，两相物质的量重新分配，总量仍守恒。本模型假设稀溶液、未电离溶质、已经平衡，不模拟达到平衡需要多久。'],
  ['scale','每增加一个 logP 单位，浓度比乘十','HTML + KaTeX','P 是浓度之比，logP 是这个比值以十为底的对数。点击负一、零和一，分别对应十分之一、一和十。零代表两相浓度相等，不意味着任意体积条件下两边数量相同。这个指标也不是水溶解度本身，不能单靠它判断药物是否安全或有效。'],
  ['ordering','让真实计算值决定三个分子的位置','RDKit + 动态 HTML','逐步把正辛烷、乙醇和葡萄糖示例放上同一条数轴。数值由 RDKit 的 Crippen 方法计算，分子结构由 RDKit 精确绘制。正辛烷约三点三七，乙醇接近零但略为负数，葡萄糖示例约负三点二二。右边显示当前结构，左边保留已经加入的记录。这是三个教学示例，不是全库统计。'],
  ['code','同一循环，给每一行补上 cLogP 字段','HTML 逐步执行记录','跟随计算记录，从 SMILES 解析有效分子，然后调用 MolLogP，把结果放回同一行。遇到无效输入应该报告错误，不能填零蒙混过去。网页逐行展示事先由本地 RDKit 核对过的结果，旁边的 Python 模板供课后运行，并没有在网页里执行 Python。结果是计算的 cLogP，不是真实油水浓度测量。'],
  ['exercise','由你把三个分子按 cLogP 排好','交互 HTML','用左侧同一方法的数值，从最偏向正辛醇相到最偏向水相排序。每个分子只能出现一次。先比较正数和负数，再比较两个负数的大小。点击检查，确认自己的依据是数值，而不是结构图大小，也不是看到含氧就直接猜答案。'],
  ['distribution','从三行记录到可复核的分布图','HTML 数据表与直方图','直方图每个柱子都应该能回到输入记录。这张图只使用课文中的三个教学示例，区间计数之和必须是三。乙醇的值是负零点零零一四，仍在负二到零的区间，不能先四舍五入成零再分组。扩展到你自己的全库时，要记录真实的有效行数、失败数和计算方法，不用这三行冒充整个分子库。'],
  ['evidence','计算值、生成示意和实测证据分开写','生成图片 + RDKit + HTML','左边的结构和数值来自 RDKit 计算，右边的油水图来自生成工具，只能解释分散和分层。两者都没有测量某种溶质的两相浓度。真正的测量需要规定条件、达到两相平衡，再用分析方法读出浓度。我们可以用估计值排序和学习，但必须把它的来源写清楚，不能把画得逼真的图片当作实验记录。'],
  ['handoff','把分子量和 cLogP 接成同一张证据表','HTML 证据与导出','本节新增的是 cLogP 字段，不是把原来的分子量替换掉。每一行仍对应同一个 SMILES，列上写清单位、计算方法和证据类型。这里可以下载三个示例的教学证据；你自己的作业需要运行课文模板、处理自己的数据并说明结果。下一步继续增加描述符，把这些列拼成特征矩阵，交给后续筛选流程。'],
]
const old = JSON.parse(fs.readFileSync(path.join(snapshot, 'slides.json'))).slides
if (old.length !== rows.length) throw Error('Page count changed')
const slides = rows.map(([scene,title,medium,audio_script],i)=>{
  const p = old[i].payload || {}
  const anchor = old[i].lesson_anchor || (p.theory_id ? {kind:'theory',id:p.theory_id} : p.idea_id ? {kind:'idea',id:p.idea_id} : null)
  return {slide_id:old[i].slide_id || `M38-slide-${i+1}`,kind:old[i].kind,title,body_markdown:'',audio_script,audio_path:null,payload:{technical_visual:{renderer:'logp-lab',scene,aria_label:title}},...(anchor?{lesson_anchor:anchor}:{})}
})
const asset = 'packages/student-web/public/slide-assets/molecule-monster-hunter/M38/oil-water-comparison-v1.webp'
const registry = {project:'molecule-monster-hunter',module:'M38',node,version:'multimodal-v1',status:'implemented-awaiting-QA',production_deployed:false,source_sha256:hashes,generated_raster_images:1,interactive_3d_pages:2,assets:[{path:asset,sha256:hash(fs.readFileSync(path.join(root,asset))),bytes:fs.statSync(path.join(root,asset)).size,kind:'generated-raster',pages:[1,9]}],slides:rows.map(([scene,title,medium],i)=>({page:i+1,source_id:slides[i].slide_id,source_title:old[i].title,slide_id:slides[i].slide_id,scene,teaching_claim:title,medium,source_anchor:slides[i].lesson_anchor||null,implementation:'logp-lab',nearest_alternative:[1,2].includes(i)?'Flat diagrams obscure the vessel interior and phase-volume relationship; Three.js makes those inspectable.':[0,8].includes(i)?'A lone icon cannot show the material distinction between dispersed droplets and a continuous upper layer.':'Generated pixels or 3D do not improve exact numeric, structure, code or record comparison.',provenance:[1,2].includes(i)?'Procedural fixed-radius vessel, volume-proportional liquid heights; neutral dilute equilibrium mass balance, idealized conditions.':[0,8].includes(i)?'Built-in image_gen, qualitative illustration; exact labels in DOM.':'RDKit.js 2025.3.4-1.0.0 verified three source structures; no experimental data.',fallback:[1,2].includes(i)?'Explicit 2D cross-section plus the same model readouts; not reported as 3D if WebGL is unavailable.':'Exact DOM text, SMILES, data and narration.'}))}
fs.writeFileSync(path.join(__dirname,'M38-multimodal-v1.json'),JSON.stringify({project:registry.project,node,version:registry.version,slides},null,2)+'\n')
fs.writeFileSync(path.join(__dirname,'M38-multimodal-v1.registry.json'),JSON.stringify(registry,null,2)+'\n')
console.log(JSON.stringify({slides:slides.length,generated_images:1,threejs_pages:[2,3],source_unchanged:true,image_bytes:registry.assets[0].bytes}))
