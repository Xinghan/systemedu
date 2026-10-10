# M04 · 官能团与计算对照 · controlled-v1

制作前媒介决策，2026-09-10。原节点 9 页未提供 slide_id，以原始 index + kind + theory/idea anchor 映射，规范化为 s1–s9。保留历史稿，生成独立预览。

## 纠正边界

乙烷在常温常压是气体，不是水上的油珠。乙醇与水互溶；不能把 cLogP 当溶解度数值、实测结果或因果证明。结构编辑表示两个已定义化学结构的计算比较，不演示把乙烷直接变成乙醇的合成反应。官能团影响性质，但骨架、物态、温度、电离状态等也重要；不教儿童接触化学品。

| 页/原索引 | 理解问题与易错点 | 主表达与可见证据 | 操作/验收与替代取舍 |
|---|---|---|---|
| 1/0 | M03 读骨架后，M04 比什么？ | RDKit 乙烷/乙醇结构 + M03 个人报告状态 | 保留 C–C、H 替换为 OH；不是随意挂贴纸；精确结构优于生成分子图片。 |
| 2/1 | 一份对照记录需哪些证据？ | 输入结构→同方法计算→两值差值→有限结论 | 可核查每一步字段；真实软件证据不画传送带机器。 |
| 3/2 | OH、NH2 如何连在骨架上？ | RDKit 含氢结构 + 来源乙醇 Three.js 模型，定位氧看相邻 C/H | 旋转/显隐/定位揭露遮挡；保留氨基二维对照，不臆造氨基 3D 坐标。 |
| 4/3 | 什么时候不是“只改一处”？ | 可选乙醇/1-丙醇的结构比较与变量账本 | 选丙醇会同时改链长，阻止单官能团归因；无需真实器材图片。 |
| 5/4 | 计算性质与肉眼物态为什么要分开？ | 生成浅色物态对照图 + HTML 条件/说明 + 精确公式 | 左侧气体/水，右侧均一液体；不是实测、不标定量浓度；图像承担透明玻璃与相界，不承担数据。 |
| 6/5 | 从输入到 cLogP 差值怎样发生？ | 单步/可播放执行轨迹 + RDKit 实际描述符 | 状态为准备/CC/CCO/差值，数值不能提前冒出；不动画合成或油珠溶解。 |
| 7/6 | 换结构后算法结果如何更新？ | 实际 RDKit.js 比较台 + 可选干预 + 精确数值 | 切换分子重算 cLogP/原子量，不标“溶解度通过线”。 |
| 8/7 | 交付的是自己的什么？ | 完整 Python 模板 + 自己写的有限结论 + 下载计算记录 | 来源写 browser-RDKit-computation、版本与两值；不是本人 Python 执行证据。 |
| 9/8 | 哪些结论可以带到下一节？ | 保存记录读取 + 待测项目 + 下一步 | 无保存记录不默认完成；报告不声称证明溶解度、药效或真实因果。 |

## 数据来源

- [NIST 乙烷相变数据](https://webbook.nist.gov/cgi/cbook.cgi?ID=C74840&Mask=4)：常压沸点约 184.6 K。
- [NIOSH 乙醇](https://www.cdc.gov/niosh/npg/npgd0262.html)：液体、水中互溶。
- [RDKit Crippen 文档](https://www.rdkit.org/docs/source/rdkit.Chem.Crippen.html)：原子贡献计算方法。实际值由安装版本执行，不烘焙入图。
- 3D 使用已核验 M03 乙醇 PubChem CID 702 计算构象，不新造精确坐标。

## 第 5 页生成图 prompt

Use case: scientific-educational. Asset type: wide 16:9 raster teaching illustration, two equal comparison panels on a warm-white presentation background. Primary teaching relationship: gas above a liquid is not a second floating liquid layer; contrast this with a homogeneous liquid mixture. Two matching cutaway glass sample vessels, viewed front three-quarter, softly shaded realistic technical illustration, restrained navy edges and pale muted blue liquid. Left vessel: water in the bottom half with one clear curved meniscus, visibly spacious transparent gas headspace above, no second liquid layer, no oil droplets, no bubbles in the liquid. Right vessel: one homogeneous clear pale-blue liquid solution in the bottom half with one meniscus, no separating layers, ordinary air headspace above. Add a single large circular schematic magnification inset beside each vessel: left inset is connected only to the headspace and shows a few widely separated neutral small dots; right inset is connected only to the liquid and shows many closely intermingled small dots in two restrained colors, uniformly mixed. Dots are abstract phase/composition markers, not molecular structures, not quantitative counts. Subtle glass reflections, soft neutral studio light, precise uncluttered technical composition. No people, no laboratory background, no fancy atmosphere, no text, no numbers, no chemical structures, no mathematical symbols, no arrows suggesting transformation from left to right. HTML will supply exact substance names and conditions. This is an illustrative comparison, not an experiment photograph.

已完成产物：`public/slide-assets/molecule-monster-hunter/M04/phase-comparison-v1.webp`；使用内置 imagegen，压缩后 39,862 bytes，已通过相态检查。2026-09-11 随 M05 部署，9 页生产 API 与本地草稿一致；详见 `docs/deployments/2026-09-11-m04-m05.md`。新讲稿尚未配音。
