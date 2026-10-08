# 分子猎人 M78 / M85：22 页整节点重做记录

日期：2026-09-08。状态：本地实现与验收完成，待用户预览；**本轮未部署，课程原映射未改，未生成新配音**。

预览：http://127.0.0.1:4173/slide-preview/molecule-batch

## 范围与存放

M78-w0-roc / 11 页：ROC、AUC、阈值与评估证据。
M85-w0-lipinski / 11 页：从结构和描述符到初筛名单。

草稿、原始快照、对应表：`course_factory/fixtures/molecule-monster-hunter/` 下的 `M78-evidence-v2.*`、`M85-evidence-v2.*`、`M78-before-evidence-v2/`、`M85-before-evidence-v2/`。原 slide ID 全部保留。每页教学主张、实体、关系、媒介、交互与替代手段的选择理由均在 registry 文件中；讲稿与新内容同步，旧音频解除绑定。

全项目账本：`molecule-monster-hunter-progress.json`。47 个节点 / 437 页仍未全部完成；M81 上一轮已上线，本轮两个节点仅本地完成。历史工具分类不冒充整节点验收。下一批优先 M86 / M87，把本次筛选证据递进到候选排序。

## Skill 的实际决策

采用 `course-slide-visuals`，从原 slide、讲稿、课文、作业、理论及已有互动中的数据出发。

- M78：JSXGraph 精确坐标 + KaTeX + 排序 / 混淆计数联动；原 8 行数据产生 9 个阈值点。可播放、暂停、单步和重置，不做装饰性转动。
- M85：RDKit 二维结构 + KaTeX + 统一描述符计算 + 全库筛选表；参数扫描、逐行状态和下载证据。
- 本批没有新增生成位图或 3D。已分别考虑物理定向图和空间模型：这两个节点的难点是排序、阈值与集合政策，旋转对象或实物插图无法承担这些精确信息，且没有额外的空间主张。M42 的实物位图与可操作 3D 路线不受影响。
- HTML 并非简单框图：数据、公式、计数、图形、学生动作和产出相连。两节点各有需填写并检查后才能下载的个人证据卡，参考报告与学生提交区分。

## 关键修正与来源

1. ROC 使用 score ≥ threshold；从 +∞ 全判负起步。相同分数一起进入；TPR / FPR 随阈值放宽不减，不保证每步同时升高。连续分数不是自动校准概率。定义参考 [scikit-learn roc_curve](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_curve.html)。
2. M78 原动画 / 游戏的 M1–M8 同一组教学数据：AUC 0.75。梯形积分与独立的正负排序对计算一致（12 / 16）。未给出实验出处，明确标记为教学数据，不包装为实际模型成绩。
3. AUC 变换、完美/反向排序及全部同分都明确标为构造对照，不冒充新训练模型。AUC 不选阈值、不评价校准。参考 [roc_auc_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_auc_score.html)。
4. M85 保留原十个化合物名称，重新读取公开 PubChem SMILES，用本地固定 RDKit 2025.03.4 计算 `amw / CrippenClogP / NumHBD / NumHBA`。十个原始公开响应缓存在 `M85-sources/`，CID、URL、精度和计算口径在 `M85-descriptors-v1.json`。没有向外部发送课程正文。
5. 发现并修正旧数值：咖啡因 HBA 3 → 6；西地那非 HBA 7 → 8；阿托伐他汀 HBA 4 → 5；替米沙坦原表 MW 500.6 → 514.629、cLogP 6.96 → 7.26442、HBA 3 → 5。均是所选公开结构下的工具计算值，不是实测值。
6. Lipinski 是经验性筛选提示，不是可服用、安全、有效或上市证明；“允许一条违反”作为本课程政策单独声明。背景参考 [Lipinski 等论文摘要](https://pubmed.ncbi.nlm.nih.gov/11259830/) 与 [RDKit 描述符定义](https://www.rdkit.org/docs/source/rdkit.Chem.Lipinski.html)。
7. 纠正“允许一条违反的联合通过率一定低于各单条”的错误。四张明确构造的数值卡各只违反不同一条：单条均 75%，严格交集 0%，允许一条 100%。该反例不混入课程真实结构库。

## 本地核验

- 自动测试：`node --test scripts/test-screening-evidence.cjs scripts/test-tendon-torque.cjs`，19/19 通过（本批 12，上一轮 M42 回归 7）。覆盖 AUC 独立交叉校验、同分、缺失类别、数据无效拒绝、阈值边界、策略集合反例、十结构重算、全部映射、源文件哈希、KaTeX/MathML 与证据下载序列化。
- 新增 / 本轮修改的渲染与预览文件 ESLint 通过，无警告。
- 全站 TypeScript 检查仍有既有错误，涉及旧 slide-demo、assignment-view、capstone-submission-panel、course-content-view；本批新增文件无报告错误。因此不将本轮声明为全站构建通过。
- 浏览器在实际应用 `SlideBody` 中遍历 22 页：无页面横向溢出，无公式错误；已查看代表性实际截图（ROC 动态、同分面积、分子结构、集合反例）。
- 验证 ROC 播放从 0/0 到 1/1 并停止，重置再单步得到 TP=1、FP=0；AUC 始终为 0.75。同分对照 AUC=0.5。
- 验证 M85 咖啡因 RDKit SVG 实际加载，HBA=6；500→450 Da 记录显示 MW 单条 7/10→6/10，允许一条联合 7/10→7/10。逐行播放在 10 行结束，待判定行从 9 减至 0。
- 两个练习页：初始下载禁用；M85 空答案不能通过；填写正确答案后提示通过且下载启用。证据文件序列化由自动测试验证；未声称验收了用户机器上最终下载文件的落盘位置。
- 浏览器错误日志为空。切换 slide 使用独立 key，播放计时器在卸载时清理，隐藏文档暂停；未进行真实页面冻结/后台节流故障注入。
- 图表加载异常时提供 DOM 坐标备份，分子图异常时提供 SMILES 与数值。正常渲染路径已验收；未故意破坏生产资源测试降级。

## 发布前清单

本轮没有发布权限动作。后续用户要求部署时：先把纠正的课文 / 理论 / 作业 / 内嵌旧互动与新 slide 口径对齐，再进行课程 manifest 哈希重建、白名单发布与线上验证。不得只替换视觉而继续播放旧讲稿。新配音未获外部服务明确授权，当前草稿不调用该服务。
