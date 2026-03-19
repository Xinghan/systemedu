# Backend — 学习进度 & 注册

> **状态**: 已实现 (本地 SQLite + Starlette Gateway)

## 数据模型 (SQLAlchemy, 定义在 `src/systemedu/storage/db.py`)

### Enrollment
| Field | Type | Notes |
|-------|------|-------|
| user_id | str | 默认 "default" |
| project_name | str | 项目标识 |
| status | str | active/paused/completed |
| started_at | datetime | 注册时间 |
| completed_at | datetime | 完成时间 (null) |
| total_nodes | int | 节点总数 |
| nodes_passed | int | 已通过节点数 |
| total_time_seconds | int | 累计学习时间 |

### NodeProgress
| Field | Type | Notes |
|-------|------|-------|
| user_id | str | |
| project_name | str | |
| knode_id | int | 节点索引 |
| status | str | locked/available/in_progress/passed/failed |

### LessonContent (缓存)
| Field | Type | Notes |
|-------|------|-------|
| project_name | str | |
| knode_id | int | |
| status | str | pending/generating/ready/error |
| concept | text | 概念内容 |
| examples | text | 举例内容 (JSON 或 Markdown) |
| application | text | 应用内容 |
| interactive_lab | text | 交互实验 HTML |
| exercises | text | 练习题 JSON |

## 进度状态流转

```
locked → available → in_progress → passed
                                 ↘ failed → available (重试)
```

### 解锁逻辑
- 节点通过 (`passed`) 后，检查所有依赖此节点的后续节点
- 如果后续节点的所有 `prerequisite_indices` 都已 passed → 解锁为 `available`
- 全部节点 passed → enrollment 自动标记 `completed`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/projects/{name}/enroll` | 注册学习 (初始化所有节点进度) |
| GET | `/api/projects/{name}/enrollment` | 获取注册信息 |
| PATCH | `/api/projects/{name}/enrollment` | 更新注册 (暂停/恢复/累加学习时间) |
| PATCH | `/api/projects/{name}/nodes/{id}/progress` | 更新节点状态 + 触发解锁 |

### 进度更新响应
```json
{
  "status": "passed",
  "knode_id": 0,
  "progress": [{"knode_id": 0, "status": "passed"}, ...],
  "unlocked": [1, 2]
}
```

## 课程内容生成

### 3-Agent 流水线
1. **LessonPlannerAgent** — 分析知识点，规划课程结构
2. **TeacherAgent** — 生成详细课程内容 (概念/举例/应用)
3. **StudentAgent** — 审查内容，确保适合目标年龄

### 交互实验 4-Agent 流水线
1. **LabAnalystAgent** — 分析知识点，选择交互类型
2. **LabDesignerAgent** — 设计交互实验方案
3. **LabCoderAgent** — 生成 HTML/CSS/JS 代码
4. **LabReviewerAgent** — 审查修复生成的 HTML

### 练习 + AI 批改
- 练习题随课程内容一起生成 (exercises JSON)
- `POST .../practice/submit` → AI 批改每道题
- 返回正确/错误 + 详细解释

## API Endpoints (课程)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/{name}/nodes/{id}/lesson` | 获取课程内容 |
| POST | `/api/projects/{name}/nodes/{id}/lesson/generate` | 生成课程 (支持 regenerate) |
| GET | `/api/projects/{name}/nodes/{id}/lesson/progress` | 课程进度 |
| GET | `/api/projects/{name}/nodes/{id}/context` | 节点上下文 (前置链 + 建议) |
| GET | `/api/projects/{name}/nodes/{id}/highlights` | 高亮列表 |
| POST | `/api/projects/{name}/nodes/{id}/highlights` | 创建高亮 |
| DELETE | `/api/projects/{name}/nodes/{id}/highlights/{hid}` | 删除高亮 |
| POST | `/api/projects/{name}/nodes/{id}/practice/submit` | 提交练习 |
| GET | `/api/projects/{name}/nodes/{id}/practice/submissions` | 提交历史 |

## 未来计划
- XP 奖励系统
- 成就 / Badge 系统 (project_complete, streak, xp_threshold)
- 学习时间统计报告
