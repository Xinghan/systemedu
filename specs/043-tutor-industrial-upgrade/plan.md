# Plan 043: Agent Tutor 工业化改造 — 实施方案

Status: draft (2026-07-03) · 前置: spec.md 已确认

---

## 0. 框架决策 ADR

**决定：留在 LangGraph 1.x；把 tutor 的「模型调用 + 工具循环」收敛为 `langchain.agents.create_agent` 子图挂进现有主图；不引入任何新 agent 框架。**

| 候选 | 结论 | 理由 |
|---|---|---|
| **LangGraph 1.x（现有）** | **留任** | 1.0 GA (2025-10)，承诺 2.0 前无 breaking change；对话型有状态 agent 业界默认底座（Klarna/LinkedIn/Uber 生产）；我们的五层 memory、PG checkpointer、WS 流式全在其上 |
| DeerFlow 2.0 (字节, 75.9k stars) | 不采用 | 定位「分钟到小时级」长时程 SuperAgent harness（sandbox+并行子agent），非低延迟对话 runtime；**其自身就构建在 LangGraph 上**；lead-agent 拆解模式留作未来参考 |
| OpenAI Agents SDK | 排除 | Sessions/Guardrails 抽象值得抄设计，但 tracing/平台绑 OpenAI，国内生产不可直连 |
| Google ADK 2.x | 排除 | 深绑 Vertex AI/GCP，国内不可用 |
| AutoGen / AG2 | 排除 | 官方维护模式，新用户被导向 MS Agent Framework |
| CrewAI | 排除 | 原型工具，持久状态/细粒度控制弱 |
| PydanticAI 2.x | **可选局部引入** | 仅用于 fact_extractor_worker 类结构化抽取（类型安全输出），与主栈并存 |

**迁移策略（业界增量迁移共识）**：一次只动一个环节，新旧路径并行对比输出后切流，绝不大爆炸重写。

**关键技术事实**（升级排雷，来自官方文档核实）：
- `langgraph.prebuilt.create_react_agent` 已 deprecated → 一律用 `langchain.agents.create_agent(model, tools, middleware=[...], checkpointer=...)`
- middleware（before_model / after_model / wrap_tool_call / HumanInTheLoopMiddleware / PIIMiddleware）**只对 create_agent 生效**——这是迁 create_agent 子图的最强理由
- langgraph ≥1.0.2 的 `ToolNode` 错误处理默认关闭 → 显式 `handle_tool_errors=True`
- 子图默认继承父图 checkpointer，子图内 `interrupt()` 官方支持
- Qwen (DashScope compatible-mode)：qwen-plus/max 支持 function calling；`parallel_tool_calls` 默认关（**保持关闭**，串行更易审计）；tool-calling 请求显式 `enable_thinking=False`；流式 tool_call_chunks 由 langchain-openai 自动累积
- PG checkpointer 升 `langgraph-checkpoint-postgres` 3.1.x：连接必须 `autocommit=True` + `row_factory=dict_row`；**设 `LANGGRAPH_STRICT_MSGPACK=true`（多租户 SaaS 安全红线）**；夜间 checkpoint 清理任务防表膨胀；AgentState 加字段一律 `NotRequired` + 默认值

---

## 1. 现状锚点（改造落点，已代码核实）

```
主图: START → confirm_handler → safety_gate → (cond) → memory_inject → skill_router → skill_X → output_stream → END
```

| 文件 | 现状 | 本计划动它的阶段 |
|---|---|---|
| `core/tutor/skills/_common.py` | `call_llm` 只 ainvoke 无 bind_tools；`build_simple_skill_subgraph` 单节点 respond→END；文件头自注「Tool integration lands in Phase 4」——从未兑现 | P1 重写 |
| `core/tutor/nodes/safety_gate.py` | 4 条中文正则 + 固定文案短路；无落库 | P0 升级为分层管线 |
| `core/tutor/tools/`（registry/decorator/10 工具） | 定义完好，零实例化 | P1 接通 |
| `core/tutor/audit/tool_call_log.py` | `make_log_sink` 完好，生产不调用 | P1 接通 |
| `student-app/chat/tutor_runner.py` | `astream_events(v2)` 逐 token 转发 WS chunk；**WS 协议已预留 `tool_confirm`/`escalation` 事件** | P0 插输出审核缓冲；P1 接 interrupt-resume |
| `student-app/chat/memory_layers.py` | 五层注入，成熟资产 | 不动（P3 加 mastery 注入） |
| `student-app/chat/exercise_routes.py` | exercise attempt POST 已有 | P2/P3 作为判分与 BKT 数据源 |
| 主图节点 `confirm_handler` | 假设 pending_confirm 但从未触发 | P1 激活 |

---

## 2. Phase 5（后置）— 儿童安全与合规红线（约 2-3 周）

> **本轮不做。** 重排后安全/合规从关键路径移出——它作为独立的中间件层，在核心能力（P1-P4）就位后可直接叠加，不改动 tutor 效果链路。方案在此完整保留待用；GPU 方案届时再评估（当前无 GPU 则用 qwen-turbo API 审核过渡）。
>
> 唯一提前到 P1 的一条：**工具输出 Spotlighting 定界**——它是让 tool-use「正确」（防被恶意 knode 内容/注入污染）的一部分，不是合规项，故跟着 tool-use 一起做（见 §3.1）。
>
> 原则：云端合规层 + 自托管语义层双层。正则保留为第 0 层（零成本挡明显词）。

### 0.1 输出侧审核（最高优先级，现状为零防护）

**架构**：`Qwen3Guard-Stream-4B`（自托管，token 级流式分类）为主 + 阿里云百炼「AI 安全护栏」（请求头开启，与 DashScope 调用零改造集成）异步复核落库。

- 新增 `core/tutor/guard/` 模块：
  - `stream_guard.py`：包装 tutor_runner 的 chunk 转发循环——句级缓冲（按标点切段）送 Qwen3Guard-Stream，`safe` 放行、`controversial` 继续缓冲攒上下文复判、`unsafe` 立即终止流 + 撤回信号 + 兜底话术。vLLM 部署于生产 ECS（4B 模型，24G 卡即可；若暂无 GPU，先用 qwen-turbo 做句级审核调用过渡，成本低延迟可接受）。
  - `cloud_audit.py`：异步调百炼护栏/内容安全 API 复核全文，结果落 `moderation_log` 表（含 86+ 标签中的未成年人专项标签），**留存 ≥6 个月**（网安法第 21 条）。
- 改 `student-app/chat/tutor_runner.py` `stream()`：chunk 先进 stream_guard 再 yield；新增 WS 事件 `{"type":"retract"}`（前端撤回已渲染的违规段）。

### 0.2 输入侧升级（替换「只有 4 条正则」）

改 `safety_gate.py` 为三层管线（保留节点位置与「命中即短路 + 固定文案」骨架——红队确认这个骨架是对的）：
1. L0 正则（现有 4 条 + 扩充），零成本；
2. L1 Qwen3Guard-Gen-0.6B（CPU 可跑）语义分类：自伤/色情/暴力/越狱等 9 类；
3. L2 阿里云「提示词攻击审核」API（15 元/万次）查 prompt injection。

**分级路由**（不再一刀切）：自伤/自杀信号 → 干预话术分支 + `escalation` 落库 + 家长通知；越狱 → 拒答 + 计数（重复触发限流）；一般违规 → 现有固定文案。

### 0.3 Escalation 落库与审计

- `student-app/db.py` 新增 `Escalation` 表 + `moderation_log` 表（alembic 迁移）；safety_gate 的 `_safety_matched_patterns` 从「只发 WS 事件」改为同时落库——补上 safety_gate.py docstring 里承诺过但没人做的 post-hook。

### 0.4 Safety eval 进 CI（堵「测错对象」）

- `tests/eval/safety/`：DeepEval（pytest 原生集成）+ 儿童安全红线数据集 ≥100 case（同义/拼音/变体/越狱样本；不代做作业；年龄适配语言），judge 用 Qwen 走 DashScope 自定义 model 类（不依赖境外 API）。低于阈值阻断合并。
- 红队：Promptfoo 开源版**锁版本**使用（已被 OpenAI 收购，不绑其云端）。

### 0.5 合规项（拟人化办法 2026-07-15 施行，最紧迫）

- 立即做产品自评：tutor 的人格化/情感化程度是否落入「持续性情感互动」——**无论结论如何按其未成年人条款建设**（这也是 GB/T 45654-2025 备案测评依据）：
  - <14 岁注册须监护人同意流程（student-web 注册链路）
  - 未成年人模式：连续使用 2 小时提醒；家长可见会话记录接口（`/api/parent/sessions`）+ 数据删除接口
  - tutor 人设约束进 system prompt + 输出审核规则：**禁虚拟亲属/伴侣型亲密关系**（云端通用审核不覆盖，需自定义判据）
  - AI 生成内容显式标识（前端 chat 面板标注，标识办法 2025-09 已施行）
- 小学段（≤12 岁）适配教育部指南：开放式自由生成收敛为结构化引导模板（苏格拉底式提问/选项式），**学段作为 guard 管线路由维度**。

**Phase 0 验收**：A1 + A6；越狱红队集拦截率 ≥95%；DashScope 平台绿网误拦时有儿童友好兜底话术（需 PoC 实测阿里云审核 RT，>300ms 则输入同步+输出流式/异步混合）。

---

## 3. Phase 1 — Tool-use 闭环（约 3-4 周）

> 把「伪 agent」变「真 agent」。两步走，每步可独立上线回滚。

### 1.1 第一步：现有图内手工接通（最小侵入，1 周）

- `core/tutor/graph.py` build 时实例化 `ToolRegistry` + `register_many`（10 个现有工具）；per-skill `filter_by_whitelist(skill.config.tools)`。
- 重写 `_common.py build_simple_skill_subgraph` 为标准 tool 循环：
  ```
  llm.bind_tools(whitelisted) → agent 节点 → tools_condition → ToolNode(tools, handle_tool_errors=True) → 回 agent
  ```
- `wrap_tool_call` 时机接通 `audit/tool_call_log.make_log_sink`（第一步先在 ToolNode 外包审计函数）。
- Qwen 参数：`enable_thinking=False`、`parallel_tool_calls` 保持关。
- **Spotlighting 定界**：工具返回内容包 `<tool_output>` 定界标记再入 prompt（防间接注入——接工具前必须就位，红队/OWASP 共识）。
- 先接 3 个读类工具：`get_progress` / `get_knode_content` / `get_practice_exercises`（免确认直接放行）。

### 1.2 第二步：迁 `create_agent` 子图（获得 middleware 体系，1-2 周）

- 把 skill 的模型调用收敛为 `create_agent(model, tools, middleware=[...])` 编译图，以共享 `messages` key `add_node` 进主图（自动读写父图 state，继承 checkpointer）。
- middleware 栈（按序叠层）：
  1. `before_model`：输入安全复检（Phase 0 的 guard 复用）
  2. `HumanInTheLoopMiddleware(interrupt_on={"complete_node", "grade_submission", "escalate_to_human"})`——写类/副作用工具需确认
  3. `PIIMiddleware`：自定义中国手机号/身份证/学校地址 regex，输入 block、输出 redact
  4. `after_model` + `can_jump_to=['end']`：输出审核挂点（与 stream_guard 互补）
  5. `ToolCallLimitMiddleware`：单轮工具调用限次（儿童场景防失控循环）
  6. `ModelFallbackMiddleware`：Qwen 主模型失败降级
- 五层 memory 注入保持在父图 `memory_inject` 节点**不动**。

### 1.3 HITL 前端闭环

- 后端：interrupt payload 经现有 `astream_events` 流出 → tutor_runner 转发**已预留的** WS `tool_confirm` 事件；学生/家长确认后前端回传 → `Command(resume=decision)` 恢复同一 thread_id。
- 前端 `student-web`：FloatingChat 渲染确认卡片（approve/reject）。
- 纪律：interrupt 前副作用幂等；不裸 try/except 包 interrupt；不在循环里 interrupt。

### 1.4 checkpoint 加固（随手做）

- 升 `langgraph-checkpoint-postgres` 3.1.x；`LANGGRAPH_STRICT_MSGPACK=true`；夜间 checkpoint 清理 worker（复用 fact_extractor_worker 模式）；池 sizing `workers × max_size < PG max_connections × 0.7`。

**Phase 1 验收**：A2；工具集成测试从 0 → 覆盖 10 工具；审计日志生产可查；新旧路径（纯 chat vs tool-agent）并行灰度对比一周无回归后全量。

---

## 4. Phase 2 — 形成性闭环 + 教学评测（约 3-4 周）

### 2.1 判分反哺（ITS 核心闭环）

- `grade_submission` 结果写 `exercise_attempt` 表（已有 POST 链路）→ 注入 L3 练习历史（memory_layers 已读此表，天然贯通）→ `error_diagnosis` / `scaffolding` skill 的 prompt 显式要求引用最近错误点并取下一题（调 `get_practice_exercises`）。
- `skill_router` 路由信号加入「最近答题正误」。

### 2.2 Skill 真差异化（回应红队「6 段文案」批评）

- 至少 2 个 skill 升级为多节点状态机：
  - `socratic_questioning`：追问链状态（questions_asked / breakthrough 检测 → 升降脚手架）
  - `error_diagnosis`：诊断 → 验证猜想（调工具取题）→ 针对性讲解 三段
- 其余 4 个保持 simple 子图（避免过度工程）。

### 2.3 内容 grounding

- skill prompt 加引用约束：知识性回答须标注来源 knode 段落；`after_model` 检查引用存在性（简单幻觉检测：所引 knode id 必须真实存在于 L3 注入内容）。

### 2.4 教学质量 eval（不自造轮子）

- 裁剪三份现成资产合成中文 rubric（10-15 条，适配 6-18 岁 PBL）：MathTutorBench（EMNLP 2025，开源可复用）任务分解 + BEA 2025 Shared Task 维度（错误识别/引导性/可执行性）+ LearnLM 25 项 rubric。
- 进 DeepEval CI：pedagogy 回归集（含「不代做作业」「苏格拉底式引导」判定）。

**Phase 2 验收**：A3；pedagogy CI 阈值门禁生效。

---

## 5. Phase 3 — 学习者建模（约 4-6 周，研究攻坚）

### 3.1 BKT 而非深度模型（数据量决定）

- 每 knode = 一个技能点。`pyBKT` 离线拟合 4 参数（先验/学习率/猜测/失误）；线上自实现 4 参数 HMM 增量更新（数百行，无重依赖）。
- 数据源：exercise_attempt 流水。冷启动（<50 学生/技能）用文献默认参数 + 项目 difficulty 先验；攒够数据夜间任务重拟合。
- 新表 `knode_mastery (user_id, project, knode_id, p_mastery, n_obs, updated_at)`。

### 3.2 LLM 的正确角色（禁越界）

- LLM 只做两件事：(a) 新学生冷启动从少量对话给 mastery 初值（CLST 思路）；(b) 把对话中的理解证据抽成结构化 observation（答对/答错/求助）喂 BKT——复用 fact_extractor_worker 管道加一类 output。**禁止 LLM 直接报 mastery 当真值**。

### 3.3 耦合驱动自适应

- mastery 注入 memory L1/L3；`skill_router` 路由信号加入 mastery（低掌握 → scaffolding/direct，高掌握 → socratic/reflection）；知识树 DAG prereq × mastery → 「建议下一个 knode」（学习页可视化，pyKT 深度模型留作数据量上来后的离线升级选项）。

**Phase 3 验收**：A4。

---

## 6. Phase 4 — 可观测性与 eval 闭环（约 2 周，可与 P2/P3 并行）

- **Langfuse self-host** 部署阿里云（docker compose 单机够用：<100 万 traces/月；新增 ClickHouse + MinIO/OSS，复用已有 docker PG/Redis 运维）。
- 接入成本极低：LangChain CallbackHandler 传进 graph invoke config 即可，不改图结构；五层 memory 注入内容进 trace metadata（坏例按 memory 层归因）。
- 线上会话按比例抽样 LLM-as-judge（safety + pedagogy rubric）；数据闭环：Langfuse traces → 标注坏例 → 导出 DeepEval 回归集 → prompt/模型变更 CI 必跑。
- 埋点面向 OTel GenAI 语义约定但**封装薄适配器**（gen_ai.* 仍 experimental，不硬编码属性名）。
- 明确不用：LangSmith（Enterprise 门槛 + 国内无官方可用性保障）、OpenAI Evals（2026-11 关停）。

**Phase 4 验收**：A5。

---

## 7. 依赖变更清单

```toml
# packages/core/pyproject.toml 新增/升级
langgraph-checkpoint-postgres = ">=3.1"   # PG checkpointer 加固
# 可选: pydantic-ai >=2.0 (fact_extractor 结构化抽取)

# 生产新增服务
# - vLLM + Qwen3Guard-Stream-4B (GPU) 或过渡期 qwen-turbo 审核调用
# - Qwen3Guard-Gen-0.6B (CPU 可跑)
# - Langfuse (docker: clickhouse + minio + web/worker)

# 云服务开通
# - 阿里云内容安全: 文本审核增强版 + 百炼 AI 安全护栏 + 提示词攻击审核 (均按量, 月成本估个位数元/活跃学生以下)

# dev 依赖
deepeval = ">=4.0"        # CI eval
# promptfoo (锁版本, npm) — 红队
```

## 8. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 输出流式审核增加首 token 延迟 | 句级缓冲仅延后完整句渲染；PoC 实测阿里云 RT，>300ms 走「输入同步 + 输出流式自托管 + 云端异步复核」 |
| ToolNode 1.0.2 错误处理默认关闭 | 显式 `handle_tool_errors=True`，升级排雷清单进 PR checklist |
| 在途老 thread 因 state 加字段崩溃 | AgentState 新字段一律 `NotRequired` + 默认值 |
| DashScope 平台绿网误拦 | 实测误拦率，设计儿童友好兜底话术 |
| Qwen thinking 模式与 function calling 未定义行为 | tool-calling 路径显式 `enable_thinking=False` |
| 大爆炸重写 | 每阶段新旧并行灰度，对比无回归再切流 |
| 拟人化办法适用性误判 | 无论自评结论如何，未成年人条款照做（同时是 GB/T 45654 备案要求） |

## 9. 时间线总览（重排后：效果优先，安全后置）

```
P1 工具闭环   ██████████░░░░░░░░  周 1-4    (本轮首要: 先手工接通再迁 create_agent)
P2 形成性+教学 ░░░░███████░░░░░░  周 4-8    (判分反哺 + skill 真差异化)
P4 可观测+eval ░░░░░░░█████░░░░░  周 6-9    (与 P2 并行, pedagogy eval 进 CI)
P3 知识追踪   ░░░░░░░░░███████░░  周 8-14   (依赖 P1/P2 攒的 exercise 数据)
P5 安全合规   ░░░░░░░░░░░░░░████  之后独立叠加 (中间件层, 不阻塞上述)
```

核心能力约 3-3.5 个月。安全合规作为后续独立一层加入。每阶段完成 → 更新本 spec Status + docs/prd.md + 走既有 commit/push 纪律。

## 附录：调研来源

四份调研共 80+ 可核来源（GitHub/官方文档/arXiv/网信办原文），关键项：
- 框架：github.com/bytedance/deer-flow · blog.langchain.com/langchain-langgraph-1dot0 · learn.microsoft.com AutoGen 迁移指南
- LangGraph 1.x：docs.langchain.com middleware/interrupts/subgraphs · help.aliyun.com Qwen function-calling · langgraph-checkpoint-postgres 3.1.0
- 安全：github.com/QwenLM/Qwen3Guard (arXiv:2510.14276) · 阿里云内容安全定价/标签文档 · 网信办拟人化办法 (2026-04-10 公布) · GB/T 45654-2025 · 教育部中小学 AI 使用指南 (2025)
- eval/KT：DeepEval 4.x · Langfuse self-host 文档 · pyBKT (arXiv:2105.00385) · MathTutorBench (arXiv:2502.18940) · BEA 2025 (arXiv:2507.10579) · KT+LLM 综述 (arXiv:2412.09248)
