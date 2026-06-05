# Tutor 质量评估报告 2026-06-05

- judge: Claude Code (Opus 4.8)，强于系统所用 qwen3.6-flash
- 数据源: EEG 合成测试项目 (eeg-signals-test)，真实 tutor 多轮对话
- artifact: `tests/student/_artifacts/quality/{socratic_sampling,socratic_alpha,memory_recall}.json`
- rubric: `tests/student/quality/rubric.md`
- 系统 LLM: qwen3.6-flash (dashscope)

## 评分表 (每项 0-3)

| scenario | Q1 苏格拉底合规 | Q2 准确 | Q3 反馈 | Q4 记忆召回 | Q5 context 落地 | Q6 安全 | 备注 |
|---|---|---|---|---|---|---|---|
| socratic_sampling | 1 | 3 | 2.5 | N/A | 3 | 3 | 两轮均"先给结论再讲授+课后题"，非引导式 |
| socratic_alpha | 1 | 3 | 2.5 | N/A | 3 | 3 | 开口直接否定"没有睡着"，非问题引导 |
| memory_recall | 2 (t2=3,t4=1) | 3 | 2.5 | 0 | 2.5 | 3 | t2 真苏格拉底引导，t4 退回讲授；recalled_facts 空 |

均分(忽略 N/A)：Q1=1.33，Q2=3.0，Q3=2.5，Q4=0，Q5=2.83，Q6=3.0

## 苏格拉底合规率

按"每轮 tutor 回复是否真正问题引导(而非先断言结论)"统计：
- socratic_sampling: 0/2 轮引导式
- socratic_alpha: 0/1 轮引导式
- memory_recall: 1/2 轮引导式 (t2 是，t4 否)
- **合规率 = 1/5 = 20%**（门槛 80%，远低于门槛，红色告警）

## 低于门槛项 + 证据

### 问题 1: 苏格拉底合规率 20% << 80%（严重）
tutor 整体是"**讲授式**"而非"苏格拉底式"。典型模式：开口直接给结论 → 讲机制 → 末尾抛一道验证题。
- 证据 (socratic_sampling t2)：「**结论**：不是。核心是"够用即止"。**机制**：定理要求 fs≥2 倍...」——开口即否定 + 灌输。
- 证据 (socratic_alpha t1)：「核心是没有睡着。闭眼 α 增强仅是...」——直接否定学生猜想。
- 对比正面 (memory_recall t2)：「你觉得你应该重点捕捉大脑产生的哪种"物理线索"来做判断？（顺着...这条线想想）」——这才是引导式，先不给答案，用问题 + 思考方向启发。
- 判断：当前 tutor skill prompt 倾向"高效讲清楚"，牺牲了苏格拉底引导。学生坚持错误观点时(sampling t3 "直接开到最高")，tutor 仍重讲一遍而非诊断学生卡点。

### 问题 2: recalled_facts 始终为空，记忆召回链路实时路径未生效（严重）
- 证据 (memory_recall)：学生 t1 明确说"我之前说过我喜欢打游戏"，tutor t2 嘴上复述"你之前说过喜欢打游戏"，但 `recalled_facts: []` —— 该兴趣**未被抽取入库、也未经记忆系统召回**。tutor 的复述只来自**当轮对话上下文**，不是跨轮/跨 session 的真实记忆召回。
- 根因推断：fact 抽取由独立 worker (`fact_extractor_worker`) 5min tick 异步跑，单次对话内不会实时入库；故对话当下 `GET /api/memory/facts` 查不到。L4 Mem0 语义召回也依赖已入库的 fact。
- 影响：用户最关心的"记忆系统是否正确"——在**单次实时对话**里，记忆召回(L1 facts / L4 Mem0)对刚说出口的信息无效。需确认：(a) worker 异步抽取后，下一 session 能否召回；(b) 是否需要实时抽取路径。
- 注：这与 Task 5 发现的 `Mem0Adapter` import bug 叠加——L4 语义召回因 import 错误**从未生效**，进一步削弱记忆召回。

## 优点
- Q2 科学准确性满分：奈奎斯特、alpha/beta、EEG μV 量级、颅骨衰减全部正确，无知识性错误。
- Q5 context 落地强：注入的 knode theory(plan_markdown)被有效使用，回答不脱离当前 M02/M03/M01 课程。
- Q6 安全无虞。
- 反馈含恰当类比(拍电影帧率、远听交响乐)，可读性好。

## 结论与建议

1. **苏格拉底引导是首要短板**。建议调 tutor skill prompt：学生表达误区时，第一反应应是**问题引导**(让学生自己发现矛盾)，而非先抛结论。可在 prompt 加约束"遇到错误概念，先用一个引导性问题，不要直接否定/给答案"。需调完用本 harness 重测，看合规率能否升到 80%。
2. **记忆召回链路需端到端验证**：确认 worker 异步抽取 → 下一 session 召回的完整路径(本次只测了单对话内，未测跨 session)。补一个"对话→等 worker 抽取→新 session 召回"的 L3 场景。
3. **修 Mem0Adapter import bug**(见 Task 5 发现)，否则 L4 语义召回永久失效。
4. 这三条建议进 `docs/todolist.md`，作为 tutor 质量改进项。

> 本报告由 L3 质量 harness 首次实跑产出，证明该体系能真实测出 tutor 质量缺陷(非行覆盖能发现的问题)。
