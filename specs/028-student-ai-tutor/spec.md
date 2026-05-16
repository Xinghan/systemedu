# 028-student-ai-tutor

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-16

## 背景 / 问题

spec 027 把学生消费端拆成独立的 student-app + student-web，但**故意把 chatbot
留给本 spec**。

当前学习页的 chatbot 位置只是一个 stub ("AI 助教 (spec 028 启用)")。学生没有
任何可用的 AI 互动 — 只能看 plan_markdown / 看动画 / 玩游戏 / 做题，遇到不
懂的问题没法问，老师也不能根据学生回应做苏格拉底式追问、判断卡点、推送练
习等。

老 cloud-app **已经实现了完整的 tutor agent 系统** (spec 014)：

- `packages/core/src/systemedu/core/tutor/` 4503 行 — LangGraph 多节点 +
  6 套教学 skill (socratic_questioning / direct_instruction /
  scaffolding / pbl_driving_question / reflection_prompt / error_diagnosis)
  + 工具集 (memory / practice / progress / meta) + checkpoint (SQLite + PG)
  + Mem0 记忆 + 学生事实抽取后台 worker
- `packages/cloud-app/.../gateway/tutor_runner.py` (215 行) — Starlette
  调 graph 的 facade
- `packages/cloud-app/.../gateway/chat_payload.py` (73 行) — 校验 chat 请求
- `packages/cloud-app/.../gateway/server.py` 里 `/api/chat` (POST) +
  `/api/chat/stream` (WebSocket) 两个路由
- `packages/cloud-app/.../gateway/session.py` (172 行) — chat session
  CRUD (落地到 ~/.systemedu/systemedu.db 的 sessions/messages 表)
- `web/src/components/chat/chat-panel.tsx` (204 行) + chat-input /
  message-bubble / markdown-renderer + `lib/hooks/use-websocket-chat.ts` +
  `lib/stores/chat-store.ts` — 完整前端

**这一坨在 cloud-app 上还能跑** (`/api/chat`), 但 spec 027 的 student-app
+ student-web 完全没有这些路由 / 这些前端组件 / 这条数据通道。

本 spec 要做的是: **把整套 tutor agent 系统从 cloud-app 迁移 (或共享) 到
student-app, 让学生在学习页内能跟 AI 助教做苏格拉底式对话, agent 还能调用
工具(查进度/出练习/提取学生事实)。**

## 目标 / WHAT

学生在 student-web 学习页内有完整的 AI 助教面板:

1. 浮动 ChatPanel — 学习页右下角始终可呼出 (或常驻侧栏)
2. 上下文绑定当前 (project_slug, module_id) — agent 知道学生在学什么
3. 苏格拉底式追问 — 默认 skill 是 `socratic_questioning`, 根据学生回应
   自动 router 切到 direct_instruction / scaffolding / error_diagnosis
4. 工具调用 — agent 能调:
   - 查学生在该 knode 的进度 / 历史回答
   - 给学生派一道针对当前难点的练习
   - 把学生说出的"事实" (知识水平/兴趣/家庭背景) 提取到长期记忆 (Mem0)
   - 提醒学生回顾上次卡住的概念
5. 流式输出 — WebSocket 推 token, 不是等整条回复完才显示
6. 会话持久化 — student-app 落地 chat history 到 student.db chat_messages
   表 (spec 027 P1.3 已建表), 学生刷新/重新进入学习页时恢复
7. 多会话 — 学生可以新建多条与同一 knode 的对话, 各自独立

## 非目标 (不做什么)

- ❌ **不做笔记 + 作业提交** — 留给 spec 029 (本 spec 跟它解耦)
- ❌ **不做 chat 多儿童档案** — 一个 user = 一个学生, 跟 spec 027 一致
- ❌ **不重写 tutor agent / skills / tools** — 直接 reuse
  packages/core/.../tutor/* (它就是放在 core 给所有上层用的)
- ❌ **不做老 cloud-app 删除** — 老服务保留 chatbot, 但学生不再走它
- ❌ **不做 3D 数字人 (LizardScene + dighuman)** — 留给 spec 030 (数字人模块
  本身要重新设计)
- ❌ **不做学习进度 dashboard** — 留给 spec 030
- ❌ **不做新 tutor skill** — 复用现有 6 套, 不加 (后续 spec 单独立项)

## 用户故事 / 场景

### 学习中提问

1. 学生进入 `/learn/purpleair-airquality-node/M03`
2. 学习页右下角有"AI 助教"按钮, 点击呼出 ChatPanel
3. 学生问 "AQI 是什么意思?"
4. agent (skill=socratic_questioning) 回 "好问题, 你觉得空气质量是数字越大
   越好还是越小越好? 想想为什么我们要把'好/坏'变成数字"
5. 学生回 "数字越小越好吧, 因为脏空气是负面的"
6. agent 切到 direct_instruction skill 给出标准答案 + 调用 practice 工具
   派一道针对 AQI 的小题验证

### 工具调用

1. agent 检测到学生回答中提到"我哥哥有哮喘", 调用 fact_extractor 工具
2. 后台 worker 把 "user.family.brother_has_asthma=true" 存到 student_fact
   (~ Mem0)
3. 下一次学生学到 AQI 健康影响时, agent (memory_inject 节点) 自动唤起这条
   事实, 把例子调成"对你哥哥这种哮喘患者, AQI 100 意味着..."

### 会话历史

1. 学生关掉浏览器
2. 第二天回来开 `/learn/purpleair-airquality-node/M03`
3. ChatPanel 自动拉昨天的 chat history 渲染 (student-app session API)
4. 接着昨天的话题问问题

### 跨 knode 切会话

1. 学生从 M03 切到 M04
2. ChatPanel 默认开 M04 的新会话 (项目内但 knode 不同)
3. 学生可以切回 M03 旧会话查看历史

## API 设计

### student-app 新增

```
# 单轮 chat (POST, 非流式备用)
POST   /api/chat                       请求 ChatPayload, 返回完整 response

# 流式 chat (WebSocket, 主要路径)
WS     /api/chat/stream                双向流, 客户端发 ChatPayload, server 推
                                       {type: chunk|tool_call|skill_switch|confirm|done|error}

# 会话管理 (落到 student.db)
GET    /api/chat/sessions              当前 user 的所有 sessions (含 last message 摘要)
GET    /api/chat/sessions/{id}         单 session 完整 message 列表
POST   /api/chat/sessions              新建 session (body: {project_slug, module_id, title?})
DELETE /api/chat/sessions/{id}         删除 session
```

`ChatPayload` 沿用 cloud-app 已有的 schema, 但:
- `user_id` 始终从 student-app JWT 取 (不信客户端)
- `project_name` 重命名/兼容 `project_slug` (与 student-app 一致)
- `knode_id` 是字符串 module_id (M01/M02), 不是 int
- 移除 `node_id` / `agent` 等老兼容字段

### 老 cloud-app 保留, 不动

老 cloud-app `/api/chat` `/api/chat/stream` 继续可用 (本地 dev), 仅生产
不部署 (spec 027 已确定生产只跑 student-app)。

## 数据 / Schema

spec 027 P1.3 已经建好 `chat_messages` 占位表:

```python
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id, user_id (FK), library_slug, module_id, role, content, created_at
```

本 spec 加 sessions 表 (放在 student-app 的 student.db):

```python
class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id              UUID primary key
    user_id         FK users.id, index
    library_slug    str, index   # 项目 = 课程上下文
    module_id       str | None   # knode 上下文; null 表示项目级
    title           str          # 自动从首句生成 / 学生改名
    active_skill    str | None   # 当前 agent skill (spec 014 状态)
    created_at      datetime
    updated_at      datetime
    UniqueConstraint(user_id, library_slug, module_id, title)
```

调整 `chat_messages` 表 (新增 FK session_id):

```python
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id              UUID
    session_id      FK chat_sessions.id, index  # 新增
    user_id         FK users.id
    library_slug    str
    module_id       str
    role            str           # 'user' | 'assistant' | 'tool' | 'system'
    content         str
    tool_calls      JSON | None   # 工具调用元数据 (调了哪个/参数/结果)
    skill           str | None    # 哪个 skill 出的这条消息
    created_at      datetime
```

需要 migrate (alembic 或简单 ALTER); spec 027 P1.3 是 dev sqlite, 重建即可,
生产 student-app 还没有数据要保留, 直接 drop+create_all。

## tutor agent 依赖关系 (本 spec 必须摸清的)

```
core/tutor/                  ── 跨层, 谁都能用 ──
  graph.py                   LangGraph build_tutor_graph(checkpointer, llm, skills, tools, memory)
  state.py                   TutorState TypedDict (messages, active_skill, user_id, ...)
  nodes/
    confirm_handler.py       学生确认/拒绝 agent 提议
    safety_gate.py           过滤未成年人不当输入/输出
    memory_inject.py         注入学生事实到 prompt
    skill_router.py          根据 state 选 skill
    output_stream.py         聚合 chunks 流出
  tools/
    decorator.py             @tool 装饰器
    registry.py              工具注册中心
    memory.py                查/写 student_fact
    practice.py              出/提交练习
    progress.py              查/更新 knode 进度
    meta.py                  agent 自我描述工具
  memory/
    student_fact.py          长期事实模型 (SQLAlchemy)
    fact_extractor.py        LLM 后台 worker 从对话抽事实
    pending_extraction.py    待处理队列
    mem0_adapter.py          调 Mem0 SDK (vector+graph hybrid)
    layers.py                短期 / 中期 / 长期记忆分层
  skills/
    base.py                  SkillBase 接口
    loader.py                SKILL.md format loader
    builtin/{socratic_questioning, direct_instruction, scaffolding,
             pbl_driving_question, reflection_prompt, error_diagnosis}/
  checkpoint/
    sqlite_saver.py          LangGraph SqliteSaver (本 spec 用这个)
    pg_saver.py              生产长期可换 PG (本 spec 不用)

cloud-app/.../gateway/        ── 旧 facade, 本 spec 在 student-app 重写 ──
  tutor_runner.py             封装 graph 调用 (invoke + stream)
  chat_payload.py             校验请求
  session.py                  会话 CRUD (落 core/storage/db.py)
  server.py                   /api/chat POST + /api/chat/stream WS

依赖:
  tutor 的 progress / practice 工具调老 cloud-app 的 project 模型 (int nodeId).
  本 spec 必须重写或包装这两个工具, 让它们接 student-app 的
  (library_slug, module_id) 模型.

  tutor 的 student_fact 写 systemedu.db, 本 spec 把它指向 student.db
  (复用 sqlite engine 的 path 配置).
```

## 实施 phase (大致, 细化进 plan.md)

### Phase 1: 后端 — student-app/.../chat 模块
- 复制 chat_payload.py / tutor_runner.py 到 student-app/.../chat/
- 改 ChatPayload: knode_id 是 string, 加 library_slug
- 改 tutor_runner: 让 graph 的 LLM / checkpointer / memory 用 student-app
  的配置 (env 变量)
- 写 session.py: ChatSession + ChatMessage CRUD (用 spec 027 P1.3 表)
- /api/chat (POST) + /api/chat/stream (WS) 路由
- /api/chat/sessions/* 4 个 CRUD route
- progress/practice tool 重写: 桥到 myProjects.setProgress 而不是
  cloud-app project 模型
- pytest 单测 (auth/session/chat 三类)

### Phase 2: 前端 — student-web ChatPanel
- 从 web 复制 chat-panel.tsx / chat-input / message-bubble / markdown-renderer
- 复制 useWebSocketChat hook + chat-store
- 改 base URL → student-app:18820
- LearnPage 集成: 浮动按钮呼出 ChatPanel, 上下文自动绑 (slug, moduleId)
- 多会话切换 UI

### Phase 3: e2e + 部署
- Playwright e2e: 进学习页 -> 打开 chatbot -> 问问题 -> 看到流式回复
  (mock LLM 或用真 LLM cassette)
- 部署进 P3 (跟 spec 027 P3 一起或单独, 取决于上线节奏)

## 验收标准

- [ ] 学生在 `/learn/.../M01` 看到右下角 "AI 助教" 按钮
- [ ] 点击呼出 ChatPanel, 默认绑当前 (slug, moduleId) 上下文
- [ ] 学生发消息 → 流式收到 agent 回复 (chunk by chunk, 不卡 5s+)
- [ ] agent 默认行为是苏格拉底式追问 (问 "你觉得呢" 不是直接给答案)
- [ ] 学生答错后 agent 切到 scaffolding/error_diagnosis skill
- [ ] agent 在合适场景调用 practice 工具派题 (UI 上有"练习题"卡片)
- [ ] 学生说出个人事实 (例如家庭背景), 后台 worker 抽到 student_fact
- [ ] 关浏览器后回来, ChatPanel 自动恢复昨天的 session + history
- [ ] 学生可新建 / 删除 / 切换 session
- [ ] 老 cloud-app `/api/chat` 本地仍能起 (回归不破坏)
- [ ] Playwright e2e 全过

## 影响面

| 文件 / 目录 | 改动 |
|------------|------|
| `packages/student-app/src/systemedu/student/chat/` (新建) | ~600-1000 行 (router + session + payload + tutor_runner) |
| `packages/student-app/src/systemedu/student/db.py` | 加 ChatSession 表 + ChatMessage 加 session_id/tool_calls/skill 列 |
| `packages/core/src/systemedu/core/tutor/tools/{practice,progress}.py` | 改造支持 (library_slug, module_id) 模型 |
| `packages/core/src/systemedu/core/tutor/memory/student_fact.py` | DB engine 路径可配置 (默认 student.db) |
| `packages/student-web/src/components/chat/*` (新建) | ~600 行 (copy from web + 改接口) |
| `packages/student-web/src/lib/hooks/use-websocket-chat.ts` (新建) | ~150 行 |
| `packages/student-web/src/lib/stores/chat-store.ts` (新建) | ~200 行 |
| `packages/student-web/src/app/(learn)/.../page.tsx` | 集成 ChatPanel |
| `packages/cloud-app/.../multiuser` | 不动 (老服务 chat 保留) |
| `web/` | 不动 |
| `scripts/` | 暂不动 (P3 跟 spec 027 P3 一起) |

## 关键约束 / 决策

1. **reuse core/tutor/, 不复制** — tutor 系统是 cross-cutting lib, 不该
   按 cloud-app/student-app 复制两份
2. **改造 tools 而不是重写** — practice/progress 工具桥到 student-app 数据模型,
   保持 tool signature 不变 (agent 不需要改)
3. **chat session 落 student.db** — 不混到 student_fact 的 systemedu.db
4. **LangGraph checkpointer 用 SQLite** — `~/.systemedu/tutor-checkpoint.db`,
   生产可后续换 PG (不在本 spec)
5. **WebSocket** — 与老 cloud-app 一致, 不退化到 SSE/long-polling
6. **教学 skill 不动** — 6 套 builtin skill 保留, 由 skill_router 自动切

## 未来 spec (依赖本 spec 立的 framework)

- **029 - notes & assignment 提交** — chat 旁边的笔记/作业面板, 用 Note /
  AssignmentSubmission 表 (spec 027 P1.3 占位)
- **030 - 学习进度 dashboard + 数字人** — 含 LizardScene / dighuman 重做
- **031 - studio desktop app** — 老 cloud-app + web 中 creator 部分搬本地

## TODO (在 plan / tasks 阶段细化)

- LLM provider 配置:  student-app 端用哪个? 沿用 systemedu config 的
  默认 Qwen, 还是允许学生选?
- safety_gate 对未成年人的过滤强度: 沿用现有, 还是更严?
- WebSocket auth: 走 ?token=query string 还是 cookie?
- chatbot 默认是浮动按钮还是常驻侧栏? (web 是 floating-chat, 学生页面 layout 不同)
- 移动端体验
