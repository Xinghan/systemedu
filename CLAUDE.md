# SystemEdu - Project Guidelines

## Project Overview

SystemEdu is a gamified educational platform (inspired by Google AI Quests) that teaches AI, medicine, climate science, and more through interactive quests guided by an animated baby turtle teacher character.

## Tech Stack

### Frontend (`/frontend`)
- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4
- **State**: React 19 built-in (useState/useContext); Zustand if needed later
- **API calls**: fetch / SWR

### Backend (`/backend`)
- **Framework**: Django 6 + Django REST Framework
- **Language**: Python 3.12+
- **Auth**: Django built-in auth + JWT (djangorestframework-simplejwt)

### Database
- **Primary**: MySQL 8 (relational data: users, quests, progress, content)
- **Vector DB**: ChromaDB or Pgvector (for AI-powered search, embeddings, knowledge retrieval)
- **Graph DB**: Neo4j (optional, for knowledge graph relationships between topics)

### Admin (`/adminsite`)
- Django Admin (customized) for content management
- Quest/module/lesson CRUD
- User management and analytics

## Project Structure

```
systemedu/
├── CLAUDE.md            # This file
├── prd/                 # Product Requirements Documents
│   └── prd.md           # Master PRD (links to module PRDs)
├── frontend/            # Next.js app
│   ├── src/
│   │   ├── app/         # App Router pages
│   │   ├── components/  # Reusable UI components
│   │   ├── lib/         # Utilities, API client, hooks
│   │   └── types/       # TypeScript types
│   └── public/          # Static assets
├── backend/             # Django project
│   ├── config/          # Django settings, urls, wsgi
│   ├── apps/
│   │   ├── users/       # User auth, profiles
│   │   ├── quests/      # Quest, Module, Lesson models
│   │   ├── progress/    # User progress tracking
│   │   └── knowledge/   # Knowledge resources, search
│   └── manage.py
└── adminsite/           # Django admin customizations (within backend)
```

## Development Rules

### Git Workflow
- **Every code change must be committed** after the request is completed
- Commit messages follow conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Never force push or amend unless explicitly asked

### PRD Workflow
- `prd/prd.md` is the master PRD — always keep it updated
- Each major module gets its own PRD file (e.g., `prd/quests.md`, `prd/users.md`)
- **Ask for user approval before creating any new PRD file**
- Never create separate change-description files; always update existing PRD files
- PRD files use markdown with clear sections: Overview, User Stories, Data Model, API Endpoints, UI/UX

### Code Standards
- Frontend: TypeScript strict mode, functional components, hooks
- Backend: PEP 8, type hints, Django best practices
- API: RESTful design, consistent error responses, pagination
- No over-engineering: build what's needed now, not what might be needed later

### Testing
- Frontend: Jest + React Testing Library (when added)
- Backend: pytest + Django test client (when added)

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-11 | Next.js for frontend | SSR, App Router, great DX |
| 2026-03-11 | Django for backend | Mature, admin built-in, Python ML ecosystem |
| 2026-03-11 | MySQL for primary DB | Widely supported, reliable for relational data |
| 2026-03-12 | SVG character (baby turtle) | Pure code, no external assets needed for MVP |
