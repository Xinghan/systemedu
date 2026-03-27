# SystemEdu - Master Product Requirements Document

## 1. Product Vision

**SystemEdu** 是一款**本地优先的 AI Agent Sandbox 平台**，教育为核心定位，Agent 为底层架构。

类似 OpenClaw 模式：本地运行 agent daemon，配置 LLM、MCP server、skills，通过 IM 通信，通过 Hub 共享项目。面向儿童到青少年（6-18 岁），让零基础用户直接参与真实工业级项目，在 AI 导师引导下完成学习。

**核心差异化**：
- 本地优先：agent 在本地运行，数据存本地 SQLite
- 多 LLM：支持 Qwen/Claude/Ollama 等任意 OpenAI-compatible 端点
- MCP 集成：通过 MCP server 扩展工具能力
- Skills 系统：SKILL.md 格式，兼容 OpenClaw
- Hub 共享：项目通过 Hub 发布/下载
- 教育一等公民：知识树 DAG、进度追踪、AI 导师内置

## 2. Target Users

| 用户群 | 年龄 | 特征 |
|--------|------|------|
| **Primary** | 6-12岁 (儿童) | 零专业基础，需极强引导和可视化 |
| **Primary** | 13-18岁 (青少年) | 有一定基础，追求成就感 |
| **Secondary** | 家长 | 关注学习进度、安全性 |
| **Secondary** | 内容创作者 | 创建和发布项目到 Hub |
| **New** | 通用 Agent 用户 | 使用 SystemEdu 作为通用 agent sandbox |

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     用户交互层                                │
│  CLI (systemedu)  │  Dashboard (浏览器) │  IM Channels       │
└────────┬──────────┴────┬────────────────┴───────────────────┘
         │               │
┌────────▼───────────────▼────────────────────────────────────┐
│              Gateway (Starlette + Uvicorn)                    │
│  REST API │ WebSocket (流式对话) │ 静态文件 (Dashboard)        │
│  localhost:18820 │ Daemon 后台进程管理                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   Agent Runtime (Python)                      │
│  LLM 调度 │ Tool 执行 │ MCP 管理 │ Skills 加载器 │ 沙箱隔离   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    教育层 (Education Layer)                   │
│  知识树 DAG │ 学习进度 │ XP/成就 │ AI 导师 │ 学习计划生成      │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    存储层 (Storage)                           │
│  SQLite (本地) │ Mem0 (记忆) │ 文件系统 (项目/skills)         │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Hub (远程, 可选)                            │
│  项目发布/下载 │ 用户账号 │ 评分/分类 │ 搜索/发现              │
└─────────────────────────────────────────────────────────────┘
```

## 4. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **CLI** | Typer + Rich | 命令行交互 |
| **Gateway** | Starlette + Uvicorn | 本地 HTTP + WebSocket 服务 |
| **Dashboard** | Next.js 16 + shadcn/ui + Tailwind | 浏览器管理界面 (替换原 Vue 单文件) |
| **Daemon** | Python 后台进程 (PID 管理) | 长驻服务 |
| **Config** | YAML + Pydantic | 配置管理 |
| **Runtime** | LangGraph + LangChain | Agent 编排 |
| **LLM** | OpenAI-compatible (Qwen/Claude/Ollama) | 多 provider |
| **Tools** | MCP SDK + built-in | 工具执行 |
| **Skills** | SKILL.md format | 提示词管理 |
| **Memory** | Mem0 (optional) | 持久化记忆 |
| **Storage** | SQLite + SQLAlchemy | 本地数据 |
| **Education** | Pydantic models | 知识树/进度 |
| **Hub** | Django 6 + DRF | 项目共享 |
| **Web UI** | Next.js 16 (optional) | 可视化界面 |

## 5. Development Phases

### Phase 1: Core Runtime (MVP) ✅
- [x] Python 包骨架 (`pyproject.toml`, `src/systemedu/`)
- [x] 配置系统 (`config.yaml` 加载, env var 展开)
- [x] 多 provider LLM client
- [x] Agent runtime (消息 → LLM → tool calls → 响应)
- [x] CLI channel (`systemedu chat`)
- [x] 内置 tools (bash/file read/file write)
- [x] Session 管理
- [x] 沙箱 (命令黑名单, 超时)
- [x] SQLite 本地存储
- [x] 教育层 Pydantic 模型 (从 Django ORM 迁移)
- [x] 知识树验证/导入 (DAG 检测, 从 backend 迁移)
- [x] 进度追踪 (初始化, 节点解锁)
- [x] Skills 系统 (SKILL.md 解析, 层级加载)
- [x] 内置 agents (tutor/planner/assessor)
- [x] CLI 命令: init/chat/config/project/mcp/skill/channel
- [x] 示例项目 (train-ai-model)
- [x] 63 个测试全部通过

### Phase 1.5: UX 重构 (Install → Onboard → Daemon → Dashboard) ✅
- [x] `systemedu onboard` 交互式引导 (LLM provider 选择, API key, 连接测试)
- [x] Daemon 后台进程管理 (`core/daemon.py`, PID 文件, SIGTERM 优雅停止)
- [x] Gateway HTTP + WebSocket 服务 (`gateway/server.py`, starlette + uvicorn)
  - REST: `/api/status`, `/api/config`, `/api/sessions`, `/api/sessions/:id`, `/api/chat`
  - WebSocket: `/api/chat/stream` (流式对话)
  - 静态文件: Dashboard 单页应用
- [x] Dashboard 浏览器界面 (初始: `gateway/static/index.html` Vue 3, 后迁移到 `web/` Next.js 16)
  - Chat (WebSocket 流式), Status, Sessions, Config 四个页面
- [x] `systemedu doctor` 诊断检查 (Python/Config/LLM/Daemon/Gateway/DB 共 8 项)
- [x] `systemedu status` 系统状态面板 (Rich Panel)
- [x] `systemedu dashboard` 自动启动 daemon + 打开浏览器
- [x] `install.sh` 一键安装脚本 (pipx/uv/pip + onboard)
- [x] `GatewayConfig` (port/host) 加入配置系统
- [x] `save_config()` 辅助函数
- [x] 84 个测试全部通过 (+21 新增)

### Phase 2: MCP + Skills + 沙箱增强 ✅
- [x] MCP client (stdio transport, 官方 MCP SDK)
- [x] MCP manager (server 启停, qualified tool naming `server__tool`, tool 注入到 LLM)
- [x] Skills 内容注入 agent system prompt (`--agent tutor` 自动加载 tutor SKILL.md)
- [x] 沙箱增强 (文件访问控制 `check_file_access` 真正接入 ToolExecutor)
- [x] LangGraph 状态机 (retrieve_memory → agent → execute_tools → store_memory)
- [x] MCP tools 自动注册到 ToolExecutor (lazy setup)
- [x] `_extra_schemas` 支持动态 tool 注册
- [x] `process_message` 支持 `user_id` 参数
- [x] 114 个测试全部通过 (+30 新增)

### Phase 3: 教育层 + Web UI (进行中)

#### 3a: Web UI 基础 ✅
- [x] Next.js 16 + TypeScript + shadcn/ui + Tailwind 前端 (`web/`)
- [x] Gateway API 扩展：项目列表、项目详情、Agent 列表、Skills 列表、MCP 管理
- [x] `systemedu agent start` 自动启动 web frontend
- [x] 可插拔 Agent Backend (LangGraph / DeepAgents ABC 抽象)
- [x] 知识树可视化 (React Flow + 自定义节点, 暗色主题适配)

#### 3b: 项目 + 知识树管理 ✅
- [x] project.yaml 加载 (`ProjectLoader`, `find_project_dir`)
- [x] 知识树加载到 agent 上下文
- [x] `POST /api/projects` 创建项目 (上传 JSON → 磁盘写入 project.yaml + knowledge_tree.json)
- [x] `POST /api/projects/preview-tree` 预览/验证知识树 (支持 tree_leaf + milestones 双格式)
- [x] `POST /api/projects/generate-tree` AI 生成知识树 (PlannerAgent → milestones JSON)
- [x] Web 新建项目页：上传 JSON / AI 生成二选一 → 预览 → 确认创建

#### 3c: 学习进度 + 注册 ✅
- [x] 节点完成自动更新进度 (`PATCH /api/projects/{name}/nodes/{id}/progress`)
- [x] 前置节点解锁逻辑 (prerequisite_indices DAG)
- [x] 项目注册 (enroll / enrollment CRUD)
- [x] 全部节点通过 → enrollment 自动标记 completed
- [x] 学习侧边栏 (知识树 + 进度 + 节点状态)

#### 3d: 课程内容生成 ✅
- [x] 3-Agent 课程流水线：LessonPlannerAgent → TeacherAgent → StudentAgent
- [x] 课程缓存 (DB 持久化, 避免重复生成)
- [x] 课程内容分页 (自动拆分长内容, 每页 ≤ 3000 字符)
- [x] 结构化课程模板 (step-by-step, comparison, 表格等)
- [x] Minecraft 风格加载画面
- [x] 内容 Tab：概念 / 举例 / 应用

#### 3e: 交互实验模块 ✅
- [x] 交互实验流水线：LessonPlanner → LabAnalyst → LabDesigner → LabCoder → LabReviewer
- [x] 6 种交互类型：drag_classify, click_select, drag_sort, connect_match, cause_effect, animated_story
- [x] animated_story：anime.js + SVG 时间轴动画，概念性节点兜底模式
- [x] Lab HTML 在 iframe 沙箱中运行
- [x] LabReviewer 自动审查/修复生成的 HTML
- [x] Agent 决策追踪日志 (decision tracing)
- [x] LessonPlannerAgent：在课程生成前制定整体教学策略 (interaction_type 选择依据)

#### 3f: 练习 + AI 批改 ✅
- [x] 结构化练习题生成 (exercises JSON)
- [x] `POST /api/projects/{name}/nodes/{id}/practice/submit` AI 批改
- [x] 练习提交历史 (`GET .../practice/submissions`)
- [x] Tutor Agent 注入练习上下文用于答疑

#### 3g: 文本划线 + 高亮 ✅
- [x] 文本选中 → 高亮 + 备注
- [x] 高亮颜色选择, 高亮 CRUD API
- [x] 按页分组存储高亮

#### 3i: 知识树编辑 + 导航 ✅
- [x] D3.js 知识树可视化 (替换 React Flow)，支持 pan/zoom
- [x] 知识树 minimap（右上角缩略图导航器，实时显示视口位置）
- [x] 右键菜单节点编辑：编辑标题/描述/难度/时间/XP、添加新节点、删除节点
- [x] `PUT /api/projects/{name}/tree` — 全量更新知识树 JSON
- [x] 节点编辑后自动持久化到磁盘

#### 3j: 学习页 UX 优化 ✅
- [x] 课程内容两栏布局：左侧 prose + 右侧 sidebar（节点概览 + 下一步）
- [x] 完成节点后展示"下一步可学节点"列表（基于 DAG prerequisite 计算）
- [x] 笔记 FAB（amber 圆形按钮，右下角固定）+ AI chatbot FAB（右下角）
- [x] 底部导航：上一节 / 下一节（独立 bar，不与 FAB 重叠）
- [x] 移除内容分页，全文连续滚动展示

#### 3h: 待完成
- [ ] XP / 成就 / 等级系统
- [ ] `systemedu chat --agent tutor --project <name>` (CLI 端项目模式)

### Phase 4: Hub
- [ ] 项目打包/解包 (tar.gz)
- [ ] Hub 客户端 (push/pull/search)
- [ ] Hub 后端 (Django 改造)
- [ ] Hub 认证

### Phase 5: Channels
- [ ] Channel 完整实现
- [ ] Web channel (WebSocket)
- [ ] IM 渠道 (WeChat/Telegram)

## 6. Configuration

### Global Config: `~/.systemedu/config.yaml`
```yaml
llm:
  default: qwen
  providers:
    qwen:
      base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
      api_key: ${DASHSCOPE_API_KEY}
      model: qwen3-max
sandbox:
  enabled: true
  blocked_commands: ["rm -rf /"]
  max_execution_time: 300
gateway:
  port: 18820
  host: 127.0.0.1
mcp:
  servers: {}
channels:
  cli: { enabled: true }
  web: { enabled: false }
hub:
  url: https://hub.systemedu.com
memory:
  enabled: true
  backend: mem0
```

### Gateway API Endpoints

**系统**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | 系统状态 (版本, uptime, LLM, 会话数) |
| GET | `/api/config` | 当前配置 (API key 脱敏) |
| PUT | `/api/config` | 更新配置 |
| GET | `/api/sessions` | 会话列表 |
| GET | `/api/sessions/full` | 会话列表 (含完整消息) |
| GET | `/api/sessions/:id` | 会话详情 |
| POST | `/api/chat` | 发送消息 (同步) |
| WS | `/api/chat/stream` | 流式对话 WebSocket |
| GET | `/api/agents` | Agent 列表 |
| GET | `/api/skills` | Skills 列表 |
| GET | `/api/mcp/servers` | MCP server 列表 |
| POST | `/api/mcp/servers` | 添加 MCP server |
| DELETE | `/api/mcp/servers/:name` | 删除 MCP server |

**项目**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 |
| POST | `/api/projects/preview-tree` | 预览/验证知识树 |
| POST | `/api/projects/generate-tree` | AI 生成知识树 |
| GET | `/api/projects/:name` | 项目详情 (含知识树 + 进度 + 注册) |
| PUT | `/api/projects/:name/tree` | 全量更新知识树 JSON |
| POST | `/api/projects/:name/enroll` | 注册学习 |
| GET | `/api/projects/:name/enrollment` | 获取注册信息 |
| PATCH | `/api/projects/:name/enrollment` | 更新注册 (暂停/恢复/加时) |

**节点学习**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:name/nodes/:id/context` | 节点上下文 (前置链 + 建议) |
| GET | `/api/projects/:name/nodes/:id/lesson` | 获取课程内容 |
| POST | `/api/projects/:name/nodes/:id/lesson/generate` | 生成/重新生成课程 |
| GET | `/api/projects/:name/nodes/:id/lesson/progress` | 课程进度 |
| PATCH | `/api/projects/:name/nodes/:id/progress` | 更新节点状态 |
| GET | `/api/projects/:name/nodes/:id/highlights` | 获取高亮 |
| POST | `/api/projects/:name/nodes/:id/highlights` | 创建高亮 |
| DELETE | `/api/projects/:name/nodes/:id/highlights/:hid` | 删除高亮 |
| POST | `/api/projects/:name/nodes/:id/practice/submit` | 提交练习 (AI 批改) |
| GET | `/api/projects/:name/nodes/:id/practice/submissions` | 练习提交历史 |

### Project Config: `<project>/project.yaml`
```yaml
name: train-ai-model
version: "1.0.0"
title: 训练AI模型
category: ai
age_range: [10, 18]
agents:
  tutor:
    type: builtin:tutor
    llm: qwen
knowledge_tree: ./knowledge_tree.json
```

## 7. CLI Commands

```bash
# 安装与初始化
curl -fsSL https://systemedu.com/install.sh | bash  # 一键安装
systemedu init                       # 初始化 ~/.systemedu/
systemedu onboard                    # 交互式引导 (LLM 选择 + API key + 测试)

# 日常使用
systemedu chat                       # 交互对话
systemedu chat --agent tutor         # 指定 agent
systemedu dashboard                  # 打开浏览器 Dashboard
systemedu status                     # 系统状态
systemedu doctor                     # 诊断检查

# Daemon 管理
systemedu agent start                # 启动后台 daemon (Gateway)
systemedu agent stop                 # 停止 daemon
systemedu agent status               # daemon 状态

# 配置与管理
systemedu config show/set/get/edit   # 配置管理
systemedu project init/list/info     # 项目管理
systemedu mcp add/list/remove        # MCP 管理
systemedu skill list/add/remove      # Skills 管理
systemedu channel list/add/remove    # Channel 管理
systemedu hub login/search/pull/push # Hub 操作 (Phase 4)
```

## 8. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **安全** | 沙箱隔离, 命令黑名单, 文件访问控制 |
| **性能** | AI 对话首 token < 1s |
| **可扩展** | 支持任意 MCP server, 自定义 skills/agents |
| **本地优先** | 所有数据存本地, Hub 可选 |
| **国际化** | 初期中文, 架构支持多语言 |
