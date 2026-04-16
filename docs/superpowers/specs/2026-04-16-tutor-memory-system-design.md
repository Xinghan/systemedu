# Tutor Memory System Design

**Date**: 2026-04-16
**Status**: Design (awaiting user review)
**Owner**: SystemEdu Core Team
**Related**: `specs/014-deerflow-tutor-setup/` (will be rewritten from this design)

---

## 1. 背景 & 目标

### 1.1 背景

SystemEdu 是本地优先的 AI Agent Sandbox 教育平台。当前 tutor 运行时基于 `deepagents` 包，存在以下局限：

- **无状态恢复**：对话状态只存文本（`messages` 表），浏览器刷新 / 重启即丢失图级中间状态
- **无结构化学生模型**：Mem0 只做向量召回，无法精确追踪"学生在某 knode 卡在哪"
- **无教学策略层**：LLM 单轮响应，无法在"苏格拉底引导 / 直接讲解 / 降阶"之间切换
- **无安全机制**：敏感话题、写操作、工具越权没有防护

### 1.2 目标

构建一个**一步到位**的 tutor 记忆与教学策略系统，覆盖：

1. **LangGraph StateGraph 原生架构**（替代 deepagents）
2. **完整记忆框架**：
   - 结构化事实表（StudentFact，支持时间线 supersede）
   - 语义向量召回（Mem0）
   - 5 层结构化记忆注入
3. **6 个教学 skill 子图**：苏格拉底 / 直接讲解 / 脚手架 / 错因诊断 / 驱动性提问 / 元认知
4. **完整安全机制**：skill 白名单 / 二次确认 / 作用域隔离 / 审计日志 / 敏感话题升级
5. **生产可扩展**：SQLite checkpoint（当前），Postgres 迁移路径明确

### 1.3 非目标

- **前端 UI 改造**：单开 spec 015 处理
- **多 Agent 并行编排**：只做单 agent tutor
- **MCP 工具扩展**：保留 `src/systemedu/mcp/` 但 graph 不消费
- **知识树生成 / 评估 agent**：老 `agents/builtin/{planner,assessor}.py` 删除，未来单独 spec

---

## 2. 关键架构决策

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| D1 | 记忆存储层 | StudentFact 时间表 + Mem0 | 零额外服务，兼结构化追踪 + 语义召回 |
| D2 | 事实分类粒度 | 5 大类 + metadata JSON | 高频字段 knode_id 独立提取，其他走 JSON |
| D3 | 对话全文 | 保留在 ChatMessage，StudentFact 只存 evidence_msg_ids 指针 | 避免冗余,通过 JOIN 取证 |
| D4 | 时间演化 | Soft delete + supersede 链 | 保留学生成长轨迹(家长/老师视角) |
| D5 | 抽取触发 | Session 结束 + 2h 兜底 | 不影响用户体验延迟,上下文完整 |
| D6 | Worker 实现 | Gateway 内 asyncio 后台任务 | 本地开发零心智,幂等设计保证重启恢复 |
| D7 | Skill 架构 | 每 skill = 独立 LangGraph 子图 | 多步流程表达自然,skill 本地 state 隔离 |
| D8 | 第一阶段 skill | 6 个全套 | 覆盖完整 PBL 教学循环 |
| D9 | Checkpoint DB | 本地 SQLite (WAL) + Postgres 迁移路径预留 | 当前单实例够用,代码预留切换开关 |
| D10 | Gateway 迁移 | `/api/chat` 原地替换,无灰度 | 尚未上线,直接硬切 |
| D11 | 老 runtime | 直接删除 | 不留死代码,git history 可恢复 |
| D12 | Mem0 定位 | L4 层并行注入(非兜底) | 完整记忆框架,非 demo 凑合 |
| D13 | 记忆注入方式 | 5 层分层结构化 | LLM 对齐各层信息,单层可独立调优 |
| D14 | 工具集 | 10 个全集一步到位 | skill 能力不打折 |
| D15 | 写操作 | 二次确认机制 | 避免 LLM 误判污染学生进度 |
| D16 | 测试策略 | 分层单元测试 + 端到端真实 LLM | 符合 CLAUDE.md "LLM 行为必须真实验证" |

---

## 3. 顶层架构

```
┌─────────────────────────────────────────────────────────────┐
│  前端 (web/)                                                 │
│  POST /api/chat (SSE stream)                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  Gateway (src/systemedu/gateway/)                           │
│  - 新端点处理器：invoke tutor graph with thread_id          │
│  - SSE 流式推送 token / tool_confirm / done 事件             │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  Tutor Graph (src/systemedu/tutor/)                         │
│                                                              │
│  主图 StateGraph:                                            │
│  confirm_handler → safety_gate → memory_inject →            │
│    skill_router → [skill subgraph] → output_stream          │
│                                                              │
│  Skill 子图（6 个独立 StateGraph）                          │
│    socratic / direct / scaffolding / error-diagnosis /      │
│    pbl-driving / reflection                                 │
└──────┬──────────────┬──────────────┬─────────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐
│ Checkpoint  │ │ Business DB │ │  Async Fact Extractor       │
│ SQLite      │ │ - StudentFact│ │  (in-process asyncio loop)  │
│ (WAL mode)  │ │ - ChatMessage│ │  - 消费 pending 队列         │
│ 图状态恢复   │ │ - Progress   │ │  - 批量 LLM 抽取 → upsert   │
│             │ │ - ToolCallLog│ │    StudentFact             │
│ TODO: PG    │ │ - Escalation │ │  - 写 Mem0 (可选)           │
└─────────────┘ └─────────────┘ └─────────────────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │  Mem0 Vector DB │
                                 │  (可选依赖)      │
                                 │  语义召回        │
                                 └─────────────────┘
```

## 4. 目录结构

```
src/systemedu/tutor/
├── __init__.py
├── graph.py                  # 主 StateGraph 组装
├── state.py                  # TutorState TypedDict
├── nodes/
│   ├── __init__.py
│   ├── confirm_handler.py    # 处理学生对 tool_confirm 的回复
│   ├── safety_gate.py        # 敏感话题检测
│   ├── memory_inject.py      # 5 层记忆注入
│   ├── skill_router.py       # LLM-driven skill 路由
│   └── output_stream.py      # SSE 输出整形
├── memory/
│   ├── __init__.py
│   ├── student_fact.py       # StudentFact SQLAlchemy + DAO
│   ├── layers.py             # 5 层结构化召回
│   └── fact_extractor.py     # 异步批量抽取 worker
├── skills/
│   ├── __init__.py
│   ├── base.py               # SkillBase ABC + SkillConfig
│   ├── loader.py             # SKILL.md 解析 + registry
│   ├── socratic/             # 苏格拉底式问答
│   │   ├── SKILL.md
│   │   └── skill.py
│   ├── direct_instruction/
│   ├── scaffolding/
│   ├── error_diagnosis/
│   ├── pbl_driving/
│   └── reflection/
├── tools/
│   ├── __init__.py
│   ├── decorator.py          # @tool decorator + ToolMeta
│   ├── progress.py           # get_progress / complete_node / get_knode_*
│   ├── memory.py             # search_student_facts / search_memory
│   ├── practice.py           # get_practice_exercises / grade_submission
│   └── meta.py               # escalate_to_human
├── checkpoint/
│   ├── __init__.py           # Backend 选择器
│   ├── sqlite_saver.py       # 本地 SqliteSaver 封装
│   └── pg_saver.py           # Postgres（标记 TODO，扩展路径）
└── worker.py                 # asyncio 后台 fact extraction loop

tests/tutor/
├── test_state.py
├── memory/
│   ├── test_student_fact.py
│   ├── test_layers.py
│   ├── test_fact_extractor.py
│   └── test_worker.py
├── skills/
│   ├── test_loader.py
│   ├── test_socratic.py
│   ├── test_direct_instruction.py
│   ├── test_scaffolding.py
│   ├── test_error_diagnosis.py
│   ├── test_pbl_driving.py
│   └── test_reflection.py
├── tools/
│   ├── test_progress.py
│   ├── test_memory.py
│   ├── test_practice.py
│   └── test_meta.py
├── test_confirm_handler.py
├── test_safety_gate.py
├── test_graph_integration.py
└── test_e2e_real_llm.py      # 5 个真实 LLM 场景
```

### 模块职责

| 模块 | 职责 | 对外接口 |
|------|------|---------|
| `graph.py` | 组装主 StateGraph + 注册子图 | `build_tutor_graph() → CompiledStateGraph` |
| `state.py` | TutorState 定义 | `TutorState` TypedDict |
| `memory/layers.py` | 5 层记忆召回 | `MemoryInjector.inject(...) → MemorySnapshot` |
| `memory/fact_extractor.py` | 异步抽取 worker | `FactExtractor.extract_session(id)` |
| `skills/loader.py` | 发现/加载 skill | `SkillLoader.scan() → list[SkillBase]` |
| `skills/<name>/skill.py` | 单个 skill 子图 | `build_subgraph(llm, tools) → CompiledStateGraph` |
| `tools/*.py` | LLM 工具 | LangChain `@tool` 装饰器 |
| `checkpoint/__init__.py` | Checkpoint backend 选择 | `get_checkpointer() → BaseCheckpointSaver` |
| `worker.py` | 启动时起 asyncio 任务 | `FactExtractionWorker.start()` |

**边界原则**：
- `memory/` 不依赖 `skills/`（记忆是基础设施）
- `skills/` 不直接操作 DB（通过 `tools/` 或 state 拿数据）
- `graph.py` 只做组装，不写业务逻辑（业务在 `nodes/` 和 `skills/`）

---

## 5. State 定义 & 数据流

### 5.1 TutorState（主图 state）

```python
# src/systemedu/tutor/state.py
from typing import TypedDict, Annotated, Literal
from datetime import datetime
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class MemorySnapshot(TypedDict):
    """5 层记忆注入快照，每轮 memory_inject 节点填充"""
    l1_profile: str           # 学生画像（稳定）
    l2_project_ctx: str       # 项目上下文（进度）
    l3_knode_state: str       # 当前 knode 卡点/尝试
    l4_semantic_recall: list[str]  # Mem0 top-3 片段
    l5_skill_ctx: str         # active skill 子图 state 摘要
    injected_at: datetime

class SkillDecision(TypedDict):
    """skill_router 节点的输出"""
    action: Literal["continue", "switch", "exit"]
    target_skill: str | None
    reason: str

class TutorState(TypedDict):
    # === 对话轴 ===
    messages: Annotated[list[BaseMessage], add_messages]

    # === 会话标识（从 config 注入）===
    user_id: str
    session_id: str           # = thread_id
    project_name: str | None
    knode_id: str | None
    active_tab: str | None

    # === 记忆层 ===
    memory: MemorySnapshot

    # === Skill 控制 ===
    active_skill: str | None
    skill_turn_count: int
    skill_state: dict
    skill_decision: SkillDecision

    # === 输出轴 ===
    pending_tool_calls: list
    confirm_required: dict | None
    stream_events: list
```

### 5.2 每轮对话数据流

```
[用户消息进入]
   ↓
Step 1: gateway 收到 POST /api/chat
        生成 config: {thread_id: session_id}
        调 graph.astream_events(input, config)

Step 2: LangGraph checkpoint 读取上轮 state
        恢复 messages, active_skill, skill_turn_count, ...

Step 3: confirm_handler 节点（若本轮是确认回复）
        approved=true → 真实执行 tool + 写 ToolCallLog
        approved=false → 注入 SystemMessage 说明

Step 4: safety_gate 节点
        正则预筛敏感模式 → 若命中：
          - escalate_to_human(severity=urgent)
          - 回复固定话术
          - 短路到 output_stream

Step 5: memory_inject 节点
        并行调用 asyncio.gather(_l1, _l2, _l3, _l4, _l5)
        任一层失败返回空字符串（不阻塞）
        合成 MemorySnapshot 写入 state.memory

Step 6: skill_router 节点
        LLM (qwen-turbo) 决策：continue / switch / exit
        受约束：active skill 超 max_turns 强制 switch

Step 7: 路由到 skill 子图
        按 state.active_skill 选择子图
        传入 {messages, memory snapshot, tools_whitelist}
        子图内部循环（max_turns 限制）
        产出：新 assistant message + skill_state 更新

Step 8: output_stream 节点
        转换 assistant message 为 SSE 事件流
        若 confirm_required 非空，发 tool_confirm 事件

Step 9: LangGraph checkpoint 写入新 state
        messages, skill_state, active_skill 全部持久化

Step 10: gateway 入队 pending_fact_extraction
         INSERT ... ON CONFLICT DO NOTHING
```

### 5.3 异步抽取分支（独立流）

```
[session 关闭 / 定时兜底]
   ↓
worker.py asyncio loop:
  - 轮询 pending_fact_extraction（每 30s）
  - 对每个待处理 session：
    1. 取所有未抽取 messages
    2. LLM 抽取事实 → list[{category, knode_id, content, ...}]
    3. 对每条新事实：
       - 查同 (user_id, knode_id, category) 的当前事实
       - LLM 判断覆盖？
         - 覆盖：老 valid_to=now, superseded_by=new.id
         - 并存：直接 insert
    4. 写 Mem0：store_conversation(user_id, messages)
    5. 标记 pending 记录 done
  - 失败：retry_count++，满 3 次 → failed
```

### 5.4 关键不变量

1. `skill_turn_count` 严格随 skill 激活 +1，switch/exit 时归零
2. `memory.injected_at` 必须在 `skill_router` 之前
3. `confirm_required` 非空时，下一轮必须先处理确认结果
4. `stream_events` 是临时 buffer，不持久化到 checkpoint
5. pending_fact_extraction 表必须幂等

---

## 6. 记忆层设计

### 6.1 StudentFact schema

```python
class StudentFact(Base):
    __tablename__ = "student_facts"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # === 定位 ===
    user_id = Column(String(100), nullable=False, index=True)
    project_name = Column(String(200), nullable=True, index=True)
    knode_id = Column(String(100), nullable=True, index=True)

    # === 事实内容 ===
    category = Column(String(30), nullable=False)
    # interest / knowledge / struggle / goal / context
    content = Column(Text, nullable=False)
    confidence = Column(Float, default=0.7)

    # === 结构化扩展 ===
    # knowledge: {"mastery_level": "exposure|understand|apply|master"}
    # struggle: {"struggle_type": "concept|calc|strategy"}
    # 所有 category 通用："evidence_msg_ids": [4521] 指向 ChatMessage.id
    fact_metadata = Column(JSON, default=dict)

    # === 时间线 ===
    valid_from = Column(DateTime, default=datetime.utcnow, nullable=False)
    valid_to = Column(DateTime, nullable=True, index=True)
    superseded_by = Column(Integer, ForeignKey("student_facts.id"), nullable=True)

    # === 溯源 ===
    source_session_id = Column(String(36), nullable=True)
    extracted_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_sf_user_current", "user_id", "valid_to"),
        Index("ix_sf_user_knode_category", "user_id", "knode_id", "category"),
        Index("ix_sf_project_current", "project_name", "valid_to"),
    )
```

### 6.2 PendingFactExtraction schema

```python
class PendingFactExtraction(Base):
    __tablename__ = "pending_fact_extraction"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), nullable=False, unique=True)
    user_id = Column(String(100), nullable=False)
    first_unextracted_msg_id = Column(Integer, nullable=True)
    last_message_at = Column(DateTime, nullable=False)

    status = Column(String(20), default="pending")
    # pending / processing / done / failed
    retry_count = Column(Integer, default=0)
    error_msg = Column(Text, nullable=True)

    enqueued_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
```

### 6.3 五层记忆召回

| 层 | 名称 | 数据来源 | 更新频率 |
|----|------|---------|---------|
| L1 | 学生画像（稳定） | `User` 表 + 聚合 StudentFact interest/goal | 天级 |
| L2 | 项目上下文 | `Enrollment` + `ProgressRecord` | 实时 |
| L3 | 当前 knode 状态 | `StudentFact`(knode_id=current) + `PracticeSubmission` | 实时 |
| L4 | 语义历史召回 | Mem0.search(当前 user message) | 每轮查询（top_k=3） |
| L5 | active skill 上下文 | skill 子图 state 摘要 | skill 内部维护 |

```python
# src/systemedu/tutor/memory/layers.py
@dataclass
class MemoryInjector:
    db_session_factory: Callable
    mem0_client: Mem0Client | None

    async def inject(self, *, user_id, project_name, knode_id,
                     last_user_msg, active_skill_state) -> MemorySnapshot:
        """并行召回 5 层，总延迟 ~= max(单层)，非 sum"""
        results = await asyncio.gather(
            self._l1_profile(user_id),
            self._l2_project_ctx(user_id, project_name),
            self._l3_knode_state(user_id, project_name, knode_id),
            self._l4_semantic_recall(user_id, last_user_msg),
            self._l5_skill_ctx(active_skill_state),
            return_exceptions=True,
        )
        l1, l2, l3, l4, l5 = [
            r if not isinstance(r, Exception) else "" for r in results
        ]
        return MemorySnapshot(
            l1_profile=l1, l2_project_ctx=l2, l3_knode_state=l3,
            l4_semantic_recall=l4, l5_skill_ctx=l5,
            injected_at=datetime.utcnow(),
        )
```

### 6.4 注入格式

```python
MEMORY_TEMPLATE = """
## L1 学生画像（稳定）
{l1_profile}

## L2 项目上下文
{l2_project_ctx}

## L3 当前 knode 状态
{l3_knode_state}

## L4 相关历史对话（语义召回 top 3）
{l4_semantic_recall_bullets}

## L5 当前教学策略进度
{l5_skill_ctx}
""".strip()
```

### 6.5 Fact Extractor

```python
FACT_EXTRACTION_PROMPT = """
分析以下师生对话，抽取关于学生的事实。每条事实必须符合：
- category ∈ {interest, knowledge, struggle, goal, context}
- content ≤ 200 字
- confidence 0.0-1.0

对 knowledge 类，标注 mastery_level(exposure/understand/apply/master)
对 struggle 类，标注 struggle_type(concept/calc/strategy)

返回 JSON 数组:
[{"category": "...", "content": "...", "confidence": 0.8,
  "knode_id": "k10", "metadata": {"mastery_level": "understand"},
  "evidence_msg_ids": [4521]}]

当前 knode: {knode_id}
项目: {project_name}
对话:
{conversation}
"""

class FactExtractor:
    async def extract_session(self, pending_id: int):
        # 1. 标记 processing
        # 2. 拉未抽取 messages
        # 3. LLM 抽取
        # 4. Upsert + supersede 判断
        # 5. 写 Mem0
        # 6. 标记 done
        ...

    async def _upsert_with_supersede(self, db, user_id, new_fact, session_id):
        """
        查同 (user_id, knode_id, category) 当前事实：
        - 不存在：直接 insert
        - 存在：LLM 判断"是否覆盖旧事实"
          - 覆盖：旧 valid_to=now, superseded_by=new.id
          - 不覆盖（并存）：直接 insert
        """
        ...
```

### 6.6 Worker loop

```python
# 配置
SCAN_INTERVAL = 30  # seconds
FALLBACK_AFTER = timedelta(hours=2)

class FactExtractionWorker:
    async def start(self):
        # 启动清扫：processing → pending（僵尸任务恢复）
        ...

    async def _loop(self):
        while not self._stopping:
            await self._tick()
            await asyncio.sleep(SCAN_INTERVAL)

    async def _tick(self):
        await self._enqueue_fallback()  # 2h 兜底
        # 消费队列，单 tick 最多 5 个
        pending = query(status="pending", retry_count<3, limit=5)
        for p in pending:
            try:
                await self.extractor.extract_session(p.id)
            except Exception:
                p.retry_count += 1
                if p.retry_count >= 3:
                    p.status = "failed"
```

---

## 7. Skill 系统设计

### 7.1 SkillBase 抽象

```python
@dataclass
class SkillConfig:
    name: str
    description: str
    triggers: list[str]
    tools: list[str]
    max_turns: int = 5
    priority: int = 50
    body: str = ""
    path: Path | None = None

class SkillBase(ABC):
    def __init__(self, config: SkillConfig):
        self.config = config

    @abstractmethod
    def build_subgraph(self, llm, tools) -> CompiledStateGraph: ...

    def summarize_state(self, skill_state: dict) -> str:
        """生成 L5 注入文本"""
        ...
```

### 7.2 Skill Loader

```python
class SkillLoader:
    def __init__(self, search_paths: list[Path]):
        self.search_paths = search_paths

    def scan(self) -> list[SkillBase]:
        """按 search_paths 顺序加载，前者覆盖后者"""
        ...
```

**Search path 优先级**（前者覆盖后者）：
1. `projects/<project_name>/skills/` — 项目特定 skill
2. `src/systemedu/tutor/skills/` — 内置 skill

### 7.3 Skill Router

```python
ROUTER_PROMPT = """你是教学策略调度器。

# 可用 skills
{skill_catalog}

# 当前状态
- active_skill: {active_skill}
- 已连续运行: {turn_count} / {max_turns}

# 最近对话（最后 3 条）
{recent_messages}

# 学生当前卡点（L3 记忆）
{knode_state}

# 决策规则
1. active_skill 未超 max_turns → continue
2. 话题切换 / skill 目标达成 → switch
3. 学生想结束 → exit
4. 默认路由优先级：
   - "我搞懂了"/结束信号 → reflection-prompt
   - 连续答错 2 次 → error-diagnosis
   - "不会"/"没头绪" + 前置 knode 未过 → scaffolding
   - 概念理解类 + 有能力推导 → socratic-questioning
   - 事实查询 / "直接告诉我" / socratic 已达 max_turns → direct-instruction
   - 新 knode 启动 + 学生尚未表达 → pbl-driving-question

返回 JSON: {"action": "continue|switch|exit",
           "target_skill": "name_or_null", "reason": "..."}
"""
```

### 7.4 六个 skill

| Skill | 用途 | max_turns | tools 白名单 |
|-------|------|-----------|-------------|
| **socratic-questioning** | 概念理解类引导 | 5 | search_student_facts, get_knode_content, get_knode_prerequisites |
| **direct-instruction** | 事实查询 / 明确求讲解 / socratic 降级 | 3 | get_knode_content, get_practice_exercises, complete_node |
| **scaffolding** | 前置知识不足时降阶 | 4 | get_knode_prerequisites, get_knode_content, search_student_facts |
| **error-diagnosis** | 学生答错时分类错因 | 2 | grade_submission, search_student_facts, get_practice_exercises |
| **pbl-driving-question** | 启动阶段抛驱动性问题 | 2 | search_student_facts, get_knode_content |
| **reflection-prompt** | 完成任务后元认知引导 | 3 | complete_node, search_student_facts |

### 7.5 socratic-questioning 完整示例

**SKILL.md**:
```markdown
---
name: socratic-questioning
description: 用苏格拉底式提问引导学生自己推导答案
triggers:
  - 学生提出概念理解类问题
  - 学生有能力推导但没尝试
  - 不是事实查询也不是明确求答案
tools:
  - search_student_facts
  - get_knode_content
  - get_knode_prerequisites
max_turns: 5
priority: 70
---

# 苏格拉底式问答

## 核心原则
1. 永远不给出最终答案,除非学生自己说出来
2. 每次只问一个问题,避免信息过载
3. 从学生已知出发,逐步逼近未知
4. 连续 2 轮卡壳,调整问题难度
5. 到达 max_turns 前若学生仍困惑,设置 escalation_hint

## 问题设计模板
- 回忆型："你之前学过 X，还记得 X 是怎么工作的吗？"
- 类比型："这个现象和 X 有什么像的地方？"
- 反例型："如果没有 Y，会发生什么？"
- 假设型："假如 Z 翻倍，你觉得 W 会怎么变？"
- 归纳型："你观察到这几个例子，有什么共同点？"

## 何时降级
- 5 轮仍未突破 → escalation_hint="学生在 [概念] 上卡住，建议用 [例子] 切入"
- 学生明确说"直接告诉我" → early exit
```

**skill.py** 结构：
```python
class SocraticState(TypedDict):
    messages: Annotated[list, add_messages]
    concept_target: str
    questions_asked: list[str]
    progress: Literal["exploring", "converging", "breakthrough", "stuck"]
    escalation_hint: str | None
    _memory: dict

class SocraticSkill(SkillBase):
    def build_subgraph(self, llm, tools):
        g = StateGraph(SocraticState)
        g.add_node("assess", self._assess_progress)
        g.add_node("ask_question", self._generate_question)
        g.add_node("set_escalation", self._set_escalation)

        g.add_edge(START, "assess")
        g.add_conditional_edges("assess", route_after_assess)
        g.add_edge("ask_question", END)
        g.add_edge("set_escalation", END)
        return g.compile()
```

### 7.6 主图到子图的路由

```python
def build_tutor_graph(*, llm, router_llm, skill_loader, tool_registry, checkpointer):
    g = StateGraph(TutorState)

    g.add_node("confirm_handler", confirm_handler_node)
    g.add_node("safety_gate", safety_gate_node)
    g.add_node("memory_inject", memory_inject_node)
    g.add_node("skill_router", skill_router_node)

    for skill in skill_loader.list_all():
        allowed_tools = tool_registry.filter_by_whitelist(skill.config.tools)
        subgraph = skill.build_subgraph(llm=llm, tools=allowed_tools)
        g.add_node(f"skill:{skill.name}", _wrap_subgraph(skill, subgraph))

    g.add_node("output_stream", output_stream_node)

    g.add_edge(START, "confirm_handler")
    g.add_edge("confirm_handler", "safety_gate")
    g.add_conditional_edges("safety_gate",
        lambda s: "output_stream" if s.get("_safety_triggered") else "memory_inject")
    g.add_edge("memory_inject", "skill_router")
    g.add_conditional_edges("skill_router", route_to_skill)
    for skill in skill_loader.list_all():
        g.add_edge(f"skill:{skill.name}", "output_stream")
    g.add_edge("output_stream", END)

    return g.compile(checkpointer=checkpointer)
```

---

## 8. 工具 & 安全机制

### 8.1 工具集（10 个）

| 工具名 | access | confirm | scope | 用途 |
|--------|--------|---------|-------|------|
| `get_progress` | read | no | user_self | 学生整体进度 |
| `complete_node` | write | **yes** | user_self | 标记节点通过 |
| `get_knode_prerequisites` | read | no | project | 前置节点 + 状态 |
| `get_knode_content` | read | no | project | 读 lesson 内容 |
| `search_student_facts` | read | no | user_self | 查 StudentFact |
| `search_memory` | read | no | user_self | Mem0 语义搜索 |
| `get_practice_exercises` | read | no | project | 拉题（剔除 correct） |
| `grade_submission` | write | no | user_self | 评分学生答案 |
| `escalate_to_human` | write | no | user_self | 人工介入标记 |

### 8.2 四层安全防护

#### 第一层：Skill 工具白名单
- 每 skill 的 SKILL.md `tools:` 字段声明允许列表
- `_wrap_subgraph` 时按白名单过滤，LLM "看不到" 白名单外工具

#### 第二层：写操作二次确认
- `ToolMeta.confirm_required=True` 的工具不真执行，返回 `action="pending_confirm"`
- `output_stream` 发 `tool_confirm` SSE 事件
- 前端弹确认框，用户点确认后以下一轮消息 metadata 回传
- `confirm_handler` 节点处理 approved/rejected

#### 第三层：作用域隔离
- `_state` 由 ContextVar 注入，`user_id` 来自 gateway 认证会话
- LLM 传的 `user_id` 会被装饰器覆盖
- `scope="project"` 工具额外校验 knode 属于当前 project

#### 第四层：审计日志（ToolCallLog 表）
```python
class ToolCallLog(Base):
    __tablename__ = "tool_call_log"
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), index=True)
    session_id = Column(String(36), index=True)
    active_skill = Column(String(50), nullable=True)
    tool_name = Column(String(50), nullable=False)
    args_json = Column(JSON, default=dict)
    result_json = Column(JSON, default=dict)
    approved = Column(Boolean, nullable=True)
    called_at = Column(DateTime, default=datetime.utcnow)
    latency_ms = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
```

### 8.3 敏感话题检测

```python
SENSITIVE_PATTERNS = [
    r"(自杀|想死|活不下去|没意思|受不了了)",
    r"(色情|赌博|毒品)",
]

async def safety_gate_node(state: TutorState) -> dict:
    last_user = _last_user_msg(state["messages"])
    matched = [p for p in SENSITIVE_PATTERNS if re.search(p, last_user)]
    if not matched:
        return {}

    await escalate_to_human(reason=f"敏感模式: {matched}", severity="urgent",
                            _state={"user_id": ..., "session_id": ...})
    return {
        "messages": [AIMessage(content=(
            "我注意到你在分享一些重要的事。"
            "这个话题需要你信任的大人来帮你——"
            "你可以告诉家长或老师，他们会真正帮到你。"
            "如果现在很紧急，请拨打 12355 青少年心理热线。"
        ))],
        "skill_decision": {"action": "exit", "reason": "safety"},
        "_safety_triggered": True,
    }
```

### 8.4 Escalation 表

```python
class Escalation(Base):
    __tablename__ = "escalations"
    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), index=True)
    session_id = Column(String(36))
    reason = Column(Text, nullable=False)
    severity = Column(String(10), default="warn")  # info/warn/urgent
    status = Column(String(20), default="open")    # open/handled/closed
    handled_by = Column(String(100), nullable=True)
    handled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 9. Gateway 接口

### 9.1 端点总览

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/chat` | 学生对话主端点（SSE） |
| POST | `/api/tutor/session/end` | 通知 session 结束，触发抽取 |
| GET | `/api/tutor/facts` | 查询当前学生的 StudentFact |
| GET | `/api/tutor/session/:id/history` | 历史消息回放 |
| DELETE | `/api/tutor/session/:id` | 删除 session + checkpoint |
| GET | `/api/tutor/escalations` | 运营查 escalation（仅管理员） |

### 9.2 POST /api/chat SSE 事件

| event | data 结构 |
|-------|-----------|
| `start` | `{session_id, active_skill}` |
| `skill` | `{action, target_skill, reason}` |
| `token` | `{content}` |
| `tool_call` | `{tool, args, result}` |
| `tool_confirm` | `{confirm_id, tool, args, prompt_to_user}` |
| `escalation` | `{severity, contact_info}` |
| `error` | `{code, message}` |
| `done` | `{message_id, facts_queued}` |

### 9.3 Session 结束触发

前端触发时机：
1. 用户切换项目/knode
2. 30 分钟无新消息
3. 显式关闭对话面板
4. 页面 unload (`navigator.sendBeacon`)

---

## 10. Checkpoint & 扩展路径

### 10.1 本地 SQLite（第一阶段）

```python
CHECKPOINT_DB_PATH = Path.home() / ".systemedu" / "tutor_checkpoints.db"

async def get_sqlite_checkpointer():
    conn = await aiosqlite.connect(str(CHECKPOINT_DB_PATH))
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA synchronous=NORMAL")
    saver = SqliteSaver(conn)
    await saver.setup()
    return saver
```

### 10.2 Postgres 迁移路径（**必须标注**）

**触发迁移的信号**：
- Gateway 横向扩容到 2+ 实例
- 单日并发 session > 500
- checkpoint DB > 20 GB

**迁移准备**（代码预留）：
```python
# src/systemedu/tutor/checkpoint/__init__.py
async def get_checkpointer():
    cfg = Config.load()
    backend = cfg.tutor.checkpoint_backend  # "sqlite" | "postgres"
    if backend == "sqlite":
        return await get_sqlite_checkpointer()
    elif backend == "postgres":
        return await get_pg_checkpointer(cfg.tutor.postgres_url)
```

**迁移步骤**（上线前写好 runbook）：
1. `pip install langgraph-checkpoint-postgres psycopg[binary]`
2. 准备独立 Postgres 实例（不与业务 MySQL 混用）
3. 修改 `~/.systemedu/config.yaml`：`tutor.checkpoint_backend: postgres`
4. 运行 `scripts/migrate_sqlite_to_pg.py`（只迁 latest state，历史 checkpoint 可丢）
5. 灰度：先切一台 gateway 观察 1 天，再全量

### 10.3 Config 字段

```python
class TutorConfig(BaseModel):
    checkpoint_backend: Literal["sqlite", "postgres"] = "sqlite"
    postgres_url: str | None = None  # TODO: 扩容时启用
    checkpoint_sqlite_path: str = "~/.systemedu/tutor_checkpoints.db"
    skill_search_paths: list[str] = ["projects/{project}/skills/",
                                     "src/systemedu/tutor/skills/"]
    fact_extraction_interval_seconds: int = 30
    fact_extraction_fallback_hours: int = 2
    mem0_enabled: bool = False
    mem0_provider: str = "qdrant"
```

---

## 11. 老 runtime 退役

### 11.1 删除清单

```
[DELETE]
src/systemedu/core/runtime.py           # 整个 deepagents backend
src/systemedu/agents/builtin/tutor.py
src/systemedu/agents/builtin/planner.py
src/systemedu/agents/builtin/assessor.py
src/systemedu/agents/base.py            # BaseAgent 抽象
src/systemedu/agents/manager.py

[MODIFY]
pyproject.toml                          # 删 deepagents>=0.4.11
src/systemedu/gateway/server.py         # /api/chat 切到 tutor graph SSE
src/systemedu/core/__init__.py          # 清理 AgentRuntime 导出

[KEEP]
src/systemedu/memory/client.py          # Mem0 client（新 graph L4）
src/systemedu/skills/loader.py          # 旧 loader（course_factory 等使用）
src/systemedu/mcp/*                     # 未来 tool 源扩展
```

**关于 `skills/loader.py`**：保留旧 loader 服务 course_factory / knowledge tree 等非 tutor 场景。新 tutor 的 loader 在 `tutor/skills/`。两套并存（YAGNI：有共享需求再合并）。

**关于 `src/systemedu/skills/builtin/`**（如存在）：
- 若目录下现有 skill 是旧 runtime 专用（LLM 配合 `create_backend` 的），随老 runtime 一并删除
- 若为 course_factory / knowledge tree 等共享 skill，保留不动
- Phase 5.4 执行前 grep 确认每个文件的引用情况再决定

### 11.2 前端改造（另外单独开 spec 015）

```
[MODIFY]
web/src/hooks/useChat.ts         # WebSocket → EventSource (SSE)
web/src/components/ChatPanel.tsx # 新增 tool_confirm 对话框 / escalation UI / skill badge

[NEW]
web/src/hooks/useTutorSession.ts # session 生命周期管理
web/src/components/ToolConfirmDialog.tsx
web/src/components/EscalationBanner.tsx
web/src/components/SkillBadge.tsx
```

---

## 12. 测试策略

### 12.1 金字塔

```
E2E 真实 LLM (5 场景, ~5 min)
Integration tests (graph 整链路, mock LLM, ~30s)
Unit tests (~3s, 节点/skill/工具独立)
Schema & migrations (~1s, Alembic 正向/回滚)
```

### 12.2 关键单测清单（覆盖率目标 80%）

**memory/**
- StudentFact CRUD + 索引
- supersede 链正向/回滚
- 5 层 `asyncio.gather` 并发 + 单层失败不影响
- FactExtractor JSON 解析失败重试
- Worker 启动清扫 processing→pending
- 2h 兜底触发入队

**skills/**
- SkillLoader frontmatter 解析 + 覆盖规则
- Socratic assess_progress 4 种 progress 分类
- Socratic 达 max_turns 设置 escalation_hint
- 每 skill 3-5 个核心用例

**tools/**
- complete_node 返回 pending_confirm 不真写 DB
- get_practice_exercises 剔除 correct
- scope 校验：LLM 传 user_id 被忽略
- ToolCallLog 写入完整

**nodes/**
- safety_gate 敏感词命中 + 未命中
- confirm_handler approved/rejected 分支

### 12.3 集成测试

`tests/tutor/test_graph_integration.py`（FakeListLLM）：

1. new session 首轮全链路
2. 中途切换 skill，turn_count 归零
3. Checkpoint 恢复：3 轮关闭 → 重启恢复 messages
4. 敏感词中断
5. confirm 流程完整
6. 工具白名单越界失败
7. max_turns 强制降级

### 12.4 E2E 真实 LLM 测试

`tests/tutor/test_e2e_real_llm.py`（qwen-plus，`pytest -m e2e`）：

| 场景 | 输入 | 期望 |
|------|------|------|
| 1 | "我最喜欢火箭" → 结束 session | PendingFactExtraction 消费，interest fact 写入 |
| 2 | 问"为什么升力向上" → 5 轮 | 0 直给答案，每轮 1 问 |
| 3 | 答错练习 → error-diagnosis → scaffolding | 分类准确，拉取前置 knode |
| 4 | 3 轮关闭 → 30s 后重开 | 第 4 轮引用前 3 轮内容 |
| 5 | "我觉得活着没意思" | escalation 记录写入，固定话术 |

**质量门槛**（人工 review）：
- 场景 2：0 直给答案（10/10）
- 事实抽取：无 PII 泄露（抽查 50 条）
- 场景 5：100% 触发 escalation
- 写工具：100% 走 confirm

### 12.5 性能基线

| 指标 | 目标 |
|------|------|
| `memory_inject` p95 | < 200ms |
| `skill_router` p95 | < 800ms |
| 首 token p95 | < 2s |
| Checkpoint 写入 p95 | < 10ms |
| Fact 抽取吞吐 | > 10 session/min |

---

## 13. 实施计划（4-5 周）

### Phase 1：基础设施（1 周）
- 1.1 langgraph 依赖 + config 字段
- 1.2 DB schema + Alembic 迁移
- 1.3 Checkpoint sqlite_saver + pg_saver 占位
- 1.4 TutorState + graph skeleton
- 1.5 Schema / state 单测

### Phase 2：记忆层（1 周）
- 2.1 5 层 MemoryInjector
- 2.2 FactExtractor + supersede
- 2.3 Worker asyncio loop + 兜底
- 2.4 Mem0 L4 集成
- 2.5 memory_inject 节点
- 2.6 端到端单测

### Phase 3：Skill 系统（2 周）
- 3.1 SkillBase + SkillLoader
- 3.2 skill_router 节点
- 3.3-3.8 六个 skill（可并行）
- 3.9 所有 skill 单测

### Phase 4：工具 + 安全（0.5 周）
- 4.1 10 个工具
- 4.2 confirm_handler
- 4.3 safety_gate
- 4.4 工具白名单过滤
- 4.5 ToolCallLog
- 4.6 工具 + 安全单测

### Phase 5：Gateway + 老 runtime 退役（0.5 周）
- 5.1 `/api/chat` 切换到 tutor graph
- 5.2 session/end 端点
- 5.3 辅助端点
- 5.4 删除老 runtime
- 5.5 集成测试

### Phase 6：E2E + 上线（0.5 周）
- 6.1 5 个真实 LLM 场景
- 6.2 性能基线
- 6.3 部署脚本
- 6.4 监控配置
- 6.5 运维文档

**里程碑**：
- M1（Phase 1-2）：记忆可用，direct-instruction 兜底
- M2（+Phase 3）：6 skill 全部上线
- M3（+Phase 4-5）：安全 + Gateway 整合，前端可联调
- M4（+Phase 6）：E2E 通过，可上线生产

---

## 14. 风险评估

| # | 风险 | 影响 | 概率 | 缓解 |
|---|------|------|------|------|
| R1 | skill_router LLM 决策不稳定 | 用错 skill | 高 | E2E 场景验证；强制约束 max_turns |
| R2 | fact_extractor 污染 StudentFact | 错上加错 | 中 | confidence<0.5 不注入 L3；人工抽查；版本化 prompt |
| R3 | checkpoint DB 文件锁 | 用户卡顿 | 低 | WAL 模式 + 异步驱动 |
| R4 | Mem0 服务异常 | L4 失败 | 中 | try/except 返回空；降级不影响主流程 |
| R5 | 老 runtime 删除漏依赖 | 生产 500 | 中 | 删除前 grep；单独 commit |
| R6 | 苏格拉底被套话 | 违反核心原则 | 中 | prompt 反复强调；E2E 场景 2；output filter |
| R7 | confirm 机制被 bypass | 进度污染 | 低 | 强制检查 confirm_required；DB trigger |
| R8 | 敏感话题漏检 | 严重问题 | 低 | 正则预筛；E2E 场景 5；LLM 二次判断 |
| R9 | 6 skill 并行开发冲突 | Base 改动破坏下游 | 中 | Phase 3.1 先冻结 API；独立目录 |
| R10 | 前端改造滞后 | UI 未跟上 | 中 | 前端单开 spec 015；向后兼容 |

---

## 15. 成功标准

上线后 2 周内必须达到：

**功能性**
- E2E 场景 100% 通过
- 单测覆盖率 > 80%（tutor/）
- 无 P0/P1 生产事故

**质量**
- 苏格拉底 0 直给答案
- 事实抽取准确率 > 75%
- skill_router 决策准确率 > 80%

**性能**
- 首 token p95 < 2s
- fact_extractor 成功率 > 95%
- checkpoint 写入 p95 < 10ms

**安全**
- escalation 0 漏检
- 审计日志完整性 100%
- 工具白名单违规 0 例

---

## 16. 后续工作（非本 spec 范围）

1. **spec 015**：前端 UI 改造（SSE 切换、tool_confirm 对话框、skill badge）
2. **spec 016**：Postgres 迁移实施（触发条件达成时启动）
3. **spec 017**：Planner / Assessor agent 重建（用 LangGraph 重写）
4. **项目宪法**：`/speckit.constitution` 固化项目全局原则（本 spec 设计完成后立即进行）
5. **Tutor skill 扩展**：基于真实教学数据反馈，增加特定学科 / 年龄段的 skill 变体

---

## Appendix A：相关文件位置

- 本设计文档：`docs/superpowers/specs/2026-04-16-tutor-memory-system-design.md`
- 将转写入：`specs/014-deerflow-tutor-setup/spec.md` + `plan.md` + `tasks.md`
- 参考：`src/systemedu/core/runtime.py`（当前 deepagents runtime）
- 参考：`src/systemedu/storage/db.py`（现有 schema）
- 参考：`src/systemedu/gateway/server.py`（现有 gateway）
- 参考：`src/systemedu/memory/client.py`（Mem0 集成）
- 参考：`CLAUDE.md`（项目约定）
