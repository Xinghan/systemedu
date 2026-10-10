# 用 Tanimoto 查 Top10 太像就换(连回 scaffold)

> Module: M88 · synthesis

> 我的 Top10 会不会其实都是一个家族的近亲?

> ### 这一步在通向哪 (北极星)
>
> **我们最终要做出的**: 一台分子怪兽猎人工作台——你输入一个分子，它画出结构、预测属性（好不好溶、有没有毒、能不能成药）、打分排序、给出 go/no-go 的理由，并从几千个分子里替你筛出最值得试的前十名。
>
> **这一节你亲手做出的那块积木**: 一张「去过重」的 Top10——你拿前面排好的前十名候选,挨个用 Tanimoto 量它们彼此像不像、看骨架是不是同一个,把太像的近亲请下榜,从别的家族补进最不一样的分子,最后交出一份十个分子来自不同家族、真正替老板把路探宽了的「必试榜」。
>
> **它通向**: 这是整条筛选流水线的收尾。有了去过重的 Top10,工作台最后吐出的那份候选报告才不会让老板「连吃十碗同一碗面」,每一个珍贵的试验名额都花在带来新信息的分子上。
>
> **离终点还差几步**: 你正站在第 5 关「端到端跑通工作台」的高潮处——前面模型已经替几千个分子打了分、排了名(M87 选出 Top10),这一节给这张榜做最后一道「家族体检」,做完它,整台工作台从输入到产出就真正合龙了。

## 学习目标

- 能说清一个只按分数取的 Top10 常犯的毛病:榜单顶端容易被同一个家族(同骨架的近亲)挤满,十个名额里一大半在重复探同一条路。
- 能讲明白我们追求多样性的真正理由是「避免信息重复」,而**不是**因为相似的分子「差」——相似的分子可能依然很优秀、分依然很高,被换下来只是因为它和榜上另一个重了。
- 能复用前面学过的两把老工具给 Top10 做「家族体检」:用 Tanimoto(相似度尺子)量任意两个候选有多像,用骨架(Bemis-Murcko scaffold)判断两个分子是不是严格同一个家族。
- 能用「留住榜首、把太像的逐个请下、再从别的家族补进最不一样的」这套贪心去重的思路(最经典的版本叫 MaxMin),把一窝近亲的榜单改造成铺得开的榜单。
- 能用老师给的完整可运行代码模板(上电脑需家长协助),把自己的 Top10 候选喂进现成的多样性挑选器,只改一两个参数(比如「多像才算太像」的阈值)就跑出一份去过重的新 Top10,并对照换前换后,说清哪几个被换掉、为什么。

## 引入：我的 Top10 会不会其实都是一个家族的近亲？

恭喜你——跑到这一节,工作台几乎就要合龙了。回想 M87:你让训练好的模型给成千上万个候选分子一个一个打了分,然后把分数从高到低排好,稳稳地揪出了排在最前面的十个,这就是 Top10。看着这张榜单,你大概松了口气:活儿干完了吧?

先别急着收工。把这张 Top10 摊开,挨个看看它们的结构,你很可能会心里一沉:这十个里头,怎么有七八个长得几乎一模一样?同一个骨架,只在边上换了个小零件——活脱脱一窝近亲。这就逼出了这一节真正要回答的核心问题:**我的 Top10 会不会其实都是一个家族的近亲?**

这个问题为什么要命?设想你是个替老板探路的美食侦探,老板让你从全城几千家小吃里挑十家「必试榜」,他要照着这张榜亲自跑一遍。结果你交上去的十家里,八家都是同一条街、同一个老板的兰州拉面,只是招牌不同。老板照着跑,等于连吃八碗同一碗面,白白浪费了八次机会。我们的 Top10 也是这样:每一个名额,本该替老板(也就是真要去做实验的科学家)多探一条路;真做实验是要花钱、花时间的,名额无比金贵。要是十个名额全押在一个家族上,一旦这个家族整体翻车,你就满盘皆输,连个备胎都没有。

所以这一节,我们要给 Top10 做最后一道关键的「家族体检」:把太像的近亲找出来、请下榜,换上来自别的家族、能带来新信息的分子。好消息是,这件事不需要任何全新的大武器——你早就备齐了趁手的工具,这一节就是把它们漂亮地拼到一起,给整条流水线收个漂亮的尾。

值得停下来体会一下:这一节有种「老朋友重聚」的味道。你前面辛辛苦苦学的两样东西,到这一步全派上了大用场——一是 Tanimoto 那把「相似度尺子」(M50,给两个分子的指纹吐一个 0 到 1 的数),二是 Bemis-Murcko 求出的「骨架」(M67 切数据时用过,把分子边上的小零件撸掉、剩下中间那个环系骨架)。当初学它们时,你大概还看不全它们的全部用处;现在到了收尾,它们俩手拉手,正好凑成给 Top10 体检的两把尺子。这正是搭工作台最让人踏实的地方:没有一块积木是白学的,前面埋下的每一颗工具,后面都会在某个关键处接上。

## 核心概念：先想清楚「为什么要多样」，再决定「换不换」

[[IDEA:anim_1782397857426_nbjj]]

动手之前,得先把一件最容易记反的事钉死:我们想要多样性,到底是图什么?

直觉上你可能会想:「换掉太像的,是不是因为相似的分子不好?」恰恰相反。相似的分子很可能非常好——它们扎堆挤进 Top10,正是因为模型觉得这一类有戏、分都打得高。我们要换掉它们,**唯一的理由是「重复」,不是「差」**。同一个家族的分子性质都差不多(这正是你前面学过的「结构相似→性质相似」那条道理,M14、M65 那会儿),所以试了其中一个,基本就替其余几个把答案问出来了;剩下的再试,几乎换不来任何新信息,白占名额。把这一层想透,你才不会一边去重、一边误以为自己在「淘汰差分子」——我们追的是整张名单的「广度」,从头到尾没有贬低任何一个分子。

那「太像」具体怎么判?用你的两把老尺子,一硬一软配着使:

[[THEORY:theory_div_why_diverse_top10]]

读完上面这条理论,你会彻底分清「单个分子好不好」(质量)和「这份名单重不重复」(多样性)是两件不打架的事,也会明白为什么 Tanimoto 和骨架正好是给 Top10 体检的两把现成尺子——Tanimoto 量「有多像」,骨架判「是不是严格同一族」。这层想清楚了,我们才有底气动手去换。

[[IDEA:game_1782397857426_xixl]]

## 推荐视频

[![Introduction to RDKit Part 2: Fingerprints and Tanimoto Similarity](https://img.youtube.com/vi/3qzZbaUzo9M/hqdefault.jpg)](https://www.youtube.com/watch?v=3qzZbaUzo9M)
[![Generating Molecular Fingerprints using RDKit](https://img.youtube.com/vi/-oHqQBUyrQ0/hqdefault.jpg)](https://www.youtube.com/watch?v=-oHqQBUyrQ0)

## 核心概念：怎么把太像的换成更散的

知道了「为什么换」,接下来是「怎么换」。这里的诀窍,是换一个聪明的**挑选顺序**:不再闭着眼睛只按分数往下取十个,而是「留住榜首、看谁太像就请下、再从别的家族补进最不一样的」,一个一个把榜单撑开。这套每一步都直接抓「眼下离现有榜单最远的那个」的办法,有个正经名字叫贪心去重,最经典的一版叫 MaxMin。它一点不玄,全靠你早就会的 Tanimoto:两个分子的 Tanimoto 越靠近 1 就越像,越靠近 0 就越「不一样、离得远」。

[[THEORY:theory_div_swap_to_diverse]]

这条理论会带你把整个挑选流程走一遍:从「分最高的直接留下当种子」,到「逐个量 Tanimoto、把近亲请下榜」,再到「从别的家族补进跟现有榜单最不一样的那个」,直到十个彼此都够散为止。它也会点明一个诚实的边界:这种贪心办法又快又好用、是行业里的标准做法,但它**不保证**挑出全世界最完美的多样组合;而「多像才算太像」的那条线、最后想留几个,都是可调的参数,反映你在「保高分」和「铺得开」之间怎么权衡,没有唯一正确答案。

我们把这套挑选顺序拿一个小例子掐着指头走一遍,你就彻底踏实了。假设榜上已经留下了「A 拉面」当种子,现在候选池里还剩三个分子等着补位:「B 拉面」「C 火锅」「D 糖水」。挑下一个该补谁?按 MaxMin 的两步来:第一步,对每个候选,拿它跟榜上现有的每个人都比一遍 Tanimoto,只盯住「最像的那一次」当它的「贴近分」——B 拉面跟 A 量出来 0.92(太像了),C 火锅跟 A 量出来 0.40,D 糖水跟 A 量出来只有 0.18。第二步,在这三个「贴近分」里挑**最小**的那个补进来:0.18 最小,所以请 D 糖水上榜,因为它离现有榜单最远、最能补一块全新的地方。注意 B 拉面虽然分可能很高,却因为跟 A 太像(贴近分 0.92)被晾在一边——它不是差,是重了。补完 D,榜上变成「A 拉面 + D 糖水」,下一轮再把 B、C 各自跟这两个人都比一遍、取最像那次、挑最小的补,如此一圈圈下去,榜单就越撑越散。这「先对每个候选取最像、再在所有候选里挑其中最不像」的一取一挑,就是 MaxMin 这名字的全部秘密,你动手时心里默念一遍准不会乱。

落到动手上,你几乎不用从零写代码。前辈们早把这套挑选逻辑封装成了现成的工具(RDKit 工具箱里那个专门干这事的 MaxMin 挑选器)。老师会给你一份完整能跑的模板,你只要把 Top10 候选的指纹喂进去、改一两个参数,按下运行,它就替你把去重和补位一口气做完。

## 实物操作与购买

本节是纯计算(用 Tanimoto 和骨架给 Top10 做去重),全部在电脑上跑现成代码,不需要购买任何实体元器件,故无实物套件。上电脑那一步需要家长协助。

## 应用与拓展

[[IDEA:ex_1782397857426_oowu]]

学完这一节,你要亲手给自己的 Top10 做一次完整的「家族体检 + 去重」,交出换前换后两张榜单的对照。

先**用眼睛和老尺子做一次体检**:把 M87 选出的 Top10 摊开,两两量一遍 Tanimoto(用前面亲手算过、也跑过代码的那把尺子),再看看它们的骨架。把 Tanimoto 高得逼近 1、或者骨架干脆一样的那几对圈出来——这些就是「太像」的近亲对。你会直观地看到:这张只按分数取的榜单,到底有几对在重复探同一条路。

然后**上电脑(需家长协助)用现成模板去重**。用老师给的完整代码模板,把你的 Top10(或者更大的候选池)喂进 RDKit 的多样性挑选器,跑出一份去过重的新名单——

```python
from rdkit import Chem
from rdkit.Chem import AllChem
from rdkit.SimDivFilters.rdSimDivPickers import MaxMinPicker

# smiles_list: 你的候选分子(可以是 Top10,也可以放更大的候选池让它挑)
mols = [Chem.MolFromSmiles(s) for s in smiles_list]
fps  = [AllChem.GetMorganFingerprintAsBitVect(m, radius=2, nBits=2048) for m in mols]

picker = MaxMinPicker()
# 从 fps 里挑出 pick_n 个彼此尽量散开的分子;改 pick_n 就是改"想留几个"
pick_n = 10
idx = picker.LazyBitVectorPick(fps, len(fps), pick_n)   # 返回被选中分子的编号
diverse_top = [smiles_list[i] for i in idx]
print(diverse_top)
```

跑完,把它吐出的「去过重的 Top10」和你原来那张「一窝近亲的 Top10」摆在一起对照:哪几个近亲被换掉了?换上来的新分子来自哪些以前没进榜的家族?你可以再改一改参数体会一下——比如把 `pick_n` 调大调小,看名单怎么变;或者去翻翻模板里那条「多像才算太像」的阈值,把它调严一点、再松一点,看被换掉的分子是变多还是变少。

你交出来的成果是:**换前、换后两张 Top10 的对照**,外加一句话说清——某个分子为什么被换下来(因为它和榜上谁的 Tanimoto 太高、或者骨架相同,信息重了),以及它被换下来**绝不等于它差**。把这句话写明白,就说明你真正守住了这一节的分寸:我们要的是名单的广度,不是去贬低任何一个分子。

做完这一步,你手里这张 Top10 就从「一窝近亲」变成了「十个来自不同家族的代表」——这也正是整台工作台跑到收尾时,最值得你拍照留念的高光时刻:从输入一串分子,到画结构、预测属性、打分排名,再到最后这道去重,工作台的每一节积木,这下全都拼上了。

## 想再往前走一点（选做）

- **数数你的榜单原本有几个家族**:让家长帮你把换之前那张 Top10 的骨架一个个求出来、列出来,数数十个分子一共只占了几个不同的家族。要是只占了两三个,你就亲眼看到了「一窝近亲」有多严重——这正是这一节要解决的问题长什么样。
- **把阈值调严、再调松**:去模板里找那条「Tanimoto 多高才算太像」的线,先调到很严(比如只要超过 0.5 就算太像),看名单被换掉一大半;再调到很松(比如非得超过 0.9 才算),看几乎没动。体会一下:这条线越严,名单铺得越开,但也越可能换掉一些其实分挺高的分子——这就是「质量和多样性」之间那个需要你自己拿捏的权衡。
- **给老板写一句交代**:挑榜上被换掉的那个分子,用一句话替它「正名」——说清它分其实不低、被请下榜只是因为和谁重了,而不是它差。把这句话写顺,你就真的把这一节的护栏吃透了。

## 学习路径建议

这一节你给筛选流水线收了尾:用 Tanimoto 和骨架给 Top10 做了「家族体检」,把一窝近亲换成了铺得开的多样名单。到这里,工作台的核心链路——从分子输入,到结构、属性、打分、排名,再到多样化的最终候选——已经整条跑通了。接下来该做的,是把这条已经能跑的链路收拢成一份**像样的、能交给老板看的候选报告**:每个上榜分子配上它的结构图、预测属性、分数,以及一句留它的理由(go/no-go),让这张「必试榜」不只是十个 SMILES,而是一份谁都看得懂、敢照着做决定的成果。

## 延伸阅读

> 以下资料由系统自动检索并筛选，供深入研究参考：

- [**Why is Tanimoto index an appropriate choice for fingerprint-based similarity calculations? (Journal of Cheminformatics)**](https://jcheminf.biomedcentral.com/articles/10.1186/s13321-015-0069-3) — Foundational open-access paper explaining the Tanimoto coefficient for binary molecular fingerprints. Defines it as the ratio of shared 'on' bits (intersection) to the total bits set in either molecul
- [**Picking a small set of diverse molecules from a large set (Greg Landrum / RDKit blog)**](https://greglandrum.github.io/rdkit-blog/posts/2025-07-10-diversity-picking-methods.html) — Practical tutorial by RDKit's lead developer on selecting a diverse subset from a candidate pool. Compares diversity-picking methods built on Tanimoto distance between Morgan fingerprints, including t
- [**Scaffold Diversity of Exemplified Medicinal Chemistry Space (J. Chem. Inf. Model. / PMC)**](https://pmc.ncbi.nlm.nih.gov/articles/PMC3180201/) — Peer-reviewed analysis of scaffold diversity in real drug-discovery libraries using Bemis-Murcko frameworks. A Murcko scaffold is the molecule's core: the union of all ring systems plus the minimal li
- [**RDKit SimDivFilters / MaxMin diversity picker documentation (rdSimDivPickers)**](http://rdkit.org/docs/source/rdkit.SimDivFilters.rdSimDivPickers.html) — Official RDKit reference for the MaxMinPicker used to grab a diverse subset of molecules based on Tanimoto distance between fingerprints (default Morgan2). Generates distances on demand so it scales w
