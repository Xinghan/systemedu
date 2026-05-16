# 028-student-ai-tutor Tasks

**Status**: draft
**Last updated**: 2026-05-16

依据 `plan.md` 拆成可勾选清单。每完成一个 task 勾掉。每个 Phase 结束做一次 commit。

## Phase 1: 后端 — packages/student-app/.../chat/

### 1.1 包骨架 (0.3h)

- [ ] 1.1.1 建目录 `packages/student-app/src/systemedu/student/chat/`
- [ ] 1.1.2 建 6 个空文件:
  - `__init__.py`
  - `payload.py`
  - `session.py`
  - `tutor_runner.py`
  - `student_tools.py`
  - `routes.py`
- [ ] 1.1.3 暴露 `from .routes import ROUTES` 给 server.py
- [ ] 1.1.4 `python -c "from systemedu.student.chat import ROUTES"` 可 import

### 1.2 DB 迁移 (0.5h)

- [ ] 1.2.1 `student/db.py` 加 `ChatSession` model
  ```python
  __tablename__ = "chat_sessions"
  id, user_id (FK users.id, index), library_slug, module_id (nullable),
  title, active_skill (nullable), created_at, updated_at
  UniqueConstraint(user_id, library_slug, module_id, title)
  ```
- [ ] 1.2.2 升级现有 `ChatMessage` model:
  - 加 `session_id` (FK chat_sessions.id, index, nullable=False)
  - 加 `tool_calls` (Text JSON, nullable)
  - 加 `skill` (String, nullable)
- [ ] 1.2.3 加 helpers:
  - `list_chat_sessions(user_id, library_slug=None) -> [ChatSession]`
  - `get_chat_session(session_id) -> ChatSession | None`
  - `get_chat_messages(session_id) -> [ChatMessage]`
  - `create_chat_session(user_id, library_slug, module_id, title) -> ChatSession`
  - `delete_chat_session(session_id, user_id) -> bool` (验所有权)
  - `append_chat_message(session_id, user_id, library_slug, module_id, role, content, tool_calls=None, skill=None) -> ChatMessage`
- [ ] 1.2.4 启动时 `Base.metadata.create_all` 自动建表
  - 本地 student.db 先 `rm ~/.systemedu/student.db` 重建 (dev 无数据要保留)
- [ ] 1.2.5 pytest fixture 兼容 (`tests/student/conftest.py` 不需改, db_path tmp)

### 1.3 ChatPayload 适配 (0.3h)

- [ ] 1.3.1 `chat/payload.py`:
  ```python
  class ChatPayload(BaseModel):
      message: str
      session_id: str | None = None
      library_slug: str | None = None
      module_id: str | None = None
      confirm_response: dict | None = None

      @model_validator(mode="after")
      def _validate(self):
          if self.module_id and not self.library_slug:
              raise ValueError("module_id 需要 library_slug")
          return self

      def thread_id(self, user_id: str) -> str:
          if self.library_slug:
              return f"{user_id}:{self.library_slug}:{self.module_id or 'project-main'}"
          return f"{user_id}:global"
  ```
- [ ] 1.3.2 单测 `test_chat_payload.py`: 4 个 case (有 module / 无 module / 全 None / 非法 module 单独)

### 1.4 SessionManager (1h)

- [ ] 1.4.1 `chat/session.py` SessionManager 类
  ```python
  class SessionManager:
      def list_sessions(user_id, library_slug=None) -> list[dict]
      def get_session(session_id) -> dict | None
      def get_messages(session_id, limit=200) -> list[dict]
      def create_session(user_id, library_slug, module_id, title) -> dict
      def delete_session(session_id, user_id) -> bool
      def append_message(session_id, user_id, library_slug, module_id, role, content, tool_calls=None, skill=None) -> dict
  ```
- [ ] 1.4.2 返回值序列化成 dict (detach session 防 lazy load)
- [ ] 1.4.3 `delete_session` 级联删 `chat_messages` (ORM cascade 或手动)
- [ ] 1.4.4 单测 `test_chat_session.py`:
  - test_create_lists_get / test_append_message_lists / test_delete_cascades /
    test_other_user_cannot_delete / test_session_per_module

### 1.5 tutor_runner 适配 (1h)

- [ ] 1.5.1 复制 `cloud-app/.../tutor_runner.py` 到 `student/chat/tutor_runner.py`
- [ ] 1.5.2 改 import path:
  - `from systemedu.cloud.gateway.chat_payload import ChatPayload` → `from .payload import ChatPayload`
- [ ] 1.5.3 改 checkpointer 路径 (在 systemedu config 之外):
  ```python
  # systemedu config 默认 ~/.systemedu/tutor-checkpoint.db
  # student-app 独立用 ~/.systemedu/tutor-checkpoint-student.db
  os.environ.setdefault("TUTOR_CHECKPOINT_PATH", str(Path.home() / ".systemedu" / "tutor-checkpoint-student.db"))
  ```
  - 实际方案在实施时确认: get_checkpointer 是否吃 env / 是否需新建 student_memory_db wrapper
- [ ] 1.5.4 改 MemoryInjector 的 db_session_factory:
  - cloud-app 用 `systemedu.core.storage.db.get_session` (systemedu.db)
  - student-app 用什么? 决策:
    - 选项 A: student_fact 表也建在 student.db (复用 student db engine)
    - 选项 B: student_fact 留在 systemedu.db (跟 mem0 一起)
  - **推荐 A**: 学生事实就跟学生数据一起放, 简单
  - 实施: 在 student/chat/memory.py 写一个 `get_student_memory_session()`,
    用 student.db engine + 把 core/tutor/memory/student_fact.py Base.metadata
    create_all 到 student.db
- [ ] 1.5.5 `_build_input` 接受新 ChatPayload:
  ```python
  state = {
      "messages": [HumanMessage(...)],
      "user_id": user_id,
      "project_name": payload.library_slug,   # TutorState 字段名仍叫 project_name
      "knode_id": payload.module_id,            # 字段名仍叫 knode_id 但值是字符串
  }
  ```
- [ ] 1.5.6 加 `preload_graph()` async 函数, server.py lifespan 启动时调
- [ ] 1.5.7 单测 `test_chat_tutor_runner.py`:
  - test_build_input_with_module / test_build_input_global /
    test_invoke_with_mock_llm (mock get_llm) /
    test_stream_yields_chunks

### 1.6 student_tools (1h)

- [ ] 1.6.1 `chat/student_tools.py`:
  ```python
  from systemedu.core.tutor.tools.decorator import tool
  from ..library_proxy.client import get_library_client
  from ..db import list_user_projects, upsert_last_visited, get_last_visited

  @tool(name="get_practice_exercises", description="拉当前 knode 的练习题")
  async def get_practice_exercises(project_slug: str, module_id: str):
      client = get_library_client()
      k = await client.get_knode(project_slug, module_id)
      ...

  @tool(name="get_progress", description="查学生项目进度")
  async def get_progress(project_slug: str, user_id: str):
      ...

  @tool(name="complete_node", description="标记 knode 完成")
  async def complete_node(project_slug: str, module_id: str, user_id: str):
      upsert_last_visited(user_id, project_slug, module_id)
      return {"ok": True}
  ```
- [ ] 1.6.2 实施时检查 core/tutor/tools/decorator.py 的 `@tool` 用法 (参数名 / Pydantic 验证 / async)
- [ ] 1.6.3 决定 tool 注册方式 (要研究 core/tutor/graph.py 的 ToolRegistry 接线):
  - 选项 A: graph build 时传 student_tools 列表
  - 选项 B: 在 student_tools.py module load 时往全局 registry register, 后注册覆盖前
- [ ] 1.6.4 单测 `test_chat_tools.py`:
  - test_get_practice_exercises_from_library (mock library client) /
    test_complete_node_writes_db / test_get_progress_reads_db

### 1.7 WebSocket 鉴权 (0.3h)

- [ ] 1.7.1 加 `chat/auth_ws.py` helper:
  ```python
  async def authenticate_ws(websocket) -> str | None:
      token = websocket.query_params.get("token")
      if not token:
          return None
      from ..auth.jwt import decode_token
      payload = decode_token(token)
      return payload.get("sub") if payload else None
  ```
- [ ] 1.7.2 单测 `test_chat_ws_auth.py`: 4 case (无 token / 假 token / 真 token / 过期 token)

### 1.8 routes (0.5h)

- [ ] 1.8.1 `chat/routes.py`:
  ```python
  POST   /api/chat                    api_chat (非流式)
  WS     /api/chat/stream             ws_chat_stream
  GET    /api/chat/sessions           api_sessions_list
  GET    /api/chat/sessions/{id}      api_sessions_get
  POST   /api/chat/sessions           api_sessions_create
  DELETE /api/chat/sessions/{id}      api_sessions_delete
  ```
- [ ] 1.8.2 api_chat: ChatPayload 校验 → require_login → tutor_runner.invoke
  → append_message (user + assistant) → 返回 dict
- [ ] 1.8.3 ws_chat_stream: ws auth → 循环 receive_json → tutor_runner.stream
  → send_json events → 末尾 append_message (user + assistant 含 tool_calls/skill)
- [ ] 1.8.4 sessions 4 个: SessionManager 调用 + require_login
- [ ] 1.8.5 `ROUTES = [Route(...), WebSocketRoute(...), ...]` 导出

### 1.9 server.py lifespan + 路由收集 (0.3h)

- [ ] 1.9.1 `server.py` lifespan 加预热:
  ```python
  @asynccontextmanager
  async def _lifespan(_app):
      init_db()
      from .chat.tutor_runner import preload_graph, shutdown_graph
      try:
          await preload_graph()
      except Exception as e:
          logger.warning("preload tutor graph failed: %s", e)
      yield
      await shutdown_graph()
  ```
- [ ] 1.9.2 routes 列表加 `*chat_routes.ROUTES`
- [ ] 1.9.3 import WebSocketRoute 类型支持

### 1.10 pytest 全套 (1.5h)

- [ ] 1.10.1 fixture: 加 mock LLM (一个返回固定文本的 chat_model)
  - 用 `monkeypatch` 替换 `get_llm()` 返回 mock
- [ ] 1.10.2 `test_chat_payload.py` — Step 1.3.2
- [ ] 1.10.3 `test_chat_session.py` — Step 1.4.4
- [ ] 1.10.4 `test_chat_tutor_runner.py` — Step 1.5.7
- [ ] 1.10.5 `test_chat_tools.py` — Step 1.6.4
- [ ] 1.10.6 `test_chat_ws_auth.py` — Step 1.7.2
- [ ] 1.10.7 `test_chat_routes.py`:
  - test_post_chat_authed_returns_response (mock LLM)
  - test_post_chat_unauthed_401
  - test_sessions_crud (create/list/get/delete)
  - test_sessions_cannot_delete_other_user
- [ ] 1.10.8 `test_chat_ws.py` (用 httpx WebSocket client 或 pytest-asyncio):
  - test_ws_authed_streams_chunks
  - test_ws_unauthed_4401
- [ ] 1.10.9 跑 `python -m pytest tests/student/ -v` 全过, 覆盖率 ≥ 80%

### 1.11 本地烟雾 (0.3h)

- [ ] 1.11.1 起 library:18821 + student-app:18820 (用 LLM_PROVIDER=qwen + DASHSCOPE_API_KEY)
- [ ] 1.11.2 注册用户 + Pull PurpleAir + 发 chat:
  ```bash
  TOKEN=$(curl ... /api/auth/register ...)
  curl ... /api/my/projects/purpleair-airquality-node ...   # pull
  curl -X POST http://127.0.0.1:18820/api/chat \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"message":"AQI 是什么", "library_slug":"purpleair-airquality-node", "module_id":"M03"}'
  ```
- [ ] 1.11.3 预期: 200 + 返回 response 含苏格拉底式回应 (非直接给答案)
- [ ] 1.11.4 检查 chat_messages 表写入 2 条 (user + assistant)
- [ ] 1.11.5 老 cloud-app `python -m systemedu.cloud.gateway.server` 仍能起 (回归)

### Phase 1 收尾
- [ ] **P1 commit**: `feat(028-P1): student-app chat 后端 (tutor + sessions + WS)`

---

## Phase 2: 前端 — packages/student-web/.../chat/

### 2.1 复制 chat 组件 (0.3h)

- [ ] 2.1.1 `cp web/src/components/chat/chat-panel.tsx packages/student-web/src/components/chat/`
- [ ] 2.1.2 同 chat-input.tsx, message-bubble.tsx
- [ ] 2.1.3 markdown-renderer.tsx 已在 P2.4-redo 复制过, skip

### 2.2 WebSocket hook + chat-store (0.5h)

- [ ] 2.2.1 `cp web/src/lib/hooks/use-websocket-chat.ts packages/student-web/src/lib/hooks/`
- [ ] 2.2.2 `cp web/src/lib/stores/chat-store.ts packages/student-web/src/lib/stores/`
- [ ] 2.2.3 验证 zustand 已装 (P2.1 装过)

### 2.3 hook + store 改造 (0.5h)

- [ ] 2.3.1 `use-websocket-chat.ts`:
  - WS URL: `STUDENT_API_URL.replace(/^http/, 'ws') + '/api/chat/stream?token=' + token`
  - payload 字段: `library_slug` 替 `project_name`, `module_id` 替 `knode_id`
  - 移除 cloud-app 专属字段 (active_tab/page_index/agent)
- [ ] 2.3.2 `chat-store.ts`:
  - sessions API: `/api/chat/sessions` (4 个 endpoint)
  - 移除 cloud-app `/api/sessions/full` 调用
  - 状态: `sessions` / `activeSessionId` / `messages` / `streaming` /
    `streamContent` / `streamToolCalls` / `currentSkill`

### 2.4 LearnPage 集成 (1h)

- [ ] 2.4.1 学习页右下角加浮动按钮 `<FloatingChatButton>`:
  - 固定 bottom-right, 圆形, lucide `MessageSquare` icon
  - 点击 setChatOpen(true)
- [ ] 2.4.2 ChatPanel 从右侧滑出 (overlay, 不挤压主区):
  - 宽 400px (lg), fullscreen drawer (移动端)
  - 切换动画用 css transition (避免装 framer-motion)
- [ ] 2.4.3 进入 ChatPanel 时 store.setContext({library_slug, module_id}):
  - 拉该 (slug, moduleId) 的最新 session (或新建)
- [ ] 2.4.4 ChatPanel 关闭按钮 (X, 顶部右)
- [ ] 2.4.5 删 spec 027 占位 "AI 助教 (spec 028 启用)"

### 2.5 多会话切换 UI (0.5h)

- [ ] 2.5.1 ChatPanel 顶部加 session 切换 dropdown
- [ ] 2.5.2 "+ 新建对话" 按钮: 调 create_session 后切到新 session
- [ ] 2.5.3 session item 右侧加删除按钮 (要确认 dialog)

### 2.6 ChatPanel + LearnPage 联动 (0.5h, 可选)

- [ ] 2.6.1 agent 调 practice 工具时 message-bubble 渲染"练习题"卡片
- [ ] 2.6.2 agent 调 complete_node 时 toast.success("M01 已完成")
- [ ] 2.6.3 skill 切换时 ChatPanel header 显示 skill 标签 (色块, 老 web 已有)

### 2.7 本地浏览器手测 (0.5h)

- [ ] 2.7.1 三服务起齐 (lib + student-app + student-web)
- [ ] 2.7.2 浏览器手工:
  - 访问 /learn/.../M01 → 看到右下角 AI 助教按钮
  - 点击 → ChatPanel 滑出
  - 发 "AQI 是什么" → 看到流式 chunk → agent 苏格拉底问回
  - 答错 → 观察 ChatPanel header 是否切 skill 标签
  - 切到 M02 → ChatPanel 自动开 M02 的 session
  - 关浏览器 → 重开 /learn/.../M01 → session 历史恢复
- [ ] 2.7.3 截图留档 (4 张)

### Phase 2 收尾
- [ ] **P2 commit**: `feat(028-P2): student-web ChatPanel + WS 流式接 tutor`

---

## Phase 3: e2e + 部署

### 3.1 Playwright e2e (1h)

- [ ] 3.1.1 `e2e/tests/student-chat-028.spec.ts` 新建
- [ ] 3.1.2 test('学生学习页内 AI 助教对话') —— 发消息 → 看流式回复 (≥ 30 字)
- [ ] 3.1.3 test('跨页面 session 持久化') —— 关 page → 重开 → 历史恢复
- [ ] 3.1.4 test('多 session 切换') —— 新建 + 切换 + 删除
- [ ] 3.1.5 决策: e2e 用真 LLM (慢) 还是 mock LLM 模式 (env 变量切换)
  - 默认: 真 LLM (跟生产一致), CI 可设 `MOCK_LLM=1`
- [ ] 3.1.6 跑 `playwright test` 全过

### 3.2 部署调整 (0.5h, 跟 spec 027 P3 合并)

- [ ] 3.2.1 systemd `systemedu-student-app.service` env:
  - `LLM_PROVIDER=qwen`
  - `DASHSCOPE_API_KEY=...`
  - `TUTOR_CHECKPOINT_PATH=/root/.systemedu/tutor-checkpoint-student.db`
- [ ] 3.2.2 nginx 配 WebSocket:
  ```nginx
  location /api/chat/stream {
    proxy_pass http://127.0.0.1:18820;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
  }
  ```
- [ ] 3.2.3 nginx -t + reload
- [ ] 3.2.4 deploy.sh 改造同步 (跟 spec 027 P3 一起 commit)

### 3.3 生产验收 (0.5h)

- [ ] 3.3.1 47.92.200.21 跑 e2e: `E2E_BASE_URL=http://47.92.200.21 playwright test`
- [ ] 3.3.2 浏览器手测一遍生产 chat
- [ ] 3.3.3 spec.md 顶部 `Status: draft` → `Status: shipped (YYYY-MM-DD)`
- [ ] 3.3.4 docs/prd.md Phase checklist 加 028

### Phase 3 收尾
- [ ] **P3 commit**: `feat(028-P3): chat 部署到生产 + e2e 通过`

---

## 实施总览

| Phase | tasks | 估时 |
|-------|-------|------|
| P1 (11 sub) | 1.1-1.11 | ~7h |
| P2 (7 sub) | 2.1-2.7 | ~4h |
| P3 (3 sub) | 3.1-3.3 | ~2h |
| **总计** | | **~ 13h** |

## 实施提示

1. **核心难点是 P1.5/1.6** — tutor_runner 适配 + student_tools 接入。
   计划阶段已盘点 ToolRegistry / MemoryInjector 接线方式, 实施时如发现 core/tutor
   接口需调整, **回 plan 阶段补充** 再继续
2. **每个 sub-step 完成后 commit** 颗粒度 1.1-1.11 / 2.1-2.7 / 3.1-3.3
3. **回归测试每个 phase 末跑** 老 cloud-app + web 在本地能起
4. **不要在 P1 完成前动 P2** P2 需要 P1 后端跑起来才能联调
5. **P3 nginx 改造跟 spec 027 P3 合并 commit** (本地一起做完再上线)

## 相关 memory / spec

- [[spec 027]] 学生 web service (本 spec 依赖它的 student-app + student-web)
- [[project_studio_local_app_only]] studio 不做云端 — 课程生成不在 chatbot 范围
- `core/tutor/` 4503 行 — 不改, 只在 student-app 包一层

## TODO 实施前再回 plan 确认的

- [ ] **LLM provider**: dev 默认 qwen, env 可换 claude 单测用 mock — 在 1.5 / 1.10 决策
- [ ] **safety_gate 强度**: 沿用现有还是改; 1.5 / 1.10 看 nodes/safety_gate.py 调强度
- [ ] **chatbot 默认浮动按钮还是常驻侧栏**: 2.4 实施时定 (推荐浮动)
- [ ] **mock LLM e2e**: 3.1.5 决策
- [ ] **Mem0 是否启用**: 1.5 默认禁用 (env 切), 减依赖
- [ ] **ToolRegistry 注册顺序**: 1.6.3 实施时确认覆盖语义
