# M80 教学视觉修复 · Evidence v1

日期：2026-09-08。项目：`molecule-monster-hunter`（分子怪兽猎人）。节点：`M80-w0-module`。范围：本节点 10 页 slide；仅本地预览，未部署生产。

## 来源与修正

- 来源：`/Users/xinghan/Dev/systemeduidea/projects_data/molecule-monster-hunter/knodes/M80-w0-module/slides.json`，结合本节点课文、理论及活动说明审查。
- 原始 slide 存档：`course_factory/fixtures/molecule-monster-hunter/M80-before-evidence-v1.json`。
- 保留原例的 100 个样本、3 个正类，以及 TP=2、FP=1。由此 FN=1、TN=96，准确率为 98%，不是原稿的 95%。不为保留原叙事而偷偷改动样本。
- “TP=2、FP=4”是实验台中明确标示的另一组教学模拟：准确率 95%、召回率 66.7%、精确率 33.3%，不代表模型实测。
- 不从单张混淆矩阵反推连续评分的 ROC-AUC，不再填写没有评分依据的真实模型 AUC=0.8。区分“所有评分相同”与“所有硬判断为负”；前者有 AUC=0.5，后者不足以确定原始分数的排序。
- 原则改为结合类别比例、排序表现、实际漏报与误报；不再宣称只认 AUC。

指标依据：[scikit-learn classification metrics](https://scikit-learn.org/stable/modules/model_evaluation.html#classification-metrics)、[ROC-AUC score API](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_auc_score.html)。

## 媒介判断

依据 `course-slide-visuals`：所有关键关系都依赖精确计数、公式或可观察的判断状态，因此选择 DOM 表格/样本格 + KaTeX + React 受控状态。没有必须由图片解释的复杂实物，也没有空间构象问题；本批不生成位图，不使用 3D，不以图标或氛围插画替代知识。动画由标签、判断和计算状态的变化驱动，可手动逐步查看，也可点击播放，不作无限装饰循环。

## 页码与语义映射

以下各页都使用 `renderer=classification-evidence`，共用经过测试的计数函数。原有 `slide_id`、页序、种类及来源标识保留。

| 页码 / ID | 场景 | 具体对象与教学关系 | 呈现方式 |
| --- | --- | --- | --- |
| 01 / s1 | overview | 100 样本中 3 个目标全漏掉；97% 准确率与 0% 召回率并存 | 可核查样本格、双指标、KaTeX |
| 02 / s2 | chain | 真实标签 → 四种判断结果 → 指标解释 | 三段证据链，计数卡和矩阵 |
| 03 / s3 | population | N = N+ + N− = 3 + 97；真实类别不是预测结果 | 逐格检查与公式、定义 |
| 04 / s4 | compare | 同一测试集下基线与固定示例的四格计数、三项指标 | 双矩阵、准确率/召回率/精确率对照 |
| 05 / s5 | ranking | 正负配对中评分更高/并列/更低分别计 1/0.5/0 | 可切换配对关系、AUC 公式与证据限制 |
| 06 / s6 | walkthrough | 真实标签 → 全判负 → 准确率 → 召回率 | 四步可播放过程，逐步改变样本状态并显示公式 |
| 07 / s7 | lab | 改变 TP、FP 后，FN、TN 与三项指标同步变化 | 两个滑块、三个预设、样本格与矩阵联动 |
| 08 / s8 | checklist | 工作点判断、评分排序、实际成本分别回答不同问题 | 精确公式与三类评价证据 |
| 09 / s9 | prevalence | 正类 3/10/50 时，全判负的准确率 97/90/50%，召回率始终 0 | 类别比例切换、样本与公式联动 |
| 10 / s10 | report | 把类别占比、基线、矩阵、指标与缺失证据一起交付 | 评估证据卡；连接 M34、M74/M78 与 M81 |

## 实现与本地检查

- 生成入口：`course_factory/fixtures/molecule-monster-hunter/rebuild_m80_evidence.py`。
- 渲染器：`packages/student-web/src/components/learning/classification-evidence-visual.tsx`；数据计算：`packages/student-web/src/lib/classification-evidence.ts`。
- 真正的 `SlideBody` 在 animation/game 页优先使用显式配置的新版技术渲染器，避免仍跳到旧活动视觉；没有新配置的课程保持原行为。
- 本地独立预览：`http://127.0.0.1:4173/slide-preview/m80`。使用同一播放器组件，不是截图或另写的演示副本。路由仅在 development 下启用。
- 7 项自动化测试通过（分类计数 4 项，slide normalization 3 项）；包含 392 组有效计数的守恒检查。改动相关 TS/TSX 的 ESLint 通过。
- 浏览器检查 10 页：无横向页面溢出；发现并修复第 9 页百分号转义问题，最终公式无 KaTeX 错误。
- 浏览器实际播放 4 步，验证最后同时呈现 Accuracy=97% 和 Recall=0%；三组预设的样本颜色数量、矩阵和指标吻合；3/10/50 类别比例也逐一核验。
- 全量 TypeScript 检查仍有仓库既存错误；新增文件未出现在错误清单。未将其宣称为全仓类型检查通过。
- 更新视觉登记表：47 节、437 页，其中本次 10 页为 classification-evidence；重算本地课程 manifest 的 734 个文件记录。

## 范围边界与上线前事项

本次只重写 slide 数据、讲稿和视觉。原音频仍留在磁盘，但 10 页 `audio_path` 已取消映射，防止播放旧错误讲解；新版预览没有录音。非 slide 的独立课文/理论/旧活动源文件未在本次一并改写，生产发布前须同步核查并重录相应音频，避免不同入口内容冲突。生产课程与服务本次没有改动。
