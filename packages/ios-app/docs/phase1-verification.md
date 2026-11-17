# 第一批开发验收 · 2026-11-17

状态：可运行的本地开发预览。目标仍为整个 SystemEdu；本批完成共享渲染与原生基础，未完成账号、正式课程发布版本、全量课程、下载与云端同步。

## 已完成

- 独立 `SystemEdu.xcodeproj`，SwiftUI 的学习、探索、我的三个入口；iPhone / iPad target，最低部署版本 17。
- 机械手与火星着陆源码抽到共享包；网站原入口继续使用相同组件和相同 GLB，没有建立两份实验实现。
- WKWebView 从安装包读取课文、模型、JS、字体；无 Next.js 服务运行依赖。KaTeX 渲染机械手公式。
- 现有驾驶规则 M01 的原文预览与阅读笔记。完整课堂的结构化回答、讲课模式、实验产物和正式提交仍待后续接入。
- 本机 SQLite 记录、账号分区基础、重启恢复、JSON 导出；不上传记录、不声明已评分。
- 桥接口校验会话、活动、方法及消息大小；资源读取限定 bundle 目录，拒绝越界和符号链接逃逸；拒绝用旧 App 打开较新数据库版本。

## 检查结果

| 检查 | 结果 |
| --- | --- |
| 共享包严格 TypeScript 检查 | 通过 |
| 共享包契约与恢复测试 | 4 项通过：异常参数、恢复状态、桥消息、原课程标识与正文一致性 |
| Xcode 模拟器构建 | 通过，Xcode 27.2（27B52） |
| 原生测试 | 6 项通过：资源路径隔离、桥校验、新数据版本保护、超大记录保护、重开数据库与账号隔离、WKWebView 实际读取 GLB |
| iOS UI 测试 | 2 项通过：两个模型加载与控制、阅读笔记在终止 App 后恢复 |
| 原网站生产构建 | 通过，Next.js 16.1.6；既有项目跳过全库 TypeScript 构建错误，共享包另外严格检查 |
| 浏览器回归 | 390 × 844，离线课堂与网站两个模型均可操作；公式无错误、无页面异常、无外部资源请求；本地课堂恢复与笔记重载通过 |
| 部署脚本语法 | `bash -n scripts/deploy-student.sh` 通过；只新增共享依赖安装步骤，没有执行部署 |

设备：iPhone 18 Pro **模拟器**，iOS 27.0，ID `A725290C-9F76-40B0-92A5-534BDCA6DA4E`。本机未连接实体 iOS 设备。未完成真实设备帧率、耗电、低内存、iOS 17 或 iPad 布局验收；不能据此宣称全设备性能达标。Mac 锁屏阻止了前台窗口操作，截图来自成功的 XCTest UI 测试。

共享课堂构建资源约 12.42 MB；本次 Debug 模拟器 App 约 14.71 MB。后者含模拟器构建内容，不是 App Store 下载大小。

## 本次解决的问题

WKURLSchemeHandler 最初返回普通 URLResponse，使 JavaScript fetch 的状态为 0；模型读取方判定失败。已改为返回带成功状态和 MIME 的响应，并增加 WKWebView 真实读取 GLB 的测试。第一次失败测试保留在本地 build 目录，后续完整测试通过。

3D 画布消费拖动手势用于旋转，页面滚动测试改为沿画布两侧拖动；移动端提示同步明确了双指缩放与页面滑动方式。无头浏览器回归采用软件 WebGL，不用其帧率替代真机性能。

## 复现

```sh
npm --prefix packages/learning-runtime ci --ignore-scripts
python3 packages/ios-app/scripts/prepare-resources.py
npm --prefix packages/learning-runtime test
xcodebuild -project packages/ios-app/SystemEdu.xcodeproj -scheme SystemEdu -showdestinations
```

从可用列表选设备，然后执行 `xcodebuild test`，指定 `-derivedDataPath packages/ios-app/build/DerivedData` 与未使用过的 `-resultBundlePath`。本地成功报告为 `packages/ios-app/build/phase1-final-tests.xcresult`。

浏览器回归先启动本地 runtime 静态服务（4181）与网站（4000），再执行 `node scripts/ios/verify-browser.mjs`。结果写入 `packages/ios-app/build/browser-check/`。

## 后续顺序

1. 为现有内容库增加不可变版本包，保留历史记录对应的原内容。
2. 接入原账号与一门完整课程，复用正式课堂的所有既有入口和记录语义。
3. 实现课程下载、离线操作队列、冲突核对和跨设备恢复。
4. 扩充课程与在线能力，补真机和 iPad 验收，再进入发布准备。

## 模拟器截图

[学习首页](screenshots/home.png) · [机械手](screenshots/hand.png) · [火星着陆](screenshots/landing.png)
