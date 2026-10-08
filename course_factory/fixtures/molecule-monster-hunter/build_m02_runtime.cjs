const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'../../..'),node='M02-w0-rdkit',source=path.resolve(root,'../systemeduidea/projects_data/molecule-monster-hunter/knodes',node),snap=path.join(__dirname,'M02-before-runtime-v1'),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
fs.mkdirSync(snap,{recursive:true});const hashes={}
for(const n of ['slides.json','lesson.md','assignment.md','theories.json','sections.json','audio_scripts.json']){const b=fs.readFileSync(path.join(source,n)),p=path.join(snap,n);if(fs.existsSync(p)&&!fs.readFileSync(p).equals(b))throw Error('Source changed');if(!fs.existsSync(p))fs.writeFileSync(p,b);hashes[n]=sha(b)}
const old=JSON.parse(fs.readFileSync(path.join(snap,'slides.json'))).slides
const records=[
 ['goal','本节交付：一份来自你电脑的运行证据','HTML 成果依赖与实际立项卡','上一节写下研究目标，今天给它准备可用的工具环境。你需要留下自己运行得到的 Python 版本、解释器位置和 RDKit 版本。这不是看见一个成功图标就结束。本网页能演示浏览器版 RDKit，但它不能代替你安装或检查本机 Python。安装软件请家长协助，基础导入成功也不代表后面所有算法都已经验证。'],
 ['places','先看运行位置，再决定把命令写在哪里','HTML 双运行位置代码指南','命令不是不分地方地粘贴。Jupyter 中的百分号 pip 指令使用当前 kernel 的环境；在普通终端，用选定 Python 的减号 m pip 来安装。导入和打印则是 Python 代码。选择两种运行位置，比较相应写法。安装后如有提示就重启 kernel，再导入。不要把普通终端安装指令粘到 Python 的三个大于号后。本页只是说明，没有替你执行安装。'],
 ['library','一个真实库：同一结构输入得到图与数值','RDKit.js 实际结构、版本与描述符','试着切换乙醇、水和一个没有闭合环的错误写法。右侧真的调用网页现有 RDKit.js，生成结构图和平均摩尔质量；无效输入不会得到一个编造的数值。左侧给出对应的 Python 写法，需要先从 RDKit 导入 Chem 和 Descriptors。库提供可复用的功能，不代表它自动完成所有预测任务。右侧版本属于浏览器库，不是你电脑 Python 的版本证据。'],
 ['binding','安装保留在环境里，名字属于当前会话','HTML 环境/会话状态交互','先把包安装到环境 A，再执行 import，查看当前会话里 rdkit 名字出现。接着重启会话：安装记录仍在，但当前名字清空。在同一个会话里，后续单元格可以继续使用已有名字，不是每一格都必须重新导入。换环境可能找不到包，重启解释器则需要恢复导入。本页是有限状态教学对照，不是正在运行 Python。'],
 ['trace','逐步执行：把每次变化与代码对上','定时与单步状态机','用播放、暂停或单步，跟踪安装、导入、读取版本和重启。每一步都同时改变代码位置、环境和会话状态。导入成功通常不会打印任何东西；打印版本才有输出。重启之后包仍保留，重新导入后又能读取版本。这里的版本字符串是固定教学值，整个过程是状态机演示，不是替你运行安装，也不是你的真实版本。'],
 ['terminal','故意犯一次错，再找到正确的修复层','可操作软件诊断练习','先不导入就直接打印，你会在教学模型里看到 NameError，表示当前名字没有定义。再试着只把包装到 B，却在 A 导入，会看到 ModuleNotFoundError，表示当前环境找不到包。先核对环境，再安装或导入，不要一见红字就反复重装。可以重启、新开会话、下载最近二十次教学动作。这是受限指令练习，不是真实 Python 解释器。'],
 ['evidence','运行检查脚本，保存自己的 JSON 证据','Python 脚本 + 自报输出校验/保存/下载','下载脚本，在你自己的 Python 环境里运行，或者把代码粘进 Jupyter。它会打印 Python 版本、解释器路径和 RDKit 版本。把实际 JSON 粘到右边，确认来源后保存并下载。可以遮去路径里的用户名，不要粘密码或完整终端历史。页面只校验格式，不会远程核验，所以成果标注为本人报告、未独立验证。不要把教学版本或网页版本冒充自己的输出。'],
 ['next','把运行记录交给下一节，而不是只留一个勾','本地成果读取与 M03 交接','现在核对本机保存的记录。没有记录，页面会明确显示缺失，不自动填入示例。如果已经保存，带着脚本和截图，在同一个环境继续 M03 的原子与分子学习。基础导入成功只是第一道检查，不是后续每个算法正确的证明。换设备、换环境或重启会话后，要重新核对环境和导入。让每一阶段的产物真正成为下一阶段的输入。'],
]
if(old.length!==8)throw Error('Unexpected source count')
const slides=records.map(([scene,title,medium,audio_script],i)=>{const s=old[i],p=s.payload||{},anchor=s.lesson_anchor||(p.theory_id?{kind:'theory',id:p.theory_id}:p.idea_id?{kind:'idea',id:p.idea_id}:null);return {slide_id:s.slide_id,kind:s.kind,title,body_markdown:'',audio_script,audio_path:null,payload:{technical_visual:{renderer:'rdkit-runtime',scene,aria_label:title}},...(anchor?{lesson_anchor:anchor}:{})}})
const draft={project:'molecule-monster-hunter',node,version:'runtime-v1',slides},txt=JSON.stringify(draft,null,2)+'\n'
fs.writeFileSync(path.join(__dirname,'M02-runtime-v1.json'),txt)
const r={project:draft.project,module:'M02',node,status:'implemented-awaiting-QA',production_deployed:false,source_sha256:hashes,draft_sha256:sha(txt),generated_raster_images:0,interactive_3d_pages:0,actual_rdkit_pages:[3],stepwise_playback_pages:[5],interactive_state_pages:[4,6],preview_url:'http://127.0.0.1:4173/slide-preview/m02-runtime',decision_record:'docs/slide-image-prompts/molecule-monster-hunter-M02-runtime-v1.md',slides:records.map(([scene,title,medium],i)=>({page:i+1,slide_id:slides[i].slide_id,source_title:old[i].title,title,scene,medium,source_anchor:slides[i].lesson_anchor||null,implementation:'rdkit-runtime',pre_generation_decision:`decision_record table row ${i+1}`}))}
fs.writeFileSync(path.join(__dirname,'M02-runtime-v1.registry.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({node,slides:8,source_unchanged:true,sha256:r.draft_sha256}))
