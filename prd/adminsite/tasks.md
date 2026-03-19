# Adminsite — Async Task System

> **状态**: 暂冻结 (Phase 4: Hub 管理后台)
> 本地 Gateway 中耗时操作 (AI 生成) 目前为同步请求，前端显示 loading。
> 此文件描述未来 Hub admin 的异步任务系统。

## 当前实现 (本地 Gateway)
- AI 知识树生成: 同步 `POST /api/projects/generate-tree` (约 10-30s)
- 课程内容生成: 同步 `POST .../lesson/generate` (约 15-60s)
- 前端使用 loading spinner 等待

## 未来计划 (Hub Admin)

### Model: GenerationTask
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

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/tasks/` | List tasks (filterable by project, status) |
| GET | `/api/admin/tasks/{id}/` | Task detail with result |

### Frontend
- TaskBanner component shows task status with polling
- Auto-imports generated tree on completion
