# 脑波 M03：首个独立手机动画与游戏

本次仅重做「脑波控制 Minecraft」M03「把脑波画成随时间起伏的一条线」的一段动画和一个游戏。使用 `ios-course-animation`、`ios-course-game` skills，源文件存放在 `systemeduidea` 的原节点内，课堂沿用现有学习记录和媒体入口。

## 查看方式

在 iOS App 的「探索」中搜索 `EEG`，打开脑波项目，选择 M03，再点「动画与互动」。

| 原资源 ID | 保留的课堂入口名称 | 手机内容 |
| --- | --- | --- |
| `anim_1779469418332_jvvy` | 一串数连成波 | 按时间和电压绘制采样点，播放、暂停、逐步回看；在「原理」中比较两种采样率 |
| `game_1779469418332_acvr` | 我的调波玩具 | 根据记录补回三个采样点；拖动或点选后加减；检查、提示、撤销、重试、换一组数据 |

两个手机资源共用坐标计算和本地保存工具，但采用不同的画面和操作。主图与操作保持在同一屏；较长说明放入单独对话框。手机资源打开后占满课堂可用区域，不再叠加桌面资源的全屏按钮和横屏提示。旧资源保持原有展示方式。

## 数据与学习记录

- 数据为构造的教学样例，不是真实脑电记录。256 Hz 下相邻点间隔为 3.90625 ms；七个点的首尾间隔为 23.4375 ms。
- 连线只是帮助阅读，不增加测量。动画播放刻意放慢；128/256 Hz 切换重新解释相同读数的时间间隔，不实施真实信号重采样。
- 游戏只判定这次坐标任务是否完成，不据此判断生理状态或整门课掌握程度。
- 状态键为 `ios:eeg-minecraft-bci:M03:<原资源 ID>:r1`。保留原资源 ID、课节正文、作业和旧记录。游戏保留最近十二次检查记录；撤销针对当前打开期间的操作。JSON 可从「原理」或「玩法」导出。

## 验收与复现

浏览器使用真正的编译后课堂、资源 iframe 和保存桥接，而非独立 HTML 展示壳。运行：

```sh
python3 packages/ios-app/scripts/prepare-resources.py
node scripts/ios-media/verify-eeg-example.cjs
npm --prefix packages/learning-runtime test
```

浏览器检查 320×568、390×704、320×352、704×390：主要操作可见、触控区域、溢出、时间与电压、暂停、完整播放及重播、采样率切换、真实指针拖动、判定、提示、撤销、刷新恢复、JSON 导出和保留旧状态。另检查已加载资源在断网后仍可操作、运行过程没有远程资源请求。

iPhone 18 Pro / iOS 27 模拟器验收：

- `testPhoneEEGAnimationAndGameRestore`：步进、播放、暂停、后台暂停、游戏加减操作、失败与成功反馈、退出 App 后恢复操作结果与历史。
- `testPhoneEEGFinalAnimationPreview`：完整播放到终点、回看与最终画面。
- `testActivitiesAreDiscoverableAndBundledAnimationRuns`：旧版蚁群动画和互动仍可打开。测试明确选择第一阶段，避免已有学习记录令测试进入另一阶段。

截图与摘要见 `artifacts/eeg-mobile-example/`。原始 XCTest 结果保存在本地 `packages/ios-app/build/eeg-mobile-*.xcresult`，不提交大型构建结果。早期一次旧课程回归因测试假设用户停在第一阶段而失败；修正测试入口后复测通过。

手机拖动路径在浏览器自动化中验证；原生模拟器验证可替代拖动的点选加减路径。尚未完成真机、VoiceOver 全流程或低端设备性能测试，不能将本次验收解释为所有课程的手机资源均已重做。

## 版本与打包

源节点的 `mobile/ios/manifest.json` 与 `authoring/ios/<资源 ID>/r1/review.json` 记录文件 SHA-256 和验收证据。资源经过验收后登记为 `verified`，普通构建直接选用；不使用预览草稿开关。原桌面文件和其他课程资源保留。
