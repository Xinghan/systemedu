> Module: M03 · hands_on

> ### 这一步在通向哪 (北极星)
>
> **我们最终要做出的**: 一台分子怪兽猎人工作台——你输入一个分子，它画出结构、预测属性（好不好溶、有没有毒、能不能成药）、打分排序、给出 go/no-go 的理由，并从几千个分子里替你筛出最值得试的前十名。
>
> **这一节你亲手做出的那块积木**: 一份用 RDKit 亲手读出来的「分子骨架小报告」——你喂给它几个真分子，它替你数出每个分子有多少个原子、有哪些化学键、有几个环、含不含芳香环。这是你第一次用工具看进一个真分子的内部结构。
>
> **它通向**: 工作台要给分子打分、预测属性，前提是机器能先「读懂」一个分子由什么搭成。这份骨架小报告就是机器读分子的第一步——后面所有「从结构算属性」「按结构筛分子」，都建立在「能把分子的原子、键、环读出来」之上。
>
> **离终点还差几步**: 你还在第 1 关（认识分子怪兽、把工具备齐）。上一节你想通了这台工作台到底要做什么、机器是怎么从例子学规律的；这一节你第一次亲手用 RDKit 把一个真分子的骨架读出来——从「听说分子」迈到「亲手读分子」。

## 学习目标

- 能够说清一个分子是由什么搭成的：最小的积木是**原子**（氢 H、氧 O、碳 C、氮 N 等），原子用**化学键**手拉手连成**骨架**（链、支链、环、芳香环）。
- 能够说清**碳为什么是搭分子的主力**：碳永远伸 4 只手（碳四价），又能跟别的碳手拉手连成又长又复杂的骨架。
- 能够认出三种基本的键（单键、双键、三键）和两种基本的骨架形状（链 / 环），并知道**芳香环**是一种特别稳、特别常见的环。
- 能够用老师给的 RDKit 代码模板，亲手读入几个真分子，让它数出每个分子的**原子数、键、环、是否含芳香环**，输出一份「分子骨架小报告」（上电脑需要家长协助，不用从零写代码）。

## 引入：一个真分子是由什么搭成的, 我能用工具把它的骨架读出来吗?

上一节你想通了这台分子怪兽猎人工作台到底要干什么：它要替你从一大堆分子里挑出最值得试的好分子。可在挑之前，得先有一个更基本的问题——机器到底怎么「看懂」一个分子？你给它一个分子，它眼里看到的是什么？

这就引出这一节的核心问题：**一个真分子是由什么搭成的, 我能用工具把它的骨架读出来吗?**

先别急着碰电脑。我们先像玩乐高一样，把一个分子拆开看看它是怎么搭起来的。一个分子，说到底就是一堆**最小的积木**用一种特别的方式拼在一起。这些最小的积木叫**原子**；原子之间靠**化学键**手拉手连起来；连起来的整个形状——直直的一条、分了叉的、围成一个圈的——就是这个分子的**骨架**。把这三件事（原子、键、骨架）搞懂了，你就明白机器读一个分子时到底在读什么了。然后这一节的高光时刻来了：你会亲手用一个叫 **RDKit** 的工具，把几个真分子喂进去，让它替你把骨架读出来、数清楚——这是你第一次用工具看进一个真分子的内部。

## 核心概念：分子 = 原子（积木）+ 化学键（手）+ 骨架（拼出的形状）

我们一块一块来。

**第一块：原子，是搭一切的最小积木。** 你手里的水、你呼吸的空气、你自己的身体，一直放大放大，到最后看见的都是一颗颗小小的**原子**。原子有很多种类，每一种叫一个**元素**，科学家给它们起了名字。这门课你最常碰到四种：**氢 H**（最轻最小）、**氧 O**（喘气要吸的）、**碳 C**（生命和药物里的主力，你会一遍遍见到它）、**氮 N**（空气里最多的）。先把这四个名字混个脸熟。

[[THEORY:theory_atom_and_weight]]

**第二块：化学键，是原子伸出来拉住别人的「手」。** 原子不会自己孤零零待着，它们会伸出「手」去拉住别的原子，拉住了就连成一体——这只「手」就是**化学键**。两个原子之间，可以只用一只手拉（**单键**），可以两只手一起拉、抱得更紧（**双键**），也可以三只手一起拉、抱得最紧（**三键**）。手越多，两个原子抱得越紧、靠得越近。机器读分子时，要读的第二样东西，就是这些键——哪两个原子之间有键、是单键还是双键。

[[THEORY:theory_chemical_bond]]

## 深入理解：碳是搭骨架的主力, 骨架有链也有环

[[IDEA:anim_1782289507301_pbax]]

**第三块：骨架，是原子用键连出来的整个形状。** 把原子（积木）用键（手）连起来，连出来的整个样子，就是分子的**骨架**。而搭骨架的主力，永远是**碳**。为什么是碳？因为碳有个雷打不动的规矩：它永远伸出 **4 只手**去拉住别人，一只都不肯空着——这叫**碳四价**。手多就意味着花样多：碳可以用 4 只手各拉一个伙伴，也可以匀出两只手去和别的碳手拉手。一个碳牵一个碳、一个接一个连下去，就连成长长的一**链**；链中间某个碳再分出叉，就是**支链**；要是链的两头牵到一起，就围成一个**环**。生命和药里那些复杂分子的骨架，几乎全是碳一根一根这样搭起来的。

[[THEORY:theory_carbon_skeleton]]

骨架里有一种环特别特别常见、也特别特别稳，叫**芳香环**。最有名的就是**苯环**——六个碳围成一个正六边形的圈。它的稳不是普通的稳：圈上的电子不老老实实待在某两个碳之间，而是绕着整个圈一起转、大家一起分享，这种「绕圈共享」让苯环像一个抱得死死的小集体，特别难拆开。所以你以后读分子时，看到一个**含芳香环**的分子，就知道它骨架里藏着一块特别稳的「铁打的圈」。在 RDKit 读出来的骨架小报告里，「含不含芳香环」会是单独的一项——因为它对分子的脾气影响很大。

[[THEORY:theory_aromatic_ring]]

把这三块拼起来你就明白了：**机器读一个分子，读的就是「有哪些原子、原子之间有哪些键、键连出了什么样的骨架（有几个环、含不含芳香环）」。** 这正是这一节你要用 RDKit 亲手读出来的东西。

[[IDEA:game_1782289507301_jeso]]

## 推荐视频

[![Rules of Encoding Molecules using Simplified Molecular Input Line Entry System (SMILES)](https://img.youtube.com/vi/_UbmThglFL4/hqdefault.jpg)](https://www.youtube.com/watch?v=_UbmThglFL4)
[![Crack the Code: Mastering SMILES Notation – Your Ultimate Tutorial!](https://img.youtube.com/vi/QRLaIARxP30/hqdefault.jpg)](https://www.youtube.com/watch?v=QRLaIARxP30)

## 应用与拓展

[[IDEA:ex_1782289507301_aluz]]

现在轮到你亲手做了。你要交出的成果，是一份**分子骨架小报告**。

用老师给的完整 RDKit 代码模板（上电脑请家长帮忙，你不用从零写代码），把几个真分子一个一个喂进去——比如水、甲烷、乙醇、苯。RDKit 是一个专门用来读分子的工具，你给它一个分子，它就能替你数出来：这个分子有**几个原子**、有**哪些键**（多少根单键、双键）、有**几个环**、**含不含芳香环**。你要做的，是运行模板、把每个分子的这几项数读下来，整理成一张小表格——这就是你的分子骨架小报告。

报告里至少要包含：每个分子的名字、原子总数、键的情况、环的个数、是否含芳香环。最后加一句话，说说你最意外的一个发现（比如：原来苯这么小的分子，里面藏着一个 6 个碳的芳香环；原来水只有 3 个原子）。这份报告，就是你第一次用工具真正「看进」一个分子，也是后面工作台「从结构算属性」的第一块地基。

## 学习路径建议

这一节你产出的，是「能用 RDKit 把一个分子的原子、键、环读出来」这个本事，加上一份亲手做的骨架小报告。下一节开始，工作台会一步步用到这个本事：先学会把分子画出来、再学会从这些结构特征去算分子的属性。**能读出骨架，是机器看懂分子的第一步；这一步迈出去了，后面所有「从结构到属性」的台阶才踩得上去。**

## 延伸阅读

> 以下资料由系统自动检索并筛选，供深入研究参考：

- [**Introduction to RDKit — Python for Data Science in Chemistry**](https://education.molssi.org/python-data-science-chemistry/rdkit_descriptors/rdkit.html) — Use RDKit to create molecules in Python. One commonly used library in Python for data science (or cheminformatics) is called RDKit. RDKit lets us create variables which represent molecules and retriev
- [**Learn Installing and Using RDKit | Molecular Representations and Parsing**](https://codefinity.com/courses/v2/62eda1b5-5e3c-4b60-be8c-48041c2c8206/7b50cc34-af9b-47c6-b0f7-53ca3ed4d0d4/b0b22f87-35af-4510-8943-cc9bcccf42f2) — # Import RDKit modules and create a molecule from a SMILES string # Import RDKit modules and create a molecule from a SMILES string from rdkit import Chem from import  # Define a SMILES string for ben
- [**rdkit - QSAR4U**](https://qsar4u.com/files/rdkit_tutorial/rdkit.html) — Reading and writing molecules¶ RDKit supports various formats: SMILES, Mol, SDF, Mol2, PDB, FASTA, etc. Here are the steps involved, in order.
- [**The RDKit Book — The RDKit 2026.03.2 documentation**](https://www.rdkit.org/docs/RDKit_Book.html) — This is the approach taken in the RDKit. Instead of using patterns to match known aromatic systems, the aromaticity perception code in the RDKit uses a set of rules. Aromaticity is a property of atoms

## 推荐互动资源

> 来自 Harvard LabXchange 的开放学习路径，可免费注册学习：

- [**Chemical Bonding**](https://www.labxchange.org/library/pathway/lx-pathway:b2cd0ddb-06d8-4e98-8092-7f739ddaff9e) — Why do atoms react with some elements but not others, and why do they form compounds with such different properties? One of the reasons is the bonds that they form. This pathway provides resources rel
- [**The Chemical Level of Organization**](https://www.labxchange.org/library/pathway/lx-pathway:eade2bb5-55cf-3970-b718-388b3a05b8a7) — This pathway provides an in-depth look at elements &amp; atoms: the building blocks of matter, chemical bonds, chemical reactions, inorganic compounds essential to human functioning, and organic compo
- [**Exploring Molecules in 3D: An Introduction to VSEPR Theory**](https://www.labxchange.org/library/pathway/lx-pathway:6b451aa5-2d02-451e-bfc1-46d4e7317c70) — &nbsp;








Uncover the principles of molecular geometry with the VSEPR model, exploring how electron repulsion shapes 3D molecules. Predict molecular structures, bond angles, and hybridization, in
