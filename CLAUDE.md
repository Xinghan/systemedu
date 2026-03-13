# SystemEdu - Project Guidelines

## Project Overview

SystemEdu 是一款面向儿童到青少年（6-18岁）的 AI Agent 驱动项目制学习平台。用户可以从零基础开始参与真实工业级项目（如训练ML模型、蛋白质结构发现、火箭研发等），在多 Agent 智能导师系统的引导下，逐步掌握并完成工业级别的项目。

核心技术特色：动态知识树（数千节点DAG）、多 Agent 协作导师、Mem0 持久化记忆、RAG 知识检索。

## Tech Stack

### Frontend (`/frontend`)
- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4
- **State**: Zustand + React Query (TanStack)
- **Realtime**: WebSocket (AI对话流式输出)
- **Graph Viz**: D3.js / React Flow (知识树可视化)

### Backend (`/backend`)
- **Framework**: Django 6 + Django REST Framework
- **Language**: Python 3.12+
- **Auth**: django-simplejwt + django-allauth (JWT + 社交登录)
- **Async**: Django Channels (WebSocket) + Celery (任务队列)
- **Cache/Broker**: Redis

### AI Agent Layer (`/backend/agents/`)
- **Orchestration**: LangGraph + LangChain
- **LLM**: Qwen (通义千问) via DashScope OpenAI-compatible API
  - Model: `qwen-plus` (Qwen 3.5 Plus)
  - Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
  - API Key: 环境变量 `DASHSCOPE_API_KEY`（存于 `backend/.env`，**不得提交到 git**）
  - 支持流式输出 (`stream=True, stream_options={"include_usage": True}`)
- **Memory**: Mem0 (self-hosted, vector+graph hybrid)
- **Agents**: Tutor, Assessor, Planner, Content, Gap Detector, Motivator

### Database
- **Primary**: MySQL 8 (用户、项目、进度等关系数据)
- **Graph DB**: Neo4j (知识树/知识图谱，节点依赖关系)
- **Vector DB**: Qdrant / Pgvector (RAG检索, 内容embedding)
- **Memory**: Mem0 (用户记忆、项目记忆、会话记忆)
- **Object Storage**: S3 / MinIO (文件上传、生成内容)

### Admin (`/adminsite`)
- 独立 Django 服务，共享 backend 数据库（通过 `sys.path` 导入 backend 模型）
- DB Router 阻止 admin 端创建共享模型的迁移
- JWT 认证，复用 User 模型的 `is_staff` 字段
- 项目 CRUD + 知识树 JSON 批量导入（支持 JSON body 和文件上传）
- 运行测试：`cd adminsite && source ../backend/venv/bin/activate && pytest`

## Project Structure

```
systemedu/
├── CLAUDE.md              # This file
├── prd/                   # Product Requirements Documents
│   └── prd.md             # Master PRD
├── frontend/              # Next.js app
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   ├── components/    # Reusable UI components
│   │   ├── lib/           # Utilities, API client, hooks
│   │   └── types/         # TypeScript types
│   └── public/            # Static assets
├── backend/               # Django project
│   ├── config/            # Django settings, urls, wsgi
│   ├── apps/
│   │   ├── users/         # User auth, profiles
│   │   ├── projects/      # Project, Milestone, KnowledgeNode models
│   │   ├── progress/      # User progress, XP, achievements
│   │   ├── knowledge/     # Knowledge tree, graph operations
│   │   └── chat/          # AI chat sessions, WebSocket consumers
│   ├── agents/            # LangGraph agent definitions
│   │   ├── tutor.py
│   │   ├── assessor.py
│   │   ├── planner.py
│   │   ├── content.py
│   │   ├── gap_detector.py
│   │   ├── motivator.py
│   │   └── graph.py       # LangGraph state machine
│   └── manage.py
└── adminsite/             # Independent Django admin service
    ├── config/            # Settings, urls, db_router
    └── admin_api/         # Admin API views, serializers, permissions
```

## Development Rules

### Git Workflow
- **Every code change must be committed** after the request is completed
- Commit messages follow conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Never force push or amend unless explicitly asked

### PRD Workflow
- `prd/prd.md` is the master PRD — always keep it updated
- Each major module gets its own PRD file (e.g., `prd/agents.md`, `prd/users.md`)
- **Ask for user approval before creating any new PRD file**
- Never create separate change-description files; always update existing PRD files
- PRD files use markdown with clear sections: Overview, User Stories, Data Model, API Endpoints, UI/UX

### Code Standards
- Frontend: TypeScript strict mode, functional components, hooks
- Backend: PEP 8, type hints, Django best practices
- API: RESTful design, consistent error responses, pagination
- Agents: Each agent is a standalone LangGraph node with clear input/output types
- No over-engineering: build what's needed now, not what might be needed later

### Development Loop (必须遵循)
每个功能的开发必须严格按照以下循环执行：

```
1. 开发新功能 → 2. 编写测试 → 3. 运行测试并修复 bug
→ 4. 提交代码 → 5. 回顾：审视现有系统，思考是否有新功能/改进可以添加
→ 6. 向用户提出建议并询问确认 → 7. 用户确认后更新 PRD → 8. 继续下一轮开发
```

**第 5-6 步（回顾与建议）是强制步骤，不可跳过。** 每完成一个功能提交后，必须：
- 深入理解产品目标：让儿童/青少年用户能够**自主学习**真实工业级项目
- 从**用户体验和功能角度**思考，而非仅仅是系统优化/技术改进
- 核心问题：当前功能是否足以让用户**方便地使用**并**达到自主学习的目的**？
- 思考是否缺少关键的**用户交互功能**，例如：
  - 学习路径是否清晰？用户是否知道下一步该做什么？
  - AI 导师是否能有效引导不同年龄段的学习者？
  - 是否有足够的反馈机制让用户感知学习进度？
  - 是否有功能帮助用户在遇到困难时获得帮助？
  - 是否有激励机制保持学习动力？
- 将**新功能建议**整理后**询问用户**是否需要添加
- 用户会明确告知保留哪几条建议
- **保留的建议**必须追加到 `todolist.md`，作为未来功能的待办追踪
- 用户确认后更新 `prd/prd.md`，再进入下一轮开发

### Feature Backlog (`todolist.md`)
- 项目根目录的 `todolist.md` 是功能待办追踪文件
- 每轮回顾建议中，用户确认保留的条目追加到此文件
- 条目格式：`- [ ] 功能描述`（完成后改为 `- [x]`）
- 开始开发某条目时，在 PRD 中补充详细设计，再进入开发循环

### Testing (Mandatory)
- **每个新 API 端点和新功能都必须附带测试，覆盖新增功能，未写测试不允许提交**
- Backend: pytest + Django REST Framework test client
  - 每个新 API view 必须有对应的 `test_<viewname>.py`
  - 测试覆盖：正常路径、权限校验、参数校验、边界情况
  - Agent 测试：使用 mock LLM 响应，验证 agent 输入输出和状态流转
- Frontend: Jest + React Testing Library
  - 新组件必须有对应测试文件 `__tests__/<Component>.test.tsx`
  - 测试覆盖：渲染、用户交互、API 调用 mock
- 运行测试：
  - Backend: `cd backend && source venv/bin/activate && pytest`
  - Frontend: `cd frontend && npm test`

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-11 | Next.js for frontend | SSR, App Router, great DX |
| 2026-03-11 | Django for backend | Mature, admin built-in, Python ML ecosystem |
| 2026-03-11 | MySQL for primary DB | Widely supported, reliable for relational data |
| 2026-03-12 | SVG character (baby turtle) | Pure code, no external assets needed for MVP |
| 2026-03-12 | LangGraph for agent orchestration | Stateful graph, handles branching for adaptive learning |
| 2026-03-12 | Mem0 for AI memory | Vector+graph hybrid, Django integration, self-hosted |
| 2026-03-12 | Neo4j for knowledge graph | Native graph DB, Cypher query, handles 1000s of nodes |
| 2026-03-12 | DAG-based knowledge tree | Prerequisite dependencies, non-linear learning paths |
| 2026-03-12 | Qwen (DashScope) as LLM | 阿里通义千问，OpenAI-compatible API，国内访问稳定 |
| 2026-03-13 | Admin as independent Django service | 共享 DB + sys.path 导入模型，DB Router 阻止迁移 |
| 2026-03-13 | Knowledge tree service layer | 提取到 services.py，验证+事务+bulk_create，backend/admin 共用 |
