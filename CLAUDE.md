# SystemEdu - Project Guidelines

## 语言要求

**所有回复必须使用中文**，包括代码注释说明、错误分析、建议等。禁止在回复中混入其他语言（韩文、日文等）。

## 工具调用纪律（硬规则，避免 tool call 失败）

**调用工具时必须发起真正的工具调用，绝不能把工具调用写成普通文本输出。** 历史反复踩坑：在回复正文里打出看起来像工具调用、实则是纯文本的 XML 形态内容（常见诱因：前一个工具结果刚返回、急着连续发下一个调用时，错把调用敲进了文本流）。这种文本会被解析为 malformed tool call 而失败，浪费往返。

铁律：
- 每次要用工具，就用工具机制本身发起调用，不要在 assistant 正文里手写工具调用的 XML 字符串。
- 工具调用结果返回之前，不要继续往下写（不臆测结果、不接着写后续步骤）。一次只推进到"发起调用"为止，拿到结果再继续。
- 如果发现自己上一条输出里出现了裸的工具调用文本，立即停止该模式，下一步直接用正确的工具调用机制重做同一个操作。

### 已定位的高频触发点：Bash 内联多行 Python（务必规避）

实测规律：上面那种"工具调用被渲染成文本"的失败，**几乎全部发生在 Bash 命令里内联了带缩进的多行 Python**（`python3 -c "..."` 里含 `for` / `if` / `try` 等缩进块）时。一旦第一条这样的调用漏成文本，后续会惯性连发数条都是文本，直到改用"脚本写文件再跑"才恢复。纯 shell 命令、Write/Edit/TaskUpdate 基本不触发。

硬规则：
- **禁止在 Bash 里内联带缩进的多行 Python**（`python3 -c "..."` 含 for/if/try/def 等多行块）。需要解析 JSON / 跑结构检查时，先用 `Write` 把脚本写成一个 `.py` 文件（放 `projects_data/_review/` 等临时区，可后续删除），再 `python3 那个文件.py`。
- 单行 `python3 -c "..."`（无缩进块，如一行 print）可以用；一旦逻辑要换行/缩进，就走文件。
- 这是当前能在 agent 侧落地的止血法；根因在 harness 工具调用序列化层，不在本仓代码范围。

## Project Overview

SystemEdu 是一款 **cloud 优先的 AI Agent 教育平台**，教育为核心定位，Agent 为底层架构。课程内容由 library 服务统一托管，学生在浏览器里 pull 项目 (仅在 DB 记一行关联)，学习时实时代理 library 内容；所有用户学习进度 / 行为数据 / agent chat 数据存 student-app 的 PostgreSQL。

面向儿童到青少年（6-18岁）的 AI Agent 驱动项目制学习平台。用户可以从零基础开始参与真实工业级项目，在多 Agent 智能导师系统的引导下，逐步掌握并完成工业级别的项目。

核心技术特色：本地 Agent Runtime、多 LLM provider 支持、MCP 工具集成、Skills 系统、动态知识树 DAG、Mem0 记忆、Hub 项目共享。

## Tech Stack

### Core (`packages/core/`, spec 022 monorepo)
- **Language**: Python 3.12+
- **Config**: YAML + Pydantic models
- **Agent Runtime**: LangGraph + LangChain + OpenAI-compatible LLM
- **Memory**: Mem0 (optional, vector+graph hybrid)
- **Storage**: SQLite (local) + SQLAlchemy (spec 025 上 PostgreSQL)
- **MCP**: Python MCP SDK
- **Skills**: SKILL.md format

### Student App (`packages/student-app/`, spec 027 起, port 18820)
**当前主入口**, 多用户 SaaS gateway.
- **Web server**: Starlette + uvicorn
- **DB**: PostgreSQL (docker) + SQLAlchemy + alembic; pytest 走 SQLite
- **Cache**: Redis (docker) — 跨实例共享
- **Auth**: JWT
- **Library**: 通过 LIBRARY_LICENSE_TOKEN 反向调 `library-app:18821`
- **Chat**: WebSocket /api/chat/stream — LangGraph + spec 031 五层 memory inject
- **Worker**: 独立进程 `python -m systemedu.student.workers.fact_extractor_worker`,
  5min tick 抽 chat → StudentFact

### Student Web (`packages/student-web/`, spec 027/032, port 4000)
**当前主前端**, Industrial Atelier 暖纸色设计 (#FAF9F5 / Claude coral #D97757).
- **Stack**: Next.js 16 + TypeScript + Tailwind v4
- **Routes**: / (landing), /home (dashboard), /library (项目库 + 详情 + 学习页),
  /my-projects, /sessions, /memory, /login, /register
- **Chat**: FloatingChat panel (右下角), 自动按 pathname 推 `page_kind` 到 student-app
- **设计稿源**: `main_design/UI/` (设计权威源)

### Library App (`packages/library-app/`, port 18821)
内容服务, 提供 /v1/projects/* (公开) + /admin/* (管理).
- student-app 走 LIBRARY_LICENSE_TOKEN 调用 /v1/*
- library-admin-ui 前端 (port 3001) 调 /admin/*

### Cloud App (`packages/cloud-app/`, **deprecated** 2026-05-19)
**不再演进** — 见 `packages/cloud-app/DEPRECATED.md`. 老 spec 022/024 时期的
单用户 SaaS gateway, 现 student-app 完全替代. 旧生产 47.92.200.21 曾跑这个; 新生产
47.106.220.119 已部署 student-app 新架构 (见 scripts/deploy.env + deploy-student.sh).

### LLM Support (multi-provider, OpenAI-compatible API)
- Qwen (DashScope): `qwen-plus`, `qwen-turbo`
- Claude (Anthropic): `claude-sonnet-4-20250514`
- Local (Ollama): `llama3`, etc.
- Any OpenAI-compatible endpoint

### Hub Server (`/hub-server/`, Phase 4)
- Django 6 + DRF (reused from legacy backend)
- Project registry, auth, reviews

### Web UI (`/web/`, **deprecated** 2026-05-19)
**不再演进** — 见 `web/DEPRECATED.md`. 老 cloud-app 时期单用户前端 (Lumina Nexus
紫色). 新前端在 `packages/student-web/` (Industrial Atelier). 旧生产 47.92.200.21 曾跑
这个; 新生产 47.106.220.119 已切到 student-web.

### Legacy (removed)
- 旧的 `backend/` `frontend/` `adminsite/` `adminsite-fe/` 已于 2026-04-15 删除
- spec 022 (2026-05-11) 拆 monorepo: `src/systemedu/` → `packages/{core, cloud-app}/`;
  删除 `cli/` `channels/` `hub/` `image_gen.py` (OpenClaw 残留 / Wanx 文生图)
- spec 031 (2026-05-18): tutor 多用户五层 memory, 走 student-app (PG + Redis + Qdrant + Mem0)
- spec 032 (2026-05-19): student-web Industrial Atelier UI 整合 spec 031 (chat panel
  page_kind / /sessions / /memory / exercise attempt POST)

## Project Structure (spec 022 monorepo, shipped 2026-05-11)

```
systemedu/                              uv workspace, 闭源 monorepo
├── CLAUDE.md
├── pyproject.toml                      uv workspace root (无代码)
│
├── packages/                           ── 服务代码层 ──
│   ├── core/                           共享 lib (systemedu-core)
│   │   ├── pyproject.toml
│   │   └── src/systemedu/core/
│   │       ├── config.py               Pydantic + YAML 配置
│   │       ├── llm_client.py           multi-provider LLM router (spec 017+021)
│   │       ├── sandbox.py / tool_executor.py
│   │       ├── agents/                 BaseAgent + planner / tutor / 等
│   │       ├── course_factory_v3/      12 步课程生成流水线 (spec 016)
│   │       ├── education/              models / services / tree_generator
│   │       ├── storage/                SQLAlchemy DB schema
│   │       ├── tutor/                  记忆 / 工具 / agent runtime (spec 014)
│   │       ├── memory/                 mem0 客户端
│   │       ├── mcp/                    MCP servers
│   │       └── skills/                 SKILL.md loader + builtin
│   ├── student-app/                    **主后端** (systemedu-student, port 18820)
│   │   └── src/systemedu/student/      JWT + PG + Redis + 五层 memory chat
│   │       ├── server.py               Starlette HTTP/WS server
│   │       ├── auth/                   JWT (spec 027)
│   │       ├── db.py                   SQLAlchemy schema (alembic 管理)
│   │       ├── cache.py                Redis 异步客户端
│   │       ├── chat/                   tutor_runner / memory_layers / exercise / memory
│   │       ├── workers/                fact_extractor_worker (独立进程)
│   │       ├── library_proxy/          反代 library-app /v1/*
│   │       └── catalog/                我的项目 / last_visited
│   ├── student-web/                    **主前端** (Next.js, port 4000)
│   │   └── src/                        Industrial Atelier 设计 (main_design/UI/)
│   ├── library-app/                    内容服务 (port 18821, spec 023)
│   ├── library-admin-ui/               library 管理前端 (port 3001)
│   └── cloud-app/                      **deprecated** (DEPRECATED.md), 老 spec 022 gateway
│
├── tools/
│   └── content-pipeline/               内容流水线 CLI (dev 装, 不进生产, spec 023)
│
├── content-workspace/                  gitignored, 内容创作工作区 (spec 023)
├── web/                                **deprecated** 老 cloud-app 前端
├── main_design/UI/                     设计稿权威源 (Industrial Atelier)
├── course_factory/                     Claude Code SKILL.md (内容生产手册)
├── docker-compose.yml                  本地 PG + Redis + Qdrant (spec 031)
├── scripts/
│   ├── install.sh                      一键安装入口
│   ├── restart-student.sh              **本地主入口**: student-app + worker + student-web
│   ├── restart.sh                      **老**: 启 cloud-app + 老 web (生产部署用)
│   └── install/                        平台特定脚本
├── tests/                              跨 package 集成测试
├── specs/                              per-feature spec/plan/tasks (speckit)
└── docs/                               prd.md / 长期文档
```

**关键依赖单向**: `student-app → core`; core 不知道 student/cloud 存在。
**student-app 跟 library-app 走 HTTP**, 不互相 import.

**Course Factory** 流程 (Claude Code 作为 skill 调用): 见 `course_factory/SKILL.md`。
Python API 通过 `from course_factory import ...` 调用; 内部依赖
`from systemedu.core.* import ...` (spec 022 后)。

## Common Commands

### Restart - 本地开发 (主入口)
```bash
./scripts/restart-student.sh
```
启 student-app backend (:18820) + fact_extractor worker + student-web (:4000).
依赖 docker compose 起 PG/Redis/Qdrant (`docker compose up -d`).

- Backend: `python -m systemedu.student.server`
- Worker: `python -m systemedu.student.workers.fact_extractor_worker`
- Frontend: `cd packages/student-web && PORT=4000 npm run dev`
- Library: 单独跑 `cd packages/library-app && uvicorn library.main:app --port 18821`
- 本机有 HTTP proxy (`http_proxy=http://127.0.0.1:7890`); curl 测试加 `--noproxy '*'`
- WS 调试 Python 时设 `NO_PROXY=127.0.0.1,localhost`

### 老入口 (deprecated, 仅生产 deploy 用)
```bash
./scripts/restart.sh
```
启老 cloud-app gateway (:18820) + 老 web (:3000). 不要新功能跑这个.

### Run Tests
```bash
source .venv/bin/activate && python -m pytest tests/ -v
```

---

## 生产服务器

- **地址**: 47.106.220.119 (新; 旧 47.92.200.21 已弃用)
- **系统**: Ubuntu 24.04.4，阿里云 ECS (14G RAM)
- **配置单一源**: `scripts/deploy.env` (SERVER_HOST / 端口 / 路径)。换服务器只改这里。
- **架构**: student-app 新架构 (student-app:18820 + student-web:4000 + library:18821 + docker PG/Redis)

### SSH 登录服务器
该服务器走密码登录 (需 sshpass)。密码经 SSHPASS env 传, 不写进文件/命令行历史。
```bash
export SSHPASS='<密码>'
./scripts/server-ssh.sh                                  # 交互式
./scripts/server-ssh.sh "systemctl status systemedu-student-backend"
```

### 部署最新代码到生产
```bash
./scripts/deploy.sh
```
打包本地代码 -> scp 上传 -> 服务器解压 + pip install + npm build -> 重启服务 -> 验证。

### 服务器目录结构
```
/opt/systemedu/          # 项目代码
/root/.systemedu/        # 用户数据（config.yaml、systemedu.db、media/）
/etc/systemd/system/systemedu-backend.service
/etc/systemd/system/systemedu-frontend.service
/etc/nginx/sites-available/systemedu
```

### 服务管理
```bash
# 查看服务状态
./scripts/server-ssh.sh "systemctl status systemedu-backend systemedu-frontend nginx"

# 查看后端日志
./scripts/server-ssh.sh "journalctl -u systemedu-backend -n 100 -f"

# 查看前端日志
./scripts/server-ssh.sh "journalctl -u systemedu-frontend -n 50"

# 重启服务
./scripts/server-ssh.sh "systemctl restart systemedu-backend systemedu-frontend"
```

### 架构
```
Internet -> nginx:80 -> /api/*  -> uvicorn:18820 (Python gateway)
                     -> /*      -> Next.js:3000  (npm start)
```

## Development Rules

### Git Workflow
- **Every code change must be committed** after the request is completed
- **commit 后必须立即 `git push` 到远程** — 这是硬性要求，不允许只 commit 不 push、把工作积压在本地。
  远程 (GitHub) 是唯一可靠的保险；本地长期领先远程会在任何一次 git 整理/reset 时面临丢失风险
  (2026-06-16 曾因本地积压数天未 push 的工作 + 一次 reset 误判，险些丢失，靠 reflog 才找回)。
  做完一段就 commit + push，不攒着。
- Commit messages follow conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Never force push or amend unless explicitly asked

### Spec Workflow (speckit + superpower)
- 文档分工：
  - `docs/prd.md` — 总纲：产品愿景、架构、路线图、API 总览（全局视图）
  - `specs/NNN-<slug>/` — 单个特性的 spec/plan/tasks 三件套
  - `docs/todolist.md` — Feature backlog（回顾建议沉淀处）
- **新特性开发必须按 spec → plan → tasks → 实现 顺序**，细则见 `specs/README.md`：
  1. 用户描述需求 → Claude 生成 `spec.md`（WHAT + WHY），用户确认
  2. Claude 生成 `plan.md`（方案、影响面、验收），用户批准
  3. Claude 生成 `tasks.md`（可执行清单），按序实现并勾选进度
  4. 特性上线后在 spec.md 顶部加 `Status: shipped (YYYY-MM-DD)`
- **简单 bugfix 可豁免三件套**，但 commit message 必须讲清楚根因 + 影响面
- 每次完成新特性后同步更新：
  1. `docs/prd.md` Phase checklist + API 表格
  2. 对应 `specs/NNN-.../spec.md` 的 Status 与验收结果
- **创建新 spec 目录前确认顺序号**（`ls specs/ | sort | tail -1` + 1），不要跳号

### Code Standards
- Python: PEP 8, type hints, async where appropriate
- Config: Pydantic models for all configuration
- Agents: BaseAgent subclass with `process()` method
- Education: Pydantic models (no Django ORM in core package)
- No over-engineering: build what's needed now, not what might be needed later
- **禁止使用 emoji**：所有代码、prompt、UI 文案、PRD 中不使用任何 emoji 符号（包括 ✓✗★♥ 等 Unicode 符号）。反馈用纯文字或 SVG 图形表达。

### Development Loop (必须遵循)
每个功能的开发必须严格按照以下循环执行：

```
1. 开发新功能 → 2. 编写测试 → 3. 运行测试并修复 bug
→ 4. 提交代码 → 5. 回顾：审视现有系统，思考是否有新功能/改进可以添加
→ 6. 向用户提出建议并询问确认 → 7. 用户确认后更新 PRD → 8. 继续下一轮开发
```

**第 5-6 步（回顾与建议）是强制步骤，不可跳过。**

### Feature Backlog (`docs/todolist.md`)
- `docs/todolist.md` 是功能待办追踪文件
- 每轮回顾建议中，用户确认保留的条目追加到此文件
- 待办升级为特性时，在 `specs/` 建三件套，从 todolist 中移除

### Testing (Mandatory)
- **每个新功能都必须附带测试，未写测试不允许提交**
- 运行测试：`source .venv/bin/activate && python -m pytest tests/ -v`
- Agent 测试：使用 mock LLM 响应，验证 agent 输入输出
- **LLM/Prompt 行为必须用真实 LLM 验证，不允许仅凭预期推断**
  - 修改 prompt 后，必须用真实 LLM 跑代表性测试用例，观察实际输出
  - 例如：`python3 << 'EOF' ... asyncio.run(test()) EOF`
  - 不允许说"LLM 会判断..."、"LLM 应该会..."，必须跑出实际结果再下结论
- 配置测试：使用 tmp_path fixture，不污染真实 ~/.systemedu/

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-11 | Next.js for frontend | SSR, App Router, great DX |
| 2026-03-11 | Django for backend | Mature, admin built-in, Python ML ecosystem |
| 2026-03-12 | LangGraph for agent orchestration | Stateful graph, handles branching |
| 2026-03-12 | Mem0 for AI memory | Vector+graph hybrid, self-hosted |
| 2026-03-12 | DAG-based knowledge tree | Prerequisite dependencies, non-linear learning |
| 2026-03-12 | Qwen (DashScope) as LLM | OpenAI-compatible API，国内访问稳定 |
| 2026-03-14 | Architecture pivot to local-first Agent Sandbox | 类似 OpenClaw (注: 已于 cloud 化后废弃, 见 spec 037 — 现 library 托管内容 + student 仅存关联/行为) |
| 2026-03-14 | Python package with Typer CLI | `pip install systemedu`, CLI entry point |
| 2026-03-14 | Multi-provider LLM support | 支持 Qwen/Claude/Ollama 等任意 OpenAI-compatible API |
| 2026-03-14 | SQLite for local storage | 本地优先，无需安装数据库服务器 (注: cloud 版本改 PostgreSQL, 本地 SQLite 仅 pytest 用) |
| 2026-03-14 | SKILL.md format | 兼容 OpenClaw，YAML frontmatter + markdown body |
| 2026-03-14 | Pydantic models (no Django ORM) | 核心包不依赖 Django，轻量化 |
