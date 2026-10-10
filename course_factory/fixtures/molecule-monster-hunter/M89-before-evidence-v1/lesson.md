# 为每个被拒分子写一句拒绝理由

> Module: M89 · synthesis

> 被淘汰的分子, 我能不能说清它为什么不行?

> ### 这一步在通向哪 (北极星)
>
> **我们最终要做出的**: 一台分子怪兽猎人工作台——你输入一个分子, 它画出结构、预测属性(好不好溶、有没有毒、能不能成药)、打分排序、给出 go/no-go 的理由, 并从几千个分子里替你筛出最值得试的前十名。
>
> **这一节你亲手做出的那块积木**: 前面那条漏斗只会把分子默默扔掉, 不吭声。这一节你给漏斗装上**会说话的嘴**: 对每一个被筛掉的分子, **亲手生成一句人话拒绝理由**——说清它**卡在哪一层、哪条规则没过、具体数值越了多少**(比如"太重了: 分子量 612, 超过 500 的上限"), 再补一句这条规则背后的后果。被拒的不再是一堆无名编号, 而是一份**逐条说得清的淘汰名单**。
>
> **它通向**: 一台只会说"留这个、踢那个"却不讲为什么的工作台, 没人敢信。会为每个被拒分子讲清理由, 整条漏斗就从黑箱变成**可解释**的——这正是一份负责任的候选报告的核心价值, 也是下一节把全部成果组装成最终 go/no-go 报告时, 必须先备好的一块。
>
> **离终点还差几步**: 你已在 S5(怪兽挑战)阶段把漏斗(M86)、综合排名(M87)、去近亲(M88)都搭好了。这一节给漏斗补上"解释"这块短板。再往后只剩**最后一节**——把这一路做的全部组装成能用的工作台、吐出完整 go/no-go 报告, 项目就到终点了。

## 学习目标

- 能够说清这一节要回答的问题: 漏斗筛掉一个分子, 我**能不能讲清它为什么不行**, 而不只是甩一个"出局"。
- 能够说清**为什么"被拒"必须配一句理由**: 一条只会扔东西、不解释的漏斗是**黑箱**, 没人敢信也没法改; 给每个被拒分子配上理由, 漏斗就变**可解释**——别人能复核、你自己能回头改规则。
- 能够说清**一句好理由由哪两块拼成**: 一是**卡在哪条规则**(漏斗有好几层, 要点名是哪一道关没过), 二是**具体数值怎么越界的**(不只说"太重", 要说"分子量 612, 超过 500"), 最好再补一句这条规则背后的后果。
- 能够说清**怎么定位"卡在哪一条"**: 一个分子按顺序过漏斗各层, **在哪一层第一次没过, 就卡在那一条**; 拒绝理由说的就是这第一道拦下它的关卡(后面的层它根本没走到)。
- 能够**照可运行模板亲手生成一遍拒绝理由**: 用现成能跑的代码模板, 给一批被拒分子各打印一句"卡在哪条 + 越了多少"的人话理由(此步标[需家长协助])。

## 引入：会扔东西的漏斗，得学会开口说话

前面 M85 你给分子定了 Lipinski 五条门槛规则, M86 把这些规则串成一条**多层漏斗**, 几千个候选哗哗往下倒, 一层层筛, 最后只剩几个。这条漏斗很好用, 但它有个毛病: 它**闷头干活、一句不解释**。它把一个分子踢出去, 你问它为什么, 它只回你两个字——"出局"。

可科研不是这么干的。换个生活场面: 学校把一个孩子的报名退回来, 只盖一个"不录取"的章、不写半句原因, 家长能服气吗? 一定要写清楚: 是**身高没到**、还是**年龄超了**——而且带上具体数, "身高 118, 差 2 公分到 120 的线"。被拒的人有权知道自己**卡在哪一条**。分子筛选也一样: 一条只会扔、不讲理由的漏斗是个**黑箱**, 没人敢信你的结论, 你自己回头也想不起当初为啥踢了它。所以这一节要回答的就是: **被淘汰的分子, 我能不能说清它为什么不行?**

## 核心概念：为什么"被拒"必须配一句理由

先想清楚一件事: 给被拒分子写理由, 不是多此一举的礼貌, 而是让整条漏斗从**黑箱**变成**可解释**的关键一步。黑箱漏斗只给你一个"留/踢"的结果, 中间发生了什么全藏着; 一旦每个被踢的分子都带着一句"我卡在第几关、越了多少"的理由出来, 别人就能**复核**你的筛选, 你自己也能**回头改规则**——这就是可解释。

那一句"说得清"的理由长什么样? 它不是一句模糊的"这分子不行", 而是由两块拼成: 第一块, **点名卡在哪条规则**——漏斗有好几层(太重、太油、氢键太多……), 得说清哪一道关把它拦下; 第二块, **报出数值怎么越界的**——不光说"太重", 要说"分子量 612, 超过 500 的上限"。两块拼起来, 再补一句这条规则背后的后果(比如太油的分子往往溶不开), 一句负责任的拒绝理由就成形了。这两块各自的讲究, 留到 theory 里说透。

[[THEORY:why_reject_reasons]]

## 深入理解：怎么定位"它到底卡在哪一条"

[[IDEA:anim_1782398580427_ympl]]

知道理由该长什么样, 还差最后一步: 一个分子身上可能**好几条规则都不达标**, 那拒绝理由到底报哪一条?

答案藏在漏斗的"一层层"里。分子是**按顺序**往下过漏斗的: 先过第一层、再过第二层……**在哪一层第一次没过, 它就卡在那一条**, 当场被拦下、后面的层根本走不到。所以拒绝理由要报的, 就是这**第一道**拦住它的关卡——就像闯关游戏死在第三关, 你说的是"卡在第三关", 不会去操心后面第四、第五关多难, 因为你压根没走到。于是给一个被拒分子写理由的套路就清楚了: 让它从头过一遍各层, **逮住第一层没过的地方**, 把那条规则的名字、和它在那条规则上越界的具体数, 拼成一句人话。这个"逐层检查、抓第一个绊倒处"的做法怎么落到代码上, theory 里带你走一遍。

[[THEORY:locate_failed_rule]]

[[IDEA:game_1782398580427_icob]]

## 推荐视频

[![Drug-Likeness Property by Lipinski's Rule of Five](https://img.youtube.com/vi/ECyDSqtw_n8/hqdefault.jpg)](https://www.youtube.com/watch?v=ECyDSqtw_n8)
[![Lipinski's rules & drug discovery beyond the rule of five](https://img.youtube.com/vi/42XFEL5TMH4/hqdefault.jpg)](https://www.youtube.com/watch?v=42XFEL5TMH4)

## 应用与拓展

[[IDEA:ex_1782398580427_fgul]]

这一节你要**给一批被漏斗拒掉的分子, 亲手生成一句句拒绝理由**:

1. **讲清为什么要写理由**: 不看书, 说清一条只会扔、不解释的漏斗为什么是黑箱、为什么没人敢信, 而配上理由后它怎么就变得可解释了。
2. **拆解一句好理由**: 拿一句现成的拒绝理由(如"太重了: 分子量 612 > 500"), 指出它的两块——卡在哪条规则、数值怎么越界, 并补出这条规则背后的后果。
3. **照模板跑一遍**: 用现成能跑的代码模板, 给一批被拒分子逐个打印拒绝理由([需家长协助]跑代码)。
4. **解释"卡在第一条"**: 找一个身上不止一条规则不达标的分子, 说清为什么它的理由只报第一道没过的关, 而不是把所有毛病都列出来。
5. 在卡片上写一句: **给每个被拒分子写理由, 是让漏斗从黑箱变可解释; 一句好理由 = 卡在哪条规则 + 具体数值怎么越界(+ 后果); 报的是它按顺序过漏斗时第一道没过的那条。**

完成标志: 你能讲清为什么被拒必须配理由、一句好理由由哪两块拼成, 能照模板给一批被拒分子生成拒绝理由, 还能解释为什么理由只报第一道拦住它的规则。

## 学习路径建议

到这儿, 你的漏斗终于学会了开口说话: 每个被筛掉的分子都带着一句"卡在哪条、越了多少"的人话理由出来, 整条筛选从黑箱变成了说得清、能复核的可解释流程。**接下来就是最后一节(M90)**: 你会把这一路做的全部——漏斗、综合排名、去近亲, 还有这一节的拒绝理由——组装成一台真能用的分子猎人工作台, 让它对每个分子吐出完整的 go/no-go 报告。终点就在眼前了。

## 延伸阅读

> 以下资料由系统自动检索并筛选，供深入研究参考：

- [**Lipinski's rule of five - Wikipedia**](https://en.wikipedia.org/wiki/Lipinski%27s_rule_of_five) — Lipinski's Rule of Five (Ro5) is the canonical set of filter rules used to judge a molecule's drug-likeness: molecular weight < 500, no more than 5 hydrogen-bond donors, no more than 10 hydrogen-bond 
- [**Lipinski's Rule of Five - an overview | ScienceDirect Topics**](https://www.sciencedirect.com/topics/pharmacology-toxicology-and-pharmaceutical-science/lipinskis-rule-of-five) — Overview of how the Ro5 descriptors (MW, HBD, HBA, logP) connect to oral bioavailability and ADME (absorption, distribution, metabolism, excretion). Useful for writing a human-readable rejection sente
- [**Virtual Screening for Drug Discovery: A Complete Guide | Technology Networks**](https://www.technologynetworks.com/drug-discovery/articles/what-is-virtual-screening-in-drug-discovery-407347) — Explains virtual screening as a sequential filtering cascade: each stage removes molecules that fail a property check (drug-likeness, ADME, toxicity) before passing survivors to the next filter. This 
- [**Is there enough focus on lipophilicity in drug discovery? (Taylor & Francis)**](https://www.tandfonline.com/doi/full/10.1080/17460441.2020.1691995) — Discusses why high logP (too lipophilic / too greasy) molecules fail in development: poor ADMET, off-target binding (hERG, CYP, plasma protein binding). Reinforces that a good rejection reason names t
