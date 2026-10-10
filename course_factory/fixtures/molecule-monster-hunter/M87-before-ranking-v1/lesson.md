# 把多个分数加权综合排出 Top10

### 这一步在通向哪 (北极星)

**我们最终要做出的**: 一台分子怪兽猎人工作台——你输入一个分子, 它画出结构、预测属性(好不好溶、有没有毒、能不能成药)、打分排序、给出 go/no-go 的理由, 并从几千个分子里替你筛出最值得试的前十名。

**这一节你亲手做出的那块积木**: 一个**加权综合排名器**——它接住上一节漏斗筛剩下的那几百个幸存分子, 把每个分子身上那好几个分开、还各说各话的分数(溶解度好不好、有没有毒、活不活泼、Lipinski 过没过门槛)先拢成同一把尺子, 再按你设的轻重比例合成**一个总分**, 最后从高到低排队, 当场排出 **Top10**。

**它通向**: 上一节漏斗只会"扔掉一批、留下一批", 留下的分子还是一锅没排过序的, 你看不出谁更值得先试; 有了这个排名器, 工作台第一次能对这一锅幸存者说"这个最值得试、那个排第二、它俩差不多"——这正是最终报告里"从几千个分子里替你筛出最值得试的前十名"那句话真正落地、变成一份真实榜单的地方。

**离终点还差几步**: 你已经能从一堆幸存分子里排出 Top10 了。第五关后面还剩几步: 查这 Top10 是不是长得太像、要不要换掉近亲补进更不一样的, 为每个被拒分子写一句拒绝理由, 最后把这一切总装成一台出 go/no-go 报告的工作台。排名是这一关的脊梁, 它一立起来, 后面那几步都是在给它补血肉、收尾巴。

## 回顾: 上一节漏斗把分子筛到哪了

上一节(M86)你把好几道单独的筛选条件串成了一条**多层漏斗**: 溶解度太差的挡一层、有毒嫌疑大的挡一层、Lipinski 没过门槛的再挡一层……几千个分子从漏斗口倒进去, 一层层往下漏, 出口只剩下几百个"每一关都过了"的幸存者。漏斗自始至终只干一件事——**淘汰**: 每一层都在回答"这个分子行不行、要不要扔", 答案非黑即白。它最后交给你的, 是一批都合格的分子, 但只是一**堆**, 没有先后, 没有名次, 谁也不比谁靠前。这一节, 我们就从这一堆没排过序的幸存者出发, 再往前推关键的一步: 给它们排座次。

## 你要回答的核心问题

> 好几个不同的分数, 怎么合成一个总排名?

漏斗解决的是"留谁、扔谁"——它只会回答"行"或"不行", 像一道道关卡, 过不去就出局。可幸存下来的这几百个分子, 彼此之间还分不出高下: 它们全都"行", 但你只有十个名额(真实做实验很贵, 一次只能试一小撮), 到底先试哪十个? 这就是排名要回答的新问题——不再是"行不行", 而是"**谁更好、好多少、谁该排第几、谁先上场**"。

打个比方: 漏斗像招聘时筛简历, 把不满足基本条件的直接刷掉; 而排名像从过了初筛的人里排出"最想要的前十名"——这时光说"都合格"没用了, 你得把每个人在好几个方面的表现(经验、能力、配合度……)**综合成一个总评**, 才排得出先后。又比如你买东西比价, 也不是只看价格, 而是把价格、质量、口碑各打个分、按你看重的程度凑成一个总评分再挑。分子排名是同一回事: 把一个分子在好几项上的表现, 凑成一个总分, 再排队。

难点在于: 你手里不是一个分数, 而是好几个**各说各话**的分数。溶解度好的分子不一定不毒, 活泼的不一定好溶, 几项往往互相打架。它们量的是不同的东西、用的是不同的刻度、甚至方向都相反(有的越大越好、有的越小越好), 一个可能在几十上下, 另一个只在 0 和 1 之间, 没法直接比大小, 更没法直接相加——硬凑只会算出一个没意义的数。要排出一个总名次, 你得先想办法把这几把**各说各话的尺子, 拢成一个能比高下的总分**。这一节就拆成两步把它拢起来: 先**归一化**(把尺子统一), 再**加权综合**(按重要程度配比例相加)。

## 先把几把尺子拢成一把: 归一化

[[THEORY:normalize_before_sum]]

直接把溶解度的数、毒性的数、活性的数加在一起, 是行不通的——这几个数根本不在一个量级、一个方向上, 硬加只会让数大的那一项说了算, 其余的全被淹没, 你以为算的是"综合", 其实从头到尾只是那一项在拿主意。所以相加之前必须先做一步**归一化**: 把每一项不管原来是什么范围、什么单位, 统统换算成同一把尺子上的"好坏分"(比如都压到 0 到 1, 越接近 1 表示这一项越好)。归一化做完, 你手里这几列分数才第一次**可比、可加**——溶解度的 0.8 和毒性的 0.8, 才真的是"一样好"的意思, 加起来才有意义。这一步看着不起眼, 却是后面能不能公平相加的前提, 也是最容易被偷懒跳过、一跳过整个排名就悄悄失真、你却察觉不到的地方: 数字照样算得出来、榜照样排得出来, 只是排错了, 还排得理直气壮。具体怎么把不同范围、不同方向的数换算到 0 到 1, 为什么不归一化会让某一项独大、整个排名作废, 看上面这块。

## 再按重要程度配比例: 加权综合

[[THEORY:weighted_scoring_rank]]

几项分数都换成同一把尺子之后, 还有一件事要定: 它们**一样重要吗**? 通常不。对一个想做成药的分子, "有没有毒"往往比"活不活泼"要紧得多——一个再活泼但有毒的分子, 也轮不到它排前面。所以我们给每一项配一个**权重**(它在总分里占多大分量), 重的项乘一个大一点的数、轻的项乘一个小一点的数, 再把这些"归一化分数 × 各自权重"加起来, 得到**一个总分**——这就是**加权综合打分**。最后按总分从高到低排队, 排在最前面的十个, 就是这一节要交付的 **Top10**。

这里有个好处值得先点一下: 加权综合不是"一票否决"。漏斗的硬门槛是只要有一项不达标就直接出局, 哪怕这个分子别的方面都很出色也照样被扔; 而加权综合允许一个分子在某一项上稍弱, 只要它在更重要的几项上够强, 总分照样能排到前面——它更像一个**会权衡、会算总账的评委**, 而不是一个只会卡某条线的门卫。现实里好东西往往不是样样满分, 而是综合最强, 加权综合正好能把这种"略有短板但整体出色"的分子捞出来, 这正是排名比纯漏斗更聪明、更接近真实决策的地方。权重具体怎么设、为什么加权求和(而不是硬门槛)更会挑、把某一项权重调大调小会怎样实实在在地改变 Top10 的名次, 看上面这块。

## 你今天要做的(把分数综合成 Top10)

这一节的动手有点分量(它要一口气把好几项分数综合成名次), 但你不用从零写代码: 这一节给你一份**完整可运行的排名代码模板**, 你只要看懂它在干什么、填几个空、改一两个参数, 就能把它跑起来。**模板里需要动脑的几处(尤其是设权重)建议[需家长协助], 和大人一起讨论着改。**

1. **拿到各项分数**: 把上一节漏斗筛剩下的那几百个幸存分子, 连同它们各自的溶解度分、毒性分、活性分、Lipinski 门槛分, 一起读进表里——这张表就是排名的原料, 每一行一个分子, 每一列一项分数。
2. **归一化**: 跑模板里归一化那一步, 把每一列都压到 0 到 1 的同一把尺子上(越接近 1 表示这一项越好), 注意那些"越小越好"的项(比如毒性)要记得换成方向, 别让它把好坏弄反。
3. **设权重**: 在模板里改那几个权重数字, 想清楚对"能不能成药"这件事来说哪项最要紧, 给它配最大的权重——比如把毒性配得比活性重。这一步没有标准答案, 它装的是**你的判断**。
4. **加权求总分并排名**: 让模板把"每一项归一化分数 × 它的权重"加起来, 算出每个分子的总分, 再从高到低排序, 打印出排在最前面的 **Top10**, 看看都是哪些分子上了榜。
5. **改权重看名次怎么变**: 把毒性的权重调大一点、或者把活性调小一点, 再跑一次, 亲眼看 Top10 的名次跟着洗牌——这一下你就真切体会到: **权重就是你的偏好, 你看重什么, 榜单就替你把什么排在前面。排完这一刻, 你的工作台第一次能开口说'最值得试的就是这个', 值得记一笔。**

排完这份 Top10, 下一节(M88)我们会回头打量这十个分子: 万一它们彼此长得太像(同一个骨架的近亲扎堆), 等于把鸡蛋全放一个篮子里, 就得换掉太像的、补进更不一样的——给这份榜单加上"多样性"这一道保险。

[[IDEA:anim_1782398778476_wnwx]]

[[IDEA:game_1782398778476_zizc]]

[[IDEA:ex_1782398778476_qrju]]

## 推荐视频

[![Finding balance in drug discovery through multi-parameter optimisation](https://img.youtube.com/vi/tnHi159GtmQ/hqdefault.jpg)](https://www.youtube.com/watch?v=tnHi159GtmQ)
[![Multi-parameter Optimisation in Practice (Webinar)](https://img.youtube.com/vi/04XjzahCudM/hqdefault.jpg)](https://www.youtube.com/watch?v=04XjzahCudM)

## 延伸阅读

> 以下资料由系统自动检索并筛选，供深入研究参考：

- [**Multi-parameter optimization: identifying high quality compounds with a balance of properties (review)**](https://optibrium.com/downloads/MPO_review_preprint.pdf) — Drug discovery review explaining how individual property scores (potency, solubility, ADME, toxicity) are turned into per-property desirability scores and then combined into a single 'desirability ind
- [**Weighted Scoring Model Framework - Steps and Example**](https://www.casebasix.com/pages/weighted-scoring-model-framework) — Beginner-friendly walkthrough of the weighted scoring model: list criteria, assign a weight to each by importance, score every option per criterion, multiply score x weight, sum across criteria, then 
- [**Weighted sum model - Wikipedia**](https://en.wikipedia.org/wiki/Weighted_sum_model) — Reference for the weighted sum model (WSM/WSUM): overall score = sum of weight_i * value_i across criteria, with the highest total ranked best. Gives the formal formula and the requirement that criter
- [**Multi-parameter optimization: The delicate balancing act of drug discovery (Drug Discovery News)**](https://www.drugdiscoverynews.com/multi-parameter-optimization-the-delicate-balancing-act-of-drug-discovery-5401) — Plain-language feature on why a real drug must simultaneously satisfy potency, ADME, solubility and safety, and how teams (e.g. Pfizer's CNS MPO, a 0-6 desirability index from six properties) score an
