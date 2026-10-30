# Lightkurve 生产发布证据

2026-10-30，发布源 `71f2cb155aa16aaa6faaecb2a5c5fde4dada9380`，生产 Build ID `XV7rwDUC6XSwtnCbtgns3`。

- `request.json`：25 个已提交前端文件的 SHA-256、包散列及基线提交。
- `build-verification.json` / `build.log`：生产构建、三种既有真实字体的复用证据。
- `course-hashes.json`：生产课程的 477 个文件散列，全部与本地源一致。
- `library-verification.json`：196 个真实课程库接口读取与散列校验。
- `candidate-verification.json` / `candidate/`：32 个正式课堂、保存恢复、原讲课模式、实践包、手机页面检查及截图。
- `production/verification.json` / `production/`：公开域名 Build ID、真实公开接口、六阶段地图、任务中心、手机页面与登录回跳检查。
- `server-verification.json`：生产源文件一致、三个服务 active、学生后端源未变。

课堂登录测试使用隔离 API 夹具，未写入真实学生数据；公开域名检查使用真实匿名 GET，任务自检只在验收浏览器中保存。完整说明及回滚方式见 `docs/deployments/2026-10-30-lightkurve-integration.md`。上轮六个既有类型错误仍保留，不把生产构建通过等同于全量类型检查通过。
