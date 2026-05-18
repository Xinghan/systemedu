# 032-multi-user-claude-ui

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-18

## 背景 / 问题

当前 web 前端有两套**互不打通**的 UI:

| 路由组 | 风格 | 后端 | 多用户 | 用 spec 031 memory |
|---|---|---|---|---|
| `(dashboard)/dashboard/*` | Claude.ai 风格 (左 sidebar) | cloud-app gateway (已删) | 否 (单机) | 否 |
| `library/*` `learn/*` `login/*` | shadcn 卡片 | student-app :18820 | 是 (spec 024-A) | 是 (spec 031) |

用户实际用的是 Claude 风格 dashboard, 因为它"产品感更强"; 但它接的是 cloud-app
gateway, spec 022 已经被删, 所以 dashboard 内部链接全部 404 / 老 API 报错 /
登录/注册根本走不通 / chat 没有 page_kind 感知.

spec 024-A 做的 multi-user UI 用户嫌"完全错了 / 像回退" — shadcn 卡片风格扁平,
没有 sidebar, 没有 session 历史, 没有 dashboard 概览页, 没有 memory 管理.

## 目标

把 Claude 风格 UI **原地改造**接 student-app multi-user 后端, 让它真正能用 + 用上
spec 031 五层 memory. 把没必要的老 dashboard 子页删掉.

### 4 个保留页 (multi-user 化)

| 页 | 路由 | 数据源 | 说明 |
|---|---|---|---|
| Dashboard 首页 | `/dashboard` | student-app `/api/library/projects` + `/api/library/purchases` + 推荐 algo | 当前学到哪 + 推荐下一节 + 进度条 |
| Projects | `/projects` (重定向 `/library`) | spec 024-A library API | 项目库 + 我的课程 (沿用 `/library` 实现, sidebar 链接指到这) |
| Sessions | `/sessions` | student-app `/api/chat/sessions` | 历史对话列表, 点进去看记录 |
| Memory | `/memory` (新) | student-app `/api/memory/facts` (新加) | 看自己被 fact_extractor 抽出来的 StudentFact, 可删 |

### 4 个删除页 (无 multi-user 意义)

- `/agents` — OpenClaw agent CRUD, student 无意义
- `/career-paths` — 老的职业路径 (不再维护)
- `/mcp` — MCP server 管理, 后台运维事项
- `/skills` — skill CRUD, 后台运维事项
- `/config` — LLM provider 配置, 移到 admin (不应该让 student 看到 API key)

`/chat` 是否保留 — 暂定保留, 改为"全局对话" (page_kind=global) 入口.

### 访问控制

- 未登录访问任何 `(dashboard)` 下的页面 → 自动跳 `/login`
- 登录后 sidebar 显示用户名 + 退出
- `/login` `/register` `/library`(游客可见) 不在 sidebar 范围

### Chat panel

- 全站右上角一个 chat 按钮 (Claude.ai 风格 floating panel)
- 点开右侧 sheet/drawer 出 chat
- 自动按当前路由推 `page_kind`:
  - `/dashboard` `/sessions` `/memory` `/chat` → `home` (Dashboard 性质)
  - `/library` → `home` (项目库列表)
  - `/library/[slug]` (无 knode) → `library_detail`
  - `/library/[slug]/[knode_id]` 或 `/learn/...` → `learn`
- 调 student-app WS `/api/chat/stream` (token + page_kind 透传)

### Memory 管理页 (新)

后端需要 spec 031 没有的 endpoint:

- `GET /api/memory/facts` — 列当前 user 的所有 current StudentFact (按 category 分组)
- `DELETE /api/memory/facts/{id}` — 手动 retire 一条 (valid_to=now, superseded_by=null)

前端按 category 分组渲染 (interest / goal / skill_level / family / preference / misconception),
每条显示 value + confidence + 抽取时间 + 来自 session 链接 + 删除按钮.

## 不在范围

- 老 (dashboard) 路由组里的 agent/MCP/skill/career/config 5 个子页不会改造,
  直接删 (或挪到 admin spec 处理).
- spec 022 后还残存的 cloud-app gateway 相关代码、`useGatewayStatus` `gateway.*` API
  client 等清理, **本 spec 不做**, 留独立 cleanup spec.
- E2E 测试 — 留 P5.
- 移动端响应式 — sidebar 在窄屏 collapse 走 shadcn 默认行为, 不专门优化.

## Architecture

```
┌─ web/src/app/(dashboard)/
│  ├── layout.tsx           ← 已有, 改 useAuth → student-app /api/auth/me
│  ├── dashboard/page.tsx   ← 重写: 推荐 + 进度
│  ├── projects/            ← 删 (跳 /library)
│  ├── sessions/page.tsx    ← 重写: 接 student-app /api/chat/sessions
│  ├── memory/page.tsx      ← 新建
│  └── (agents/career-paths/mcp/skills/config 全删)
├── components/
│  ├── layout/
│  │  ├── app-sidebar.tsx   ← 精简 6 → 4 项 + 用 spec 024-A auth
│  │  └── app-header.tsx    ← 加 user dropdown (已登录显示用户名 + 退出)
│  └── chat/
│     └── floating-chat-panel.tsx  ← 新建, Claude.ai 风右侧 drawer
└── lib/
   ├── api/index.ts         ← 已有 auth / library, 加 chat / memory / sessions
   ├── auth.ts              ← 已有, 复用
   └── hooks/
      └── use-page-kind.ts  ← 新建, 按 pathname 推 page_kind
```

## Schema / API 变化

### 新加后端 endpoint (student-app)

```
GET  /api/memory/facts                列当前 user 所有 current StudentFact
DELETE /api/memory/facts/{fact_id}    手动 retire 一条
GET  /api/chat/sessions               (已有, 复用)
GET  /api/chat/sessions/{id}/messages (已有, 复用)
```

### 删除 frontend 文件 / 路由

```
web/src/app/(dashboard)/agents/**       全删
web/src/app/(dashboard)/career-paths/** 全删
web/src/app/(dashboard)/mcp/**          全删
web/src/app/(dashboard)/skills/**       全删
web/src/app/(dashboard)/config/**       全删
web/src/app/(dashboard)/projects/**     全删 (sidebar 链接改指 /library)
```

## 测试

- B 类 backend (新 memory endpoint 3-5 个 unit test)
- A 类 frontend (sidebar 渲染 / page_kind hook / login-gate)
- 不做 E2E (留 P5 独立 spec)

## 验收

- [ ] 未登录访问 / → 跳 /login
- [ ] 登录后 sidebar 显示用户名 + 4 个一级项
- [ ] /dashboard 显示我的项目进度
- [ ] /sessions 列出我的历史 chat session
- [ ] /memory 列出我的 facts, 删除生效
- [ ] 任何页面右上角 chat 按钮 → 右侧 drawer chat, page_kind 自动推
- [ ] 老 dashboard 子页 (agents/MCP/...) 已删, 链接 404 不出现
- [ ] 多用户 — A 用户的 memory/sessions 不会出现在 B 用户

## Status timeline

- 2026-05-18 spec draft
