# Tasks: Tutor 记忆与教学策略系统

**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)
**Design**: [docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md](../../docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md)
**Date**: 2026-04-16

---

## 使用说明

- 每个 task 独立可 commit、独立可回滚
- 每个 task 标注:依赖、产物、测试要求、验收
- commit message 格式:`<type>(tutor): <task title>`,例如 `feat(tutor): T2.1 MemoryInjector 5 层并发`
- Phase 1-6 顺序推进;Phase 内部部分任务可并行(标 `parallel:yes`)
- `[x]` 表示完成;每完成一个 task 立即勾选并 commit

---

## Phase 0:现有系统结构调研与上下文矩阵固化

> 本 Phase 必须先做,防止后续 Phase 基于错误假设。产物作为 Phase 1-6 的上下文参考。

### T0.1 生成"chatbot 调用点 × 上下文字段"矩阵文档 [ ] parallel:no

**目标**:把所有现有 chatbot 入口及透传的 context 字段固化为文档,明确每个调用场景新 tutor graph 对应的记忆层期望。

**依赖**:无

**产物**:
- `specs/014-tutor-memory-system/context-matrix.md`,内容包括:
  - 每个入口(学习页 / 浮层 / 独立聊天 / 练习页)的 URL/组件路径、透传字段、当前 session 隔离粒度
  - **简化 2-context 模型**(2026-04-16 决定):`context_scope="project"`(有具体项目,全部记忆开放跨 knode) vs `context_scope="global"`(无项目,仅 L1 + L4)
  - 每个入口对应的 tutor graph 期望(L1-L5 哪些层激活 / 哪些必须清空)
  - gateway payload 必须新增/补全的字段清单(如 `knode_id` / `user_id` / `exercise_id` / `context_scope`)

**测试**:无(文档任务)

**验收**:用户 review 后确认矩阵覆盖所有现有 chatbot 入口,无遗漏。

### T0.2 决策:ChatSession 表字段扩展方案 [ ] parallel:yes

**目标**:当前 `chat_sessions` 表只存 `id/agent_name/project_name/created_at`,新 graph 需要 `user_id`/`knode_id`/`active_skill`/`skill_turn_count`。确定:
- 方案 A:直接加字段到 `chat_sessions`(改现有表)
- 方案 B:新建 `tutor_sessions` 专表,与 `chat_sessions` 解耦

**依赖**:T0.1

**产物**:在 `context-matrix.md` 末尾追加"Schema 决策"段落,说明选择及理由

**测试**:无

**验收**:用户确认方案(本 plan 倾向 A,字段默认 NULL 向后兼容,但不强制)

---

## Phase 1:基础设施(1 周)

### T1.1 添加 langgraph 依赖(deepagents 暂留) [x] parallel:no

**依赖**:无
**改动**:
- `pyproject.toml`:添加 `langgraph>=0.2.0` / `langgraph-checkpoint-sqlite>=2.0` / `aiosqlite>=0.19.0`
- `pyproject.toml` `[tool.pytest.ini_options]` 增加 `e2e` marker
- **`deepagents>=0.4.11` 本 task 保留**:现有 `core/agent_backend.py` / `gateway/server.py` / `agents/builtin/*` / `cli/main.py` 等仍在引用,直到 T5.5 才能移除
- `pip install -e .` 在本地验证

**测试**:`python -c "import langgraph; from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver; print('ok')"` 不报错

**验收**:
- 上述 import 烟测通过
- 现有 `pytest tests/ -q` 未因依赖改动出现 regression
- `deepagents` 的最终移除记为 T5.5 的子步骤(`pip show deepagents` → not installed 的断言移到 T5.5)

### T1.2 新增 TutorConfig Pydantic 模型 + 配置字段 [x] parallel:yes

**依赖**:T1.1
**改动**:
- `src/systemedu/core/config.py` 增加 `TutorConfig` 类(字段见 plan §7.2)
- `~/.systemedu/config.yaml` 模板新增 `tutor:` 段落(通过 `systemedu config` CLI 注入)

**测试**:`tests/core/test_config.py` 增一条用例:加载带 `tutor:` 的 yaml,字段正确解析;缺 `tutor:` 时用默认值

**验收**:pytest 全绿

### T1.3 新增 4 张表 model + 扩展 chat_sessions(轻量自迁移) [x] parallel:no

> 本项目不使用 Alembic,沿用现有 `src/systemedu/storage/db.py` 的 SQLAlchemy `Base.metadata.create_all()` + `_migrate_schema()` ALTER TABLE 模式(spec 014 不引入新工具链,符合 YAGNI)。

**依赖**:T0.2(schema 决策,方案 A:直接在 `sessions` 表加字段)
**改动**:
- `src/systemedu/storage/db.py` 新增 4 个 Model:
  - `StudentFact`(见 design §6.1,含联合索引 `ix_sf_user_knode_category` / `ix_sf_user_project` / `ix_sf_valid_to`)
  - `PendingFactExtraction`(见 design §6.2,`session_id` unique)
  - `ToolCallLog`(见 design §8.2)
  - `Escalation`(见 design §8.4)
- 扩展 `ChatSession` 增加 `user_id` / `knode_id` / `active_skill` / `skill_turn_count` 字段(全部 nullable / 默认值,保证现有行可直接读出)
- 在 `_migrate_schema()` 追加 `ALTER TABLE sessions ADD COLUMN ...` 4 条向后兼容(老部署首次启动自动补列)

**测试**:`tests/test_tutor_schema.py`
- 4 张新表在 `create_all` 后存在(`sa.inspect(engine).has_table(...)`)
- 3 个联合索引存在于 sqlite_master
- 对一个预先只有旧字段的 `sessions` 表运行 `_migrate_schema()`,4 个新列被补齐,旧行数据不丢
- `StudentFact` 能 insert / query by `(user_id, project_name, category)`

**验收**:临时 DB 表结构符合 design;既有数据不丢;单测全绿

### T1.4 Checkpoint SqliteSaver 封装 [x] parallel:yes

**依赖**:T1.1, T1.2
**改动**:
- `src/systemedu/tutor/checkpoint/__init__.py`:`get_checkpointer(cfg)` 配置路由
- `src/systemedu/tutor/checkpoint/sqlite_saver.py`:aiosqlite + WAL + `synchronous=NORMAL`
- `src/systemedu/tutor/checkpoint/pg_saver.py`:`raise NotImplementedError("见 spec 016")` 骨架

**测试**:`tests/tutor/checkpoint/test_sqlite_saver.py`
- WAL 模式已启用(`PRAGMA journal_mode` 返回 `wal`)
- put/get/list 基本操作
- 同一 thread_id 多次 put 可按 step 检索

**验收**:覆盖率 100%;`pg_saver` 调用即抛 NotImplementedError

### T1.5 TutorState + 辅助 TypedDict 定义 [x] parallel:yes

**依赖**:T1.1
**改动**:
- `src/systemedu/tutor/state.py`:`TutorState` / `MemorySnapshot` / `SkillDecision`(见 design §5.1)

**测试**:`tests/tutor/test_state.py`
- `TutorState()` 空字典 / 部分字段构造能被 langgraph 接受
- `add_messages` reducer 合并正确

**验收**:pytest 全绿

### T1.6 主图骨架(空节点)能编译 [x] parallel:no

**依赖**:T1.4, T1.5
**改动**:
- `src/systemedu/tutor/graph.py`:`build_tutor_graph(...)`,5 个节点全部是 no-op(return {}),skill 循环先 skip
- `src/systemedu/tutor/nodes/*.py`:每个节点 no-op 空实现

**测试**:`tests/tutor/test_graph_skeleton.py`
- `build_tutor_graph(...).compile(checkpointer=...)` 不报错
- 单轮 invoke 从 START 到 END,checkpoint 产生一条记录

**验收**:pytest 全绿,为 Phase 2-4 提供稳定基座

---

## Phase 2:记忆层(1 周)

### T2.1 StudentFact SQLAlchemy model + DAO [x] parallel:no

**依赖**:T1.3
**改动**:
- `src/systemedu/tutor/memory/student_fact.py`:
  - `StudentFact` model 与 T1.3 迁移对齐
  - `StudentFactDAO.get_current(user_id, knode_id, category)` / `insert_with_supersede(...)` / `list_by_user(user_id, project_name=None)`

**测试**:`tests/tutor/memory/test_student_fact.py`
- insert 后 `valid_to IS NULL` 为当前
- 用 `insert_with_supersede` 覆盖后,旧记录 `valid_to` 有值、`superseded_by=new.id`
- 联合索引 `ix_sf_user_knode_category` 能被查询计划命中(SQLite `EXPLAIN QUERY PLAN`)

**验收**:覆盖率 100%;supersede 链可双向遍历

### T2.2 MemoryInjector 5 层并发(按 context_scope 激活) [x] parallel:no

**依赖**:T2.1
**改动**:
- `src/systemedu/tutor/memory/layers.py`:
  - `MemoryInjector.inject(..., context_scope: Literal["project", "global"])` 用 `asyncio.gather(return_exceptions=True)`
  - 5 个私有方法 `_l1_profile` / `_l2_project_ctx` / `_l3_knode_state` / `_l4_semantic_recall` / `_l5_skill_ctx`
  - **激活规则**(对齐 context-matrix.md §4):
    - `context_scope="project"`:L1 / L2 / L3 / L4(按 project 过滤)/ L5 **全部激活**(项目内所有 knode 事实全开)
    - `context_scope="global"`:**仅 L1 + L4**(L4 不加 project 过滤,跨项目召回);L2 / L3 / L5 返回空串
  - L3 按 `(user_id, project_name)` 过滤(不再限 knode_id,因为"项目所有记忆都开放")
  - L4 按 `(user_id, project_name)` 过滤(scope=project)或 `(user_id)` 过滤(scope=global)

**测试**:`tests/tutor/memory/test_layers.py`
- `context_scope=project`:5 层全部非空,L3 包含项目内多个 knode 的事实
- `context_scope=global`:仅 L1 / L4 有内容,L2 / L3 / L5 为空串
- L4 抛异常:其他层仍返回,L4 为空串
- 并发延迟:mock 5 个 sleep(100ms),总延迟 < 150ms(证明 gather 而非串行)

**验收**:覆盖 2 种 context_scope × Mem0 开关共 4 种组合

### T2.3 FactExtractor + supersede 判定 [x] parallel:yes(与 T2.4 同步)

**依赖**:T2.1
**改动**:
- `src/systemedu/tutor/memory/fact_extractor.py`:
  - `extract_session(pending_id)`:pull messages → LLM 抽取 → upsert
  - `_upsert_with_supersede(...)`:LLM 判断是否覆盖
  - `FACT_EXTRACTION_PROMPT` 常量(见 design §6.5)

**测试**:`tests/tutor/memory/test_fact_extractor.py`(mock LLM)
- LLM 返回合法 JSON:按 category 入库
- LLM 返回非法 JSON:重试,3 次失败标 failed
- 新事实 + 旧事实覆盖判定:旧 `valid_to` / `superseded_by` 正确设置
- `confidence<0.5` 的事实仍入库,但标记(后续 L3 查询时过滤)

**验收**:覆盖率 ≥ 90%

### T2.4 PendingFactExtraction model + DAO [x] parallel:yes

**依赖**:T1.3
**改动**:
- `src/systemedu/tutor/memory/pending_extraction.py`:model + `enqueue(session_id, ...)` / `claim_pending(limit)` / `mark_done` / `mark_failed`

**测试**:`tests/tutor/memory/test_pending_extraction.py`
- `enqueue` 幂等(`ON CONFLICT DO NOTHING`)
- `claim_pending` 把 `pending` 改为 `processing` 原子操作
- `retry_count` 累加

**验收**:并发 enqueue 同一 session_id 不重复

### T2.5 FactExtractionWorker asyncio loop [x] parallel:no

**依赖**:T2.3, T2.4
**改动**:
- `src/systemedu/tutor/worker.py`:
  - `start()`:清扫僵尸(`processing` 超 10 min → `pending`)
  - `_loop()`:每 30s tick,调 `_enqueue_fallback`(2h 兜底)+ `claim_pending` 批量处理
  - `stop()`:graceful shutdown

**测试**:`tests/tutor/memory/test_worker.py`(fake clock)
- 启动清扫生效
- 2h 兜底把无活动的 session 入队
- 单 tick 最多处理 5 条
- 失败重试递增 retry_count

**验收**:模拟 10 个并发 session,1 分钟内全部处理完成

### T2.6 Mem0 L4 集成(按 project 过滤) [ ] parallel:yes

**依赖**:T2.2
**改动**:
- `src/systemedu/memory/client.py` 扩展:`retrieve_memories(user_id, query, *, project_id=None, limit=5)`
  - 2-context 简化后 **不需要 knode_id 过滤**(项目内所有 knode 记忆开放)
  - `store_conversation(user_id, messages, *, project_id=None, knode_id=None)` 保留 knode_id metadata(方便后期溯源/分析,但查询不做 knode 过滤)
- `src/systemedu/tutor/memory/layers.py` 的 `_l4_semantic_recall`:
  - `context_scope=project`:按 `project_id` 过滤
  - `context_scope=global`:不过滤(跨项目召回)

**测试**:`tests/tutor/memory/test_mem0_integration.py`
- store 两条分别带 project_A / project_B 的对话
- retrieve with `project_id=A`:只返 A 的片段
- retrieve with `project_id=None`(global scope):返两条(无过滤)
- Mem0 关闭(`mem0_enabled=False`):直接返 []

**验收**:Mem0 disabled 时 L4 不影响主流程;2-context 切换时 L4 过滤条件正确

### T2.7 memory_inject 节点接入主图 [ ] parallel:no

**依赖**:T2.2, T1.6
**改动**:
- `src/systemedu/tutor/nodes/memory_inject.py`:调用 `MemoryInjector.inject(...)` 填充 `state.memory`
- `graph.py` 替换 no-op

**测试**:`tests/tutor/test_memory_inject_node.py`
- `context_scope=project` + project_name 非空:L1-L5 全部填充(L3 含项目所有 knode 事实)
- `context_scope=global`:只有 L1 / L4 有内容,L2 / L3 / L5 为空串
- project_name 非空但 context_scope=global(异常兜底):按 global 执行

**验收**:单轮 invoke 后 `state.memory.injected_at` 是最近时间

---

## Phase 3:Skill 系统(2 周)

### T3.1 SkillBase ABC + SkillConfig Pydantic [ ] parallel:no

**依赖**:T1.5
**改动**:
- `src/systemedu/tutor/skills/base.py`:`SkillConfig` Pydantic + `SkillBase` ABC(见 design §7.1)

**测试**:`tests/tutor/skills/test_base.py`
- `SkillConfig` 字段默认值 / 校验
- `SkillBase.build_subgraph` 抽象方法未实现时实例化报错

**验收**:后续 6 个 skill 均继承 SkillBase,API 冻结

### T3.2 SkillLoader + SKILL.md 解析 [ ] parallel:no

**依赖**:T3.1
**改动**:
- `src/systemedu/tutor/skills/loader.py`:
  - `scan()`:按 `skill_search_paths` 顺序加载,前者覆盖后者
  - `_parse_skill_md(path)`:frontmatter YAML 解析

**测试**:`tests/tutor/skills/test_loader.py`
- 解析合法 frontmatter 成功
- 缺必填字段报错
- `projects/<name>/skills/` 覆盖 `src/systemedu/tutor/skills/` 同名 skill
- `max_turns` / `priority` 默认值生效

**验收**:覆盖率 ≥ 90%

### T3.3 skill_router 节点 + prompt + knode 切换重置 [ ] parallel:no

**依赖**:T3.2
**改动**:
- `src/systemedu/tutor/nodes/skill_router.py`:
  - **入口先检查 knode 切换**:对比 `state.current_knode_id` vs 前一次 checkpoint 的 knode_id,不同则清空 `active_skill` + `skill_turn_count`(保留 messages)
  - LLM(qwen-turbo)输入 skill_catalog + active_skill + turn_count + 最近 3 消息 + L3 knode_state
  - 输出 `SkillDecision`
  - `active_skill` 超 max_turns 强制 switch(LLM 决策被 override)
- 依据:2-context 项目内单 thread 跨 knode,但教学策略需要跟随学生正在学的 knode 重新决策(见 context-matrix.md §5)

**测试**:`tests/tutor/nodes/test_skill_router.py`(FakeListLLM)
- LLM 返 continue / switch / exit 都能正确解析
- 非法 JSON 走兜底(switch 到 direct-instruction)
- turn_count >= max_turns 时强制 switch
- **knode 切换**:前一轮 knode=m1 / active_skill=socratic / turn_count=3,当前轮 knode=m2,router 入口观察到 `active_skill=None` + `turn_count=0`,走正常决策路径

**验收**:覆盖 6 种决策路径(含 knode 切换重置)

### T3.4-T3.9 六个 skill(可部分并行)

每个 skill 遵循同一模板:SKILL.md + skill.py + 单测。详见 design §7.4-§7.5。

#### T3.4 socratic-questioning [ ] parallel:yes
- max_turns=5,tools: `search_student_facts` / `get_knode_content` / `get_knode_prerequisites`
- 测试覆盖:5 种问题模板(回忆/类比/反例/假设/归纳)正确调用;连续 2 轮卡壳调整难度;到 max_turns 设置 escalation_hint;学生说"直接告诉我"触发 early exit

#### T3.5 direct-instruction [ ] parallel:yes
- max_turns=3,tools: `get_knode_content` / `get_practice_exercises` / `complete_node`
- 测试:事实查询直接回答;讲解后推送练习题

#### T3.6 scaffolding [ ] parallel:yes
- max_turns=4,tools: `get_knode_prerequisites` / `get_knode_content` / `search_student_facts`
- 测试:前置未过时拉取前置 knode 内容;前置已过继续当前

#### T3.7 error-diagnosis [ ] parallel:yes
- max_turns=2,tools: `grade_submission` / `search_student_facts` / `get_practice_exercises`
- 测试:分类 concept/calc/strategy;concept 错因转 scaffolding

#### T3.8 pbl-driving-question [ ] parallel:yes
- max_turns=2,tools: `search_student_facts` / `get_knode_content`
- 测试:新 knode 首轮抛驱动性问题;引用学生兴趣(L1 interest)

#### T3.9 reflection-prompt [ ] parallel:yes
- max_turns=3,tools: `complete_node` / `search_student_facts`
- 测试:完成任务后元认知引导;学生总结正确时建议 complete_node(需 confirm)

### T3.10 主图接入 skill 子图 [ ] parallel:no

**依赖**:T3.3 + T3.4-T3.9
**改动**:
- `graph.py` 的 skill 循环激活:遍历 `SkillLoader.list_all()`,每个注册为 `skill:<name>` 节点,包装 `_wrap_subgraph`(传入白名单过滤后的 tools)
- `route_to_skill` conditional edge 生效

**测试**:`tests/tutor/test_graph_integration.py`(FakeListLLM)
- 7 个场景(见 design §12.3)全绿

**验收**:Phase 3 完成,可进入 Phase 4

---

## Phase 4:工具 + 安全(0.5 周)

### T4.1 工具装饰器 + ContextVar 注入 [ ] parallel:no

**依赖**:T1.5
**改动**:
- `src/systemedu/tutor/tools/decorator.py`:
  - `@tutor_tool(access, confirm, scope)` 返回 LangChain `@tool`
  - `ToolMeta` dataclass
  - ContextVar `_tool_state` 存 user_id/session_id/active_skill
  - LLM 传入的 user_id 被装饰器强制覆盖

**测试**:`tests/tutor/tools/test_decorator.py`
- ContextVar 正确注入
- LLM 传 user_id 被忽略(以 ContextVar 为准)
- `confirm=True` 首次调用返 `pending_confirm`

**验收**:所有工具均用此装饰器

### T4.2 ToolRegistry + 白名单过滤 [ ] parallel:yes

**依赖**:T4.1
**改动**:
- `src/systemedu/tutor/tools/registry.py`:
  - `register(tool, meta)` / `filter_by_whitelist(names: list[str]) -> list[Tool]`

**测试**:`tests/tutor/tools/test_registry.py`
- 白名单外工具不在返回列表
- 空白名单返回空列表(禁止所有工具)

### T4.3 10 个工具实现 [ ] parallel:yes(每个独立)

**依赖**:T4.1, T2.1
每个工具单独一个 task:
- **T4.3a** `get_progress` [ ]
- **T4.3b** `complete_node`(confirm=True) [ ]
- **T4.3c** `get_knode_prerequisites` [ ]
- **T4.3d** `get_knode_content` [ ]
- **T4.3e** `search_student_facts` [ ]
- **T4.3f** `search_memory`(Mem0 客户端) [ ]
- **T4.3g** `get_practice_exercises`(剔除 `correct` 字段) [ ]
- **T4.3h** `grade_submission` [ ]
- **T4.3i** `escalate_to_human` [ ]

每个测试覆盖:正常返回 / scope 违规 / 参数校验失败 / write 工具的 confirm 流程

**验收**:`tests/tutor/tools/test_*.py` 全绿;审计日志写入

### T4.4 ToolCallLog model + 写入钩子 [ ] parallel:no

**依赖**:T1.3, T4.1
**改动**:
- `src/systemedu/tutor/audit/tool_call_log.py`:model + `log_call(call_record)` 辅助函数
- 装饰器在工具执行前后自动调用 log_call

**测试**:`tests/tutor/audit/test_tool_call_log.py`
- 正常调用:approved 为 None(非 confirm 工具)
- confirm 工具:先 pending 一条、后 approved=True 一条
- 工具抛异常:error 字段有值,latency_ms 仍记录

**验收**:100% 调用记录

### T4.5 confirm_handler 节点 [ ] parallel:yes

**依赖**:T4.3b (至少一个 confirm 工具)
**改动**:
- `src/systemedu/tutor/nodes/confirm_handler.py`:
  - 检查 state.messages 最后一条是否含 confirm 回复 metadata
  - approved=True:实际执行工具 + 写 tool_call_log(approved=True)
  - approved=False:注入 `SystemMessage("学生已拒绝操作")`

**测试**:`tests/tutor/test_confirm_handler.py`
- approved / rejected 分支
- 无 confirm 状态:直接透传

**验收**:进度写入必经 confirm 流程

### T4.6 safety_gate 节点 [ ] parallel:yes

**依赖**:T1.3
**改动**:
- `src/systemedu/tutor/nodes/safety_gate.py`:
  - `SENSITIVE_PATTERNS` 常量
  - 命中时:写 escalation + 返固定话术(含 12355)
  - `_safety_triggered=True`,skill_decision 设 exit

**测试**:`tests/tutor/test_safety_gate.py`
- 命中 4 种模式(自杀/色情/赌博/毒品)都触发
- 未命中正常透传
- 话术内容精确匹配(避免不同模型给出不同版本)

**验收**:E2E 场景 5 的前置

### T4.7 Escalation model + DAO [ ] parallel:yes

**依赖**:T1.3
**改动**:
- `src/systemedu/tutor/audit/escalation.py`:model + `open_escalation(...)` / `list_open(admin_user_id)`

**测试**:`tests/tutor/audit/test_escalation.py`
- 写入字段完整
- severity 枚举约束

---

## Phase 5:Gateway + 老 runtime 退役(0.5 周)

### T5.1 扩展 gateway payload 接受 context_scope [ ] parallel:no

**依赖**:T0.1 矩阵
**改动**:
- `src/systemedu/gateway/server.py`:
  - `POST /api/chat` 和 `WS /api/chat/stream` payload 增加可选字段:
    - `context_scope`:`"project"` | `"global"`(2-context 简化后的唯一切分)
    - `knode_id`:仅供"当前正看哪个 knode"的 skill 决策参考,**不用于 memory 过滤**(项目内所有 knode 事实开放)
    - `exercise_id`:练习页带,用于工具调用溯源
  - `user_id` 从认证会话强制注入(**不信任前端 payload**)
  - payload 校验:`context_scope` 必填;`context_scope=project` 时 `project_name` 必填;`context_scope=global` 时 `project_name` / `knode_id` 必须为 null(冲突则返 400 提示用户)
- 前端 `web/src/lib/hooks/use-websocket-chat.ts` 和 `web/src/components/chat/chat-panel.tsx`:
  - 根据当前路由推断 `context_scope`:在 `/projects/<name>/...` 任意路径 → `"project"`;否则 → `"global"`
  - 浮层进入 knode 页时 `knode_id` 跟随当前 knode,但 `context_scope` 仍是 `project`
  - **spec 015 TODO**:global scope 时前端 banner("未进入任何项目")+ 项目快捷入口(本 spec 只做后端契约,前端 UI 由 015 实现)

**测试**:`tests/gateway/test_chat_payload.py`
- `context_scope=project` + 缺 project_name:400
- `context_scope=global` + 带 project_name:400(冲突)
- `context_scope=project` + project_name + knode_id=null:通过(项目内但未进 knode 页)
- 前端伪造 user_id:被覆盖为认证会话的 user_id
- 前端侧:`tests/web/test_use_websocket_chat.ts`(jest)验证 2 种 context_scope 推断逻辑

**验收**:2 种 context_scope 正确路由到对应的记忆层激活模式(见 T2.2)

### T5.2 `/api/chat` 切换到 tutor_graph [ ] parallel:no

**依赖**:T3.10, T5.1
**改动**:
- `server.py` 的 `/api/chat` 和 `/api/chat/stream` 内部从 `AgentRuntime.stream()` 改为 `tutor_graph.astream_events(...)`
- SSE 事件类型转换(见 design §9.2)
- **thread_id 构造**(对齐 context-matrix.md §5):
  - `context_scope=project`:`thread_id = f"{user_id}:{project_name}:project-main"`(单一 thread 跨 knode)
  - `context_scope=global`:`thread_id = f"{user_id}:global"`(单一 thread)
- `config={"configurable": {"thread_id": <per above>, "user_id": ..., "project_name": ..., "knode_id": ..., "context_scope": ...}}`

**测试**:`tests/gateway/test_chat_endpoint.py`
- 端到端 SSE 流:start / token / done 事件序列正确
- tool_confirm 事件在 complete_node 时触发
- skill 事件在 router 决策时触发

**验收**:浏览器手动联调通过

### T5.3 辅助端点 [ ] parallel:yes

**依赖**:T5.1
新增:
- `POST /api/tutor/session/end`(入队 pending_fact_extraction)
- `GET /api/tutor/facts?user_id=...&project_name=...`
- `GET /api/tutor/session/:id/history`
- `DELETE /api/tutor/session/:id`(同步删 checkpoint)
- `GET /api/tutor/escalations`(管理员鉴权)

**测试**:`tests/gateway/test_tutor_endpoints.py` 每个端点基本覆盖

### T5.4 FactExtractionWorker 生命周期接入 gateway [ ] parallel:yes

**依赖**:T2.5
**改动**:
- gateway FastAPI lifespan:启动起 worker,关闭 stop

**测试**:`tests/gateway/test_worker_lifespan.py`
- 启动后 worker 运行
- 关闭时 graceful 结束(单 tick 完成再退出)

### T5.5 删除老 runtime [ ] parallel:no

**依赖**:T5.2, T5.3, T5.4(确保无人再依赖)
**步骤**:
1. `grep -r "from systemedu.core.runtime" src/ tests/`(确认引用清零)
2. `grep -r "from systemedu.agents.builtin" src/ tests/`(同上)
3. `grep -r "BaseAgent" src/ tests/`(同上)
4. `grep -r "deepagents" src/ tests/`(同上,含 `core/agent_backend.py` / `core/config.py` / `gateway/server.py` / `agents/builtin/lab_coder.py` / `agents/builtin/lab_reviewer.py` / `cli/main.py` / `tests/test_runtime.py` / `tests/test_builtin_agents_deepagents.py`)
5. 删除 `src/systemedu/core/runtime.py` / `core/agent_backend.py` / `agents/builtin/*.py` / `agents/base.py` / `agents/manager.py` / 相关测试
6. 修 `src/systemedu/core/__init__.py` 去除 `AgentRuntime` 导出
7. **`src/systemedu/skills/builtin/` 逐文件 grep 引用,属旧 runtime 的删、属 course_factory 的留**
8. **`pyproject.toml` 删除 `deepagents>=0.4.11` 依赖**(T1.1 延迟到此步)
9. `pip uninstall deepagents -y`(本地 venv 验证)+ `pip install -e .` 重装

**测试**:
- `pytest tests/ -q` 全绿
- `pip install -e .` 成功
- `pip show deepagents` 返回 not installed
- 启动服务 + 基础对话烟测

**验收**:`git log --oneline` 有一个独立 commit `refactor(tutor): T5.5 retire deepagents runtime`

---

## Phase 6:E2E + 上线(0.5 周)

### T6.1 E2E 真实 LLM 场景 1-5(基础) [ ] parallel:no

**依赖**:所有 Phase 1-5
**改动**:
- `tests/tutor/test_e2e_real_llm.py` 标记 `pytest.mark.e2e`,用 qwen-plus
- 场景 1:"我最喜欢火箭" → session 结束 → PendingFactExtraction 被消费,interest fact 入库
- 场景 2:"为什么升力向上" → 5 轮苏格拉底,0 次直接答案
- 场景 3:连续答错 → error-diagnosis → scaffolding 降阶
- 场景 4:3 轮关闭 → 30s 重开 → 第 4 轮引用前 3 轮
- 场景 5:"我觉得活着没意思" → escalation 记录 + 固定话术

**测试配置**:`conftest.py` 增加 `--e2e` flag,默认跳过;CI 单独 job 触发

**验收**:每个场景至少 3 次运行全绿(LLM 不稳定性 <10%)

### T6.2 E2E 真实 LLM 场景 6-9(2-context 边界) [ ] parallel:no

**依赖**:T6.1
**目标**:专门覆盖 2-context 简化模型下现有 chatbot 结合场景的记忆边界

#### 场景 6:项目内切 knode(单 thread 跨 knode)
- `context_scope=project`,project=mars,在同一个 thread 内先学 knode=m1 3 轮,再切到 knode=m2
- 前 3 轮在 m1 产生事实(如 "学生在 m1 的坡度概念上卡住")
- 切到 m2 后第 1 轮:
  - **memory_inject 的 L3 同时包含 m1 和 m2 的事实**(2-context 简化:项目内所有 knode 记忆开放)
  - L2(project 级)保留
  - L4 Mem0 按 `project_id=mars` 过滤(不再限 knode_id)
  - **skill_router 入口检测到 knode 切换,重置 `active_skill` + `skill_turn_count=0`**(messages 不清)
- 断言:
  - `state.memory.l3` 包含 m1 + m2 两个 knode 的关键词
  - 切换轮之后 `state.active_skill` 先是 None,router 重新决策
  - messages 历史完整保留(user 能看到前 3 轮 m1 的对话)

#### 场景 7:项目 chatbot → 全局 chatbot(切 context_scope)
- Thread A:`context_scope=project`,project=mars / knode=m3,3 轮产生 skill_state(active_skill=socratic, turn_count=2)
- Thread B(用户切到全局 chatbot,如主导航的"问 AI"):`context_scope=global` / project=null / knode=null
- 断言:
  - Thread B 新 thread_id(`user_id:global`),与 A 不共享 checkpoint
  - Thread B 的 `memory.l2 / l3 / l5` 均为空串(global scope 不激活)
  - Thread B 的 `active_skill` 从 router 重新决策(不继承 A 的 socratic)
  - Thread B 的 L1(学生兴趣/画像)与 A 共享
  - Thread B 的 L4 不过滤 project,拿到跨项目的历史召回
  - **前端侧 TODO(spec 015)**:UI 应显示"当前无项目上下文"banner + 项目快捷入口(本 E2E 只断言后端行为)

#### 场景 8:tutor / teacher / student 多 agent 隔离(同一 project scope 内)
- 浮层同一 project 下分别调 agent=tutor 和 agent=teacher,`context_scope=project`
- 在 tutor thread 内产生 StudentFact(struggle,knode=m4)
- teacher thread 调 `search_student_facts`:能拿到(因为 project 内记忆开放,且 teacher 白名单包含该工具)
- **关键**:teacher 不得消费 tutor 的 `active_skill` / `skill_turn_count`(两个 agent 独立 checkpoint thread:`:tutor:` vs `:teacher:` 后缀)
- 断言:tutor thread_id ≠ teacher thread_id;tutor 的 `active_skill=socratic` 不出现在 teacher 的 state

> 注:本 spec 只实现 tutor graph,teacher/student graph 仍是旧路径或 pass-through。场景 8 的目的是保证引入 tutor graph 不会污染其它 agent。

#### 场景 9:练习页带 exercise_id 调 chatbot(仍在 project scope)
- `context_scope=project`,payload 含 `exercise_id`
- chatbot 内调用 `grade_submission` + `search_student_facts`
- 断言:
  - tool_call_log 记录 `exercise_id` 作为上下文
  - StudentFact 入库时 metadata 含 exercise_id 溯源
  - L3 包含 "当前练习 X 上的尝试" 文字
  - 与场景 6 共用同一 `user_id:project:project-main` thread_id(练习页不单独开 thread)

**验收**:4 个场景真实 LLM 各跑 3 次,成功率 100%(硬要求,关系到产品正确性)

### T6.3 性能基线 CI [ ] parallel:yes

**依赖**:T6.1
**改动**:
- `tests/perf/test_latency_baseline.py`:pytest-benchmark
  - `memory_inject` 单轮 p95 < 200ms
  - checkpoint put p95 < 10ms
  - fact_extractor 吞吐 > 10 session/分钟
- 基线结果写 `docs/bench/014-baseline.json`
- CI 在回归 > 20% 时失败

**验收**:CI 跑通,基线文件提交

### T6.4 部署 runbook [ ] parallel:yes

**依赖**:T5.5
**改动**:
- `docs/ops/tutor-memory-system.md`:
  - 首次部署:alembic migrate + config.yaml 新增段落
  - 回滚步骤:alembic downgrade + 恢复老代码 git ref
  - 常见问题:checkpoint DB 锁、Mem0 不可达、fact_extractor 积压

**测试**:在生产服 47.92.200.21 试一次完整 deploy(用户监督)

**验收**:runbook 按步执行零报错

### T6.5 监控配置 [ ] parallel:yes

**依赖**:T5.2
**改动**:
- `src/systemedu/tutor/metrics.py`:轻量 counter + histogram(使用 stdlib,不引入 prometheus_client,避免依赖膨胀)
- 暴露 `/api/tutor/metrics`(仅本地查)
- 关键指标:
  - `tutor_memory_inject_latency_ms` histogram
  - `tutor_skill_router_decision_total{action}` counter
  - `tutor_fact_extractor_success_total` / `..._failed_total`
  - `tutor_escalation_total{severity}`

**验收**:本地访问 `/api/tutor/metrics` 返回可读指标

### T6.6 Spec 状态更新 + 文档同步 [ ] parallel:no

**依赖**:T6.1, T6.2, T6.3, T6.4, T6.5
**改动**:
- `specs/014-tutor-memory-system/spec.md` 顶部加 `Status: shipped (YYYY-MM-DD)`
- `docs/prd.md` Phase checklist 更新
- `docs/todolist.md` 新识别的 backlog 项(预计:spec 015/016/017 立项)

**验收**:三文件一次 commit 推送

---

## 进度追踪

| Phase | 任务数 | 已完成 | 剩余估时 |
|------|-------|-------|---------|
| P0 | 2 | 0 | 0.5d |
| P1 | 6 | 0 | 5d |
| P2 | 7 | 0 | 5d |
| P3 | 10 | 0 | 10d |
| P4 | 7 | 0 | 2.5d |
| P5 | 5 | 0 | 2.5d |
| P6 | 6 | 0 | 3d |
| **总计** | **43** | **0** | **~28 工作日** |

---

## 关键不变量(实施过程中每次 commit 前自检)

1. 每个 task 对应至少 1 个测试文件,覆盖率不下降
2. 每个 commit message 格式 `<type>(tutor): TN.N <title>`
3. 不跳 task;如某 task 发现前置不足,停下补前置而不是绕过
4. LLM 行为改动必须真实 LLM 验证(不仅是 FakeListLLM)
5. E2E 场景 6-9 是本 spec 的**硬门槛**,任一场景不过视为未完成
6. 写入操作(StudentFact / ProgressRecord / Escalation)必经 confirm 或 safety_gate
7. `user_id` 绝不信任 LLM 或前端 payload,以 gateway 认证为准

---

## 相关文件

- Spec:[spec.md](./spec.md)
- Plan:[plan.md](./plan.md)
- Design:[../../docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md](../../docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md)
- 宪法:[../../.specify/memory/constitution.md](../../.specify/memory/constitution.md)
- Context matrix(T0.1 产物,待生成):[context-matrix.md](./context-matrix.md)
