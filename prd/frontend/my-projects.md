# Frontend — 学习页面

> **状态**: 已实现

## Route
`/learn/[projectName]`

## Purpose
项目学习主界面，包含侧边栏导航 + 课程内容 + 交互实验 + 练习。

## Layout

### 侧边栏 (左)
- 项目标题
- 知识树节点列表 (按 milestone 分组)
- 节点状态图标 (locked/available/in_progress/passed)
- 当前节点高亮
- 返回项目详情链接
- 可折叠 (PanelLeftClose/Open)

### 内容区域 (右)

#### 顶部 bar
- 节点标题 + 难度 / 预计时间 / XP
- 重新生成按钮
- 已完成 badge / 标记完成按钮

#### Tab 栏 (下划线指示器风格)
概念 | 示例 | 代码 | 总结 → 两栏布局（prose 左 + sidebar 右）
实验 | 练习 | 资料 → 全宽单栏布局

#### 两栏布局 (概念/代码/总结 tab)
- 左：Markdown 内容，全文连续滚动（无分页）
- 右 sidebar (w-64)：本节概览 + 标记完成按钮 + 下一步节点列表
- 下一步节点：完成当前节点后，展示所有前置已满足的未学节点（DAG 计算）

#### Tab: 实验 (Interactive Lab)
- iframe 沙箱 (600px 固定高度)
- 6 种交互类型：drag_classify, click_select, drag_sort, connect_match, cause_effect, animated_story
- animated_story：anime.js + SVG 时间轴动画，概念性节点兜底
- 5-Agent 流水线生成：LessonPlanner → LabAnalyst → LabDesigner → LabCoder → LabReviewer
- 生成进度条 (GenerationPipelineView)

#### Tab: 练习 (Practice)
- 结构化练习题 (exercises JSON)
- 用户作答 → "提交" → AI 批改
- 批改结果：正确/错误 + 详细解释
- 提交历史

#### Tab: 资料 (Resources)
- 节点相关资源搜索

## 底部 bar
- 左：上一节 / 下一节按钮
- 右下角 fixed FAB：笔记（amber 圆形）+ AI Chatbot（green 圆形，已实现）

## 笔记侧边栏
- 右侧抽屉式，可拖拽调整宽度 (280~640px)
- Markdown 编辑器 + 预览切换
- 自动保存（防抖）
- 最小化 / 关闭

## 课程生成
- 首次进入节点 → 自动调用 `POST .../lesson/generate` 生成课程
- 生成中显示 GenerationPipelineView（步骤进度）
- 已生成内容从 DB 缓存读取
- "重新生成" 按钮 (regenerate=true)

## 文本高亮
- 选中文本 → HighlightToolbar → 颜色选择 + 备注
- 高亮按 tab 存储，全文展示时按 page_index=0 处理

## API
- `GET /api/projects/{name}/nodes/{id}/lesson` — 获取课程内容
- `POST /api/projects/{name}/nodes/{id}/lesson/generate` — 生成课程
- `GET /api/projects/{name}/nodes/{id}/lesson/progress` — 课程进度
- `PATCH /api/projects/{name}/nodes/{id}/progress` — 更新节点状态
- `GET /api/projects/{name}/nodes/{id}/highlights` — 高亮列表
- `POST /api/projects/{name}/nodes/{id}/highlights` — 创建高亮
- `DELETE /api/projects/{name}/nodes/{id}/highlights/{hid}` — 删除高亮
- `POST /api/projects/{name}/nodes/{id}/practice/submit` — 提交练习
- `GET /api/projects/{name}/nodes/{id}/practice/submissions` — 提交历史

## 未来计划
- XP 奖励动画
- 成就系统
- AI Tutor 聊天 (节点级对话，chatbot FAB 已占位)
