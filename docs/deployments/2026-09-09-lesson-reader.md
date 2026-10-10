# 统一课文与幻灯片阅读界面补部署

用户明确授权补部署此前验收的界面：正文上方一个左右切换的讲课播放器、同页正文、幻灯片浮窗、放大自适应。不是把所有 slide 平铺，也不是重新生成课件。

## 发布范围

发布目录 `/opt/systemedu/releases/lesson-reader-20260909`。以当前线上版本为基线，定向补丁，而非上传整个本地 student-web。

实际变更 7 个文件：

- `src/components/learning/course-content-view.tsx`
- `src/components/learning/lesson-slides.tsx`
- `src/components/learning/teacher-scene-view.tsx`（只替换播放器部分；SlideBody 及以后原样保留）
- `src/lib/api/gateway.ts`
- `src/lib/i18n/locales.ts`（仅阅读/播放器文案）
- `src/lib/lesson-slide-layout.ts`
- `src/lib/types/api.ts`（仅课文携带 slides/knode_dir 和来源锚点）

`normalize-slides.ts` 在线上已与本地相同，没有实际改变。未修改首页、邀请码、admin、package.json/lock、其他课件 renderer。未导入课程、未改课程正文、未新增音频、未做数据库迁移。

## 验证

- 本地 62 项相关回归通过；定向组件 lint 通过。
- 服务器针对实际暂存源码运行 7 项轮播/源码检查通过。
- 服务器完整 TypeScript 比较：原版 20 条、候选版 20 条，没有新增诊断。原有错误仍存在，不等于全仓类型检查通过。
- 本地真实浏览器：页 3 打开浮窗仍为页 3；浮窗切页 4、放大后关闭，内嵌仍为页 4。始终 1 个播放器、0 个平铺 slide 卡片。
- 放大后主体无内部竖向滚动，测得内容底部 713.49px 在视口底部 882px 以内。
- 现有 M04 音频：内嵌初始暂停；打开浮窗实际播放 17.44s 的第 1 页音频；第 2 页为 20.96s；关闭浮窗返回第 2 页并暂停归零。无新配音。
- 生产浏览器未提供登录态，因此不声称已在登录态线上逐页验收；生产验证以实际构建、源码、课程哈希和 HTTP 为准。

## 发布中纠正

首个候选 `gn1XuvKKkEvVwXMxG7XhO` 构建通过并短暂切换后，严格源码检查发现 3 个加载/空状态分支残留旧 sceneMode/setSceneMode 引用。立即回滚至 `aYd_CSg6L1f2Yf9XIjW4m`，课程数据未变。

原因：发布补丁中相同前文出现 3 次，应用器把非唯一前文误判为“后文已存在”，跳过了重复删除。改成对预期重复数量做检查并完整替换；新增 AST 旧变量扫描；把该检查移到 patch/build/pre-switch 阶段；另加新旧完整 TypeScript 诊断比较作为发布门禁。

本次发布脚本不应在仍运行时原位编辑；控制脚本上传使用 `.next` + 原子 rename。服务器的旧前端与基线证明保留，没有生产源码或原始服务日志下载。

## 完成状态

2026-09-09 已完成修正版本的正式切换和最终验证。Build ID：`vmjD0lyGWkm0wfjQ9HWyU`。

最终 `verification.json`：`course_unchanged=true`、`existing_slide_renderers_unchanged=true`、`single_carousel=true`，变更仅为上述 7 文件。web/backend/library 全部 active，backend health `ok=true`。公网首页、M88、M04 均 HTTP 200。

回滚资产：`/opt/systemedu/releases/lesson-reader-20260909/student-web-before`（上版 `aYd_CSg6L1f2Yf9XIjW4m`）。新旧 TypeScript 对比、播放器测试、构建日志、基线及最终哈希证明均保存在服务器发布目录。

验证入口：[M88 学习页](https://systeme.xin/learn/molecule-monster-hunter/M88)、[M04 已有音频节点](https://systeme.xin/learn/molecule-monster-hunter/M04)。登录并刷新后，默认页面应显示一个可左右翻页的讲课组件，正文在下方，顶部“幻灯片”打开同步浮窗。没有配音的页仍提示暂无语音。
