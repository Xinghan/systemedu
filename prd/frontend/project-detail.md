# Frontend — 项目详情

> **状态**: 已实现

## Route
`/projects/[name]`

## Purpose
展示项目详情：知识树结构、学习进度、注册状态。入口进入学习。

## Layout
- AppHeader: 项目标题
- 知识树可视化 (D3.js，替换原 React Flow)
- 项目信息：描述、分类、适龄范围、预计学时
- 注册按钮 / 进入学习按钮

## 子路由

### `/projects/[name]/tree`
知识树全屏编辑视图：
- D3.js force-directed 布局，支持 pan/zoom
- 右上角 minimap 缩略图导航器（160×100px，实时视口框）
- 右键菜单节点操作：编辑节点属性 / 添加后继节点 / 删除节点
- NodeEditDialog：编辑 title / summary / difficulty_level / estimated_minutes / xp_reward
- 节点编辑后通过 `PUT /api/projects/{name}/tree` 持久化

## 注册状态

| 状态 | 显示 | 操作 |
|------|------|------|
| 未注册 | "开始学习" 按钮 | `POST /api/projects/{name}/enroll` → 进入学习 |
| 已注册 | 进度信息 + "继续学习" | → `/learn/{projectName}` |
| 已完成 | "已完成" 标记 | 可复习 |

## 知识树节点状态着色
- locked → 灰色 + 锁图标
- available → 蓝色
- in_progress → 黄色
- passed → 绿色 + 对勾
- failed → 红色

## API
- `GET /api/projects/{name}` — 项目详情 (含 milestones + progress + enrollment)
- `PUT /api/projects/{name}/tree` — 全量更新知识树
- `POST /api/projects/{name}/enroll` — 注册学习
- `GET /api/projects/{name}/enrollment` — 注册信息
