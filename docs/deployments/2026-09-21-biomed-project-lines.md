# 生命解码局与五级项目线发布

2026-09-21 已发布至 https://systeme.xin。正式构建 `rZ1JTOMyEJKojtp-WxFwN`，上一构建 `PtSYpCT6P2w6KjuGy7hs_`。内容来自 `b20bd498`，并包含 `b28bf186` 的封面加载修复。

入口：
- https://systeme.xin/library?view=lines&line=biomedicine
- https://systeme.xin/explore/biomedicine/build-a-candidate-filter?node=M01

本批上线两个短体验、四门多节点课程，共六个项目、19 个课程节点和四份最终作品。包含已确认的微观分子封面、教材与参考视频、结构化记录、理解自检及可阅读的交付报告；项目库按 01–05 展示。原旗舰课程继续通过内容服务提供。

## 范围与数据

以实际生产前端为基线，应用 `134b7a33..b28bf186` 中本功能的 95 个文件。逐个核对文件哈希后隔离构建，其他课程阅读器、编号逻辑、依赖、后台服务保持生产版本。本次没有数据库迁移，没有重新导入旧 Library 课程，也没有修改真实学生作业。登录后的保存继续使用现有 learning_records 服务。

仅携带当前被引用的七张 `cover-molecular-v5.png`，保留线上旧封面以兼容已经打开的页面。项目卡片使用 Next 图片压缩和延迟加载；实测筛选器封面原图 2,506,695 字节，640 像素 WebP 响应 34,468 字节。保留原始生成图和现有构图。

能源线的太阳能、风能、储能和智能控制内容仍是规划，本次未发布；工作区尚未完成的手摇原型和其他未提交功能也未包含。

## 验证

- 候选内容的模型检查通过：80 条真实样本、数据隔离、筛选与预测、预算、接口诊断、版本失效及交付门槛，19 节课程与封面完整性。
- 生产 Next.js 构建通过。候选全量 TypeScript 诊断仍是生产基线的六项已有错误（slide-demo 两项、course-content-view 四项）；新增课程无类型诊断，封面组件修改后的范围类型检查通过。
- 候选和正式 HTTPS 各六组浏览器验证通过：五级项目库及七张封面、19 节教材和参考、3D 操作与观察卡恢复、理解反馈及筛选器交付、草稿与固定报告隔离、390px 布局及 WebGL 降级、原有太空/生物课程和接口访问。页面脚本异常为零。
- 人工检查了项目线图片完整显示、桌面作品报告和手机自检截图。发布时仅使用匿名浏览器记录，没有向生产写入测试作业；账号恢复与隔离在本地真实数据库的既有 12 组验证中已完成，详见 spec 058 验收记录。
- 发布后 web、student-backend、library 三项服务 active，后端健康接口正常。只重启前端，保留旧版静态文件供已打开的页面使用。

首次预览暴露原图并发下载较慢，修复后重新构建和验证；封面验证曾因内容库异步刷新改变图片序号而中断，改为精确定位本批七张封面后完整通过。最终记录在 `artifacts/biomed-release-20260921/preview/verification.json` 与 `production/verification.json`。

这些检查验证软件、内容结构和发布状态；儿童使用时长与学习效果尚待实际试用。

## 留档与回滚

生产发布目录 `/opt/systemedu/releases/biomed-project-lines-20260921` 保存源码清单、构建日志、验证证据及 `student-web-before` 旧前端。最终文件清单同步于 `artifacts/biomed-release-20260921/expected.json`。

执行 `bash scripts/releases/biomed-project-lines-20260921.sh rollback` 可恢复上一个前端；脚本会先确认本批文件未被后续发布覆盖。不回退数据库，不删除学习记录。发布时的失败健康检查也会自动恢复旧前端。

本地准备、远端隔离构建、浏览器验证和发布分别由 `prepare-biomed-project-lines-20260921.py`、`biomed-project-lines-20260921.{py,sh}`、`verify-biomed-release-20260921.mjs` 完成。发布以哈希清单绑定验收版本，不能把整个脏工作区直接上传覆盖生产。
