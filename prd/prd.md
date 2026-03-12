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

## 3. Core Concepts

### 3.1 Project (项目)
真实工业级项目，是平台的核心学习单元。每个 Project 对应一个真实世界可交付成果。

**示例项目：**
- 🤖 训练一个无监督学习模型（聚类算法 → K-Means → 应用于真实数据集）
- 🧬 蛋白质结构发现（了解氨基酸 → AlphaFold → 发现新蛋白质折叠）
- 🚀 小推进力火箭研发（牛顿力学 → 推进剂化学 → 3D建模 → 仿真测试）
- 🎵 AI 音乐创作引擎（乐理基础 → 信号处理 → 神经网络 → 生成音乐）
- 🌍 气候变化预测模型（统计学 → 数据采集 → 模型训练 → 可视化报告）

### 3.2 Knowledge Tree (知识树)
每个项目背后有一棵 DAG（有向无环图）结构的知识树：

```
Project: 训练无监督学习模型
├── Milestone 1: 理解数据
│   ├── KNode: 什么是数据？
│   ├── KNode: 数据类型（数值、文本、图像）
│   ├── KNode: 数据收集方法
│   └── KNode: 数据清洗基础
├── Milestone 2: 数学基础
│   ├── KNode: 距离的概念
│   ├── KNode: 坐标系与向量
│   └── KNode: 平均值与中心点
├── Milestone 3: 理解聚类
│   ├── KNode: 什么是分组/聚类
│   ├── KNode: K-Means 算法原理
│   └── KNode: 手动实践聚类
├── Milestone 4: 编程实现
│   ├── KNode: Python 基础
│   ├── KNode: 使用 sklearn
│   └── KNode: 可视化结果
└── Milestone 5: 真实应用
    ├── KNode: 选择真实数据集
    ├── KNode: 模型调优
    └── KNode: 撰写项目报告
```

**知识节点 (KNode) 特性：**
- 每个节点有明确的**验收标准** (acceptance criteria)
- 节点间有**前置依赖**关系 (prerequisite edges)
- 节点难度自适应（同一概念有多个难度版本，根据用户年龄/水平选择）
- 系统通过 AI 动态发现用户**知识盲区**并插入补充节点

### 3.3 AI Tutor System (AI 导师系统)
多 Agent 协作的智能导师，核心 Agents：

| Agent | 职责 |
|-------|------|
| **Tutor Agent** | 主导师，与用户对话，讲解知识，引导实践 |
| **Assessor Agent** | 评估用户在每个知识节点的掌握程度，设计验收方案 |
| **Planner Agent** | 分析项目 → 生成/更新知识树，规划学习路径 |
| **Content Agent** | 爬取、分析、生成适龄教学内容（文字/图片/代码/实验） |
| **Gap Detector Agent** | 持续分析用户表现，发现知识盲区，插入补充节点 |
| **Motivator Agent** | 情感支持，鼓励，调节学习节奏，防止挫折 |

### 3.4 Memory System (记忆系统)
基于 Mem0 的三层记忆：

| 层级 | 用途 | 持久化 |
|------|------|--------|
| **User Memory** | 用户长期画像：兴趣、学习风格、知识掌握情况、历史对话摘要 | 永久 |
| **Project Memory** | 单个项目内的上下文：当前进度、遇到的问题、解题思路 | 项目生命周期 |
| **Session Memory** | 单次会话的短期记忆：当前讨论的知识点、即时反馈 | 会话结束 |

### 3.5 Gamification (游戏化)
- **XP 系统**：完成知识节点获得 XP，XP 累积升级
- **项目徽章**：完成整个项目获得工业级认证徽章
- **里程碑庆典**：完成 Milestone 触发动画庆祝
- **学习连续性**：连续学习天数奖励
- **排行榜**：可选，按项目/总 XP
- **宠物/伙伴**：小乌龟导师随等级进化（换装/特效）

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                            │
│              Next.js 16 + TypeScript                     │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│   │  Landing  │  │ Project  │  │  Learning  │            │
│   │   Page    │  │ Browser  │  │  Session   │            │
│   └──────────┘  └──────────┘  └───────────┘            │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│   │ Knowledge │  │ Profile/ │  │   Admin    │            │
│   │ Tree Viz  │  │Dashboard │  │  Panel     │            │
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
│   ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│   │ Content   │  │  Admin   │  │ Analytics  │            │
│   │ Service   │  │  API     │  │  Service   │            │
│   └──────────┘  └──────────┘  └───────────┘            │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                AI Agent Layer                            │
│          LangGraph + LangChain                           │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│   │  Tutor   │  │ Assessor │  │  Planner   │            │
│   │  Agent   │  │  Agent   │  │  Agent     │            │
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
│   └──────────┘  └──────────┘  │(向量检索)  │            │
│   ┌──────────┐               └───────────┘            │
│   │  Mem0    │                                          │
│   │(AI记忆层)│                                          │
│   └──────────┘                                          │
└─────────────────────────────────────────────────────────┘
```

## 5. Tech Stack (Detailed)

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
| **Agent Framework** | LangGraph + LangChain | Agent 编排, 状态管理 |
| **LLM** | Claude API / OpenAI API | 核心推理能力 |
| **Memory** | Mem0 (self-hosted) | 用户/项目/会话记忆 |
| **Primary DB** | MySQL 8 | 用户, 项目, 进度等关系数据 |
| **Graph DB** | Neo4j | 知识树/知识图谱存储与查询 |
| **Vector DB** | Qdrant / Pgvector | RAG 向量检索, 内容语义搜索 |
| **Cache** | Redis | Session, Celery broker, 缓存 |
| **Object Storage** | S3 / MinIO | 上传文件, 生成内容 |
| **Task Queue** | Celery + Redis | 内容生成, 知识树构建等异步任务 |

## 6. Data Model

### 6.1 Relational (MySQL)

```
User
├── id, email, username, display_name, avatar_url
├── age, grade_level (年龄/年级，影响内容难度)
├── total_xp, level, streak_days
├── parent_email (家长邮箱，用于学习报告)
├── created_at, last_active_at

Project (工业级项目)
├── id, title, subtitle, description, cover_image
├── category (AI/Biotech/Aerospace/Music/Climate/...)
├── difficulty_range (min_age, max_age)
├── estimated_hours, is_published
├── created_by (educator/system)
├── created_at, updated_at

Milestone (项目里程碑)
├── id, project_id (FK)
├── title, description, order
├── acceptance_criteria (里程碑验收标准)
├── xp_reward

KnowledgeNode (知识节点 - 关系数据副本，主数据在 Neo4j)
├── id, neo4j_node_id (外键关联 Neo4j)
├── project_id, milestone_id
├── title, summary
├── difficulty_level (1-10, 可动态调整)
├── content_type (text/interactive/code/experiment/quiz)
├── acceptance_type (quiz/code_submit/essay/demo/peer_review)
├── estimated_minutes
├── xp_reward

UserProjectEnrollment (用户-项目关系)
├── id, user_id, project_id
├── status (exploring/active/paused/completed)
├── started_at, completed_at
├── total_xp_earned

UserNodeProgress (用户在每个知识节点的进度)
├── id, user_id, knode_id
├── status (locked/available/in_progress/submitted/passed/failed)
├── attempts, best_score
├── ai_feedback (AI 验收反馈)
├── started_at, passed_at

Achievement (成就/徽章)
├── id, title, description, icon
├── criteria_type (project_complete/streak/xp_threshold/...)
├── criteria_value

UserAchievement
├── user_id, achievement_id, earned_at

LearningSession (学习会话记录)
├── id, user_id, project_id, knode_id
├── session_type (tutoring/assessment/practice)
├── started_at, ended_at
├── messages_count, tokens_used
```

### 6.2 Graph (Neo4j) - Knowledge Graph

```cypher
// 节点类型
(:Project {id, title, category})
(:Milestone {id, title, order, project_id})
(:KNode {id, title, difficulty, content_type, acceptance_type})
(:Concept {id, name, domain})  // 跨项目的通用概念

// 关系类型
(Project)-[:HAS_MILESTONE]->(Milestone)
(Milestone)-[:CONTAINS]->(KNode)
(KNode)-[:REQUIRES]->(KNode)           // 前置依赖
(KNode)-[:TEACHES]->(Concept)          // 节点教授的概念
(Concept)-[:RELATED_TO]->(Concept)     // 跨领域概念关联
(KNode)-[:DIFFICULTY_VARIANT]->(KNode) // 同概念不同难度版本

// 用户知识状态 (可选，或存 MySQL)
(:User)-[:MASTERED {score, date}]->(:KNode)
(:User)-[:STRUGGLING_WITH {attempts, last_attempt}]->(:KNode)
```

### 6.3 Vector Store (Qdrant/Pgvector)

```
ContentEmbedding
├── id, knode_id, content_chunk
├── embedding (vector)
├── metadata (source_url, created_at, content_type)

// 用途：
// 1. RAG - 根据用户问题检索相关教学内容
// 2. 语义搜索 - 用户搜索项目/知识点
// 3. 相似内容推荐
// 4. 知识盲区检测 - 通过用户回答的 embedding 分析
```

### 6.4 Memory (Mem0)

```python
# User Memory - 永久保存
mem0.add(messages, user_id="user_123")
# 存储：学习偏好、知识水平、沟通风格、历史错误模式

# Project Memory - 项目周期内
mem0.add(messages, user_id="user_123", agent_id="project_rocket_001")
# 存储：项目进度上下文、遇到的困难、解题方向

# Session Memory - 会话内
mem0.add(messages, user_id="user_123", run_id="session_abc")
# 存储：当前对话状态、即时问答上下文
```

## 7. AI Agent System Design

### 7.1 Agent Orchestration (LangGraph)

```
用户消息 ──→ [Router Node]
                 │
        ┌────────┼────────┬──────────┐
        ▼        ▼        ▼          ▼
   [Tutor]  [Assessor] [Planner] [Motivator]
        │        │        │          │
        └────────┼────────┘          │
                 ▼                   │
          [Gap Detector] ◄───────────┘
                 │
                 ▼
         [Content Agent] (if new content needed)
                 │
                 ▼
          回复用户 + 更新状态
```

### 7.2 Agent Specifications

**Tutor Agent (主导师)**
- 输入：用户消息 + 当前 KNode + User Memory + Project Memory
- 行为：用适龄语言讲解概念，引导动手实践，回答问题
- 工具：代码沙箱执行、图表生成、3D 模型查看器、搜索引擎
- 输出：教学内容（文字/代码/图片）+ 引导性问题

**Assessor Agent (评估师)**
- 输入：用户提交的作业/答案 + KNode 验收标准
- 行为：根据验收标准评估，给出评分和反馈
- 验收类型：
  - Quiz: 自动评分
  - Code: 运行测试用例 + 代码质量分析
  - Essay: AI 评估 + rubric 打分
  - Demo: 引导用户展示成果，AI 评估
  - Peer Review: 匹配其他用户交叉评估
- 输出：pass/fail + 详细反馈 + 建议下一步

**Planner Agent (规划师)**
- 输入：项目描述 + 用户画像(年龄/水平)
- 行为：
  1. 将工业级项目拆解为 Milestones
  2. 每个 Milestone 拆解为 KNodes
  3. 建立节点间依赖关系 (DAG)
  4. 根据用户水平设定每个节点的难度版本
- 工具：Web 搜索（爬取项目相关资料）、知识图谱查询
- 输出：完整知识树 (JSON) → 写入 Neo4j

**Content Agent (内容生成器)**
- 输入：KNode 定义 + 目标用户画像
- 行为：
  1. 搜索现有教学资源 (RAG)
  2. 爬取互联网补充资料
  3. 生成适龄教学内容（文字简化、插图建议、代码示例）
  4. 生成验收题目/实验方案
- 输出：教学内容 + 验收方案 → 存入 DB + Vector Store

**Gap Detector Agent (盲区检测器)**
- 输入：用户在 Assessor 的评估结果 + 对话历史
- 行为：
  1. 分析用户回答模式，识别概念理解偏差
  2. 检查知识树中是否缺少必要前置节点
  3. 动态插入补充知识节点
- 输出：新增/修改 KNode 建议 → Planner 审核后写入

**Motivator Agent (激励师)**
- 输入：用户情绪信号（消极语言、长时间停滞、反复失败）
- 行为：鼓励、调整节奏、建议休息、分享成功故事
- 原则：保护用户自信心，尤其对低龄用户

### 7.3 Agent Communication Protocol

```python
# 所有 Agent 通过 LangGraph State 共享状态
class LearningState(TypedDict):
    user_id: str
    project_id: str
    current_knode_id: str
    messages: list[BaseMessage]       # 对话历史
    user_memory: list[dict]           # from Mem0
    project_memory: list[dict]        # from Mem0
    knowledge_tree: dict              # 当前项目知识树
    user_progress: dict               # 用户在各节点的进度
    assessment_result: dict | None    # 最近的评估结果
    gap_analysis: dict | None         # 盲区分析结果
    next_action: str                  # route to which agent
```

## 8. Key User Flows

### 8.1 开始新项目
```
用户浏览项目列表 → 选择"训练无监督模型"
  → Planner Agent 根据用户年龄(10岁)生成知识树
  → 知识树可视化展示（星空地图风格）
  → 系统解锁第一个 Milestone 的第一个 KNode
  → Tutor Agent 开始引导学习
```

### 8.2 学习单个知识节点
```
进入 KNode "什么是数据？"
  → Tutor Agent 用年龄适当的语言讲解
  → 用户与 AI 对话互动，提问
  → 引导动手练习（如：收集家庭成员身高数据）
  → Assessor Agent 出验收题
  → 用户提交 → 评分
    → Pass: 解锁下一个节点，获得 XP
    → Fail: Gap Detector 分析原因，补充内容，重试
```

### 8.3 知识盲区发现
```
用户在"K-Means 算法"节点反复失败
  → Gap Detector 分析：用户不理解"距离"概念
  → 自动在知识树中插入："什么是距离"节点
  → Tutor Agent 引导用户先学习"距离"
  → 通过后回到"K-Means"
```

### 8.4 家长查看报告
```
家长登录（家长账号或邮件链接）
  → 查看孩子学习进度
  → 知识树覆盖率
  → 学习时间统计
  → AI 生成的学习报告和建议
```

## 9. Frontend Pages

| 页面 | 路由 | 描述 |
|------|------|------|
| Landing | `/` | 产品介绍，项目展示 |
| 项目浏览 | `/projects` | 项目列表，分类筛选 |
| 项目详情 | `/projects/:id` | 项目介绍，知识树预览，开始按钮 |
| 学习工作台 | `/learn/:projectId/:knodeId` | 核心学习页面：AI 对话 + 知识树 + 代码编辑器 |
| 知识树全景 | `/projects/:id/tree` | 交互式知识树可视化 |
| 个人中心 | `/profile` | 进度总览，成就，设置 |
| 家长仪表板 | `/parent/dashboard` | 学习报告，时间统计 |
| 管理后台 | `/admin` | 项目管理，用户管理，数据分析 |

## 10. API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | JWT 登录 |
| POST | `/api/auth/refresh` | 刷新 Token |
| POST | `/api/auth/social/:provider` | 社交登录 |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/` | 项目列表（分页+筛选） |
| GET | `/api/projects/:id/` | 项目详情 |
| POST | `/api/projects/:id/enroll` | 开始项目 |
| GET | `/api/projects/:id/tree` | 获取知识树 |

### Knowledge Nodes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knodes/:id/` | 节点详情+教学内容 |
| GET | `/api/knodes/:id/content` | 节点教学材料 |
| POST | `/api/knodes/:id/submit` | 提交验收 |
| GET | `/api/knodes/:id/assessment` | 获取评估结果 |

### AI / Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| WS | `/ws/chat/:projectId/` | AI 导师 WebSocket 会话 |
| POST | `/api/chat/message` | 发送消息(REST fallback) |
| GET | `/api/chat/history/:sessionId` | 历史对话 |

### Progress
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/progress/` | 用户进度总览 |
| GET | `/api/progress/projects/:id` | 单项目进度 |
| GET | `/api/progress/achievements` | 成就列表 |

### Parent
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/parent/report/:childId` | 孩子学习报告 |
| GET | `/api/parent/activity/:childId` | 学习活动记录 |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| CRUD | `/api/admin/projects/` | 项目管理 |
| CRUD | `/api/admin/knodes/` | 知识节点管理 |
| GET | `/api/admin/analytics/` | 平台数据分析 |

## 11. Development Phases

### Phase 1: Foundation (当前 → 4周)
- [x] 项目骨架 (Next.js + Django)
- [x] 基础 Landing Page + Baby Turtle 角色
- [ ] 用户注册/登录 (JWT)
- [ ] 项目数据模型 + CRUD API
- [ ] 知识节点数据模型 (MySQL + Neo4j)
- [ ] 基础知识树可视化 (D3.js)

### Phase 2: AI Core (4-8周)
- [ ] LangGraph Agent 编排框架搭建
- [ ] Tutor Agent 基础版（对话+讲解）
- [ ] Mem0 集成（用户记忆+项目记忆）
- [ ] WebSocket 实时对话
- [ ] Planner Agent: 项目→知识树自动拆解
- [ ] 第一个完整项目: "训练无监督模型"

### Phase 3: Assessment & Adaptation (8-12周)
- [ ] Assessor Agent: 验收系统
- [ ] Gap Detector Agent: 盲区检测
- [ ] Content Agent: 自动内容生成
- [ ] RAG 知识检索 (Qdrant/Pgvector)
- [ ] 知识树动态更新
- [ ] XP + 成就系统

### Phase 4: Polish & Scale (12-16周)
- [ ] Motivator Agent: 情感支持
- [ ] 家长仪表板 + 学习报告
- [ ] 管理后台
- [ ] 第二、三个项目上线
- [ ] 性能优化 + 部署
- [ ] 安全审计（儿童隐私保护 COPPA）

## 12. Module PRDs

> 每个主要模块将有独立的 PRD 文件。**创建新 PRD 文件前需要用户批准。**

| Module | PRD File | Status |
|--------|----------|--------|
| Users & Auth | `prd/users.md` | Planned |
| Projects & Knowledge Tree | `prd/projects.md` | Planned |
| AI Agent System | `prd/agents.md` | Planned |
| Memory & RAG | `prd/memory.md` | Planned |
| Progress & Gamification | `prd/progress.md` | Planned |
| Parent Dashboard | `prd/parent.md` | Planned |
| Admin Panel | `prd/admin.md` | Planned |

## 13. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **安全** | 儿童隐私保护 (COPPA 合规)，数据加密，内容过滤 |
| **性能** | API 响应 < 200ms，AI 对话首 token < 1s |
| **可用性** | 界面适配 6-18 岁用户，大字体/高对比度选项 |
| **可扩展** | 支持动态添加新项目，知识树节点可达数千 |
| **国际化** | 初期中英文，架构支持多语言 |
| **监控** | AI token 用量监控，成本控制，用户行为分析 |
