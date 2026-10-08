# 给电脑装上化学工具箱 RDKit，跑通第一行命令

> Module: M02 · foundation

> 怎么让电脑装上能算化学的工具, 并跑通第一行?

> ### 这一步在通向哪 (北极星)
>
> **我们最终要做出的**: 一个能跑的“分子怪兽猎人工作台”——你给它输入一个分子的写法(一串叫 SMILES 的字符), 它就回给你这个分子的结构图、预测它好不好溶、有没有毒、能不能成药, 给它打一个候选分, 写清“为什么留它、为什么拒它”, 最后给一句“值得继续研究 / 不值得”的建议。
>
> **这一节你亲手做出的那块积木**: 给电脑装好一个专门算化学、画分子的工具箱叫 **RDKit**, 并**跑通第一行命令**——让它打印出自己的版本号。这是你和真实工具的第一次握手, 也是后面所有动手节点的运行环境。
>
> **它通向**: 没有 RDKit, 后面读分子、画结构、算分子量、生成指纹、训模型……一件都做不了。装好它、跑通它, 就等于把猎人的“工作台”搭起来了。
>
> **离终点还差几步**: 这是 S1“分子世界”的第 2 关。你还没真正“看见”一个分子(那是第 22 关的高光时刻), 但今天先把工具准备好——好猎人, 先磨利器。

> ⚠️ **本节需要家长协助安装。** 装软件、敲命令这些步骤, 请和家长一起做。我们用**本地的 Anaconda / Jupyter**为主(不强制用需要科学上网的在线工具), 安装命令用官方现成的, 你只要照着做、看懂每一行在干嘛。

## 学习目标

- 能够说清楚什么是**“工具包(库)”**: 别人已经写好、打包好的一大堆本领, 你装上就能直接用, 不用自己从头造。
- 能够理解什么是**“命令行”**: 一个你打一句话、电脑就照着做事的黑框框, 它没有花哨按钮, 但很直接很有力。
- 能够在家长协助下, **照着现成命令把 RDKit 装好**, 并跑通第一行——让电脑 `import rdkit` 再打印出它的版本号。
- 能够理解 **`import` 是什么意思**: 把一个装好的工具包“请进来”当前的工作, 这样它的本领才能被你调用。

## 引入：好猎人，先磨利器

上一节你接下了“分子猎人”的委托, 写好了立项卡。可光有目标还不够——你总不能用一双手, 去翻看成千上万个分子吧? 你需要一套**趁手的工具**。

这就是这一节要回答的问题: **怎么让电脑装上能算化学的工具, 并跑通第一行?**

在计算化学这一行, 全世界的科学家几乎都在用同一套免费工具, 叫 **RDKit**。它就像一个装满了化学本领的大工具箱: 能读懂分子的写法、能把分子画成结构图、能算出分子有多重、能帮你把分子变成电脑看得懂的数字……这些后面你都会一个一个用到。今天, 我们先把这个工具箱装到电脑里, 并且跑通第一行命令, 跟它打个招呼。

## 核心概念：工具包、命令行、第一行

要把这件事做明白, 你得先认识三个新朋友。

**第一, 工具包(也叫“库”)。** 想象你要做木工。你可以自己从头打磨每一把锯子、每一个螺丝刀——那太累了。聪明的办法是直接买一整套现成的工具箱。**RDKit 就是这样一套“现成的化学工具箱”**: 全世界最聪明的化学程序员, 已经把“读分子、画分子、算分子”这些本领写好、打包好了, 你只要装上, 就能直接用它们, 不用自己从零造轮子。

**第二, 命令行。** 你平时用电脑, 是点图标、按按钮。但程序员还有另一种更直接的用法: 一个黑色的框框, 你在里面**打一句话(一条命令)**, 按回车, 电脑就照着做。它没有漂亮按钮, 但胜在直接、有力、说一不二。装 RDKit、跑第一行, 我们就在这个框框里做。

**第三, 跑通第一行。** 装好工具箱后, 我们要确认它真的能用。办法是让电脑做一件最简单的事: 把 RDKit 这个工具箱“请进来”, 再让它**报出自己的版本号**(就像问它“你几岁啦”, 它回你一个数字)。只要它顺利报出版本号, 就说明工具箱装好了、能用了——这就是“跑通第一行”。

[[THEORY:what_is_a_library]]

## 深入理解：import——把工具“请进门”才能用

[[IDEA:anim_1781595481194_foba]]

跑第一行里有一个特别重要的词, 叫 **`import`(导入)**。它是你以后会敲成千上万次的词, 现在就把它弄懂。

打个比方。你家有一个储物间, 里面放着各种工具箱(装好的库都在这儿)。但你**正在工作的桌子上**, 一开始是空的。你要用锤子, 就得先**走进储物间, 把锤子那个工具箱拿到桌上**——这个“拿过来放到手边”的动作, 在写代码里就叫 `import`。

所以 `import rdkit` 这句话的意思就是: **“把 RDKit 这个工具箱, 从储物间请到我现在的工作桌上来。”** 请进来之后, 它里面所有的本领(读分子、画分子……)才能被你叫用。如果你不 `import` 就直接喊“RDKit 帮我画个分子”, 电脑会一脸茫然: 你的工作桌上根本没有这个工具箱, 它不知道你在说谁。

这就是为什么, **几乎每一段用到工具的代码, 开头都要先 `import`**。它不是什么高深的魔法, 就是一句很朴素的“请工具进门”。理解了这一点, 以后看到一堆 `import` 开头的代码, 你就不会怕了——那只是程序在出门前, 先把今天要用的工具一件件摆上桌而已。

[[THEORY:what_is_import]]

[[IDEA:game_1781595481194_xwab]]

## 推荐视频

[![how to install rdkit with pip](https://img.youtube.com/vi/WGpWahvR8NE/hqdefault.jpg)](https://www.youtube.com/watch?v=WGpWahvR8NE)
[![Introduction to RDKit Part 1 - YouTube](https://img.youtube.com/vi/ERvUf_lNopo/hqdefault.jpg)](https://www.youtube.com/watch?v=ERvUf_lNopo)

## 应用与拓展

[[IDEA:ex_1781595481194_xmpd]]

这一节你要亲手做出的, 是**一次成功的“握手”**: 在家长协助下, 把 RDKit 装好, 并在命令行里跑通第一行, 让它打印出版本号。

动手分三步(全程和家长一起, 用本地 Anaconda/Jupyter 为主):

1. **装工具箱**: 按老师给的现成命令(通常就一句 `pip install rdkit`)把 RDKit 装上。装的过程可能要等一小会儿, 那是电脑在帮你把工具箱搬进来。
2. **请它进门**: 打开一个能写 Python 的地方(命令行或 Jupyter), 敲 `import rdkit`——这就是把工具箱请上工作桌。
3. **让它报个到**: 再敲一句让它打印版本号的命令(老师会给), 如果屏幕上跳出一个版本号(比如一串数字), 恭喜你, **第一行跑通了**, 工具箱装好能用了。

完成标志: 一张**屏幕截图(或抄下来的那个版本号)**, 证明你成功 `import` 了 RDKit 并让它报出了版本号。把它存进你的项目文件夹——这是你工作台搭起来的第一个证据。**如果安装中途遇到报错, 别慌, 那很正常**, 和家长一起照着报错信息查一查、再试一次就好。

## 学习路径建议

工具箱装好、第一行跑通, 你的“分子猎人工作台”就算开张了。**下一节(M03), 我们就要用这个工具, 开始真正认识分子了**——先从最最基础的开始: 一滴水, 放大再放大, 会看见什么? 我们会拆开一滴水, 第一次见到组成万物的最小积木: 原子。从那一节起, 你就正式踏进“分子世界”了。

## 延伸阅读

> 以下资料由系统自动检索并筛选，供深入研究参考：

- [**Getting Started with RDKit and Jupyter | Depth-First**](https://depth-first.com/articles/2020/08/17/getting-started-rdkit-and-jupyter) — # Getting Started with RDKit and Jupyter. RDKit is a cheminformatics toolkit with bindings for Python. RDKit can also be difficult to install. This article discusses the problem and a method for using
- [**GitHub - rdkit/rdkit: The official sources for the RDKit library · GitHub**](https://github.com/rdkit/rdkit) — We read every piece of feedback, and take your input very seriously. ## Use saved searches to filter your results more quickly. # rdkit/rdkit. ## Folders and files. | rdkit-config.cmake.in | | rdkit-c
- [**Getting Started with the RDKit in Python**](https://www.rdkit.org/docs/GettingStartedInPython.html) — # Getting Started with the RDKit in Python¶. Beginning with the 2019.03 release, the RDKit is no longer supporting Python 2. If you need to continue using Python 2, please stick with a release from th
- [**RDKit for Beginners: A Gentle Introduction to Cheminformatics — ChemCopilot: PLM + AI for Chemical Industry**](https://www.chemcopilot.com/blog/rdkit-for-beginners) — ChemCopilot: PLM + AI for Chemical Industry. # RDKit for Beginners: A Gentle Introduction to Cheminformatics. ## **What is RDKit?**. RDKit is a free, open-source toolkit for **cheminformatics** - the

## 推荐互动资源

> 来自 Harvard LabXchange 的开放学习路径，可免费注册学习：

- [**Programming Logic and Systems Thinking**](https://www.labxchange.org/library/pathway/lx-pathway:c5e651d8-cdb0-403b-aaec-5fff96356a54) — Programming logic and systems thinking are foundational skills across science, engineering, and technology, enabling professionals to design decision-making workflows, solve problems efficiently, and 
- [**Introduction to Python**](https://www.labxchange.org/library/pathway/lx-pathway:4a21d31a-fe87-4638-a293-880b06c3718c) — This pathway offers lessons that introduce users to Python programming and is designed to teach users the basics of Python to solve real-world science problems ranging from biology to statistics to ph
- [**12 Days of Biopython**](https://www.labxchange.org/library/pathway/lx-pathway:4f64b995-8c53-49a0-8861-5b6654a1c000) — Bioinformatics is an important field in the biological sciences and allows scientists to work with large amounts of data; which is very useful for genetics research. In this pathway, you will be intro
