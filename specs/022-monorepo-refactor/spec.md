# 022-monorepo-refactor

**Status**: shipped (Phase 0-5 完成 2026-05-11)
**Owner**: xinghan
**Created**: 2026-05-08
**Last revised**: 2026-05-11 (Phase 5 部署生产 + 标 shipped)

## 背景

systemedu 当前是单一 Python 包 + Next.js 前端的 monolith, 单用户本地
运行模式。**产品定位 (2026-05-08)**：

- 目标用户: C 端家长
- 部署形态: **只做 cloud SaaS**, 不做 local app (用户用浏览器访问)
- monorepo 内拆 3 个 deployment:
  - `packages/core/`         共享 lib (LLM router / agent / course_factory)
  - `packages/cloud-app/`    多租户 SaaS gateway (用户访问的入口)
  - `packages/library-app/`  内容服务 (你管理的项目库, spec 023 详述)
- **全部闭源**, 不区分开源 / 闭源逻辑; private GitHub repo

为了让 cloud-app 和 library-app 共享底层能力 (LLM router / agent
runtime / course_factory / DB schema models / library client SDK)，需要
先做 monorepo 重构, 把"共享 lib"抽到 `core` 包。

## 决策摘要

**目标布局** (spec 022 完成后)：

```
systemedu/                                  闭源 monorepo
│
├── packages/                               ── 服务代码层 ──
│   ├── core/                               共享 Python lib
│   │   ├── pyproject.toml                  name: systemedu-core
│   │   └── src/systemedu/core/
│   │       ├── config.py
│   │       ├── llm_client.py
│   │       ├── agents/
│   │       ├── course_factory_v3/
│   │       ├── education/
│   │       ├── storage/
│   │       ├── tutor/
│   │       └── library_client/             spec 023 实现
│   ├── cloud-app/                          多租户 SaaS gateway
│   │   ├── pyproject.toml                  depends on systemedu-core
│   │   └── src/systemedu/cloud/
│   │       └── gateway/                    FastAPI/Starlette web server
│   ├── (library-app/)                      spec 023 加, 内容服务后端
│   │   └── library_data/                   gitignored, 运行时数据 (DB + media)
│   └── (library-admin-ui/)                  spec 023 加, 内容管理员 SPA (独立 Next.js)
│       └── (Next.js 应用, 部署独立, 通过 API 跟 library-app 交互)
│
├── tools/                                  ── 内容流水线工具, 不属于 packages ──
│   └── content-pipeline/                   独立 Python 包, dev 才装, 不进生产
│       ├── pyproject.toml                  name: systemedu-content-pipeline
│       └── src/content_pipeline/
│           ├── cli.py                      systemedu-content 命令入口 (typer)
│           └── (compile / publish / export / import 子命令)
│
├── content-workspace/                      ── 内容创作层, gitignored ──
│   ├── README.md                          说明本目录工作流
│   ├── blueprints/                        蓝图 (从 systemeduidea sync 来, 你手动维护)
│   │   └── <slug>/
│   │       └── README.md (+ README.zh.md)
│   ├── generated/                         生成产物 (Claude Code 跑 SKILL 输出到这里)
│   │   └── <slug>/                        spec 023 package layout
│   │       ├── manifest.json
│   │       ├── tree/knowledge_tree.json
│   │       ├── knodes/<id>/{lesson, sections, audio, assignment, media}/
│   │       └── shared/
│   └── dist/                              导出 tarball, 给 cloud 上线用
│       └── <slug>-v1.0.0.tar.gz
│
├── course_factory/                         Claude Code SKILL 路径 (不变)
│   ├── SKILL.md
│   └── factory.py                          Python helper (核心抽到 packages/core/, 这里
│                                           保留 SKILL 协议入口)
├── web/                                    Next.js 前端
├── docs/
├── scripts/
├── specs/
├── tests/
├── pyproject.toml                          uv workspace
└── ...
```

**关键边界**:

1. **content-workspace/ 独立, gitignored**: 内容资产不污染代码 repo
2. **tools/content-pipeline 不属于 packages**: cloud-app / library-app 部署
   时**不装它**; 它只在你本地跑用来生成内容 + publish
3. **library-app 不依赖 content-pipeline**: library 只是个 HTTP service,
   吃 manifest 包, 写自己 DB; content-pipeline 通过 admin API 调它
4. **`systemedu-content` CLI 不进 PyPI / 不进 install.sh**: 单独 `pip
   install -e tools/content-pipeline` 装 (开发模式)

**不做 local-app**: 当前 src/systemedu/cli/ 的 typer CLI 是给单机本地
用的, 暂时**搁置 (mv 到 packages/cloud-cli/ 但不投入维护, 等需要 ops
工具再回头看)** 或**直接删掉 (用户不会用 CLI)**。

> **决策点**: cli/ 删 or 留作 cloud-cli? 见下文 §决策点 1

## 决策点

### 1. `src/systemedu/cli/` 怎么处理?

当前 cli 是 typer 实现, 包含 `systemedu agent start/stop`、
`systemedu config show`、`systemedu project init` 等命令。这些命令
是 OpenClaw 模式留下的, 多租户 cloud 用不到。

**方案 A (推荐)**: 直接删掉。
- 你部署 cloud / library 用 systemctl, 不用 typer CLI
- 简化包数 + 减少 dead code 维护

**方案 B**: 保留为 `packages/cloud-cli/`, 给你内部运维用 (例: 批量
import 项目到 library, 用户停权工具)
- 工程量类似, 但 cli 代码暂时没人维护会过期

**当前选 A**。如有运维需求再 re-introduce。

### 2. course_factory/ 顶层目录处理

`course_factory/` 是 Claude Code 用的 SKILL 路径, 包含 `factory.py`
(LLM 调用 audio_script + assignment 的 helper), 不变。它的代码
import `systemedu.core.*`, spec 022 改完 import 后仍能跑。

course_factory 实际上是**你内容生产的工具链**——用 Claude Code
打开 systemedu 仓库, Claude 按 SKILL.md 跑 course_factory.factory
里的工具函数, 输出灌到 library。所以 course_factory 是 **dev 工具**,
不是产品 deployment。

### 3. ~~local-app~~ 不存在

砍掉, 不再讨论。

## 目标 (WHAT)

1. **物理拆包**: 当前 `src/systemedu/` 一棵树拆成 `packages/core/` +
   `packages/cloud-app/` 两棵
2. **import path 调整**:
   - `systemedu.gateway.server` → `systemedu.cloud.gateway.server`
   - `systemedu.agents.*` → `systemedu.core.agents.*`
   - `systemedu.education.*` → `systemedu.core.education.*`
   - `systemedu.storage.db` → `systemedu.core.storage.db`
3. **依赖关系单向**: cloud-app **可以 import** core; core **绝不 import** cloud
4. **uv workspace** 管理两个 (将来三个) package
5. **scripts/install.sh 适配**: 装 venv 后 `pip install -e packages/core
   -e packages/cloud-app`
6. **scripts/restart.sh 适配**: `python -m systemedu.cloud.gateway.server`
7. **systemd unit 适配**: ExecStart 走新 path
8. **测试套件物理拆分**: core / cloud 测试到各 package 下

## 非目标 (不做)

- 不引入新功能 (纯 refactor)
- 不动 web/ 前端代码
- 不动 course_factory/
- 不发包到 PyPI
- 不重命名 git repo
- 不改 DB schema (留给 spec 024 user_id 改造)
- 不引入 Docker (留给 spec 025)
- 不引入 cloud 多租户逻辑 (留给 spec 024)

## Phase 推进 (重新规划, 因为产品定位变了)

### Phase 0: 清理 dead code + 前端封面 fallback ✅ Shipped (2026-05-08)

已合并到 main (commit 6e69823):
- 删 src/systemedu/channels/ (旧 OpenClaw 通讯通道)
- 删 src/systemedu/hub/ (旧 hub client)
- 删 src/systemedu/education/image_gen.py (Wanx 文生图)
- gateway 移除 _bg_*_cover 后台任务
- 前端 CoverFallback CSS 组件 (项目首字 + slug-hash 色)
- StoryGenAgent 改 text-only

### Phase 1: 准备 (0.5 天) — 待做

1. `git tag pre-022-monorepo` baseline
2. 跑测试基线 (46 passed)
3. 扫 import 依赖图

### Phase 2: 抽 core (3-5 天)

1. 创建 `packages/core/pyproject.toml` (uv workspace member)
2. mv `src/systemedu/{core,storage,agents,education,course_factory_v3,tutor}/*`
   → `packages/core/src/systemedu/core/`
3. import path rewrite + 跑测试

### Phase 3: 抽 cloud-app (2-3 天)

1. 创建 `packages/cloud-app/pyproject.toml`
2. mv `src/systemedu/gateway/*` → `packages/cloud-app/src/systemedu/cloud/gateway/`
3. 删 `src/systemedu/cli/` (方案 A)
4. import rewrite

### Phase 4: 配套调整 (1 天)

1. 根 `pyproject.toml` 改 workspace root
2. `scripts/install.sh` + `restart.sh` + systemd unit 适配新 path
3. `course_factory/factory.py` 里的 import 改新 path

### Phase 5: 验证 + 上线 (1 天)

1. 全测试 46+ 通过
2. 47.106.220.119 部署验证
3. spec 022 标 shipped

## 影响面

| 模块 | 影响 |
|---|---|
| 测试 | 46 测试要跟着改 import path |
| `scripts/install.sh` | `pip install -e .` → `pip install -e packages/core -e packages/cloud-app` |
| `scripts/restart.sh` | `python -m systemedu.gateway.server` → `python -m systemedu.cloud.gateway.server` |
| systemd unit | 同上 ExecStart 改 |
| `course_factory/factory.py` | import 改 |
| 前端 | **不动** (NEXT_PUBLIC_GATEWAY_URL 连后端不变) |
| `~/.systemedu/config.yaml` | **不动** |

## 风险 + 缓解

| 风险 | 缓解 |
|---|---|
| import 漏改 ModuleNotFoundError | 每 phase 跑全测试 + smoke test |
| circular import (core ← cloud) | Phase 1 先扫依赖图; Phase 2 严格不 import cloud |
| uv workspace 配错 | 退化用 `pip install -e packages/core -e packages/cloud-app` 直装 |
| 老用户 .venv 残留 systemedu 包 | install.sh 加 `pip uninstall -y systemedu` |
| course_factory 里 import 漏改 | grep 全仓库 sed 一遍 + 跑 v3 pipeline 一次 |

## 验收

- [x] Phase 0 shipped (channels/hub/image_gen 删 + CSS 封面)
- [ ] Phase 1-5 全部完成
- [ ] 46+ 测试通过
- [ ] 生产 47.106.220.119 部署 OK
- [ ] CLAUDE.md 项目结构章节同步更新
- [ ] .gitignore 加 `content-workspace/` 和 `library_data/`
- [ ] tools/content-pipeline/ 创建 (空 stub, 实质实现见 spec 023)

## 后续 spec

- **spec 023**: content-library MVP (修订: 进同 monorepo 的 packages/library-app/)
- **spec 024**: cloud-app 多用户 + auth (User 表 / JWT / per-user 配置 / 数据隔离)
- **spec 025**: cloud 部署上云 (Docker / HTTPS / 域名 / PostgreSQL)
