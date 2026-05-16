# 028-student-ai-tutor Implementation Plan

**Status**: draft
**Date**: 2026-05-16
**Owner**: xinghan

## 实施策略

把 cloud-app 的 chat 链路 (`tutor_runner` + `chat_payload` + `session` +
`/api/chat` + `/api/chat/stream`) 在 student-app 里**重写一份适配版**, **不复制
core/tutor/* (4503 行的 LangGraph + skills + memory)** — 那些直接 reuse。

关键改造发生在三个边界:
1. `tutor.tools.practice` / `tutor.tools.progress` — 老接口吃 `knode_id: int`,
   学生端是 `module_id: str` ("M01"); 写一层 `student_tools_facade` 桥到
   library + student-app 数据模型, **不改 core/tutor 的旧 tools** (让老 cloud-app
   仍能跑)
2. `core/tutor/memory/student_fact.py` 的 DB engine — 默认指 `systemedu.db`,
   加可配置, student-app 启动时指 `student.db`
3. `tutor_runner._build_input` 的 state — 学生端 `project_name` 是 slug,
   `knode_id` 是字符串

前端 ChatPanel + use-websocket-chat + chat-store 从老 web/ 复制清洗, base URL
改 `STUDENT_API_URL`, 去掉 cloud-app 专属字段 (project model id 等)。

按 spec 028 的 3 阶段 (P1 后端 / P2 前端 / P3 e2e) 推进。每阶段完成后做
本地回归 + 检查老服务仍能起。

## 现状盘点

### core/tutor/* (本 spec 不改 — 直接 reuse)

```
packages/core/src/systemedu/core/tutor/
  graph.py          build_tutor_graph(loader, llm, checkpointer, memory_injector)
  state.py          TutorState TypedDict
  nodes/{confirm_handler, safety_gate, memory_inject, skill_router, output_stream}
  tools/{decorator, registry, memory, meta} ← 不改
  tools/{practice, progress} ← 用学生 facade 包一层, core 内部不动
  memory/{layers, student_fact, fact_extractor, pending_extraction, mem0_adapter}
  skills/builtin/{socratic_questioning, direct_instruction, scaffolding,
                  pbl_driving_question, reflection_prompt, error_diagnosis}
  checkpoint/{sqlite_saver, pg_saver}
```

### cloud-app 现有 chat 链路 (本 spec 在 student-app 重写)

```
packages/cloud-app/src/systemedu/cloud/gateway/
  chat_payload.py    73 行 — ChatPayload pydantic 校验 + thread_id
  tutor_runner.py    215 行 — graph 缓存 + invoke/stream/shutdown
  session.py         172 行 — SessionManager (CRUD chat_messages/sessions)
  server.py 摘要:
    L218 api_chat       POST /api/chat
    L249 ws_chat_stream WS /api/chat/stream
    L4139 startup       _multiuser_init_db + tutor_runner._get_graph 预热
```

### 老 web/ 前端 (本 spec 在 student-web 重写)

```
web/src/
  components/chat/{chat-panel, chat-input, message-bubble, markdown-renderer}.tsx
  lib/hooks/use-websocket-chat.ts
  lib/stores/chat-store.ts
  lib/types/api.ts ChatRequest / ChatResponse / ChatMessage 接口
```

### tools/practice 与 tools/progress 的硬约束

```python
# tools/practice.py L51
LessonContent.knode_id == int(knode_id)       # 老 cloud-app: int 主键
# tools/progress.py L67
ProgressRecord.knode_id == knode_int          # 同上
```

学生端没有 `LessonContent` 表 (它在 cloud-app `systemedu.db` 里), 学习内容直接走
library-app HTTP。需要在 student-app 里写一层 `student_tools_facade.py`:

```python
@tool
async def get_practice_exercises(project_slug: str, module_id: str):
    """从 library-app 拉 knode -> 抽 rendered_sections.exercises"""
    k = await library_client.get_knode(project_slug, module_id)
    # ... 从 k.rendered_sections.rendered_sections 找 mode=exercise 的 section

@tool
async def complete_node(project_slug: str, module_id: str):
    """桥到 myProjects.setProgress (student.db last_visited)"""

@tool
async def get_progress(project_slug: str):
    """读 student.db UserProject + LastVisited"""
```

注册时**覆盖**同名 core tools (registry 用 dict, 后注册的覆盖)。

## Phase 1: 后端 — student-app/.../chat (~ 4-6h)

### Step 1.1: 包骨架

```bash
mkdir -p packages/student-app/src/systemedu/student/chat
```

文件:
- `chat/__init__.py`
- `chat/payload.py` — 新 ChatPayload (学生端字段)
- `chat/session.py` — ChatSession + ChatMessage CRUD
- `chat/tutor_runner.py` — 复制 + 适配 cloud-app tutor_runner
- `chat/student_tools.py` — practice/progress 工具的 student-app 版本
- `chat/routes.py` — POST /api/chat + WS /api/chat/stream + sessions CRUD

### Step 1.2: 改 student/db.py 加 ChatSession + 升级 ChatMessage

加表 `chat_sessions`, 给 `chat_messages` 加列 (session_id FK / tool_calls JSON / skill str)。
更新 ChatMessage __tablename__ 字段。本地 student.db 直接 drop + create_all (dev),
不写 alembic migration (生产 student-app 还没有数据要保留)。

### Step 1.3: ChatPayload 适配学生端

新 `chat/payload.py`:

```python
class ChatPayload(BaseModel):
    message: str
    session_id: str | None = None
    library_slug: str | None = None  # 替代 project_name
    module_id: str | None = None      # 替代 knode_id (字符串)
    confirm_response: dict | None = None

    def thread_id(self, user_id: str) -> str:
        if self.library_slug:
            return f"{user_id}:{self.library_slug}:{self.module_id or 'project-main'}"
        return f"{user_id}:global"
```

去掉 `agent / node_id / active_tab / page_index / project / user_id` 等老兼容字段。

### Step 1.4: SessionManager (student.db 版)

```python
class SessionManager:
    def list_sessions(user_id, library_slug=None) -> [ChatSession]
    def get_session(session_id) -> ChatSession | None
    def get_messages(session_id) -> [ChatMessage]
    def create_session(user_id, library_slug, module_id, title) -> ChatSession
    def delete_session(session_id, user_id) -> bool  # 验所有权
    def append_message(session_id, role, content, tool_calls=None, skill=None)
```

不沿用 cloud-app 那套 `agent_name`/`project_name` 字段 — 简化。

### Step 1.5: tutor_runner 适配

复制 `cloud-app/.../tutor_runner.py`:
- `_skills_root()` 不变 (找 core/tutor/skills/)
- `_get_graph()`:
  - LLM 从 systemedu config 取 (不变)
  - checkpointer 路径改 `~/.systemedu/tutor-checkpoint-student.db` (独立)
  - MemoryInjector 的 `db_session_factory` 用 student.db 的 get_session
    (新建一个 `student_memory_db.py` 包装)
- `_build_input`: 接受新 ChatPayload, 字段 `project_name=library_slug`,
  `knode_id=module_id` 喂给 TutorState (TutorState 字段名不变, 只是值类型变)

### Step 1.6: student_tools — 覆盖 practice / progress

```python
# chat/student_tools.py
from systemedu.core.tutor.tools.decorator import tool
from systemedu.core.tutor.tools.registry import ToolRegistry
from systemedu.core.library_client import AsyncLibraryClient
from ..db import get_last_visited, list_user_projects, upsert_last_visited

@tool(name="get_practice_exercises", ...)
async def get_practice_exercises(project_slug: str, module_id: str):
    client = get_library_client()
    k = await client.get_knode(project_slug, module_id)
    rs = (k.__dict__.get("rendered_sections") or {})
    rs_inner = rs.get("rendered_sections") or {}
    out = []
    for section in rs_inner.values():
        if section.get("mode") == "exercise":
            out.extend(section.get("exercises") or [])
    return {"found": bool(out), "module_id": module_id, "exercises": out}

@tool(name="get_progress", ...)
async def get_progress(project_slug: str, user_id: str):
    items = list_user_projects(user_id)
    return {"project_slug": project_slug, "items": [...]}

@tool(name="complete_node", ...)
async def complete_node(project_slug: str, module_id: str, user_id: str):
    upsert_last_visited(user_id, project_slug, module_id)
    return {"ok": True}
```

注册:

```python
def register_student_tools(registry: ToolRegistry):
    registry.register(get_practice_exercises)
    registry.register(get_progress)
    registry.register(complete_node)
```

`build_tutor_graph` 当前从 `loader.list_all()` 拿 skills + 从内部 registry 拿 tools。
要确认 tool registry 在 graph 内的传递方式 — 在 Step 1.5 实施时具体看。

### Step 1.7: WebSocket 鉴权策略

主路径: `?token=xxx` query string (跟 file API 一致, 简单)。
WebSocket header 不通用 — 浏览器不能给 WS 加自定义 header。

```python
async def ws_chat_stream(websocket: WebSocket):
    token = websocket.query_params.get("token")
    user_id = _validate_jwt(token)
    if not user_id:
        await websocket.close(code=4401)
        return
    ...
```

### Step 1.8: POST /api/chat + WS /api/chat/stream + 4 sessions routes

```
POST   /api/chat                       非流式备用
WS     /api/chat/stream?token=xxx      主路径
GET    /api/chat/sessions              当前 user 全部 session 摘要
GET    /api/chat/sessions/{id}         单 session 完整 messages
POST   /api/chat/sessions              新建 session
DELETE /api/chat/sessions/{id}         删除
```

### Step 1.9: server.py 加 chat 路由 + lifespan 预热 graph

```python
# student/server.py
async def _lifespan(_app):
    init_db()
    from .chat.tutor_runner import preload_graph
    await preload_graph()  # 启动时预热, 避免首次请求等 10s
    yield
    from .chat.tutor_runner import shutdown
    await shutdown()
```

加 `WebSocketRoute` import + 路由列表。

### Step 1.10: pytest 单测

- `tests/student/test_chat_payload.py` — ChatPayload 校验
- `tests/student/test_chat_session.py` — SessionManager CRUD
- `tests/student/test_chat_tools.py` — student_tools 调通
- `tests/student/test_chat_routes.py` — POST /api/chat (mock LLM) +
  /api/chat/sessions CRUD
- `tests/student/test_chat_ws.py` — WebSocket 握手 + 鉴权 (mock LLM)

目标 ≥ 80% line coverage on chat 模块。

### Step 1.11: 本地烟雾

```bash
curl -X POST http://127.0.0.1:18820/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"AQI 是什么", "library_slug":"purpleair-airquality-node", "module_id":"M03"}'
# 期望: 200, 返回 {"response":"...苏格拉底式回应...", "thread_id":"..."}
```

### P1 收尾
- commit `feat(028-P1): student-app chat 后端 (tutor + sessions + WS)`
- 老 cloud-app /api/chat 仍能起 (回归)
- pytest tests/student/ 全过

## Phase 2: 前端 — student-web chat (~ 3-5h)

### Step 2.1: 复制 chat 组件

```bash
cp web/src/components/chat/{chat-panel,chat-input,message-bubble}.tsx \
   packages/student-web/src/components/chat/
# markdown-renderer 已在 P2.4-redo 复制
```

### Step 2.2: WebSocket hook + store

```bash
cp web/src/lib/hooks/use-websocket-chat.ts packages/student-web/src/lib/hooks/
cp web/src/lib/stores/chat-store.ts packages/student-web/src/lib/stores/
```

清洗:
- WS URL 改 `STUDENT_API_URL` (现在是 `http://localhost:18820`)
- token 附 query string (跟 P1.7 一致)
- 字段命名 `project_name → library_slug`, `knode_id` 保持字符串

### Step 2.3: chat-store 改造

`chat-store.ts` 从 cloud-app 的 `/api/sessions/full` 改用 student-app 的 4 个
`/api/chat/sessions/*` endpoint。

### Step 2.4: LearnPage 集成

学习页右下角浮动按钮呼出 ChatPanel:

```tsx
const [chatOpen, setChatOpen] = useState(false)

// 上下文绑当前 (slug, moduleId)
useEffect(() => {
  if (chatOpen) {
    chatStore.setContext({ library_slug: slug, module_id: moduleId })
  }
}, [chatOpen, slug, moduleId])

return (
  <>
    {/* ... 现有学习页 ... */}
    <FloatingChatButton onClick={() => setChatOpen(true)} />
    {chatOpen && (
      <ChatPanel onClose={() => setChatOpen(false)} />
    )}
  </>
)
```

样式: bottom-right 圆形按钮, 点开后是从右侧滑出的 320-400px 宽 panel,
学习页主区不让出 (overlay)。移动端 fullscreen drawer。

### Step 2.5: 多会话切换 UI

ChatPanel 顶部加会话切换 (与老 web 一致): 当前 session 标题 + 下拉切换 +
"+ 新建对话" 按钮。

### Step 2.6: ChatPanel + LearnPage 联动 (可选)

- agent 调 practice 工具时 ChatPanel 渲染"练习题"卡片 (老 web 已有 UI)
- agent 调 complete_node 时学习页右上角显示 toast "M01 已完成"
- agent skill 切换时 ChatPanel header 显示当前 skill 标签

### Step 2.7: 本地浏览器手测

3 服务起齐 (lib 18821 + student-app 18820 + student-web 4000):
- 访问 /learn/.../M01 → 点 AI 助教 → 发 "AQI 是什么"
- 看到流式 chunk → agent 用苏格拉底问回
- 答错 → agent skill 切到 error_diagnosis
- 关浏览器 → 重开 /learn/.../M01 → session 自动恢复

### P2 收尾
- commit `feat(028-P2): student-web ChatPanel + WS 流式接 tutor`

## Phase 3: e2e + 部署

### Step 3.1: Playwright e2e

`e2e/tests/student-chat-028.spec.ts`:

```typescript
test("学生学习页内 AI 助教对话", async ({ page }) => {
  await login(page)
  await page.goto("/learn/purpleair-airquality-node/M01")
  await page.click('button[aria-label="AI 助教"]')
  await page.fill('textarea', 'AQI 是什么意思？')
  await page.keyboard.press('Enter')
  // 等 agent 回复 (至少 30 字)
  await expect(page.locator('.message-assistant').first()).toContainText(/.{30,}/, { timeout: 30000 })
})

test("跨页面 session 持久化", async ({ page, context }) => { ... })
test("skill 切换", async ({ page }) => { ... })
```

LLM 调用走真 LLM (Qwen 或 mock — 决策见 TODO)。

### Step 3.2: 部署 (跟 spec 027 P3 一起)

跟 spec 027 P3 deploy.sh 改造合并:
- nginx 加 WebSocket 升级:
  ```nginx
  location /api/chat/stream {
    proxy_pass http://127.0.0.1:18820;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
  }
  ```
- systemd `systemedu-student-app.service` 加 `LLM_PROVIDER=qwen` env

### Step 3.3: 验收 e2e 跑通

在 47.92.200.21 生产跑 e2e 全过 → spec 028 shipped。

## 影响面 + 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| core/tutor/* 旧 tools 假设 int knode_id, 改字符串可能破坏老 cloud-app | 回归挂 | 不改 core/tutor/tools, 用 student-app 内部覆盖注册 |
| LangGraph checkpointer 跨服务复用导致状态污染 | thread 错乱 | student-app 用独立 checkpoint db `tutor-checkpoint-student.db` |
| Mem0 SDK 网络依赖, 不稳定 | chat 慢 | 第一版禁用 Mem0, 只用 SQL student_fact 表 (env 可切换) |
| WebSocket 通过 nginx 时 proxy_read_timeout 默认 60s, 长对话被掐断 | 学生对话被切 | nginx 配 86400s (24h), 跟 cloud-app 一致 |
| safety_gate 学生事实抽取后台 worker 占内存 | student-app OOM | worker 用 asyncio.Queue 限流 + max queue size |
| 老 web 学习页和新 student-web 同时跑会两边都写 student.db chat_messages | 数据混 | 老 cloud-app 写 systemedu.db, student-app 写 student.db, 各自独立 |

## 验收 (从 spec 抄过来)

- [ ] 学生在 `/learn/.../M01` 看到右下角 "AI 助教" 按钮
- [ ] 点击呼出 ChatPanel, 默认绑当前 (slug, moduleId) 上下文
- [ ] 学生发消息 → 流式收到 agent 回复
- [ ] agent 默认行为是苏格拉底式追问
- [ ] 学生答错后 agent 切到 scaffolding/error_diagnosis skill
- [ ] agent 在合适场景调用 practice 工具派题
- [ ] 学生说出个人事实 → 后台 worker 抽到 student_fact
- [ ] 关浏览器后回来, ChatPanel 恢复历史
- [ ] 学生可新建/删除/切换 session
- [ ] 老 cloud-app /api/chat 本地仍能起
- [ ] Playwright e2e 全过

## 实施顺序总览

| Phase | Step | 估时 | 输出 |
|-------|------|------|------|
| P1 | 1.1 骨架 | 0.3h | chat/ 目录 + 6 个文件 |
| P1 | 1.2 DB 迁移 | 0.5h | ChatSession + ChatMessage 升级 |
| P1 | 1.3 ChatPayload | 0.3h | 学生端字段 |
| P1 | 1.4 SessionManager | 1h | 6 个 CRUD 方法 + detach helpers |
| P1 | 1.5 tutor_runner | 1h | invoke + stream + preload + shutdown |
| P1 | 1.6 student_tools | 1h | 3 个工具覆盖 core tools |
| P1 | 1.7 WS 鉴权 | 0.3h | ?token= 走 JWT 解码 |
| P1 | 1.8 routes | 0.5h | 6 个路由 (chat + sessions) |
| P1 | 1.9 server lifespan | 0.3h | 预热 + shutdown |
| P1 | 1.10 pytest | 1.5h | 5 个测试文件 + 80% 覆盖 |
| P1 | 1.11 烟雾 | 0.3h | curl 端到端通 |
| **P1 小计** | | **~ 7h** | student-app chat 后端 |
| P2 | 2.1 复制组件 | 0.3h | chat-panel + input + bubble |
| P2 | 2.2 hook + store | 0.5h | WS hook + chat-store |
| P2 | 2.3 store 改造 | 0.5h | 接 student-app sessions API |
| P2 | 2.4 LearnPage 集成 | 1h | 浮动按钮 + panel |
| P2 | 2.5 多会话 UI | 0.5h | 切换 + 新建 |
| P2 | 2.6 联动 (可选) | 0.5h | 工具卡片 + skill 标签 |
| P2 | 2.7 手测 | 0.5h | 浏览器走通 |
| **P2 小计** | | **~ 4h** | student-web ChatPanel |
| P3 | 3.1 e2e | 1h | 3 个 test |
| P3 | 3.2 部署 | 0.5h | nginx WS + env |
| P3 | 3.3 验收 | 0.5h | 全过 |
| **P3 小计** | | **~ 2h** | shipped |
| **总计** | | **~ 13h** | spec 028 shipped |

## 下一步

写 `tasks.md` 把这些 step 拆成可勾选 checklist。
