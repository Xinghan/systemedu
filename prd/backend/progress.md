# Backend — Progress & Enrollment

## Models

### UserProjectEnrollment
| Field | Type | Notes |
|-------|------|-------|
| user | FK(User) | |
| project | FK(Project) | unique_together with user |
| status | choices | exploring/active/paused/completed |
| started_at | DateTimeField(auto) | |
| completed_at | DateTimeField(null) | |
| total_xp_earned | IntegerField(0) | |

### UserNodeProgress
| Field | Type | Notes |
|-------|------|-------|
| user | FK(User) | |
| knode | FK(KnowledgeNode) | unique_together with user |
| status | choices | locked/available/in_progress/submitted/passed/failed |
| attempts | IntegerField(0) | |
| best_score | DecimalField(null) | |
| ai_feedback | TextField(blank) | |
| started_at | DateTimeField(null) | |
| passed_at | DateTimeField(null) | |

### Achievement / UserAchievement
Badge system with criteria types (project_complete, streak, xp_threshold).

## Services (`services.py`)
- `enroll_user_in_project(user, project)` — Create enrollment + init all node progress records. Reusable by fork flow.

## API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/progress/enroll/{id}/` | Required | Enroll in project |
| GET | `/api/progress/enrollments/` | Required | List enrollments |
| GET | `/api/progress/projects/{id}/` | Required | Node progress for project |
| GET | `/api/progress/achievements/` | Required | User achievements |
