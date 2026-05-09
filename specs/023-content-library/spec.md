# 023-content-library

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-08
**Last revised**: 2026-05-08 (含 package layout + 内容流水线 CLI)

## 背景

systemedu 已锁定 cloud-only 产品定位 (spec 022)。spec 023 完整定义:

1. **content package layout** (单一项目的目录 + 文件结构, 适合
   git/OSS/tarball 任一存储)
2. **packages/library-app/**: 内容服务, 用上述 layout 存自己的库
3. **tools/content-pipeline/**: 内容生产流水线 CLI
4. **course_factory/SKILL.md**: 蓝本, 让 Claude Code 跑生成 (人在
   Claude Code 里手动启动, 不做无人值守 SDK 集成)
5. **content-workspace/**: 内容工作区 (gitignored, 流水线产物)

## 工作流总览

```
~/Dev/systemeduidea/                    你独立的蓝图创作 repo (你手写 README.md)
       │
       │ a) 一次性 sync (后续两边独立)
       │    systemedu-content blueprint sync ~/Dev/systemeduidea
       ▼
content-workspace/blueprints/<slug>/    blueprint, 你想再编辑就改这里
       │
       │ b) 蓝图编译: README.md 的 Syllabus → V5 知识树骨架
       │    systemedu-content compile <slug>
       ▼
content-workspace/generated/<slug>/
  ├── manifest.json
  └── tree/knowledge_tree.json          24 modules 骨架, 还没 lesson 详情
       │
       │ c) 详细内容生成: 你打开 Claude Code, 让它按
       │    course_factory/SKILL.md 跑生成
       │    Claude 调 content_pipeline.factory.save_knode_to_workspace(<slug>, <module_id>, ...)
       │    输出写到 content-workspace/generated/<slug>/knodes/<id>/
       ▼
content-workspace/generated/<slug>/     完整 package, 含 lesson + media
  ├── manifest.json
  ├── tree/knowledge_tree.json
  ├── knodes/<id>/{lesson.md, sections.json, audio_scripts.json, media/}
  └── shared/
       │
       │ d1) 本地联调: publish 到本地 library-app
       │     systemedu-content publish <slug> --target=local
       ▼
local library-app DB + library_data/media/
       │
       │ d2) 导出 tarball, 用于 cloud 上线
       │     systemedu-content export <slug>
       ▼
content-workspace/dist/<slug>-v1.0.0.tar.gz
       │
       │ e) 导入到云端 library-app (admin API)
       │    在云服务器上: systemedu-content import dist/<slug>.tar.gz --target=https://library.<your-domain>
       ▼
cloud library-app 上线
```

**用户决策点 (5 个待你拍板, 已锁定)**:

1. ✅ content-workspace/ 在 systemedu monorepo 里, gitignored
2. ✅ tools/content-pipeline 是独立 Python 包, dev 才装, 不进生产
3. ✅ 内容生成走方案 C: 你手动在 Claude Code 里跑 SKILL,
   命令负责输出整理 + 入库 + 导出
4. ✅ 蓝图同步走方案 a: `blueprint sync ~/Dev/systemeduidea` 一次性
   (后续两边独立)
5. ✅ systemeduidea 在 spec 023 实施 Phase 1 时再拷过来 (现在不动)

## Content Package Layout (单项目结构)

每个项目一个目录, 按下面结构组织, 既适合本地 filesystem, 也适合
打成 tarball, 也适合直接搬上 OSS。

```
<slug>/                                  例: ai-ant-ethologist/
├── manifest.json                        ⭐ 索引: 元数据 + 文件清单 + SHA256
├── blueprint/                           ── 蓝图层 ──
│   ├── README.md                        英文蓝图 (你手写, sync 自 systemeduidea)
│   ├── README.zh.md                     中文蓝图
│   └── frontmatter.json                 解析出的 yaml frontmatter
├── tree/                                ── 知识树层 ──
│   └── knowledge_tree.json              V5KnowledgeTree (stages + modules + edges)
├── knodes/                              ── 详细内容层 (每 module 一目录) ──
│   ├── M01-w1-background-papers/        module_id 命名, 人类可读
│   │   ├── module.json                  module 元数据 (从 V5 拷一份, 自给自足)
│   │   ├── lesson.md                    plan_markdown (主体讲解, course_factory v3 step 1 输出)
│   │   ├── sections.json                rendered_sections (anim/game/diagram 引用)
│   │   ├── audio_scripts.json           {section_id: text, voice: "Cherry"} 用于 TTS
│   │   ├── assignment.md                作业 (course_factory v3 step 65)
│   │   ├── theories.json                理论标签 (可选)
│   │   └── media/                       该 knode 的所有富媒体
│   │       ├── anim_01.html             course_factory v3 step 50 输出
│   │       ├── game_01.html
│   │       ├── diagram_01.html
│   │       ├── audio_01.mp3             TTS 渲染产物
│   │       └── images/
│   │           └── reference_01.jpg
│   ├── M02-w2-species-id/
│   │   └── ...
│   └── M24-w24-final-report/
├── shared/                              ── 项目共享资源 ──
│   ├── cover.jpg                        项目封面 (可选, 没有走 CSS fallback)
│   ├── badges/                          阶段徽章 SVG (career path 用)
│   └── images/                          跨 knode 共用的素材
└── meta/
    ├── theory_tags.json                 项目级理论标签
    └── glossary.json                    术语表
```

### `manifest.json` schema

```json
{
  "schema_version": "1.0",
  "slug": "ai-ant-ethologist",
  "title": "AI Ant Ethologist (RFID Tracking + LLM Field Notes)",
  "title_zh": "AI 蚂蚁行为学家",
  "version": "1.0.0",
  "version_tag": "2026-05-08",
  "frontmatter": {
    "age_band": "10-12",
    "domain": "Robotics",
    "duration_weeks": 24,
    "weekly_hours": 5,
    "budget_usd": 250,
    "difficulty": 4
  },
  "knode_count": 24,
  "stage_count": 5,
  "languages": ["en", "zh-CN"],
  "total_size_bytes": 45000000,
  "files": [
    {
      "path": "manifest.json",
      "sha256": "...",
      "size": 1234
    },
    {
      "path": "blueprint/README.md",
      "sha256": "...",
      "size": 12000
    },
    {
      "path": "tree/knowledge_tree.json",
      "sha256": "...",
      "size": 50000
    },
    {
      "path": "knodes/M01-w1-background-papers/lesson.md",
      "sha256": "...",
      "size": 8000
    },
    {
      "path": "knodes/M01-w1-background-papers/media/anim_01.html",
      "sha256": "...",
      "size": 32000
    }
    // ... 全部文件
  ],
  "knodes": [
    {
      "module_id": "M01",
      "title": "Background papers and tracking software",
      "week": 1,
      "stage": "phase-1-background",
      "duration_minutes": 300,
      "knode_dir": "knodes/M01-w1-background-papers"
    }
    // ... 24 个
  ],
  "created_at": "2026-05-08T...",
  "updated_at": "2026-05-08T..."
}
```

manifest.json 用途:
- **完整性**: 所有文件 SHA256, 下载或导入时验证
- **增量**: 升级 v1.0.0 → v1.0.1, 比较 manifest 决定哪些文件要刷
- **多语言**: blueprint 含 README.md / README.zh.md, UI 自动选
- **一切真相之源**: library-app DB 里的字段都从 manifest 派生

## packages/library-app/ 结构

```
packages/library-app/
├── pyproject.toml                       name: systemedu-library
├── src/library/
│   ├── __init__.py
│   ├── main.py                          FastAPI app
│   ├── routes/
│   │   ├── public.py                    /v1/* 公开 API (license token)
│   │   └── admin.py                     /admin/* 管理 API (admin token)
│   ├── models.py                        SQLAlchemy: Project, Lesson
│   ├── auth.py                          token middleware
│   ├── storage.py                       filesystem / OSS abstract
│   └── importer.py                      tarball 导入逻辑
├── tests/
└── library_data/                        gitignored, 运行时数据
    ├── db.sqlite
    └── media/
        └── projects/
            └── <slug>/                  ⭐ 同 content package layout
                ├── manifest.json
                ├── blueprint/
                ├── tree/
                ├── knodes/
                └── shared/
```

**关键**: `library_data/media/projects/<slug>/` 的目录结构 = content package layout。这意味着:
- export 一个项目 = `tar -czf <slug>.tar.gz library_data/media/projects/<slug>/`
- import 一个项目 = `tar -xzf <slug>.tar.gz` 到 `library_data/media/projects/` 然后 reindex DB

## API 设计

### 公开 API (license token)

```
GET  /v1/projects                                项目列表 (公开 published 状态)
GET  /v1/projects/<slug>                         项目元数据 (manifest 摘要 + frontmatter)
GET  /v1/projects/<slug>/manifest                完整 manifest.json
GET  /v1/projects/<slug>/tree                    knowledge_tree.json
GET  /v1/projects/<slug>/blueprint?lang=zh-CN    README.md
GET  /v1/projects/<slug>/knodes/<id>             单个 knode (lesson + sections + audio_scripts + assignment)
GET  /v1/projects/<slug>/files/<path>            单个媒体文件 (cloud-app 转发或浏览器签名 URL)
```

### 管理 API (admin token, content-pipeline 调)

```
POST   /admin/projects/<slug>/import             上传整包 tarball, 服务器解压 + reindex
DELETE /admin/projects/<slug>                    下架/删除
POST   /admin/projects/<slug>/publish            published_at = now()
POST   /admin/projects/<slug>/unpublish          published_at = null
```

**MVP 只暴露 import/delete/publish 4 个 admin API**, 不再做"per-file
PUT", 减少出错面。content-pipeline 的 publish 命令本质就是
"export 成 tarball → 调 import API"。

## tools/content-pipeline/ CLI 设计

```
tools/content-pipeline/
├── pyproject.toml                       name: systemedu-content-pipeline
├── README.md
├── src/content_pipeline/
│   ├── __init__.py
│   ├── cli.py                           typer app, 命令入口
│   ├── blueprint.py                     蓝图同步 + 解析 frontmatter
│   ├── compile.py                       README.md → V5 knowledge_tree.json
│   ├── workspace.py                     content-workspace/ 路径管理
│   ├── factory_bridge.py                提供 save_knode_to_workspace() 给 SKILL 用
│   ├── manifest.py                      manifest.json 生成 / 验证
│   ├── package.py                       打包 tarball
│   ├── publish.py                       publish 到 local 或 remote library
│   └── importer.py                      从 tarball 导入到 library
└── tests/
```

### 命令

```bash
# 装一次, dev 模式
$ pip install -e tools/content-pipeline

# 1. 蓝图 sync (一次性)
$ systemedu-content blueprint sync ~/Dev/systemeduidea
syncing 25 blueprints from ~/Dev/systemeduidea/projects/ ...
  ai-ant-ethologist          [new]
  mars-analog-rover          [new]
  ...
✓ 25 blueprints synced to content-workspace/blueprints/

# 后续 sync (只更新有变化的)
$ systemedu-content blueprint sync ~/Dev/systemeduidea --diff
  alphafold-novel-mushroom   [updated]
  amateur-exoplanet-search   [unchanged]
  ...

# 2. 蓝图编译: README.md → V5 知识树骨架
$ systemedu-content compile ai-ant-ethologist
parsing blueprint: ai-ant-ethologist
  Phase 1 (W1-W5)   → stage S1, 5 modules
  Phase 2 (W6-W9)   → stage S2, 4 modules
  Phase 3 (W10-W15) → stage S3, 6 modules
  Phase 4 (W16-W22) → stage S4, 7 modules
  Phase 5 (W23-W24) → stage S5, 2 modules
  total: 5 stages, 24 modules
✓ written: content-workspace/generated/ai-ant-ethologist/tree/knowledge_tree.json
✓ written: content-workspace/generated/ai-ant-ethologist/manifest.json (skeleton)
✓ knode 目录创建 (24 个空目录, 等 SKILL 填充)

# 批量编译
$ systemedu-content compile --all

# 3. ⭐ 详细内容生成: 你在 Claude Code 里手动跑
#
# 在 Claude Code 里:
#   user> 现在用 course_factory/SKILL.md 给 ai-ant-ethologist 生成内容,
#         保存到 content-workspace/generated/
#   claude> [按 SKILL.md 流程跑] 调 content_pipeline.factory_bridge.save_knode(...)
#           写入 content-workspace/generated/ai-ant-ethologist/knodes/M01-.../
#
# 命令本身不调 LLM, 只做"配置 + 状态"管理:
$ systemedu-content status ai-ant-ethologist
project: ai-ant-ethologist
  blueprint:    ✓ synced
  tree:         ✓ compiled (24 modules)
  knodes:
    M01-w1-background-papers   ✓ done (7.2 KB lesson, 2 anims, 1 audio)
    M02-w2-species-id          ✓ done
    M03-w3-formicarium         ⏳ partial (lesson only, no media)
    M04-w4-rfid-bench-test     ⏸ pending
    ...
  publish:      ⏸ not yet

# 4. 本地联调: publish 到本地 library
$ systemedu-content publish ai-ant-ethologist --target=local
target: http://localhost:18821 (LIBRARY_URL)
packaging ai-ant-ethologist v1.0.0...
  manifest hash: 3a4f...
  tar.gz: 45 MB, 350 files
calling library /admin/projects/ai-ant-ethologist/import...
  validating manifest... done
  extracting + reindexing... done
✓ published to local library
URL: http://localhost:18821/v1/projects/ai-ant-ethologist

# 5. 导出 tarball (给 cloud 上线用)
$ systemedu-content export ai-ant-ethologist
packaging v1.0.0...
✓ content-workspace/dist/ai-ant-ethologist-v1.0.0.tar.gz (45 MB, sha256: 3a4f...)

# 6. 导入到 cloud library (在云端运维机器上跑)
$ systemedu-content import dist/ai-ant-ethologist-v1.0.0.tar.gz \
    --target=https://library.<your-domain> \
    --admin-token=$LIBRARY_ADMIN_TOKEN
calling /admin/projects/ai-ant-ethologist/import...
✓ imported to https://library.<your-domain>
```

## course_factory/SKILL.md 适配

**SKILL.md 内容不变**——它是给 Claude Code 看的指南, prompt 完全沿用。

**改动点在 `factory.py` 工具函数**: 加一个新模式让它写到
`content-workspace/generated/<slug>/knodes/<id>/`, 而不是当前的
`SQLite + ~/.systemedu/media/`。

具体:

### 当前 (本地单用户模式)
```python
from course_factory.factory import save_knode

ctx = load_context("rocket-design", idx=0)
save_knode(ctx, course_content)
# → 写到 SQLite (lesson_content_v3 表) + ~/.systemedu/media/
```

### 新增 (workspace 模式)
```python
from course_factory.factory import save_knode_to_workspace

save_knode_to_workspace(
    slug="ai-ant-ethologist",
    module_id="M01",
    course_content=course_content,
    workspace_root="content-workspace/generated",
)
# → 写到 content-workspace/generated/ai-ant-ethologist/knodes/M01-w1-background-papers/
#    {lesson.md, sections.json, audio_scripts.json, assignment.md, media/...}
# → 自动更新该 slug 的 manifest.json 中文件列表 + sha256
```

`tools/content-pipeline/src/content_pipeline/factory_bridge.py` 提供
这个新函数, course_factory 里 import 它即可。

**Claude Code 工作流**:

1. 你打开 Claude Code, 进 systemedu repo
2. 你说: "用 course_factory/SKILL.md 给 ai-ant-ethologist 生成内容,
   按新 workspace 格式输出"
3. Claude 读 SKILL.md, 按流程跑 (load_context → 8 类富媒体 debate →
   生成 anim/game → review → save), 但 **save 用
   `save_knode_to_workspace()`** (而不是旧的 `save_knode()`)
4. 输出落到 `content-workspace/generated/<slug>/knodes/<id>/`
5. 24 个 module 一个一个跑, 你 review 每一步

完成后跑 `systemedu-content publish` 入库。

## 鉴权

**MVP 阶段 (spec 023)**:
- license token: hardcoded shared token (写在 library 配置里)
- admin token: 另一个 hardcoded token, content-pipeline 用
- middleware 验证 `Authorization: Bearer <token>`

**spec 024 之后**:
- license token 改 JWT, cloud-app 颁发
- admin token 仍 hardcoded (运维侧, 不暴露给用户)

## packages/core/library_client/ SDK

简化版 (本期只服务 cloud-app 后端调 library, 不做 local 缓存):

```python
# packages/core/src/systemedu/core/library_client/__init__.py
class LibraryClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.token = token

    def list_projects(self) -> list[ProjectMeta]: ...
    def get_project(self, slug: str) -> ProjectMeta: ...
    def get_manifest(self, slug: str) -> Manifest: ...
    def get_tree(self, slug: str) -> V5KnowledgeTree: ...
    def get_blueprint(self, slug: str, lang: str = "zh-CN") -> str: ...
    def get_knode(self, slug: str, knode_id: str) -> dict:
        """完整 knode (lesson + sections + audio_scripts + assignment)"""

    def get_file_url(self, slug: str, path: str) -> str:
        """返回 https://library.../v1/projects/<slug>/files/<path>"""
```

cloud-app 用 LibraryClient 跟 library service 交互, 不直接读 library
数据。

## 工程量 / Phase

### Phase 1 (1 周): packages/library-app 骨架 + manifest schema

- 创建 `packages/library-app/` + pyproject.toml + uv workspace 加进去
- 实现 manifest.json schema (Pydantic models)
- DB schema (Project, Lesson)
- 公开 API + 管理 API (admin import 是核心)
- importer.py: tarball → 解压 + 验证 hash + 写 DB

### Phase 2 (1 周): tools/content-pipeline CLI 框架

- 创建 `tools/content-pipeline/` + pyproject.toml
- typer cli.py + 5 个子命令骨架
- blueprint sync (从 systemeduidea sync README.md)
- compile (README.md Syllabus → V5 knowledge_tree skeleton)
- export / import / publish

### Phase 3 (3-5 天): course_factory factory_bridge

- factory_bridge.save_knode_to_workspace() 实现
- 改 course_factory 让它支持 workspace mode
- 在 Claude Code 里跑一次完整流程, 验证 1 个项目能完整生成

### Phase 4 (3-5 天): library_client SDK

- packages/core/library_client/ 实现
- 单测

### Phase 5 (3-5 天): 部署 + 收尾

- library-app 部署独立 systemd unit (本期同机器, 端口 18821)
- HTTPS / 域名留 spec 025 处理
- spec 标 shipped

总: **~3 周** (比原 spec 23 多了流水线 CLI 和 SKILL 适配)

## 风险

| 风险 | 缓解 |
|---|---|
| course_factory 适配 workspace mode 改动大 | factory_bridge 新加函数 + 旧函数保留, 不破坏现有用法 |
| Claude Code 在 SKILL.md 流程中漏写文件 | 命令 systemedu-content status 列出每 knode 缺什么, Claude 看着补 |
| 蓝图编译 README.md → V5 解析错 | 单测覆盖 + 你 review compile 输出 + 手动调整 knowledge_tree.json |
| manifest hash 计算慢 (每次都全量算) | 增量算 (只算变了的文件) |
| tarball 太大 import 失败 | 流式 import (后期), MVP 一次性 |
| 25 项目并发跑 OOM | Claude Code 你手动一个一个跑, 不并发 |

## 非目标

- 不做内容审核 / 评分
- 不做 OSS / CDN (filesystem MVP)
- 不做无人值守自动生成 (你坚持 Claude Code 手动跑)
- 不做项目 fork / 衍生 / 多版本 A/B
- 不做"用户上传内容"
- 不做 webhook 通知 cloud (cloud 主动 pull)

## 验收

### library-app

- [ ] packages/library-app/ 创建 + uv workspace 集成
- [ ] FastAPI service 启动, DB 初始化
- [ ] 4 个 admin API 实现 (import / delete / publish / unpublish)
- [ ] 7 个公开 API 实现 (list / project / manifest / tree / blueprint / knode / file)
- [ ] importer 接收 tarball, 验证 hash, reindex DB
- [ ] systemd unit 部署到云服务器 (端口 18821)

### content-pipeline

- [ ] tools/content-pipeline/ 创建 + 独立 pip install 装
- [ ] systemedu-content blueprint sync 命令工作
- [ ] systemedu-content compile 命令把 1 个 README.md → V5 tree
- [ ] systemedu-content publish/export/import 全部跑通
- [ ] systemedu-content status 显示每项目状态

### course_factory

- [ ] factory_bridge.save_knode_to_workspace() 实现
- [ ] SKILL.md 加一段说明 "如果在 workspace mode, 用 save_knode_to_workspace"
- [ ] Claude Code 真实跑一次 1 个 module 验证产出符合 layout

### 集成

- [ ] 1 个项目 (例: ai-ant-ethologist) 走完蓝图 → 编译 → 生成 → 打包 → 入云的完整链路
- [ ] cloud-app (spec 024) 接入 library_client 后能从 library 拿到这个项目
- [ ] CLAUDE.md 更新内容生产工作流章节

## 后续 spec

- **spec 024**: cloud-app 多用户 + 接入 library_client
- **spec 025**: cloud 部署上云 (HTTPS / 域名 / OSS / PostgreSQL)
- 远期: library admin web UI / OSS / CDN
