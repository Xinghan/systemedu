# M81 教学视觉修复 · Evidence v1

日期：2026-09-08。项目：`molecule-monster-hunter`（分子怪兽猎人）。节点：`M81-w0-module`。本批 11 页全部重做；已按白名单增量部署生产，Build ID `vJAIcBzA5RurUZTm7y7YE`。发布详情见 `docs/deployments/2026-09-08-m81-evidence.md`。

## 来源与内容边界

- 原文目录：`/Users/xinghan/Dev/systemeduidea/projects_data/molecule-monster-hunter/knodes/M81-w0-module`。审查 slides、课文及活动后，选择原 `assignment.md` 中的 A–E 五行数据，作为全节统一的数据源。
- 原始 slide 备份：`course_factory/fixtures/molecule-monster-hunter/M81-before-evidence-v1.json`。保留全部 `slide_id`、原页序、种类、原 theory/idea 来源标识；显式的新版技术渲染器优先于旧活动入口。
- 原作业数据未注明物理单位、测量来源与测试集划分，因此页面明确标为教学数值，不称作真实溶解度模型成绩。未沿用旧活动中另一套分子的未经核实“实测”标注。
- 本页约定误差为 `预测 − 真实`。方向约定与某些文献的 residual 相反，但不影响 MAE/RMSE。

| 样本 | 预测 | 真实 | 误差 | 绝对误差 | 平方误差 |
| --- | --- | --- | --- | --- | --- |
| A | 8.0 | 8.2 | -0.2 | 0.2 | 0.04 |
| B | 5.5 | 5.0 | +0.5 | 0.5 | 0.25 |
| C | 7.0 | 7.0 | 0 | 0 | 0 |
| D | 3.0 | 6.0 | -3 | 3 | 9 |
| E | 4.2 | 4.0 | +0.2 | 0.2 | 0.04 |

绝对误差总和 3.9，平方误差总和 9.33，MAE=0.78，RMSE=√(9.33/5)≈1.366。

修正的关键讲解：

1. MAE 和 RMSE 接近不代表误差小。每条误差都为 +3 时，两者均为 3；每条均为 +0.2 时，两者均为 0.2。受控反例明确标为构造数据。
2. 散点图中画的是竖直差 `预测 − 真实`，不是到对角线的垂线距离；横纵轴使用相同尺度。
3. 连续预测可以用误差衡量，也可以结合事先约定的容许误差判断是否合格。不能仅凭五点散点图保证泛化表现。

指标依据：[scikit-learn regression metrics](https://scikit-learn.org/stable/modules/model_evaluation.html#regression-metrics)。交互坐标依据：[JSXGraph Glider](https://jsxgraph.org/docs/symbols/Glider.html)、[Board](https://jsxgraph.org/docs/symbols/JXG.Board.html)。

## 媒介选择

依据 `course-slide-visuals`，本节教学难点是数值关系、误差方向、计算过程和证据核查，不是复杂实物或空间构象。采用 KaTeX 精确公式、JSXGraph 专业坐标、DOM 数据表和受控交互；不强行加入图片或 3D，也不以空图标代替知识。播放、拖点和滑块都实际改变数据，所有计算共享同一纯函数。

## 页码映射

| 页码 / ID | 场景 | 知识关系与呈现方式 |
| --- | --- | --- |
| 01 / s1 | overview | 原作业表、数轴、单条误差；引出单条误差→图→指标→成绩单 |
| 02 / s2 | task | 选择 A–E，连续调整预测；真实值固定，方向、距离与公式联动 |
| 03 / s3 | signed | 逐条选择样本，核对符号、数轴位置和绝对值 |
| 04 / s4 | scatter | JSXGraph 散点、竖直误差线、样本表；点击点或行同步检查 |
| 05 / s5 | aggregate | 等量高估/低估反例；滑块改变偏差，有符号平均仍为零 |
| 06 / s6 | formulas | 三步展开 e、绝对值、平方列；KaTeX 推导 MAE 与 RMSE |
| 07 / s7 | counterexample | 切换 +0.2、+3、原表，比较同刻度误差条及两项指标 |
| 08 / s8 | outlier | D 点沿固定 x=6 的轨道拖动；播放从预测 6 到 3 的过程，公式、误差线和指标联动 |
| 09 / s9 | workshop | 填写五条误差→定位 D→计算两项指标→通过核验→下载 JSON 证据卡 |
| 10 / s10 | code-trace | 读取数据→计算误差→汇总→打印，四个代码状态依执行顺序推进 |
| 11 / s11 | report | 带完整表格、指标和结论边界的参考成绩单；明确不是自动完成学生练习 |

除第 10 页使用 `code-trace` 外，其余 10 页均使用 `regression-evidence`。练习状态仅保留在当前页，下载可本地保存；没有将课堂演示冒充真实课程作业提交。

## 实现与核验

- 生成脚本：`course_factory/fixtures/molecule-monster-hunter/rebuild_m81_evidence.py`。从原作业解析数据，重写本节点 slide 与讲稿。
- 渲染：`packages/student-web/src/components/learning/regression-evidence-visual.tsx`、`regression-scatter.tsx`；计算：`packages/student-web/src/lib/regression-evidence.ts`。
- 本地预览：`http://127.0.0.1:4173/slide-preview/m81`，使用真实 `SlideBody`，不是另写一套展示页面。仅 development 模式开放；11 页都有“本次重做”标记与明确页码。
- 13 项相关自动化测试通过：回归计算及公式转义 6 项、既有分类计算 4 项、slide normalization 3 项。包含 D 的 101 个预测值扫查、其余样本不变、RMSE≥MAE、空答案/错误符号/舍入处理。
- 浏览器逐页检查 11 页，没有页面横向溢出；发现并修复第 7 页 JSX 直接字符串导致的 TeX 双重转义，新增回归测试，确认最终显示 `RMSE≥MAE`。
- 实际鼠标拖动 D 点后，预测、误差线、MAE/RMSE 同步变化；播放到原 D=3 时，MAE=0.78、RMSE≈1.366。滑块与动画采用一致的 0.1 精度。
- 公式页逐步验证列数与公式；+0.2、+3 反例的两项分数分别均为 0.2、均为 3。
- 练习页验证空答案被拒绝、错误总分显示提示、正确五条误差与 MAE=0.78/RMSE=1.37 可生成证据卡；已实际触发下载按钮。
- 页面 Python 示例在本地 Python 实际复算，输出 `MAE=0.780, RMSE=1.366`。浏览器只演示执行状态，不运行 Python。
- 改动文件 ESLint 通过。全量 TypeScript 检查仍报仓库既存的 slide-demo、assignment、capstone、course-content 错误；此次新增文件未出现在错误清单，不宣称全仓类型检查通过。
- 视觉登记表仍覆盖 47 节、437 页，本批新增 `regression-evidence` 10 页，另 1 页 `code-trace`；本地 manifest 734 个文件记录已重新计算。

## 发布边界

已同步发布 M81 的课文、理论、作业、section、讲稿与 slides 共 6 个文件。旧活动留档，老师页显式新版交互优先。旧音频文件保留但不再映射；新版暂未配音，DashScope 外发配音等待用户明确授权。其他节点与首页未更改；生产沿用现有构建配置完成隔离构建，不代表全仓 TypeScript 问题已解决。
