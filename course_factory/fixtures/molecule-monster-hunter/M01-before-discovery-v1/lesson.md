# 看真药故事，写一张“我要打的分子怪兽”立项卡

> Module: M01 · foundation

> “分子怪兽”是什么, 我这个分子猎人到底要做出什么东西?

> ### 这一步在通向哪 (北极星)
>
> **我们最终要做出的**: 一个能跑的“分子怪兽猎人工作台”——你给它输入一个分子的写法(一串叫 SMILES 的字符), 它就回给你这个分子的结构图、预测它好不好溶、有没有毒、能不能成药, 给它打一个候选分, 写清楚“为什么留它、为什么拒它”, 最后给一句“值得继续研究 / 不值得”的建议。
>
> **这一节你亲手做出的那块积木**: 一张**项目立项卡**——写清楚“我这个分子猎人要打的怪兽是什么样的坏分子、我最后要交出什么东西、我要让电脑帮我预测哪几件事”。这是整趟旅程的第一块基石。
>
> **它通向**: 这张立项卡定下了你 90 节后要交付的五样东西(干净分子库 / 特征表 / 诚实的预测模型 / Top10 候选报告 / 能跑的工作台)的总目标, 后面每一节都在往这张卡上的目标靠近。
>
> **离终点还差几步**: 这是**第 1 关**, 整个 S1“分子世界”阶段才刚开门。你离“亲手画出第一个分子”还有 21 步, 但这一步最重要——先看清楚要去哪。

## 学习目标

- 能够用自己的话说清楚“AI 药物发现”大概在做什么: **不是在试管里配药, 而是让电脑从成千上万个分子里, 帮人类挑出几个最值得去实验室试的候选**。
- 能够说出“一个分子怎么会治病、又怎么会有毒”的直觉: 分子像一把把形状不同的钥匙, 找对了形状就能锁住身体里那个捣乱的“怪兽”。
- 能够亲手写出一张**项目立项卡**, 在卡上写清三件事: 我要打的怪兽是什么、我最后要交出什么、我要让电脑预测哪几件事。
- 能够老实地理解一条贯穿全课的诚实规矩: **AI 不会变魔术凭空造出新药, 它只是帮我们把要试的分子从几千个缩小到几个**——它缩小搜索范围, 不替代真实验。

## 引入：一个“分子怪兽”正在捣乱

想象身体里有一台精密的小机器在好好运转, 突然来了一个捣乱的坏分子——比如一个让细胞乱长的蛋白质, 它像一只“分子怪兽”, 卡住了机器的关键齿轮。要制服它, 我们需要一把**分子钥匙**: 一个形状刚好能扣住怪兽弱点、让它没法再捣乱的小分子。

可问题来了: 世界上可能的小分子, 多到比天上的星星还多。一个一个去实验室合成、测试, 要花十几年、烧掉很多很多钱。**这就是这门课要回答的核心问题——“分子怪兽”是什么, 我这个分子猎人到底要做出什么东西?**

这正是 Insilico Medicine、Atomwise 这些真实公司在做的事: 他们不是先冲进实验室乱试, 而是**先让电脑(AI)在海量分子里筛一遍**, 把最像“好钥匙”的几个挑出来, 人类化学家再只去试这几个。十几年的活, 有时几个月就能缩短一大截。你这门课, 就是要亲手搭一个**简化但真实**的同款工具。

## 核心概念：AI 药物发现，到底在“猎”什么

我们先把这门课要做的事, 浓缩成一句大白话: **从一大堆分子里, 用电脑帮忙, 挑出几个最值得去实验室试的“候选药”。**

这里面藏着三个关键角色, 你这个“分子猎人”要全程打交道:

**第一, 怪兽(靶点)。** 它是身体里那个捣乱的坏蛋(通常是一个蛋白质)。我们要找的钥匙, 就是去对付它的。

**第二, 候选钥匙(分子)。** 成千上万个待选的小分子, 每一个都可能是、也可能不是那把对的钥匙。它们有的太大插不进锁, 有的会顺便毒到身体别的地方, 有的根本溶不进血里送不到该去的地方。

**第三, 猎人的本事(AI 模型)。** 这就是你要亲手训练的东西: 让电脑学会**看一眼分子、就预测它好不好、值不值得试**。它学的不是魔法, 是规律——看过足够多“好分子”和“坏分子”的例子后, 它能对新分子给出一个有根据的猜测。

[[THEORY:what_is_ai_drug_discovery]]

## 深入理解：诚实是这门课的底色——AI 只是“缩小范围”

[[IDEA:anim_1781593352281_qnil]]

这一节最重要、也最该记一辈子的一句话是: **AI 不会凭空发明出一种新药, 它做的是把要试的范围缩小。**

打个比方。你要在一片有一万颗石头的沙滩上找那几颗真正的宝石。笨办法是一颗颗捡起来用仪器测, 测一万次。聪明办法是: 先训练一双“好眼力”(这就是 AI 模型), 让它远远扫一眼, 把九千九百颗一看就不是的石头先排掉, 只把剩下那一百颗最可疑的, 拿去仪器仔细测。**AI 没有替你做最终判断, 它只是帮你把活儿从一万次砍到一百次。** 最后那几颗到底是不是真宝石, 还得靠真实的仪器(真实验室)去验。

为什么一开始就要把这条规矩讲清楚? 因为后面你会亲手训练模型、会看到它给分子打分。**到那时候你必须诚实**: 模型说“这个有 80% 把握是好的”, 不等于它就是好药——它只是值得优先去试。你这趟旅程会反复练这种诚实: 永远报真实的成绩, 永远说清“这只是缩小了范围, 不是给了答案”。这也是你这一节要在立项卡上亲手写下、并贯穿到最后一节的那条底线。

[[THEORY:narrow_the_search_honesty]]

[[IDEA:game_1781593352281_bjjh]]

## 推荐视频

[![AI's drug discovery boom: The R&D bottleneck explained - YouTube](https://img.youtube.com/vi/Xsgihhv_NlM/hqdefault.jpg)](https://www.youtube.com/watch?v=Xsgihhv_NlM)
[![Machines Can Now Discover Drugs. Are They Better?](https://img.youtube.com/vi/QfTtfL2k3AM/hqdefault.jpg)](https://www.youtube.com/watch?v=QfTtfL2k3AM)

## 应用与拓展

[[IDEA:ex_1781593352281_dhnf]]

这一节你要亲手做出的交付物, 就是一张**项目立项卡**。它不需要联网、不需要写代码, 只需要你静下心来想清楚、写下来。卡上写三块:

1. **我要打的怪兽**: 用一两句话描述你想对付的是什么样的坏分子/坏蛋白(可以先用课程给的“怪兽靶点”设定, 也可以写你自己好奇的一种病)。
2. **我最后要交出什么**: 照着北极星, 写下你 90 节后要做出的东西——一个能输入分子、输出预测和建议的“分子猎人工作台”, 外加一份挑出 Top10 候选的报告。
3. **我要让电脑预测哪几件事**: 写下你想让 AI 帮你预测的属性, 比如“这个分子好不好溶”“有没有毒”“像不像一颗能吃的药”。

完成标志: 一张**写清了“怪兽 / 交付物 / 要预测什么”三块、并写下了那句诚实底线(AI 只缩小范围、不替代真实验)**的立项卡。把它存好, 这是你整个项目的起点和总目标。

## 学习路径建议

写完立项卡, 你就正式接下了“分子猎人”这份委托。但要真动手, 你得先有趁手的工具。**下一节(M02), 我们就给电脑装上一个专门用来算化学、画分子的工具包 RDKit**, 跑通第一行命令, 让它打印出自己的版本号——那是你和这套真实工具的第一次握手。从那以后, 你就能慢慢让电脑替你“看”分子了。

## 延伸阅读

> 以下资料由系统自动检索并筛选，供深入研究参考：

- [**Insilico Medicine: Main**](https://insilico.com) — Generative AI Software for Drug Discovery, Scientific Research & Sustainability. [SOFTWARE FOR SCIENCE](https://pharma.ai). Insilico Medicine 2-page overview. [Enroll for Free](https://insilico-medici
- [**10 Years vs. Months: How AI is Saving Lives by Revolutionizing ...**](https://www.instagram.com/reel/DTzEYyniMQl) — Insilico Medicine, and Recursion Pharma are already using AI to accelerate drug discovery. Insilico Medicine, Atomwise, Recursion, are building
- [**Artificial Intelligence (AI) Applications in Drug Discovery and ... - PMC**](https://pmc.ncbi.nlm.nih.gov/articles/PMC11510778) — doi: 10.3389/fmedt.2022.1067144 [[DOI](https://doi.org/10.3389/fmedt.2022.1067144)] [[PMC free article](https://pmc.ncbi.nlm.nih.gov/articles/PMC9853978/)] [[PubMed](https://pubmed.ncbi.nlm.nih.gov/36
- [**Atomwise: The AI Powering Smarter Small Molecule Discovery**](https://healthydata.science/listings/atomwise-the-ai-powering-smarter-small-molecule-discovery) — AI Virtual Screening & Structure‑Based Hit DiscoveryDrug Discovery. Overview: Atomwise AI Drug Discovery Company Transforms Pharma R&D Atomwise’s AI‑driven drug discovery platform applies deep learnin

## 推荐互动资源

> 来自 Harvard LabXchange 的开放学习路径，可免费注册学习：

- [**Exploring Biotechnology**](https://www.labxchange.org/library/pathway/lx-pathway:c3833fc3-acbe-4649-a0ed-aa1cb2fca3e5) — This pathway explores innovations in biotechnology that have revolutionized aspects of modern life like agriculture, forensics and medicine.
- [**Data Literacy: How to Interpret Biological Data**](https://www.labxchange.org/library/pathway/lx-pathway:ff079975-ac71-418a-ac93-2e14b056f539) — This pathway introduces users to some of the most common types of data used in biology.
- [**Macromolecule Structure and Function**](https://www.labxchange.org/library/pathway/lx-pathway:d7e1cc9b-a448-46d1-8415-813ee88ead0c) — This AP Biology content explores the chemistry of life as it relates to macromolecules. How does macromolecule structure impact biological function? In this pathway, learners will be introduced to the
