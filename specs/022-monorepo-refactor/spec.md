# 022-monorepo-refactor

**Status**: draft
**Owner**: xinghan
**Created**: 2026-05-08

## 背景

systemedu 当前是单一 Python 包 + Next.js 前端的 monolith，单用户本地运行
模式。产品规划要求拆分多个 deployment：

- **local-app** (开源, 本地单用户)
- **cloud-app** (闭源, 多租户 SaaS, 后续 spec)
- **content-library** (闭源, 内容服务, spec 023 详述)

为了让这三个 deployment 共享底层能力 (LLM router / agent runtime /
course_factory / DB schema / library client SDK)，需要先做 monorepo
重构, 把"共享 lib"抽到 `core` 包。

> 不立刻做 cloud-app —— 先做 monorepo 改造 (spec 022) + content-library
> (spec 023)，等 core API 稳定后再起 cloud-app (spec 024+)。

## 决策摘要

**目标布局** (spec 022 后)：

```
systemedu/
├── packages/
│   ├── core/                   # 开源 Python lib (pip install systemedu-core)
│   │   ├── pyproject.toml      # name: systemedu-core
│   │   └── src/systemedu/core/
│   │       ├── config.py       (← src/systemedu/core/config.py)
│   │       ├── llm_client.py   (← 同上)
│   │       ├── agents/         (← src/systemedu/agents/)
│   │       ├── course_factory_v3/ (← 同上)
│   │       ├── education/      (← src/systemedu/education/, 但移除 image_gen, 它属于 local)
│   │       ├── storage/        (← src/systemedu/storage/, DB schema 模型)
│   │       ├── tutor/          (← src/systemedu/tutor/)
│   │       └── library_client/ (新增, spec 023 实现)
│   └── local-app/              # 开源, 当前 systemedu repo 主体应用
│       ├── pyproject.toml      # depends on systemedu-core
│       └── src/systemedu/local/
│           ├── gateway/        (← src/systemedu/gateway/)
│           ├── cli/            (← src/systemedu/cli/)
│           └── ... (image_gen, channels, hub 等单用户 only 模块)
├── web/                        # 仍在根目录, Next.js 前端
├── course_factory/             # 仍在根目录, Claude Code SKILL (不变)
├── scripts/                    # install.sh 等 (调整路径感知)
├── tests/                      # 拆分到各 package
├── pyproject.toml              # workspace root (uv workspace 或 hatch monorepo)
└── ...
```

**关键不变量**：
- 测试套件全部保持通过 (49 个 spec 017+019+020+021 测试)
- `~/.systemedu/config.yaml` 格式不变, 用户 0 感知
- `./scripts/install.sh` / `./scripts/restart.sh` 行为不变
- 47.106.220.119 生产部署 0 停机

## 目标 (WHAT)

1. **物理拆包**：当前 `src/systemedu/` 一棵树拆成 `packages/core/` +
   `packages/local-app/` 两棵
2. **import path 调整**：
   - `systemedu.core.config` → `systemedu.core.config` (不变, core 包内部)
   - `systemedu.gateway.server` → `systemedu.local.gateway.server`
   - `systemedu.agents.*` → `systemedu.core.agents.*`
   - `systemedu.education.*` → 大部分进 core, image_gen 进 local
   - `systemedu.storage.db` → `systemedu.core.storage.db`
3. **依赖关系单向**：local-app **可以 import** core；core **绝不 import** local
4. **uv workspace** 管理两个 package：
   - 根 `pyproject.toml` 改成 workspace root
   - `packages/core/pyproject.toml` + `packages/local-app/pyproject.toml`
     各自有独立 dependencies
   - `pip install -e packages/core/ -e packages/local-app/` 之后两个都
     editable
5. **scripts/install.sh 适配**：装 venv 后跑 `pip install -e packages/core
   -e packages/local-app`，旧的 `pip install -e .` 失效
6. **测试套件物理拆分**：
   - core 相关测试 → `packages/core/tests/`
   - local-app 相关测试 → `packages/local-app/tests/`
   - 仓库根有一个 `pytest.ini` 或 conftest.py 集合所有 packages 测试
7. **CI / 启动脚本**：
   - `./scripts/restart.sh` 仍用 `python -m systemedu.local.gateway.server`
   - systemd unit (生产) 同样

## 非目标 (不做)

- **不引入新功能** —— 纯物理重构
- **不动 web/** 前端代码 (Next.js 仍在根目录, 通过 NEXT_PUBLIC_GATEWAY_URL
  连后端)
- **不动 course_factory/** (Claude Code SKILL 路径)
- **不立刻发 systemedu-core 到 PyPI** —— editable workspace 已足够
- **不重命名 git repo** —— 仍叫 systemedu
- **不引入 uvicorn / starlette 之外的新框架**
- **不改 DB schema**
- **不引入 cloud-app** (留给 spec 024)
- **不抽 web/ 到 packages/web/** (前端不属于 Python workspace)

## 依赖关系图 (after spec 022)

```
┌──────────────────────────────────────────────┐
│ packages/local-app                            │
│  - gateway (FastAPI/Starlette HTTP server)    │
│  - cli (typer commands)                       │
│  - image_gen (Wanx 文生图, 单用户 only)        │
│  - channels (本地 IM 通道)                     │
│  - hub (旧 hub client)                        │
└──────────────────────────────────────────────┘
                     │
                     │ import
                     ▼
┌──────────────────────────────────────────────┐
│ packages/core                                 │
│  - config (Pydantic schema, 但不再读全局 yaml,│
│    改为接受 path 参数)                         │
│  - llm_client (LLM router, 跟 user_context 解 │
│    耦的接口)                                   │
│  - agents (planner / tutor / assessor)        │
│  - course_factory_v3 (12 步流水线)             │
│  - education (knowledge_tree models, lesson   │
│    generators, 但不含 image_gen)               │
│  - storage (DB schema base classes)            │
│  - tutor (memory / tools / agent runtime)      │
│  - library_client (HTTP SDK, spec 023 实现)    │
└──────────────────────────────────────────────┘
```

## 实现策略 (high-level，详细 plan/tasks 后续单独写)

### Phase 1: 准备 (0.5 天)

1. 备份当前 main 到 `pre-022-monorepo` tag
2. 跑全测试基线: 49 passed 记录下来
3. 用 `pyflakes` / `ruff` 扫一遍 import 依赖，列出当前 `gateway/` 里
   import 了哪些 `agents` `core` `education` `storage` `tutor`，确认
   依赖图是单向的（不应该有循环）

### Phase 2: 抽 core (3-5 天)

1. 创建 `packages/core/pyproject.toml`：
   ```toml
   [project]
   name = "systemedu-core"
   version = "0.1.0"
   dependencies = [...]  # 抽一份 core 用到的子集 (langchain, pydantic, sqlalchemy 等)
   ```
2. 创建 `packages/core/src/systemedu/core/`，物理 mv 子模块过去：
   - mv src/systemedu/core/* → packages/core/src/systemedu/core/
   - mv src/systemedu/agents/* → packages/core/src/systemedu/core/agents/
   - mv src/systemedu/course_factory_v3/* → packages/core/src/systemedu/core/course_factory_v3/
   - mv src/systemedu/education/{models,services,tree_generator,lesson_generator,...} → core/education/
     (image_gen 留在 local)
   - mv src/systemedu/storage/db.py → packages/core/src/systemedu/core/storage/db.py
   - mv src/systemedu/tutor/* → packages/core/src/systemedu/core/tutor/
3. **import path rewrite** (sed + 手动验证)：
   - `from systemedu.agents` → `from systemedu.core.agents`
   - `from systemedu.education.models` → `from systemedu.core.education.models`
   - `from systemedu.storage.db` → `from systemedu.core.storage.db`
   - 等等
4. 跑 core 自带测试，确保独立可跑

### Phase 3: 抽 local-app (2-3 天)

1. 创建 `packages/local-app/pyproject.toml`：
   ```toml
   [project]
   name = "systemedu-local"
   dependencies = ["systemedu-core"]  # 依赖 core
   ```
2. mv 剩余的：
   - mv src/systemedu/gateway → packages/local-app/src/systemedu/local/gateway
   - mv src/systemedu/cli → packages/local-app/src/systemedu/local/cli
   - mv src/systemedu/channels → packages/local-app/src/systemedu/local/channels
   - mv src/systemedu/education/image_gen.py → packages/local-app/src/systemedu/local/image_gen.py
3. import rewrite：
   - 凡是 `systemedu.gateway` `systemedu.cli` 改 `systemedu.local.gateway` `systemedu.local.cli`
   - 旧的 `from systemedu.education.image_gen import xxx` → `from systemedu.local.image_gen import xxx`

### Phase 4: 配套调整 (1 天)

1. 根 `pyproject.toml` 改成 workspace root：
   ```toml
   [tool.uv.workspace]
   members = ["packages/core", "packages/local-app"]
   ```
2. `scripts/install/install_macos.sh` + `install_ubuntu.sh`：
   - `pip install -e .` → `pip install -e packages/core -e packages/local-app`
3. `scripts/restart.sh`：
   - `python -m systemedu.gateway.server` → `python -m systemedu.local.gateway.server`
4. systemd unit 模板 (`scripts/install/write_systemd_nginx.sh`)：
   - 同上，改 ExecStart 路径
5. 测试：
   - 物理 mv tests/ 到对应 package
   - 仓库根加 conftest.py 让 `pytest tests/` 能跨 package 跑

### Phase 5: 验证 (1 天)

1. 全测试通过 (49+)
2. local-app 启动 + web `/login` + `/projects/new` + `/config` 都正常
3. 部署到 47.106.220.119 验证生产无回归
4. 旧 import path 完全消失 (`grep -rn "from systemedu.gateway\|from systemedu.agents\|..."` 应该 0 命中, 除了 packages 内部)

## 风险

| 风险 | 缓解 |
|---|---|
| import path 改了但漏掉某个文件 | 跑全测试 + production smoke test (登录 / 创建项目 / 知识树生成) |
| circular import (core ← local) | Phase 1 先扫依赖图; Phase 2 抽 core 时严格不让 import local |
| pyproject.toml workspace 配置错 | 先在分支跑通本地, 不上生产 |
| `~/.systemedu/config.yaml` 加载逻辑变化 | 不动 config 加载逻辑, 只 mv 文件位置 |
| course_factory/ (SKILL) 引用旧 import | 它本身在根目录不动, 但 SKILL 内部 `from systemedu.education...` 要改 |
| 老用户从 main 拉新代码后 install 路径变了 | install.sh 自适应, 用户 `git pull` 后跑一次 install.sh 即可 |

## 验收

- [ ] 49+ 测试全过 (含 spec 017/019/020/021)
- [ ] `./scripts/install.sh` macOS local 重新装一次, 启动正常
- [ ] `./scripts/restart.sh` 启动后 backend (18820) + frontend (3000) OK
- [ ] 47.106.220.119 部署后 `/api/status` `/login` `/config` `/projects/new` `/dashboard` 都正常
- [ ] `systemedu` 顶层 namespace 下只剩 `core` + `local` 两个子包 (其他文件全部 mv 了)
- [ ] `grep -rn "from systemedu.agents\|from systemedu.gateway" packages/core/` 命中 0 (core 不能 import local)
- [ ] `grep -rn "from systemedu.local" packages/core/` 命中 0
- [ ] CLAUDE.md 更新项目结构章节

## 后续 spec

- **spec 023**：content-library MVP + `core/library_client/` SDK
- **spec 024**：多用户 + auth + per-user LLM 配置 (cloud-app 前置)
- **spec 025**：cloud-app MVP (复用 core, 加多租户 / 订阅 / PostgreSQL)
- **spec 026**：cloud 部署上云 (Docker / HTTPS / OSS / k8s)
