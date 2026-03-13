# Backend — Projects

## Models

### Project
| Field | Type | Notes |
|-------|------|-------|
| title | CharField(200) | |
| subtitle | CharField(300) | |
| description | TextField | |
| category | CharField choices | ai/biotech/aerospace/music/climate/robotics/other |
| min_age, max_age | IntegerField | Target age range |
| estimated_hours | IntegerField | |
| is_published | BooleanField | Only published projects visible in Challenge Hall |
| is_template | BooleanField | Template for cloning |
| created_by | FK(User) | |
| forked_from | FK(self, null) | Points to original project if this is a fork |

### Milestone
| Field | Type | Notes |
|-------|------|-------|
| project | FK(Project) | |
| title | CharField(200) | |
| description | TextField | |
| order | IntegerField | |
| acceptance_criteria | TextField | |
| xp_reward | IntegerField | default 100 |

### KnowledgeNode
| Field | Type | Notes |
|-------|------|-------|
| milestone | FK(Milestone) | |
| title | CharField(200) | |
| summary | TextField | |
| order | IntegerField | |
| difficulty_level | IntegerField(1-10) | |
| content_type | choices | text/interactive/code/experiment/quiz |
| acceptance_type | choices | quiz/code_submit/essay/demo/peer_review |
| estimated_minutes | IntegerField | |
| xp_reward | IntegerField | default 50 |
| prerequisites | M2M(self) | DAG edges |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/projects/` | Public | List published projects (with fork_count annotation) |
| GET | `/api/projects/{id}/` | Public* | Project detail (* owners can also see unpublished forks) |
| POST | `/api/projects/{id}/fork/` | Required | Deep-copy project + auto-enroll |
| GET | `/api/projects/{id}/check-fork/` | Required | Check if user already forked |
| GET | `/api/projects/my/` | Required | List user's forked projects with progress |
| GET | `/api/projects/{id}/progress-summary/` | Required | Progress summary for one project |
| GET | `/api/projects/knodes/{id}/` | Public | Knowledge node detail |

## Fork Business Rules
- Only published projects can be forked (`is_published=True`)
- One fork per user per source project
- Title unchanged (no "Copy" suffix)
- Fork: `is_published=False`, `is_template=False`
- Auto-enroll user after fork

## Services (`services.py`)
- `validate_knowledge_tree()` — DAG validation with Kahn's algorithm
- `save_knowledge_tree()` — Atomic save with M2M prerequisites
- `export_knowledge_tree()` — Export as JSON
- `get_tree_graph()` — Visualization graph structure
- `clone_project()` — Deep copy project + milestones + knodes + prerequisites
