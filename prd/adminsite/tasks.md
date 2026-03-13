# Adminsite — Async Task System

## Overview
Long-running operations (AI generation) use background tasks tracked in the database.

## Model: GenerationTask
| Field | Type | Notes |
|-------|------|-------|
| project | FK(Project) | |
| task_type | choices | generate_tree / optimize_tree |
| status | choices | pending / running / completed / failed |
| granularity | choices | coarse / medium / fine |
| result | JSONField(null) | Generated tree JSON on success |
| error_message | TextField(blank) | Error details on failure |
| created_at | DateTimeField(auto) | |
| completed_at | DateTimeField(null) | |

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/tasks/` | List tasks (filterable by project, status) |
| GET | `/api/admin/tasks/{id}/` | Task detail with result |

## Frontend
- TaskBanner component shows task status with polling
- Auto-imports generated tree on completion
