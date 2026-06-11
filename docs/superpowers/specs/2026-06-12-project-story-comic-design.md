# 项目连环画开篇 (story) 设计文档 (spec 040)

- Status: shipped (2026-06-12) — mars-analog-rover 跑通, 功能代码通用
- Owner: Xinghan Cui
- 关联: spec 023 (library 内容包/manifest), 复用 cover_image_path 存储模式

## 实现结果 (2026-06-12)

链路 (library -> 反代 -> 前端) 全部打通, 端到端验证通过:
- library: `manifest.StoryFrame` + `Manifest.story`; `Project.story` JSON 列 +
  `init_db._ensure_columns` 给老 SQLite 补列 (幂等, 无 alembic);
  `importer` 存 story; `_public_project_view` 列表/详情都返回 story。
- core `library_client.ProjectMeta` 加 `story` + `from_dict`, student-app 反代靠
  `p.__dict__` 自动透传。
- 反代 `api_library_file`: `story/` 路径开公开例外 (橱窗资源, 无需登录/Pull, 跟
  cover 同性质)。
- 前端: `StoryFrame` 类型; `StoryModal.tsx` (全屏连环画, 翻页/键盘/圆点进度/双语);
  ProjectCard 右上 BookOpen icon (仅有 story); 详情页 hero "看项目故事" 按钮。
- 内容: mars 5 幕双语文案 + 5 张图 (1000px JPEG, ~340KB/张) 入包 `story/` + 重发布。
- 测试: `tests/test_library_story.py` (8) + `tests/student/test_library_proxy.py`
  story 3 例; Playwright 端到端验证 icon/弹窗/翻页/图加载/详情页按钮。

> 实现选择: 图用 JPEG (非设计稿的 .png), 1000px 压缩, 体积省 6 倍, 插画无损。

## 背景 / 问题

项目详情页有完整介绍 (各方面信息), 但不够直观。希望每个项目用 ~5 张图 + 简短双语
文案, 像连环画/故事板一样, 几屏讲清楚: **这是什么、目的、大概怎么实现、你会做出什么**。
- 项目卡片加一个小 icon, 点击弹出连环画 (图 stream, 左右翻页)。
- 项目详情页加一个按钮, 随时再看。

## 决策 (已与用户确认)

1. **图 + HTML 叠加文案**: 图为纯插画 (无字), 每张配 标题 + 说明, 前端 HTML 渲染
   (可双语、清晰、改文案不重生图)。
2. **文案来源**: Claude 读项目 README 写 5 幕双语文案 + 对应图 prompt; 用户生图。
3. **存储**: 复用 cover 模式 — 图存项目包 `story/`, manifest 加 `story` 字段。
4. **先 mars 跑通**, 功能代码通用, 再批量补其余项目的图+文案。

## 数据模型

### manifest.json 加 story 字段
```json
"story": [
  {
    "image": "story/story-1.png",
    "title_zh": "...", "title_en": "...",
    "caption_zh": "...", "caption_en": "..."
  },
  ... 共 ~5 张
]
```
图文件存项目目录 `story/story-1.png ... story-5.png` (打包进 tarball)。

### library 端
- `manifest.py`: ManifestModel 加 `story: list[dict] | None`。
- `models.py`: Project 加 `story = Column(JSON, nullable=True)`。alembic 迁移 (library 用 SQLite, init 建表; 生产 library 也 SQLite — 加列需 migration 或 recreate; 见实现)。
- `importer.py`: 把 manifest.story 存进 Project.story。
- 公开 API (`/v1/projects` 列表 + `/v1/projects/{slug}` 详情) 返回 story。
- 图复用现有 `/projects/{slug}/files/{file_path}` 端点 (无需新端点)。

### student-app 反代
- 列表/详情透传 story 字段。
- 图 URL: `/api/library/projects/<slug>/files/story/story-N.png` (经反代)。

## 前端

### 类型
`LibraryProjectSummary` / 详情类型加 `story?: StoryFrame[]`:
```ts
interface StoryFrame { image: string; title_zh: string; title_en: string; caption_zh: string; caption_en: string }
```

### 组件
- **StoryModal**: 全屏弹窗, 逐帧显示 图 + 下方双语 标题/说明, 左右箭头 + 圆点进度,
  键盘 ←/→ 翻页, ESC/点遮罩关。图 src = library files URL。复用 lang (全局 i18n)。
- **卡片 icon**: ProjectCard 右上角加 BookOpen icon (仅当 project.story 非空),
  `stopPropagation` 避免触发卡片跳转 → 打开 StoryModal。
- **详情页按钮**: 加 "看项目故事" 按钮 → 同一 StoryModal。

### 落地点
- `ProjectCard` (library/page.tsx): 加 icon。
- 详情页 (library/[slug]/page.tsx): 加按钮。
- 新建 `StoryModal.tsx`。

## 内容 (先 mars)

Claude 给 mars 5 幕双语文案 + 图 prompt → 用户生图 → upload 到 mars 项目包 `story/`
+ 更新 manifest.story → 重发布 (publish-prod / 手动)。

## 非目标

- 不做后台自动生成文案 (Claude 手写)。
- 不做 story 编辑 UI (内容在项目包里, 随项目发布)。
- 首版只 mars; 其余项目后续补图。
- 无 story 的项目: 卡片不显示 icon, 详情不显示按钮 (优雅降级)。

## 验收

- mars 卡片有连环画 icon, 点击弹出 5 帧故事, 可翻页, 双语文案
- 详情页有"看项目故事"按钮, 打开同弹窗
- 无 story 的项目 (purpleair/eeg/ai-ant 暂无图) 不显示 icon/按钮
- 图经 library files 端点正常加载
