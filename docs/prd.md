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
│  知识树 DAG │ 学习进度 │ 升级路线/勋章 │ AI 导师 │ 课程工厂  │
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

#### 3d: 课程内容生成 v1 ✅ (已被 v2 取代)
- [x] 3-Agent 课程流水线：LessonPlannerAgent → TeacherAgent → StudentAgent
- [x] 课程缓存 (DB 持久化, 避免重复生成)
- [x] 课程内容分页 (自动拆分长内容, 每页 ≤ 3000 字符)
- [x] 结构化课程模板 (step-by-step, comparison, 表格等)
- [x] Minecraft 风格加载画面
- [x] 内容 Tab：概念 / 举例 / 应用

#### 3e: 交互实验模块 v1 ✅ (已被 v2 取代)
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

#### 3k: 课程生成 v2 Pipeline ✅
完全重写课程生成系统，从单一文本输出升级为多媒体富文本学习体验。

**核心架构**: `lesson_generator.py` 的 `generate_course_v2()` 7步流水线

- [x] **Step 1 - CoursePlannerAgent**: 生成 800-1500 字详细学习计划 (Markdown)，<1600字时自动触发扩写
- [x] **Step 2 - CourseIdeaAgent**: 识别 3-6 个富媒体知识点，分配媒体模式 (animation/game/story)，在 plan_markdown 中插入 `[[IDEA:uuid]]` 占位符
- [x] **Step 3 - CourseIdeaDetailAgent** (并行): 3节点质量管道
  - CourseIdeaDetailPlannerAgent → detail_plan JSON（帧序列/游戏规格/故事段落）
  - CourseIdeaDetailCriticAgent → 评分 (complexity_score + persuasion_score)
  - CourseIdeaDetailSimplifierAgent → 简化/fallback
- [x] **Step 4 - 媒体生成** (并行):
  - AnimationGenAgent → SVG+CSS HTML 动画，支持 Manim 数学动画后端路由
  - GameGenAgent → 模拟实验交互 HTML（固定 simulation 机制）
  - StoryGenAgent → 图文故事（DashScope Wanx 图片生成，串行避免速率限制）
- [x] **Step 5 - IntegrationAgent**: 整合为 CourseContent JSON（plan_markdown + ideas + rendered_sections）
- [x] **Step 6 - AssignmentAgent**: 生成结构化作业（选择题 x3 / 问答 x2 / 动手项目 x1）
- [x] **Step 6a - CourseSegmentAgent**: 将 plan_markdown 按 `##` 标题拆分为 3-6 个 section，为每段生成口语化 TTS 讲解稿
- [x] **Step 6b - TTS 合成** (并行): DashScope qwen3-tts-flash 生成每段音频
- [x] **Step 7 - DB 保存**: LessonContent 表持久化 CourseContent JSON + 作业内容

**质量保障机制**:
- Critic 双维度评分：complexity_score ≥ 72 且 persuasion_score ≥ 65 方可通过
- 动画 HTML 质量评估：SVG/keyframes/transform/opacity/gradient/postMessage 完备性
- 三级降级策略：LLM生成 → Repair提示修复 → 确定性fallback模板

**媒体风格系统** (3套预定义风格，media_art_direction.py):
- `edu_soft_tech`：蓝色科技感，Noto Sans SC + Nunito
- `concept_lab_clean`：青绿实验室感，Rubik
- `storybook_vivid`：暖色故事书感，Noto Serif SC

#### 3l: 课程 v2 Web UI ✅
- [x] **CourseContentView 完整重写**：编辑级排版，大标题 + 副标题 + 大段落间距
- [x] **GeneratingProgress 生成进度界面**：科技感 SSE 实时进度，含 Agent 日志面板
- [x] **分段音频播放按钮**：每段文字右侧 hover 显示圆形播放按钮，共享 AudioContext 防止并发
- [x] **动画区块**：深色背景 (#000341)，可展开/折叠 iframe
- [x] **游戏区块**：浅色背景，可展开/折叠 iframe
- [x] **故事区块**：图文混排（图片 + 段落），可展开/折叠
- [x] **作业区块**：选择题/问答/动手项目，i18n 支持
- [x] **旧数据兼容 fallback**：无 sections 字段时降级展示原 plan_markdown
- [x] **语言切换**：学习页右上角 EN/中 切换按钮（useAppStore locale）

#### 3m: 全站 i18n ✅
- [x] `web/src/lib/i18n.ts` 统一翻译表（EN + ZH）
- [x] `useT()` hook 绑定 useAppStore locale
- [x] GeneratingProgress 所有文案 i18n（生成中/等待中/已完成/高算力 等 35+ 键）
- [x] 流水线阶段名称 i18n：课程规划师 / 创意发散 / 内容设计师 / 媒体工坊 / 练习构建 / 语音合成
- [x] 学习页作业区块 i18n
- [x] 项目列表页、项目详情页、新建项目页全面 i18n

#### 3n: 项目图标库 ✅
- [x] 移除封面图片生成功能（`api_generate_cover_preview`、`api_generate_project_cover` 已删除）
- [x] 移除 LLM 生成项目 SVG 图标（质量不稳定）
- [x] `web/src/lib/icon-library.json`：71 个 Tabler Icons（MIT）理工科图标，含数学/物理/化学/生物/CS/航天/机器人/能源
- [x] `web/src/lib/project-icon.ts`：`findProjectIcon()` 本地查询（类别优先列表 + 文本评分 + 品牌色 #7c3aed）
- [x] ProjectCard 使用前端图标库，无需后端生成

#### 3o: v5 知识树原生支持 ✅
内部模型原生支持 v5 格式（stages/modules/edges），消除有损转换层。

- [x] **v5 Pydantic 模型**: `Stage`, `Module`, `Edge`, `V5KnowledgeTree` (`models.py`)
- [x] **双向适配器**: `tree_adapter.py` -- `v5_to_milestones_view()` / `milestones_to_v5()` / `sorted_modules()` / `build_module_index_map()`
- [x] **services.py 重写**: `convert_uploaded_tree()` 统一转 v5; `parse_knowledge_tree()` 返回 V5KnowledgeTree; 删除 `_convert_v41_tree()`
- [x] **project_loader.py**: `ProjectContext` 新增 `v5_tree` 字段，`tree` 由 `v5_to_milestones_view()` 派生
- [x] **server.py 适配**: `api_update_tree()` 接收 milestones 格式后转 v5 存盘
- [x] **磁盘存储 v5 格式**: 不再存有损的 milestones 格式，保留 17+ 个 v5 字段
- [x] **前端/DB/progress 无改动**: API 层通过适配器输出 milestones 格式，前端无感知

#### 3p: Course Factory 手册 ✅
`.claude/skills/course_factory/SKILL.md`（即 `course_factory/SKILL.md` symlink）-- 2200+ 行的完整内容创作手册，由 Claude Code 作为 skill 自动加载并按手册执行。

- [x] **Step 0.5 - 联网研究**: `should_research_knode()` 判断 + `research_knode()` Tavily 搜索 (web + YouTube)
- [x] **Step 1 - plan_markdown**: 800-1500 字学习计划，core_question 驱动，对齐 acceptance_standard / hands_on_components
- [x] **Step 2 - Ideas 抽取**: difficulty x module_role 查表决定 animation/game 上限; 10 套视觉主题 (helix_lab/aether_clinic/ares_mission 等)
- [x] **Step 3 - 详细描述**: 每个 idea 撰写 context_summary + mode_reason + hands_on_ref + acceptance_ref
- [x] **Step 4 - Debate 自我质疑**: 强制规则 -- game 本质是选择题时 reject; animation 无动态过程时 reject
- [x] **Step 5 - 实现代码**: HTML animation (shared element transition + getFrameElements + transitionTo) / game (simulation/drag_sort 等 5 种机制) / exercise (选择题)
- [x] **Step 5.5 - Code Review + Browser Verify**: Playwright (`html_validate.mjs`) 自动验证 JS 错误/滚动条/交互元素
- [x] **Step 6 - DB 写入**: `make_course_content()` + `preflight_v41()` 验证 + `_upsert_lesson()` 写入
- [x] **HTML 规范**: 深色主题 100vh, i18n 双语 (cn/en), guide-panel 右上角, DPR-aware Canvas, helix_lab 等视觉系统
- [x] **Step 6.5 - 作业生成**: `generate_assignment()` 普通/capstone 双模式 + `upsert_assignment()` 独立写入
- [x] **Step 6.6 - 讲课稿生成**: `generate_audio_scripts()` 按 section 生成口语化讲解，存入 `sections[].audio_script`
- [x] **工具函数**: `course_factory.py` -- load_knode_context / research_knode / merge_resources_into_plan / make_exercises / preflight_v41 / generate_assignment / generate_audio_scripts

#### 3q: 升级路线 (Career Path) -- Phase 1 数据层 ✅
把松散项目串成有身份感的成长主线（如"成为火箭科学家"需完成多个项目），沿途获得勋章，卡通形象进化。

- [x] **Pydantic 模型**: `CareerPath`, `PathStage`, `PathBadge`, `AvatarStage` (`models.py`)
- [x] **DB 表**: `career_paths` (路线注册), `career_path_progress` (用户进度), `earned_badges` (已获勋章)
- [x] **服务层**: `career_path.py` -- scan_paths / load_path / enroll_path / get_path_progress / recalculate_progress / on_project_completed / get_paths_for_project
- [x] **存储策略**: YAML 定义 (`paths/{name}/path.yaml`) + DB 存进度; 勋章/形象为 SVG 文件
- [x] **进度派生**: 读取 enrollments 表 completed 记录，项目完成时自动触发路线进度重算和勋章发放
- [x] **示例路线**: `paths/rocket-scientist/path.yaml` (4 阶段, 3 形象进化)
- [x] **测试**: 17 个测试全部通过 (scan/load/enroll/progress/badge/hook)
- [ ] **API 端点**: GET/POST /api/career-paths (Phase 2 待实施)
- [ ] **前端页面**: /career-paths 列表 + /career-paths/[name] 详情 (Phase 3 待实施)
- [ ] **勋章/形象 SVG 素材**: 待制作

#### 3r: 大作业提交 + AI 批改 (Capstone Submission)
大作业节点 (module_role=capstone) 的完整提交 -> 批改 -> 反馈闭环。

- [x] **CapstoneSubmission DB 模型**: user_id, project_name, knode_id, attempt, checklist_json, reflections_json, file_url, score, feedback_json, status (submitted/grading/graded)
- [x] **3 个 API 端点**:
  - `POST /api/projects/{name}/nodes/{id}/capstone/submit` — multipart 上传 (文件 + 清单 + 自评说明)
  - `GET /api/projects/{name}/nodes/{id}/capstone/status` — 轮询批改状态
  - `GET /api/projects/{name}/nodes/{id}/capstone/submissions` — 提交历史
- [x] **AI 批改逻辑** (`_grade_capstone_sync`): 后台线程逐条对照 acceptance_standard 评分学生自评说明，LLM 打分 + 反馈，>=60% 为 passed
- [x] **CapstoneSubmissionPanel 前端组件**: 三阶段 UI (填写表单 -> 批改中动画 -> 结果展示)，匹配系统设计语言 (rounded-xl, gradient, font-manrope)
- [x] **AssignmentView 改造**: capstone 节点渲染 block-based 考核指南 (parseCapstoneBlocks) + CapstoneSubmissionPanel

#### 3s: Course Factory Step 6.5/6.6 -- 作业 + 讲课稿生成
Course Factory 手册新增两个必做步骤，补全课程内容的"练习"和"音频"维度。

- [x] **Step 6.5 -- generate_assignment()**: 普通节点生成选择题(3)+问答题(2)+动手项目(1)；capstone 节点生成考核指南+自检清单+自评写作指引。两套 LLM prompt，写入 `project_assignment` 字段
- [x] **Step 6.6 -- generate_audio_scripts()**: 按 ##/### 标题拆分 plan_markdown，每段 LLM 生成 150-300 字口语化讲解稿，写入 `course_content.sections[].audio_script`
- [x] **批量回填**: mars-risk-map 13 个 knode 全部补生成 assignment + audio_script
- [x] **COURSE_FACTORY.md 更新**: 步骤表、产物自检清单、常见遗漏均已更新
- [ ] **TTS 集成**: 讲课稿已存储，待接入 TTS 模型批量生成音频文件

#### 3h: 待完成
- [ ] `systemedu chat --agent tutor --project <name>` (CLI 端项目模式)
- [ ] Quiz 结构化交互（选项点击 + 即时反馈 + AI 批改简答题）
- [ ] 课程 Outline 预览 + 用户确认后再生成（借鉴 OpenMAIC 两阶段）
- [ ] 课中提问 Agent（学习页内嵌聊天面板）
- [ ] ECharts 数据图表支持（数学/物理课程可视化）

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
| GET | `/api/projects/:name/nodes/:id/lesson` | 获取课程内容 (v1) |
| POST | `/api/projects/:name/nodes/:id/lesson/generate` | 生成/重新生成课程 (v1) |
| GET | `/api/projects/:name/nodes/:id/lesson/progress` | 课程进度 |
| PATCH | `/api/projects/:name/nodes/:id/progress` | 更新节点状态 |
| GET | `/api/projects/:name/nodes/:id/highlights` | 获取高亮 |
| POST | `/api/projects/:name/nodes/:id/highlights` | 创建高亮 |
| DELETE | `/api/projects/:name/nodes/:id/highlights/:hid` | 删除高亮 |
| POST | `/api/projects/:name/nodes/:id/practice/submit` | 提交练习 (AI 批改) |
| GET | `/api/projects/:name/nodes/:id/practice/submissions` | 练习提交历史 |
| GET | `/api/projects/:name/nodes/:id/course/v2` | 获取 v2 课程内容 (CourseContent JSON) |
| POST | `/api/projects/:name/nodes/:id/course/v2/generate` | 生成 v2 课程（SSE 流式进度） |
| GET | `/api/media/:path` | 获取生成的媒体文件（TTS 音频等） |
| DELETE | `/api/projects/:name` | 删除项目及关联数据 |
| PATCH | `/api/projects/:name` | 更新项目元数据 (title/description/category 等) |
| POST | `/api/projects/:name/cover` | 上传封面图 |
| GET | `/api/projects/:name/lesson-statuses` | 获取所有节点课程生成状态 |
| GET | `/api/projects/:name/nodes/:id/resources` | 获取节点搜索资源 |
| POST | `/api/projects/:name/nodes/:id/resources/search` | 搜索节点相关资源 |
| PUT | `/api/projects/:name/nodes/:id/note` | 保存/更新用户笔记 |
| GET | `/api/projects/:name/nodes/:id/note` | 获取用户笔记 |

**大作业提交** (Capstone)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/projects/:name/nodes/:id/capstone/submit` | 提交大作业 (multipart: 文件 + 清单 + 自评说明) |
| GET | `/api/projects/:name/nodes/:id/capstone/status` | 查询最新提交的批改状态 (3s 轮询) |
| GET | `/api/projects/:name/nodes/:id/capstone/submissions` | 获取提交历史列表 |

**升级路线** (Career Path, 待实施)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/career-paths` | 升级路线列表（含基本进度） |
| GET | `/api/career-paths/:name` | 路线详情（阶段/进度/勋章/当前形象） |
| POST | `/api/career-paths/:name/enroll` | 开始一条升级路线 |
| GET | `/api/career-paths/:name/badges/:order` | 获取勋章 SVG |
| GET | `/api/career-paths/:name/avatar/:stage` | 获取形象 SVG |
| GET | `/api/badges` | 获取用户所有已获得的勋章 |

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
