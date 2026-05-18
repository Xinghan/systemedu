# 031-tutor-context-memory Tasks

**Status**: draft
**Last updated**: 2026-05-18

每 phase 完成做一次 commit. P1 是关键, 跑通后续都顺.

## Phase 1: Infra (docker + alembic) — 4-6h

### 1.1 docker-compose (1h)
- [ ] 根目录 `docker-compose.yml`: postgres 13 / redis 7 / qdrant 1.7
- [ ] 各 expose 5432 / 6379 / 6333, 持久 volume (`./.data/{pg,redis,qdrant}`)
- [ ] postgres user `systemedu` password `systemedu` db `student`
- [ ] `scripts/restart.sh` 加 `docker compose up -d postgres redis qdrant` 在 web/library 起之前
- [ ] verify: `docker compose ps` 3 个 healthy
- [ ] `.gitignore` 加 `.data/`

### 1.2 alembic baseline (1.5h)
- [ ] `pip install alembic` + 加 student-app `pyproject.toml`
- [ ] `cd packages/student-app && alembic init alembic`
- [ ] 写 `alembic.ini` + `env.py`: target_metadata = Base.metadata
- [ ] 写 baseline migration: 全 SQLite 表 → PG (users / user_projects / last_visited / chat_sessions / chat_messages / notes / assignment_submissions / chat_messages.skill 等列)
- [ ] 加 3 新表 migration: exercise_attempts / student_facts / pending_extractions (含全部索引)
- [ ] `alembic upgrade head` 在 dev PG 跑通, `\dt` 看表 + `\d student_facts` 看索引

### 1.3 student-app DB engine 切 PG (1h)
- [ ] `student/db.py`: 加 `STUDENT_DB_URL` env 解析 (默认 postgresql://systemedu:systemedu@127.0.0.1:5432/student)
- [ ] `create_engine` 改 PG, 去 SQLite check_same_thread
- [ ] 启动改 `alembic upgrade head` 替代 `create_all` (dev 自动迁)
- [ ] 删 `_ensure_engine` 里 SQLite 路径逻辑
- [ ] `reset_engine_for_tests` 兼容 PG
- [ ] 老 pytest fixture (用 STUDENT_DB_PATH) 改 fixture 用 testcontainers 或独立 db schema

### 1.4 Redis cache 模块 (0.5h)
- [ ] 新建 `student/cache.py`: `redis.asyncio.Redis` 单例 + env `STUDENT_REDIS_URL`
- [ ] 提供 `get / set / setex / delete` async wrapper
- [ ] 装 `redis` 包到 student-app deps
- [ ] 装 `fakeredis` 到 dev deps (单测 mock 用)

### 1.5 Mem0 + Qdrant 启用 (1.5h)
- [ ] systemedu config 加 `memory.mem0_enabled=True, memory.qdrant_url, memory.qdrant_collection="student_memories"`
- [ ] `mem0_adapter.py`: 创建 Mem0 client 配 Qdrant + embed=qwen text-embedding-v3 (openai-compatible)
- [ ] 装 `mem0ai` 包到 core deps (如未装)
- [ ] env: `DASHSCOPE_API_KEY` (Mem0 embed 用)
- [ ] 手测: 写一个 fact → search 返
- [ ] 失败 fallback: Mem0 disabled 仍能跑 (L4 返空)

### P1 收尾
- [ ] 老 pytest tests/student/ 全过 (PG 替换不破)
- [ ] **commit**: `feat(031-P1): docker-compose + alembic + PG + Redis + Qdrant 基础设施`

---

## Phase 2: Schema + DAO — 3h

### 2.1 db.py 加 model (1h)
- [ ] `ExerciseAttempt` model: 字段 id/user_id(FK)/library_slug/module_id/idea_id/exercise_index/question/student_answer/correct/explanation_shown/created_at + 2 个索引
- [ ] `StudentFact` model: id/user_id(FK)/scope/library_slug/module_id/category/key/value/source_session/confidence/valid_from/valid_to/superseded_by/created_at + 3 个 partial 索引
- [ ] `PendingExtraction` model: id/session_id(FK)/user_id(FK)/enqueued_at/processed_at/status/error/attempts + 1 个 partial 索引
- [ ] 注意 scope='knode' 时 unique 索引涵盖 module_id

### 2.2 DAO helpers (1h)
- [ ] `record_exercise_attempt(user_id, slug, module_id, idea_id, exercise_index, question, student_answer, correct, explanation_shown) -> dict`
- [ ] `list_exercise_attempts(user_id, slug, module_id=None, only_wrong=False, limit=20) -> [dict]`
- [ ] `enqueue_extraction(session_id, user_id) -> None` (dedup, 静默忽略重复)
- [ ] `get_pending_extractions(limit=20) -> [dict]` (status='pending', ORDER BY enqueued_at)
- [ ] `mark_extraction_processing(id, attempts) / mark_done(id) / mark_failed(id, error)`
- [ ] StudentFact DAO: `list_current(user_id, scope, slug=None, module_id=None) / apply_supersede(...)`

### 2.3 alembic migration 验证 (0.5h)
- [ ] 在 fresh PG `alembic upgrade head` 跑过
- [ ] downgrade 也能跑回
- [ ] 提交 migration 文件

### 2.4 单测 (0.5h)
- [ ] `tests/student/test_schema_dao.py` 12 个:
  - ExerciseAttempt: insert/list/filter wrong/limit
  - StudentFact: insert/get_current/supersede chain
  - PendingExtraction: enqueue dedup/get pending/mark done/mark failed
  - 多 user 隔离

### P2 收尾
- [ ] **commit**: `feat(031-P2): exercise_attempts + student_facts + pending_extractions schema + DAO`

---

## Phase 3: 5 层 MemoryInjector 重写 — 6-8h

### 3.1 ChatPayload 加 page_kind (0.5h)
- [ ] `student/chat/payload.py`: 加 `page_kind: Literal["global","home","library_detail","learn"] = "global"`
- [ ] Pydantic validator 拒未知值

### 3.2 tutor_runner 透传 (0.5h)
- [ ] `_build_input` state 加 `"page_kind": payload.page_kind`
- [ ] (`TutorState` typed dict 加 page_kind 字段)
- [ ] memory_inject node 从 state 读 page_kind 传 `injector.inject(...)`

### 3.3 layers.py L1 重写 (0.5h)
- [ ] `_l1_profile(user_id)`: `StudentFactDAO.list_current(user_id, scope='global')` 拼字符串
- [ ] 格式: `兴趣: ...\n目标: ...\n能力: ...` (按 category 分组)
- [ ] 空时返 ""

### 3.4 layers.py L2 重写 (1h)
- [ ] 删 cloud-app Enrollment 查询
- [ ] `_l2_project_ctx(user_id, library_slug, page_kind)`:
  - home: `user_projects WHERE removed_at IS NULL ORDER BY pulled_at DESC LIMIT 3`, 输出列表
  - library_detail/learn: 单 slug, `user_projects + last_visited`, 输出 "你在 PurpleAir-v0.3.1, 当前 M03"
- [ ] 空时返 ""

### 3.5 layers.py L3 knode content 重写 (1.5h)
- [ ] 删 LessonContent 查询
- [ ] `_l3_knode_content(library_slug, module_id)`:
  - Redis key `knode:{slug}:{module}:summary`
  - hit → 返
  - miss → `library_client.get_knode(...)` → `build_summary(k)` → setex 5min
- [ ] `build_summary`: plan_markdown 首 300 字 + theories 标题数 + exercises 题数 + ideas 类别数
- [ ] 失败兜底 (library 挂) 返 ""

### 3.6 layers.py L3 exercise history 重写 (1h)
- [ ] `_l3_exercise_history(user_id, library_slug, module_id)`:
  - 当前 module 全部 attempts (按 created_at)
  - 项目级最近 5 条错的 (correct=False, ORDER BY created_at DESC)
- [ ] 拼字符串: "你在 M03 答了 4 题对 2 错 2.\n错题: ...\n项目近期错点: ..."

### 3.7 layers.py L4 Mem0 filter 调整 (0.5h)
- [ ] filters 必含 user_id
- [ ] page_kind library_detail/learn 加 library_slug
- [ ] page_kind learn 再加 module_id
- [ ] 调用 `Mem0AsyncAdapter.search(...)` 返 top-3
- [ ] 输出: 编号列表

### 3.8 layers.py L5 不动, page_kind dispatch (0.5h)
- [ ] `MemoryInjector.inject` 主 entrypoint 改:
  ```python
  PAGES_WITH_L1 = {"global","home","library_detail","learn"}
  PAGES_WITH_L2 = {"home","library_detail","learn"}
  PAGES_WITH_L3_KNODE = {"learn"}
  PAGES_WITH_L3_HISTORY = {"learn"}
  PAGES_WITH_L4 = {"global","home","library_detail","learn"}
  PAGES_WITH_L5 = {"learn"}
  ```
- [ ] 按 set 包含决定 task 列表
- [ ] gather + return_exceptions=True

### 3.9 prompt template (0.5h)
- [ ] `MEMORY_TEMPLATE` 改成 spec 段, 空层不渲染
- [ ] 单测 template 输出格式

### 3.10 integration smoke (1h)
- [ ] `tests/student/test_int_inject_5_layers.py`: 真 PG + redis + mock library + mock Mem0
- [ ] 4 page_kind 各跑一次, assert 注入的层组合正确
- [ ] 真 LLM chat 烟雾 (手跑): 注册 → pull → learn M01 → chat "你了解我吗", 看后端日志 5 层注入 prompt

### P3 收尾
- [ ] 全部 unit / int test 跑过
- [ ] **commit**: `feat(031-P3): 5 层 MemoryInjector 重写到 student-app + page_kind dispatch`

---

## Phase 4: FactExtractor 独立 worker — 3-4h

### 4.1 worker 入口 (1.5h)
- [ ] 新建 `student/workers/__init__.py`
- [ ] 新建 `student/workers/fact_extractor_worker.py`:
  - `main()` async loop, tick 5min, batch 20
  - 取 PendingExtraction → mark processing(attempts++)
  - 调 `FactExtractor.extract_session(pending_id)`
  - 成功 mark done, 失败 mark failed, attempts>=3 mark dead
- [ ] LLM 用 `get_llm(provider='cheap')` (config 加 cheap=qwen-plus alias)
- [ ] env: `DASHSCOPE_API_KEY` 必须有

### 4.2 web 入队 (0.5h)
- [ ] `chat/routes.py` `ws_chat_stream` done 后调 `enqueue_extraction(session_id, user_id)`
- [ ] dedup 由 PG unique 约束保证

### 4.3 prompt 校准 (1h)
- [ ] `fact_extractor.py` 抽事实 prompt 改输出 JSON 严格 schema
- [ ] few-shot 例子: 学生说 "我喜欢户外项目" → `[{scope:"global", category:"interest", key:"interest.outdoor_project", value:"true", confidence:0.9}]`
- [ ] 用 PurpleAir 真 chat 3 段手测看 LLM 输出

### 4.4 启动入口 (0.5h)
- [ ] `scripts/restart.sh` 加:
  ```bash
  nohup python -m systemedu.student.workers.fact_extractor_worker \
      > .run/fact-extractor.log 2>&1 &
  ```
- [ ] kill 时也加 (`scripts/restart.sh` 顶部 kill 4000/18820/18821/fact-extractor pid)

### 4.5 单测 (0.5h)
- [ ] `tests/student/test_worker_full_cycle.py`: mock LLM 返 JSON → worker tick → PG student_facts 有数据 + Mem0 mock 被调
- [ ] worker LLM 抛 → status=failed, attempts++
- [ ] attempts=3 → status=dead

### P4 收尾
- [ ] 真 LLM 烟雾: chat 2 轮 done → 等 5min → `psql -c "select * from student_facts"` 有数据
- [ ] **commit**: `feat(031-P4): FactExtractor worker 独立 + qwen-plus 抽事实`

---

## Phase 5: 前端 page_kind + exercise attempt — 2h

### 5.1 ChatPanel 加 pageKind prop (0.5h)
- [ ] `chat-panel.tsx`: prop `pageKind?: "global"|"home"|"library_detail"|"learn"`
- [ ] 默认 "learn" (现仅 LearnPage 用)

### 5.2 WS hook payload (0.3h)
- [ ] `use-websocket-chat.ts`: send 时加 `page_kind: options?.page_kind`
- [ ] ChatPanel.handleSend 传 page_kind

### 5.3 LearnPage 传 pageKind (0.2h)
- [ ] `/learn/.../page.tsx` ChatDock 内 `<ChatPanel pageKind="learn" ...>`

### 5.4 exercise attempt POST (0.5h)
- [ ] `lib/api/index.ts`: 加 `exercises.record(slug, moduleId, body) → POST /api/exercise/attempt`
- [ ] `components/learning/course-content-view.tsx` ExerciseBlock onClick option 后 record(slug, moduleId, {idea_id, exercise_index, question, student_answer, correct, explanation_shown})

### 5.5 后端 endpoint (0.5h)
- [ ] 新建 `student/learning/__init__.py` + `learning/routes.py` (或加在 chat/routes.py)
- [ ] POST /api/exercise/attempt:
  - require_login → record_exercise_attempt
  - 返 `{id, created_at}`
- [ ] 加路由到 server.py ROUTES

### P5 收尾
- [ ] 浏览器手测: PurpleAir M01 答 2 题 → `psql` 看 exercise_attempts 2 条
- [ ] chat 时后端 log 看 L3 history 含这两条
- [ ] **commit**: `feat(031-P5): page_kind 前端透传 + exercise_attempts API + ExerciseBlock 上报`

---

## Phase 6: 功能测试 A/B/C/D — 6-8h

### 6.1 Unit A (~ 40 tests, 2h)
- [ ] `test_layer_l1.py`: 5 个 case (空/全局只取 valid_to NULL/按 category 分组等)
- [ ] `test_layer_l2.py`: 4 个 (home top3 / single project / 无项目空 / removed 跳过)
- [ ] `test_layer_l3_knode.py`: 4 个 (cache hit / miss fetch / library 挂 / build_summary 截断 300 字)
- [ ] `test_layer_l3_history.py`: 4 个 (当前 module + 项目级 5 错 / 空 / 别 module 不出现)
- [ ] `test_layer_l4_mem0.py`: 4 个 (global filter / library_detail filter / learn filter / mem0 disabled 返空)
- [ ] `test_layer_l5.py`: 2 个 (state 有 / 无)
- [ ] `test_inject_page_matrix.py`: 16 个 (4 page × 6 层)
- [ ] `test_inject_gather_fail.py`: 1 个
- [ ] `test_template_format.py`: 2 个 (空层跳过 / 全层渲染)
- [ ] `test_payload_page_kind.py`: 3 个 (valid / default / invalid 拒)

### 6.2 Integration B (~ 12 tests, 2h)
- [ ] 装 `testcontainers-python` 到 dev deps
- [ ] `conftest_int.py`: fixture 起 testcontainers PG + Redis + Qdrant
- [ ] `test_int_inject_real_pg.py`: 真 PG 数据 + 真 redis 跑完 5 层
- [ ] `test_int_mem0_qdrant.py`: 真 Mem0 add → search filter 命中
- [ ] `test_int_worker_cycle.py`: enqueue → worker tick → PG + Mem0 写入
- [ ] `test_int_learn_full.py`: 真 PG + mock library API, learn 页拿全 5 层
- [ ] `test_int_two_users_iso.py`: A/B user fact 隔离

### 6.3 Contract C (~ 8 tests, 0.5h)
- [ ] `test_contract_payload_v1.py`: 给 payload JSON, 严格对齐
- [ ] `test_contract_snapshot_v1.py`: MemorySnapshot 字段对齐
- [ ] `test_contract_pg_schema.py`: 跑 alembic upgrade, 断言表 / 列 / 索引

### 6.4 E2E WS D (~ 4 tests, 1.5h)
- [ ] 复用 spec 028 conftest 起 library + student-app + PG (testcontainers)
- [ ] `test_e2e_chat_learn_full_context.py`: WS 真 chat → 后端 log 注入 5 层
- [ ] `test_e2e_chat_done_enqueues.py`: done → pending_extractions 1 条
- [ ] `test_e2e_chat_global_no_l3.py`: page_kind=global 时 prompt 不含 L3
- [ ] `test_e2e_chat_two_users_iso.py`: A 的 fact 不在 B 上下文

### P6 收尾
- [ ] 全 ~64 测试 < 90s 跑过
- [ ] **commit**: `feat(031-P6): 4 类功能测试 (A unit + B int + C contract + D e2e)`

---

## Phase 7: 回答质量 eval — 4-6h

### 7.1 e2e/eval/ 骨架 (0.5h)
- [ ] 建目录 `e2e/eval/{datasets, judges, runner.py, reports}/`
- [ ] `pytest.ini` 加 marker `eval`
- [ ] `e2e/eval/__init__.py`

### 7.2 数据集 (2h)
- [ ] `purpleair_qna.jsonl` 50 条 (跨 4 page_kind, M01-M10)
- [ ] 每条字段: q / page_kind / library_slug / module_id / expected_skill / expected_topics / must_not_contain / min_length
- [ ] `ablation_pairs.jsonl` 30 条 (with_memory / without_memory)
- [ ] `fact_recall_pairs.jsonl` 10 条 (session1 学生说 fact / session2 后续问相关)

### 7.3 qwen-plus judge (1h)
- [ ] `judges/qwen_judge.py`: prompt "评 0-5 维度: 苏格拉底度 / topic 覆盖 / 不直接给答案 / 引用上下文"
- [ ] 调 dashscope qwen-plus, 输出 JSON `{score, reasons}`
- [ ] retry 3 次 + cache

### 7.4 runner + 报告 (1.5h)
- [ ] `runner.py`:
  - 起真 student-app + library (用 spec 028 conftest)
  - iterate datasets → 真 chat → 收 response → 调 judge → 收 scores
  - 输出 HTML 报告 (jinja2 template, 每条 q + agent 回答 + judge 评分 + 总平均)

### 7.5 4 类 eval 跑通 + 基线 (1h)
- [ ] E golden: ≥ 60% topic 命中
- [ ] F ablation: 含 memory 平均 > 跳 memory 0.5+
- [ ] G page-context: ≥ 70% 用对该页 context
- [ ] H fact recall: ≥ 70% session 2 用 session 1 fact
- [ ] `reports/2026-05-XX-baseline.html` 留档

### P7 收尾
- [ ] **commit**: `feat(031-P7): 4 类回答质量 eval + 50 条 PurpleAir Q&A 基线`
- [ ] spec.md Status: shipped (2026-XX-XX)
- [ ] docs/prd.md Phase checklist 加 031

---

## 实施总览

| Phase | 估时 | 输出 |
|-------|------|------|
| P1 infra | 4-6h | docker-compose + alembic + PG/Redis/Qdrant |
| P2 schema | 3h | 3 张新表 + DAO + 索引 |
| P3 layers | 6-8h | 5 层 query 重写 + page_kind dispatch |
| P4 worker | 3-4h | 独立进程 + qwen-plus 抽事实 |
| P5 前端 | 2h | page_kind + exercise attempt |
| P6 功能测试 | 6-8h | A/B/C/D ~64 tests |
| P7 eval | 4-6h | E/F/G/H 50 Q&A 基线 |
| **总计** | **28-37h** | spec 031 shipped (~ 1 周) |

## 实施提示

1. **P1 先做**: 没有 PG/Redis/Qdrant 后续全卡
2. **P3 是核心难点**: layers.py 改造完跑通就成功了 70%
3. **每 phase 末 commit + 老 pytest 全过** (回归)
4. **eval 不阻塞 ship**: P7 跑出基线就 OK, 数字不达标 fix prompt 后续迭代
5. **真 LLM 调用集中 P4 + P7**, 跑 DASHSCOPE_API_KEY 必填
