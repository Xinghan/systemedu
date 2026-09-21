# SystemEdu - Master Product Requirements Document

## 1. Product Vision

**SystemEdu** 是一款 **cloud 优先的 AI Agent 教育平台**，教育为核心定位，Agent 为底层架构。

课程内容由 library 服务统一托管，学生在浏览器里 pull 项目 (仅在 DB 记一行关联)，学习时实时代理 library 内容；所有学习进度 / 行为 / agent chat 数据存 student-app 的 PostgreSQL。面向儿童到青少年（6-18 岁），让零基础用户直接参与真实工业级项目，在 AI 导师引导下完成学习。(早期为本地优先 OpenClaw 模式，已于 cloud 化后演进，见 spec 037。)

**核心差异化**：
- cloud 优先：内容 library 托管 + 学习时实时代理，用户数据存 PostgreSQL
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

#### 3q: 升级路线 (Career Path) -- Phase 1 数据层 ✅ (deprecated, 见 spec 042)
把松散项目串成有身份感的成长主线（如"成为火箭科学家"需完成多个项目），沿途获得勋章，卡通形象进化。

**注**: 本条是老 `packages/core` (cloud-app 时代) 的 Phase 1 数据层设计，API/前端从未实施，
未迁移到当前主架构 student-app。徽章体系已由 spec 042「先驱者协会」在 student-app 重新
设计并实现（八大分会 + 铜银金大师晋级），见下方 3u。本条保留作历史记录，不再演进。

- [x] **Pydantic 模型**: `CareerPath`, `PathStage`, `PathBadge`, `AvatarStage` (`models.py`)
- [x] **DB 表**: `career_paths` (路线注册), `career_path_progress` (用户进度), `earned_badges` (已获勋章)
- [x] **服务层**: `career_path.py` -- scan_paths / load_path / enroll_path / get_path_progress / recalculate_progress / on_project_completed / get_paths_for_project
- [x] **存储策略**: YAML 定义 (`paths/{name}/path.yaml`) + DB 存进度; 勋章/形象为 SVG 文件
- [x] **进度派生**: 读取 enrollments 表 completed 记录，项目完成时自动触发路线进度重算和勋章发放
- [x] **示例路线**: `paths/rocket-scientist/path.yaml` (4 阶段, 3 形象进化)
- [x] **测试**: 17 个测试全部通过 (scan/load/enroll/progress/badge/hook)
- [ ] **API 端点**: GET/POST /api/career-paths (未实施, 已被 spec 042 取代)
- [ ] **前端页面**: /career-paths 列表 + /career-paths/[name] 详情 (未实施, 已被 spec 042 取代)
- [ ] **勋章/形象 SVG 素材**: 未制作 (spec 042 已有 32 张独立美术资源)

#### 3u: 先驱者协会徽章体系 (spec 042) ✅
student-app 侧全新徽章激励体系: 完成节点掉落徽章, 10 换 1 晋级, 徽章墙展示。世界观「先驱者
协会」下设八大分会对应项目领域, 每分会铜/银/金/大师四级各自独立美术设计 (非同图换色)。

- [x] **世界观**: 生物机所(Biotech)/穹际分会(Aerospace)/绿萌盟(Climate)/机械之心(Robotics)/
  心智工坊(AI)/算境阁(CS)/神经回廊(Neuroscience)/深时秘境(Paleontology) 八大分会
- [x] **掉落规则**: knode 无 difficulty_level 字段, 改用 `knowledge_tree_json` 的 stage 相对
  位置推导 (前半段掉铜/后半段掉银); stage 内最后一个 knode (里程碑收尾) 额外多掉 1 枚
- [x] **DB 表**: `user_badges` (徽章实例, 含 consumed 标记支持合成溯源), `user_knode_badge_drops`
  (掉落去重, 一个 knode 对一用户一辈子只掉落一次)
- [x] **晋级兑换**: 10 枚同色徽章自动合成 1 枚上一级, 支持连续多级合成, master 顶级不可再合成
- [x] **API**: `GET /api/my/badges` 徽章墙; `POST /api/my/knodes/{slug}/{id}/complete` 响应体
  新增 `new_badges` 字段
- [x] **前端**: `BadgeWall.tsx` 接入 `/my-projects` 页面, `KnodeCompleteButton.tsx` 掉落 toast 提示
- [x] **美术资源**: 32 张 (8 分会 x 4 级) AI 生图 + 圆形抠透明处理, 存
  `packages/student-web/public/badges/`, prompt 存档见 `resources/badges/badge_prompts.md`
- [x] **测试**: 15 个测试全部通过 (掉落规则/晋级合成/API 路由)

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

#### 3t: 富媒体类型 #9 -- 3D Object (spec 026) ✅
Course Factory 手册新增第 9 类富媒体，把"可交互 3D 物体解剖 + 2 层下钻"做成正式产物。

- [x] **触发判定** (`should_generate_3d_object`): 命中核心硬件型号 + 解剖类话题 + 非 capstone 才返回 True; course_factory 完全决定, 用户无须标记
- [x] **关键词库**: 30+ 硬件型号 (PMS5003 / Pi Zero / BME280 / sensor / 传感器 / 镜头 / 火箭 / 卫星 等) + 12+ 解剖话题词 (内部结构 / 解剖 / 原理 / 接线 / cutaway / structure / how it works 等)
- [x] **生成集成** (`make_course_content(threed_object_html=...)`): 注入 `mode='3d_object'` idea + rendered_section, `_split_html_assets` 自动拆到 `media/3d_object-<slug>.html`
- [x] **美学闸门 5.5g** (`aesthetic_reviewer_prompt.md`): flipbook 米黄手册风 + toon shading + EdgesGeometry + L0/L1/L2 三层下钻铁律
- [x] **参考实现** (`course_factory/3d_template/object_template.html`): M01 PMS5003 demo 通过 49/50 美学闸门, 1340 行
- [x] **测试**: 9 个单元测试 + M11 PMS5003 端到端集成测试全过

#### 3u: 主题项目线与分层项目库（spec 048，2026-09-20 已发布）

- [x] 项目库首屏提供“太空探索”大领域入口，可直接进入约 3 分钟观测项目，也可查看完整项目线。
- [x] 主导航统一为项目库，页内切换“全部项目 / 项目线”；项目线视图可直接分享、刷新和前后退，旧入口兼容跳转。
- [x] 类型区分短体验、引导小项目、组装挑战与完整工程；筹备节点明确展示规划，不提供虚假启动入口。
- [x] 课程卡片分别展示目标作品、预计时间、原课程工程深度、准备说明及所属项目线。
- [x] 搜索、领域、挑战程度、排序、草稿开关、空态与内容加载重试；内容服务故障时短体验仍可用。
- [x] 导航统一为“项目库”，保留课程详情、故事、已加入状态和项目申请；适配双语及窄屏。
- [x] 10 组项目库浏览器检查与变更文件 ESLint 通过，三分钟项目 7 组检查通过；全量类型检查受现有其他页面错误影响。
- [ ] 真实儿童与家长试用，记录启动卡点、时长及后续项目选择。

#### 3v: 太空探索的着陆、驾驶与规则项目（spec 049，2026-09-20 已发布）

- [x] 新增 2 个三分钟入口：操作制动形成着陆轨迹；驾驶绕行并形成自己的地形照片和路线。
- [x] 新增 1 个十五分钟引导项目：修改驾驶规则，完成两条路线及 unknown 停车测试，导出可运行程序。
- [x] 失败保留、版本重测、作品回看、本机保存与下载；图形中断原地降级，存储异常明确反馈。
- [x] 全部项目与项目线视图统一展示 3 个短入口、1 个引导项目，保留未开放节点的筹备标记。
- [x] 四个可体验项目使用独立生成的插画封面；项目线图片与文案分区，手机、平板、宽屏均检查标题无遮挡。
- [x] 5 项模型测试、9 组互动浏览器检查、10 组项目库回归通过。来源、运行、模型边界和接口写入项目 README，并同步至内容仓库。
- [ ] 儿童时长与启动卡点试用、真实平板/Safari 检查、后续组装接入；当前作品仅保存在本机浏览器。

#### 3w: 主题入口目录与跨线难度分层（spec 050，2026-09-20 已发布）

- [x] 项目线视图改为五个独立主题入口：星际远征队（太空探索）、生命解码局（生物医药）、超能机械师（脑机与仿生）、地球侦探社（地球探秘）、动力发明家（能源与动力）。进入主题详情后才展开具体项目与路线，取代 spec 048/049 中首页直接铺开太空项目的布局。名称强调探索角色，保留具体领域说明与原名称搜索。
- [x] 八门已有完整课程按真实内容归属主题；本地目录快照与服务按 slug 合并，服务状态优先。未接入课程显示“待接入”，不生成无效详情入口。
- [x] 全部项目跨线汇集已有互动与完整课程，默认显示筹备课程，按轻量体验、引导制作、完整工程深度 1–2 / 3 / 4 / 5 分层；发布时间排序保留难度顺序，新增项目线筛选。
- [x] 新增四条主题线的设计契约，各含两个短入口、两个引导项目、一个组装规划，明确作品产出；未实现的规划仅在主题详情展示。
- [x] 四张新增主题封面由图片生成工具生成；图片与文字独立布局；现有太空互动的返回链接指向太空主题详情。
- [x] 12 组浏览器检查、五条内容契约校验及变更文件 ESLint 通过。全量类型检查仍有原有其他页面错误；截图和记录见 `artifacts/themed-library/`。
- [ ] 儿童试用、其他主题互动实现、未接入完整课程的内容发布。

#### 3x: 短项目精细 SVG / 3D 重制（spec 051，2026-09-20 已发布）

- [x] 内容仓 project-line skill 明确短任务不降低视觉质量，增加结构、材质、地形、镜头、SVG 数据绑定、运行截图和性能验收规范。
- [x] 重制着陆器和六轮探测车；增加隔热层、线缆、光学组件、支架/悬挂、胎纹、地表纹理、层状岩石、远景和阴影。近看/环视独立于驾驶，手机仪表避让主体。
- [x] SVG 下降仪表、导航和轨迹绑定真实状态；当前逻辑姿态生成 960×600 车载照片，观察相机不改变作品。作品新增视觉版本，原记录和模型兼容。
- [x] 5 项模型检查、9 组互动回归以及视角/即时拍照/减少动态效果专项检查通过；运行截图与实测见 `artifacts/space-visual-quality/`。低性能时降低动态像素比，静止时恢复清晰度。
- [ ] 真实平板/Safari 与儿童试用。自动化环境为 SwiftShader 软件渲染，性能记录不作为真实设备帧率承诺。

#### 3h: 待完成
- [ ] `systemedu chat --agent tutor --project <name>` (CLI 端项目模式)
- [ ] Quiz 结构化交互（选项点击 + 即时反馈 + AI 批改简答题）
- [ ] 课程 Outline 预览 + 用户确认后再生成（借鉴 OpenMAIC 两阶段）
- [ ] 课中提问 Agent（学习页内嵌聊天面板）
- [ ] ECharts 数据图表支持（数学/物理课程可视化）

#### 3y: 多节点引导课程（spec 052，2026-09-20 已发布）

- [x] 中等及以上改用课程设计；单 HTML 只作节点内实验，技能和校验禁止当作整门课程。
- [x] 五条项目线的 19 个引导/整合项目补充多节点大纲，未生成教材仍标筹备中。
- [x] 驾驶规则制作四个真实学习节点：正文、reference、官方 video、中文任务、实践与交付；累计 50 分钟为设计目标，可分次学习。
- [x] 项目库显示引导课程、学习节点和累计时长；新增浏览器学习记录与实验凭据关联，不冒充掌握评定或账号进度。
- [ ] 儿童试用、正式内容服务导入。账号学习记录在 spec 053 接入并上线。

路由沿用 `/explore/space-exploration/write-driving-rules`，以 `?node=M01…M04` 定位学习节点；没有新增后端 API。静态实验链接兼容保留，课程包采用单独标版的 `guided-course/1` 本地格式。

#### 3z: 学生课堂与作业记录（spec 053，2026-09-20 已发布）

- [x] 登录后的课堂输入、作业、测验和考试类型记录写入 student-app PostgreSQL；按用户、课程、节点、活动和内容版本隔离。
- [x] 草稿自动保存与跨浏览器恢复；每次提交保留不可变快照，幂等重试，双设备版本冲突明确提示。
- [x] 驾驶规则课程、作业选择/问答、理论自测及项目交付清单、反思、成果链接接入统一保存。
- [x] 未登录仅保留本机；旧匿名课堂记录主动导入；存储和网络故障保留草稿、可下载。练习自检不冒充正式评分。
- [x] 保留原练习表与聊天历史；新练习提交继续提供 AI 导师上下文。26 项后端测试、8 组账号浏览器测试、7 组匿名课程回归通过。
- [ ] 教师评阅与成绩管理、统一作业中心、文件附件上传。考试类型持久化已验证，完整考试组织界面尚未实现。

#### 3aa: 分步课堂记录（spec 054，2026-09-20 已发布）

- [x] 驾驶规则四个节点根据观察、条件规则、实验对照和成果说明采用不同字段，一次展开一个小任务。
- [x] 例子与学生回答分开，无默认选项或预填结果；支持简短表达和自由表达，未填全不计入完成。
- [x] 结构字段和文字答案一起保存，兼容旧课堂记录；正常情况下导出、导入与历史收进次要选项，异常时提供直接备份。
- [x] 对齐正式课程视觉：统一主站字体与颜色变量，官方视频封面与弹层播放、图标资料卡、分步输入卡片；6 组样式与媒体检查、7 组课程回归通过。
- [ ] 儿童试用验证表达门槛；依据试用结果调整示例与字段数量。

#### 3ab: 项目最终作品与自检（spec 055，2026-09-20 已发布）

- [x] 非三分钟项目在开课时说明最终作品、验收方法和返回位置；project-line 规范及八个非 micro 项目规划补齐交付契约。
- [x] 驾驶规则 M04 集中展示四行规则、同版本双路线步骤和作品说明，缺件不能交付；已填写与评阅 / 掌握分开。
- [x] 项目作品复用 assignment 学习记录独立提交，账号保留快照与历史；支持丢失响应幂等重试、跨浏览器恢复及账号隔离，游客只保存本机。
- [ ] 其他主题线的作品验收随课程制作推进（太空线已在 spec 056 补齐）。现有旗舰课程沿用原课程交付机制。

#### 3ac: 太空项目线剩余课程（spec 056，2026-09-20 已发布）

- [x] 观察选址、运载方案、越野底盘、地形样本、探测车组装、火星远征六门课程，共 18 个学习节点。每节点包含正文、示例、任务、官方参考、视频与中文替代阅读。
- [x] 六张独立生成封面接入项目库，四门引导课累计目标各 45 分钟，两门整合课各 60 分钟，可分次完成；真实火星车课程继续作为后续完整工程。其他主题保留筹备状态。
- [x] 真实 NASA/JPL 影像标记与放大、质量预算、同路段单变量底盘对照、训练/测试分离的地形近邻分类；保留错误和模型边界。
- [x] 组装课消费至少一件自己的已交付核心模块，正常与故障分别运行；远征读取自己的车辆、可选选址与载荷方案，保存逐格能量回放和明确标注的模拟观察帧。
- [x] 六类作品独立验收并提交快照，修改参数需重新运行；复用既有学习记录 API，无新增数据库表。已检验账号保存恢复、账号隔离、游客范围与移动端。
- [ ] 真实儿童试用；设计时长尚未通过儿童实测。模拟结果不代替实物验证或掌握评价。

#### 3ad: 03 系统制作与实物探测车（spec 057，2026-09-20 已发布）

- [x] 02 聚焦部件与对照；03 负责系统接口、多约束取舍、证据诊断、新路线迁移和实物验证。探测车八节点 / 330 分钟、实地远征五节点 / 155 分钟设计目标，采购打印另计，尚未儿童实测。替代 3ac 两门三节点虚拟整合课的默认入口。
- [x] 动态 3D 结构、耦合质量/能量模型、按证据排故与版本冻结。可先完成数字原型，正式交付必须包含实物材料。
- [x] 可修改 OpenSCAD、四个闭合 STL、尺寸与接线图、BOM 和 MicroPython 参考程序；孩子修改打印件与代码，完成前进、转向、触碰停止测量。参考包尚未完成首台实体样机试制。
- [x] CAD 与程序文本、原始测量、两张压缩实物照片使用既有学习记录 API 与账号数据库；正式交付独立快照，待评阅。材料齐备不等于平台验证硬件成功或学习掌握。
- [x] 远征读取实物车提交版本并消费参数；现场尺寸、两次往返尝试、调整和照片单独交付。课程 2.0 与 1.0 学习记录隔离，`?edition=1` 回看旧版。
- [x] 软件模型、固件逻辑、STL 网格、课程结构、桌面/手机浏览器、账号恢复与隔离验证。
- [x] 2026-09-20 增量部署 spec 048–057；保留既有线上课程，学习记录表迁移、正式 HTTPS 浏览器与账号保存验收通过，备份可回滚。详见 `docs/deployments/2026-09-20-rover-project-lines.md`。
- [ ] 首台样机实作与儿童试用。

#### 3ae: 生命解码局与五级项目线（spec 058，2026-09-21 本地完成）

- [x] 六个新项目：两个 3 分钟体验、两门四节点方法课程、一门六节点系统课、一门五节点新数据挑战，共 19 个课程节点；配独立生成封面、真实参考与视频、中文替代阅读和最终作品。
- [x] 学习层级为 01 发现与操作、02 制作方法、03 验证系统、04 独立新挑战、05 完整工程与研究。原课程工程深度单独保留；实地远征归入 04，03 探测车继续要求实物。项目库不再漏掉整合课程。
- [x] RDKit 真实连接图与计算 3D 构象，80 条冻结 ESOL 教学数据；48/16/16 按骨架隔离，模型不使用新样本答案。筛选条件、近邻回归、预算和接口故障均真实进入计算。
- [x] 四份最终作品复用既有 learning_records API，草稿、事前方案、不可覆盖的首次结果、事后探索和正式快照按账号保存；未登录仅本机。无新增 API 或数据库表。
- [x] 02 正式作品可接入 03，亦可在本课显式制作；04 达不到预先指标也可凭完整证据交付，不把低误差当学习掌握。
- [ ] 本批生产部署与真实儿童试用；课程时长为设计目标，未将软件自动化测试当儿童学习效果。

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

**用户可配的 LLM / TTS (spec 021)**：4 张卡片

- `llm.providers.thinking`：知识树规划 / 长程 reasoning。推荐 GLM-5.1
- `llm.providers.coding`：anim / game / HTML 静态图实现。推荐 GLM-4.6
  (非 thinking, 速度快 2-3 倍)
- `llm.providers.fast`：idea / 评判 / audio_script / assignment / JSON
  抽取。推荐 GLM-4.6 或 GLM-4.7-flash
- `tts`：DashScope qwen-tts 语音合成

**Fallback 链**（用户只填 thinking 一个 key 也能跑）：
- `coding` 没配 → 用 `fast` → 还没配用 `thinking`
- `fast` 没配 → 用 `coding` → 还没配用 `thinking`
- `thinking` 必填，没配 → 412 LLM_NOT_CONFIGURED

```yaml
llm:
  default: thinking
  providers:
    thinking:
      base_url: https://open.bigmodel.cn/api/paas/v4
      api_key: ${ZHIPU_API_KEY}
      model: glm-5.1
      temperature: 1.0
      max_tokens: 65536
    coding:
      base_url: https://open.bigmodel.cn/api/paas/v4
      api_key: ${ZHIPU_API_KEY}
      model: glm-4.6
      temperature: 0.7
      max_tokens: 65536
    fast:
      base_url: https://open.bigmodel.cn/api/paas/v4
      api_key: ${ZHIPU_API_KEY}
      model: glm-4.6
      temperature: 0.3
      max_tokens: 8192
tts:
  enabled: true
  api_key: ${DASHSCOPE_API_KEY}
  model: qwen3-tts-flash
  voice: Cherry
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

### 用本地 LLM (LM Studio / Ollama / vLLM)

systemedu 走 OpenAI-compatible API，任何兼容 `/v1/chat/completions`
协议的本地服务都能配。

**LM Studio 例子**：

1. 下载并启动 LM Studio，加载一个模型（如 `qwen2.5-coder-32b-instruct`）
2. 点 **Local Server → Start**，记录监听地址（默认 `http://localhost:1234`）
3. 在 web `/config` 任意一张 LLM 卡片填：

   | 字段 | 填什么 |
   |---|---|
   | `base_url` | `http://localhost:1234/v1`（注意 `/v1` 后缀） |
   | `api_key` | LM Studio 不验证 key，但 systemedu 不允许空 — 填任意非空字符串如 `lm-studio` |
   | `model` | LM Studio 加载的模型 ID（在 "Loaded models" 看） |
   | `temperature` | 0.0-2.0 |
   | `max_tokens` | 看模型 card；多数是 8192-32768 |

4. 点"测试连接" → 看 ok 即可

**多模型分工**：LM Studio 可以同时 load 多个模型，所有卡片 `base_url`
一样、`model` 字段不同即可——例如 thinking 用 reasoning model，
coding 用 coder model。

**Ollama**：`base_url=http://localhost:11434/v1`，其余同上。

**注意**：
- LM Studio / Ollama 跑在 macOS 本地 → systemedu 也得跑在同一台 Mac
  上 (`localhost`)；要让远程 systemedu 服务器调 → 需端口映射（ngrok / frp）
- 本地 30B 级模型在 M3 Max 约 20-30 tokens/s，处理 anim/game 这类
  长生成会比 GLM 云端慢一些但完全免费
- streaming 已支持（spec 020），不用额外配置

### Gateway API Endpoints

**学生端内容发现（spec 048 / 049 / 050）**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/library/projects` | 复用现有完整课程摘要，按 slug 覆盖本地目录快照；以服务状态决定可打开内容，按主题与难度组织视图 |
| GET | `/api/my/projects` | 复用已有项目关联，显示当前用户的已加入状态 |

03 实物课程复用 `/api/learning/records`、`drafts` 与 `submissions`，不新增数据库表或通用附件 API。每张照片为最多 60,000 字符的 JPEG 数据副本、每份源码最多 16 KB，随作品保存；没有实体自动认证或评分服务。

短体验、主题线与本地完整课程目录使用前端数据；本次未新增后端接口。`/library` 按难度展开各线已有项目，`/library?view=lines` 展示主题入口，`/library?view=lines&line=<id>` 展示主题详情；`/project-lines` 兼容跳转主题目录。`/explore/space-exploration/<slug>` 承载现有四个互动项目。本地目录不自行声明课程已发布，内容服务额外课程仍在全部项目保留。

**系统**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | 系统状态 (版本, uptime, LLM, 会话数) |
| GET | `/api/config` | 当前配置 (API key 脱敏 + `llm.user_editable` 白名单) |
| PUT | `/api/config` | 更新配置 (deep merge; mask 串提交时保留旧 api_key) |
| POST | `/api/config/test-llm` | 测试 provider 连通性 (`{provider}` → `{ok, message, latency_ms}`) |
| POST | `/api/config/test-tts` | 测试 TTS api_key 连通性 (空 body → `{ok, message, latency_ms}`) |
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

**学生学习记录**（spec 053，当前 student-app）

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/learning/records` | 按课程、节点、活动、类型和内容版本读取本人草稿及最近 50 次提交；更早快照保留于数据库 |
| PUT | `/api/learning/drafts` | 带预期版本的草稿保存，旧设备写入返回 409 |
| POST | `/api/learning/submissions` | 保存不可变提交快照；请求 ID 幂等；状态为未评阅 |

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

## 7. 一键安装 (`./scripts/install.sh`)

从仓库根目录跑，自动检测平台 + 模式，幂等：

```bash
./scripts/install.sh                  # 自动检测 (macOS / Ubuntu)
./scripts/install.sh --minimal        # 跳过 manim/texlive/playwright (~3GB)
./scripts/install.sh --host=1.2.3.4   # server 模式指定对外 IP/域名
./scripts/install.sh --help
```

**模式**：
- **local** (macOS / 非 root Ubuntu)：装依赖 + venv + npm install，
  完成后让你跑 `./scripts/restart.sh` 启 dev server
- **server** (Ubuntu root + systemd)：另外装 systemd unit + nginx，
  监听 80，启动后 `http://<host>` 即可访问

**首次安装** 会写空 `creative.api_key` 占位的 `~/.systemedu/config.yaml`，
登录 web UI 后到 `/config` 填 API Key。

**支持平台**：macOS (brew) + Ubuntu 24.04 (apt)。其他 Linux 暂不支持。

详见 `specs/018-install-script/spec.md`。

## 8. CLI Commands

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

## 9. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **安全** | 沙箱隔离, 命令黑名单, 文件访问控制 |
| **性能** | AI 对话首 token < 1s |
| **可扩展** | 支持任意 MCP server, 自定义 skills/agents |
| **cloud 优先** | 内容 library 托管, 用户数据存 PostgreSQL (见 spec 037) |
| **国际化** | 初期中文, 架构支持多语言 |

## 10. 学生端 + Tutor 测试金字塔 (2026-06-05)

学生端常规功能(pull/学习/进度)与 tutor(agent+记忆+苏格拉底)采用三层测试，详见
`docs/testing/student-tutor-coverage-matrix.md` (回归基线):

- **L1 单元/契约** (CI 必跑, 进程内): tools / memory_layers / safety / graph 等核心逻辑，多数 89-100%。
- **L2 机制 E2E** (CI 必跑, 确定性, 不依赖真 LLM): 复杂 EEG 合成项目(7 knode/3 stage/DAG)驱动，
  验证 pull→学习→context 注入→记忆召回→知识树 DAG 增长→safety 的机制正确性。
- **L3 质量评估** (`--quality`, 隔离, judge = Claude Code): 真实 tutor 对话落盘 artifact，
  Claude (强于系统所用 qwen) 按 rubric 评苏格拉底合规/准确、反馈质量、记忆召回、context 落地、安全。
  软门槛(苏格拉底合规率≥80%、各项均分≥2.0)告警不 fail CI。

整体 student+tutor 行覆盖 73%→82%。L3 首次实跑已测出 tutor 质量缺陷(苏格拉底合规率 20%、
记忆召回实时路径无效)，见 `docs/testing/quality_report_2026-06-05.md` 与 todolist「Tutor 质量改进」。
