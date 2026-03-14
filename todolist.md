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

## Phase 2: MCP + Skills 增强

- [ ] MCP server 生命周期管理 (start/stop/connect)
- [ ] MCP tool → OpenAI function calling 注入
- [ ] Skills 内容注入 agent system prompt
- [ ] 沙箱文件系统访问控制 (allowed_dirs)
- [ ] LangGraph 完整状态机 (retrieve_memory → agent → store_memory)

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
