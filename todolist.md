# SystemEdu - Feature Backlog

> 功能待办追踪。每轮开发回顾中用户确认保留的建议记录在此。
> 开始开发前先在 PRD 中补充详细设计。

## Phase 1: Core Runtime (MVP) ✅

- [x] Python 包骨架 + pyproject.toml
- [x] 配置系统 (config.yaml + env var 展开)
- [x] 多 provider LLM client
- [x] Agent runtime (消息 → LLM → tool calls → 响应)
- [x] CLI 命令 (init/chat/config/project/mcp/skill/channel)
- [x] CLI channel (终端交互)
- [x] 内置 tools (bash/file read/write)
- [x] SQLite 本地存储
- [x] 教育层 Pydantic 模型
- [x] 知识树验证/导入 (DAG 检测)
- [x] 进度追踪
- [x] Skills 系统 (SKILL.md 解析)
- [x] 内置 agents (tutor/planner/assessor)
- [x] 示例项目 (train-ai-model)
- [x] 测试 (63 pass)

## Phase 1.5: UX 重构 (Install → Onboard → Daemon → Dashboard) ✅

- [x] `systemedu onboard` 交互式引导 (LLM 选择 + API key + 连接测试)
- [x] Daemon 进程管理 (PID 文件, start/stop/status)
- [x] Gateway HTTP + WebSocket 服务 (starlette + uvicorn, localhost:18820)
- [x] Dashboard 单页应用 (Vue 3 + Tailwind, Chat/Status/Sessions/Config)
- [x] `systemedu doctor` 诊断检查 (8 项)
- [x] `systemedu status` 系统状态面板
- [x] `systemedu dashboard` 自动启动 daemon + 打开浏览器
- [x] `install.sh` 一键安装脚本
- [x] GatewayConfig 配置 + save_config 助手函数
- [x] 测试 (84 pass, +21 new)

## UX 增强 (待开发)

- [ ] `systemedu chat` 通过 Gateway WebSocket 路由 — 所有对话在 dashboard 可见
- [ ] 系统服务安装 — `systemedu agent install` 支持 systemd/launchd 开机自启
- [ ] Dashboard 多 Session 切换 — 选择/恢复历史会话
- [ ] Gateway `/health` 端点 — 轻量健康检查供监控使用
- [ ] `systemedu logs` 命令 — 实时查看 daemon 日志 (类似 `tail -f`)

## Phase 2: MCP + Skills 增强 ✅

- [x] MCP client (stdio transport, 官方 MCP SDK, `mcp/client.py`)
- [x] MCP manager (server 启停, qualified tool naming `server__tool`)
- [x] MCP tool → OpenAI function calling 注入 (lazy setup, `_extra_schemas`)
- [x] Skills 内容注入 agent system prompt (`--agent tutor` 自动加载)
- [x] 沙箱文件系统访问控制 (`check_file_access` 接入 ToolExecutor)
- [x] LangGraph 完整状态机 (retrieve_memory → agent → execute_tools → store_memory)
- [x] 测试 (114 pass, +30 new)

## Runtime 增强 (待开发)

- [ ] Daemon/chat 启动时自动连接 config.yaml 中已配置的 MCP servers — 当前 `mcp add` 写入配置后 runtime 不会读取并 connect
- [ ] `stream_message` 使用 LangGraph streaming — 当前 streaming 模式不走 graph，无法使用 tools
- [ ] Memory 系统实现 — `systemedu.memory.client.get_memory_client()` 连接 Mem0，LangGraph 节点已就绪
- [ ] Gateway `/api/chat` 适配 LangGraph — 传 `user_id` 参数
- [ ] `systemedu mcp test <name>` — MCP server 连接测试命令

## Phase 3: 教育层完善

- [ ] 知识树加载到 agent 上下文
- [ ] 节点完成自动更新进度 (通过 tool call)
- [ ] AI 知识树端到端生成
- [ ] project.yaml 完整加载
- [ ] `systemedu chat --agent tutor --project <name>` 完整流程

## Phase 4: Hub

- [ ] 项目打包/解包 (tar.gz)
- [ ] Hub 客户端 CLI (login/search/pull/push)
- [ ] Hub 后端 API (Django 改造)
- [ ] Hub 认证 (JWT)

## Phase 5: Channels + Web

- [ ] Web channel (WebSocket)
- [ ] Web UI (复用 frontend)
- [ ] IM 渠道 (WeChat/Telegram)

## 教育功能 (持续)

- [ ] 生成后可视化节点编辑器
- [ ] 知识树模板库
- [ ] 多轮迭代优化 (AI 增量调整)
- [ ] XP/成就系统本地化
- [ ] 家长报告
