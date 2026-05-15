# 027-student-web-service

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-16

## 背景 / 问题

SystemEdu 目前是"开发者杂烩 + 学生学习" 混在一个 web service 的状态。
具体表现:

- `packages/cloud-app/` 后端同时承担两类截然不同的职责:
  - **Creator (studio) 职责**: course_factory 配套的 `/api/projects/preview-tree`、
    `/api/projects/generate-tree`、`/api/projects/{name}/enroll`、agents/mcp/skills/config
  - **Student 职责**: spec 024-A 后加的 `/api/auth/*`、`/api/library/*`、`/api/purchases/*`

- `web/` 前端同时承载:
  - **Creator 页面**: `(dashboard)/agents`、`(dashboard)/mcp`、`(dashboard)/skills`、
    `(dashboard)/sessions`、`(dashboard)/config`、`(dashboard)/career-paths`、
    `(dashboard)/projects`
  - **Student 页面**: `/login`、`/register`、`/library`、`(learning)/learn/...`

这种杂糅导致 3 个问题:

1. **产品定位不清**: 学生看到 agents/mcp/config 等开发者面板会困惑
2. **部署冲突**: 生产 47.92.200.21 部署的是"学生 SaaS"，但服务里塞了 creator 功能
3. **未来扩展难**: studio 功能将来要做本地 desktop app (creator 本地跑
   course_factory)，必须先从云端 web 剥离

本 spec 把 SystemEdu 学生消费端**正式立项**为一个独立的 web service:
**Student Web Service**。

## 目标 / WHAT

确立**两个独立 web service** 的架构边界:

| Service | 已存在? | 职责 |
|---------|---------|------|
| **Content Library** | ✓ (library-app:18821 + library-admin-ui:3001) | 内容仓库 (creator 上传课程包 + 对外课程 API) |
| **Student Web Service** | 本 spec 新立 | 多用户消费端 (auth + 课程消费 + chat/notes/progress) |

**Student Web Service** 由 2 个新包组成:

```
packages/
  student-app/           ← 本 spec 新建 (后端, FastAPI/Starlette)
    src/systemedu/student/
      auth/              用户注册登录, JWT
      library_proxy/     调 Content Library API 转给前端
      catalog/           "我的项目" — user × library_project 关系
      study/             chat 问答, 笔记, 作业, 学习进度
      db/                独立 SQLite (~/.systemedu/student.db)
  student-web/           ← 本 spec 新建 (前端, Next.js 16)
    src/app/
      (auth)/login, register
      (home)/            学生首页 + 我的项目
      library/           浏览 Content Library + Pull 按钮
      learn/[slug]/[module]/   课程学习页 (复用 024-A 的实现, 移植)
```

**老 cloud-app + web 暂留作 creator 本地工具** (将来做 desktop app 时迁移)。

## 非目标 (不做什么)

- ❌ **不做 studio 功能迁移**: course_factory / blueprint / preview-tree /
  generate-tree 这些 creator 工具，本期不迁，留在老 cloud-app 里。将来做
  desktop app 时一并迁出 (见 memory [[project_studio_local_app_only]])
- ❌ **不做支付**: 与 spec 024-B 一致, 本期 Pull 免费, 不接微信支付
- ❌ **不做多儿童档案**: 一个 user = 一个学生, 多档案留给 024-B
- ❌ **不做学习进度统计**: 进度纯展示项, MVP 只记最后访问的 module, 不做 dashboard
- ❌ **不做 chat tutor 集成**: 复杂度高, 拆到 spec 028 (基于本 spec 提供的 framework)
- ❌ **不做 notes / assignment 提交**: 拆到 spec 029, 028 (本 spec 只保证 DB 表 + 数据模型)
- ❌ **不做老 cloud-app 删除**: 老服务保留, 仅停止生产部署

## 用户故事 / 场景

### 学生注册到首次学习的流程

1. 学生访问 `https://learn.systemedu.com/` (或生产 IP)，看到登录/注册页
2. 注册账号 (username + password, 与 024-A 一致)
3. 进入 `/home`，看到欢迎语 + "你还没有课程，去看看 Library"
4. 点击进入 `/library`，看到 Content Library 上当前发布的全部项目列表 (含 PurpleAir 等)
5. 点击 PurpleAir 项目，看到项目介绍 + 知识树 + "Pull 到我的书架" 按钮
6. 点击 "Pull"，在 student-app 后端写一条 `UserProject(user, slug)` 记录
7. 跳回 `/home`，"我的项目" 区域出现 PurpleAir 卡片 + "开始学习" 按钮
8. 点击 "开始学习" → `/learn/purpleair-airquality-node/M01`，看到 lesson + anim + game + audio

### Pull 的语义 (关键!)

- "Pull" 不是真的下载文件到学生本地
- Library + Student web service **同机部署**，文件就在服务器
- "Pull" = student-app 数据库新增 `UserProject(user_id, library_slug, version, pulled_at)` 一行
- 学习时 student-app 通过 library_proxy 模块向 library-app:18821 请求该 slug 的 knode 文件，再返给前端

### 已 Pull 项目的列表

`/home` 显示"我的项目"列表:

- 每张卡显示: 项目封面 (Library 提供) / 标题 / 章节数 / **进度** (本期固定显示"未开始" 或 "继续学习: M03") / "开始学习" 按钮
- 学生可"从我的书架移除" (软删除 UserProject)，但 Library 上项目永远在

## API 设计

### student-app 后端 (新建)

```
# 用户系统 (从 024-A cloud-app 迁移过来)
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

# 我的项目 (新逻辑, 替代 024-A 的 /api/purchases)
GET    /api/my/projects                # 已 pull 列表 (含 Library 元数据)
POST   /api/my/projects/<slug>         # Pull 一个项目到我的书架
DELETE /api/my/projects/<slug>         # 从我的书架移除

# Library proxy (从 024-A cloud-app library_proxy 迁移)
GET    /api/library/projects                       (公开) → list
GET    /api/library/projects/<slug>                (公开) → project + tree
GET    /api/library/projects/<slug>/tree           (公开) → V5 tree
GET    /api/library/projects/<slug>/blueprint      (公开) → 蓝图 README
GET    /api/library/projects/<slug>/knodes/<id>    (需登录+已 Pull) → 完整 knode
GET    /api/library/projects/<slug>/files/<path>   (需登录+已 Pull) → 媒体文件

# 学习数据 (新, MVP 只占位)
PUT    /api/my/progress/<slug>/<module>    标记最后访问
GET    /api/my/progress/<slug>             返回 last_visited_module
```

### 老 cloud-app 保留路由 (不迁出, 仅本地)

```
# studio (course_factory 配套, 本地工具) — 标 deprecated 但保留代码
/api/projects/preview-tree
/api/projects/generate-tree
/api/projects/<name>/enroll
/api/sessions/*
/api/chat (现有 tutor LLM chat, 留在老 cloud-app 等待 spec 028 重新设计)
/api/agents, /api/mcp, /api/skills, /api/config
```

老 cloud-app 在 47.92.200.21 上**停止生产部署** (spec 025 deploy 链路改用 student-app)。

## DB Schema (student-app SQLite, 新建 ~/.systemedu/student.db)

```python
class User:
    id: UUID            primary key
    username: str       unique, index
    password_hash: str  bcrypt
    created_at: datetime
    last_login_at: datetime | None

class UserProject:                     # "我的书架"
    id: UUID            primary key
    user_id: UUID       FK User.id, index
    library_slug: str   index
    library_version: str  Library 上 pull 时的版本号 (用于将来检测 Library 升版)
    pulled_at: datetime
    removed_at: datetime | None        # 软删除, 移除后保留学习数据
    # 唯一约束: (user_id, library_slug)

class LastVisited:                     # MVP 占位的"进度"
    id: UUID            primary key
    user_id: UUID       FK User.id, index
    library_slug: str   index
    last_module_id: str
    last_visited_at: datetime
    # 唯一约束: (user_id, library_slug)

# 预留 (本 spec 不实现, 但 schema 占位为 spec 028/029 准备)
class ChatMessage:
    id: UUID            primary key
    user_id: UUID       FK User.id, index
    library_slug: str   index
    module_id: str
    role: str           # 'user' | 'assistant'
    content: str
    created_at: datetime

class Note:
    id: UUID            primary key
    user_id: UUID
    library_slug: str
    module_id: str
    content: str
    created_at: datetime
    updated_at: datetime

class AssignmentSubmission:
    id: UUID            primary key
    user_id: UUID
    library_slug: str
    module_id: str
    content: str       # 学生作业文本
    media_paths: str   # JSON array, 上传作业附件路径
    created_at: datetime
```

## 前端 (packages/student-web/, Next.js 16)

```
src/app/
├── layout.tsx                            根布局 + AuthContext + 顶栏
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (home)/                               需登录
│   ├── home/page.tsx                     学生首页: 欢迎语 + "我的项目" 列表
│   ├── library/page.tsx                  Library 浏览
│   └── library/[slug]/page.tsx           项目介绍 + Pull 按钮
└── (learn)/                              需登录 + 已 Pull
    └── learn/[slug]/[moduleId]/page.tsx  课程学习页 (移植自 024-A)
```

### 顶栏

| 状态 | 顶栏内容 |
|------|---------|
| 未登录 | logo / Library / [登录] [注册] |
| 已登录 | logo / 我的项目 / Library / {username} ▾ ([账户][退出]) |

不放 agents / mcp / skills / config / sessions 等任何 studio 功能链接。

## Phase 实施计划

### Phase 1: 后端拆出 student-app

1. 新建 `packages/student-app/` 目录与 `pyproject.toml`
2. 从 `packages/cloud-app/` **复制**以下模块到 student-app:
   - `multiuser/db.py` `multiuser/jwt.py` `multiuser/passwords.py` `multiuser/endpoints.py`
   - `auth.py`
3. 改路由前缀 (`/api/*` 保持兼容老 web)
4. 新建 `catalog/` 模块 — UserProject + LastVisited DB models + endpoints
5. 新写 `server.py` 启动 Starlette app, 端口 18820 (复用)
6. 老 cloud-app `multiuser/` 路由保留代码但加 deprecation 注释
7. **回归测试**: 老 cloud-app + 老 web 仍能本地跑

### Phase 2: 前端拆出 student-web

1. `packages/student-web/` 新建 Next.js 16 项目 (与现有 web/ 结构对齐)
2. 从 `web/` **复制并清洗** 以下文件:
   - `src/app/login/page.tsx` `src/app/register/page.tsx`
   - `src/app/library/page.tsx` `src/app/library/[slug]/page.tsx`
   - `src/app/(learning)/` 整个搬过来
   - `src/lib/api/`, `src/lib/stores/auth-store`, `src/components/layout/AppHeader`
3. 删除所有 dashboard / agents / mcp / skills / sessions / config / career-paths 引用
4. 新建 `/home` 页 — 欢迎语 + 我的项目卡片列表
5. 新建顶栏组件 (3 链接: Library / 我的项目 / 用户菜单)
6. 端口 4000 (与老 web 3000 区分本地开发)

### Phase 3: 部署 + e2e

1. `scripts/deploy.sh` 改成部署 student-app + student-web 而非老 cloud-app + web
2. nginx 配置:
   - `/` → student-web:4000
   - `/api/*` → student-app:18820
   - `/v1/*` → library-app:18821 (老路径保留给 library admin UI)
   - `/admin/*` → library-app:18821 admin API
   - `/library-admin/` → library-admin-ui:3001
3. Playwright e2e (复用 024-A 的, 改 baseUrl 即可):
   - 注册 → 登录 → 看 Library → Pull → 出现在我的项目 → 进入学习页 → 看到 lesson/anim/game

## 验收标准

- [ ] 全新学生能在浏览器 `http://47.92.200.21/` 注册账号
- [ ] 登录后看到 `/home`，"我的项目" 区域为空，提示去 Library 浏览
- [ ] `/library` 看到 Content Library 上所有已发布的项目 (PurpleAir 等)
- [ ] 进入项目页能看 plan_markdown 介绍 + V5 知识树
- [ ] 点击 "Pull 到我的书架" 按钮 → 跳回 `/home`，PurpleAir 出现在"我的项目"
- [ ] 点击 "开始学习" → `/learn/purpleair-airquality-node/M01`，看到完整学习页 (lesson + anim + game + audio)
- [ ] 进入 M02 后回到 `/home`，PurpleAir 卡片显示 "继续学习: M02"
- [ ] 移除项目后，再次 Pull 时学习数据 (LastVisited) 保留
- [ ] `/home` 页**不出现** agents/mcp/skills/config 等 studio 链接
- [ ] 老 cloud-app + 老 web 在本地仍能启动 (回归不被破坏)
- [ ] Playwright e2e 全绿

## 影响面

| 文件 / 目录 | 改动 |
|------------|------|
| `packages/student-app/` (新建) | ~800-1200 行 (auth + library proxy + catalog + db) |
| `packages/student-web/` (新建) | ~1500-2000 行 (Next.js 16 + 5 页面 + 共享组件) |
| `packages/cloud-app/` | 加 deprecation 注释; 路由保留; 不再生产部署 |
| `web/` | 保留, 标记为 studio dev tool; 不再生产部署 |
| `scripts/deploy.sh` | 改为部署 student-app + student-web |
| `scripts/restart.sh` | 新增起 student-app + student-web; 老服务作为可选 |
| nginx 配置 | 改路由 |

## 未来 spec (依赖本 spec 立的 framework)

- **028 - chat tutor 集成到 student-app**: spec 014 的 LLM chat 迁移过来, 接 ChatMessage 表
- **029 - notes & assignment**: 在 student-web 学习页加笔记编辑器 + 作业提交; 用 Note / AssignmentSubmission 表
- **030 - 学习进度 dashboard**: 基于 LastVisited 与 chat/notes 频度做小儿童档案
- **031 - studio desktop app** (独立 spec): 把老 cloud-app + web 中 creator 部分搬到本地 Electron/Tauri

## 关键约束 / 决策

1. **library 与 student 同机部署**: Pull 不复制文件, 仅建关系 (用户决策, 见上文"Pull 的语义")
2. **studio 不迁**: studio 留在老 cloud-app, 仅本地用, 将来做 desktop app
3. **chat / notes / assignment DB 表本期建好**: 即便 endpoint 不实现, schema 占位为 spec 028/029 服务
4. **完全独立的端口与 DB**: student-app 用 `~/.systemedu/student.db`, 不和老 cloud-app 的 `~/.systemedu/systemedu.db` 混
5. **回归测试**: 老 cloud-app + web 不能被破坏 (你本地工作流要保持)

## TODO 在 plan / tasks 阶段细化

- 接 spec 023 library-app 的 API 路径要不要变? (建议不变, library-app 维持现状)
- student-web 的 i18n 怎么处理? (建议默认中文, EN 留接口)
- 顶栏怎么处理学生未登录但访问 Library? (建议 Library 公开浏览, 点 Pull 时弹登录)
- 学生头像怎么做? (建议默认 emoji 或字母占位, 用户后期上传)
