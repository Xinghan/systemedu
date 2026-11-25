# iPad 项目首页与图片导航验收

日期：2026-11-25。设备：iPad Air 11-inch (M4)，iOS 27 模拟器。

## 导航结构

“我的项目 / 项目库 / 学习记录”是 App 一级入口。星际远航项目内分为项目全景、阶段任务和原统一课堂。项目全景使用原阶段图片和真实影片封面，阶段任务使用原子项目封面；长篇项目说明移入“了解项目”，课节按子项目展开。阶段结束先进入下一阶段介绍，再开始课堂。

第一次进入：我的项目 → 星际远航 → 进入第一阶段 → 启程观测港 → 开始本阶段 → 第一次观测。之后选择行星研究或探测工程；工程方向进入第二阶段“任务设计所”。有记录时可继续当前阶段和课节。

## 验收截图

- [App 首页](app-home.png)
- [项目全景](project-overview.png)
- [竖屏项目全景](project-overview-portrait.png)
- [第一阶段](first-stage.png)
- [第二阶段](second-stage.png)

图片来自 XCTest 的真实模拟器截图附件。横屏四张取自最后一次导航流程复验；竖屏取自完整回归。

## 验证结果

- 7 项共享内容检查：原节点、版本、影片、课程资源、两方向入口和逐节点去向覆盖。
- 17 项原生测试：离线封面、完整课程、记录版本隔离、继续学习、保存恢复、实验工作区及资源安全。
- 5 条 iPad 界面流程：App 首页与项目库、第一至第二阶段；第一次观测后的两条方向；横竖屏、影片、地图与原课堂；档案重启恢复；凌星观测资料和笔记恢复。
- 最后调整后单独重跑首页至第二阶段流程，包含“从项目库进入项目后返回我的项目”的检查。
- 与改版前 Git 内容比较：原 modules、stations 和 version 完全一致；去向表覆盖原有全部 120 个活动 ID，并补列 6 个旧版活动 ID。未迁移或重编号学习记录。

```sh
node --test packages/learning-runtime/tests/ipad-mission.test.mjs
xcodebuild -project packages/ios-app/SystemEdu.xcodeproj -scheme SystemEdu \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=514BC1A2-E3D6-47CE-B4C6-823459A82BEB' \
  -derivedDataPath packages/ios-app/build/DerivedData -parallel-testing-enabled NO \
  -only-testing:SystemEduTests -only-testing:SystemEduUITests/TabletMissionTests test
```

最后复验将 `-only-testing` 换成 `SystemEduUITests/TabletMissionTests/testProjectHomeLibraryAndVisualJourney`。Xcode 测试结果保存在本地 `packages/ios-app/build/DerivedData/Logs/Test/`。

[完整逐节点去向表](../ipad-mars/node-destinations.md)。本轮为模拟器导航与兼容性验收，未进行全部课程逐节教学验收。
