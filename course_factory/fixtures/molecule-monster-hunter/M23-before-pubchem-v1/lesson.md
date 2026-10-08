# 进 PubChem，搜一个真药的名字，拿到它的 SMILES

> Module: M23 · hands_on

> 网上哪里能查到一个真药的分子写法?

> ### 这一步在通向哪 (北极星)
>
> **我们最终要做出的**: 一个能跑的“分子怪兽猎人工作台”——你给它一串 SMILES, 它就回给你结构图、预测好不好溶/有没有毒/能不能成药, 打分, 写清留它/拒它的理由。
>
> **这一节你亲手做出的那块积木**: S1 你学会了**读写 SMILES、让电脑画出分子**。可工作台要分析的, 是**真实世界里的药**——你总不能把每个真药的 SMILES 都自己一个字符一个字符写出来吧? 这一节你要学会**去一个真正的化学数据库(PubChem)里, 搜一个真药的名字, 直接拿到它现成的 SMILES。** 这是你给工作台**攒一个“分子库”**的第一步。
>
> **它通向**: 接下来 S2 这一整段, 你都在干一件事——**给工作台攒一批真分子(一个“分子库”)**, 好让它有东西可分析。今天学会“从库里取一个分子”, 后面才能取一批、装进列表、用循环一次处理、拼成表格。
>
> **离终点还差几步**: 这是 S2“建库”的**开篇第一关**。S1 你给工作台造了“眼睛”(能看见一个分子); 从这一节起, 你开始往工作台里**喂真实的分子数据**。

## 学习目标

- 能够说清这一节解决的问题: **真药的 SMILES, 不用你自己写——网上有专门的化学数据库, 一搜名字就能拿到。**
- 能够说清 PubChem 是什么: **PubChem 是一个真实存在、免费、不用登录的化学“大图书馆”**(由美国一个叫 NCBI 的机构维护), 里面收了**一亿多个**分子。你输一个分子的名字, 它就把这个分子的各种信息(包括 SMILES)给你。全世界真正找药的人, 都在用它查分子。
- 能够亲手走一遍**“名字查结构”**的过程: 打开 PubChem 网页, 在搜索框里输一个真药的名字(比如 **aspirin / 阿司匹林**), 进到它的页面, 找到 **Canonical SMILES** 那一栏, 把那串 SMILES 抄下来。
- 能够把这一节和 S1 接上: 你抄回来的那串 SMILES(比如阿司匹林的 `CC(=O)OC1=CC=CC=C1C(=O)O`), 正是 M22 里你能让电脑读懂、画出来的那种字符——**现在你不光会写, 还会“取”了。**

## 引入：真药那么多，难道每个都要自己写 SMILES？

S1 你已经很厉害了: 会读写 SMILES, 还能让 RDKit 把任意一行 SMILES 画成真分子。可停下来想一个很现实的问题: 工作台真正要分析的, 是**真实世界里那些药**——可这些真药的分子, 常常又大又复杂, 一个真药的 SMILES 可能有几十个字符。**难道每一个真药, 你都要照着结构图、一个字符一个字符地自己写出来吗?** 那也太费劲、还容易写错了。

好消息是: **完全不用。** 真实世界里, 有人早就把**几亿个**分子的写法, 整整齐齐地收进了一个**免费的大数据库**, 你一搜名字就能拿到。这一节, 我们就去这个数据库——**PubChem**——亲手取一个真药的 SMILES 回来。

## 核心概念：PubChem——一搜名字，就给你分子的 SMILES

[[IDEA:anim_1781762184709_yptj]]

**PubChem 是一个真实存在、免费、不用登录的化学“大图书馆”。** 它由美国一个叫 NCBI 的机构(管很多科学数据库的)维护, 里面收了**一亿多个**分子的信息。全世界真正在实验室、在公司找新药的人, 天天都在它上面查分子。这又是一个**专业找药的人真在用的工具**——和上一节的 RDKit 一样, 你用的是真家伙, 不是玩具。

它最方便的一点是: **你用分子的“名字”就能查到它的“结构”。** 你不用先知道分子长啥样, 只要知道它叫什么(比如“阿司匹林”), 输进去, PubChem 就把这个分子的一大堆信息摆给你看——其中就有你最想要的那一栏: **它的 SMILES。**

打个比方: 这就像**图书馆按书名找书**。你想看一本书, 不用自己把整本书默写出来——你去图书馆, 报上书名, 管理员就帮你把那本书找出来递给你。PubChem 就是分子界的这个大图书馆: 你报上分子的名字, 它就把那个分子(连同它的 SMILES)找出来递给你。

亲手走一遍(**这一步需要家长帮忙在电脑上操作**):

1. 打开 PubChem 的网页(`pubchem.ncbi.nlm.nih.gov`)——**免费、不用注册、不用登录。**
2. 在搜索框里输入一个真药的名字, 比如 **`aspirin`**(阿司匹林, 常见的退烧止疼药), 回车。
3. 进到阿司匹林的页面, 往下找到 **Canonical SMILES** 那一栏, 你会看到一串: **`CC(=O)OC1=CC=CC=C1C(=O)O`**。
4. **认出来了吗?** 这串里有你 S1 学过的全部积木: `=` 双键、`( )` 支链、数字缝的环、`C1=CC=CC=C1` 那个苯环……这就是阿司匹林, 一个真药的 SMILES, 你现在亲手把它取回来了。

(小提示: 取数据**只走 PubChem 这种免费、不用登录的网页**。有些地方下数据要注册账号、或者在国内打不开, 我们就不走那些——PubChem 这种, 打开就能用, 最省心。)

[[THEORY:pubchem_lookup]]

[[IDEA:game_1781762184709_ifxp]]

## 推荐视频

[![PubChem Basics: Search a Drug Name, Get Its SMILES](https://img.youtube.com/vi/7tQ1pV2nF3o/hqdefault.jpg)](https://www.youtube.com/watch?v=7tQ1pV2nF3o)
[![Finding Molecules in PubChem for Beginners](https://img.youtube.com/vi/3pL9kQ0bV7s/hqdefault.jpg)](https://www.youtube.com/watch?v=3pL9kQ0bV7s)

## 应用与拓展

[[IDEA:ex_1781762184709_btff]]

这一节你要亲手做出的交付物, 是一张**“我从 PubChem 取回的第一个真药”记录卡**(**请家长帮忙在电脑上打开 PubChem**):

1. 打开 PubChem 网页, 搜一个你听过的真药名字(从 **aspirin / 阿司匹林** 开始最稳)。
2. 进到它的页面, 找到 **Canonical SMILES** 那一栏, 把那串 SMILES **一字不差地抄到卡上**。
3. 在 SMILES 旁边, **圈出至少 2 个你认得的 S1 积木**(比如一个 `=` 双键、一对 `( )` 支链、或一个环的数字)。
4. (有兴趣的话)再搜一个: 比如 **caffeine / 咖啡因**, 也把它的 SMILES 抄下来。
5. 在卡片底下写一句: **真药的 SMILES 不用我自己写——去 PubChem 搜名字就能拿到。PubChem 是免费、不用登录的化学大图书馆。**

完成标志: 一张**记录了至少 1 个从 PubChem 搜名字取回来的真药 SMILES(并圈出了 2 个认得的积木)**的卡。你现在会从真数据库里“取分子”了——给工作台攒分子库的第一步, 迈出去了。

## 学习路径建议

会从 PubChem 取一个分子, 你就有了往工作台里喂真分子的第一手本事。**下一节起, 我们要开始用一点点最简单的代码, 把取回来的分子“收拾”进电脑里: 先把一个 SMILES 存进一个“变量”再打印出来(M24)、再用“列表”装下一串分子、用“循环”一次处理一整列表……** 一步一步, 你就从“取一个分子”, 走到“管好一整个分子库”了。

## 延伸阅读

> 以下资料由系统自动检索并筛选，供深入研究参考：

- [**PubChem (homepage)**](https://pubchem.ncbi.nlm.nih.gov/) — PubChem is the world's largest collection of freely accessible chemical information, maintained by NCBI (part of NIH). Search chemicals by name, formula, or structure — no login required. Each compoun
- [**PubChem (Wikipedia)**](https://en.wikipedia.org/wiki/PubChem) — PubChem contains 111+ million unique chemical structures from hundreds of data sources. Free web access. Used by cheminformatics, medicinal chemistry, and drug-discovery communities. Aspirin is CID 22
- [**Data acquisition from PubChem (TeachOpenCADD T013)**](https://projects.volkamerlab.org/teachopencadd/talktorials/T013_query_pubchem.html) — To get a molecule's SMILES from PubChem: search the compound by name, open its page, and read the Canonical SMILES field. PubChem is free and requires no account — you type a drug name and get back it
- [**Aspirin chemical structure**](https://pharmacyfreak.com/aspirin-chemical-structure/) — Aspirin (acetylsalicylic acid) SMILES: CC(=O)OC1=CC=CC=C1C(=O)O — a benzene ring with an acetyl ester and a carboxylic acid group. Available on its PubChem compound page.

## 推荐互动资源

> 来自 Harvard LabXchange 的开放学习路径，可免费注册学习：

- [**Organic Chemistry**](https://www.labxchange.org/library/pathway/lx-pathway:e4d4c721-0c56-4a04-864d-4531fc03c3fe) — Organic chemistry is the study of the molecules that are necessary for life to exist. The key ingredient for these molecules is carbon, which is able to form complex structures and allows for the vari
- [**The Surprising Organic Chemistry**](https://www.labxchange.org/library/pathway/lx-pathway:2e856615-81c0-41a2-80b7-23bdffcb6c76) — One of the most important and interesting areas in science is organic chemistry. This is the study of carbon and its compounds. Organic chemistry is a big part of our everyday life because it covers m
- [**When Chemicals Meet Water: The Properties of Solutions**](https://www.labxchange.org/library/pathway/lx-pathway:8117b0b6-3257-4b61-b107-9eb88ce3b2c2) — This unit addresses the physical and chemical properties of solutions. Although several topics addressed are common to all solution-phase systems, most of the examples are based specifically on aqueou
