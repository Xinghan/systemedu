# 022-monorepo-refactor — Plan

**Status**: in-progress
**Owner**: xinghan
**Created**: 2026-05-08

## 总体策略

**渐进式重构**——分 5 个 phase 提交，每个 phase 自己独立可工作 + 测试
通过，避免一次性大改 PR 难审难回滚。

每个 phase 一个 commit / branch。Phase 0-1 在 main，Phase 2+ 在
`feat/022-monorepo-impl` 分支推进，最后一次性 merge main。

## 工具选型：uv workspace

理由：
- uv 是 Astral 出的 Python 包管理器，原生支持 workspace（多 package
  共仓库共 venv）
- 比 hatch / poetry workspace 简单
- 已经普及（pyproject.toml + 一个 `[tool.uv.workspace]` 表）

实现：根 `pyproject.toml`：

```toml
[tool.uv.workspace]
members = ["packages/core", "packages/local-app"]

[tool.uv.sources]
systemedu-core = { workspace = true }
```

`packages/core/pyproject.toml`:
```toml
[project]
name = "systemedu-core"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "langchain-core>=1.0",
    "langchain-openai>=1.0",
    "langgraph>=1.0",
    "pydantic>=2.0",
    "sqlalchemy>=2.0",
    "aiosqlite>=0.20",
    "httpx>=0.27",
    "pyyaml>=6.0",
    # ... 抽取自当前 pyproject.toml
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

`packages/local-app/pyproject.toml`:
```toml
[project]
name = "systemedu-local"
version = "0.1.0"
dependencies = [
    "systemedu-core",  # workspace dep
    "starlette>=1.0",
    "uvicorn",
    "typer",
    # ... gateway/cli 专用
]

[project.scripts]
systemedu = "systemedu.local.cli.main:app"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

## 关键决策

### 1. 包命名

- **PyPI 名**: `systemedu-core` / `systemedu-local`（带 dash）
- **Python import 名**: `systemedu.core.*` / `systemedu.local.*`（带 dot）
- 用 PEP 420 namespace package 让两个 package 共用 `systemedu` 顶层
  namespace（不需要 `__init__.py` 在 namespace 层）

### 2. 配置加载兼容

`core/config.py` 当前直接读 `~/.systemedu/config.yaml` 全局 singleton。

spec 022 **不改这部分行为**——读路径仍是 `~/.systemedu/config.yaml`，
只是文件物理位置在 `packages/core/src/systemedu/core/config.py`。

cloud-app 起步（spec 024+）才会引入 `UserContext` 让 LLM 路由 per-user。

### 3. tests 拆分

```
packages/core/tests/        # 跟 core 走的: config / llm_client / planner /
                           #   course_factory / library_client (spec 023)
packages/local-app/tests/   # 跟 gateway / cli 走的: 017_gateway_config
                           #   017_e2e_routing 等
tests/                      # 仓库根仍保留, 跨 package 集成测试
```

仓库根 `pyproject.toml`:
```toml
[tool.pytest.ini_options]
testpaths = ["packages/core/tests", "packages/local-app/tests", "tests"]
```

### 4. course_factory/ 顶层目录处理

`course_factory/` 是 Claude Code SKILL 路径，**不进 packages**——保持
在仓库根。但它的 Python 代码 `course_factory/factory.py` 里 import
`systemedu.core.*` `systemedu.education.*` 等，spec 022 改完 import 后
仍能跑。

### 5. web/ 不动

Next.js 前端 + `web/public/dighuman/` 不属于 Python workspace，仍在
仓库根。它 `NEXT_PUBLIC_GATEWAY_URL` 连后端，后端起在 18820 不变。

## 影响面

| 模块 | 影响 |
|---|---|
| 测试 | 49 个全部要跟着改 import path |
| `scripts/install.sh` + `install/install_macos.sh` + `install_ubuntu.sh` | `pip install -e .` → `uv sync` 或 `pip install -e packages/core -e packages/local-app` |
| `scripts/restart.sh` | `python -m systemedu.gateway.server` → `python -m systemedu.local.gateway.server` |
| systemd unit | 同上, ExecStart 路径要改 |
| `course_factory/factory.py` 等 | import 路径全部要改 |
| 前端 | **不动** (NEXT_PUBLIC_GATEWAY_URL 连后端不变) |
| ~/.systemedu/config.yaml | **不动** (路径 + schema 不变) |
| 已 `git clone` 的老用户 | 重跑 `./scripts/install.sh` 即可 |

## 测试策略

每个 phase commit 前必须跑：

```bash
source .venv/bin/activate
python -m pytest tests/test_017_*.py tests/test_019_*.py tests/test_020_*.py tests/test_021_*.py 2>&1 | tail -5
# 期望: 49+ passed
```

最后还要做 production smoke test (47.106.220.119):
- `/api/status` 200
- `/login` 200
- `/api/auth/login` 拿到 token
- `/projects/new` AI 生成描述 (调 fast LLM 一次, 验证 import 正确)
- `/dashboard` `/projects` `/config` 都能渲染

## 风险

| 风险 | 缓解 |
|---|---|
| import path 漏改一处, 运行时 `ModuleNotFoundError` | 每 phase 跑全测试 + smoke test, ruff/mypy 扫 |
| `course_factory/` 这种顶层目录的 import 难追 | grep 全仓库 `from systemedu.` 一次性扫 |
| uv workspace 没用过, 配错 | 写完 phase 2 时本地 `pip install -e packages/...` 验证可装可 import |
| 老用户 `git pull` 后 .venv 里仍是旧 systemedu 包 | install.sh 加一句 `pip uninstall -y systemedu 2>/dev/null \|\| true` 在 reinstall 前清干净 |
| 生产部署时新 path 没生效 | 部署后 `journalctl` 看几秒确认无 ModuleNotFoundError |

## 验收

- [x] spec 022 已写
- [ ] plan.md 已写 (本文件)
- [ ] tasks.md 已写
- [ ] Phase 0 删 dead code + 前端封面 commit
- [ ] Phase 1 准备 + import 依赖图扫描
- [ ] Phase 2 抽 core
- [ ] Phase 3 抽 local-app
- [ ] Phase 4 配套调整 (install.sh / restart.sh / systemd)
- [ ] Phase 5 验证 (49+ 测试 + 生产 smoke)
- [ ] CLAUDE.md 项目结构章节更新
- [ ] spec 022 标 Status: shipped

## 上线步骤

1. feat/022-monorepo-impl 分支跑通本地
2. 测试通过 → push 远程
3. 在 47.106.220.119 上 git pull → `./scripts/install.sh` (会自动重装包路径)
4. systemctl restart systemedu-backend systemedu-frontend
5. smoke test 几个端点
6. PR merge main
7. spec 022 标 shipped
