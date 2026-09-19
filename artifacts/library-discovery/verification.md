# 项目库改版验收

2026-09-19 本地验证。当前版本是本地实现，尚未发布生产。

## 已验证

运行 `node scripts/verify-library-discovery.mjs`：10 组检查通过，浏览器运行错误列表为空。原始数据见 [verification.json](verification.json)。

1. 读取真实课程列表，默认显示可开始内容；太空探索为首屏主题入口。
2. 项目库可以直接打开三分钟观测台和主题项目线。
3. 类型切换、引导/组装规划提示、重置可用。
4. 搜索、领域、工程深度、排序与空态正常。
5. 草稿可按需显示，但不能打开尚未发布的课程；兼容 Biotech 领域和旧字符串成果数组。
6. 原有故事弹窗和完整课程详情可达。
7. 中英文、1440 像素桌面与 390 像素窄屏通过，类型栏只在自身横向滚动；手机首屏可见开始按钮。
8. 模拟内容 API 503 时短体验仍可用，重试能恢复课程。
9. 顶栏只保留项目库；页内两种视图可切换，保留查询与难度筛选；键盘、浏览器前后退、刷新、未知视图参数均正常。旧项目线路由与游戏返回都进入 `/library?view=lines`。
10. 项目线内容支持中英文与 390 像素窄屏；主项目卡片标题对比度达到 4.5:1。

页面截图：`library-desktop.png`、`library-english.png`、`library-mobile.png`、`library-mobile-first-screen.png`、`guided-planning.png`、`project-lines-desktop.png`、`project-lines-mobile.png`、`project-lines-english.png`。这些截图是开发验证产物，不代表儿童试用证据。

## 静态检查与限制

变更页面、卡片、内容目录、数据适配、文案及导航文件的 ESLint 通过。

执行全量 `tsc --noEmit` 时，现有 `slide-demo/page.tsx`、`assignment-view.tsx`、`capstone-submission-panel.tsx`、`course-content-view.tsx` 仍有类型错误；输出未包含本次新增或修改的发现页文件。未改动这些独立学习组件。

Git 曾被 Xcode 启动器的许可检查拦住，现已通过用户目录的包装器调用独立 Command Line Tools 恢复。服务继续在本地运行。

## 产品边界

主题入口采用已实现的 `spot-a-world`；15 分钟和组装层仍为规划。完整课程继续使用内容服务的发布状态和元数据，不根据“8 个项目”的愿景填造数量或发布状态。时长与工程深度分别展示，现有 1–5 分表示工业/科研深度，不作为年龄分级。

下一次真实试用重点：孩子能否先点三分钟入口；能否说出短体验与完整项目的差别；完成后是否自然地愿意查看主题线。后续是否增加主题与短项目，需要根据内容制作和试用再决定。
