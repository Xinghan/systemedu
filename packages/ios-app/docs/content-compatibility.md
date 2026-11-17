# iOS 内容兼容性 · 2026-11-17

| 内容 | 来源与标识 | 本批支持 | 后续工作 |
| --- | --- | --- | --- |
| 五指机械手 | 原 `standalone/mechanical-hand`，共享组件 `learning-runtime/src/experiments/mechanical-hand` | 本地 GLB；模型与所选手指控制同屏；关节/对掌/外壳/牵引绳；分步公式解释；参数恢复 | 接入对应正式课程活动；当前为本机独立实验。 |
| 火星着陆 | 原 `standalone/mars-landing`，共享组件 `learning-runtime/src/experiments/mars-landing` | 本地 GLB 动画；同屏五阶段切换与时间轴；部件目录、解释与思考题按需展开；参数恢复 | 对应课堂入口、正式实验产物和课程记录。 |
| 先看路，再决定 | `write-driving-rules / M01 / reflection / classroom / 1.0` | 现有原文 fixture；按语法树分页；表格每行转为字段卡片；目录/资料/笔记弹层；阅读位置与旧笔记恢复 | 完整 GuidedProjectCourse、结构化回答、讲课模式、作业及服务端版本包。 |
| 其余课程 | 当前内容库与 `public/project-lines/` | 尚未接入 App | 按课程逐项检查渲染组件、内容版本、下载依赖及记录语义。 |

首节 fixture 保留既有 scope 用于契约校验。当前原生预览笔记只写 `guest / driving-intro` 的本地记录，没有冒充该课的 reflection 提交。独立实验不生成合格结论、不点亮知识树。

网站与 App 共用内容、Markdown 管线和实验场景；App 另有手机呈现层，避免直接嵌入长网页。当前预览仍未替代正式课堂。完整课程验收仍须覆盖正文富媒体入口、既有讲课模式、学习记录与实验产物恢复、正式资料下载。

外部视频和参考资料通过系统浏览界面打开，需要联网；未包含视频下载、任意代码执行、RDKit 或 JSXGraph 适配。
