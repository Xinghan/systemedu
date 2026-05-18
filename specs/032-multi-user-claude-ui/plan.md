# 032 plan

## 影响面

### 前端 (web/)
- 删 5 个老 dashboard 子页 (agents/career-paths/mcp/skills/config) + projects (重定向)
- 改 layout.tsx: useAuth → student-app /api/auth/me, 未登录跳 /login
- 重写 dashboard/page.tsx: 推荐 + 进度
- 重写 sessions/page.tsx: 接 /api/chat/sessions
- 新建 memory/page.tsx
- 精简 AppSidebar: 6 → 4 项
- 改 AppHeader: user dropdown
- 新建 FloatingChatPanel: 右侧 drawer, 按路由推 page_kind
- 新建 use-page-kind hook
- 删老 hooks: useGatewayStatus / gateway.* API client

### 后端 (packages/student-app/)
- 新 `/api/memory/*`:
  - GET `/api/memory/facts` — 列当前 user current StudentFact
  - DELETE `/api/memory/facts/{id}` — 手动 retire
- 复用 `/api/chat/sessions/*` (已有)
- 复用 `/api/auth/me` (已有)

## 7 个 Phase

### P1 — sidebar 精简 + 路由清理 (1.5h)
- 删 5+1 老页 (agents/career-paths/mcp/skills/config/projects)
- AppSidebar 6 → 4 项 (Dashboard/Projects→/library/Sessions/Memory)
- AppHeader user dropdown (登录显示 username + 退出)
- /dashboard layout 加 useAuth gate (未登录 → /login)
- 删老 gateway.* API client / useGatewayStatus / useAppStore (gateway 相关字段)
- commit

### P2 — 后端 memory endpoint (1h)
- `packages/student-app/src/systemedu/student/memory_routes.py`:
  - GET /api/memory/facts (按 category 分组)
  - DELETE /api/memory/facts/{id} (校验 user_id 同 + retire)
- DAO 新 `retire_fact(fact_id, user_id)` 在 db.py
- 注册到 server.py
- 5 个 unit test (列空 / 列分组 / 删生效 / 删别人 403 / 删不存在 404)
- commit

### P3 — Dashboard 首页 (1h)
- 重写 (dashboard)/dashboard/page.tsx:
  - 拿 library.listProjects + library.listPurchases
  - 已购项目卡 + 每个显示 last_visited module + "继续学习" 按钮
  - 未购 → 推荐区块 (前 3 个未购)
- commit

### P4 — Sessions 页 (0.5h)
- 重写 (dashboard)/sessions/page.tsx:
  - 拿 chat.listSessions
  - 按 library_slug 分组
  - 点进 /sessions/[id] 看 messages (复用现有 /chat/[sessionId])
- commit

### P5 — Memory 页 (1h)
- 新 (dashboard)/memory/page.tsx:
  - GET /api/memory/facts → 按 category 分组渲染
  - 每条: value + confidence + 时间 + 删除按钮
  - 删除 confirm + 调 DELETE
- API client: memory.listFacts() / memory.retireFact(id)
- commit

### P6 — FloatingChatPanel (1.5h)
- components/chat/floating-chat-panel.tsx:
  - Right drawer (shadcn Sheet)
  - 内嵌现有 ChatPanel / WS hook (复用)
  - 关闭按钮 / 最小化
- hook use-page-kind.ts:
  - usePathname() → page_kind 派发 (matrix 见 spec)
- 接到 (dashboard)/layout.tsx 全局挂载
- WS hook payload 加 page_kind / library_slug / module_id
- commit

### P7 — 自测 + 文档 (0.5h)
- 起 ./scripts/restart-student.sh, 手验:
  - 未登录 → /login
  - 注册 → /dashboard 看到推荐
  - 进 /library 买项目
  - 进 /library/[slug]/[knode] 学习, 右侧 chat 出现 + page_kind=learn
  - /sessions 列出刚才聊的 session
  - /memory 看到 (worker 5min tick 后) 抽出的 facts
- 更新 spec 032 spec.md Status: shipped
- commit

## 总计 ~7h
