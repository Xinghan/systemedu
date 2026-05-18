# 031-tutor-context-memory Implementation Plan

**Status**: draft
**Date**: 2026-05-18
**Owner**: xinghan

## 实施策略

7 个 phase 顺序推进, 每 phase 完成 commit, 不等全 ship.

**风险隔离顺序**: 先 infra (PG/Redis/Qdrant docker) → schema migrate → layers 改造 →
worker → UI → 功能测试 → 质量 eval. 任一 phase 出问题不阻塞前面已 commit 的进度.

**最小可工作 (MVP)**: P1+P2+P3 跑通 = 单用户 dev 环境 chat 拿到 5 层 context. P4-P7 是
完整版.

## 现状盘点

### 已存在 (可 reuse)

| 组件 | 位置 | 状态 |
|---|---|---|
| `MemoryInjector` 5 层并发框架 | `core/tutor/memory/layers.py` | 完整, 但 L1-L4 query 是 cloud-app schema |
| `StudentFactDAO` | `core/tutor/memory/student_fact.py` | DAO 可 reuse, 表 schema 要 PG 迁 |
| `FactExtractor` + `FactExtractionWorker` | `core/tutor/memory/fact_extractor.py` | code 在, 但 prompt 旧, 需校准 |
| `Mem0AsyncAdapter` | `core/tutor/memory/mem0_adapter.py` | thin wrapper, OK |
| `MemorySnapshot` typed dict | `core/tutor/state.py` | 字段够用 |
| `ChatPayload` | `student-app/.../chat/payload.py` | 加 page_kind 即可 |
| LangGraph + 6 skills | `core/tutor/skills/` | 不动 |

### 要换掉

| 组件 | 现在 | 改 |
|---|---|---|
| student.db engine | SQLite (`~/.systemedu/student.db`) | Postgres (`postgresql://...`) |
| `student/db.py` create_all | 直接 `Base.metadata.create_all` | alembic migration |
| `layers.py L1-L4` query | `LessonContent / ProgressRecord / ExerciseAttempt / Enrollment` (cloud-app systemedu.db 表) | UserProject / LastVisited / ExerciseAttempt(student-app PG) + library API + Redis cache |
| `mem0_adapter.py` | `mem0_enabled=False` 默认禁 | enable, 跑 Qdrant docker, embed=qwen |
| `fact_extractor worker` | 跑在老 cloud-app server.py 进程内 (deprecated) | student-app 独立 systemd unit |

## Phase 1: Infra (docker + alembic) — ~ 4-6h

### Step 1.1: docker-compose
- 根目录新建 `docker-compose.yml`: postgres 13 / redis 7 / qdrant 1.7 三服务
- 各暴露 5432 / 6379 / 6333, 持久 volume
- `scripts/restart.sh` 加 `docker compose up -d postgres redis qdrant`
- 验证: `docker compose ps` 3 个 healthy

### Step 1.2: alembic baseline
- `pip install alembic` 加进 student-app pyproject deps
- `alembic init alembic/` 在 student-app 包内
- 写 baseline migration: 全部现有 SQLite 表 → PG (users/user_projects/last_visited/chat_sessions/chat_messages/notes/assignment_submissions)
- 加 4 张新表: exercise_attempts / student_facts / pending_extractions
- `alembic upgrade head` 验证生成所有表 + 索引

### Step 1.3: student-app DB engine 切 PG
- `student/db.py`: 解析 `STUDENT_DB_URL` env (默认 `postgresql://systemedu:systemedu@127.0.0.1:5432/student`)
- 改 `create_engine`, 去掉 SQLite `check_same_thread`
- 启动时改成 `alembic upgrade head` 而非 `create_all` (dev 自动迁)
- 删 `Base.metadata.create_all` 老逻辑

### Step 1.4: cache 模块 (Redis)
- 新建 `student/cache.py`: 用 `redis.asyncio.Redis` 单例
- env: `STUDENT_REDIS_URL=redis://127.0.0.1:6379/0`
- 提供 `get / set / setex / delete` async 方法
- 测试时可注入 fake client (单测用 fakeredis)

### Step 1.5: Mem0 + Qdrant 启用
- systemedu config 加 `memory.mem0_enabled=True` + `memory.qdrant_url=http://127.0.0.1:6333`
- `mem0_adapter.py` 配 embed=qwen text-embedding-v3 + Qdrant client + collection `student_memories`
- 验证: 写一个 fact + search 返回

### P1 收尾
- pytest 老测试全过 (PG 替换不破)
- commit `feat(031-P1): docker-compose + alembic + PG + Redis + Qdrant 基础设施`

## Phase 2: Schema + DAO — ~ 3h

### Step 2.1: db.py 加 model
- `ExerciseAttempt` model: 字段全 + 索引
- `StudentFact` model: scope/category/key/value/valid_from/valid_to/superseded_by + 部分索引
- `PendingExtraction` model: status='pending|processing|done|failed|dead'
- 都 ForeignKey users.id

### Step 2.2: DAO helpers
- `db.py` 加 helpers (沿用现有 detach pattern):
  - `record_exercise_attempt(user_id, slug, module_id, ...) -> dict`
  - `list_exercise_attempts(user_id, slug, module_id=None, only_wrong=False, limit=20)`
  - `enqueue_extraction(session_id, user_id) -> None` (dedup unique)
  - `get_pending_extractions(limit=20) -> list[PendingExtraction]`
  - `mark_extraction_done(id) / mark_extraction_failed(id, error)`

### Step 2.3: StudentFactDAO 适配
- 现有 `student_fact.py` 跟 PG 表 schema 对齐, 改 query 写法 (主要是 `valid_to IS NULL` 索引)
- supersede chain helper

### Step 2.4: alembic migration 跑通
- 跑 `alembic upgrade head` 在 dev PG
- 验证 PG `\dt` 列出全部表 + `\d student_facts` 看索引

### P2 收尾
- 单测: `tests/student/test_schema_dao.py` 12 个 (新表 CRUD)
- commit `feat(031-P2): exercise_attempts + student_facts + pending_extractions schema + DAO`

## Phase 3: 5 层 MemoryInjector 重写 — ~ 6-8h

### Step 3.1: layers.py 数据源切换

逐层改 query:

- `_l1_profile`: 改用 `StudentFactDAO.list_current(user_id, scope='global')`
- `_l2_project_ctx`: 改查 student-app `UserProject + LastVisited`
- `_l3_knode_content`: 删 LessonContent 查询, 改 library_client + Redis cache
- `_l3_exercise_history`: 改查 student-app `ExerciseAttempt` (current module + 项目级最近错)
- `_l4_semantic_recall`: 沿用 `Mem0AsyncAdapter`, 但 filter 加 page_kind 派生
- `_l5_skill_ctx`: 不动

### Step 3.2: page_kind dispatch

`MemoryInjector.inject` 签名加 `page_kind: PageKind` 参数:
```python
PageKind = Literal["global", "home", "library_detail", "learn"]

PAGES_WITH_L1 = {"global", "home", "library_detail", "learn"}
PAGES_WITH_L2 = {"home", "library_detail", "learn"}
PAGES_WITH_L3_KNODE = {"learn"}
PAGES_WITH_L3_HISTORY = {"learn"}
PAGES_WITH_L4 = {"global", "home", "library_detail", "learn"}
PAGES_WITH_L5 = {"learn"}
```

按 set 包含决定 task 是否进 `asyncio.gather`.

### Step 3.3: ChatPayload + tutor_runner

- `payload.py`: 加 `page_kind: PageKind = "global"` (Pydantic Literal 校验)
- `tutor_runner._build_input`: state 加 `"page_kind": payload.page_kind`
- `core/tutor/nodes/memory_inject.py`: 从 state 读 page_kind 传给 `injector.inject(...)`

### Step 3.4: prompt template

`layers.py` `MEMORY_TEMPLATE` 改成 spec 里那段:
```
## L1 学生画像 ...
## L2 项目上下文 ...
## L3 当前 knode ...
## L3 答题历史 ...
## L4 相关历史对话 ...
## L5 当前教学策略 ...
```
空层跳过不渲染 (不出现空 section).

### Step 3.5: integration smoke

`tests/student/test_int_inject_5_layers.py`: 真 PG + 真 redis + mock library + mock Mem0 跑一次 learn 完整 5 层.

### P3 收尾
- 单测 (~25 个 layer test) 全过
- 真 LLM chat 烟雾: 注册 → pull → learn M01 → chat "你了解我吗" → 看日志注入 5 层
- commit `feat(031-P3): 5 层 MemoryInjector 重写到 student-app + page_kind dispatch`

## Phase 4: FactExtractor worker 独立 — ~ 3-4h

### Step 4.1: worker 入口
- 新建 `student/workers/__init__.py` + `fact_extractor_worker.py`
- `main()`: tick 5min, batch 20, attempts<3 重试
- LLM 用 `get_llm(provider='cheap')` (config 加 cheap=qwen-plus alias)
- 调 `FactExtractor` 跑一条 pending_extraction:
  1. load session messages
  2. LLM 抽 JSON facts list
  3. apply supersede chain → INSERT student_facts
  4. Mem0.add(session 摘要 + facts metadata)
  5. UPDATE status='done'

### Step 4.2: web 入队
- `routes.py` `ws_chat_stream` done 后调 `enqueue_extraction(session_id, user_id)`
- 真 PG unique 约束去重 (一个 session 最多一条 pending)

### Step 4.3: prompt 校准
- `fact_extractor.py` 抽事实 prompt 改: 输出 JSON 数组, scope/category/key/value 严格 schema
- 用 PurpleAir 真 chat 数据手测 3 条, 看 LLM 是否正确分类

### Step 4.4: 启动入口
- `scripts/restart.sh`:
  ```bash
  nohup python -m systemedu.student.workers.fact_extractor_worker \
      > .run/fact-extractor.log 2>&1 &
  ```

### P4 收尾
- 单测 worker (mock LLM + 真 PG + 真 Mem0)
- 真 LLM 烟雾: chat 几轮 done → 等 5min → 查 PG `SELECT * FROM student_facts` 有数据
- commit `feat(031-P4): FactExtractor worker 独立 + 入队 + qwen-plus 抽事实`

## Phase 5: 前端 page_kind + exercise attempt — ~ 2h

### Step 5.1: ChatPanel 加 page_kind

`packages/student-web/src/components/chat/chat-panel.tsx`:
```tsx
interface ChatPanelProps {
  librarySlug?: string
  moduleId?: string | null
  pageKind?: "global" | "home" | "library_detail" | "learn"
}
```

WS hook payload 加 `page_kind`.

### Step 5.2: 各页传 pageKind

- `/home/page.tsx`: 不挂 ChatPanel (没 chat dock); 后续若加全局 chat -> page_kind="home"
- `/library/[slug]/page.tsx` (ProjectHome): 不挂 ChatPanel; ChatDock 仅在 /learn
- `/learn/[slug]/[moduleId]/page.tsx`: 已有 ChatPanel, 传 `pageKind="learn"`
- (future: 加全局浮窗 → page_kind="global"; 加 library_detail chat → page_kind="library_detail")

本 spec 只 learn 页传, 验证基础链路.

### Step 5.3: exercise attempt POST

- `lib/api/index.ts`: 加 `exercises.record(slug, moduleId, body)` → POST /api/exercise/attempt
- `components/learning/course-content-view.tsx` ExerciseBlock 选答时 record (option_index + correct) -> 后端

### Step 5.4: 后端 endpoint

- `chat/routes.py` (或新文件 `learning/routes.py`) 加 POST /api/exercise/attempt
- require_login → 写 ExerciseAttempt

### P5 收尾
- 浏览器手测 PurpleAir M01 答 2 题 → PG 看 2 条 exercise_attempts
- chat 时后端 log 看 L3 history 含这两条
- commit `feat(031-P5): page_kind 前端透传 + exercise_attempts API + UI`

## Phase 6: 功能测试 A/B/C/D — ~ 6-8h

### Step 6.1: A unit (~40 tests)
- 5 层逐 test (mock 数据)
- page_kind matrix 16 用例 (4 page × 6 层)
- gather fail 兜底
- supersede chain
- prompt template format
- payload page_kind validation
- 各 DAO CRUD

### Step 6.2: B integration (~12 tests)
- pytest fixture 用 `testcontainers-python` 起 PG/Redis/Qdrant
- 真 5 层 e2e
- Mem0 真 add/search
- worker full cycle (enqueue → tick → PG + Mem0 写入)

### Step 6.3: C contract (~8 tests)
- payload JSON v1 snapshot
- MemorySnapshot v1 snapshot
- alembic schema diff

### Step 6.4: D e2e WS (~4 tests)
- spec 028 conftest 起 library + student-app 子进程, 加 PG/Redis
- 跑真 chat → 验日志 / 验 pending_extractions
- 2 user 隔离

### P6 收尾
- 全 ~64 个 test 跑过, < 90s
- commit `feat(031-P6): 4 类功能测试 (A unit + B int + C contract + D e2e)`

## Phase 7: 回答质量 eval — ~ 4-6h

### Step 7.1: e2e/eval 目录骨架
```
e2e/eval/
├── datasets/
│   ├── purpleair_qna.jsonl (50 条)
│   └── ablation_pairs.jsonl (30 条)
├── judges/
│   └── qwen_judge.py
├── runner.py
└── reports/
```

### Step 7.2: 写 50 条 PurpleAir Q&A 数据
- 跨 4 个 page_kind, 涵盖 M01-M10 知识点
- 每条 expected_topics / expected_skill / 禁词 / 最小长度

### Step 7.3: qwen-plus judge
- prompt: "评 0-5, 维度: 苏格拉底度 / topic 覆盖 / 不直接给答案"
- LLM 调 qwen-plus API
- 输出 JSON

### Step 7.4: runner + 报告
- iterate qna → real chat (跑 student-app + library) → 调 judge → 收 scores
- HTML 报告 (每条 q / agent 回答 / judge 评分 / 总平均)

### Step 7.5: 4 类 eval 跑通 + 留基线
- E golden: ≥ 60% topic 命中
- F ablation: 含 memory 平均比跳 memory 高 0.5+
- G page-context: ≥ 70% 用对该页 context
- H fact recall: ≥ 70% session 2 用上 session 1 fact

### P7 收尾
- `reports/2026-05-XX-baseline.html` 留档
- commit `feat(031-P7): 4 类回答质量 eval + 50 条 PurpleAir Q&A 基线`
- spec.md Status: shipped

## 部署 (post-ship)

跟 spec 027 P3 deploy.sh 集成:
- 47.92.200.21 上 docker compose 起 postgres/redis/qdrant
- systemd 4 个 unit: student-app / student-web / library-app / fact-extractor
- nginx 配 WebSocket 升级 (spec 028 已加)
- 跑一次 alembic upgrade head + (可选) migrate_sqlite_to_pg.py 导入 dev 数据

## 估时总览

| Phase | 估时 | 输出 |
|-------|------|------|
| P1 infra | 4-6h | docker-compose + alembic + PG + Redis + Qdrant |
| P2 schema | 3h | 3 张新表 + DAO + 索引 |
| P3 layers 重写 | 6-8h | 5 层 query 切到 student-app + page_kind dispatch |
| P4 worker | 3-4h | 独立进程 + 入队 + qwen-plus 抽事实 |
| P5 前端 | 2h | page_kind 透传 + exercise attempt 链路 |
| P6 功能测试 | 6-8h | A/B/C/D ~64 tests |
| P7 质量 eval | 4-6h | E/F/G/H 4 类 eval + 50 Q&A 基线 |
| **总计** | **28-37h** | spec 031 shipped (~ 1 周) |

## 风险

| 风险 | 缓解 |
|---|---|
| testcontainers PG 太慢 | 单测用 fake (fakeredis + sqlite-as-pg), int 测才用真 |
| Mem0 SDK + qwen embedding 兼容性 | P1.5 早验证, 不行 fallback openai-compatible endpoint |
| qwen-plus 抽事实质量低 (eval H 不过) | P4 prompt 校准时多调 + 加 few-shot |
| Postgres 部署到 47.92.200.21 卡 (1Gi RAM 不够) | docker compose 限制 memory; 必要时升级 ECS |
| alembic 跟 SQLAlchemy 2.0 不兼容 | P1.2 验证, 改 alembic 配置或换 |

## 下一步

写 tasks.md 把 7 phase 拆成可勾选 checklist.
