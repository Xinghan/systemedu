# 串起多层漏斗一层层筛掉分子

> Module: M86 · synthesis

> 几千个候选分子, 怎么一层层筛到只剩几个?

> ### 这一步在通向哪 (北极星)
>
> **我们最终要做出的**: 一台分子怪兽猎人工作台——你输入一个分子, 它画出结构、预测属性(好不好溶、有没有毒、能不能成药)、打分排序、给出 go/no-go 的理由, 并从几千个分子里替你筛出最值得试的前十名。
>
> **这一节你亲手做出的那块积木**: 上一节你只有 Lipinski **一道**关卡。这一节你把好几道关卡**串成一条管道**——这就是**多层漏斗**: 5000 个候选先过第一层、活下来的再过第二层、再下一层, 一层层越筛越少。你要**亲手把这条漏斗搭起来跑一遍 5000 个分子**, 记下每一层之后还剩多少个; 再把这一串"剩余数量"画成一张**瀑布图**——一眼看出哪一层砍得最狠、5000 个最后收窄到几个。
>
> **它通向**: 工作台要从几千个分子里替你挑出最值得试的前十名, 靠的就是这条漏斗先把绝大多数明显不行的快速筛掉, 把活下来的少数交给后面更费劲的打分排序。会搭漏斗、会读瀑布图, 你才掌握了整台工作台的主干。
>
> **离终点还差几步**: 在 S5(怪兽挑战)阶段里, 你已经会用 Lipinski 给单个分子打门槛分, 这一节把多道门槛串成完整漏斗。往后还要给活下来的分子加权打分排出 Top10、查多样性、为被拒分子写理由, 最后组装成能跑的 Workbench——离终点就剩这个阶段的最后几步了。

## 学习目标

- 能够说清这一节要回答的问题, 以及**多层漏斗**到底是什么: 把好几道过滤层(每道各管一件事, 像 Lipinski 只管"像不像药")**首尾串成一条管道**, 分子必须**一层层都过**才算活下来; 每过一层就淘汰一批, 越往后剩得越少——这就是为什么叫"漏斗", 上头宽下头窄。
- 能够说清**漏斗里"且"的关系**: 一个分子要留到最后, 必须**每一层都通过**(第一层"且"第二层"且"……); 只要任何一层把它拦下, 它就出局, 后面的层根本轮不到它——这跟"满足任意一条就行"完全相反。
- 能够说清**层为什么要"便宜的排前面"**: 又快又省事的过滤层(像 Lipinski 这种查几个数的规则)放最前面, 先把一大批明显不行的廉价刷掉; 又慢又费劲的判断(像跑模型预测毒性)只对活下来的少数才做, 这样整条漏斗又快又省。
- 能够说清**瀑布图怎么读**: 横着排一层层的关卡, 每一根柱子是过完这一层后**还剩多少个分子**; 柱子一根比一根矮, 一眼看出哪一层砍得最狠、5000 个最后收到几个。
- 能够**照可运行模板亲手搭一条漏斗跑一遍**: 用现成能跑的代码模板把几层过滤(从 Lipinski 起)首尾串起来, 让 5000 个候选流过, 打印每层剩余数量并画出瀑布图(此步标[需家长协助], 只需填空或改 1-2 个参数, 不用从零写代码)。

## 引入：从一道关卡，到一整条流水线

上一节(M85)你学会了用 Lipinski 五规则给一个分子打"门槛分"——查它的几个数(分子量、能不能溶之类)合不合规, 给它盖个"像不像药"的章。可那只是**一道**关卡, 只管一件事。真要从几千个候选分子里挑出值得做实验的那几个, 光靠一道关卡远远不够: Lipinski 说"像药"的分子里, 可能还藏着溶解度太差的、有毒的、跟已知的药长得太像的——这些毛病, Lipinski 一道关卡一个也查不出来, 你得让别的关卡来管。

真实的药物筛选, 干的是这样一件事: 把好几道关卡**首尾接成一条流水线**, 让一大批候选分子从头流到尾。每经过一道关卡, 就刷掉一批不合格的, 活下来的才继续往下走。开头浩浩荡荡几千上万个, 到末尾只剩稀稀拉拉几个——上头宽、下头窄, 活像一只漏斗。科学家们正是这么干的: 上百万个分子从漏斗大口倒进去, 经过一层层过滤, 最后只剩几个真正值得拿去做实验。你这一节要搭的, 就是这套真家伙的小一号版本。这一节要回答的, 就是这条流水线最核心的那个问题: **几千个候选分子, 到底怎么一层层筛到只剩几个?**

## 核心概念：多层漏斗——把关卡串成管道，一层层筛小

漏斗的关键, 在一个"**串**"字。你不是把所有关卡摆一排各管各的, 而是把它们**首尾接起来**: 第一层吐出来的"活着的分子", 正好是第二层的输入; 第二层活下来的再喂给第三层……像水管一节接一节。一个分子想留到最后, 就得**每一层都过**——这是"且"的关系, 任何一层拦下它, 它立刻出局, 后面的层连看都不会看它一眼。正因为每层都只往下传"活着的", 越往后剩得越少, 漏斗才越收越窄。这一点很关键: 每层处理的分子数, 是上一层活下来的那一小撮, 而不是最开头那一大堆, 所以越靠后的层, 要伺候的分子越少、越轻松。

还有个不起眼却很要紧的讲究: **层的顺序**。又快又省的关卡(像 Lipinski 这种查几个数就完事的规则)要放最前面, 先把一大批明显不行的便宜刷掉; 又慢又费劲的判断(像跑模型去预测有没有毒)只留给活下来的少数去做。这样整条漏斗既快又省, 不会把大把工夫浪费在那些早该被便宜关卡刷掉的分子上。漏斗里"且"的确切含义、还有为什么便宜的层一定要排前面, 留到 theory 里给你讲透。

[[THEORY:multilayer_funnel]]

## 深入理解：瀑布图——把每层剩多少画成一串台阶

[[IDEA:anim_1782397902946_szue]]

漏斗跑完, 你手里会攒下一串数: 开头 5000、过完第一层剩多少、第二层剩多少……一直到最后剩几个。光看这串数字不够直观, 这一节给你一张专门画它的图——**瀑布图**。

它的样子很好认: 横着排开一层层的关卡, 每一道关卡头上立一根柱子, 柱子的高矮就是**过完这一层后还剩多少个分子**。因为越往后剩得越少, 柱子就一根比一根矮, 排成一串往下走的台阶, 活像一道一级级往下落的瀑布——名字就是这么来的。这张图最妙的是一眼能看出**哪一层砍得最狠**——哪两根柱子之间跌得最猛, 就是中间那道关卡刷掉的分子最多; 也能头尾一对比, 一眼读出 5000 个浩浩荡荡进去, 最后收窄到了几个。瀑布图怎么一根根柱子去读、每一段台阶的落差到底意味着什么, 留到 theory 里带你看。

[[THEORY:funnel_waterfall_chart]]

[[IDEA:game_1782397902946_pcnk]]

## 推荐视频

[![High Throughput Screening Explained Simply (5 Minutes)](https://img.youtube.com/vi/pfGotbOYzHs/hqdefault.jpg)](https://www.youtube.com/watch?v=pfGotbOYzHs)
[![High-throughput screening](https://img.youtube.com/vi/wN6-2kjKlwE/hqdefault.jpg)](https://www.youtube.com/watch?v=wN6-2kjKlwE)

## 应用与拓展

[[IDEA:ex_1782397902946_wpnc]]

这一节你要**亲手搭一条多层漏斗、跑一遍 5000 个候选分子、画出瀑布图**:

1. **说清漏斗是什么**: 不看书, 讲清多层漏斗就是把几道关卡首尾串成管道, 分子必须每一层都过(且的关系)才活下来, 越往后剩得越少。
2. **照模板搭漏斗**: 用现成能跑的代码模板, 把 Lipinski 等几层过滤首尾串起来, 让 5000 个候选分子从头流到尾([需家长协助]跑代码)。
3. **记下每层剩余**: 让模板打印每过一层之后还剩多少个分子, 从 5000 一路记到最后剩几个。
4. **画并读瀑布图**: 让模板把这串剩余数量画成瀑布图, 在图上指出哪一层砍得最狠(落差最大的那段台阶)、5000 个最后收窄到几个; 想一想, 如果某层砍得太狠会不会误杀好分子、某层几乎没砍是不是白站一岗。
5. 在卡片上写一句: **多层漏斗就是把几道关卡首尾串成管道, 分子要每一层都过(且)才活下来, 越往后越少; 便宜快的层排前面先刷掉一大批; 瀑布图的每根柱子是过完那层后的剩余数量, 一眼看出哪层砍得最狠、5000 个最后收到几个。**

完成标志: 你能讲清多层漏斗和"且"的关系、便宜层为什么排前面, 能照模板把几层串成漏斗跑完 5000 个分子, 打印出每层剩余, 并画出瀑布图、读出哪层砍得最狠和最终剩几个。能讲清这几点、跑出这条漏斗、读懂这张瀑布图, 你就把整台工作台最核心的那条主干, 亲手搭起来了。

## 学习路径建议

到这儿, 你已经亲手搭起了整台工作台最核心的那条主干: 一条把好几道关卡首尾串成的多层漏斗, 能让几千个候选分子一层层筛到只剩几个, 还能用瀑布图一眼看清每一层各砍掉了多少、最后收到几个。**接下来**, 你会把活到漏斗末尾的这少数分子, 用加权打分排出 Top10——漏斗负责"快速去掉一大堆明显不行的", 打分负责"在活下来的里头精挑细选", 一粗一精, 两步接上, 那台能从几千个分子里替你选出前十名的最终工作台, 就快成形了。

## 延伸阅读

> 以下资料由系统自动检索并筛选，供深入研究参考：

- [**Virtual Screening for Drug Discovery: A Complete Guide**](https://www.technologynetworks.com/drug-discovery/articles/what-is-virtual-screening-in-drug-discovery-407347) — Virtual screening is a funnel strategy: a large compound library is filtered in consecutive computational steps, progressively narrowing an extensive library down to the most promising hits. Cheap, fa
- [**First fully-automated AI/ML virtual screening cascade implemented at a drug discovery centre in Africa (Nature Communications)**](https://www.nature.com/articles/s41467-023-41512-2) — Describes a real virtual screening cascade: multiple models chained for key decision-making assays (phenotypic activity, cytotoxicity, aqueous solubility, permeability, metabolic stability, CYP inhibi
- [**Drug Development Funnel (Storytelling With Data)**](https://community.storytellingwithdata.com/challenges/jun-2024-make-a-funnel-chart/drug-development-funnel) — Canonical attrition numbers for the drug discovery funnel: ~1,000,000 molecules at target identification, narrowing to ~10,000 at compound screening, 250 at hit validation, 50 at lead optimization, 5 
- [**Virtual-screening workflow tutorials and prospective results from the Teach-Discover-Treat competition 2014 against malaria (PMC)**](https://pmc.ncbi.nlm.nih.gov/articles/PMC5580409/) — Worked malaria example with concrete per-stage counts: start ~5.5 million commercial compounds; after property filters ~4.4 million remain; the top-ranked ~10,000 are taken forward for further selecti
- [**Hit to Lead Assays: Accelerating Early Drug Discovery (BellBrook Labs)**](https://bellbrooklabs.com/hit-to-lead-assays/) — Hit-to-lead pipeline: HTS hits pass through staged assays for activity, selectivity, then early ADMET (solubility, permeability, metabolic stability, CYP inhibition). Early stages prioritize throughpu
