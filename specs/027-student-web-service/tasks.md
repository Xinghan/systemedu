# 027-student-web-service Tasks

**Status**: draft
**Last updated**: 2026-05-16

依据 `plan.md` 拆成可勾选清单。每完成一个 task 勾掉。每个 Phase 结束做一次 commit。

## Phase 1: 后端 — packages/student-app/

### 1.1 包骨架 (0.5h)

- [ ] 1.1.1 建目录 `packages/student-app/src/systemedu/student/{auth,library_proxy,catalog}/`
- [ ] 1.1.2 写 `packages/student-app/pyproject.toml`
  - name: `systemedu-student`
  - depends on: `systemedu-core` (workspace), `starlette`, `uvicorn`, `sqlalchemy`, `bcrypt`, `pyjwt`, `httpx`, `python-multipart`
- [ ] 1.1.3 编辑 root `pyproject.toml` workspace 加 `packages/student-app`
- [ ] 1.1.4 `cd packages/student-app && uv pip install -e .` 验证依赖可装
- [ ] 1.1.5 `__init__.py` 文件齐全

### 1.2 复制 multiuser 模块 (1h)

- [ ] 1.2.1 复制 `cloud-app/.../multiuser/db.py` → `student/db.py`
  - 改 `cloud_users` 表名 → `users` (新 db 不冲突)
  - 改 import path
- [ ] 1.2.2 复制 `multiuser/jwt.py` → `student/auth/jwt.py`
- [ ] 1.2.3 复制 `multiuser/passwords.py` → `student/auth/passwords.py`
- [ ] 1.2.4 拆 `multiuser/endpoints.py` (700+ 行) 为 3 个文件:
  - `student/auth/routes.py` (auth 4 routes)
  - `student/library_proxy/routes.py` (library 6 routes)
  - `student/catalog/routes.py` (my projects, 见 1.4)
- [ ] 1.2.5 删除 routes 里所有 `cloud-app` 相关 import; 改为 `student.*`
- [ ] 1.2.6 ROUTES 列表导出供 server.py 收集

### 1.3 DB schema 重设计 (1h)

- [ ] 1.3.1 在 `student/db.py` 加 `UserProject` model
  ```python
  __tablename__ = "user_projects"
  id, user_id (FK), library_slug, library_version, pulled_at, removed_at
  UniqueConstraint("user_id", "library_slug")
  ```
- [ ] 1.3.2 加 `LastVisited` model (user_id, library_slug, last_module_id, last_visited_at)
- [ ] 1.3.3 加占位 models (本期不实现 endpoint 但 schema 在位)
  - `ChatMessage` (user_id, library_slug, module_id, role, content, created_at)
  - `Note` (user_id, library_slug, module_id, content, created_at, updated_at)
  - `AssignmentSubmission` (user_id, library_slug, module_id, content, media_paths JSON, created_at)
- [ ] 1.3.4 `init_db()` 函数: 路径 `~/.systemedu/student.db`, `Base.metadata.create_all`
- [ ] 1.3.5 在 `student/__init__.py` 暴露 `init_db`, `get_session`

### 1.4 /api/my/projects 路由 (1.5h)

- [ ] 1.4.1 `student/catalog/routes.py` 实现 `GET /api/my/projects`
  - 查 `UserProject WHERE user_id=current AND removed_at IS NULL`
  - 用 httpx 异步并发调 library `GET /v1/projects/{slug}` 拿元数据
  - 拼装 `[{slug, title, cover_image_path, knode_count, library_version, pulled_at, unavailable?}, ...]`
- [ ] 1.4.2 实现 `POST /api/my/projects/{slug}` (pull)
  - 校验 slug 在 library 存在 (HEAD 或 GET 200)
  - 取 library version
  - INSERT UserProject 或 UPDATE removed_at=NULL (重新 pull)
  - 返回 201 + project metadata
- [ ] 1.4.3 实现 `DELETE /api/my/projects/{slug}` (soft remove)
  - UPDATE removed_at=now()
  - 返回 204
- [ ] 1.4.4 实现 `PUT /api/my/progress/{slug}/{module_id}`
  - UPSERT LastVisited (user, slug, module_id, now())
  - 返回 200
- [ ] 1.4.5 实现 `GET /api/my/progress/{slug}` → `{last_module_id, last_visited_at}`
- [ ] 1.4.6 修改 `library_proxy/routes.py` 的 knode/files 鉴权:
  - 旧逻辑: 查 Purchase 表
  - 新逻辑: 查 `UserProject WHERE user_id AND library_slug AND removed_at IS NULL`

### 1.5 server.py 启动 (0.5h)

- [ ] 1.5.1 写 `student/server.py`:
  - import auth/library_proxy/catalog routes
  - `Starlette(routes=[*all_routes], on_startup=[init_db])`
  - CORS middleware (允许 student-web:4000 + 生产同源)
- [ ] 1.5.2 entrypoint: `python -m systemedu.student.server` 起 0.0.0.0:18820
- [ ] 1.5.3 配置: `STUDENT_DB_PATH` env (默认 `~/.systemedu/student.db`)
- [ ] 1.5.4 配置: `LIBRARY_BASE_URL` env (默认 `http://127.0.0.1:18821`)

### 1.6 老 cloud-app deprecation (0.2h)

- [ ] 1.6.1 `cloud-app/.../multiuser/__init__.py` 顶部加 docstring deprecation 注释
- [ ] 1.6.2 在 `cloud-app/.../multiuser/endpoints.py` 顶部加注释指向 spec 027

### 1.7 pytest 单元测试 (1.5h)

- [ ] 1.7.1 `tests/student/conftest.py` — pytest fixture `tmp_db` (临时 sqlite path)
- [ ] 1.7.2 `tests/student/test_auth.py`:
  - test_register_success / test_register_duplicate / test_login_success /
    test_login_wrong_password / test_me_with_token / test_logout
- [ ] 1.7.3 `tests/student/test_catalog.py`:
  - test_my_projects_empty / test_pull_creates_row / test_pull_existing_unremoves /
    test_list_returns_with_library_metadata / test_remove_soft_deletes
  - 用 httpx mock library responses
- [ ] 1.7.4 `tests/student/test_library_proxy.py`:
  - test_list_public / test_knode_unauthenticated_401 / test_knode_unpulled_403 /
    test_knode_pulled_200 / test_file_pulled_200
- [ ] 1.7.5 `tests/student/test_progress.py`:
  - test_put_progress / test_get_progress / test_progress_per_user_per_slug
- [ ] 1.7.6 跑 `python -m pytest tests/student/ -v` 全过, 覆盖率 ≥ 80%

### 1.8 本地烟雾测试 (0.5h)

- [ ] 1.8.1 起 library-app:18821 (`LIBRARY_BOOTSTRAP_ADMIN=admin:admin123 python -m uvicorn library.main:app --port 18821 --app-dir packages/library-app/src`)
- [ ] 1.8.2 起 student-app:18820 (`python -m systemedu.student.server`)
- [ ] 1.8.3 curl 序列:
  ```bash
  curl -X POST :18820/api/auth/register -d '{"username":"smoke","password":"smokepass"}' → token
  curl -H "Authorization: Bearer $TOKEN" :18820/api/auth/me → user info
  curl :18820/api/library/projects → list (含 purpleair)
  curl -X POST :18820/api/my/projects/purpleair-airquality-node -H "Authorization: Bearer $TOKEN" → 201
  curl :18820/api/my/projects -H "Authorization: Bearer $TOKEN" → list with title
  curl :18820/api/library/projects/purpleair-airquality-node/knodes/M01 -H "Authorization: Bearer $TOKEN" → knode JSON
  ```
- [ ] 1.8.4 验证老 cloud-app `python -m systemedu.cloud.gateway.server` 仍能起 (回归)

### Phase 1 收尾
- [ ] **P1 commit**: `feat(027-P1): student-app 后端拆分 (auth+library_proxy+catalog)`

---

## Phase 2: 前端 — packages/student-web/

### 2.1 Next.js 16 项目 (0.5h)

- [ ] 2.1.1 `cd packages && npx create-next-app@latest student-web --typescript --tailwind --app --no-src-dir=false --import-alias "@/*"`
- [ ] 2.1.2 检查 next 16 + tailwind 4 (与 web/ 对齐)
- [ ] 2.1.3 改 `package.json` 默认 dev port: `"dev": "next dev -p 4000"`
- [ ] 2.1.4 复制 web/`tsconfig.json` 配置 + `next.config.ts` (调 port)
- [ ] 2.1.5 装 shadcn/ui + 关键依赖:
  ```
  shadcn/ui (button, card, input, dropdown-menu, dialog, sonner, label)
  lucide-react, zustand, sonner, clsx
  ```

### 2.2 src/lib 复制清洗 (1h)

- [ ] 2.2.1 从 web/src/lib 复制并改造:
  - `api/auth.ts` — 仅保留 register/login/logout/me
  - `api/library.ts` — list/detail/tree/blueprint/knode/file (路径 `/api/library/...`)
  - `api/my-projects.ts` (新) — list/pull/remove/progress
  - `stores/auth-store.ts` — JWT 状态 (复制)
  - `hooks/use-t.ts` (i18n)
  - `utils/cn.ts`
- [ ] 2.2.2 删除所有 `agents/mcp/skills/sessions/chat/config/tutor` 相关 client
- [ ] 2.2.3 改 base URL: prod 用 `/api`, dev 用 `http://localhost:18820/api`

### 2.3 app 路由骨架 (1h)

- [ ] 2.3.1 `src/app/layout.tsx`:
  - 全局 AuthProvider
  - `<Toaster richColors position="top-right" />`
  - `<html lang="zh-CN"><body suppressHydrationWarning>` (吃浏览器扩展 hydration warning)
- [ ] 2.3.2 `src/app/page.tsx` (根 /):
  - server-side: 检查 auth cookie → redirect `/home` 或 `/login`
- [ ] 2.3.3 `(auth)/layout.tsx` — 简化顶栏 (仅 logo, 居中表单)
- [ ] 2.3.4 `(home)/layout.tsx` — 主顶栏 + middleware 检查登录
- [ ] 2.3.5 `(learn)/layout.tsx` — 主顶栏 + middleware 检查登录 + 已 pull
- [ ] 2.3.6 占位 page.tsx 全部建好 (空内容 + 标题), 跑 `npm run dev` 全部 200

### 2.4 学习页移植 (2h)

- [ ] 2.4.1 复制 web `(learning)/learn/[projectName]/page.tsx` → student-web `(learn)/learn/[slug]/[moduleId]/page.tsx`
- [ ] 2.4.2 改 URL params: `projectName` → `slug`, 加 `moduleId`
- [ ] 2.4.3 改 API 调用: 用 `lib/api/library.ts` 的 wrapper
- [ ] 2.4.4 进入页面时 PUT `/api/my/progress/{slug}/{moduleId}` 标记最后访问
- [ ] 2.4.5 复制学习页用到的子组件:
  - `<KnodeLessonRenderer>` (plan_markdown + animation iframe + game iframe + audio + assignment)
  - 章节导航侧栏
- [ ] 2.4.6 测试: 启动 student-app + library-app, 浏览器开 `/learn/purpleair-airquality-node/M01` → 看到 lesson + anim + game

### 2.5 /home 我的项目页 (1.5h)

- [ ] 2.5.1 `(home)/home/page.tsx`:
  - useAuth 拿 username
  - 调 `myProjects.list()` 拿数据
  - 空状态: "你的书架还是空的, 去 Library 看看" + 按钮
  - 卡片列表: 项目封面/标题/章节数/进度("未开始"或"继续学习: M03")/[开始学习]按钮
- [ ] 2.5.2 卡片组件 `<MyProjectCard>`:
  - props: project (含 last_visited_module)
  - 点击按钮跳 `/learn/{slug}/{last_visited || M01}`
- [ ] 2.5.3 错误状态: 项目 unavailable (library 下架) → 灰色 + 提示

### 2.6 顶栏 + 退出 (0.5h)

- [ ] 2.6.1 新建 `src/components/layout/student-header.tsx`:
  - Logo (link /home if 登录 else /)
  - 主链接: Library | 我的项目 (仅登录)
  - 右侧 dropdown: 已登录 → {username} ▾ → [账户][退出]
  - 未登录: [登录] [注册]
- [ ] 2.6.2 退出: `logout()` 清 JWT + redirect /login
- [ ] 2.6.3 确认 **不**出现: agents/mcp/skills/sessions/config/chat 等 link

### 2.7 i18n (0.3h)

- [ ] 2.7.1 复制 web `lib/i18n/zh.ts` 必要 keys
- [ ] 2.7.2 删除老 web 的 agent/mcp/skills 翻译 keys
- [ ] 2.7.3 加新 keys: `pull_to_shelf`, `my_projects`, `welcome_back`, `empty_shelf`, etc.
- [ ] 2.7.4 `useT` hook 默认 zh

### 2.8 项目详情页 Pull 按钮 (0.5h)

- [ ] 2.8.1 复制 web `library/[slug]/page.tsx` → student-web `(home)/library/[slug]/page.tsx`
- [ ] 2.8.2 行为按钮:
  - 未登录: [登录后 Pull] (link /login?next=...)
  - 已登录未 Pull: [Pull 到我的书架] (POST `/api/my/projects/{slug}`)
  - 已 Pull: [继续学习 (M03)] (link /learn/{slug}/{last_visited})
- [ ] 2.8.3 toast 反馈: Pull 成功 → "已加入书架" + 自动跳 /home

### 2.9 本地 e2e mock (1h)

- [ ] 2.9.1 三服务齐起 (library-app + student-app + student-web)
- [ ] 2.9.2 浏览器手工走一遍:
  - 访问 / → /login → 注册 newuser/pass123 → /home (空状态)
  - 点 Library → 看 purpleair → 点 → Pull
  - 自动跳 /home → 看到 PurpleAir 卡片
  - 点开始学习 → /learn/.../M01 → 看 anim + game 都正常
  - 退出 → /login (cookie 清)
- [ ] 2.9.3 截图 4 张关键页面留档

### Phase 2 收尾
- [ ] **P2 commit**: `feat(027-P2): student-web 前端 (Next.js 16, 4 核心页面走通)`

---

## Phase 3: 部署 + e2e

### 3.1 scripts/restart.sh 改造 (0.5h)

- [ ] 3.1.1 加 student-app 启动块 (`python -m systemedu.student.server`)
- [ ] 3.1.2 加 student-web 启动块 (`npm run dev -p 4000` in packages/student-web)
- [ ] 3.1.3 加 library-app 启动块 (现在每次手动, 自动化)
- [ ] 3.1.4 加 library-admin-ui 启动块 (`npm run dev` in packages/library-admin-ui :3001)
- [ ] 3.1.5 老 cloud-app + 老 web 保留启动 (作为本地 dev tool), 可加 `--no-legacy` flag 跳过

### 3.2 scripts/deploy.sh 改造 (1.5h)

- [ ] 3.2.1 改打包列表:
  - 包含: `packages/student-app/` `packages/student-web/` (build 后) `packages/library-app/` `packages/library-admin-ui/` (build 后) `scripts/` `pyproject.toml`
  - 排除: `packages/cloud-app/` `web/` `course_factory/` `content-workspace/` `theme_style/` `animation_game_design/`
- [ ] 3.2.2 服务器端解压 + `uv pip install -e packages/student-app -e packages/library-app -e packages/core`
- [ ] 3.2.3 student-web build: `cd packages/student-web && npm ci && npm run build`
- [ ] 3.2.4 library-admin-ui build 同样
- [ ] 3.2.5 写 4 个 systemd unit (覆盖老的):
  - `systemedu-student-app.service` (Type=simple, ExecStart=python -m systemedu.student.server)
  - `systemedu-student-web.service` (ExecStart=npm start -p 4000)
  - `systemedu-library-app.service` (`uvicorn library.main:app --host 127.0.0.1 --port 18821 --app-dir ...`)
  - `systemedu-library-admin-ui.service` (`npm start -p 3001`)
- [ ] 3.2.6 deploy.sh 末尾 systemctl restart 4 个新服务 + 老 backend/frontend 停止

### 3.3 nginx 配置 (0.5h)

- [ ] 3.3.1 写新 nginx 配置 (per plan.md 3.3):
  - `/` → 4000
  - `/api/` → 18820
  - `/library-admin/` → 3001
  - `/library-api/` → 18821 (重写)
  - 删除 `/api/chat/stream` location
- [ ] 3.3.2 deploy.sh 自动覆盖 `/etc/nginx/sites-available/systemedu`
- [ ] 3.3.3 nginx -t 验证 + reload

### 3.4 Playwright e2e (1.5h)

- [ ] 3.4.1 `e2e/tests/student-flow-027.spec.ts` 新建
  - test('注册→登录→Pull→学习', async ({ page }) => { ... })
  - test('已 pulled 用户进度持久化', ...)
  - test('退出后访问 /home 跳 /login', ...)
- [ ] 3.4.2 在生产 47.92.200.21 跑 e2e (类似 spec 024-A-P3 流程)
- [ ] 3.4.3 全过

### 3.5 数据迁移 (跳过, 0h)

- [ ] 3.5.1 文档: 在 spec 027 spec.md 顶部加 "**数据迁移**: 不做, 学生 02 注册" 注释

### Phase 3 收尾
- [ ] **P3 commit**: `feat(027-P3): 部署 spec 027 到生产 + e2e 通过`
- [ ] 把 spec 027 spec.md 顶部 `Status: draft` 改为 `Status: shipped (YYYY-MM-DD)`
- [ ] `docs/prd.md` Phase checklist 加 027 行
- [ ] (可选) 更新 `~/.claude/projects/.../memory/` 加 spec 027 相关 memory:
  - `project_two_web_services.md` — student-app + library-app 双 web 架构

---

## 实施总览

| Phase | tasks | 估时 |
|-------|-------|------|
| P1 (8 sub) | 1.1-1.8 | ~7h |
| P2 (9 sub) | 2.1-2.9 | ~8.5h |
| P3 (5 sub) | 3.1-3.5 | ~4h |
| **总计** | | **~ 19-20h** |

## 实施提示

1. **每个 sub-step 完成后 commit** (颗粒度 1.1, 1.2, 1.3...), 不等 phase 末
2. **回归测试每个 phase 末跑**: 老 cloud-app + web 在本地能起
3. **Memory feedback** 已写入:
   - [[feedback_theme_style_26]] — animation/game 配色
   - [[project_studio_local_app_only]] — studio 不做云端
4. P1 完成可单独 commit + push (本地完成无需部署即可)
5. P2 完成需要 P1 后端运行才能 e2e, 但 P1 已稳定可单独验证
6. P3 末必须有 e2e 全绿才算 shipped
