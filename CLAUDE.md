# SystemEdu - Project Guidelines

## Project Overview

SystemEdu 是一款**本地优先的 AI Agent Sandbox 平台**，教育为核心定位，Agent 为底层架构。类似 OpenClaw 模式：本地运行 agent daemon，配置 LLM、MCP server、skills，通过 IM 通信，通过 Hub 共享项目。

面向儿童到青少年（6-18岁）的 AI Agent 驱动项目制学习平台。用户可以从零基础开始参与真实工业级项目，在多 Agent 智能导师系统的引导下，逐步掌握并完成工业级别的项目。

核心技术特色：本地 Agent Runtime、多 LLM provider 支持、MCP 工具集成、Skills 系统、动态知识树 DAG、Mem0 记忆、Hub 项目共享。

## Tech Stack

### Core (`/src/systemedu/`)
- **Language**: Python 3.12+
- **CLI**: Typer + Rich
- **Config**: YAML + Pydantic models
- **Agent Runtime**: LangGraph + LangChain + OpenAI-compatible LLM
- **Memory**: Mem0 (optional, vector+graph hybrid)
- **Storage**: SQLite (local) + SQLAlchemy
- **MCP**: Python MCP SDK (Phase 2)
- **Skills**: SKILL.md format (compatible with OpenClaw)

### LLM Support (multi-provider, OpenAI-compatible API)
- Qwen (DashScope): `qwen-plus`, `qwen-turbo`
- Claude (Anthropic): `claude-sonnet-4-20250514`
- Local (Ollama): `llama3`, etc.
- Any OpenAI-compatible endpoint

### Hub Server (`/hub-server/`, Phase 4)
- Django 6 + DRF (reused from legacy backend)
- Project registry, auth, reviews

### Web UI (`/web/`, optional)
- Next.js 16 + TypeScript (reused from legacy frontend)

### Legacy (being migrated)
- `/backend/` — Django backend (agents migrated to `src/systemedu/agents/`)
- `/adminsite/` — Admin service (will become hub-server)
- `/frontend/` — Next.js frontend (will become `web/`)

## Project Structure

```
systemedu/
├── CLAUDE.md
├── pyproject.toml              # Python package, CLI entry point
├── src/systemedu/              # Main package
│   ├── cli/                    # CLI commands (typer)
│   │   ├── main.py             # Entry point: `systemedu`
│   │   ├── agent.py            # systemedu agent start/stop/status
│   │   ├── project.py          # systemedu project init/list/info
│   │   ├── config_cmd.py       # systemedu config show/set/get/edit
│   │   ├── mcp.py              # systemedu mcp add/list/remove
│   │   ├── skill.py            # systemedu skill list/add/remove
│   │   └── channel.py          # systemedu channel list/add/remove
│   ├── core/                   # Agent runtime core
│   │   ├── config.py           # Config loading (Pydantic + YAML)
│   │   ├── runtime.py          # Agent runtime (msg → LLM → tools → response)
│   │   ├── llm_client.py       # Multi-provider LLM client
│   │   ├── tool_executor.py    # Tool execution (bash, file read/write)
│   │   ├── session.py          # Session management
│   │   └── sandbox.py          # Process-level sandbox
│   ├── agents/                 # Agent definitions
│   │   ├── base.py             # BaseAgent abstract class
│   │   ├── manager.py          # Agent instance management
│   │   └── builtin/            # Built-in agents
│   │       ├── tutor.py        # AI 导师
│   │       ├── planner.py      # 知识树生成
│   │       └── assessor.py     # 知识评估
│   ├── channels/               # Communication channels
│   │   ├── base.py             # Channel abstract interface
│   │   ├── registry.py         # Channel registry
│   │   ├── cli_channel.py      # Terminal interaction
│   │   └── web_channel.py      # WebSocket (Phase 5)
│   ├── education/              # Education layer
│   │   ├── models.py           # Pydantic models (Project, KnowledgeNode, etc.)
│   │   ├── services.py         # Knowledge tree validation/import
│   │   ├── progress.py         # Learning progress tracking
│   │   └── tree_generator.py   # AI knowledge tree generation
│   ├── mcp/                    # MCP server management (Phase 2)
│   ├── skills/                 # Skills system
│   │   ├── loader.py           # SKILL.md parser, hierarchical loading
│   │   ├── registry.py         # Skill registry
│   │   └── builtin/            # Built-in skills (SKILL.md files)
│   ├── memory/                 # Mem0 memory client
│   ├── hub/                    # Hub client (Phase 4)
│   └── storage/                # Local SQLite storage
│       ├── db.py               # SQLAlchemy models
│       └── files.py            # Project file operations
├── projects/                   # Example projects
│   └── train-ai-model/
│       ├── project.yaml
│       └── knowledge_tree.json
├── tests/                      # pytest test suite
├── scripts/                    # Utility scripts (restart.sh, etc.)
├── backend/                    # Legacy Django backend
├── frontend/                   # Legacy Next.js frontend
├── adminsite/                  # Legacy admin service
└── prd/                        # Product Requirements Documents
```

## Common Commands

### Restart (Backend + Frontend)
```bash
./scripts/restart.sh
```
Kills existing processes on ports 18820 (backend) and 3000 (frontend), then starts both.

- Backend: `source .venv/bin/activate && python -m systemedu.gateway.server` (port 18820)
- Frontend: `cd web && npm run dev` (port 3000)
- Note: 本机有 HTTP proxy (`http_proxy=http://127.0.0.1:7890`)，curl 测试时需加 `--noproxy '*'`

### Run Tests
```bash
source .venv/bin/activate && python -m pytest tests/ -v
```

## Development Rules

### Git Workflow
- **Every code change must be committed** after the request is completed
- Commit messages follow conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Never force push or amend unless explicitly asked

### PRD Workflow
- `prd/prd.md` is the master PRD — always keep it updated
- **每次完成新功能后，必须同步更新对应的 PRD 文件**（与代码提交同等重要）
- PRD 目录结构：
  - `prd/prd.md` — 总纲，Phase 进度、架构、API 总览
  - `prd/frontend/` — Next.js Web UI 页面级 PRD
  - `prd/backend/` — Gateway API + 核心服务（已从 Django 迁移到 Starlette + Pydantic）
  - `prd/adminsite/` — Hub 管理后台（Phase 4，暂冻结）
- **Ask for user approval before creating any new PRD file**
- Never create separate change-description files; always update existing PRD files
- PRD 更新检查清单：
  1. `prd/prd.md` Phase checklist 打勾
  2. Gateway API Endpoints 表格补全
  3. 对应模块 PRD 文件更新功能描述

### Code Standards
- Python: PEP 8, type hints, async where appropriate
- Config: Pydantic models for all configuration
- Agents: BaseAgent subclass with `process()` method
- Education: Pydantic models (no Django ORM in core package)
- No over-engineering: build what's needed now, not what might be needed later
- **禁止使用 emoji**：所有代码、prompt、UI 文案、PRD 中不使用任何 emoji 符号（包括 ✓✗★♥ 等 Unicode 符号）。反馈用纯文字或 SVG 图形表达。

### Object 渲染质量标准（强制）

本项目对教育游戏 Object 的视觉质量有明确的高标准要求。所有进入 ObjectRegistry 的 object，无论是手写还是 LLM/ObjectFactory 生成，都必须达到以下标准：

**渲染架构：必须使用 `defs_svg` + `body_svg` 路径**
- 禁止使用纯 shapes 列表（`RectShape`/`EllipseShape` 堆叠）作为最终产物进入 Registry
- shapes pipeline 仅用于 LLM 候选阶段（staging），通过 validator 后必须升级为 body_svg
- `defs_svg`：SVG `<defs>` 内容，包含渐变、滤镜、clipPath
- `body_svg`：完整场景 SVG 字符串，直接注入 `#scene-group`

**几何质量：必须使用有机曲线**
- 禁止用矩形叠矩形（"积木人"/"乐高块"风格）来表示人体、生物等有机形态
- 人形/生物类：必须用 cubic bezier 路径（`C`/`S` 命令）做头型（下颌收窄）、四肢（锥形渐细）、耳朵（C 型曲线）
- 机械/建筑类：允许直线+弯角，但轮廓边必须有倒角或曲线过渡，不能是纯矩形
- 无机/科学图示类（细胞、原子、地球）：轮廓可用椭圆，但内部结构必须区分层次

**色彩质量：必须使用渐变 + 多层阴影**
- 禁止单色平涂（`fill="#FFCC80"` 无渐变）
- 所有主要部件必须有至少 2 层颜色（基色 + 高光 or 基色 + 阴影）
- 皮肤/有机材质：使用 3 层暖色系（高光 `#F5C8A0` / 中调 `#E0956A` / 暖影 `#A85C30`），禁止灰调阴影
- 金属/机械材质：使用线性渐变模拟反光（亮面 / 中调 / 暗边）
- 发光/能量材质（电子、火焰、内核）：使用径向渐变 + 外发光滤镜（`<feGaussianBlur>`）

**信息密度：物体必须填满 viewBox**
- 主体元素应占 viewBox 面积的 60% 以上，不允许大片空白
- 每个 labelable 部件必须在视觉上清晰可辨（大小足够、颜色有区分度）
- anchor 点坐标必须精确落在对应部件的视觉中心，误差 < 5% viewBox

**ObjectFactory（C pipeline）生成标准**
- 当前 `CandidateGenerator` 的 Step 2（LLM 输出 shapes JSON）仅产生 staging 候选，不能直接进入 Registry
- 目标架构（方案 A）：Step 2 改为 LLM 输出 Python `build()` 函数代码，遵循现有手写 object 的模板风格（defs_svg + body_svg + 贝塞尔曲线 + 渐变）
- 在方案 A 实现前：LLM 生成的候选必须经过人工或 Claude 审核升级后才能 promote 到 Registry
- 任何人说"先用简单形状 fallback 一下"，必须拒绝，正确做法是保持 MissQueue/fallback 到已有高质量 object

**验收检查清单（新 object 进入 Registry 前）**
1. `ObjectRegistry.build(key)` 返回 `body_svg` 非空，`shapes` 为空列表
2. 在浏览器中渲染，主体充满 viewBox，无大片空白
3. 至少有 2 种颜色层次（渐变或阴影）
4. anchor 点落在对应部件上（不在空白处）
5. `python -m pytest tests/ -v` 全部通过

### Development Loop (必须遵循)
每个功能的开发必须严格按照以下循环执行：

```
1. 开发新功能 → 2. 编写测试 → 3. 运行测试并修复 bug
→ 4. 提交代码 → 5. 回顾：审视现有系统，思考是否有新功能/改进可以添加
→ 6. 向用户提出建议并询问确认 → 7. 用户确认后更新 PRD → 8. 继续下一轮开发
```

**第 5-6 步（回顾与建议）是强制步骤，不可跳过。**

### Feature Backlog (`todolist.md`)
- 项目根目录的 `todolist.md` 是功能待办追踪文件
- 每轮回顾建议中，用户确认保留的条目追加到此文件

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
| 2026-03-14 | Architecture pivot to local-first Agent Sandbox | 类似 OpenClaw，本地运行 agent，Hub 共享项目 |
| 2026-03-14 | Python package with Typer CLI | `pip install systemedu`, CLI entry point |
| 2026-03-14 | Multi-provider LLM support | 支持 Qwen/Claude/Ollama 等任意 OpenAI-compatible API |
| 2026-03-14 | SQLite for local storage | 本地优先，无需安装数据库服务器 |
| 2026-03-14 | SKILL.md format | 兼容 OpenClaw，YAML frontmatter + markdown body |
| 2026-03-14 | Pydantic models (no Django ORM) | 核心包不依赖 Django，轻量化 |
| 2026-03-21 | Object 渲染使用 defs_svg + body_svg 架构 | LLM shapes pipeline 仅用于 staging，最终产物必须是原始 SVG + 渐变 + 贝塞尔曲线 |
| 2026-03-21 | ObjectFactory C pipeline 目标架构为方案 A（LLM 生成 Python build() 代码） | 保证新生成 object 与手写 object 质量一致，禁止积木人风格进入 Registry |
