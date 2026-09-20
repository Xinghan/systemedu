# 项目线与实物探测车发布

2026-09-20 已发布至 https://systeme.xin。构建 `PtSYpCT6P2w6KjuGy7hs_`，上一构建 `i_tYHj9QHmFSxX5dkl0Bx`。

本次上线 spec 048–057：项目库的全部项目 / 项目线视图、五个主题入口、太空短体验和多节点课程、最终作品与账号记录，以及探测车 2.0 八节点和实地远征 2.0 五节点。其他主题的未制作小项目继续显示筹备状态。03 探测车最终要求实物材料；数字原型只作中间阶段。

入口：
- https://systeme.xin/library?view=lines
- https://systeme.xin/explore/space-exploration/assemble-a-rover
- https://systeme.xin/explore/space-exploration/run-an-expedition

## 发布边界

以实际生产源码为基线，三方合并 `260d2c5..f01f224` 的前后端增量，共 255 个文件；另补学习记录请求的 `X-Course-Numbering: consecutive-v2`，与已上线的课程编号屏障兼容。共享课程阅读器保留生产只读课件及连续编号逻辑。没有覆盖工作区的其他未发布改动，没有重新导入任何既有 Library 课程。

哈希清单在 `artifacts/rover-release-20260920/expected.json`。生产归档 `/opt/systemedu/releases/rover-project-lines-20260920` 含最终清单、原源码哈希、构建日志、旧前端和后端改动前文件。前端依赖沿用已上线版本；构建在隔离目录完成，正式切换仅重启 web/backend。

数据库先生成受限权限的 `student-before.dump`，再从 `045_add_invite_codes` 升级到 `047_learning_records`，只新增 `learning_drafts` 与 `learning_submissions`。没有运行无关的 046 迁移，也没有修改真实用户作业。专用两个发布账号及其软件测试作品已清理，实物照片测试使用明确标记的合成夹具。

## 验证

- 候选后端 17 项测试通过；系统耦合、版本失效、证据诊断、交付门槛、固件停止逻辑和四个 STL 网格检查通过。
- 候选浏览器六组核心流程全部通过：13 节教材与参考、旧版回看、数字设计、制造文件与原始证据提交、远征导入、换浏览器恢复、账号隔离和移动端。
- 服务器直连接口检查及正式 HTTPS 检查均通过：classroom / assignment / quiz / exam 草稿、提交、读取、幂等、版本冲突、未登录保护及账号隔离；兼容既有生物医药课程的编号屏障。
- 正式 HTTPS 浏览器复核通过：项目库两视图、三款小游戏、课程、真实 WebGL、工程资料下载、源码和已提交快照恢复、结构展开及无 WebGL 的 SVG 降级。结果见 `production/verification.json`、`production/review-verification.json`。
- 五张项目线生成封面经滚动触发延迟加载后全部解码成功；截图与 `production/covers-verification.json` 保存实际加载结果。
- Next.js 生产构建通过。全量 TypeScript 检查仍有线上基线已有的六项错误（slide-demo 两项、course-content-view 四项）；本次新增课程组件没有类型诊断，沿用原生产构建配置。

预览阶段的依赖软链接限制、候选服务缺少课程编号环境，以及本地 SSH 隧道中断都在切换前处理或隔离。完整核心流程通过后才切换；补充视觉检查最终在正式 HTTPS 域名通过。

参考制造包尚未完成首台实体样机试制；这次验收属于软件和资料检查，不能代替实物试制与儿童试用。

## 回滚

`bash scripts/releases/rover-project-lines-20260920.sh rollback` 恢复旧前端和后端改动前文件；保留新增学习记录表、已写入的学生记录和迁移定义。不得直接用旧数据库备份覆盖继续产生的新学习数据。Library 服务、课程数据库与课程素材没有被本次发布替换。

执行工具：`scripts/releases/rover-project-lines-20260920.{sh,py}`。构建、迁移、预览、验收、发布分别执行；完成后候选服务关闭，正式服务继续运行。
