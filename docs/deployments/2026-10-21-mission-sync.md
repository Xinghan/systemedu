# 2026-10-21 项目线代码同步与生产发布

## 发布范围

本次按用户授权同步本地当前工作分支与生产，并部署已经生成的内容。没有发起新的视频或图片生成任务，没有合并 main。

- 前端源提交：`4f90aa9a5d0d826af98b2c734662110e8a86fd2c`。
- 前端分支：`codex/energy-robotics-integration-20261016`。
- 生产 Build ID：`KIPQEoWRY1bsS7coKfEuQ`。
- 发布差异：705 个前端源码、配置和静态资源文件；逐文件 SHA-256 见 `artifacts/mission-sync-release-20261021/deployed-manifest.json`。
- 七条项目线使用本地当前任务编排、地图与任务中心；同步既有 40 段带研究员的阶段短片及字幕。任务中心背景继续使用无人科研场景。
- 保留生产现有登录入口；没有启用尚未部署的邀请申请 API。
- 后端源码散列与发布前一致，未执行数据库 schema 迁移。仅通过既有课程增量导入流程添加课程内容，没有执行学生学习记录写入。

## 增量课程导入

| 课程 | 正式目录 slug | 节点 |
| --- | --- | ---: |
| ALOHA 双臂模仿学习 | aloha-bimanual-apprentice | 82 |
| TeachOpenCADD 候选分子研究 | teachopencadd-candidate-research | 46 |
| Lightkurve 系外行星凌日研究 | lightkurve-transit-detective | 32 |

三个完整课程均已存在本地源内容，本次补齐原来缺少的生产课程入口。远端课程树与源文件 SHA-256 一致，API 节点数共 160；没有删除、替换其他课程。ALOHA 源目录逐字节归档至 systemeduidea 的 `64bdda215aee0bba3c307decdb2af6aedde14371`，分支 `codex/energy-project-line-20260921`。原稿已有空白行格式警告保留，未为归档重排正文。

## 验证范围与边界

- 编排回归通过：星际远航、分子寻药、未来能源/机器人、其余项目线；校验原节点覆盖、源内容指纹、前置任务与历史学习记录兼容。
- 隔离候选构建通过；生产服务与源码散列验证通过。前端、学生后端和课程库服务均 active。
- TypeScript 独立校验与生产基线相同：6 条既有错误，新增 0 条，并非全量零错误。
- 候选浏览器检查通过：七条任务线的首页与任务中心、三门课程的正式入口和课程树、40 段短片的 Range/fast-start/字幕、五位研究员的实际视频播放、390px 手机布局、生产预览入口关闭。没有浏览器运行异常。
- 公开域名浏览器验收同样通过；公开 HTML 确认新 Build ID。结果与截图另见 `production-verification.json` 和 `production-*.png`；以报告 passed 字段为准。验收使用实际 API，没有模拟课程响应，没有提交学生作业。
- 截图使用字体加载完成等待的测试豁免，保留浏览器实际可见字体；生产截图显式等待首屏图片下载完成。
- Lightkurve 已可在课程库独立学习，32 个节点仍未逐节点纳入星际远航任务地图。本次没有声称补齐该编排缺口。
- 本次是发布与内容完整性验证，不代表硬件课程已完成实物验证，也没有逐一重验所有课程的全部交互。

## 本地与生产保护

使用独立 worktree `/Users/xinghan/.codex/worktrees/energy-mission-journey/systemedu` 发布。原 checkout `/Users/xinghan/Dev/systemedu` 及 systemeduidea 中其他任务的未提交改动均保留，不用全量暂存、不强推、不覆盖。

服务器先在隔离候选目录构建和验收，再切换前端。旧静态资源继续可读，上一版完整前端保存在 `/opt/systemedu/releases/mission-sync-20261021/student-web-before`。回滚脚本会先确认当前版本未被其他发布修改，然后恢复旧目录：

```sh
bash scripts/releases/mission-sync-20261021.sh rollback
```

证据位于 `artifacts/mission-sync-release-20261021/`。部署后提交仅增加验收脚本、记录和截图，不改变已发布前端源码。
