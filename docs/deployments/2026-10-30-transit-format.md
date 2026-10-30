# 2026-10-30 凌星调查展示一致性修复

用户指出上一版凌星调查未采用火星探索的展示格式。本次修复同一已授权发布任务，将两条路线的展示组件统一，保留各自课程内容与进度。

- 正式地址：[凌星调查](https://systeme.xin/mission/space?route=transit)。
- 前端源：`141cbed5b3e090471fbee9b33968f695599c8d11`，分支 `codex/lightkurve-integration-20261029`。
- Build ID：`UgihOHSw-XeycGxl60dQP`，替换 `XV7rwDUC6XSwtnCbtgns3`。
- 发布 13 个前端文件，逐一比对生产基线及 SHA-256 后导出。未修改课程源、节点 ID、记录 scope、数据库或学生后端。

## 实际变化

两条路线共用 `space-journey-presentation.tsx` 的顶部导航、搭档场景首屏、阶段推进条、下一步推荐、任务站交接说明和课程步骤列表，以及 `space-journey.module.css` 的桌面和手机规则。

凌星仍为六阶段、32 节；新增对应阶段的文字任务简报、原作品档案入口与陪伴指引。地图复用火星探索的拖动、缩放、键盘导航和节点状态展示。任务中心的六个站明确映射到四种既有无人科研环境，避免全部落到默认背景。

通过内置 `image_gen.imagegen` 生成同一虚构林岚角色的凌星观测首屏，以及无人六站研究基地。素材保存在 `packages/student-web/public/mission/space/transit/`：`briefing-v1-1920.webp`、`briefing-v1-960.webp`、`campus-v1.webp`。原始参考角色、完整提示词、导出散列见 `artifacts/transit-format-20261030/image-provenance.json`。六阶段简报为文字，不是新生成的视频；原火星影片保留。

## 验证与证据

- 本地与候选版式检查覆盖 1440、390、320px：两路线对应区域的共享类名、字体、字号、颜色和行高一致；阶段选择、32 个原入口、地图键盘/缩放、简报关闭后的焦点恢复通过，无横向溢出。候选还验证原火星阶段视频能实际播放、切换到凌星时不会保留火星影片状态。
- 候选正式课堂回归覆盖 32 节统一课堂、原内容指纹、正文富媒体、原笔记/作业、内嵌和浮窗讲课模式；M01 实验产物恢复、M24 封存与 M25 首次结果保留、正式实践包 SHA-256 均通过。
- 节点与记录回归确认原 85 个火星来源节点、8 站、88 张任务单保持一致，凌星 32 节完整保留，合计 117 来源/120 任务单；跨路线记录恢复和课程隔离通过。
- 生产源散列与候选一致；前端、后端、课程库三服务 active。课程库无重新导入或 schema 迁移。
- 公开域名最终检查全部通过：`artifacts/transit-format-20261030/production/verification.json`（1440、390、320px 版式、地图、六站背景、简报与原火星影片）和 `artifacts/transit-format-release-20261030/production/verification.json`（课程与任务恢复）的 `passed` 均为 true，同时核对新 Build ID，页面无脚本错误。

构建继续使用线上真实字体文件的离线响应缓存；没有替换字体字节。候选与公开域名首轮截图均曾在等待图片完成时超时。单独检查确认资源返回 200、浏览器实际解码了完整地图；重跑通过全部截图检查。验收脚本保留真实图片载入断言，并在后续超时时输出未完成图片和截图，没有用占位图绕过验收。

## 验证边界

登录课堂保存/恢复使用经原文件验证的隔离 API 夹具，不等于真实账号写入验收。公开页面与文件登录边界使用真实生产匿名接口；没有向学生账号写入测试记录。完整 TypeScript 检查仍有六项既有错误，无本批新增错误；构建沿用已有设置。详见 `artifacts/transit-format-20261030/typecheck.txt`。

## 回退

上一版完整前端保存在 `/opt/systemedu/releases/transit-format-20261030/student-web-before`，回滚脚本在同目录持久保存。执行前先检查当前源散列，拒绝覆盖后续发布；旧静态资源也随本次保留。

```sh
SYSTEMEDU_DEPLOY_SECRET=/absolute/path/to/deploy-secret.local \
  bash scripts/releases/transit-format-20261030.sh rollback
```

本次不合并 main；原 checkout 的未提交工作保留。发布后证据提交不改变前端构建。
