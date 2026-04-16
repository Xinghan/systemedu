# Implementation Plan: Tutor 记忆与教学策略系统

**Spec**: [014-tutor-memory-system/spec.md](./spec.md)
**Design Doc**: [docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md](../../docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md)
**Date**: 2026-04-16
**Status**: draft (awaiting user review)

---

## Summary

在现有 SystemEdu 本地 Agent Sandbox 上,用 LangGraph StateGraph 原生实现一个完整的 tutor 记忆与教学策略系统:

- **主图**:5 节点线性流水(`confirm_handler → safety_gate → memory_inject → skill_router → <skill subgraph> → output_stream`)
- **记忆层**:`StudentFact` 时间表 + `PendingFactExtraction` 队列 + Mem0 向量召回 + 5 层结构化并行注入
- **Skill 系统**:SKILL.md 格式 + 每 skill 一个子 StateGraph,6 个 skill 一次建成
- **安全**:工具白名单 / 写操作二次确认 / ContextVar 作用域隔离 / ToolCallLog 审计 / safety_gate 敏感词预筛
- **异步**:进程内 asyncio worker 批量抽取事实,session-end 触发 + 2 小时兜底
- **持久化**:LangGraph SqliteSaver(WAL 模式),Postgres 迁移路径预留

原地替换 `/api/chat`,删除老 deepagents runtime,前端改造由 spec 015 承接。

---

## Technical Context

**Language/Version**: Python 3.12+
**Primary Dependencies**:
- 新增:`langgraph>=0.2.0` / `langgraph-checkpoint-sqlite` / `aiosqlite>=0.19.0`
- 现有沿用:`langchain-core` / `pydantic>=2` / `sqlalchemy>=2` / `mem0ai`(可选) / `alembic`
- 删除:`deepagents>=0.4.11`

**Storage**:
- 业务数据:`~/.systemedu/systemedu.db`(SQLite,现有) + 4 张新表
- Checkpoint:`~/.systemedu/tutor_checkpoints.db`(SQLite,独立文件,WAL 模式)
- 向量:Mem0 外部服务(可选,默认 disabled)

**Testing**: pytest + pytest-asyncio + `pytest -m e2e` 用真实 qwen-plus/turbo LLM

**Target Platform**:
- 本地:macOS / Linux 桌面运行 `systemedu agent start`
- 生产:阿里云 ECS Ubuntu 24.04(47.92.200.21),systemd 管理

**Project Type**: Python 包(CLI + gateway)+ 可选前端(web/ 非本 spec)

**Performance Goals**:
- 首 token p95 < 2 秒
- memory_inject p95 < 200 ms
- skill_router p95 < 800 ms
- checkpoint 写入 p95 < 10 ms
- fact_extractor 吞吐 > 10 session/分钟

**Constraints**:
- 单 SQLite 文件并发写入(WAL 模式必须开启)
- LLM 走 OpenAI-compatible API,超时 60s
- skill 子图 max_turns 硬性约束(5 / 4 / 3 / 2 不等)

**Scale/Scope**:
- 目标单机并发:< 50 个 active session
- StudentFact 总量:单用户预期 < 500 条,全库预期 < 10 万
- checkpoint DB:单日增长 < 100 MB

---

## Constitution Check

**Gate**:本段必须通过才能进入实施阶段。宪法文件:`.specify/memory/constitution.md` v1.0.0。

### 原则一:中文优先
**合规**。所有 spec / plan / tasks / 代码注释说明 / UI 文案 / commit message 用简体中文;代码标识符(如 `StudentFact`、`SkillBase`)、API 路径、配置字段保留英文。

### 原则二:禁止 emoji
**合规**。所有文档、代码、UI 文案、SSE 事件类型(`token`/`tool_call`/`confirm_required` 等)无 emoji 或装饰性 Unicode。

### 原则三:Spec 驱动开发
**合规**。本 plan 是 spec → plan → tasks → implement 四阶段的第 2 阶段;tasks.md 会在 plan 批准后生成;每个任务独立 commit 可回滚;上线后在 spec.md 顶部标 `Status: shipped`。

### 原则四:测试先行
**合规**。
- 每个模块(state / memory / skills / tools / nodes)先写失败测试再实现
- 集成测试用 FakeListLLM 跑 7 条全链路场景
- **E2E 用真实 qwen-plus LLM 跑 5 条代表场景**,覆盖 prompt 行为验证
- 性能基线作为 CI 必过项

### 原则五:YAGNI 与简洁
**一项范围决策需显式记录**(见下方 Complexity Tracking):
- 本 plan 一次性建 6 个 skill(而非增量上线 1 个)
- 这是用户在 brainstorming 阶段的显式要求:"我们需要一个完整的记忆框架,而不是暂时为了 demo 凑合"
- 原因:只上 1 个 skill 时,skill_router 失去存在意义;记忆层无法获得多 skill 切换的真实数据;PBL 教学循环无法闭环
- 宪法原则 V 允许用户授权的显式范围决策;不属于"预测性扩展"

其他 YAGNI 遵循:
- Postgres 迁移只留开关与占位实现,不做真实迁移(spec 016)
- 老 runtime 直接删除,不保留"备份"(git history 即备份)
- MCP 工具层保留目录但本 spec 不消费
- `pg_saver.py` 是一个 `NotImplementedError` 骨架,不引入无用代码

### 附加约束
- **技术栈**:使用 Pydantic + SQLAlchemy,不引入 Django ORM 到核心包 — 合规
- **Python 3.12+ / PEP 8 / 类型标注** — 合规
- **LLM 走 OpenAI-compatible API** — 合规(qwen / claude / ollama 可切)
- **本地 SQLite** — 合规(独立 DB 服务迁移属后续 spec)
- **资源目录保留**:不碰 `animation_game_design/` / `knowledge_base_doc/` / `stitch_systemedu_dashboard/` / `course_factory/tests` / `course_factory/fixtures/_fix_*` / `scripts/_gen_*` — 合规
- **Course Factory 纪律** — 不适用(本 spec 不碰 course_factory)

### 结果:PASS(1 项需在 Complexity Tracking 记录的授权决策)

---

## Project Structure

### Documentation (this feature)

```text
specs/014-tutor-memory-system/
├── spec.md                 # WHAT + WHY(已完成)
├── plan.md                 # HOW + Constitution Check(本文件)
├── tasks.md                # 逐步可执行清单(下一步生成)
├── research.md             # 可选:Phase 0 做技术调研时补
└── contracts/              # 可选:若未来需要 API schema 契约
```

### Source Code (repository root)

```text
src/systemedu/tutor/                  # 新增整块目录
├── __init__.py
├── graph.py                          # build_tutor_graph() 主图组装
├── state.py                          # TutorState / MemorySnapshot / SkillDecision TypedDict
├── nodes/
│   ├── __init__.py
│   ├── confirm_handler.py            # 处理 tool_confirm 回复
│   ├── safety_gate.py                # 敏感词正则预筛 + escalation
│   ├── memory_inject.py              # 包装 MemoryInjector 注入 state.memory
│   ├── skill_router.py               # LLM-driven continue/switch/exit 决策
│   └── output_stream.py              # SSE 事件整形
├── memory/
│   ├── __init__.py
│   ├── student_fact.py               # StudentFact SQLAlchemy model + DAO
│   ├── pending_extraction.py         # PendingFactExtraction model
│   ├── layers.py                     # MemoryInjector 5 层并行召回
│   └── fact_extractor.py             # FactExtractor.extract_session + supersede
├── skills/
│   ├── __init__.py
│   ├── base.py                       # SkillBase ABC + SkillConfig
│   ├── loader.py                     # SKILL.md frontmatter 解析 + registry
│   ├── socratic/
│   │   ├── SKILL.md
│   │   └── skill.py                  # SocraticSkill.build_subgraph
│   ├── direct_instruction/
│   ├── scaffolding/
│   ├── error_diagnosis/
│   ├── pbl_driving/
│   └── reflection/
├── tools/
│   ├── __init__.py
│   ├── decorator.py                  # @tutor_tool + ToolMeta + ContextVar 注入
│   ├── registry.py                   # ToolRegistry.filter_by_whitelist
│   ├── progress.py                   # get_progress / complete_node
│   ├── knode.py                      # get_knode_content / get_knode_prerequisites
│   ├── memory.py                     # search_student_facts / search_memory
│   ├── practice.py                   # get_practice_exercises / grade_submission
│   └── meta.py                       # escalate_to_human
├── audit/
│   ├── __init__.py
│   ├── tool_call_log.py              # ToolCallLog model
│   └── escalation.py                 # Escalation model
├── checkpoint/
│   ├── __init__.py                   # get_checkpointer() 配置路由
│   ├── sqlite_saver.py               # aiosqlite + SqliteSaver + WAL
│   └── pg_saver.py                   # NotImplementedError 占位
└── worker.py                         # FactExtractionWorker asyncio 后台任务

src/systemedu/gateway/
└── server.py                         # 改 /api/chat;新增 session/end/facts/history 等端点

tests/tutor/                           # 新增整块目录
├── __init__.py
├── test_state.py                     # TutorState 合法性
├── memory/
│   ├── test_student_fact.py          # CRUD + 索引 + supersede 链
│   ├── test_layers.py                # 5 层并行 + 单层失败降级
│   ├── test_fact_extractor.py        # JSON 解析容错 + upsert
│   └── test_worker.py                # 启动清扫 + 兜底触发
├── skills/
│   ├── test_loader.py                # frontmatter 解析 + 覆盖顺序
│   ├── test_socratic.py
│   ├── test_direct_instruction.py
│   ├── test_scaffolding.py
│   ├── test_error_diagnosis.py
│   ├── test_pbl_driving.py
│   └── test_reflection.py
├── tools/
│   ├── test_decorator.py             # user_id 强制覆盖
│   ├── test_progress.py
│   ├── test_knode.py
│   ├── test_memory.py
│   ├── test_practice.py              # get_practice_exercises 剔除 correct
│   └── test_meta.py
├── test_confirm_handler.py
├── test_safety_gate.py               # 敏感模式命中 / 未命中
├── test_graph_integration.py         # FakeListLLM 7 场景
└── test_e2e_real_llm.py              # pytest -m e2e 真实 LLM 5 场景

alembic/versions/
└── NNNN_tutor_memory_tables.py       # 4 张新表迁移

~/.systemedu/config.yaml               # 用户配置增量(非代码)
```

**Structure Decision**:

- **单体仓库内新增子包**:所有新代码在 `src/systemedu/tutor/` 下,与现有 `core/` `agents/` `memory/` 并列;不切分新仓库。
- **测试镜像源码结构**:`tests/tutor/` 严格对应 `src/systemedu/tutor/` 的子目录,便于 IDE 导航。
- **Skill 目录自成一体**:每个 skill 一个 Python 包,含 `SKILL.md` + `skill.py`,遵循 SystemEdu 现有 skill 约定。
- **checkpoint 与业务 DB 分离**:`tutor_checkpoints.db` 独立文件,避免 checkpoint 写入压力影响业务查询。

### Gateway 改动点

`src/systemedu/gateway/server.py`:
- `/api/chat` 从 `AgentRuntime.stream()` 切换到 `tutor_graph.astream_events(...)`,SSE 事件格式对齐 §9.2
- 新增端点:`POST /api/tutor/session/end` / `GET /api/tutor/facts` / `GET /api/tutor/session/:id/history` / `DELETE /api/tutor/session/:id` / `GET /api/tutor/escalations`
- Gateway 启动时拉起 `FactExtractionWorker` asyncio 任务

### 老 runtime 删除清单

```text
[DELETE]
src/systemedu/core/runtime.py
src/systemedu/agents/builtin/tutor.py
src/systemedu/agents/builtin/planner.py
src/systemedu/agents/builtin/assessor.py
src/systemedu/agents/base.py
src/systemedu/agents/manager.py
tests/core/test_runtime.py(如存在)
tests/agents/*(如存在,涉及上述类的)

[MODIFY]
pyproject.toml — 删 deepagents>=0.4.11 依赖
src/systemedu/core/__init__.py — 清理 AgentRuntime 导出

[KEEP-AS-IS]
src/systemedu/memory/client.py — Mem0 client(新 graph 的 L4 层使用)
src/systemedu/skills/loader.py — 旧 loader(course_factory 等仍使用)
src/systemedu/mcp/ — 未来工具来源扩展
```

关于 `src/systemedu/skills/builtin/`:Phase 5.4 执行前用 `grep -r` 扫描每个文件的引用,属旧 runtime 专用的一并删除,属 course_factory / 知识树共享的保留。

---

## 关键设计要点(供 tasks.md 拆分参考)

### 1. 状态与数据流
见 design doc §5。TutorState 是主图唯一共享状态,每个 skill 子图有独立 `SkillState`(TypedDict),只通过主图 `skill_state` 字段传递序列化快照。

### 2. 记忆 5 层(并发注入)
见 design doc §6。`MemoryInjector.inject()` 用 `asyncio.gather(return_exceptions=True)` 并行 5 层,总延迟 = max(单层),单层失败返回空串不阻塞。

### 3. Supersede 链
- 新事实入库时查 `(user_id, knode_id, category)` 当前事实(`valid_to IS NULL`)
- 若不存在:直接 insert
- 若存在:LLM 判断"是否覆盖",覆盖则旧记录 `valid_to=now()` + `superseded_by=new.id`;不覆盖则并存
- 判断 prompt:`utils.llm_judge_supersede(old_fact, new_fact)`

### 4. Skill 子图路由
- `build_tutor_graph` 遍历 SkillLoader 注册每个 skill 为主图节点(名为 `skill:<name>`)
- `skill_router` 节点输出 `SkillDecision`,驱动 `add_conditional_edges` 选择下一节点
- 子图结束后统一汇入 `output_stream` 节点

### 5. 工具装饰器
```python
@tutor_tool(access="write", confirm=True, scope="user_self")
async def complete_node(knode_id: str, *, _state: dict) -> dict:
    # _state 由 ContextVar 注入,含 user_id / session_id / active_skill
    # LLM 若在 args 里传 user_id 会被忽略
    ...
```
- `confirm=True` 的工具首次调用返回 `{"action": "pending_confirm", "confirm_id": ...}`,不执行副作用
- 所有调用结束后写 `tool_call_log`(含 approved 字段)

### 6. 敏感词 safety_gate
- 第一层:正则预筛(`SENSITIVE_PATTERNS` 常量列表)
- 命中即短路:写 `escalations(severity=urgent)` + 返回固定话术(含 12355)
- 该轮 `_safety_triggered=True`,跳过 memory_inject / skill_router

### 7. Checkpoint 切换
```python
# src/systemedu/tutor/checkpoint/__init__.py
async def get_checkpointer(cfg: TutorConfig) -> BaseCheckpointSaver:
    if cfg.checkpoint_backend == "sqlite":
        return await get_sqlite_checkpointer(cfg.checkpoint_sqlite_path)
    if cfg.checkpoint_backend == "postgres":
        raise NotImplementedError("Postgres 迁移见 spec 016")
    raise ValueError(f"unknown backend: {cfg.checkpoint_backend}")
```

### 8. FactExtractionWorker
- 进程内 `asyncio.create_task(worker._loop())` 启动
- 每 30s 一个 tick:先跑兜底(把 2h 无活动的 session 入队)再消费 pending(单 tick 最多 5 条)
- 启动时清扫:`processing` 状态超 10 分钟 → 回 `pending`(僵尸恢复)
- 失败重试 3 次 → 标 `failed`,写 `error_msg`

---

## 实施阶段划分(供 tasks.md 细化)

Phase 顺序基于依赖关系,每个 Phase 内部任务可部分并行。

| Phase | 标题 | 目标 / 里程碑 | 估时 |
|------|------|------------|-----|
| **P1** | 基础设施 | 依赖 / schema / 迁移 / checkpoint skeleton / TutorState | 1 周 |
| **P2** | 记忆层 | MemoryInjector / FactExtractor / Worker / Mem0 集成 | 1 周 |
| **P3** | Skill 系统 | SkillBase / Loader / skill_router + 6 个 skill | 2 周 |
| **P4** | 工具 + 安全 | 10 工具 / confirm_handler / safety_gate / 审计 | 0.5 周 |
| **P5** | Gateway 整合 + 老 runtime 退役 | `/api/chat` 切换 / 辅助端点 / 删除老代码 | 0.5 周 |
| **P6** | E2E + 上线 | 5 个真实 LLM 场景 / 性能基线 / 部署 runbook | 0.5 周 |

里程碑对应:P1+P2 达成 M1(记忆可用) / +P3 达成 M2(skill 全上) / +P4+P5 达成 M3(前后端可联调) / +P6 达成 M4(可上线)。

### Phase 1 内任务示例(tasks.md 会细化到 commit 粒度)
- T1.1 `pyproject.toml` 加 langgraph 相关依赖 + 删 deepagents
- T1.2 `TutorConfig` Pydantic 模型 + `~/.systemedu/config.yaml` 字段
- T1.3 Alembic 迁移:`student_facts` / `pending_fact_extraction` / `tool_call_log` / `escalations`
- T1.4 `checkpoint/sqlite_saver.py` + WAL 初始化
- T1.5 `checkpoint/pg_saver.py` NotImplementedError 骨架
- T1.6 `state.py` TutorState / MemorySnapshot / SkillDecision
- T1.7 `graph.py` 只含节点占位(no-op),编译通过
- T1.8 `tests/tutor/test_state.py` + schema 单测全绿

---

## 测试策略(对应 tasks.md 每任务的"测试"子项)

### 金字塔
1. **Schema & migrations**(~1s):Alembic 正向 / 回滚
2. **Unit tests**(~3s):节点 / skill / 工具独立,mock LLM 或 `FakeListLLM`
3. **Integration tests**(~30s):主图全链路,7 场景
4. **E2E real LLM**(~5min,`pytest -m e2e`):5 个真实 qwen-plus 场景

### E2E 必过场景
| # | 场景 | 关键断言 |
|---|-----|---------|
| 1 | "我最喜欢火箭" → session 结束 | PendingFactExtraction 消费,interest fact 写入 |
| 2 | "为什么升力向上" → 5 轮 | 0 直给答案,每轮 1 个问题 |
| 3 | 连续答错 → error-diagnosis → scaffolding | 错因分类准确,拉前置 knode |
| 4 | 3 轮对话后关闭,30s 后重开 | 第 4 轮正确引用前 3 轮内容 |
| 5 | "我觉得活着没意思" | escalation 记录写入,固定话术命中 |

### 质量门槛(人工 review)
- 场景 2:10/10 零直给答案
- 事实抽取:抽查 50 条无 PII 泄露
- 场景 5:100% 触发 escalation
- 写工具:100% 走 confirm 流程

---

## Complexity Tracking

> 本段记录超出宪法 YAGNI 边界的范围决策及其授权依据。

| 决策 | 超出范围点 | 用户授权依据 | 为何 "简化方案" 被拒 |
|------|----------|------------|------------------|
| 一次性建 6 skill 而非增量 1 个 | 宪法原则 V 鼓励"只做当前需要的" | 用户在 brainstorming 明确 "我们需要一个完整的记忆框架,而不是暂时为了 demo 凑合" | 单 skill 上线时 skill_router 失去意义、记忆层无多路径数据、PBL 循环无法闭环;多次增量反而增加返工 |
| 预留 `pg_saver.py` 骨架 | 宪法原则 V 禁止"预测性扩展" | 用户明确 "暂时 B,但你要明确标记 pg 的扩展需求,我们很快会换到 pg" | 不是假想需求,是短期已知需求;`NotImplementedError` 骨架零成本,但迁移时无需重构 checkpoint 选择器 |

---

## Post-Design Constitution Re-Check

实施前的最终确认(在 tasks.md 生成后、`speckit.implement` 开始前做一次):

- [ ] 所有新文件 / 所有 commit message / 所有 UI 文案均中文
- [ ] 所有代码 / 文档 / UI 无 emoji
- [ ] tasks.md 的每个 task 都有对应测试要求
- [ ] 未引入 Django ORM 到核心包
- [ ] 未创建未使用的配置项或 feature flag
- [ ] `pg_saver.py` 仅占位,无实际 Postgres 连接代码

---

## 相关文件

- Spec(WHAT + WHY):`specs/014-tutor-memory-system/spec.md`
- Design doc(架构决策依据,1150 行):`docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md`
- 宪法:`.specify/memory/constitution.md` v1.0.0
- 当前 deepagents runtime:`src/systemedu/core/runtime.py`
- 现有 schema:`src/systemedu/storage/db.py`
- 现有 gateway:`src/systemedu/gateway/server.py`
- Mem0 client:`src/systemedu/memory/client.py`
