# 星际远航：首页导航与个人任务体验验收

日期：2026-11-26。设备：iPad Air 11-inch (M4)，`514BC1A2-E3D6-47CE-B4C6-823459A82BEB`。

## 结果

首页当前路线卡原先是没有点击事件的静态视图，已接入同一顺序推进流程。首页补充项目总体说明、分幕地图、14 章独立图片及各章成果。后续章节保持依次解锁。

课堂增加场景图、三步行动、个人卡通形象与实验入口。每个项目实验都有队员操作席；首章望远镜内还有个人观测席和署名照片。真实取景保存后才能整理首章作品，单独标记读完不会进入空交付页。

## 验证

| 范围 | 结果 |
| --- | --- |
| 运行时单元测试 | 26 项通过 |
| TypeScript 类型检查 | 通过 |
| 原生 ExpeditionTests | 6 项通过；1 项真实头像服务测试未启用，跳过 |
| iPad 界面流程 | 7 项不同用例通过，见下方清单 |
| 浏览器横竖屏与失败恢复 | `browser-verification.json`，4 条验收场景记录通过 |
| 既有统一课堂 | `shared-classroom-regression.json`，3 种宽度的笔记、恢复、实验、讲课与表格检查通过 |
| 原节点覆盖 | `node-coverage.json`：120 / 120，去除新增展示元数据后原内容摘要全部一致 |

iPad 用例：身份进入与返回首页；动画介绍与课堂记录恢复；竖屏与空档案；首页当前地图卡进入任务；正文实验按钮进入望远镜；拍照、自查、入档并只解锁下一章；只标记读完仍返回观测任务。

逐节点去向沿用 [原节点映射表](../../../docs/plans/2026-11-26-ipad-expedition-node-map.md)。本批次未删除或重编号原课程节点，也未修改旧版正文、媒体、作业、内容版本和记录标识。

## 截图

- `ipad-project-overview.png`：项目总体介绍与当前任务。
- `ipad-detailed-map.png`：当前地图卡及下一幕任务。
- `ipad-portrait-home.png`：竖屏布局。
- `ipad-personalized-classroom.png`：场景、行动、个人身份与实验入口。
- `ipad-observer-seat.png`：实验中的个人观测席。
- `ipad-signed-photo.png`：实际模拟取景后的署名作品及保存反馈。
- `ipad-signed-delivery.png`、`ipad-next-chapter.png`：交付与下一章。

原生截图中的 Starling 使用内置动漫角色，是隔离测试身份。`classroom-*.png` 与 `signed-observation-*.png` 使用合成测试色块，专门验证自定义头像的数据传递，并非新的角色设计或学生照片。没有使用或提交用户的照片、KK 身份数据或真实学习档案。

## 复验入口

`npm --prefix packages/learning-runtime test`、`npm --prefix packages/learning-runtime run typecheck`；使用已准备的离线包运行 `node scripts/ipad/verify-expedition-orientation.cjs` 与 `node scripts/ipad/verify-mars.cjs`。原生测试运行 `SystemEduTests/ExpeditionTests` 和上列 `SystemEduUITests/TabletMissionTests` 对应用例。

本批次复用既有章节插画与林岚影片；未重生成视频，也未调用真实头像生成服务。
