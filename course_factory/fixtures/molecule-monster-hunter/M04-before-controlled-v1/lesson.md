> Module: M04 · hands_on

> ### 这一步在通向哪 (北极星)
>
> **我们最终要做出的**: 一台分子怪兽猎人工作台——你输入一个分子，它画出结构、预测属性（好不好溶、有没有毒、能不能成药）、打分排序、给出 go/no-go 的理由，并从几千个分子里替你筛出最值得试的前十名。
>
> **这一节你亲手做出的那块积木**: 一份用 RDKit 亲手测出来的「官能团改造对照记录」——你拿同一个光秃秃的分子骨架，只给它加一个官能团（-OH），用 RDKit 算出加之前 / 加之后的性质（亲水性 / LogP），把这一前一后的数字并排记下来，亲眼证明性质真的跟着变了。
>
> **它通向**: 工作台要给分子打分、预测「好不好溶、像不像药」，靠的根本前提是一条铁律——「结构决定性质」（改一点结构，性质就跟着变）。这一节你不是背下这句话，而是用工具亲手把它量出来；后面所有「从结构算属性」「按结构筛分子」，都建立在「你信得过这条因果」之上。
>
> **离终点还差几步**: 你还在第 1 关（认识分子怪兽、把工具备齐）。上一节你第一次用 RDKit 把一个真分子的骨架（原子 / 键 / 环）读了出来；这一节你往前迈一步——给分子做一次只改一处的真实对照，用 RDKit 测出「改结构 → 性质变」的因果。从「读出分子长什么样」迈到「测出改结构会怎样」。

## 学习目标

- 能够说清什么是**官能团**：挂在分子骨架上、决定分子脾气（性质）的那一小撮抱团出现的原子；并认识两个最有用的官能团——**-OH**（让分子更亲水）和 **-NH2**（含氮的氨基）。
- 能够说清什么是**对照实验**：每次只改一个地方、别的全都不动，这样性质一旦变了，就能确定是这一处改动造成的。
- 能够说清并亲手验证那条最重要的铁律——**结构决定性质**：给同一个骨架只加一个 -OH，溶不溶水就能整个翻过来（乙烷不溶 → 乙醇能溶）。
- 能够用老师给的 RDKit 代码模板，对同一个骨架算出**加官能团之前 / 之后的性质（如亲水性 / LogP）**，整理成一份「官能团改造对照记录」，亲眼看见数字真的变了（上电脑需要家长协助，不用从零写代码）。

## 引入：把分子结构改一点点(加一个官能团), 它的性质真会跟着变吗, 我能测出来吗?

上一节你已经第一次用 RDKit 把一个真分子的骨架（有几个原子、哪些键、几个环）读了出来。可光会读「分子长什么样」还不够——那台分子怪兽猎人工作台真正要替你干的活，是**预测一个分子的脾气**：它好不好溶？有没有毒？像不像一种药？凭什么机器看一眼结构，就能猜出脾气？

这就引出这一节的核心问题：**把分子结构改一点点(加一个官能团), 它的性质真会跟着变吗, 我能测出来吗?**

这可不是一句口号。这一节你要像真正的科学家那样，亲手做一次实验把它验出来：拿同一个分子骨架，**只改一个地方**——给它加一个小小的官能团，然后用 RDKit 量一量，看它的性质到底变没变、变了多少。要把这件事做得让人信服，你得先搞懂三块基础：什么是官能团（那个被你加上去的小零件）、什么是对照实验（为什么必须只改一处）、以及那条最了不起的铁律「结构决定性质」到底是怎么回事。把这三块拼起来，你就能亲手测出「改结构 → 性质变」这条因果了。

## 核心概念：官能团——挂在分子身上、决定脾气的小零件

先认识那个待会儿要被你「加上去」的小零件。

一个分子，骨架（前面学的那一串串连起来的碳）管的是它有多大、长什么形状；可真正决定它脾气（爱不爱溶水、活不活泼、像不像药）的，往往不是骨架有多大，而是**骨架上挂着的那一小撮特别的、抱团出现的原子**。这一小撮专门管脾气的原子，叫**官能团**——你就把它想成挂在分子身上的「工具」或「小零件」，就像一把钥匙、一个挂钩。这一节你要认两个最有用的：**-OH**（一个氧加一个氢，挂上去让分子更亲水、更爱溶水）和 **-NH2**（一个氮加两个氢，含氮的氨基，也让分子更亲水，还是搭出蛋白质的关键零件）。

[[THEORY:theory_functional_group]]

## 深入理解：先学会怎么实验，才能看清是谁的功劳

[[IDEA:anim_1782308849318_pskg]]

要证明「加一个官能团让性质变了」，你得先有一套靠得住的实验办法，不然就算看见性质变了，也说不清到底是谁干的。这套办法叫**对照实验**，规矩只有一条——**每次只改一个地方，别的全都按兵不动**。就好比你想知道是不是多浇水让花长得更高，就得拿两盆一模一样的花，别的全一样，只让一盆多浇水；要是你又换土又搬地方又多浇水，三件事一起干，那花长高了你根本分不出是谁的功劳。所以这一节给分子做实验时，我们死死守住这条规矩：只给骨架加一个官能团，别的纹丝不动——这样性质一旦变了，就只能赖在这个新加的官能团头上。

[[THEORY:theory_controlled_experiment]]

有了对照实验这把尺子，我们就来做那次真刀真枪的实验：请出一段光秃秃的短碳链（乙烷），它几乎不溶于水、像油一样浮在水面；然后**只改一处**——给它加一个 -OH，它就变成了乙醇（酒精）。神奇的事来了：骨架还是原来那段骨架，就只多了一个 -OH，可它竟然变得能跟水痛痛快快混在一起了！只改一处，溶不溶水这件大事就整个翻了过来。这就铁证如山地证明了化学里最重要的一条铁律——**结构决定性质**：结构上动那么一丁点，性质就能天翻地覆。而这一节你要做的，就是用 RDKit 把这条铁律亲手**量**出来。

[[THEORY:theory_structure_determines_property]]

[[IDEA:game_1782308849318_rdrc]]

## 推荐视频

[![Functional groups | Properties of carbon | Biology | Khan Academy](https://img.youtube.com/vi/iuaYuCreEPk/hqdefault.jpg)](https://www.youtube.com/watch?v=iuaYuCreEPk)
[![Functional Groups Explained so AP Bio Students can Understand!](https://img.youtube.com/vi/3rqmBK1VA_I/hqdefault.jpg)](https://www.youtube.com/watch?v=3rqmBK1VA_I)

## 应用与拓展

[[IDEA:ex_1782308849318_dams]]

现在轮到你亲手做了。你要交出的成果，是一份**官能团改造对照记录**。

用老师给的完整 RDKit 代码模板（上电脑请家长帮忙，你不用从零写代码，会运行、会改要读的分子、会看输出就行），做一次严格的对照实验。具体这么做：

1. 先喂给 RDKit **改之前**的那个分子——一段光秃秃的短碳链（比如乙烷），让它替你算出这个分子的性质数字，重点是**亲水性 / LogP**（一个表示分子有多躲水还是多亲水的数：越大越油越躲水，越小越亲水）。把这个数记下来。
2. 然后**只改一处**——把这段骨架加上一个 -OH，变成乙醇，别的什么都不改。把这个改造后的分子也喂给 RDKit，让它算出同样的性质数字。再把这个数记下来。
3. 把「改之前」和「改之后」这两个数**并排摆到一起**对照：你会亲眼看见，只加了一个 -OH，LogP 这个数就明显变小了（更亲水了）——性质真的跟着结构变了，而且你用工具量出了变了多少。

把这一前一后的对照整理成一张小记录，再加一句话写下你最意外的发现（比如：原来只加这么一个小小的 -OH，亲水性这个数就掉了这么多）。这份对照记录，就是你亲手把「结构决定性质」从口号变成测出来的因果——也是后面工作台「从结构算属性」最关键的一块地基。

## 学习路径建议

这一节你产出的，是「能用 RDKit 测出加官能团前后性质变化」这个本事，加上一份亲手做的官能团改造对照记录。下一节开始，工作台会一步步用到它：先把分子用 SMILES 写出来、画出来，再学会从这些结构特征大批量地算属性、给分子打分。**「结构决定性质」是整台工作台的发动机；这一节你亲手验证、亲手量出了它，后面所有「看结构、推性质、筛分子」的台阶才踩得稳。**

## 延伸阅读

> 以下资料由系统自动检索并筛选，供深入研究参考：

- [**Organic Chemistry Functional Groups: Hydroxy, Amino, Halo, and ...**](https://quizlet.com/study-guides/organic-chemistry-functional-groups-hydroxy-amino-halo-and-alkoxy-411a4975-6dca-427b-a9ed-e92082134d01) — Hydroxyl Group (-OH): Found in alcohols, it increases solubility in water and can participate in hydrogen bonding. Amino Group (-NH2):
- [**Solved QUESTIONWhich of the following functional groups - Chegg**](https://www.chegg.com/homework-help/questions-and-answers/question-following-functional-groups-increases-solubility-organic-compounds-water-answer-o-q196446723) — -(C)/(O)O H Explanation: 1. -OH (hydroxyl group) is polar and can form hydrogen bonds with water, increasing solubility. 2. -NH_2 (amino group)
- [**(PDF) Functional Group Characteristics and Roles - ASHP**](https://www.ashp.org/-/media/store-files/p2661-sample-chapter-2.ashx) — O. COOH. O. N. H. S. N. O. COOH. Solubility Effects. The overall water and/or ... O. OH. NH2. O. OH. OH. CH3. O. O. H. N. CH3. CH3. CH3. CH3. Figure 2-16.
- [**Functional Group Identification (thermo.functional_groups)**](https://thermo.readthedocs.io/thermo.functional_groups.html) — Given a rdkit.Chem.rdchem.Mol object, returns whether or not the molecule has a amide RC(=O)NR`R″ group. Parameters: mol rdkit.Chem.rdchem.Mol. Molecule

## 推荐互动资源

> 来自 Harvard LabXchange 的开放学习路径，可免费注册学习：

- [**Organic Chemistry**](https://www.labxchange.org/library/pathway/lx-pathway:e4d4c721-0c56-4a04-864d-4531fc03c3fe) — Organic chemistry is the study of the molecules that are necessary for life to exist. The key ingredient for these molecules is carbon, which is able to form complex structures and allows for the vari
- [**When Chemicals Meet Water: The Properties of Solutions**](https://www.labxchange.org/library/pathway/lx-pathway:8117b0b6-3257-4b61-b107-9eb88ce3b2c2) — This unit addresses the physical and chemical properties of solutions. Although several topics addressed are common to all solution-phase systems, most of the examples are based specifically on aqueou
- [**The Surprising Organic Chemistry**](https://www.labxchange.org/library/pathway/lx-pathway:2e856615-81c0-41a2-80b7-23bdffcb6c76) — One of the most important and interesting areas in science is organic chemistry. This is the study of carbon and its compounds. Organic chemistry is a big part of our everyday life because it covers m
- [**Proteins**](https://www.labxchange.org/library/pathway/lx-pathway:6c6d78df-2bc3-4e33-98fa-9d382a98676d) — This pathway explores the structure and folding of proteins. Proteins are large biomolecules, or macromolecules, consisting of one or more long chains of amino acid residues. Proteins perform a vast a
