# 2026-10-30 Lightkurve 整合发布

按用户“现在进行线上部署吧”的授权，将已完成的 Lightkurve 整合发布至 https://systeme.xin。

- 课程入口：https://systeme.xin/mission/space?route=transit
- 正式课堂示例：https://systeme.xin/learn/lightkurve-transit-detective/M24?mission=space
- 仓库分支：`systemedu / codex/lightkurve-integration-20261029`。
- 已发布前端源提交：`71f2cb155aa16aaa6faaecb2a5c5fde4dada9380`。
- 新 Build ID：`XV7rwDUC6XSwtnCbtgns3`；上一版：`KIPQEoWRY1bsS7coKfEuQ`。
- 25 个前端文件来自已提交的整合差异。每个被覆盖文件均先与基线提交及生产文件散列比对；没有覆盖生产漂移。发布记录提交只增加脚本和证据，不改变这次前端构建。

## 已发布内容

Lightkurve 的 32 个原节点按六个阶段接入星际远航，使用正式统一课堂。原火星车路线的 85 个来源节点、8 个任务站、88 张任务单保持一致；两条路线独立计算进度，共用任务存储时保留彼此记录。

原课堂正文富媒体入口、讲课模式、笔记、作业及实验产物继续使用原位置。记录 ID、内容指纹以及 M24/M25 冻结与首次验证协议保持兼容。

## 验证结果

- 路线、任务操作及学习记录 session 回归全部通过，验证原节点覆盖、跨课程隔离、历史记录恢复和计时规则。
- 隔离目录生产构建通过。Google Fonts 外网下载超时后，复用上一版已发布的三种字体、16 个真实 WOFF2 文件；校验文件头和 SHA-256，没有用虚拟字体字节替代。CSS、字重、子集及预加载从原发布资源保留，未修改课堂源代码。详见 `build-verification.json`。
- 课程库已有版本 `0.2.0`，477 个已导入文件与本地源完全一致，未重新导入课程。真实服务间接口读取 196 个课堂、资料、实践包和保留观测文件，逐个返回 200 且散列匹配。
- 候选浏览器：32/32 正式课堂导航、统一阅读器、正文媒体、原笔记/作业版本、讲课内嵌与浮窗、实践包下载通过。M01 操作产物保存恢复、M24 冻结后才能请求 Q4、M25 恢复锁定参数及首次结果通过。125 次记录范围检查，无未处理接口或页面异常。
- 候选与公开域名浏览器：六阶段地图覆盖全部 32 节，任务证据刷新与路线切换后恢复；凌星 `1/32` 与火星车 `0/62` 独立。1440px 和 390px 检查通过，无页面横向溢出；正式课堂也通过 390px 检查。
- 公开课程树 32 节；未登录的课程文件、实践包和 Q4 请求均返回 401；正式课堂登录回跳保留 `mission=space`；预览入口返回 404。
- 公开 HTML 包含新 Build ID；前端、学生后端、课程库服务均 active；前端散列与候选一致，学生后端源散列未变。

## 验证边界

公开页面与课程库读取使用真实生产接口。登录课堂的浏览器保存/恢复使用已校验源文件及隔离接口夹具，明确验证前端协议，不冒充真实账号端到端写入验收。没有创建学生账号、提交学生作业或修改学习数据库，也未执行 schema 迁移。

独立完整 TypeScript 检查仍有上一轮已记录的六个基线错误；本批前端源未再改动，生产构建沿用既有 `ignoreBuildErrors` 设置。详见 `artifacts/lightkurve-integration-20261029/typecheck.txt`，不能将生产构建通过表述为全量类型检查零错误。没有新增音频播放或实物科学验收的声明。

## 回退与保护

发布前在 `/opt/systemedu/releases/lightkurve-20261030/packages/student-web` 构建和验收，切换前再次校验线上基线，保留旧静态资源供已打开的页面使用。上一版完整前端在 `/opt/systemedu/releases/lightkurve-20261030/student-web-before`；持久回滚脚本为同目录 `release.py`。回滚先确认没有后续前端发布覆盖当前版本，再恢复旧目录并检查服务健康：

```sh
SYSTEMEDU_DEPLOY_SECRET=/absolute/path/to/deploy-secret.local \
  bash scripts/releases/lightkurve-20261030.sh rollback
```

本次在独立 worktree 完成，原 checkout 的未提交工作保留，没有合并 main、强推或修改远程配置。证据与截图在 `artifacts/lightkurve-release-20261030/`。
