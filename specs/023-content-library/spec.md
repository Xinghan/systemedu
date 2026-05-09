# 023-content-library

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-08
**Last revised**: 2026-05-08 (改进 monorepo, 不独立 repo; 不要 local 客户端)

## 背景

systemedu 当前所有项目内容数据 (knowledge_tree / lesson / anim / game /
audio) 都跟运行时代码混在一起。spec 022 决定:

- 内容服务 `library-app` 进同 monorepo (`packages/library-app/`),
  共享 core 代码, 部署独立的 Python service
- cloud-app 用户消费内容: 用户在 cloud 里"加入"项目 → cloud DB 写一行
  user_projects 关系记录 → 学习时 cloud 实时调 library 拿内容
- **不做 local 客户端** (产品定位 cloud-only)
- 内容数据**不在 git** (`content-data/` gitignored), 由 library service
  自己用 DB + 文件系统存

> 依赖 spec 022 完成 (需要 `packages/core/library_client/` SDK 位置 +
> packages/library-app/ 包路径)

## 决策摘要

**3 个组件**:

### 1. `packages/library-app/` (内容服务, 同 monorepo, 闭源)

- FastAPI service, 部署独立 Python 进程 (端口 18821 默认, 上线后绑域名
  `library.systemedu.com`)
- 自己有 DB (SQLite MVP, 后期 PostgreSQL) + 文件系统媒体存储 (后期 OSS)
- **公开 API** (license token middleware): 给 cloud-app 调
- **管理 API** (admin token): 你内容上传脚本调
- 数据: 每个项目一个 namespace, 含元数据 + knowledge_tree + 全部 Lesson +
  media 文件 + 可选 tarball

### 2. `packages/core/library_client/` SDK (在 spec 022 抽好的 core 里)

- `LibraryClient(base_url, token)` 类
- 方法:
  - `list_projects()`
  - `get_project(slug)` → 项目元数据 + V5KnowledgeTree
  - `get_lesson(slug, knode_id)` → 单个 lesson (cloud-app 用)
  - `get_file(slug, path)` → 二进制文件 (anim html / audio mp3, cloud-app 转发给浏览器)
- 给 cloud-app 用; **本期不做 local-app, 所以不需要 tarball download / 缓存逻辑**

### 3. cloud-app 接入 (在 spec 024 真实落地; 本 spec 只立 contract)

- 用户登录 cloud → 浏览 library 项目列表 → 点 "加入"
- "加入" = `INSERT INTO user_projects (user_id, project_slug, joined_at)` 到 cloud DB
- 用户进入项目学习页, cloud-app 后端调 library 拿内容缝合页面 (lesson +
  user 自己的 progress/note)

## 数据模型

### library-app DB (独立, SQLite MVP, 不共享 cloud-app DB)

```python
# packages/library-app/src/library/models.py
class Project(Base):
    """一个发布的项目."""
    slug: str           # primary key, "rocket-design"
    title: str
    description: str
    cover_image_path: str | None  # 相对路径
    age_range: str                # "8-12"
    tags: list[str]               # JSON
    version: str                  # "1.0.0" 或 unix timestamp
    knode_count: int
    estimated_hours: int
    created_at: datetime
    published_at: datetime | None # null 表示草稿不可见
    knowledge_tree: dict          # JSON: 整棵 V5KnowledgeTree

class Lesson(Base):
    """每个 knode 的课程内容. (project_slug, knode_id) 唯一."""
    project_slug: str
    knode_id: int
    plan_markdown: str
    rendered_sections: dict       # JSON
    audio_scripts: dict           # JSON
    assignment_md: str
    files: list[dict]             # [{type:"anim", path:"knode_0/anim_1.html", size:12345}]
    version: str                  # 跟 Project.version 同步
    UniqueConstraint(project_slug, knode_id)
```

### media 文件存储 (filesystem MVP, 后期 OSS)

```
packages/library-app/library_data/  (gitignored)
├── db.sqlite
└── media/
    └── projects/
        └── rocket-design/
            ├── cover.jpg
            └── knodes/
                └── 0/
                    ├── anim_0.html
                    ├── audio_0.mp3
                    └── ...
```

## API 设计

### 公开 API (license token 必需)

```
GET  /v1/projects                           项目列表 (公开 published 状态)
GET  /v1/projects/<slug>                    项目元数据 + knowledge_tree
GET  /v1/projects/<slug>/lesson/<knode_id>  单个 knode lesson 内容
GET  /v1/projects/<slug>/files/<path>       单个媒体文件 (cloud 转发, 或浏览器签名 URL 直连)
```

**spec 023 不做 tarball 端点** (因为不做 local 客户端)。

### 管理 API (admin token, 你内容生产脚本调)

```
POST   /admin/projects                          创建/更新项目元数据
POST   /admin/projects/<slug>/lesson            上传单个 knode lesson
POST   /admin/projects/<slug>/files/<path>      上传单个媒体文件
POST   /admin/projects/<slug>/publish           标记发布 (set published_at)
DELETE /admin/projects/<slug>                   下架/删除
```

## 鉴权

**MVP 阶段 (spec 023)**:
- license token: hardcoded shared token (写在 library 配置里), 你发给
  cloud-app 部署时配在 secret 里
- admin token: 另一个 hardcoded token, 你内容生产时本地 .env 用
- middleware 验证 `Authorization: Bearer <token>`

**spec 024 之后**:
- license token 改 JWT, cloud-app 颁发: 用户注册 → JWT 存到 cloud-app
  service token; library 验证签名

## 内容生产工作流

**方案 a (本 spec 选)**: 脚本化 admin API 调用

```
content-data/                       # 你的内容工作区, gitignored
└── projects/
    └── rocket-design/
        ├── project.yaml
        ├── knowledge_tree.json
        └── (用 systemedu local 跑出来的) lessons/, media/

packages/library-app/
└── tools/
    └── publish.py                  ← 这个脚本读 ../../content-data/projects/<slug>/
                                    → 调 library 的 admin API 上传发布
```

`publish.py` 做:
1. 读 `content-data/projects/<slug>/` 目录
2. POST 项目元数据 → `/admin/projects`
3. 遍历每个 knode lesson, POST → `/admin/projects/<slug>/lesson`
4. 遍历每个 media 文件, PUT → `/admin/projects/<slug>/files/<path>`
5. POST `/admin/projects/<slug>/publish` 发布

发布后 cloud 用户立即可见。

## 你怎么生成项目内容

**复用现有 course_factory (Claude Code SKILL)**:

1. 在 monorepo 根目录打开 Claude Code
2. 让 Claude 按 `course_factory/SKILL.md` 跑 course_factory pipeline
3. Claude 调 `course_factory.factory.save_knode()` 把生成的内容写到
   **本地 SQLite + media 目录** (现在 systemedu local 跑的样子)
4. 你 review / 调整后, 跑 `publish.py rocket-design` 把这套数据迁到
   library-app 的 DB + media

实际上 course_factory 是你的"内容生产工具链", 不是产品 deployment。
它跑出来的中间产物存在 `content-data/`, 你 publish 到 library 后,
content-data 是工作区/草稿/版本控制的位置, library 是发布后的"产品库"。

## packages/library-app/ 结构

```
packages/library-app/
├── pyproject.toml
├── src/library/
│   ├── __init__.py
│   ├── main.py              # FastAPI app
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── public.py        # /v1/* 公开 API
│   │   └── admin.py         # /admin/* 管理 API
│   ├── models.py            # SQLAlchemy schema (Project, Lesson)
│   ├── auth.py              # token middleware
│   └── storage.py           # 文件系统 / OSS abstract
├── tools/
│   └── publish.py           # 上传脚本
├── tests/
└── library_data/            # 运行时数据 (gitignored)
    ├── db.sqlite
    └── media/
```

## 工程量 / Phase

### Phase 1 (1 周): library service 骨架

- 创建 packages/library-app/ + pyproject.toml + 加入 uv workspace
- DB schema + 简单 CRUD
- 公开 + 管理 API 实现 (基础, 无文件流式优化)
- 写 publish.py 把 content-data 里的 3 个项目 (mars-risk-map / injury-prevention /
  rocket-design) 灌进去测试

### Phase 2 (3-5 天): library_client SDK

- `packages/core/library_client/` 实现
- 单测 + mock library service 集成测试

### Phase 3 (2-3 天): 部署 + 收尾

- library service 部署到云服务器 (单独域名 / 端口)
- HTTPS (Let's Encrypt, 或先 IP 起步)
- 文档 + spec 标 shipped
- cloud-app 起来后 (spec 024) 接入 library_client

总: **~2 周**

## 风险

| 风险 | 缓解 |
|---|---|
| publish.py 上传慢 (大 tarball) | 流式上传 + 断点续传 (后期) |
| token 泄露 (hardcoded shared token) | spec 024 改 JWT |
| library 服务挂了 cloud-app 跟着挂 | 加缓存层 (cloud-app 内存 LRU 缓存 lesson) |
| 项目 schema 改后 cloud 端解析挂 | 项目 schema_version 字段, 增量兼容 |

## 非目标 (不做)

- 不做内容审核 / 评分 / 评论
- 不做 OSS / CDN (先 filesystem)
- 不做用户行为 analytics
- 不做项目 fork / 衍生
- 不做"用户上传项目"
- 不做 tarball / 整包下载 (没有 local 客户端)
- 不做 webhook (cloud 主动 pull, 不 push)

## 验收

- [ ] packages/library-app/ 创建 + uv workspace 集成
- [ ] FastAPI service 启动, DB 初始化, 3 个项目通过 publish.py 上传
- [ ] CURL `GET /v1/projects` 带 token 返回 3 项
- [ ] CURL `GET /v1/projects/<slug>/lesson/0` 返回 lesson 内容
- [ ] CURL `GET /v1/projects/<slug>/files/<path>` 返回媒体文件
- [ ] `packages/core/library_client/` SDK 单测通过
- [ ] library service 部署到 47.106.220.119 (或独立 IP), 起独立 systemd unit
- [ ] CLAUDE.md 更新: library 服务 + 内容生产工作流

## 后续 spec

- **spec 024**: cloud-app 多用户 + 接入 library_client
- **spec 025**: cloud 部署上云 (Docker / HTTPS / OSS / PostgreSQL)
- 更远期: library 加 OSS 存储 / CDN; admin web UI
