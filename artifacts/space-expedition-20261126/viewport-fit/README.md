# iPad 观测台适配与视频退出验收

2026-11-26，iPad Air 11-inch (M4)，设备 `514BC1A2-E3D6-47CE-B4C6-823459A82BEB`。

## 改动

- 打开实验时收起原生课堂导航和章节栏，关闭时恢复；头像、标题和关闭合并为一条顶部栏。
- iPad 观测台按实际可用高度布局，方向、缩放和快门不随说明滚到屏幕外，主要按钮至少 44 × 44 px。
- 横屏侧栏和竖屏紧凑任务区分别适配；保留原场景、操作逻辑、记录及照片导出。
- 视频首次自动播放；退出与跳过始终可见；关闭后再次继续直接进入课堂，结束后显示「进入任务」。

## 证据

`verification.json` 汇总最终原生测试结果。`browser-verification.json` 包含 1180 × 680、820 × 1050、700 × 660 三种尺寸的几何检查、拍照、保存、重开恢复及加载失败重试。`shared-classroom-regression.json` 是原有笔记、讲课、实验、表格的回归结果。运行时单元测试 26 项通过，TypeScript 检查通过。

- `ipad-landscape.png`、`ipad-portrait.png`：模拟器真实横竖屏画面，操作区无需滚动。
- `ipad-saved-photo.png`：实际模拟取景后的保存结果。
- `film-exit-and-skip.png`：隐藏底部播放控件后仍然可用的退出和跳过按钮。
- `film-finished-portrait.png`：竖屏影片结束后的继续入口。
- `observatory-*.png`、`signed-observation-*.png`：浏览器的视口与保存验收截图。

原生测试使用独立 Starling 档案和内置动漫角色；浏览器用合成头像色块验证图片传递。没有使用或提交用户 KK 的照片或学习库。没有删除、重排或修改原课程内容版本；120 个节点沿用 [原去向表](../../../docs/plans/2026-11-26-ipad-expedition-node-map.md)。

## 复验

运行 `npm --prefix packages/learning-runtime test` 与 `npm --prefix packages/learning-runtime run typecheck`。准备离线资源包后，通过 `SYSTEMEDU_IPAD_ARTIFACTS=<输出目录> node scripts/ipad/verify-expedition-orientation.cjs` 检查观测台，`scripts/ipad/verify-mars.cjs` 检查统一课堂。原生用例名称记录在 `verification.json`。
