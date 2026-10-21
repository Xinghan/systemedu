# 2026-10-21 项目线生产同步验收

发布记录：`docs/deployments/2026-10-21-mission-sync.md`。

| 文件 | 内容 |
| --- | --- |
| source-reconciliation.json | 生产与本地源码差异核对 |
| deployed-manifest.json | 实际部署源提交、旧 Build ID、归档和逐文件 SHA-256 |
| server-verification.json | 新 Build ID、705 个差异文件校验、后端源码未变 |
| public-build-verification.json | 公开 HTTPS 页面包含实际部署 Build ID |
| core-verification.json | 原节点覆盖、内容指纹、前置关系与记录兼容检查 |
| type-verification.json | TypeScript 基线 6 条、当前 6 条、新增 0 条 |
| course-inputs.json / course-verification.json | 三门课程导入源、节点数和线上课程树散列 |
| candidate-verification.json | 隔离候选真实浏览器检查 |
| production-verification.json | 公开域名真实浏览器检查 |
| production-*.png | 等待首屏图片完成后的生产实际截图 |
| candidate-*.png | 切换前候选快照，部分截取时背景仍在下载 |
| verify-browser.cjs | 只读浏览器验收脚本 |

浏览器检查覆盖七条项目线、三门大课程入口、40 段视频的范围请求与字幕、五位研究员的实际播放、390px 布局及预览限制。报告的 passed 字段是是否完成验收的依据；测试没有提交学习记录，没有用模拟数据替代真实课程 API。

这批验证没有逐一播放所有课程节点的所有媒体，也没有替代实物硬件验证。Lightkurve 课程独立上线，任务线逐节点整合仍待后续工作。
