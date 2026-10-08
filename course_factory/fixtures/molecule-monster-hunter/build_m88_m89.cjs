const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'../../..')
const data={
M88:{node:'M88-w0-tanimoto-top10-scaffold',renderer:'diversity-evidence',rows:[
['overview','给 Top10 加上可检查的结构证据','这一节接着综合排名的方法，检查名单的结构覆盖。M87 使用的合成 ID 没有分子结构，所以这里明确切换到十六个简单结构的独立教学池，不能假装它们就是上节的真实候选。结构由 RDKit 验证，指纹和骨架由程序计算，分数只是教学设置。对比左右两组结构，观察选择顺序改变后，哪些连接模式进入了名单。'],
['concentration','十个高分名额，覆盖了几类骨架？','先把原来的前十名结构真正摊开。前八个都有苯环骨架，但侧基不同，因此它们不是同一个分子。用骨架分组可以发现名单是否集中，不过相似结构也可能产生不同实验结果，不能认为试一个就等于试了全部。今天想改善的是结构覆盖，不能把没选中的候选说成无效或很差。'],
['tradeoff','分数和结构覆盖，是两种不同的比较','左边按固定教学分取前十名，右边按多样性策略挑选。每个结构的原始分数没有改变，改变的只是集合。增加骨架唯一限制后，这个池里只能选出九个，因为总共只有九种骨架。记录实际数量和平均分，体会覆盖与分数之间的取舍；不能保证某个策略每次都同时提高二者，也不能强行补足不符合约束的第十个。'],
['fingerprint','点击相似度矩阵，回到具体结构','矩阵的行和列都是候选 ID，每个格子是两个 Morgan 指纹的 Tanimoto 相似度。对角线是自己和自己，数值是一。颜色较深代表本指纹设置下相似度较高。点击格子看对应结构，检查这个数在比较什么。它依赖指纹类型、半径和位数，不是实验活性相同的概率，也不能把二维矩阵当作真实三维距离图。'],
['scaffold','同骨架，不等于指纹完全相同','选择两个结构，先看完整分子，再切换成 Murcko 骨架。比如甲苯和乙苯保留相同的苯环骨架，但侧链不同，Morgan 指纹也不完全一样。公式中的分子是共同开启的位数，分母是并集开启的位数；页面展示实际计算的计数。骨架只是在这一提取定义下的分组，不是所有化学家族的唯一分类，也不保证相同性能。'],
['maxmin','先找最近邻，再选择离最近邻最远的候选','把相似度转换成距离，一减去 Tanimoto 就得到这里使用的距离。对于每个未选候选，先找它到已选集合的最小距离，再从这些最小距离里挑最大的。表格同时给出它对两位已选者的相似度，所以你能检查为什么不能只比较榜首。等距离时采用教学分优先、再按 ID 的确定规则。这个贪心方法不保证全局最优。'],
['trace','逐轮观察 MaxMin 怎样扩展名单','第一轮固定教学分最高的 D01 当种子。之后每一轮，都重新计算余下候选到当前全部已选者的最近距离，选择其中最大的一个。播放时观察当前加入的结构、最近邻、距离和已选数量一起变化；也可以暂停后单步核对。这是实际模型运算，不是预画的移动箭头。普通 MaxMin 不自动附带骨架唯一或相似度硬阈值。'],
['lab','改变约束，导出你自己的多样性名单','现在由你设置想选几个，并决定是否增加最大相似度和骨架唯一约束。默认没有额外限制，就是普通 MaxMin。调严条件后，观察实际选出的数量和两两相似度；如果不能继续补位，程序会诚实保留较少的结果，不强行凑满。写一句解释，再下载包含输入结构、指纹设置、选择步骤和结果的证据包。它可以和分数基线比较。'],
['code','固定结构、指纹参数和首选种子','这页给出使用 Python RDKit 的方法模板。必须先验证所有 SMILES，再用相同的 Morgan 设置计算指纹；输入按分数排序，并显式指定第一项作为种子。普通 LazyBitVectorPick 接口按数量选择，没有相似度阈值参数。带阈值的接口使用距离，不能把零点七相似度直接当成零点七距离。页面本身用 TypeScript 计算，示例代码没有在浏览器运行。'],
['report','交出前后名单，并解释一次替换','把原分数榜单和默认多样性结果并排比较，选一个不再入选的 ID，说明它的分数并没有变，名单为什么选择了别的结构。普通 MaxMin 未选中不一定意味着它超过某个阈值，只能报告实际策略和比较证据。写好结论后导出本页的默认对比；如果你在上一活动调整过参数，请在那里导出自己的实际结果。'],
['handoff','把结构选择证据交给最终报告','M88 的成果包括输入结构和分数、指纹与骨架、选择政策、每轮选择证据以及最终名单。没有达到目标数量时也要保留真实数量。下一节把视线转回被硬规则拒绝的候选，为它们写可复核的理由。硬规则失败、排名靠后、多样性未选中，是三个不同概念，报告中不能混为一谈，更不能把教学名单当作真实药物建议。']
]},
M89:{node:'M89-w0-module',renderer:'rejection-evidence',rows:[
['overview','让每一次规则拒绝，都留下可复核证据','这节为筛选结果补上执行记录。我们使用原文数值扩展的六行独立教学示例，按分子量、logP、氢键供体和受体依次检查。候选 A 的分子量六百一十二，超过本次上限五百，所以第一步就停止，差值是一百一十二克每摩尔。理由要带规则、实际值、阈值和顺序；它解释本次政策，不能证明分子天生不好。'],
['transparent','从一个“未通过”，还原到具体规则和数值','左边的名单只有结果，没有告诉读者哪条规则进行了什么比较。右边给同一批候选补上首个失败项和具体数值，别人就可以用输入重新核对。这里说的黑箱，是结果对读者缺少依据，并不是说固定阈值算法本身不可理解。保留执行记录让筛选更容易检查，但有理由也不等于规则的科学依据已经得到证明。'],
['audit','理由分布变化，先检查数据和执行顺序','统计每个第一失败理由的数量，可以帮助定位需要检查的地方。试着把 logP 放在分子量前面，候选 A 的第一理由就改变了，而它仍然没有通过。这说明理由分布同时受到规则顺序和数据组成影响。不能因为某类拒绝很多，就断言阈值太严、立即放松；要结合任务目标、数据质量和验证证据判断。'],
['reason','一句好理由：规则、比较、差值与结论范围','逐步加入四层信息：先点名规则，再展示实际值和上限，然后算出差值，最后说明结论只适用于本次政策。六百一十二减五百等于一百一十二，单位是克每摩尔。这里的数来自教学构造，不能写成实测。规则动机可以另行解释，但不能从一个 logP 超界就断言某分子一定难溶、有毒或无效。'],
['short-circuit','第一道失败，不是最严重的问题','候选 A 同时有几项超界。按分子量优先时，第一步失败就退出；交换前两条规则，首个失败变成 logP。公式取的是执行顺序中第一个不通过的位置，并不是比较哪项越界最严重。短路之后的状态是没有执行，而不是通过。保存理由时还应保存顺序，否则别人不能复现同一条执行轨迹。'],
['all-checks','原始短路记录，与另行完整诊断要分开','在短路模式，A 的第一条规则失败，后续没有执行判断。点击完整诊断后，程序才另外运行全部四条规则，并能报告所有结果。完整诊断本身没有错，错误是没做却声称已经查过。输入里存在某个字段，也不等于这个规则在原始轨迹里被执行了。两种模式要有清楚标签，让读者知道证据是怎么得到的。'],
['pipeline','读取、检查、返回，再汇总整批理由','一条可解释的程序先读取候选和固定规则顺序，再逐项比较。遇到缺失值就返回暂缓，遇到第一个超界就返回拒绝，只有全部检查通过才返回本次政策通过。最后把每个候选的输入、规则、状态与理由汇总。左侧 Python 风格片段只是对应流程说明，页面的表格由 TypeScript 计算，不假装执行了 Python。'],
['trace','观察 B 如何通过第一关、停在第二关','先看候选 B：分子量三百二十，没有超过五百，因此进入 logP；五点二超过五，在第二步停止。后面的氢键规则没有执行。切换 A，会看到第一步就停止；切换 E，它正好等于四项上限，按本例小于等于条件可以通过。F 的 logP 缺失，结果是暂缓判断，不把缺数据填零后假装通过。'],
['lab','亲手完成检查，写下你的拒绝理由解释','选择一个候选，先单步执行或播放检查过程，看到实际结束状态后，再写一句话解释为什么报告这一处。对于 A，要说明原轨迹只到第一失败；对于 F，要说明缺少数据需要补充，而不是证明实验失败。完成过程并填写解释后，可以下载你选中候选的输入、规则顺序、每步状态和个人说明。'],
['batch','让整批候选都有带状态的理由记录','同一套规则用于六个教学候选。前四个分别在不同位置失败，E 按本次政策通过，F 缺数据而暂缓。切换顺序会重算整批轨迹，不能只修改一句显示文本。写下你对顺序短路的解释，再导出报告；报告保存全部输入和顺序，使别人能真正复算。不能把通过、被拒和暂缓混成两个简单标签。'],
['handoff','把拒绝、暂缓与未入选，交给不同的报告栏','这一节交出带规则版本、输入值、执行顺序和实际状态的理由记录。最终工作台还要把硬规则失败、缺数据、排名靠后和多样性未选中分开陈述。它们来自不同步骤，不能统一写成分子不好。M90 再把这些记录与前面的评分和结构选择拼起来，形成完整教学报告；任何真实药物结论仍需要独立的实验和专业验证。']
]}}
const files=['slides.json','lesson.md','assignment.md','theories.json','sections.json','audio_scripts.json']
for(const [module,d] of Object.entries(data)){
 const source=path.resolve(root,'../systemeduidea/projects_data/molecule-monster-hunter/knodes',d.node),snap=path.join(__dirname,`${module}-before-evidence-v1`)
 fs.mkdirSync(snap,{recursive:true});const hashes={}
 for(const name of files){const bytes=fs.readFileSync(path.join(source,name));const target=path.join(snap,name);if(fs.existsSync(target)&&!fs.readFileSync(target).equals(bytes))throw Error('Source snapshot mismatch');if(!fs.existsSync(target))fs.writeFileSync(target,bytes);hashes[name]=crypto.createHash('sha256').update(bytes).digest('hex')}
 const old=JSON.parse(fs.readFileSync(path.join(snap,'slides.json'))).slides
 if(old.length!==d.rows.length)throw Error('Page count mismatch')
 const slides=d.rows.map(([scene,title,narration],i)=>{const p=old[i].payload||{},anchor=p.theory_id?{kind:'theory',id:p.theory_id}:p.idea_id?{kind:'idea',id:p.idea_id}:null;return {slide_id:old[i].slide_id,kind:old[i].kind,title,body_markdown:'',audio_script:narration,audio_path:null,payload:{technical_visual:{renderer:d.renderer,scene,aria_label:title}},...(anchor?{lesson_anchor:anchor}:{})}})
 fs.writeFileSync(path.join(__dirname,`${module}-evidence-v1.json`),JSON.stringify({project:'molecule-monster-hunter',node:d.node,version:'evidence-v1',slides},null,2)+'\n')
 const registry={project:'molecule-monster-hunter',module,node:d.node,status:'implemented-awaiting-QA',source_sha256:hashes,slides:slides.map((s,i)=>({page:i+1,source_id:old[i].slide_id,source_title:old[i].title||old[i].payload?.title,slide_id:s.slide_id,teaching_claim:s.title,entities:module==='M88'?'SMILES、Morgan 位集、Murcko 骨架、相似度、分数、已选集合':'候选字段、规则顺序、上限、执行状态、第一失败与理由',method:module==='M88'?'RDKit exact 2D + KaTeX + deterministic selection':'Exact DOM tables + KaTeX + actual rule execution',scene:s.payload.technical_visual.scene,learner_action:'inspect evidence; where controls exist, step/recompute/compare/export',fallback:'Exact static structures, tables, formulas and narration; no GPU or remote asset required',nearest_alternative:'Raster and 3D do not establish exact fingerprint similarity or rule execution; no spatial pose is claimed.',provenance:module==='M88'?'Local RDKit 2026.03.3 on constructed simple structures; synthetic scores; separate from M87 IDs':'Source numeric examples extended to six labelled teaching rows; not measured observations'}))}
 fs.writeFileSync(path.join(__dirname,`${module}-evidence-v1.registry.json`),JSON.stringify(registry,null,2)+'\n')
}
console.log('M88 and M89: 22 slides, stable source IDs and fresh unvoiced narration')
