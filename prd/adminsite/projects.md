# Adminsite — Projects

## API Endpoints
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
