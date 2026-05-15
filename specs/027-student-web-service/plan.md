# 027-student-web-service Implementation Plan

**Status**: draft
**Date**: 2026-05-16
**Owner**: xinghan

## 实施策略

新建两个独立 package — `packages/student-app/` (后端) + `packages/student-web/` (前端)。
**复制 + 清洗** 现有 cloud-app + web 的相关代码，不改动老服务，保证回归可用。

按 spec 027 的 3 阶段 (P1 后端 / P2 前端 / P3 部署+e2e) 严格依序推进。每阶段
完成后做本地回归 + 检查老服务仍能启动。

## 现状盘点 (plan 阶段确认)

### cloud-app 现有 multiuser 模块 (要迁出去的)

```
packages/cloud-app/src/systemedu/cloud/gateway/multiuser/
├── db.py             User + Purchase 模型
├── jwt.py            JWT encode/decode
├── passwords.py      bcrypt hash/verify
└── endpoints.py      12 个路由 (auth/library proxy/purchases)
```

12 个 routes (在 endpoints.py L331-348):

| 路由 | 现属 | 027 后属 |
|------|------|---------|
| `/api/auth/register` `/api/auth/login` `/api/auth/logout` `/api/auth/me` | cloud-app | **student-app** (复制) |
| `/api/library/projects` 等 6 个 library proxy | cloud-app | **student-app** (复制) |
| `/api/purchases` `/api/purchases/{slug}` | cloud-app | **重命名** 为 `/api/my/projects` (语义清晰化) |

### cloud-app 其它 60+ routes (留在老服务, 标 deprecated)

`server.py` 共 67 routes，其中 `multiuser` 仅 12 条；剩余 55 条都是 studio 功能
(projects/sessions/agents/mcp/skills/config/chat 等) — 一律不动。

### 现 web/ 实际页面分类

| 路径 | 学生需要? | 027 处理 |
|------|----------|----------|
| `/login` `/register` | 需要 | **复制到 student-web** |
| `/library` `/library/[slug]` `/library/[slug]/[knode_id]` | 需要 | **复制 + 改路由** (路径不变) |
| `(learning)/learn/[projectName]` | 需要 | **复制并改名** `learn/[slug]/[moduleId]` (URL 命名对齐 spec 027 语义) |
| `(dashboard)/dashboard` | 不需要 | 留在老 web/ |
| `(dashboard)/projects` | 不需要 | 留在老 web/ |
| `(dashboard)/agents` `(dashboard)/mcp` `(dashboard)/skills` `(dashboard)/config` `(dashboard)/sessions` `(dashboard)/career-paths` | 不需要 | 留在老 web/ |
| `(chat)/chat` | 暂不需要 (spec 028 重做) | 留在老 web/ |
| `test-dighuman` | 不需要 | 留在老 web/ |

### library-app:18821 公开 API (作为 student-app library_proxy 上游)

- `GET /v1/projects` (list)
- `GET /v1/projects/{slug}` (含 tree)
- `GET /v1/projects/{slug}/tree`
- `GET /v1/projects/{slug}/blueprint`
- `GET /v1/projects/{slug}/knodes/{knode_id}`
- `GET /v1/projects/{slug}/files/{file_path:path}`

注意 prefix `/v1` — cloud-app 现有 library_proxy 已处理这个映射, **直接复制即可**。

### 生产 nginx 现状 + 027 后变化

| 路径 | 现 (024-A) | 027 后 |
|------|-----------|--------|
| `/` | web:3000 | **student-web:4000** |
| `/api/` | cloud-app:18820 | **student-app:18820** (端口复用) |
| `/api/chat/stream` | cloud-app:18820 | (本 spec 不做 chat, 删除该 location) |
| `/library-admin/` | library-admin-ui:3001 | 不变 |
| `/library-api/` | library-app:18821 | 不变 |

老 web:3000 + 老 cloud-app **生产不再部署**, 但本地保留启动能力。

## Phase 1: 后端 — 拆 student-app (~ 5-8 小时)

### Step 1.1: 建 package 骨架

```bash
mkdir -p packages/student-app/src/systemedu/student
```

文件:
- `packages/student-app/pyproject.toml` — `systemedu-student`, depends on `systemedu-core`
- `packages/student-app/src/systemedu/student/__init__.py`
- `packages/student-app/src/systemedu/student/server.py` — Starlette app 入口, 端口 18820

### Step 1.2: 复制 multiuser 模块

从 cloud-app 复制 4 个文件:
```
cloud-app/.../multiuser/db.py        → student-app/.../student/db.py
cloud-app/.../multiuser/jwt.py       → student-app/.../student/auth/jwt.py
cloud-app/.../multiuser/passwords.py → student-app/.../student/auth/passwords.py
cloud-app/.../multiuser/endpoints.py → student-app/.../student/endpoints.py (拆 3 个子文件, 见下)
```

`endpoints.py` 700+ 行太杂, 拆为:
- `student/auth/routes.py` — `/api/auth/*` (4 routes)
- `student/library_proxy/routes.py` — `/api/library/*` (6 routes)
- `student/catalog/routes.py` — `/api/my/projects` `/api/my/projects/{slug}` (3 routes, 替代旧 `/api/purchases`)

### Step 1.3: 重设计 DB (student.db)

新 DB 路径 `~/.systemedu/student.db` (与老 cloud-app 的 `systemedu.db` 完全分离)。

迁移 `User` 表原样, 新增/改 3 张表:

```python
# student/db.py
class User(Base):
    __tablename__ = "users"
    id, username, password_hash, created_at, last_login_at  # 同 024-A

class UserProject(Base):         # 替代 Purchase (语义更准)
    __tablename__ = "user_projects"
    id, user_id, library_slug, library_version, pulled_at, removed_at
    __table_args__ = (UniqueConstraint("user_id", "library_slug"),)

class LastVisited(Base):         # MVP 进度占位
    __tablename__ = "last_visited"
    id, user_id, library_slug, last_module_id, last_visited_at
    __table_args__ = (UniqueConstraint("user_id", "library_slug"),)

# 占位表 (本 spec 不实现 API, 仅 schema 占位给 spec 028/029)
class ChatMessage(Base): ...
class Note(Base): ...
class AssignmentSubmission(Base): ...
```

**首次启动自动建表** — `db.py` init 时 `Base.metadata.create_all`。

### Step 1.4: 新路由 `/api/my/projects`

替换旧 `/api/purchases`, 语义"我的项目":

```python
GET    /api/my/projects        # list user's pulled projects + library metadata
POST   /api/my/projects/<slug> # pull
DELETE /api/my/projects/<slug> # soft remove (set removed_at)
```

GET 实现细节:
1. 查 `UserProject WHERE user_id=current_user AND removed_at IS NULL`
2. 对每条调 library-app:18821 `GET /v1/projects/{slug}` 拿元数据 (title/desc/cover_image)
3. 拼装 + 返回; 失败 (slug 在 library 下架) 标 `unavailable=true`

POST 实现:
1. 校验 slug 在 library 存在 (`HEAD /v1/projects/{slug}`)
2. 拿 library project 的 version
3. INSERT UserProject (user, slug, library_version, now()); 已存在则 `removed_at=NULL` 重新激活
4. 返回 201 + project metadata

### Step 1.5: server.py 启动 + 配置

```python
# student/server.py
from starlette.applications import Starlette
from starlette.routing import Mount
from .auth import routes as auth_routes
from .library_proxy import routes as lp_routes
from .catalog import routes as catalog_routes
from .db import init_db

init_db()  # 建表
app = Starlette(routes=[
    *auth_routes.ROUTES,
    *lp_routes.ROUTES,
    *catalog_routes.ROUTES,
])
# uvicorn 启动: python -m systemedu.student.server
```

监听 0.0.0.0:18820 (与老 cloud-app 同端口, 生产部署互斥)。

### Step 1.6: 老 cloud-app 加 deprecation

在 `cloud-app/.../multiuser/__init__.py` 加注释:
```python
"""
DEPRECATED (spec 027 P1): multiuser/* 已迁到 packages/student-app/.
仅保留供老 web/ + studio 本地工作流; 不部署到生产.
"""
```

### Step 1.7: 单元测试 (pytest)

- `tests/student/test_auth.py` — 注册/登录/JWT 验证 (复用 024-A 的)
- `tests/student/test_catalog.py` — Pull 一个 slug, GET 列表能拿到 + library metadata
- `tests/student/test_library_proxy.py` — 未登录访问 projects list OK, 访问 knode 详情 401, Pull 后 200
- `tests/student/test_db_migration.py` — 首次启动建表 + 二次启动幂等

目标 ≥ 80% line coverage。

### Step 1.8: 本地烟雾测试

```bash
python -m systemedu.student.server  # 起 18820
curl -X POST http://127.0.0.1:18820/api/auth/register -d '{"username":"t","password":"t123456"}'
curl ... /api/library/projects
curl -X POST ... /api/my/projects/purpleair-airquality-node -H "Authorization: Bearer $TOKEN"
curl ... /api/my/projects
```

## Phase 2: 前端 — 拆 student-web (~ 6-10 小时)

### Step 2.1: 建 Next.js 16 项目

```bash
cd packages/
npx create-next-app@latest student-web --typescript --tailwind --app
```

清单 — 复制 `web/` 现有的:
- `tsconfig.json` `tailwind.config.ts` `next.config.ts` (调整 dev port)
- `package.json` 关键依赖: shadcn/ui, lucide-react, zustand, sonner

`next.config.ts`:
```ts
const config = {
  // 本地开发 4000, 与老 web 3000 区分
  // production 走 nginx 转发, 不暴露原端口
};
```

### Step 2.2: 复制并清洗 src/lib

从 web/src/lib 复制以下到 student-web/src/lib:
- `api/index.ts` 但**只保留** `auth/*` `library/*` `my-projects/*` (新增) 接口
- `stores/auth-store.ts`
- `hooks/use-t.ts` (i18n)
- `utils/cn.ts`
- 删除: `agents`, `mcp`, `skills`, `sessions`, `chat`, `config`, `tutor`

### Step 2.3: 新 src/app 结构

```
src/app/
├── layout.tsx                                       # 顶栏 + AuthContext
├── page.tsx                                         # / -> redirect /home (登录) or /login
├── (auth)/
│   ├── layout.tsx                                   # 简化顶栏 (仅 logo)
│   ├── login/page.tsx
│   └── register/page.tsx
├── (home)/
│   ├── layout.tsx                                   # 需登录, 主顶栏
│   ├── home/page.tsx                                # 我的项目
│   ├── library/page.tsx                             # 浏览
│   └── library/[slug]/page.tsx                      # 项目介绍 + Pull
└── (learn)/
    ├── layout.tsx                                   # 需登录 + 已 Pull
    └── learn/[slug]/[moduleId]/page.tsx             # 学习页 (复制+改路由)
```

### Step 2.4: 学习页移植

从 `web/src/app/(learning)/learn/[projectName]/` 移植到
`student-web/src/app/(learn)/learn/[slug]/[moduleId]/`:

URL 变化:
- 旧: `/learn/purpleair-airquality-node?module=M01`
- 新: `/learn/purpleair-airquality-node/M01` (语义清晰)

API 调用对齐:
- 旧调 `gateway.knodeDetail(projectName, moduleId)` (cloud-app `/api/library/projects/.../knodes/...`)
- 新调 `studentApi.knodeDetail(slug, moduleId)` — 同路径, 仅 client wrapper 改名

### Step 2.5: 新 /home 页

设计 mock (ASCII):
```
┌────────────────────────────────────────────────────────┐
│  [Logo] SystemEdu       Library  我的项目  {user} ▾    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  欢迎回来, {username}                                   │
│                                                        │
│  我的项目                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ [封面]        │  │ [封面]        │  │  + Pull 新   │ │
│  │ PurpleAir    │  │ Mars Risk Map│  │     项目      │ │
│  │ 30 章 · M03  │  │ 28 章 · 未开始 │  │              │ │
│  │ [继续学习]    │  │ [开始学习]    │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

空状态 (未 Pull 任何项目):
```
你的书架还是空的。
[去 Library 看看] (按钮 link to /library)
```

### Step 2.6: 新顶栏 + 退出

新建 `src/components/layout/student-header.tsx`:
- Logo (链接 /home if 登录 else /)
- 中间链接: Library | 我的项目 (仅登录后)
- 右侧: 未登录 → [登录][注册]; 已登录 → 用户菜单 (账户 / 退出)

**绝不出现** 老 web/ 的 agents/mcp/sessions/config/career-paths 等链接。

### Step 2.7: i18n

复制 web 的 `useT` hook + zh 语言包 (默认中文)。EN key 占位但本期不翻译。

### Step 2.8: 部分页面修改

- 项目详情 `(home)/library/[slug]/page.tsx`:
  - 旧 "立即购买" 按钮 → "Pull 到我的书架"
  - 已 Pull → "继续学习" (link /learn/{slug}/{last_visited_module || M01})

### Step 2.9: e2e mock (本地)

跑老 library-app:18821 (内容已有 PurpleAir M01-M07) + 新 student-app:18820 + 新 student-web:4000:
```bash
# 浏览器开 http://localhost:4000
# 注册 -> 登录 -> /library -> 点 PurpleAir -> Pull -> /home 看到卡片 -> 进 /learn/.../M01
```

## Phase 3: 部署 + e2e (~ 3-5 小时)

### Step 3.1: scripts/restart.sh 加新服务

```bash
# 新增起 student-app + student-web
nohup bash -lc "cd $PROJECT_DIR && source .venv/bin/activate && python -m systemedu.student.server" > .run/student-app.log 2>&1 &
cd packages/student-web && nohup npm run dev -- -p 4000 > ../../.run/student-web.log 2>&1 &
```

老 cloud-app + web 仍起 (本地工作流), 但 nginx 在生产指向新服务。

### Step 3.2: scripts/deploy.sh 改部署目标

打包内容:
- `packages/student-app/` (新)
- `packages/student-web/` (新, build 后的 .next)
- `packages/library-app/` (不变)
- `packages/library-admin-ui/` (不变)
- 老 cloud-app + 老 web: **不打包到部署 tarball**

服务管理:
- `/etc/systemd/system/systemedu-student-app.service` (新, 替代 systemedu-backend)
- `/etc/systemd/system/systemedu-student-web.service` (新, 替代 systemedu-frontend)
- `/etc/systemd/system/systemedu-library-app.service` (新, 之前手动起)
- `/etc/systemd/system/systemedu-library-admin-ui.service` (新, 之前手动起)

### Step 3.3: nginx 配置改写

```nginx
server {
    listen 80;
    server_name 47.92.200.21;
    client_max_body_size 500M;

    # student-web (主站, 学生面)
    location / {
        proxy_pass http://127.0.0.1:4000;
        ...
    }

    # student-app API
    location /api/ {
        proxy_pass http://127.0.0.1:18820;
        ...
    }

    # library-admin-ui (creator 上传)
    location /library-admin/ {
        proxy_pass http://127.0.0.1:3001;
        ...
    }

    # library-app 直接 API (creator + tarball 上传需要)
    location /library-api/ {
        rewrite ^/library-api/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:18821;
        client_max_body_size 500M;
        ...
    }

    # /api/chat/stream — 不再支持 (本 spec 不做 chat, spec 028 重做)
}
```

### Step 3.4: Playwright e2e (e2e/tests/student-flow.spec.ts)

新建 e2e 测试套件:
```typescript
test('注册到首次学习完整流程', async ({ page }) => {
  await page.goto('http://47.92.200.21/');
  await expect(page).toHaveURL(/\/login/);
  // 注册
  await page.click('a[href="/register"]');
  await page.fill('[name=username]', `student_${Date.now()}`);
  await page.fill('[name=password]', 'pass123456');
  await page.click('button[type=submit]');
  // 跳 /home, 空状态
  await expect(page).toHaveURL(/\/home/);
  await expect(page.locator('text=书架还是空的')).toBeVisible();
  // 去 library
  await page.click('text=去 Library 看看');
  await expect(page).toHaveURL(/\/library/);
  await page.click('text=PurpleAir');
  // Pull
  await page.click('button:has-text("Pull 到我的书架")');
  await expect(page).toHaveURL(/\/home/);
  await expect(page.locator('text=PurpleAir')).toBeVisible();
  // 开始学习
  await page.click('button:has-text("开始学习")');
  await expect(page).toHaveURL(/\/learn\/purpleair.*\/M01/);
  await expect(page.locator('iframe[src*=animation]')).toBeVisible();
});
```

### Step 3.5: 数据迁移

老 cloud-app 的 `~/.systemedu/systemedu.db` 里的 User + Purchase 表怎么迁?

**MVP 选择: 不迁**:
- 生产现只有 demo 用户 (memory 标 demo / demo123)
- 学生在新 student-app 上重新注册
- 老 db 留作历史

如果未来要迁: 一次性脚本 `scripts/migrate_024_to_027.py`, 从老 db 读 User + Purchase, 写到新 student.db 的 User + UserProject。本 spec 不做。

## 影响面 + 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 端口 18820 复用导致老 cloud-app + 新 student-app 不能同时跑 | 本地开发不便 | restart.sh 加 `--student-only` / `--cloud-only` flag, 默认起 student |
| 老 web/ 的 (learning)/learn/[projectName] 学习页代码移植容易丢细节 | 学生看课功能损坏 | Phase 2 末做 diff 比对, e2e 全跑 |
| library-app 启动时若没 PurpleAir 数据, e2e 失败 | 验收挂 | restart.sh 在起 library-app 后自动 import 当前 workspace tarball (如果 db 空) |
| nginx 改完会导致老 web 不可访问 | 你本地工作流 | 老 web 保留本地启动 + 本地直接访问 :3000 + 不依赖 nginx |
| 生产 systemd 服务名变更 | 部署脚本要同步 | deploy.sh 改完做一次 dry-run |

## 验收 (从 spec 抄过来)

- [ ] 全新学生能在浏览器 `http://47.92.200.21/` 注册账号
- [ ] 登录后看到 `/home`，"我的项目" 区域为空
- [ ] `/library` 看到 PurpleAir 等项目
- [ ] 项目页能看 plan_markdown 介绍 + V5 知识树
- [ ] 点击 "Pull 到我的书架" → 跳 `/home`，PurpleAir 出现
- [ ] 点击 "开始学习" → `/learn/purpleair-airquality-node/M01`，看到完整学习页
- [ ] 进入 M02 后回到 `/home`，PurpleAir 显示 "继续学习: M02"
- [ ] 移除项目后再 Pull, 学习数据 (LastVisited) 保留
- [ ] `/home` 不出现 agents/mcp/skills/config 等 studio 链接
- [ ] 老 cloud-app + web 本地仍能启动
- [ ] Playwright e2e 全绿

## 实施顺序总览

| Phase | Step | 估时 | 输出 |
|-------|------|------|------|
| P1 | 1.1 骨架 | 0.5h | package 目录 + pyproject |
| P1 | 1.2 复制 multiuser | 1h | auth/ library_proxy/ catalog/ |
| P1 | 1.3 DB schema | 1h | 7 张表 (3 个本期用 + 4 个占位) |
| P1 | 1.4 /api/my/projects | 1.5h | 3 routes + library 元数据合并 |
| P1 | 1.5 server.py | 0.5h | starlette app |
| P1 | 1.6 老 cloud 注释 | 0.2h | deprecation 注释 |
| P1 | 1.7 pytest | 1.5h | 4 个测试文件 |
| P1 | 1.8 烟雾测试 | 0.5h | curl 验通过 |
| **P1 小计** | | **~ 7h** | student-app 后端可用 |
| P2 | 2.1 next 项目 | 0.5h | student-web/ Next.js |
| P2 | 2.2 复制 lib | 1h | api/ stores/ hooks/ |
| P2 | 2.3 app 路由 | 1h | (auth)/(home)/(learn) 骨架 |
| P2 | 2.4 学习页移植 | 2h | 复制 + 改 URL + 调试 |
| P2 | 2.5 /home 页 | 1.5h | 我的项目卡片 + 空状态 |
| P2 | 2.6 顶栏 + 退出 | 0.5h | StudentHeader |
| P2 | 2.7 i18n | 0.3h | useT 复制 |
| P2 | 2.8 详情页修改 | 0.5h | Pull 按钮 + 继续学习 |
| P2 | 2.9 本地 e2e mock | 1h | localhost 端到端可玩 |
| **P2 小计** | | **~ 8.5h** | student-web 前端可用 |
| P3 | 3.1 restart.sh | 0.5h | 多服务起停 |
| P3 | 3.2 deploy.sh | 1.5h | systemd 服务 + tarball 内容 |
| P3 | 3.3 nginx | 0.5h | 生产路由 |
| P3 | 3.4 e2e | 1.5h | student-flow.spec.ts |
| P3 | 3.5 数据迁移 (跳过) | 0h | 直接重新注册 |
| **P3 小计** | | **~ 4h** | 生产部署 + e2e 绿 |
| **总计** | | **~ 19-20h** | spec 027 shipped |

## 下一步

写 `tasks.md` 把这 18 个 step 拆成 checklist。
