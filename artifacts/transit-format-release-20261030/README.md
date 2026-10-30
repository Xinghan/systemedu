# 凌星调查格式修复发布证据

发布源 `141cbed5b3e090471fbee9b33968f695599c8d11`；生产构建 `UgihOHSw-XeycGxl60dQP`。

- `request.json`：13 个前端源码/素材的发布散列与归档散列。
- `build-verification.json` / `build.log`：隔离生产构建与真实字体复用记录。
- `candidate-verification.json`：正式课堂回归与两路线版式对比的汇总，切换前必须全部通过。
- `candidate/verification.json`：32 节统一课堂、内容版本、讲课、实验产物恢复、下载与任务进度隔离；登录数据为隔离夹具。
- `server-verification.json`：源散列、三个线上服务状态及学生后端未改动。
- `production/verification.json`：真实公开域名课程树、任务恢复、手机页面、登录回跳及实际 Build ID。
- `../transit-format-20261030/candidate/` 和 `production/`：桌面及 390/320px 版式对比、地图/简报操作、原火星视频播放的报告与截图。

素材位置及内置 imagegen 的完整提示词见 `../transit-format-20261030/image-provenance.json`。最终发布范围、验证边界与回滚见 `docs/deployments/2026-10-30-transit-format.md`。
