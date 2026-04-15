# Backend — 项目管理

> **状态**: 已实现 (本地 Starlette Gateway)

## 数据模型 (Pydantic, 定义在 `src/systemedu/education/models.py`)

### Project (`project.yaml`)
| Field | Type | Notes |
|-------|------|-------|
| name | str | 项目标识 slug |
| title | str | 项目标题 |
| description | str | 项目描述 |
| category | str | ai/biotech/aerospace/music/climate/robotics/math/cs/other |
| age_range | list[int] | 适龄范围 [min, max] |
| estimated_hours | int | 预计总学时 |
| tags | list[str] | 标签 |
| agents | dict | Agent 配置 (tutor/planner 等) |
| knowledge_tree | str | 知识树文件路径 |

### Milestone
| Field | Type | Notes |
|-------|------|-------|
| id | int | 自动分配 |
| title | str | 模块标题 |
| description | str | 模块描述 |
| order | int | 排序 |
| xp_reward | int | 默认 100 |
| knodes | list[KnowledgeNode] | 子节点 |

### KnowledgeNode
| Field | Type | Notes |
|-------|------|-------|
| title | str | 节点标题 |
| summary | str | 节点摘要 |
| difficulty_level | int (1-10) | 难度等级 |
| content_type | str | text/interactive/code/experiment/quiz |
| acceptance_type | str | quiz/code_submit/essay/demo/peer_review |
| estimated_minutes | int | 预计学习时间 |
| xp_reward | int | 默认 50 |
| prerequisite_indices | list[int] | 前置节点索引 (DAG 边) |

## 存储方式
- 磁盘文件: `./projects/{name}/project.yaml` + `knowledge_tree.json`
- 运行时通过 `ProjectLoader` 加载到 Pydantic 模型

## API Endpoints (Gateway, `src/systemedu/gateway/server.py`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | 列出本地项目 |
| POST | `/api/projects` | 创建项目 (写入 project.yaml + knowledge_tree.json) |
| POST | `/api/projects/preview-tree` | 预览/验证知识树 (支持 tree_leaf + milestones 格式) |
| POST | `/api/projects/generate-tree` | AI 生成知识树 (PlannerAgent) |
| GET | `/api/projects/{name}` | 项目详情 (含知识树 + 进度 + 注册信息) |
| PUT | `/api/projects/{name}/tree` | 全量更新知识树 JSON (写入磁盘) |

## 知识树格式

### milestones 格式 (标准)
```json
{
  "milestones": [
    {
      "title": "基础",
      "knodes": [
        {
          "title": "节点1",
          "summary": "描述",
          "difficulty_level": 1,
          "estimated_minutes": 15,
          "prerequisite_indices": []
        }
      ]
    }
  ]
}
```

### tree_leaf 格式 (兼容上传)
```json
{
  "项目名称": "...",
  "模块依赖图": [{"模块id": "M01", "模块标题": "...", "前置模块": []}],
  "知识树节点": [{"id": "M01N01", "模块id": "M01", "标题": "...", ...}]
}
```
上传时自动通过 `convert_uploaded_tree()` 转为 milestones 格式。

## AI 知识树生成
- 入口: `POST /api/projects/generate-tree`
- 调用 `generate_knowledge_tree(title, description, user_age)` → PlannerAgent
- PlannerAgent prompt 输出 milestones JSON
- 支持最多 3 次重试
- 返回 TreePreviewResponse 格式

## Services (`src/systemedu/education/services.py`)
- `parse_knowledge_tree()` — 解析 JSON 为 KnowledgeTree 模型
- `validate_knowledge_tree()` — DAG 验证 (Kahn's algorithm)
- `convert_uploaded_tree()` — tree_leaf → milestones 格式转换
- `extract_project_meta()` — 从上传数据提取项目元信息

## 未来计划 (Phase 4: Hub)
- 项目打包/发布到 Hub
- Fork 项目到本地
- Hub 项目搜索/分类/评分
