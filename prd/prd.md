# SystemEdu - Master Product Requirements Document

## 1. Product Vision

**SystemEdu** 是一款面向儿童到青少年（6-18岁）的、基于最先进 AI Agent 技术的**项目制学习平台**。

与传统教育平台不同，SystemEdu 让零基础用户可以直接参与**真实工业级项目**——例如训练一个无监督学习模型、利用工具发现新蛋白质结构、研发小推进力火箭等。先进的大语言模型、多 Agent 协作系统、持久化记忆和 RAG 知识检索，使得年幼的用户也能在 AI 导师的一步步引导下，从零开始完成工业级项目，最终达到接近专业水平。

**核心差异化**：
- 不是"简化版"课程，而是真实工业项目 + AI 自适应拆解
- 知识树可达数千节点，系统动态生成、持续完善
- 每个知识节点有验收方案，确保真正掌握
- AI 不断发现用户知识盲区，自动补全学习路径

## 2. Target Users

| 用户群 | 年龄 | 特征 |
|--------|------|------|
| **Primary** | 6-12岁 (儿童) | 零专业基础，需要极强的引导和可视化，注意力短 |
| **Primary** | 13-18岁 (青少年) | 有一定基础，能处理更抽象的概念，追求成就感 |
| **Secondary** | 家长 | 关注学习进度、安全性、学习效果报告 |
| **Secondary** | 教育者/内容创作者 | 创建和管理项目模板 |

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                            │
│              Next.js 16 + TypeScript                     │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│   │  Landing  │  │Challenge │  │  Learning  │            │
│   │   Page    │  │  Hall    │  │  Session   │            │
│   └──────────┘  └──────────┘  └───────────┘            │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│   │    My    │  │ Profile/ │  │ Knowledge  │            │
│   │ Projects │  │Dashboard │  │  Tree Viz  │            │
│   └──────────┘  └──────────┘  └───────────┘            │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────┴──────────────────────────────────┐
│                   Backend API                            │
│              Django 6 + DRF                              │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│   │  Users    │  │ Projects │  │  Progress  │            │
│   │  Auth     │  │ KTree    │  │  Tracking  │            │
│   └──────────┘  └──────────┘  └───────────┘            │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                AI Agent Layer                            │
│          LangGraph + LangChain                           │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│   │  Tutor   │  │ Assessor │  │  Planner   │            │
│   └──────────┘  └──────────┘  └───────────┘            │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│   │ Content  │  │   Gap    │  │ Motivator  │            │
│   │  Agent   │  │ Detector │  │  Agent     │            │
│   └──────────┘  └──────────┘  └───────────┘            │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                  Data Layer                              │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│   │  MySQL 8 │  │  Neo4j   │  │  Qdrant/  │            │
│   │ (关系数据)│  │(知识图谱) │  │ Pgvector  │            │
│   └──────────┘  └──────────┘  └───────────┘            │
│   ┌──────────┐  ┌──────────┐                            │
│   │  Mem0    │  │  Redis   │                            │
│   │(AI记忆层)│  │(Cache)   │                            │
│   └──────────┘  └──────────┘                            │
└─────────────────────────────────────────────────────────┘
```

## 4. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16 (App Router) + TypeScript | SSR, 页面路由, UI |
| **Styling** | Tailwind CSS 4 | 响应式设计 |
| **State** | Zustand + React Query (TanStack) | 客户端状态 + 服务端缓存 |
| **Realtime** | WebSocket (Django Channels) | AI 对话流式输出 |
| **Graph Viz** | D3.js / React Flow | 知识树可视化 |
| **Backend** | Django 6 + DRF | REST API, 业务逻辑 |
| **Async** | Django Channels + Celery | WebSocket, 异步任务 |
| **Auth** | django-simplejwt + django-allauth | JWT + 社交登录 |
| **Agent** | LangGraph + LangChain | Agent 编排, 状态管理 |
| **LLM** | Qwen (DashScope) | 核心推理能力 |
| **Memory** | Mem0 (self-hosted) | 用户/项目/会话记忆 |
| **Primary DB** | MySQL 8 | 关系数据 |
| **Graph DB** | Neo4j | 知识图谱 |
| **Vector DB** | Qdrant / Pgvector | RAG 向量检索 |
| **Cache** | Redis | Session, Celery broker |
| **Admin** | 独立 Django 服务 | 项目管理, 知识树管理 |

## 5. Development Phases

### Phase 1: Foundation ✅
- [x] 项目骨架 (Next.js + Django)
- [x] Landing Page + Baby Turtle / Alien Teacher 角色
- [x] 用户注册/登录 (JWT)
- [x] 项目数据模型 + CRUD API
- [x] 进度跟踪 + 成就系统
- [x] Admin 知识树管理（导入/导出/生成/预览/克隆）

### Phase 1.5: User Flow (当前)
- [x] 挑战大厅（浏览已发布项目）
- [x] Fork 项目（深拷贝到用户空间）
- [x] 我的项目（查看 fork 项目 + 学习进度）
- [x] 学习入口（占位页面）

### Phase 2: AI Core
- [x] LangGraph Agent 编排框架
- [x] Tutor Agent 基础版（对话+讲解）
- [x] Chat API
- [ ] Mem0 集成
- [ ] WebSocket/SSE 实时流式对话
- [ ] 完整学习工作台

### Phase 3: Assessment & Adaptation
- [ ] Assessor Agent: 验收系统
- [ ] Gap Detector Agent: 盲区检测
- [ ] Content Agent: 自动内容生成
- [ ] RAG 知识检索
- [ ] 知识树动态更新

### Phase 4: Polish & Scale
- [ ] Motivator Agent
- [ ] 家长仪表板
- [ ] 性能优化 + 部署
- [ ] 安全审计 (COPPA)

## 6. Module PRDs

| Domain | Module | PRD File | Status |
|--------|--------|----------|--------|
| Frontend | Auth | `prd/frontend/auth.md` | ✅ |
| Frontend | Challenge Hall | `prd/frontend/challenge-hall.md` | ✅ |
| Frontend | Project Detail + Fork | `prd/frontend/project-detail.md` | ✅ |
| Frontend | My Projects | `prd/frontend/my-projects.md` | ✅ |
| Frontend | Learning Workbench | `prd/frontend/learning.md` | Planned |
| Frontend | Gamification | `prd/frontend/gamification.md` | Planned |
| Backend | Auth | `prd/backend/auth.md` | ✅ |
| Backend | Projects | `prd/backend/projects.md` | ✅ |
| Backend | Progress | `prd/backend/progress.md` | ✅ |
| Backend | Agents | `prd/backend/agents.md` | Planned |
| Backend | Memory | `prd/backend/memory.md` | Planned |
| Backend | Chat | `prd/backend/chat.md` | Planned |
| Admin | Auth | `prd/adminsite/auth.md` | ✅ |
| Admin | Projects | `prd/adminsite/projects.md` | ✅ |
| Admin | Knowledge Tree | `prd/adminsite/knowledge-tree.md` | ✅ |
| Admin | Tasks | `prd/adminsite/tasks.md` | ✅ |

## 7. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **安全** | 儿童隐私保护 (COPPA 合规)，数据加密，内容过滤 |
| **性能** | API 响应 < 200ms，AI 对话首 token < 1s |
| **可用性** | 界面适配 6-18 岁用户，大字体/高对比度选项 |
| **可扩展** | 支持动态添加新项目，知识树节点可达数千 |
| **国际化** | 初期中英文，架构支持多语言 |
| **监控** | AI token 用量监控，成本控制，用户行为分析 |
