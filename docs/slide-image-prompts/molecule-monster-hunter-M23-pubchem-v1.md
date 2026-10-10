# M23 · PubChem 查源取数 · 逐页生成前决策

2026-09-11。源 `M23-w0-pubchem-smiles`，s1–s8；原 s3/s4 共用 `pubchem_lookup`，必须完整保留映射。

## 原文校正

PubChem 现行网页 SMILES 包含立体/同位素信息，旧 Canonical SMILES 改名 Connectivity SMILES；不保证界面位置或字段字符串永远不变。删除不一致的“一亿/几亿”数量口号与“复制不会出错”的保证。乙醇、苯是分子示例，不统称药物；当前布洛芬 CID 3672 未指定立体中心，不把它与指定单一立体异构体混为一谈。名字是线索、CID 是记录标识，需核对具体记录；离线六行未命中不代表 PubChem 没有。网络失败与查询未命中不同。移除不适龄的用药暗示与“预测有没有毒/能否成药”的自动保证。M05/M06 已完成结构表达和识读，M23 扩展来源获取，M24 接收可保存的字符串。

## 每页方法卡

| 页 / 原题与锚点 | 学习问题和误区 | 可见证据与实现 | 方法取舍 | 验收 |
|---|---|---|---|---|
| s1 intro 进 PubChem | 我已有 M06 分子卡，为什么还要查来源？ | 读取真实 M06 状态；同一个 aspirin 的检索词→CID→SMILES→来源卡，当前练习/个人状态分开 | DOM/RDKit 精确数据链；照片或3D不能补充来源字段，不把数据库画成图书柜 | M06 记录未自动计为 M23 完成，进入个人卡步骤明确 |
| s2 bullet 自己写每个真药？ | 名字能否直接当唯一身份？ | 固定六记录名称索引：别名合到同 CID、前缀多个候选、未收录路径，候选含结构与公式 | 实际小型查询模型比静态箭头更能教检索；明确离线教学索引不是完整 PubChem | paracetamol/acetaminophen同1983；a多候选不擅自取第一条；unknown仅说本表未收录 |
| s3 theory PubChem，pubchem_lookup | 记录上要留下哪几个字段？ | 来源字段解剖：CID、Title、SMILES、Connectivity SMILES、取得日期；点击字段改变解释与例值，真实官方链接 | DOM精确数据卡，不仿造整站UI或过时截图；需要的是字段语义不是物体空间 | 旧新字段解释准确；取得日期属于本次引用，不冒充数据库修改日期 |
| s4 theory 阿司匹林积木，pubchem_lookup | 原文写法与RDKit规范写法不一样就错了吗？ | 原始PubChem字符串/当前RDKit规范写法/同一结构图；选择双键、支链、环标记，定位实际字符并解释 | 2D与文本最适合连接/语法；3D不能用于逐字符语义、也无此页坐标问题 | =、括号、环数字不是原子；不称本页覆盖完整SMILES；等价写法保留原始输入不强制覆盖 |
| s5 animation anim_1781762184709_yptj | 结果何时可用，失败到哪一步停止？ | 六步播放/暂停/单步，固定aspirin/paracetamol和未命中情形；每步显露查询、候选、CID、字段、结构核验、来源卡 | 实际状态变化，样例回放不是实时网络、Python或化学反应；无结果不渲染旧结构 | 起点无输出，失败无下游结果，重置/切换输入清状态 |
| s6 game game_1781762184709_ifxp | 我怎样完成真实网页取数，打不开怎么办？ | 三步个人取数台：目标与官方链接→原样粘贴/核验CID结构→点选至少两类真实语法标记并说明；保存来源日期和声明 | 软件过程本身为产物。固定样例练习另设入口、标签与完成状态；不需要图片或物理实验 | 更改输入清核验，离线样例不变成真实查询成果；合法非目标/错CID/错误语法拒绝；本页只核对限定目标 |
| s7 bullet 第一个真药记录卡 | 哪份记录可复查，哪些是样例？ | 从存储重验个人卡，显示source mode、CID链接、原始字符串、标注与说明；下载JSON/独立HTML | 展示真实产物比奖杯/勾号更有信息；DOM表格有明确字段 | 空记录不填示例，恢复重算，离线练习明确非真实取数完成；个人来源是自述而非系统证明访问过网页 |
| s8 outro 取回收进电脑 | 这个成果如何交给下一节？ | 本人结构原文→Python字符串变量→print输出的三状态教学轨迹，下载可运行标准库模板 | 精确代码与状态；无需3D/图片，不能把代码回放称作真实Python执行 | 仅个人已保存输入派生；空态不伪造个人代码；模板转义合法并实际运行验收 |

## 官方数据与范围

- [PubChem glossary](https://pubchem.ncbi.nlm.nih.gov/docs/glossary)：现行 SMILES 字段与 Connectivity SMILES 区别；[RDKit.js](https://www.rdkitjs.com/) 用于实际结构解析和规范化，不替代来源核验。
- 2026-09-11 实际 GET [PUG REST 六个 CID 字段](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244,2519,702,241,1983,3672/property/Title,MolecularFormula,SMILES,ConnectivitySMILES,InChIKey/JSON)，返回 Title/MolecularFormula/SMILES/ConnectivitySMILES/InChIKey 全部固定记录。保存快照用于离线教学，不声称学生实时发起请求。
- 无新增光栅或3D：核心知识为数据来源、结构字段、字符串与取数状态；明确审查过定向图像、空间模型与实验，均不提供本节独立知识关系。不强加媒体配额。

状态：方法卡先于实现；后续 integrated、browser-verified、deployed 分别在 registry 留证。
