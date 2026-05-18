# 031-tutor-context-memory

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-18

## 背景 / 问题

学生在 `http://127.0.0.1:4000` 学习时, ChatPanel 调到 student-app:18820
背后的 tutor agent. agent 现在**裸聊** — 不知道:
- 学生是谁 (兴趣 / 之前问过啥 / 哥哥是不是哮喘患者)
- 学生在哪个项目学到哪 (PurpleAir / 进度 M03)
- 当前 knode 内容 (M03 讲的是 AQI 算法)
- 学生答过的题 / 出过的错
- 历史对话语义召回 (之前聊过 PM2.5 危害的相关片段)

后果: agent 苏格拉底回答缺针对性, 学生说一遍的事下次还要再说.

spec 014 已经设计了 5-layer memory injector (`core/tutor/memory/layers.py`),
但 spec 027 拆 student-app 后**数据源全断了** — L1-L4 都查 cloud-app 的
`LessonContent / ProgressRecord / ExerciseAttempt / Enrollment` 表, student-app
模型完全不同; Mem0 默认禁用, fact_extractor worker 没启动.

本 spec **把 5 层 memory 重新接到 student-app 数据模型 + 启用 Mem0 +
跑 fact_extractor + 加 page-level context routing**, 全多用户隔离.

## 目标 / WHAT

让 student-app:18820 chat 请求时 agent 自动拿到完整 5 层 context:

1. **L1 学生画像** — 跨项目稳定 (兴趣 / 目标 / 能力 / 家庭背景)
2. **L2 项目进度** — 当前学到哪 / 学过哪些项目
3. **L3 当前 knode 内容** — 学生正在读的章节内容摘要
4. **L3 答题历史** — 当前 module + 项目级最近错题
5. **L4 Mem0 语义召回** — 历史对话相关片段 (Qdrant 向量库)
6. **L5 当前 skill 状态** — agent 正在用哪个教学策略

按**前端路由带 `page_kind`** 决定激活哪些层 (不同页面注入不同 context).

所有数据按 `user_id` 隔离, 支持几万-几十万用户.

## 非目标

- ❌ 不重写 agent / skill 逻辑 — reuse core/tutor 的 LangGraph + 6 skills
- ❌ 不动 student-web 前端 UI — 仅前端 ChatPanel 加一个 page_kind 字段透传
- ❌ 不做 chat tutor 升级 (multi-modal / voice / 等) — spec 032+
- ❌ 不做 notes / assignment (spec 029 占位)
- ❌ 不做老 cloud-app 兼容 — 老服务已 deprecated, layers.py 改造可直接断
- ❌ 不做监控 dashboard — `pending_extractions` 表自身可查, 后续 spec

## 用户故事 / 场景

### 学生在 /learn/PurpleAir/M03 chat

1. 学生在 ChatPanel 问 "AQI 100 严重吗?"
2. 前端 send `{message, library_slug: "purpleair", module_id: "M03", page_kind: "learn"}`
3. 后端 tutor_runner.stream 调 LangGraph
4. memory_inject node 并发 fetch 5 层:
   - L1: "学生兴趣环境科学, 家里哥哥哮喘 (来自之前 session)"
   - L2: "PurpleAir-v0.3.1, 当前 M03 (S1 第 3/4 module)"
   - L3 knode: "M03 讲 AQI 怎么把浓度变颜色等级, 含 3 个理论卡 + 6 题 quiz"
   - L3 history: "你在 M02 答错 2/4 (混淆 PM2.5/PM10 尺度)"
   - L4: "前次 session 你问 '为什么 PM2.5 更危险'"
   - L5: "active=direct-instruction, turn=2"
5. agent 回答时融合: "考虑到你哥哥哮喘, AQI 100 对他来说要小心 — 它接近不健康
   敏感人群的阈值. 你记得 M02 PM2.5 vs PM10 区别吗? AQI 100 时哪个更需要关注?"
6. session done 后入队 PendingExtraction, worker 5min tick 抽事实进 student_facts + Mem0

### 学生在 /home (没绑项目)

`page_kind: "home"` → 只 L1 + L2(top 3 recent projects) + L4(cross-project)
agent 不会硬注入某项目细节, 适合 "你最近想做什么?" 类对话

### 不同用户隔离

user A 说过 "哥哥哮喘" → A 的 chat 看 L1 含此 fact;
user B 同时间 chat → B 的 L1 不包含 A 的事实 (Qdrant filter + PG WHERE user_id)

## 系统架构

```
┌────────────────────────────────────────────────────┐
│ Browser :4000 (student-web)                        │
│   ChatPanel send {message, library_slug, module_id,│
│                   page_kind, session_id}            │
└─────────────────┬──────────────────────────────────┘
                  │ WS /api/chat/stream?token=
                  ▼
┌────────────────────────────────────────────────────┐
│ student-app :18820 (web server, 可多实例)          │
│  /api/chat/stream                                  │
│   ↓ 1. JWT decode → user_id                       │
│   ↓ 2. ChatPayload validate (含 page_kind)        │
│   ↓ 3. tutor_runner.stream(payload, user_id)      │
│        ↓ LangGraph memory_inject node              │
│        ↓ MemoryInjector.inject(...) 5 层并发      │
└─────┬──────┬───────┬────────────┬─────────────────┘
      │      │       │            │
      ▼      ▼       ▼            ▼
   ┌────┐ ┌────┐ ┌─────────┐ ┌─────────────────┐
   │ PG │ │Redis│ │library  │ │ Qdrant + Mem0   │
   │5432│ │6379 │ │ :18821  │ │ :6333           │
   └─┬──┘ └────┘ └─────────┘ └──────┬──────────┘
     │                              │
┌────┴──────────────────────────────┴───────────────┐
│ fact_extractor worker (独立 systemd unit)         │
│  5min tick → PendingExtraction → LLM (qwen-plus) │
│  → INSERT student_facts (PG) + Mem0 add (Qdrant) │
└────────────────────────────────────────────────────┘
```

**4 个新基础设施 (生产 47.92.200.21 + 本地 docker compose):**
- Postgres 13+ (替代 SQLite student.db)
- Redis 7+ (knode 内容 cache, TTL 5min)
- Qdrant 1.7+ (Mem0 向量库, 单 collection, filter by user_id)
- fact_extractor systemd unit

## Schema 设计 (Postgres)

### 已有表 (迁 PG 时保留)

users / user_projects / last_visited / chat_sessions / chat_messages
(详见现 student-app db.py)

### 新增表

**1. `exercise_attempts` — L3 学生答题记录**
```sql
CREATE TABLE exercise_attempts (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id),
    library_slug    TEXT NOT NULL,
    module_id       TEXT NOT NULL,
    idea_id         TEXT,
    exercise_index  INT,
    question        TEXT,
    student_answer  TEXT,
    correct         BOOLEAN,
    explanation_shown TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ea_user_slug_module ON exercise_attempts (user_id, library_slug, module_id);
CREATE INDEX idx_ea_user_created ON exercise_attempts (user_id, created_at DESC);
```

**2. `student_facts` — L1/L3 长期记忆事实**
```sql
CREATE TABLE student_facts (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id),
    scope           TEXT NOT NULL,    -- 'global'|'project'|'knode'
    library_slug    TEXT,
    module_id       TEXT,
    category        TEXT NOT NULL,    -- 'interest'|'goal'|'skill_level'|'family'|'misconception'|'preference'
    key             TEXT NOT NULL,
    value           TEXT NOT NULL,
    source_session  UUID,
    confidence      REAL DEFAULT 0.7,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to        TIMESTAMPTZ,
    superseded_by   UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sf_user_scope ON student_facts (user_id, scope) WHERE valid_to IS NULL;
CREATE INDEX idx_sf_user_slug ON student_facts (user_id, library_slug) WHERE valid_to IS NULL;
CREATE UNIQUE INDEX idx_sf_user_scope_key_current ON student_facts
    (user_id, scope, COALESCE(library_slug,''), COALESCE(module_id,''), key)
    WHERE valid_to IS NULL;
```

**3. `pending_extractions` — FactExtractor worker 队列**
```sql
CREATE TABLE pending_extractions (
    id              UUID PRIMARY KEY,
    session_id      UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    enqueued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'pending',
    error           TEXT,
    attempts        INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_pe_status_enqueued ON pending_extractions (status, enqueued_at)
    WHERE status IN ('pending', 'failed');
```

### Migrate 策略

- 引入 `alembic`, 写 baseline migration: 现 SQLite schema → PG initial + 4 新表
- 一次性脚本 `scripts/migrate_sqlite_to_pg.py`: dev 数据搬运
- dev `scripts/restart.sh` 自动起 PG docker
- 生产首次部署: deploy.sh 起 PG + 跑 migration + (可选) dump SQLite 导入

## Page-kind 激活矩阵

ChatPayload 新增 `page_kind` 字段 (前端按路由带):

| page_kind | 触发路由 | L1 | L2 | L3 (knode) | L3 (history) | L4 | L5 |
|---|---|---|---|---|---|---|---|
| `global`         | 全局浮窗 (暂未做) | ✓ | — | — | — | ✓ cross | — |
| `home`           | /home              | ✓ | ✓ top3 | — | — | ✓ cross | — |
| `library_detail` | /library/[slug]    | ✓ | ✓ this | — (用 blueprint) | — | ✓ filter slug | — |
| `learn`          | /learn/[slug]/[m]  | ✓ | ✓ this | ✓ | ✓ | ✓ filter slug+m | ✓ |

`project_home` 视为 `library_detail` alias.

## 5 层实现细节

**L1**: PG `SELECT * FROM student_facts WHERE user_id AND scope='global' AND valid_to IS NULL`

**L2**:
- `home`: `user_projects WHERE removed_at IS NULL ORDER BY pulled_at DESC LIMIT 3`
- `library_detail`/`learn`: `user_projects + last_visited` 单 slug

**L3 knode content** (只 learn):
```python
# Redis key: knode:{slug}:{module}:summary, TTL 5min
cached = await redis.get(key)
if cached: return cached
k = await library_client.get_knode(library_slug, module_id)
summary = build_summary(k)  # plan_md 首 300 + theories 标题 + exercises 数
await redis.setex(key, 300, summary)
```

**L3 exercise history** (只 learn):
- 当前 module 全部 + 项目级最近 5 条错的

**L4 Mem0 semantic recall**:
```python
filters = {"user_id": user_id}
if page_kind in ("library_detail", "learn"): filters["library_slug"] = library_slug
if page_kind == "learn": filters["module_id"] = module_id
results = await mem0.search(query=last_user_msg, filters=filters, top_k=3)
```

**L5**: 直接读 LangGraph state.skill_state, 无 DB I/O

### 并发 + 兜底

`asyncio.gather(*tasks, return_exceptions=True)` — 任一层挂用空串占位, 不阻塞其他.

### Prompt 注入

5 层结果用固定 template 塞 messages[0] SystemMessage:
```
## L1 学生画像
{l1_profile}

## L2 项目上下文
{l2_project_ctx}

## L3 当前 knode
{l3_knode_content}

## L3 答题历史
{l3_exercise_history}

## L4 相关历史对话
{l4_semantic_recall}

## L5 当前教学策略
{l5_skill_ctx}
```

agent / skill 内部不动, 在 prompt 里自然读到.

## FactExtractor Worker

### 进程

独立 systemd unit, 5min tick, batch 20:
```bash
python -m systemedu.student.workers.fact_extractor_worker
```

### 流程

```
session done (web 端) → INSERT pending_extractions(status='pending')

worker tick:
  SELECT * FROM pending_extractions WHERE status='pending' LIMIT 20
  for each:
    load chat_messages(session_id)
    call qwen-plus 抽事实 (JSON list)
    apply supersede chain → INSERT student_facts (PG)
    Mem0.add(user_id, session 摘要, metadata={slug, module_id, session_id})
    UPDATE processed_at, status='done'

failure:
  status='failed', attempts++
  attempts>=3: status='dead'
```

### LLM 选择

| 用途 | model |
|---|---|
| chat agent (主对话) | GLM-5.1 thinking (现有默认) |
| fact_extractor worker | qwen-plus (便宜批量) |
| Mem0 embed | qwen text-embedding-v3 |
| eval LLM judge | qwen-plus |

config 加 `cheap` provider 别名 → qwen-plus.

### Web 入队

`ws_chat_stream` done 后:
```python
db.add(PendingExtraction(session_id=session_id, user_id=user_id))
db.commit()  # 立即返, chat 体验零延迟
```

## API 改动

**ChatPayload (新加 page_kind 字段):**
```python
class ChatPayload(BaseModel):
    message: str
    session_id: str | None = None
    library_slug: str | None = None
    module_id: str | None = None
    page_kind: Literal["global", "home", "library_detail", "learn"] = "global"
    confirm_response: dict | None = None
```

**POST /api/exercise/attempt (新 endpoint, learn 页提交答题):**
```
POST /api/exercise/attempt
body: {library_slug, module_id, idea_id, exercise_index, question,
       student_answer, correct, explanation_shown}
auth: JWT (user_id 从 token)
response: {id, created_at}
```

学生学习页答题 → 前端 POST → exercise_attempts 写入. 供 L3 history.

## 测试

### 第一部分: 功能正确性 (pytest CI)

**A. Unit (~ 40 tests, < 5s)**
- 5 层 layer 逐 test (page_kind matrix / gather fail / supersede chain / etc.)

**B. Integration (~ 12 tests, 30-60s)**
- testcontainers 起真 PG + Redis + Qdrant, 跑完 5 层 / 真 Mem0 / worker full cycle

**C. Contract (~ 8 tests)**
- ChatPayload / MemorySnapshot schema 严格对齐 + alembic 表/索引

**D. E2E WS chat (~ 4 tests)**
- 真 WS, 真 5 层注入 + session done → pending_extractions / 两 user 隔离

### 第二部分: 回答质量 eval (`pytest -m eval`, 不进 CI)

LLM judge = **qwen-plus**:

**E. Golden Q&A 集 (50 条 PurpleAir 问题)**
- 每条标 expected_skill / expected_topics / 禁词 / 最小长度
- judge 评: skill 命中 / topic 覆盖率 / 苏格拉底度

**F. Memory ablation**
- 同问题跑两次 (含 / 跳 memory), judge 对比打分
- 目标: 含 memory 平均分 > 跳 memory 0.5+ (满分 5)

**G. Page-context relevance**
- 50 条跨 4 page_kind, judge 评 "回答用对该页 context 没"
- learn 问 "我答错过啥" 必须引 L3 history; home 问 "学到哪了" 必须 L2 项目列表

**H. Fact recall accuracy**
- 10 个 "学生说出 fact → 后续问相关问题" 流程
- 验证 worker 抽出的 fact 在下次 chat L1/L4 被用上
- 目标准确率 ≥ 70%

**跑法:**
```bash
# CI
pytest tests/student/ -q

# 人/cron (每周)
DASHSCOPE_API_KEY=... pytest e2e/eval/ -m eval --report=reports/$(date +%F).html
```

eval 跑一次约 30min, qwen-plus cost ~$0.5-1.

## 影响 / 风险

| 风险 | 缓解 |
|---|---|
| Postgres 迁移破老 SQLite 数据 | dev 直接 drop 重建 (无生产用户); 生产首次 deploy 跑一次性迁脚本 |
| Mem0 SDK 跟 Qdrant 不兼容 | mem0_adapter.py 已抽象, 用 Mem0 默认 client 配 Qdrant; integration test 守 |
| fact_extractor 拖死 web | 独立进程 systemd, web 只 enqueue 不等 |
| Qdrant 几万 user → 单 collection metadata 大 | filter by user_id 高效 (Qdrant 内置 payload index); spec 035+ 才需要 sharding |
| Redis 挂 → knode content 拿不到 | redis client 抛 → L3 layer 返空 / fallback library API 直拉 |
| page_kind 误传 | ChatPayload Pydantic Literal 严格校验; 不在白名单 → 默认 global 安全降级 |
| 老项目 (无 final_outcomes, 无 stage_id, 等) → L2/L3 拿不到字段 | layers 用 .get() 兜底, 缺则跳过 |

## 影响面 (文件)

| 文件 | 改动 |
|------|------|
| `packages/core/src/systemedu/core/tutor/memory/layers.py` | L1-L3 query 重写到 student-app schema, 加 page_kind dispatch |
| `packages/core/src/systemedu/core/tutor/memory/mem0_adapter.py` | enable + Qdrant filter, embed model qwen |
| `packages/core/src/systemedu/core/tutor/memory/fact_extractor.py` | prompt 适配新 scope/category schema |
| `packages/student-app/src/systemedu/student/db.py` | Postgres engine + 加 ExerciseAttempt/StudentFact/PendingExtraction 表 + alembic |
| `packages/student-app/src/systemedu/student/cache.py` (新) | Redis client wrapper |
| `packages/student-app/src/systemedu/student/chat/payload.py` | 加 page_kind 字段 |
| `packages/student-app/src/systemedu/student/chat/routes.py` | ws 末尾 enqueue PendingExtraction; 新 POST /api/exercise/attempt |
| `packages/student-app/src/systemedu/student/chat/tutor_runner.py` | inject 时透传 page_kind 给 MemoryInjector |
| `packages/student-app/src/systemedu/student/workers/fact_extractor_worker.py` (新) | 独立 main, 5min tick |
| `packages/student-web/src/components/chat/chat-panel.tsx` | sendMessage 加 page_kind (按 route props 推断) |
| `packages/student-web/src/lib/hooks/use-websocket-chat.ts` | payload 加 page_kind |
| `packages/student-web/src/components/learning/course-content-view.tsx` | exercise 答题时调 /api/exercise/attempt |
| `scripts/restart.sh` | docker compose up postgres + redis + qdrant + 起 fact-extractor worker |
| `scripts/deploy.sh` | systemd: fact-extractor + 装 postgres/redis/qdrant docker |
| `docker-compose.yml` (新) | postgres/redis/qdrant 3 服务 |
| `alembic/` (新目录) | migration 文件 |
| `tests/student/` | +60 个新 test (A/B/C/D 四部分) |
| `e2e/eval/` (新) | datasets + judges + runner + 50 条 PurpleAir Q&A jsonl |

## 验收

- [ ] 5 层 memory 全部跑通: PG 数据 + library API + Mem0 都正常返
- [ ] page_kind matrix 4 行全部按预期激活/跳过
- [ ] 学生 chat 时后端 log 看到 5 层注入 prompt
- [ ] 多用户隔离: user A 的 chat 上下文不含 user B fact
- [ ] fact_extractor worker 跑, session done 5min 后看 PG student_facts 有数据 + Qdrant 有 vector
- [ ] Postgres docker / Redis docker / Qdrant docker / worker systemd 4 服务起动 OK
- [ ] alembic migration 跑通 (dev + 生产 first run)
- [ ] pytest 功能测试 ~60 个全过 (A/B/C/D)
- [ ] eval E/F/G/H 跑一次, 报告留基线
- [ ] 老 cloud-app 回归 ok (它已 deprecated, 但仍能 import)
- [ ] Playwright e2e (spec 027/028 现有) 全过

## 未来 spec

- **032 - 监控 dashboard**: pending_extractions backlog / Mem0 hit rate / fact growth timeline
- **033 - tutor multi-modal**: chat 接收图片 / 学生写代码片段
- **034 - 学生 fact 可见性**: 家长 / 学生自己看抽到的 fact (信任 + 编辑)
- **035 - Qdrant sharding / scale**: 几十万用户后单 collection 拆分策略

## TODO (plan 阶段细化)

- alembic baseline 怎么处理已部署的 SQLite student.db (drop + recreate vs migrate)
- Qdrant collection 名 / metadata schema 是否要单独 spec
- fact_extractor LLM prompt 怎么校准 (eval H 跑出来再调)
- Redis 部署是否要密码 / TLS (生产)
- page_kind 是否需要 v2 加 element_kind (用户在看 animation? exercise? assignment?) → spec 033
