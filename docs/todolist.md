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
- [ ] 练习题难度自适应 — 根据用户历史成绩动态调整下次生成的练习难度
- [ ] 错题本功能 — 收集用户答错的题目，支持集中复习
- [ ] 练习完成与节点通过联动 — 练习达到及格分后自动推进学习进度
- [ ] 批量重新生成 — 支持只重新生成 practice 部分，无需重新生成整个课程
- [ ] Loading 深色模式适配 — SVG 火箭/描边颜色跟随 CSS 变量，dark mode 下更清晰
- [ ] 列表页骨架屏 (Skeleton) — 项目/会话/技能等列表页加入 skeleton placeholder，展示即将加载的内容结构
- [ ] Loading 超时提示 — 加载超过 5 秒后显示"加载时间较长，请检查网络"提示
- [ ] purpleair-airquality-node 30 节 assignment.md / audio_scripts.json 是 spec 034 改造前 LLM 自动跑出, 质量未人工 review。下次 v0.5.0 升级时由 Claude 按新规范 (SKILL.md Step 6.5 / 6.6) 手写覆盖
- [ ] purpleair-airquality-node M01-M30 slides.json (老师讲课 slide) Claude 手写补完 — Batch B 滚动 (spec 034)

## Tutor 质量改进 (2026-06-05 L3 质量评估发现)

- [ ] **tutor 苏格拉底引导**: L3 实测合规率仅 20% (门槛 80%)，tutor 偏"先给结论再讲授"。调 tutor skill prompt：遇学生错误概念先用引导性问题，不直接否定/给答案。改后用 `pytest tests/student/quality/ --quality` + Claude judge 重测验合规率
- [ ] **修 Mem0Adapter import bug**: `core/tutor/tools/memory.py:54` import `Mem0Adapter` 但实际类名是 `Mem0AsyncAdapter`，search_memory 永久 ImportError 退化，L4 语义召回从未生效。已有测试 `test_search_memory_import_error` 锁住现状，修复后改断言
- [ ] **记忆召回端到端验证**: L3 发现 recalled_facts 单对话内恒空 (fact 抽取走 5min worker，不实时入库)。补一个"对话→等 worker 抽取→新 session 召回"的 L3 场景，验证跨 session 记忆链路；评估是否需要实时抽取路径
