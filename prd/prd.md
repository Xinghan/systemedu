# SystemEdu - Master Product Requirements Document

## 1. Product Vision

SystemEdu is a gamified educational platform that makes learning engaging through interactive quests, guided by an animated baby turtle teacher character. Inspired by Google AI Quests, it expands beyond AI to cover medicine, climate science, space exploration, and more.

## 2. Target Users

- **Primary**: Students (ages 12-25) interested in STEM subjects
- **Secondary**: Self-learners, educators creating learning paths

## 3. Core Features

### 3.1 Quest System
- Structured learning paths organized by topic (AI, Medicine, Climate, Space, etc.)
- Each quest contains multiple modules, each module contains lessons
- Lessons include text, interactive exercises, quizzes, and hands-on projects
- Progress tracking per quest/module/lesson

### 3.2 Gamification
- XP points for completing lessons and quests
- Achievement badges and milestones
- Learning streaks
- Leaderboards (optional)
- Animated turtle teacher provides guidance, encouragement, and feedback

### 3.3 User System
- Registration/login (email + social auth)
- User profiles with learning history
- Progress dashboard

### 3.4 Knowledge Base
- Searchable knowledge resources
- AI-powered content recommendations (future)
- Knowledge graph connecting related topics (future)

### 3.5 Admin / Content Management
- Quest/module/lesson CRUD for educators
- User management
- Analytics dashboard

## 4. Technical Architecture

See `CLAUDE.md` for full tech stack details.

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS 4 |
| Backend API | Django 6 + Django REST Framework |
| Auth | Django auth + JWT |
| Primary DB | MySQL 8 |
| Vector DB | ChromaDB / Pgvector (future) |
| Graph DB | Neo4j (future, optional) |

## 5. Data Model (High Level)

```
User
├── id, email, username, avatar, xp, level
├── created_at, last_login

Quest
├── id, title, description, icon, category, difficulty
├── order, is_published

Module (belongs to Quest)
├── id, quest_id, title, description, order

Lesson (belongs to Module)
├── id, module_id, title, content_type, content, order

UserProgress
├── user_id, lesson_id, status (not_started/in_progress/completed)
├── xp_earned, completed_at

Achievement
├── id, title, description, icon, criteria
```

## 6. API Endpoints (Planned)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | User registration |
| POST | /api/auth/login | JWT login |
| POST | /api/auth/refresh | Refresh JWT token |
| GET | /api/quests/ | List all quests |
| GET | /api/quests/:id/ | Quest detail with modules |
| GET | /api/quests/:id/modules/:mid/lessons/ | Lessons in a module |
| GET | /api/progress/ | User's progress summary |
| POST | /api/progress/lessons/:id/complete | Mark lesson complete |

## 7. MVP Scope

**Phase 1 (Current)**:
- Landing page with quest selection
- Quest detail page with module list
- Baby turtle teacher character (SVG animation)
- Basic frontend navigation

**Phase 2 (Next)**:
- User registration/login (backend API)
- Quest/module/lesson data models
- REST API for quests and progress
- Frontend-backend integration

**Phase 3 (Future)**:
- Interactive lesson content
- Quiz system
- XP and achievements
- Admin panel for content management
- AI-powered features (search, recommendations)

## 8. Module PRDs

> Each major module will have its own detailed PRD file. New PRD files require user approval before creation.

| Module | PRD File | Status |
|--------|----------|--------|
| Users & Auth | `prd/users.md` | Planned |
| Quests & Content | `prd/quests.md` | Planned |
| Progress & Gamification | `prd/progress.md` | Planned |
| Knowledge & Search | `prd/knowledge.md` | Planned |
| Admin | `prd/admin.md` | Planned |
