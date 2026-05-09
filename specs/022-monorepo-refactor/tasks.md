# 022-monorepo-refactor — Tasks

按 Phase 顺序执行。每个 Phase 一个或多个 commit, 跑测试通过后再下一步。

## Phase 0: 清理 dead code + 前端封面 (半天)

- [ ] T0.1 删除 `src/systemedu/channels/` 整个目录
- [ ] T0.2 删除 `src/systemedu/hub/` 整个目录
- [ ] T0.3 删除 `src/systemedu/education/image_gen.py`
- [ ] T0.4 在 `gateway/server.py` 移除 `_bg_generate_cover` /
        `_bg_gen_cover_on_detail` 两个函数和它们的 await 调用
        (api_create_project 和 api_project_detail 里);
        cover_image_url 字段在 DB 保留, 设为 ""
- [ ] T0.5 前端写 CSS 封面 fallback:
        - 新组件 `web/src/components/projects/cover-fallback.tsx`
        - 接 (title: string, slug: string), 渲染:
          - 200x200 圆角矩形
          - 背景色: 10 色板按 hash(slug) % 10 选
          - 大字: title[0] (中文一字 / 英文首字大写) 居中白色
        - 在所有项目卡片 (dashboard / projects 列表 / project detail)
          里, 当 cover_image_url 为空时渲染这个组件
- [ ] T0.6 跑测试: 49+ passed
- [ ] T0.7 commit `chore(022-P0): 删除 channels/hub/image_gen + 前端 CSS 封面 fallback`

## Phase 1: 准备 (0.5 天)

- [ ] T1.1 `git tag pre-022-monorepo` 标记 baseline
- [ ] T1.2 跑测试 baseline + 记录 (`pytest tests/test_017_*.py tests/test_019_*.py tests/test_020_*.py tests/test_021_*.py`)
- [ ] T1.3 扫 import 依赖图:
        ```bash
        grep -rn "^from systemedu\|^import systemedu" src/systemedu --include="*.py" \
          | grep -v __pycache__ | sort -u > /tmp/imports_before.txt
        ```
        review 一遍, 确认无循环依赖
- [ ] T1.4 commit baseline 标记 (合在下一个 commit 也行)

## Phase 2: 抽 core (3-5 天)

### 创建 packages/core 骨架

- [ ] T2.1 `mkdir -p packages/core/src/systemedu/core packages/core/tests`
- [ ] T2.2 写 `packages/core/pyproject.toml` (按 plan.md 模板)
- [ ] T2.3 创建 `packages/core/src/systemedu/__init__.py` 但**置空**
        (或不创建, 用 PEP 420 namespace package)
- [ ] T2.4 验证: `cd packages/core && python -c "import systemedu"` 应该不报错

### 物理 mv 模块进 core

每一步 mv 后立刻批量改 import + 跑相关测试:

- [ ] T2.5 mv `src/systemedu/core/*` → `packages/core/src/systemedu/core/`
        (config / llm_client; namespace 就叫 core, 内部不变, 不需要改 import)
- [ ] T2.6 mv `src/systemedu/storage/db.py` → `packages/core/src/systemedu/core/storage/db.py`
        - 全局 sed: `from systemedu.storage.db` → `from systemedu.core.storage.db`
        - 跑 test_017_*.py 验证
- [ ] T2.7 mv `src/systemedu/agents/*` → `packages/core/src/systemedu/core/agents/`
        - sed: `from systemedu.agents` → `from systemedu.core.agents`
        - 跑相关测试
- [ ] T2.8 mv `src/systemedu/education/*` → `packages/core/src/systemedu/core/education/`
        - sed: `from systemedu.education` → `from systemedu.core.education`
        - 注意: image_gen.py Phase 0 已删, 不要再 mv
- [ ] T2.9 mv `src/systemedu/course_factory_v3/*` → `packages/core/src/systemedu/core/course_factory_v3/`
        - sed: `from systemedu.course_factory_v3` → `from systemedu.core.course_factory_v3`
- [ ] T2.10 mv `src/systemedu/tutor/*` → `packages/core/src/systemedu/core/tutor/`
        - sed: `from systemedu.tutor` → `from systemedu.core.tutor`
- [ ] T2.11 mv 相关测试到 packages/core/tests/ (config / llm / planner / 等)

### 验证 core 自给自足

- [ ] T2.12 `pip install -e packages/core` 应该成功
- [ ] T2.13 在 venv 里 `python -c "from systemedu.core.agents import PlannerAgent"` 应该 OK
- [ ] T2.14 跑 `pytest packages/core/tests/` 全过
- [ ] T2.15 commit `refactor(022-P2): 抽出 packages/core (config/llm/agents/edu/v3/storage/tutor)`

## Phase 3: 抽 cloud-app (2-3 天)

- [ ] T3.1 `mkdir -p packages/cloud-app/src/systemedu/local packages/cloud-app/tests`
- [ ] T3.2 写 `packages/cloud-app/pyproject.toml` (按 plan.md 模板)
- [ ] T3.3 mv `src/systemedu/gateway/*` → `packages/cloud-app/src/systemedu/local/gateway/`
        - sed: `from systemedu.gateway` → `from systemedu.cloud.gateway`
- [ ] T3.4 mv `src/systemedu/cli/*` → `packages/cloud-app/src/systemedu/local/cli/`
        - sed: `from systemedu.cli` → `from systemedu.cloud.cli`
        - 改 entry point: `pyproject.toml [project.scripts] systemedu = "systemedu.cloud.cli.main:app"`
- [ ] T3.5 mv 对应测试到 packages/cloud-app/tests/
- [ ] T3.6 删除空的 `src/systemedu/` 目录 (此时 src/ 应该完全空了, rm -r)
- [ ] T3.7 全局检查: `grep -rn "from systemedu\." packages/ tests/ course_factory/ scripts/ web/` 应该
        全部走新路径 (systemedu.core.* 或 systemedu.cloud.*), 不能有
        裸 `systemedu.gateway` `systemedu.agents` 之类
- [ ] T3.8 `pip install -e packages/core -e packages/cloud-app` 装两个包
- [ ] T3.9 跑全测试 49+ passed
- [ ] T3.10 commit `refactor(022-P3): 抽出 packages/cloud-app (gateway/cli)`

## Phase 4: 配套调整 (1 天)

- [ ] T4.1 根 `pyproject.toml` 改 workspace root:
        ```toml
        [tool.uv.workspace]
        members = ["packages/core", "packages/cloud-app"]
        ```
        旧的 `[project] name = "systemedu"` 等字段全部清掉 (或保留为 stub)
- [ ] T4.2 改 `scripts/install/install_macos.sh`:
        - `python -m pip install -e .` → `python -m pip install -e packages/core -e packages/cloud-app`
        - 装前先 `pip uninstall -y systemedu 2>/dev/null \|\| true`
- [ ] T4.3 改 `scripts/install/install_ubuntu.sh`: 同上
- [ ] T4.4 改 `scripts/restart.sh`:
        - `python -m systemedu.gateway.server` → `python -m systemedu.cloud.gateway.server`
- [ ] T4.5 改 `scripts/install/write_systemd_nginx.sh`:
        - systemd unit ExecStart 改新 path
- [ ] T4.6 改 `course_factory/factory.py` 里所有 `from systemedu.` import:
        - sed 全局替换
- [ ] T4.7 改 `course_factory/SKILL.md` 文档里的 import 示例 (如果有)
- [ ] T4.8 删 root `pyproject.toml` 里的 dependencies (现在挪到 packages 各自的 pyproject.toml)
- [ ] T4.9 在 macOS 本地完整跑 `./scripts/install.sh` 验证一遍
- [ ] T4.10 跑 `./scripts/restart.sh` 启服务 + 浏览器测主要页面
- [ ] T4.11 commit `chore(022-P4): scripts/install.sh + restart.sh + systemd unit 适配新路径`

## Phase 5: 验证 + 上线 (1 天)

- [ ] T5.1 全测试: `pytest packages/ tests/ -v` 应 49+ passed
- [ ] T5.2 mypy / ruff 跑一遍 (不强制, 但看一下有没有 warning)
- [ ] T5.3 push feat/022-monorepo-impl + 创 PR
- [ ] T5.4 PR 自审 review
- [ ] T5.5 merge main + push
- [ ] T5.6 47.106.220.119 部署:
        - ssh 上去, cd /opt/systemedu, git pull
        - 跑 `./scripts/install.sh --host=47.106.220.119` 重新装 (含 venv 重建依赖)
        - systemctl restart systemedu-backend systemedu-frontend
        - 看 journalctl 几秒确认无 ModuleNotFoundError
- [ ] T5.7 smoke test: curl /api/status 200, /login 200, 浏览器登录
        看 dashboard / projects 列表 (如有项目) / config 都正常渲染
- [ ] T5.8 spec.md 改 Status: shipped (2026-MM-DD)
- [ ] T5.9 CLAUDE.md 项目结构章节更新 (`src/systemedu/` → `packages/core/`
        + `packages/cloud-app/`)
- [ ] T5.10 commit `docs(022): 标 shipped + CLAUDE.md 项目结构同步`

## 估算总时长

- Phase 0: 半天
- Phase 1: 半天
- Phase 2: 3-5 天 (大头, 模块多 import 改动密集)
- Phase 3: 2-3 天
- Phase 4: 1 天
- Phase 5: 1 天
- **总: ~7-11 天**

如果遇到坑可以延 1-2 天。预算 2 周内做完。

## 卡点应对

- **mv 后 import 错乱无法启动**: git checkout 回上一 phase commit, 一步步小步走
- **uv workspace 配置错**: 退化到 `pip install -e packages/core -e packages/cloud-app` 直接装也能用
- **生产部署后 systemd 起不来**: 看 journalctl 报错; 大概率是 ExecStart 路径或 venv 没刷新, ssh 上去手动 source venv 试一次
- **测试有 50%+ 失败**: 大概率是某一处 sed 改过头/不全, 用 git diff 对比哪个 phase 的 import 改丢了
