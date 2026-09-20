# 学生课堂、作业与测验记录持久化

Status: implemented locally (2026-09-20), pending production deployment

用户要求检查既有保存机制并补齐作业、测验、考试等数据。审计发现聊天已落库；exercise_attempts 有写接口但页面使用不完整、缺少恢复；assignment_submissions 只有预留表；gateway 的提交和问答评判仍为空实现；引导课程使用匿名浏览器记录。

目标：课堂输入、作业、测验、考试共用按登录用户隔离的草稿与不可变提交历史。输入自动保存，刷新和另一浏览器可恢复；网络失败明确提示并保留本机草稿；旧匿名记录只能明确导入，不能自动归属当前账号。提交重试幂等，旧设备不静默覆盖新版本。保存答案与评判成绩分离，不把前端自评当考试成绩。

接入驾驶规则学习记录、作业选择/问答和理论测验。保留旧 exercise 接口与历史数据；现阶段没有独立考试页面，本次提供 exam 类型保存/恢复/提交能力并测试，不另造命题、监考或自动阅卷系统。

验收：四种类型数据库保存与恢复；未登录不能读取账号记录；双用户、双设备、内容版本隔离；重复提交无重复历史；冲突不覆盖；提交后再编辑保留历史；不接受客户端冒充服务端评分；浏览器真实请求、刷新、失败、账号切换和下载验证。

## 验收结果与边界

2026-09-20：26 项后端测试通过（含事务失败回滚、考试不写练习正误、并发重试），8 组真实本地 API / PostgreSQL / Chromium 验证通过，7 组匿名课程回归通过。新增及主要改动组件 ESLint 通过。全量 TypeScript 仍有既存 slide-demo 和课程生成接口签名问题，与此次保存接口无关。

项目交付页原本调用不存在的 gateway 方法，现改为统一记录服务，支持成果清单、文字反思及作品链接。未实现文件上传或自动评阅；保存不触发节点掌握标记。原 exercise_attempts、聊天和预留 assignment_submissions 表保留，未伪造历史迁移。

表：learning_drafts 保存最新草稿；learning_submissions 保存每次原始提交。单请求最多 256 KB、200 个答案；历史接口展示最近 50 次，数据库保留更早记录。浏览器账号缓存用于断线恢复；匿名记录不自动绑定登录用户。页面内存后备最多 100 项，不能替代服务器或刷新后的持久存储。

验证脚本：scripts/verify-learning-records.mjs 读取 /private/tmp/learning-records-e2e.json 的两个专用测试账号 {users:[{id,token},{id,token}]}，凭证不入库；仅在本地临时挂载题目组件并在结束时移除。不得使用真实学生账号运行。证据见 artifacts/learning-records/verification.json 与 artifacts/guided-course/verification.json，内容为自动测试样例。
