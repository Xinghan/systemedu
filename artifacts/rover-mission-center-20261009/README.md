# 探测车任务中心验收

入口：`http://localhost:4000/explore/space-exploration/assemble-a-rover`

节点简报示例：`?node=M04`（诊断）与 `?node=M06`（3D 打印）。

本批只改体验层：保留原探测车 2.0 的三阶段八节点、正文、references、学习视频、工作台、笔记、制造文件及最终实物交付。没有重新生成课程内容或修改 systemeduidea。没有新建课堂媒体 tabs，没有修改任何学习记录 scope 或内容版本。只有这一门课程启用任务中心，旧版与其他课程保持原入口。

## 行为

- 无 node 参数打开任务中心；地图链接和已有 node 深链接继续原课堂。
- 控制室图片、任务搭档、前导短片均复用已有资源；本批图片、配音、视频生成调用数为零。短片明确标为前导模拟任务，制造课要求实物交付。
- 每节新增现场情况、任务行动、明确产物和原正文/工作台/记录锚点。系统测试与制造阶段使用现有地形图/尺寸图作为背景。
- 任务地图反映当前节点记录是待读取、有草稿、已提交或未开始；查看页面或播放视频不会标记完成。
- 作品面板按当前有效设计的原有 prototypeChecks / physicalChecks 计算。数字检查通过不会算作实物交付；提交仍标待评阅，不宣称学会或实体已验证。
- 聚合读取使用 allSettled，记录读取失败显示未知；本机未同步编辑优先显示草稿。账号切换重新载入所属记录。面板只读已有作品，没有第二个可写工作台会话。
- 前导视频按需加载，可键盘 Escape 关闭；关闭/离开/页面隐藏后暂停。视频错误不阻挡课堂。
- 路由和 Suspense 复用既有 LoadingSpinner，替换原先单行加载提示。

## 验证

- `node artifacts/rover-mission-center-20261009/verify-model.cjs`：状态区分、旧版边界、数字检查通过仍不能当作实物交付，PASS。
- `node artifacts/rover-mission-center-20261009/verify-browser.mjs`：桌面/320px/390px、地图导航、实际填写提交、刷新恢复、修改回草稿、原工作台与制造文件下载、视频生命周期与失败、模拟账号隔离和读取重试，PASS。完整结果在 verification.json。
- authenticated 场景使用浏览器拦截的测试账号响应，没有调用真实用户提交接口；访客流程在独立浏览器上下文中操作。digital-fixture.json 和 progress-restored.png 展示的是测试样例，不是真实学生成果。
- 新增/修改 TS/TSX 的 ESLint 通过。全仓 tsc 仍有之前的 6 处类型错误（slide-demo 两处、course-content-view 四处）；本批文件无新诊断，未宣称全仓构建通过。
- 截图目视检查任务中心、手机布局和节点简报；未部署生产，待用户体验验收。
