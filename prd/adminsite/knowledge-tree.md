# Adminsite — Knowledge Tree Management

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/projects/{id}/import-tree/` | Import knowledge tree JSON (body or file upload) |
| GET | `/api/admin/projects/{id}/export-tree/` | Export knowledge tree as JSON |
| GET | `/api/admin/projects/{id}/tree-preview/` | Tree graph structure for visualization |
| POST | `/api/admin/projects/{id}/generate-tree/` | AI generate knowledge tree |

## Import Format
```json
{
  "milestones": [
    {
      "title": "...",
      "description": "...",
      "order": 1,
      "knodes": [
        {
          "title": "...",
          "summary": "...",
          "order": 1,
          "difficulty_level": 3,
          "content_type": "text",
          "acceptance_type": "quiz",
          "estimated_minutes": 30,
          "xp_reward": 50,
          "prerequisites": ["Other Node Title"]
        }
      ]
    }
  ]
}
```

## AI Generation
- Uses Qwen (DashScope) via Planner Agent
- Granularity: coarse (3-5 milestones) / medium (5-8) / fine (8-12)
- Generates JSON matching import format
- Validates content_type and acceptance_type against allowed enums
