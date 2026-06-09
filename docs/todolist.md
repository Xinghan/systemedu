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
- [ ] **老师讲课 slides 音频文件生成 + 接入播放** (2026-06-06): slides 链路已通 (spec 2026-06-06-teacher-slides-playback), 前端音频是占位 (禁用"音频生成中")。待生成各 slide 的 audio_script 配音文件 (TTS), 约定路径放 media, 前端 TeacherSceneView 接 `<audio>` 启用播放。用户单独处理音频生成

## Tutor 质量改进 (2026-06-05 L3 质量评估发现)

- [x] **tutor 苏格拉底引导** (2026-06-05 已修): 根因是 router 把"X是不是越…越好?""能不能直接…?"等隐含错误前提的验证句误判为事实问题→direct-instruction 讲授。改 ROUTER_PROMPT 规则 4a (误区句最高优先 socratic) + 修 continue 无 active_skill 空回复 bug。L3 复测合规率 20%→~100% 达标 (quality_report_2026-06-05b.md)。残留: qwen 路由偶发波动
- [ ] **router 误区判别确定性兜底**: qwen3.6-flash 对误区句路由仍偶发波动 (判 direct 而非 socratic)。考虑对"命中 knode 误区锚点 + 验证句式"的输入加非 LLM 的确定性兜底，或升级系统 LLM 降波动
- [x] **修 Mem0Adapter import bug** (2026-06-05 已修, commit 42f83153): `core/tutor/tools/memory.py` import 改 `Mem0AsyncAdapter`，`.enabled` 检查改 `get_config().memory.enabled`，测试同步更新。真实运行验证 search_memory 不再恒 ImportError，Mem0 召回链路打通。注：打通后暴露独立配置问题 `embedding-3 model not found`，待 embedding 模型配置修正
- [x] **记忆召回端到端验证** (2026-06-05 已验): test_memory_recall_e2e.py 确定性验证完整链路 (对话→enqueue→extract_session 抽取入库→新 session injector 召回)。结论: 跨 session 召回正常工作；对话当下 recalled_facts 为空是**异步抽取的设计时序** (worker 跑完才入库)，非 bug。含 user 隔离 + 抽取前为空两个对照用例

## 高亮深入学习 后续 (2026-06-08 shipped)

- [ ] "用户询问"回顾列表: 已落 ChatMessage.source=highlight_ask (spec 2026-06-08-highlight-deep-learn)。可做一个聚合视图 (按 source 筛选), 展示学生在课文里问过的所有问题, 供学生回顾 / 老师端分析高频疑问点

## 知识钻取 后续 (2026-06-09 shipped)

- [ ] 钻取弹窗"转问 AI 导师"联动 (A2): 弹窗底部按钮把该知识点丢给 chatbot 苏格拉底引导 (复用 highlight-ask pendingAsk)
- [ ] 钻取"重新生成" (A3): 对已存钻取不满意可重新调 LLM
- [ ] 全局"我的钻取"列表: 跨 knode 汇总用户所有钻取记录, 独立页面供回顾
