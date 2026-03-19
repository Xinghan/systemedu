# Frontend — 项目浏览 (原 Challenge Hall)

> **状态**: 部分实现，已重构为本地项目列表

## 当前实现: `/projects`

本地项目列表页，展示 `./projects/` 目录下的所有项目。

### Layout
- AppHeader: "项目"
- 右上角 "新建项目" 按钮 → `/projects/new`
- 响应式 2-3 列 ProjectCard 网格

### ProjectCard
- 项目标题
- 描述 (line-clamp-3)
- Badge: 分类 (AI/生物/航天等)、预计学时、适龄范围
- Tags 标签列表
- 点击 → `/projects/{name}`

### API
- `GET /api/projects` — 本地项目列表

### 空状态
- FolderKanban 图标 + "暂无项目" 提示

## 新建项目: `/projects/new`

3 步流程：选择方式 → 预览 → 确认创建

### Step 1: 选择方式 (Tabs)
**Tab 1: 上传 JSON**
- 拖拽上传 `.json` 文件
- 或粘贴 JSON 文本 → "解析 JSON" 按钮
- 支持 tree_leaf 格式和 milestones 格式
- 解析成功后显示 "预览知识树" 按钮

**Tab 2: AI 生成**
- 表单：项目标题(必填)、项目描述(必填)、学生年龄(默认12)
- "生成知识树" 按钮 (调用 `POST /api/projects/generate-tree`)
- Loading 状态："AI 正在生成知识树，请稍候..."
- 生成完成后自动跳转到 Step 2

### Step 2: 预览
- 统计卡片：模块数、节点数、总分钟、预计学时
- React Flow 知识树可视化
- 返回 / 确认并创建项目

### Step 3: 确认创建
- 项目标识 (slug, 仅允许小写字母+数字+连字符)
- 项目标题
- 创建后跳转到 `/projects/{name}`

### API
- `POST /api/projects/preview-tree` — 验证知识树
- `POST /api/projects/generate-tree` — AI 生成知识树
- `POST /api/projects` — 创建项目

## 未来计划 (Phase 4: Hub)
- Hub 在线项目浏览 (Challenge Hall)
- 分类筛选 (category filter)
- Fork 项目到本地
