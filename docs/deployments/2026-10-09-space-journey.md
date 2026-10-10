# 航空航天项目线任务中心与阶段短片发布

已按用户授权部署。候选环境、正式 HTTPS 浏览器验收及服务器完整性检查全部通过。

- 来源提交：`fa2c82af8b47a9b8caba7e3d92a049ca8107830b`，任务与视频主体来自 `87c8bae48c47b86af569dd325c03c269f5d80e71` 及其前序提交。
- 分支：`codex/idea-experiment-20261008`，本次不合并 main。
- 线上基线构建：`-tVkAQAU5ol1PVAsChFxX`。
- 发布构建：`NxJ-KRI8fPxxmEY3y8NzF`。
- 发布入口：<https://systeme.xin/mission/space>。
- 服务器发布目录：`/opt/systemedu/releases/space-journey-20261009`。

## 范围与兼容

从 Git 导出相对 `d63b5e89` 的 71 个前端增量文件：覆盖整条航空航天项目线的任务中心、8 站地图、课程往返入口、原始序章与五段阶段短片。五段短片均为带音轨的 1080p MP4，约 20–25 秒，另附中文字幕。首次到达对应阶段自动弹出，同一浏览器不反复打断；支持跳过和重播。浏览器限制自动播放时显示播放按钮。

以生产现有前端为基线，在隔离目录三方合并，保留原有分类、课程展示和非航天项目线名称。本地早先检查点中的其他课程与分类变更不包含在本次发布中。旧生产课程清单缺少封面字段的问题已修正为读取现有压缩封面映射。

不执行数据库迁移、课程导入或学生记录写入。切换前核对整个前端及后端、公开课程清单、pvlib 课程文件指纹；保留旧静态资源和完整前端备份。候选构建与生产基线均有 3 条已有类型诊断，没有新增错误。

## 验收方法

候选通过 SSH 隧道仅对验收端开放；公开接口使用生产匿名 GET，不发送模拟令牌或写入学生记录。浏览器检查覆盖五段视频实际播放、字幕、Range/快进、播放完毕返回、首次弹出与同阶段去重、8 站地图、原有课程正文/视频/资料/学习记录入口、3 分钟交互、制造任务中心，以及 390 / 320px 布局。

候选视频曾等待超时：诊断时 `paused=false`、`readyState=0`、无缓冲、无媒体错误。服务器本机完整响应首段 2,983,428 字节仅需约 0.02 秒，定位为预览隧道加载等待；验收不再等待整页背景图片加载，并给予媒体充足传输时间。正式 HTTPS 首次验收在快进后等待末尾视频片段时超过 30 秒；当时无媒体错误、视频处于请求加载状态。额外检查首段及末尾 64 KiB 均返回正确的 206，末尾请求约 4.70 秒。脚本调整为确认播放后暂停再检查 HTTP 响应，快进时给予至多 120 秒加载时间，并避免截图等待尚未结束的字体请求。这里没有给出用户端启动延迟或性能达标结论。

候选与正式站均完成五段短片验收，浏览器应用错误为零；390 / 320px 未发现横向溢出。三个生产服务均正常，后端、公开课程清单及 pvlib 课程文件与发布前一致。预览服务和 SSH 隧道已关闭。

证据保存于 `artifacts/space-journey-release-20261009/`。结果以该目录候选、正式站和服务器报告为准。真实 iOS Safari 设备未覆盖；自动播放受各浏览器系统策略约束，受限时仍需点击播放按钮。

## 操作与回滚

```sh
python3 scripts/releases/prepare-space-journey-20261009.py
bash scripts/releases/space-journey-20261009.sh upload
bash scripts/releases/space-journey-20261009.sh stage
bash scripts/releases/space-journey-20261009.sh build
bash scripts/releases/space-journey-20261009.sh preview
bash scripts/releases/space-journey-20261009.sh tunnel
node scripts/releases/verify-space-journey-20261009.mjs http://127.0.0.1:14909 candidate NxJ-KRI8fPxxmEY3y8NzF
bash scripts/releases/space-journey-20261009.sh verification-evidence
bash scripts/releases/space-journey-20261009.sh publish
bash scripts/releases/space-journey-20261009.sh verify
node scripts/releases/verify-space-journey-20261009.mjs https://systeme.xin production NxJ-KRI8fPxxmEY3y8NzF
bash scripts/releases/space-journey-20261009.sh reports
```

脚本仅用于这一次发布，拒绝覆盖后续变更。原前端保留为发布目录中的 `student-web-before`。如需回滚，使用 `bash scripts/releases/space-journey-20261009.sh rollback`；脚本检查前端未被后续修改后才恢复。生产切换时停止候选服务，只有前端需要短暂重启。
