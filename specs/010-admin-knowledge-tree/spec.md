# Adminsite — Knowledge Tree Management

> **状态**: 核心功能已迁移到本地 Gateway (见 `prd/backend/projects.md`)
> 此文件描述未来 Hub admin 的知识树管理功能。

## 已实现 (本地 Gateway)

| 功能 | Gateway API | 说明 |
|------|-------------|------|
| 上传知识树 | `POST /api/projects/preview-tree` | 支持 tree_leaf + milestones 双格式 |
| AI 生成 | `POST /api/projects/generate-tree` | PlannerAgent 生成 milestones JSON |
| 创建项目 | `POST /api/projects` | 写入 project.yaml + knowledge_tree.json |

### AI 生成参数
- 入参: `{ title, description, age? }`
- 使用 PlannerAgent (配置的默认 LLM provider)
- 最多 3 次重试
- 输出标准 milestones 格式

## 未实现 (Hub Admin, Phase 4)

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/projects/{id}/import-tree/` | Import knowledge tree JSON |
| GET | `/api/admin/projects/{id}/export-tree/` | Export knowledge tree as JSON |
| GET | `/api/admin/projects/{id}/tree-preview/` | Tree graph structure for visualization |
| POST | `/api/admin/projects/{id}/generate-tree/` | AI generate with granularity control |

### 粒度选项 (Hub Admin 专用)
- coarse: 3-5 milestones
- medium: 5-8 milestones
- fine: 8-12 milestones

## Import Format
```json
{
  "milestones": [
    {
      "title": "...",
      "description": "...",
      "knodes": [
        {
          "title": "...",
          "summary": "...",
          "difficulty_level": 3,
          "estimated_minutes": 30,
          "prerequisite_indices": []
        }
      ]
    }
  ]
}
```
