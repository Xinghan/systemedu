# 023-content-library

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-08

## 背景

systemedu 当前所有项目内容数据 (knowledge_tree / lesson / anim / game /
audio) 都跟运行时代码混在一起。spec 020 决定把这些内容拆成独立服务
`content-library`：

- 内容由你创作 + 精选 + 发布 (B 端运营)
- cloud-app 用户消费 (订阅后 acquire 项目即可学习)
- local-app 用户消费 (登录 cloud 账号拿 token, 下载项目包到本地学习)
- 用户**不能上传内容**, library 是你的资产

> 依赖 spec 022 完成 (需要 `packages/core/library_client/` SDK 位置)

## 决策摘要

**3 个组件**：

### 1. content-library service (新独立 repo `~/Dev/systemeducontent`)

- FastAPI service，独立部署 (端口 18821 默认, 上线后绑域名
  `library.systemedu.com`)
- 自己有 DB (SQLite MVP, 后期 PostgreSQL) + 文件系统媒体存储
  (后期 OSS)
- **公开 API** (license token middleware): 给 cloud-app + local-app 调
- **管理 API** (admin token): 给你的内容上传脚本调
- **数据**：每个项目一个 namespace, 含项目元数据 + knowledge_tree +
  全部 LessonContent + media 文件 + tarball 打包

### 2. `packages/core/library_client/` SDK (在 spec 022 抽好的 core 里)

- `LibraryClient(base_url, token)` 类
- 方法：
  - `list_projects()` → 项目列表
  - `get_project(slug)` → 项目元数据 + manifest
  - `get_lesson(slug, knode_id)` → 单个 lesson (cloud-app 用, 网络访问)
  - `download_project_tarball(slug, dest_dir)` → 打包下载整包到本地 (local-app 用)
- 缓存 / 离线 / 版本检查逻辑 (local 用)

### 3. local-app CLI / web 接入

- CLI: `systemedu library list` / `library acquire <slug>` / `library refresh <slug>`
- Web UI: `/library` 页面 (后期，MVP 先 CLI)
- acquire 时拉 tarball → 解压到 `<repo>/projects/<slug>/` → 在 local
  SQLite 注册一行 LocalProject

cloud-app 部分 **不在本 spec 范围**，等 spec 024+ cloud 起步时再实现
"acquire = 在 cloud DB user_projects 表写一行" 的逻辑。

## 数据模型

### content-library DB (独立, SQLite MVP)

```python
# library_app/models.py
class Project(Base):
    """一个发布的项目."""
    slug: str           # primary key, "rocket-design"
    title: str          # "逐梦太空：固体火箭设计..."
    description: str
    cover_image: str    # 相对路径 "projects/rocket-design/cover.jpg"
    age_range: str      # "8-12"
    tags: list[str]
    version: str        # "1.0.0" 或 unix timestamp
    knode_count: int    # 24
    estimated_hours: int # 16
    created_at: datetime
    published_at: datetime | None  # null 表示草稿不可见
    knowledge_tree: dict # 整棵 V5KnowledgeTree 序列化, 也可独立表

class Lesson(Base):
    """每个 knode 的课程内容. project_slug + knode_id 唯一."""
    project_slug: str
    knode_id: int
    plan_markdown: str
    rendered_sections: dict # JSON: {section_id: {animations, games, ...}}
    audio_scripts: dict     # JSON: {section_id: text}
    assignment_md: str
    files: list[dict]       # [{type: "anim", path: "knode_0/anim_1.html", size: 12345}, ...]
    version: str            # 跟 Project.version 同步
    UniqueConstraint(project_slug, knode_id)
```

### media 文件存储 (filesystem MVP, 后期 OSS)

```
library_data/
├── db.sqlite
└── media/
    └── projects/
        └── rocket-design/
            ├── cover.jpg
            ├── tarball.tar.gz       # 完整打包, local download 用
            └── knodes/
                └── 0/
                    ├── anim_0.html
                    ├── audio_0.mp3
                    └── ...
```

## API 设计

### 公开 API (license token)

```
GET  /v1/projects                    项目列表 (公开, 不要 token, 用于试看)
GET  /v1/projects/<slug>             项目详情 (公开, knowledge_tree 树结构)
GET  /v1/projects/<slug>/manifest    项目 manifest (含所有 file path + version)
                                     需要 token

GET  /v1/projects/<slug>/lesson/<knode_id>
                                     单个 knode 的 lesson 内容
                                     需要 token (cloud-app 用)

GET  /v1/projects/<slug>/files/<path>
                                     单个文件 (anim html / mp3 / png)
                                     需要 token (cloud-app proxy 给浏览器, 或
                                     浏览器直连)

GET  /v1/projects/<slug>/tarball     完整打包下载 (local-app 用)
                                     需要 token; gz 流式
```

### 管理 API (admin token, 你内容生产脚本调)

```
POST /admin/projects                       创建/更新项目元数据
POST /admin/projects/<slug>/lesson         上传单个 knode 的 lesson
POST /admin/projects/<slug>/files/<path>   上传单个媒体文件
POST /admin/projects/<slug>/publish        标记为发布 (set published_at)
DELETE /admin/projects/<slug>              下架/删除
POST /admin/projects/<slug>/rebuild-tarball 重新打包 tarball
```

## 鉴权

**MVP 阶段** (spec 023)：
- license token: 一个 hardcoded shared token (写在 library config 里, 你
  发给所有 dev / 测试用户)
- admin token: 另一个 hardcoded token (你创作时用)
- middleware 验证 `Authorization: Bearer <token>`

**spec 024 之后**：
- license token 改为 JWT，cloud-app 颁发 (注册 → token; 订阅升级 → token tier)
- library service 验证 JWT 签名 + 过期

## 内容生产工作流 (你怎么把内容灌进 library)

**方案 a (本 spec 选)**：脚本化 admin API 调用

```bash
# 你本地的内容工作区
~/Dev/systemeducontent/
├── projects/
│   └── rocket-design/
│       ├── project.yaml
│       ├── knowledge_tree.json
│       └── (用 systemedu local 生成的) lessons/, media/
├── tools/
│   └── publish.py    ← 这个脚本读上面的目录, POST 到 library service
└── README.md
```

`tools/publish.py` 做：
1. 读 `~/Dev/systemeducontent/projects/<slug>/` 整个目录
2. POST 项目元数据 → `/admin/projects`
3. 遍历每个 knode lesson，POST → `/admin/projects/<slug>/lesson`
4. 遍历每个 media 文件，PUT → `/admin/projects/<slug>/files/<path>`
5. POST `/admin/projects/<slug>/rebuild-tarball` 重打包
6. POST `/admin/projects/<slug>/publish` 发布

发布后 cloud / local 用户立即可见。

## local-app CLI 接入

`packages/local-app/src/systemedu/local/cli/library.py`:

```bash
# 列表 (公开 API, 不需要 token)
$ systemedu library list
SLUG               TITLE                       KNODES  HOURS  ACQUIRED
rocket-design      逐梦太空：固体火箭设计       24      16     ✓ (v1.0.0)
mars-risk-map      火星探险风险图               18      12     -

# 配 token
$ systemedu library token <license-token>
Saved to ~/.systemedu/library.token

# 获取一个项目 (下载 tarball + 解压 + 注册到本地 DB)
$ systemedu library acquire rocket-design
Downloading rocket-design v1.0.0 (45 MB)...
[######] 100%
Extracting to /Users/.../systemedu/projects/rocket-design/
Registered in local DB. Open http://localhost:3000/projects/rocket-design

# 检查更新
$ systemedu library refresh
rocket-design: local v1.0.0 == remote v1.0.0 (up-to-date)
mars-risk-map: not acquired (skipping)

# 强制重新下载
$ systemedu library refresh rocket-design --force
```

### 解压目录结构

```
<repo>/projects/<slug>/
├── project.yaml
├── knowledge_tree.json
├── manifest.json       # 含 version, file 列表
└── media/              # 解压后的 anim/audio/png
    └── knodes/
        └── 0/...
```

acquire 时同步把 LessonContent 写到 local SQLite (跟现在 systemedu 期望的
schema 一致)。

## SDK 设计 (`packages/core/library_client/`)

```python
# packages/core/src/systemedu/core/library_client/__init__.py
from systemedu.core.library_client.client import LibraryClient

# packages/core/src/systemedu/core/library_client/client.py
class LibraryClient:
    def __init__(self, base_url: str, token: str | None = None):
        self.base_url = base_url
        self.token = token

    def list_projects(self) -> list[ProjectMeta]: ...
    def get_project(self, slug: str) -> ProjectMeta: ...
    def get_manifest(self, slug: str) -> Manifest: ...
    def get_lesson(self, slug: str, knode_id: int) -> LessonContent: ...
    def get_file(self, slug: str, path: str) -> bytes: ...
    def download_tarball(self, slug: str, dest_path: Path,
                        progress_callback=None) -> None: ...

    # 离线 / 缓存版本
    def acquire_to_local(self, slug: str, projects_dir: Path,
                        local_db_session) -> LocalProject: ...
    def check_version(self, slug: str, local_version: str) -> str | None: ...
```

cloud-app 调用方式 (spec 024 之后)：
```python
client = LibraryClient(base_url="https://library.systemedu.com",
                       token=cloud_service_token)
lesson = client.get_lesson("rocket-design", 3)
# lesson 直接返回, 不下载 tarball
```

local-app 调用方式：
```python
client = LibraryClient(base_url=user_configured_url,
                       token=user_license_token)
client.acquire_to_local("rocket-design", Path("./projects"),
                       local_db_session)
# tarball 下载 + 解压 + 注册到 SQLite
```

## 目录 / 项目结构

```
~/Dev/systemeducontent/        # 你的内容工作区 (闭源)
├── library_app/                # FastAPI service
│   ├── pyproject.toml
│   ├── src/library/
│   │   ├── main.py            # FastAPI app
│   │   ├── routes/
│   │   │   ├── public.py      # /v1/* 公开 API
│   │   │   └── admin.py       # /admin/* 管理 API
│   │   ├── models.py          # SQLAlchemy schema
│   │   ├── auth.py            # token middleware
│   │   └── tarball.py         # 打包逻辑
│   └── library_data/           # 运行时数据 (gitignored)
│       ├── db.sqlite
│       └── media/
├── projects/                   # 内容工作区 (你创作时编辑)
│   └── rocket-design/
│       ├── project.yaml
│       └── ...
├── tools/
│   └── publish.py              # 上传脚本
├── scripts/
│   ├── install.sh              # 装依赖 + 启服务
│   └── restart.sh
├── tests/
└── README.md
```

## 工程量 / Phase

### Phase 1 (1 周): library service 骨架
- 起 ~/Dev/systemeducontent/library_app/ 的 FastAPI 项目
- DB schema + 简单 CRUD
- 公开 + 管理 API 实现 (基础, 无文件流式)
- 写 publish.py 把当前 ~/Dev/systemeducontent/projects/ 里的 3 个项目灌进去

### Phase 2 (1 周): SDK + local-app CLI
- `packages/core/library_client/` 实现
- local-app `systemedu library list/acquire/refresh` CLI
- 端到端测试: local 跑 acquire → 数据落本地 → web 能看到项目

### Phase 3 (3-5 天): 部署 + 收尾
- library service 部署到云服务器 (单独域名 / 端口)
- HTTPS (Let's Encrypt)
- 写个 admin web UI 查看项目列表 + 删除按钮 (MVP 简单)
- 文档 + spec 标 shipped

总: **2-3 周**

## 风险

| 风险 | 缓解 |
|---|---|
| publish.py 上传慢 (大 tarball) | 流式上传 + 断点续传 |
| token 泄露 (hardcoded shared token) | spec 024 改 JWT |
| local 缓存不一致 (用户 force quit) | 下载到 .tmp 文件, 完成才 rename |
| library 服务挂了, local 断网 acquire 失败 | local 已 acquire 的项目离线可用; refresh 失败提示用户 |
| 项目源数据 schema 改动后老 local 加载错 | manifest.json 含 schema_version, local 不兼容时提示升级 |

## 非目标 (不做)

- 不做内容审核 / 评分 / 评论系统
- 不做 OSS / CDN (filesystem MVP)
- 不做用户行为 analytics
- 不做 webhook (cloud 主动 pull, 不 push)
- 不做项目 fork / 衍生
- 不做"用户上传项目"

## 验收

- [ ] library service 能启动 + DB 初始化 + 3 个 projects 上传成功
- [ ] CURL `GET /v1/projects` 返回 3 项
- [ ] CURL `GET /v1/projects/<slug>/tarball -H "Authorization: Bearer <token>"`
      返回完整 tarball
- [ ] `packages/core/library_client/` SDK 实现 + 单测
- [ ] local-app `systemedu library acquire rocket-design` 完整跑通：
      - tarball 下载到本地
      - 解压到 `./projects/rocket-design/`
      - 写 LocalProject 到 SQLite
      - 浏览器打开 http://localhost:3000/projects/rocket-design 能看到
- [ ] `systemedu library refresh rocket-design` 报告 up-to-date
- [ ] library service 部署到云 (`library.systemedu.com` 或自选域名),
      HTTPS, local 端用真实域名 acquire 通
- [ ] 文档: README + 上传脚本 usage
- [ ] CLAUDE.md 更新项目架构图

## 后续 spec

- **spec 024**: 多用户 + auth + per-user LLM, 用户系统; library token 改 JWT
- **spec 025**: cloud-app MVP, 接入 library SDK
- **spec 027**: library 升级到 OSS + CDN (流量起来后)
