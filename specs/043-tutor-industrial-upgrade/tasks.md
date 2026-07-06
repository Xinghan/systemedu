# Tasks 043: Agent Tutor 工业化改造（效果优先版）

Status: draft (2026-07-03) · 重点 P1→P2→P4→P3；P5 安全合规后置不在本清单

约定：`[ ]` 未开始 / `[~]` 进行中 / `[x]` 完成。每个 Phase 完成后 commit + push + 更新 spec Status。
测试硬规则：每个功能附测试才可提交；LLM/prompt 行为必须用真实 Qwen 跑代表性用例，不凭推断。

---

## Phase 1 — Tool-use 闭环（本轮首要，周 1-4）

### 1A. 第一步：现有图内手工接通（最小侵入，可独立上线回滚）

- [x] T1.1 `graph.py` build 时实例化 `ToolRegistry`，`register_many` 注册 9 个现有工具（memory/practice/progress/meta），per-skill `filter_by_whitelist(skill.config.tools)`
- [x] T1.2 重写 `skills/_common.py`：新增 `build_tool_loop_subgraph`（agent 节点 → `tools_condition` → `ToolNode(tools, handle_tool_errors=True)` → 回 agent）；scaffolding/pbl 切 tool 循环；`_wrap_subgraph` 只回传最终纯文本 AIMessage
- [x] T1.3 Qwen 参数落实：新增 `tools/binding.py` `bind_tutor_tools`——`parallel_tool_calls=False`（全 OpenAI 兼容）；DashScope 端点额外 `extra_body={enable_thinking:False}`（防御 Qwen3 thinking 机型）；非 ChatOpenAI/fake 走 bare bind 兜底。真实 Qwen 验证: 双意图问题裸bind吐2并行 vs 改造后串行1
- [x] T1.4 **工具输出 Spotlighting 定界**：`_spotlight_tool_messages` 把 ToolMessage 用 `<tool_output tool=...>...</tool_output>` 包裹再入 prompt；幂等；加固：包裹前中和 payload 内伪造的 `</tool_output>`（零宽空格断标签）防 fence-escape。**红队结论(真实 Qwen)**：定界只能挡"纯标签逃逸"（`pure_fence_escape` 0/3 劫持），对"正文含强命令"的注入无力（弱模型+弱system 下 10/24→10/24 无净收益）。定界是**纵深防御一层非主力**；注入主防线仍是 system prompt「工具返回是数据勿执行」+ 模型对齐 + 输出侧校验。见 `tests/tutor/manual/redteam_tool_injection.py`
- [~] T1.5 数据层抽象已做（`TutorDataProvider` Protocol + `StudentDataProvider` + `push_tool_context` 注入）；**审计 log_sink 落表仍待做**（core `make_log_sink` 用 core `ToolCallLog` 表 vs student-app 自有 schema 不匹配，tool 循环不依赖，audit follow-up）
- [x] T1.6 3 个读类工具全链路验证：真实 Qwen 跑 `get_progress` 通过（据结果答"已完成3关/共30关/剩26关"，未编造）
- [x] T1.7 测试：`test_tool_loop`（fake LLM tool_call→执行→回灌→最终纯文本，3 passed）+ `test_tool_binding`（provider 参数决策 15 passed）+ `tests/tutor/manual/real_qwen_tool_loop.py`（真实 Qwen 端到端，功能场景硬门禁 PASS）

### 1B. 第二步：迁 `create_agent` 子图（拿官方 middleware 体系）

- [x] T1.8 `_common.py` 新增 `build_agent_subgraph`：收敛「模型调用 + 工具循环」为官方 `langchain.agents.create_agent`；memory 经 `@dynamic_prompt` 到 system（复用 `render_memory_block`）；`@wrap_model_call` 做 spotlight 定界 + 注入 `tutor_tool_bind_kwargs`（parallel_tool_calls=False / DashScope enable_thinking）到 `model_settings`；`state_schema` 扩 `memory`(total=False)；scaffolding/pbl 切此路径。**对外契约与手写 `build_tool_loop_subgraph` 一致**：输入 `{messages,memory}`、只回最终纯文本 AIMessage、输出 state 仅 `{messages,memory}`（无 middleware key 污染 skill_state，已探测确认）。测试 `test_agent_subgraph.py` 7 passed（含全图集成）；真实 Qwen `scenario_create_agent` PASS（调 get_progress + 定界 + 据真实进度答，与手写路径等价）
- [~] T1.9 middleware 栈：`ToolCallLimitMiddleware(run_limit=8, exit_behavior="end")` + `HumanInTheLoopMiddleware`(写类工具 interrupt, 按 `meta.access=="write"` 自动选 interrupt_on, 见 1C) 已接入；`ModelFallbackMiddleware`(Qwen 降级) 待做（fallback follow-up）
- [x] T1.10 升级排雷 checklist 过：无 `create_react_agent` 残留（用 create_agent）；`build_tool_loop_subgraph` 的 ToolNode `handle_tool_errors=True`；create_agent 内建 ToolNode 默认 handle_tool_errors；新 state 字段 `memory` 为 `total=False`（AgentState 子类）

### 1C. HITL 前端确认闭环

**设计决策（2026-07-04 定，方案A）**：用 LangGraph 原生 `interrupt` + 官方
`HumanInTheLoopMiddleware`，不激活自研 `confirm=True` 短路（后者非真暂停、模型会
继续、与 T1.9 official middleware 要求不符）。已用真实 middleware 探测确认契约：
- **interrupt 触发**：写类工具执行前，`after_model` 调 `interrupt(req)` 暂停；
  `astream_events` 吐 `on_chain_stream`(name=LangGraph) 的 chunk 含 `__interrupt__`；
  更稳的判据是流停后 `graph.aget_state(cfg).next` 非空 + `.interrupts[0].value`。
- **interrupt payload**：`{action_requests:[{name,args,description}], review_configs:
  [{action_name, allowed_decisions}]}` → 转成 WS `tool_confirm`（含 confirm_id）。
- **resume 格式（关键坑）**：middleware 内部 `interrupt(req)["decisions"]`，故 resume
  值必须是 `Command(resume={"decisions":[{"type":"approve"}|{"type":"reject","message":..}]})`，
  **不是裸 list**（裸 list 会 `TypeError: list indices must be integers`）。
- **approve** → 工具真执行 → 模型据结果答；**reject** → 工具不执行 → 合成一条
  reject ToolMessage 喂模型 → 模型换个说法答。

- [x] T1.11 后端：`build_agent_subgraph` 挂 `HumanInTheLoopMiddleware`（按工具
  `meta.access=="write"` 自动选 interrupt_on）；`tutor_runner.stream(resume_provider=)` 检测
  interrupt(`aget_state().next` + `.interrupts`)→ 发 WS `tool_confirm` → 经 resume_provider
  拿决策 → `Command(resume={"decisions":[..]})` 续跑同一 thread_id。**同时彻底拆掉旧自研
  confirm 子系统**（decorator `confirm=True` + `confirm_handler_node` + `confirm_required`
  state + 两 tutor_runner 读取）——实测二者并存会静默吞掉 approve 后的写工具执行。
  WS handler(`routes.py`) 传 `_await_decision`(读客户端 `tool_decision` 帧, 陈旧/非法帧
  fail-safe reject)。测试: `test_agent_subgraph`(interrupt/approve/reject 3 例) +
  `test_tutor_runner_hitl`(stream 编排+mapper 10 例) + `test_chat_ws_hitl`(WS 往返 3 例)
- [x] T1.12 前端 `student-web`：`ToolConfirmCard`(message-bubble.tsx) 暖纸色+coral 边卡片,
  写工具友好文案(complete_node→"标记这一关为完成"/grade_submission/escalate)+args 摘要+
  approve("标记完成")/reject("先不要")；chat-store 加 `pendingConfirm`；use-websocket-chat
  处理 `tool_confirm`→弹卡 + `sendDecision` 发 `tool_decision`(socket 断则报错不静默丢)；
  done/error 清卡。真实 Next 运行时渲染已截图验证。**同时把 direct-instruction 迁到
  build_agent_subgraph**——原来它(+error_diagnosis)是唯一带写工具的 skill 却用手写 call_llm
  文本子图不调工具, 卡片无处触发; 迁后能真调 complete_node 走 HITL(explain→check→complete
  流程移进 SKILL.md prompt, 弃用无人消费的 should_push_exercise/stage)
- [x] T1.13 HITL 纪律自检：interrupt 由 middleware 拥有(非手写)；写工具副作用在 interrupt
  之后才跑(幂等无需, 因根本没执行)；WS 的 interrupt 等待不被裸 try/except 吞(WebSocketDisconnect
  单独 catch 干净退出, 保留 checkpoint)；不在循环里 interrupt(单 pending call)
- [x] T1.14 测试：后端 e2e 三层(subgraph/stream/WS)覆盖 approve+reject+fail-safe；全图集成
  `test_full_graph_direct_instruction_write_tool_interrupts`(routed→di→complete_node→interrupt
  →approve→执行)；**真实 Qwen `scenario_hitl_write_tool` PASS**——Qwen 自主调 complete_node,
  图中断, 中断时 mark_complete 未跑, approve 后才跑(args 正确)。前端卡片真实运行时渲染截图验证

### 1D. checkpoint 加固（随手做）

- [ ] T1.15 升 `langgraph-checkpoint-postgres` >=3.1；连接 `autocommit=True`+`row_factory=dict_row`；设 `LANGGRAPH_STRICT_MSGPACK=true`
- [ ] T1.16 夜间 checkpoint 清理 worker（复用 fact_extractor_worker 模式，按 thread 最后活跃时间删旧）

**P1 验收 A1**：真实对话中 LLM 自主调工具并据结果回答；写类工具前端确认+resume；工具输出定界。工具集成测试 0→覆盖 10 工具。新旧路径（纯 chat vs tool-agent）灰度对比一周无回归后全量。

---

## Phase 2 — 形成性闭环 + 教学法真差异化（周 4-8）

### 2A. 判分反哺（ITS 核心闭环）

- [x] T2.1 `grade_submission` 接通并落 `exercise_attempt`：**关键前置——把 error_diagnosis 从
  手写 call_llm 文本子图迁到 `build_agent_subgraph`**(原来它是唯一带 grade_submission 的 skill
  却根本不调工具, 判分反哺无从触发)。`StudentDataProvider.grade_submission` 已判分 + best-effort
  `record_exercise_attempt` 写表(先前已建)。grade_submission 是写工具→HITL 确认后才判分。
- [x] T2.2 L3 练习历史注入贯通：`memory_layers._l3_history_query` 读 `list_exercise_attempts`
  (当前 module 全部 + 项目级最近 5 条错的), 格式化成"答题 N 题对 X 错 Y + 错题+你答"进
  `l3_knode_content` → 到达下一轮 prompt(已验证)。
- [x] T2.3 `error_diagnosis`/`scaffolding` SKILL.md 显式要求引用学生**具体**最近错题(不泛泛),
  error_diagnosis 三段(诊断→验证猜想调 grade_submission→取下一题 get_practice_exercises);
  scaffolding 从最近错处切入降阶。
- [x] T2.4 `skill_router` ROUTER_PROMPT 加 foregrounded「最近答题正误」槽位：`_recent_answer_signal`
  从 l3 记忆抽答题 tally + 错题行(丢课程正文), 让「连续答错2次→error-diagnosis」可靠触发。
- [x] T2.5 测试：全图集成 `test_full_graph_error_diagnosis_grade_submission_interrupts`(routed→
  error-diagnosis→grade_submission→HITL 中断→approve 后判分)；**真实 Qwen `scenario_formative_
  reference_error` PASS**——L3 放"PM2.5单位答'米'"错题, Qwen 回复引用了该具体错题 + 取了下一题。

### 2B. Skill 真差异化（回应红队「6 段文案」批评）

- [x] T2.6 `socratic_questioning` 多节点状态机加固：assess→(ask_question|scaffold_down)。
  **breakthrough/stuck 检测从 keyword 换成 LLM 分类**(`_llm_classify`, keyword 兜底; "直接告诉我"
  硬 fast-path)；**修掉旧缺陷**——原 set_escalation 把内部 routing hint 当学生消息发出, 现
  scaffold_down 给学生**真正的降阶帮助**(先给小例子+线索再问小问题), escalation_hint 只进
  skill_state 供 router **不泄漏给学生**；升降脚手架显式(单轮卡→拆更小/类比, 突破→收敛)。
- [~] T2.7 `error_diagnosis` 三段（诊断→验证猜想调 grade_submission→取下一题 get_practice_exercises）：
  **走 tool 循环(build_agent_subgraph) 实现而非硬状态机**（2026-07-06 定, 避免过度工程 cf T2.8）——
  三段靠 SKILL.md prompt 引导 + 真实工具调用, 已随 T2.1 落地并真实 Qwen 验证。若后续证明 prompt
  引导不稳再升硬状态机。
- [x] T2.8 其余 skill 保持 simple/tool-loop 子图（避免过度工程）；socratic 是唯一硬状态机。
  pbl_driving_question/reflection_prompt 仍 simple；direct_instruction/error_diagnosis/scaffolding
  走 tool 循环。
- [x] T2.9 测试：socratic 状态机行为单测(assess LLM 分类 + keyword 兜底 + scaffold_down 不泄漏 hint,
  test_builtin_skills 8 例)；grounding 单测(test_grounding 12 例)；真实 Qwen `scenario_socratic_
  state_machine`(exploring 提问 vs 2x-stuck scaffold_down 真帮助+不泄漏) + `scenario_grounding_
  no_fabrication`(材料没讲不编造臭氧机理) 均 PASS。

### 2C. 内容 grounding

- [x] T2.10 skill prompt 加引用约束：`GROUNDING_INSTRUCTION` 追加到知识性 skill(direct_instruction/
  scaffolding/error_diagnosis, `ground_knowledge=True`)的 prompt——只依据【当前课程内容】、没讲的
  如实说没讲、不编造小节编号。问答类 skill(socratic/pbl/reflection)不加(它们提问非断言)。
- [x] T2.11 简单幻觉检测：`check_knode_grounding` 抽回答里的 knode-id token(如 M07)校验是否在 L3
  注入内容里, 不在则 `warn_if_ungrounded` 记 WARNING(flag-only 不阻断/重试, 后续可喂 eval)。
  接进 build_agent_subgraph 的 wrap_model_call(只查最终纯文本回复)+ simple 子图。

**P2 验收 A2+A3**：答错后下一轮引用判分结果并取下一题 (A2 ✓)；≥2 skill 行为可区分 (A3 ✓:
socratic 硬状态机 vs simple/tool-loop skill 运行时行为差异, 真实 Qwen 佐证)。

---

## Phase 4 — 可观测性 + pedagogy eval（与 P2 并行，周 6-9）

### 4A. Langfuse 自托管

- [ ] T4.1 Langfuse 部署阿里云（docker compose：clickhouse>=24.3 + minio/OSS + web/worker；复用已有 docker PG/Redis 运维）
- [ ] T4.2 LangGraph 接入：LangChain `CallbackHandler` 传进 graph invoke config（不改图结构）
- [ ] T4.3 五层 memory 注入内容进 trace metadata（坏例按 memory 层归因）
- [ ] T4.4 埋点封装薄适配器（不硬编码仍 experimental 的 gen_ai.* 属性名）

### 4B. pedagogy eval 进 CI

- [ ] T4.5 合成中文教学 rubric（10-15 条，适配 6-18 岁 PBL）：裁剪 MathTutorBench 任务分解 + BEA 2025 维度（错误识别/引导性/可执行性）+ LearnLM 25 项
- [ ] T4.6 `tests/eval/pedagogy/`：DeepEval（pytest 集成）+ pedagogy 回归集，judge 用 Qwen 走 DashScope 自定义 model 类（不依赖境外 API）
- [ ] T4.7 CI 门禁：pedagogy 分数低于阈值阻断合并
- [ ] T4.8 eval 数据闭环：Langfuse traces → 标注坏例 → 导出 DeepEval 回归集

**P4 验收 A5（pedagogy 部分）**：pedagogy CI 门禁生效；线上采样评分可在 Langfuse 查看。

---

## Phase 3 — 学习者建模 / BKT 知识追踪（依赖 P1/P2 数据，周 8-14）

### 3A. BKT 落地

- [ ] T3.1 新表 `knode_mastery (user_id, project, knode_id, p_mastery, n_obs, updated_at)`（alembic 迁移）
- [ ] T3.2 `pyBKT` 离线拟合 4 参数（先验/学习率/猜测/失误），数据源 exercise_attempt 流水
- [ ] T3.3 在线 4 参数 HMM 增量更新（自实现数百行，无重依赖）：每次 attempt 更新对应 knode 的 p_mastery
- [ ] T3.4 冷启动策略（<50 学生/技能）：文献默认参数 + 项目 difficulty 先验；夜间任务攒够数据重拟合

### 3B. LLM 的正确角色（禁越界）

- [ ] T3.5 复用 fact_extractor_worker 管道加一类 output：把对话中的理解证据抽成结构化 observation（答对/答错/求助）喂 BKT
- [ ] T3.6 LLM 冷启动：新学生从少量对话给 mastery 初值（CLST 思路）
- [ ] T3.7 **禁止 LLM 直接报 mastery 当真值**（研究表明不可靠）— code review 卡这条

### 3C. 耦合驱动自适应

- [ ] T3.8 mastery 注入 memory L1/L3
- [ ] T3.9 `skill_router` 路由信号加入 mastery（低掌握→scaffolding/direct，高掌握→socratic/reflection）
- [ ] T3.10 知识树 DAG prereq × mastery → 「建议下一个 knode」（学习页可视化）
- [ ] T3.11 测试：BKT 更新单测（已知序列→期望 p_mastery）；mastery 驱动路由的集成测试

**P3 验收 A4**：每活跃学生每已练习 knode 有可查询 mastery；skill_router 引用它。

---

## Phase 5 — 儿童安全（原后置，2026-07-06 起第一片）

红队把"Safety 输出侧 0 过滤"列为儿童产品最大风险(critical)。本片先把输出侧从 0→1
(本地规则层)，语义 judge / 阿里云审核作为第二层后续叠加。

### 5A. 输出侧过滤（A6 第一片）

- [x] T5.1 `core/tutor/safety/output_filter.py`：纯函数 `check_output_safety(text)->OutputSafetyVerdict`
  本地规则层，6 类危险模式(self_harm/weapons_explosives/dangerous_procedure/adult_sexual/
  solicit_pii/jailbreak_leak)。**键在"可操作的伤害"形态(方法/指令/索取)而非敏感名词**，避免误伤
  教学内容(摩擦力/化学反应/历史暴力讨论/含能材料原理 均不拦)。self_harm/solicit_pii 触发
  escalation。`SAFE_FALLBACK` 兜底文案(对称输入侧)。**异常 fail-open**(放行+log, 检查器崩了不能
  拦所有回复)。judge 挂点预留未实现。
- [x] T5.2 `tutor_runner`：**决策——缓冲学生可见最终回复+出口前检查**(流式逐 token 会让危险内容
  离开后端才拦)。stream() 攒完整段→check_output_safety→通过发原文/命中发 SAFE_FALLBACK +
  `safety_blocked` 事件(不发原文);中间态(tool_confirm)照常即时发。invoke() 同样检查。
  代价:失去逐字打字机效果(换成整段出现)——儿童安全优先于打字机效果。
- [x] T5.3 前端 `use-websocket-chat`：处理 `safety_blocked` 事件(escalate 类提示找信任大人;
  一般拦截不弹惊吓,兜底文案已温和引导);types/api.ts 补事件类型。
- [x] T5.4 测试：`test_output_filter`(6 类命中 + 11 条教学内容不误伤 + escalation + fail-open, 32 例);
  `test_tutor_runner_output_safety`(stream/invoke 危险替换+正常放行+分段危险整条替换不泄漏, 5 例);
  真实 Qwen `scenario_output_safety`(真实教学回复不误拦 + 合成危险内容被拦, PASS)。

**P5 验收 A6(第一片)**：输出侧危险内容在离开后端前被拦并替换(本地规则层);真实 Qwen 教学回复
0 误伤。语义 judge(Qwen3Guard)/阿里云审核/越狱红队集≥95%/escalation 落库 = 后续第二片。

---

## 依赖变更（本轮）

```toml
# packages/core/pyproject.toml
langchain = ">=1.0"   # [已加 T1.8] umbrella 包: create_agent + agent middleware
                      # (HITL/ToolCallLimit/ModelFallback); 连带 core→1.4.8 / langgraph→1.2.7, 全套件无回归
langgraph-checkpoint-postgres = ">=3.1"
# packages/student-app 或 core: pybkt (P3)

# dev
deepeval = ">=4.0"   # pedagogy CI eval (P4)

# 生产新增服务
# - Langfuse (docker: clickhouse + minio + web/worker)  — P4
# 安全层 Qwen3Guard / 阿里云审核 — 本轮不涉及 (P5 后置)
```

## 每阶段 DoD（完成定义）

1. 功能实现 + 测试通过（含真实 Qwen 验证 LLM 行为）
2. 新旧路径灰度对比无回归（P1 强制，P2/P3 视情况）
3. commit + push + 更新 spec.md Status + docs/prd.md
4. Development Loop 第 5-6 步：回顾并向用户提改进建议
