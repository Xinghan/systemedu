# 我的项目页 API 地址修复验收

线上构建 `9ScDKpY55RhMl093JijA0`，修复源 `1d65f91b318f1a57e76294ed36f1fd1a9cbb0f8f`。

`before/verification.json` 是预期失败的旧构建复现，证明新增检查能发现发往 localhost 的请求。`candidate/` 与 `production/` 均通过，截图中的项目数据来自隔离夹具，未使用或修改真实学生账号。

`build-verification.json` 检查 154 个新 JS；`request.json` 记录三文件发布散列；`server-verification.json` 核对实际线上构建、源码和服务。`classroom/candidate/` 覆盖 32 节课堂、媒体和记录恢复。`unit-verification.json` 覆盖环境变量组合；`lint-baseline.json` 明确既有 lint 问题。

原因、修复和验证边界见 `docs/deployments/2026-10-30-api-origin-hotfix.md`。
