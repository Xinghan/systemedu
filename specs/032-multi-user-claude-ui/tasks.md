# 032 tasks

## P1: sidebar 精简 + 路由清理
- [ ] 1.1 删 web/src/app/(dashboard)/{agents,career-paths,mcp,skills,config,projects}/**
- [ ] 1.2 AppSidebar 6 → 4 项 (label/icon/href 更新)
- [ ] 1.3 删 lib/api 的 gateway.* (projects/agents/skills/...) — 保留 auth/library
- [ ] 1.4 删 lib/hooks/use-gateway-status.ts + lib/stores/app-store.ts 中 gateway 字段
- [ ] 1.5 AppHeader: 加 user dropdown (username + 退出)
- [ ] 1.6 (dashboard)/layout.tsx: useAuth gate (未登录 router.replace("/login"))
- [ ] 1.7 build 通过
- [ ] commit: `feat(032-P1): sidebar 4 项 + 删 6 老页 + 登录 gate`

## P2: 后端 memory endpoint
- [ ] 2.1 db.py 加 `retire_fact(fact_id, user_id) -> bool`
- [ ] 2.2 `chat/memory_routes.py` 加 GET/DELETE
- [ ] 2.3 chat/__init__.py 合并 ROUTES
- [ ] 2.4 tests/student/test_memory_routes.py 5 个 test
- [ ] commit: `feat(032-P2): /api/memory/facts GET+DELETE`

## P3: Dashboard 首页
- [ ] 3.1 重写 (dashboard)/dashboard/page.tsx (Card 进度 + 推荐)
- [ ] 3.2 调 library.listProjects / listPurchases
- [ ] 3.3 每个已购卡 last_visited link 跳 learn
- [ ] commit: `feat(032-P3): Dashboard 推荐 + 进度`

## P4: Sessions 页
- [ ] 4.1 lib/api 加 chat.listSessions / getSessionMessages
- [ ] 4.2 重写 (dashboard)/sessions/page.tsx
- [ ] 4.3 (dashboard)/sessions/[id]/page.tsx (单 session 详情)
- [ ] commit: `feat(032-P4): Sessions 历史对话`

## P5: Memory 页
- [ ] 5.1 lib/api 加 memory.listFacts / memory.retireFact
- [ ] 5.2 (dashboard)/memory/page.tsx
- [ ] 5.3 删除 confirm dialog (复用 shadcn AlertDialog)
- [ ] commit: `feat(032-P5): Memory 管理页`

## P6: FloatingChatPanel
- [ ] 6.1 lib/hooks/use-page-kind.ts (按 pathname)
- [ ] 6.2 components/chat/floating-chat-panel.tsx (shadcn Sheet)
- [ ] 6.3 WS hook payload 加 page_kind/library_slug/module_id
- [ ] 6.4 (dashboard)/layout.tsx 挂载 FloatingChatPanel
- [ ] 6.5 删老 /chat 路由 (FloatingChat 替代)
- [ ] commit: `feat(032-P6): 全局 floating chat + page_kind 派发`

## P7: 自测 + 收尾
- [ ] 7.1 ./scripts/restart-student.sh + 手测 6 流程
- [ ] 7.2 spec.md Status: shipped (2026-05-18)
- [ ] commit: `docs(032): shipped`
