# 035-learner-qc-and-theory-tree

**Status**: spec (2026-05-27)
**Owner**: Xinghan Cui
**Created**: 2026-05-27

## 背景 / 问题

course_factory 经过 spec 034 + 本周 F2/F4.0 重做后, 单节生成质量 (anim/game 严格按 F2 三层颜色 + F4.0 节点性质判定 + qc_gatekeeper C1-C11) 已经有机器级保障. 但有**两个产品级缺口**仍然没办法机器化:

### 缺口 1: 没有 "学生角度" 的整体质检

qc_gatekeeper C1-C11 是**单节点机器质检** — 它检查每节 anim/game 是否合规、theory K1 是否含类比、字数是否落预算. 但它**看不见整个项目的学习路径是否连贯**:

- M05 引入"分段函数", 学生第一次见. 但学生有没有学过"一次函数"? "斜率"? 没有就是断崖.
- M08 让学生写 `for x in pms_list:` Python 循环. 但 M01-M07 教过"列表"了吗? 教过"变量赋值"了吗? 没有就是断崖.
- M11 讲 I2C 地址 0x76. 但学生学过"十六进制"吗? "二进制位"吗? 没有就是断崖.

**机器静态扫描发现不了这种断崖** — 术语本身可能在节点里被定义了, 但 **学生认知负荷是否能扛住**, 只有"模拟学生从头读到尾" 才能发现.

历史教训 (purpleair v0.10): M05 分段函数节点字数预算齐全, qc_gatekeeper 全 PASS, 但实际让 10 岁学生从 M01 看到 M05, 在 M05 "分段函数 + 一次函数 + 比例" 三个数学概念同时出现, 而前面 M01-M04 没铺任何数学前置 — 这是教学断崖, qc 完全没发现.

### 缺口 2: 没有 "全平台知识覆盖" 的认知地图

学生完成一个项目后, 系统只能展示**这个项目教了什么**. 但学生 (以及家长) 想知道:

- 我学了 purpleair, 在"数学"领域我现在掌握到哪个层级了?
- 我学了 purpleair + ai-ant 两个项目, 我覆盖了"统计"领域多少节点?
- 我下一个项目可以选什么 — 哪个项目能让我点亮 "贝叶斯推断" / "微积分" / "蛋白质结构" 这些节点?

现在的 knowledge_tree.json 是**项目内部**的知识图谱 (这个 purpleair 项目内部 M01→M30 的依赖关系), 不能跨项目对照, 也不能跟通行学科体系 (CCSS Math, NGSS Science) 对齐.

**家长 + 学生需要一张全平台学科知识图谱**, 让"我学了什么 / 我还差什么"一目了然.

## 这次要做什么 (WHAT)

引入两个新能力:

### 1. Learner 质检员 (post-generation)

**形态**: 项目所有 knode 生成完后 (publish 前) 跑一次, 输出一份"学生模拟学习反思报告" 到 `content-workspace/_review/<slug>_learner_report.md`.

**机制**: dispatch 一个 LLM agent, persona = 项目 age_band 对应的"典型零基础学生" (purpleair = 10-12 岁中文母语小学生, 没学过编程/没学过统计/数学到分数). agent 按 M01→M30 顺序依次读每节的 `lesson.md + theories.json + assignment.md`, **每读完一节**输出:

- ✓ 这节我看懂了 (理由)
- ⚠️ 这节我有点跟不上 (具体卡在哪句话/哪个概念)
- ❌ 这节我完全看不懂 (前置缺什么)
- 📊 我累不累 (信息密度评分 1-5)

读完全部 N 节后输出最终汇总:
- 断崖列表 (按严重程度排序): 哪几节有 ❌ / ⚠️
- 补节点建议: 应该在 M_X 和 M_Y 之间插入"___" 这个节点
- 信息密度曲线: N 节的密度分布 (避免连续高密度节)
- 给作者的话: 3-5 条可执行的修改建议

**触发**: 用户在 `content-workspace/_review/` 跑 `python -m course_factory.learner_qc <slug>`.
不集成到自动 publish 流程 (人工触发, agent 跑 5-10 分钟).

### 2. 全平台学科理论知识树

**形态**: 一套 Claude 手写的全平台学科知识树 JSON 文件 (`course_factory/knowledge_tree/platform_tree.json`), 包含 11 学科 baseline:

- math (数学): 算数 → 代数 → 几何 → 统计 → 微积分 → 线代
- phys (物理): 力学 → 运动 → 光 → 电磁 → 量子 → 相对论
- chem (化学): 元素 → 反应 → 有机 → 物理化学
- bio (生物): 细胞 → 遗传 → 演化 → 生态 → 神经 → 分子生物
- cs (计算机): 算法 → 数据结构 → 编程范式 → 操作系统 → 网络 → AI
- elec (电子): 电路 → 模拟 → 数字 → 信号 → 嵌入式
- env (环境/地球): 气候 → 大气 → 海洋 → 生态
- astro (天文): 太阳系 → 恒星 → 宇宙学
- med (医学/健康): 解剖 → 生理 → 病理 → 公共卫生
- eng (工程): 机械 → 材料 → 控制 → 制造
- geo (地质): 矿物 → 板块 → 古生物

每学科 30-60 节点, 共 ~500 节点. 每节点含:
- `id`, `subject`, `name`, `depth_level` (K1/K3/K5/K7/K9/K11/K13 — 对应小1/3/5/初1/初3/高1/高3)
- `prerequisites` (这个节点依赖的前置节点 ID 列表)
- `description` (一句话描述)

**点亮算法**: 每个项目生成完后, dispatch 1 个 agent 读项目所有 theories + key_concepts + plan_md, 输出"本项目点亮节点 ID 列表" → 存到 `manifest.json.lit_nodes`. 不是 fuzzy match (准确率不够), 是 agent 语义判断.

**前端展示**: 项目详情页加 "知识树" tab, SVG 展示该学科的部分 (项目涉及的学科), 点亮节点用 coral 高亮 + 未点亮灰色. hover 节点显示"本项目在哪节教了这个".

## 点亮的两层语义 (重要边界)

"点亮" 有 2 种, 本 spec **只做第 1 种**:

| 层 | 含义 | 存哪 | 何时算 | 本 spec? |
|---|---|---|---|---|
| **项目级点亮** | "本项目教了哪些知识点" (跟用户无关) | manifest.json.lit_nodes (library DB, 项目固有) | 项目内容生成时 lit_tree CLI 跑一次 | ✅ 是 |
| **用户级点亮** | "这个学生**学过**了哪些知识点" (因人而异) | student-app PG 表 `user_lit_nodes` (per-user, knode 完成时增量) | 用户 mark knode complete 时增量 | ❌ spec 036 |

035 只做静态项目数据 + 项目详情页"本项目教了哪些"展示, 用户系统不涉及.

## 不做什么 (NON-GOALS)

- 不做**用户级点亮** (per-user 完成进度追踪 + 跨项目聚合"你总共点亮 X%") — spec 036.
- 不做 "知识树编辑器"  — 平台知识树是 Claude 手写的静态 JSON, 不允许用户/管理员编辑.
- 不做 "推荐下一项目" 算法 (根据用户已点亮节点推荐) — spec 037.
- Learner 质检员不集成到自动 publish — 它是**人工触发的辅助工具**, 给内容作者参考. 不阻塞 publish.
- Learner 质检员第一版**单 persona** (按 age_band 选). 不做 3 persona (弱/中/强) 多角度.

## 验收 (Acceptance)

### Learner 质检员
- [ ] `python -m course_factory.learner_qc purpleair-airquality-node` 能跑通, 输出 `_review/purpleair-airquality-node_learner_report.md`
- [ ] 报告包含 18 节 (M01-M18) 每节的 ✓/⚠️/❌ + 累计断崖列表 + 补节点建议
- [ ] 报告里至少识别出 2 个真实断崖 (用 purpleair 现状测试, M05 数学预置缺失 / M08 Python 入门是否过快 / M11 二进制十六进制铺垫)

### 知识树
- [ ] `course_factory/knowledge_tree/platform_tree.json` 含 11 学科 + ~500 节点 + prerequisites 链接
- [ ] purpleair 项目跑点亮 agent 后, manifest.json.lit_nodes 含至少 30 个节点 ID (大部分在 math/phys/cs/elec/env)
- [ ] student-web 项目详情页有"知识树" tab, SVG 显示该项目涉及的学科, 点亮节点 coral 高亮
- [ ] 至少 3 个项目跑过点亮 (purpleair / ai-ant / eeg) 验证算法稳定

### 一致性 + 集成
- [ ] knowledge_tree json schema 通过 Pydantic 校验
- [ ] Learner 报告输出格式稳定 (不同项目复用相同 markdown 模板)
- [ ] 跑测试: `python -m pytest tests/test_learner_qc.py tests/test_platform_tree.py -v`

## 风险

- **R1: 平台知识树覆盖度不够** — 第一版 500 节点可能漏掉某些项目用到的概念 (例如 alphafold 用到的"蛋白质折叠"可能没在 bio 树里). 缓解: 接受第一版不完美, 项目点亮 agent 可标"这节涉及概念 X 但树里没有", 收集到 todolist 下版迭代.
- **R2: Learner 质检员 agent 输出不稳定** — 同样 prompt 跑两次可能给不同断崖. 缓解: prompt 里强制"先列项目所有出现的术语, 再 trace 每个术语在哪节首次出现", 用结构化输出降低 variance.
- **R3: 知识树点亮 agent map 不准** — agent 可能把"分段函数" 误 map 到 math.algebra 而不是 math.functions. 缓解: agent 输出每个点亮要附理由 ("M05 plan 提到 '分段线性插值' → 命中 math.algebra.piecewise"), 内容作者可在 _review 阶段人工 audit + 修正.

## 相关
- spec 034: course_factory Claude-authored steps
- spec 036 (未来): 全平台跨项目知识树聚合视图 (用户个人页)
- spec 037 (未来): 推荐下一项目算法
- `docs/prd.md`: 教育平台愿景
