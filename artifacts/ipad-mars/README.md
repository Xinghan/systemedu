# iPad 火星探索验收

试学入口：SystemEdu App → 观看序章 → 任务地图 T01。

- `node-destinations.md`：85 个原节点、3 个体验和 32 个拓展节点的去向与原活动 ID；旧版课程仍在项目资料中。
- `content-verification.json`：目录数量、原节点类型、七段影片与字幕，以及源课程原有的待验证衔接项。
- `browser-verification.json`：1194×750、834×1080、600×800 的课堂、笔记恢复、原表格、讲课与实验布局检查。
- `mission-records-verification.json`：真实选址操作、正式本机交付、跨项目关联、档案恢复和源作品不变检查。
- `simulator-*.png`：iPad Pro 11-inch (M5) 模拟器截图；未使用静态网页冒充原生 App 验收。

复现命令在仓库根执行：

```sh
python3 packages/ios-app/scripts/prepare-resources.py
npm --prefix packages/learning-runtime test
node scripts/ipad/verify-mars.cjs
node scripts/ipad/verify-mission-records.cjs
xcodebuild -project packages/ios-app/SystemEdu.xcodeproj -scheme SystemEdu -destination 'platform=iOS Simulator,name=iPad Pro 11-inch (M5)' -only-testing:SystemEduTests -only-testing:SystemEduUITests/TabletMissionTests test CODE_SIGNING_ALLOWED=NO
```

浏览器脚本操作独立的临时测试环境；模拟器测试在本机课程中写入带 `ipad-mars-` 或 `iPad-trial-` 标识的试验笔记。它们不会给学生自动判分。

本轮验收覆盖应用与内容接入，没有逐节重新审定所有课程的科学内容，也没有进行实物车辆测试。账号同步、App Store 与 TestFlight 不在本轮范围。
