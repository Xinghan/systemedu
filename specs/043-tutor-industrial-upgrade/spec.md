# Spec 043: Agent Tutor 工业化改造

Status: draft (2026-07-03)

## 背景 (WHY)

2026-07-03 的成熟度评估（多 agent 代码级深挖 + 业界对标 + 红队，见记忆 `project_tutor_maturity_assessment`）结论：

> 当前 tutor 整体 2.3/5，是「记忆增强的对话系统」而非真 agent。骨架完整、记忆过硬（五层 memory 4/5，业界中上）、**工具全断**（bind_tools 全仓零调用，10 个工具/ToolRegistry/MCP/审计全是孤儿代码）、**安全见底**（输入侧仅 4 条正则，输出侧零防护）、无知识追踪、eval 覆盖错位。

同时有硬合规 deadline：**《人工智能拟人化互动服务管理暂行办法》2026-07-15 施行**，其未成年人条款（<14 岁监护人同意、未成年人模式、家长可见、连续 2 小时提醒、禁虚拟亲密关系人设）大概率适用于我们的 AI tutor。

## 目标 (WHAT)

把 tutor 从「记忆增强对话系统」升级为**符合工业标准的 agentic tutor**。

**本 spec 的重点是直接影响 tutor 效果的核心能力**（tool-use、判分反哺、教学法真差异化、知识追踪）。儿童安全与合规是独立的、可后续叠加的一层（语义审核 + 合规四件套），**本轮后置**，不在关键路径——因为它可以在核心能力就位后作为中间件层直接加上，不阻塞效果迭代。

按「先让 agent 能行动 → 再闭环 → 再差异化 → 再建模」次序：

1. **P1 tool-use 闭环（本轮首要）**：接通「LLM 发 tool_call → 执行 → 结果回灌 → 多轮」，含前端确认（HITL）、审计、工具白名单、工具输出定界（防污染，属正确性而非合规）。
2. **P2 形成性闭环**：判分反哺教学（答错 → 调整下一步）、RAG 引用约束、教学法真差异化（skill 状态机，回应「6 段文案」批评）。
3. **P3 学习者建模**：BKT 知识追踪（per user × knode 掌握度），与知识树 DAG 耦合驱动自适应路由。
4. **P4 可观测性 + eval**：Langfuse 自托管 trace + pedagogy eval 进 CI + 线上采样评测 + eval 数据闭环。
5. **P5 儿童安全与合规（后置，独立叠加）**：输入/输出双向语义审核（替换 4 条正则）、越狱防护、escalation 落库、safety eval、拟人化办法合规项。作为中间件层加入，不改动核心能力。

## 框架决策（核心结论）

**不换框架。留在 LangGraph 1.x 上补齐，把模型调用迁入 `create_agent` 子图以获得官方 middleware 体系。**

依据（详见 plan.md ADR 与来源）：
- LangGraph 1.0 已 GA（2025-10），官方承诺 2.0 前无 breaking change；2026 业界共识的对话型有状态 agent 默认底座（Klarna 8500 万用户客服 agent 同构场景）。
- DeerFlow 2.0（字节，2026-02 开源）是「分钟到小时级」长时程 SuperAgent harness，**不是低延迟多轮对话 runtime，且其本身构建在 LangGraph 之上**——采用它是负资产；其 lead-agent/subagent 模式仅作未来参考。
- OpenAI Agents SDK 绑 OpenAI 平台、Google ADK 绑 GCP——国内阿里云 + Qwen 生产环境结构性不匹配；AutoGen 已进维护模式；CrewAI 是原型工具。
- 我们已有的五层 memory、PG checkpointer、WS 流式协议（含预留的 `tool_confirm` 事件）全部保留复用。

## 非目标

- 不做多 agent 研究型 harness（DeerFlow 类）。
- 不自研 guard 模型 / Constitutional Classifiers 级方案（用 Qwen3Guard + 阿里云审核组合达到工业标准）。
- 不引入 NeMo Guardrails / guardrails-ai 整框架（英文生态，对中文儿童场景现成增益≈0）。
- 不用 LLM 直接输出 mastery 分数当真值（研究表明可靠性未验证；LLM 仅做冷启动初值 + observation 抽取）。
- 不做大爆炸式重写（业界复盘：全量重写是失败主因；一次只动一个环节，新旧并行验证）。

## 验收总标准

> 本轮重点 A1-A4（效果核心）；A5 部分（pedagogy）随 P2/P4；A6/A7（安全合规）随后置的 P5。

| # | 标准 | 对应阶段 |
|---|---|---|
| A1 | 一次真实对话中，LLM 自主调用 ≥1 个工具并据结果回答；写类工具触发前端确认卡片，学生确认后经 resume 继续；工具输出经定界包裹入 prompt | P1 |
| A2 | 学生答错练习后，下一轮 tutor 回复可证明使用了判分结果（error_diagnosis 引用错误点并取下一题） | P2 |
| A3 | ≥2 个 skill 升级为多节点状态机（socratic 追问链 / error_diagnosis 三段），行为可与 simple skill 区分 | P2 |
| A4 | 每个活跃学生每个已练习 knode 有可查询的 mastery 概率值，且 skill_router 的路由决策引用它 | P3 |
| A5 | CI 含 pedagogy LLM-as-judge 回归集，分数低于阈值阻断合并；线上会话按比例抽样评分可在 Langfuse 查看 | P2/P4 |
| A6 | （后置）输出侧流式语义审核，越狱红队集拦截率 ≥95%，escalation 落库留存 ≥6 个月 | P5 |
| A7 | （后置）拟人化办法未成年人合规项：家长可见会话、未成年人模式、2h 提醒、AI 生成标识 | P5 |

## 关联

- 评估报告：记忆 `project_tutor_maturity_assessment`（2026-07-03）
- 被本 spec 修复的历史遗留：spec 014 T4.x（工具层只做了定义+审计，从未接 LLM）、`project_tutor_tools_dead`
- 调研依据：4 份带来源调研（框架格局 / LangGraph 1.x 实践 / 儿童安全栈 / eval 与知识追踪），归档于 plan.md 附录来源清单
