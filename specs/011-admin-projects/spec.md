# Adminsite — Projects

> **状态**: 暂冻结 (Phase 4: Hub 管理后台)
> 项目 CRUD 已在本地 Gateway 中实现 (见 `prd/backend/projects.md`)。
> 此文件描述未来 Hub admin 管理界面的项目管理功能。

## API Endpoints (Hub Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/projects/` | List all projects |
| POST | `/api/admin/projects/` | Create project |
| GET | `/api/admin/projects/{id}/` | Project detail |
| PATCH | `/api/admin/projects/{id}/` | Update project |
| DELETE | `/api/admin/projects/{id}/` | Delete project |
| POST | `/api/admin/projects/{id}/clone/` | Clone project (deep copy) |

## Publish Validation
When setting `is_published=True`:
- Project must have at least 1 milestone and 1 knowledge node
- Otherwise returns 400: "Cannot publish: project has no knowledge tree"
