# M88 / M89 表格和证据卡片布局修复

## 范围

截图为 M89 第 1 页：左侧规则表溢出，被右侧说明卡遮住。1280px 浏览器下预览正常，但 800px 视口、实际 slide 内容宽度 658px 时可复现：左卡 clientWidth 318px / scrollWidth 365px，表格宽度 346.63px。

根因是共享 `.se table` 的 `white-space:nowrap`、卡片 min-width 约束缺失，以及按浏览器而非课文容器宽度决定两栏。

唯一发布文件：`src/components/learning/diversity-rejection.css`。

- 文本表格固定布局并允许换行，不缩小字体、不隐藏证据。
- 卡片及网格子项 `min-width:0`，长字段可断行。
- 命名容器查询：内容宽度 ≤850px 时证据卡改单栏，≤620px 时调整结构和统计网格。
- 相似度矩阵保留专用固定网格，精确公式和交互算法不变。

课程数据、正文、音频、JS 组件、依赖和首页均不变。局部预览宽度控件、回归测试与发布脚本只在开发/发布目录使用，不加入生产前端补丁。

## 本地验收

- 66 项相关测试通过（含 4 个新增 CSS 规则回归）。
- 真实浏览器在 1280px 视口下，把预览内容区设为 1152/960/720/480px，M88/M89 共22页 ×4尺寸 =88状态，无卡片、表格、表格单元格或结构网格横向溢出。
- 390px 手机视口补查22页，同样无上述溢出。
- M89 放大浮窗11页：slide表面 scrollHeight 与 clientHeight 相同，完整显示在视口中。
- M88 默认浮窗11页：表面无内部竖向滚动、无超出拟合区域的裁切。
- M89 交换规则顺序后首条拒绝由分子量变成logP，5.2 >5、差0.2；M88 矩阵点击 D01×D04 后标题和结构更新，T=0.273。
- 控制台未见错误，截图已人工检查双栏、单栏、矩阵与放大浮窗。临时视口覆盖已重置。

## 发布门禁与记录

目录：`/opt/systemedu/releases/slide-layout-20260909`。
基线 Build ID：`vmjD0lyGWkm0wfjQ9HWyU`。
候选 CSS SHA256：`4c97c46001d93a9294941a5bd6b2cc36c44375c6224b6b79fea01d52c656f938`。

以线上代码在服务器本地复制构建。哈希白名单只允许上述一个 CSS 改变；课程哈希原样保存并逐步检查。不下载生产源码或业务日志。切换失败自动恢复原版。

首次两次隔离测试因测试入口依赖本地路径/开发预览文件而失败，均发生在构建与上线切换前，未影响线上。最终复用上次 reader 发布已验证的生产专用测试（只测试实际发布的组件）；开发预览的检查保留在本地测试与浏览器验收中。

## 完成状态

2026-09-09 已完成正式切换及验证。Build ID：`ea4FB-hqZCwxNKu7J5oIs`。

- 服务器生产专用检查11项全部通过，候选构建和本机4001端口 smoke通过。
- 正式版本 `verification.json` 确认只改变上述一个 CSS；`course_unchanged=true`、`reader_and_renderers_unchanged=true`，CSS 哈希与本地完全一致。
- 公网资源 `/_next/static/chunks/ebabc98c79b179d1.css` 返回56852字节，包含命名容器及850/620px适配规则。
- 公网首页、M88、M89均HTTP200；web/backend/library全部active，backend健康检查 `ok=true`。
- 回滚备份保留在 `/opt/systemedu/releases/slide-layout-20260909/student-web-before`，原版 Build ID 为 `vmjD0lyGWkm0wfjQ9HWyU`。

生产浏览器未提供登录态，故不声称完成登录态逐页视觉验收；视觉检查来自同一CSS哈希的本地组件，生产验证为源文件/构建资源哈希、服务与HTTP响应。

用户验收入口：`https://systeme.xin/learn/molecule-monster-hunter/M89`，第1页。刷新后，宽屏两栏、窄内容区上下排列，规则表和长字段应完整可读。
