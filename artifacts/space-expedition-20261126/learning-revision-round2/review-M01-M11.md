# M01–M11 第二轮独立教学审读

状态：修补前的独立审读；面向没有天文、统计和编程基础的初中生。已逐节读当前 lesson.md、assignment.md、theories.json，核对 practice/START-HERE.md、README.md、B02–B04、学生 Notebook、analyze.py 的读取及筛选实现，以及真实 Q3 FITS/CSV。也检查了 M04、M10 实验的源码入口。未做学生试教，未声称 iPad 全流程通过。本报告不修改课程源。

## 总判断

现有新增的恒星/凌星解释、构造数据、缺测与零、中位数和布尔筛选说明，已经解决部分概念缺口，应保留。主要失败发生在“读懂文字之后实际做哪一步”：课文采用逐节建变量的教学流程，配套 Notebook 却是研究者一键复现流程。新增术语解释无法修复这一断链。

最严重的五项：

1. **M06–M09 的实际入口与正文不是同一程序。** `kepler10-reproduction.ipynb` 只有 17 格；第 2 部分一次调用 `read_role('development')`，在函数内部完成质量筛选、有效性筛选、归一化，只建立 `development_data`、`clean`。课文后续依赖的 `d/q/qkeep/finite/keep/raw_lc` 等并未在 Notebook 顶层建立。M08 指示“在 Notebook 第 2 部分读取 Q3”不能让学生执行本节代码。ZIP 中 Notebook、START-HERE、requirements 与 practice 源文件逐字一致，因此不是一个只在作者目录存在的问题。
2. **第一步“打开 Notebook”尚无可操作入口。** README 提供环境命令，但没有从零安装/打开前端、进入目录、选择内核和启动单元的完整路径；requirements 有 ipykernel，却没有 notebook/jupyterlab 前端。iPad 没有内核的说明是诚实边界，但不是可继续完成作业的设备方案。需要一条明确的电脑操作路径；不能把“准备好环境后”当作学生已会。
3. **M08 提交要求没有对应产生步骤。** 示例只打印整体计数、缺口元组、绘制散点；没有逐列失败表，没有展示实际新增排除的 6 条，没有保存 validity-ledger.csv/gaps.csv/keep，也没有把缺口标到图上。学生理解了 A–E 例子，仍无法把这个理解作用到真正数据上。
4. **作品交接多次只剩文件名。** M02 清单、M03 标注图、M04 区间卡、M05 观察卡，M07/09/10 的 CSV 都没有完整的制作/导出路径。M04 实验能把结构化记录交给课程作业区，不等于自动下载了正文指定的 JSON 文件。M10 需要 M04 选区，但代码没有读取选区或计算区间前后点数。
5. **互相冲突的操作口径会破坏顺序。** B02 写“重启并运行全部”，旧 Notebook 全部运行会提前到 Q4。M10 实验使用“低于基线多少 ppm”，正文使用第 1 百分位，两者不是同一规则；M11 要求新结果目录，代码却写当前目录固定文件名，旧 Notebook 又用随机临时目录。应统一持久的本次运行目录和按节执行范围。

## 逐节去向与必须修补处

| 节 | 当前可保留的教学 | 1–3 项必须修补及需要材料 | 交给下一节的具体东西 |
|---|---|---|---|
| M01 | 恒星/行星/卫星、Kepler 命名、太阳与远星、凌星几何、缺测与零均已有足够展开；不再扩同类定义 | 作业仍要求“提出重复下降猜想”，而学生真实任务是查看缺口，不能声称已观察到重复下降。区分“由构造例提出的研究问题”与“Q3 目前只找到缺口”；提供同一张可填写记录卡，写明真实观察来源。图像保存要说明模拟记录与真实图分别如何保留 | question-card.json 或课堂等价问题卡：实际缺口两端、观察/问题/未完成验证分栏 |
| M02 | 文件格式、目标编号、光变/像素、季度用途、校验含义合格 | 先让学生在实际 manifest 的同一条目圈出字段，给可填写清单而非要求从零写 JSON；终端进入目录、命令输出哪里是校验值须示范一次。iPad 阶段允许待核对但不声称校验通过 | data-manifest-student.json：精确输入路径、官方 URL、实际校验状态；后续 M06 指向同一份 Q3 |
| M03 | 时刻/间隔、天到小时、坐标、缺口的解释可保留 | “任取两行”之前增加一个来自现有 CSV 的指定编号算例；给明确标注工作流，例如在已下载图的副本截图中写端点、单位并保存。不要只写 PNG 文件名 | axes-and-gaps.png 与端点表；时间保持 BKJD/TDB/天 |
| M04 | 噪声、候选不等于确认、保留背景、编号与行位置的区分合格 | 给一个真实时间窗的操作示范，明确中心/宽度如何得到边界、怎样点击两点读取编号；说明互动纵轴为 PDCSAP/整季中位数而 CSV 为电子/s；导出同一个选区 JSON，或明确从实验记录转填的字段与位置。互动窗口包含右端，而正文示例可选左闭右开，必须记住实际边界并在后续统一 | candidate-window.json：target、file、time基准、start/end、boundary、cadenceno、观察，不要求必须看到凌星 |
| M05 | 观察/解释/待查、追溯材料、四项理解检查可保留；theories 为 [] 不需要补 | 不要求学生从零编写 HTML。提供卡片模板或已有作业区的等价单文件导出路线；逐项检查前四节文件齐全且相互指向，而不只重新叙述“应保存” | first-observation-card.html 或等价独立文件；M06 首次真实绘图时至少核对其中一个记录编号 |
| M06 | 变量、列表、索引、运行状态、库与 FITS 表解释可保留 | 改入口到逐节 junior-guide.ipynb 的 M06；让学生先运行三数构造格，再读实际文件，建立 d/raw_lc，显示三条真实记录及版本；分格保证“读取成功”与“画图成功”可分别检查。补真实启动路径，基础 B02 不能叫学生整本运行 | d、raw_lc、q3_path；raw-q3.png、runtime-versions.json、所选实际行；M07 使用同一个 d |
| M07 | 编码、按位与、非零不必排除、True/False 已足够，不再堆二进制介绍 | 用真实非零质量值显示 CADENCENO、解码、当前规则结果；循环 zip/unique 的输入输出各展示一行；直接生成 quality-rule.json 与 quality-counts.csv，而非打印之后让学生自行发明导出程序 | q、reject_bits、qkeep；两份文件、实际示例行；M08 继续原表逐行检查 |
| M08 | NaN/0、正误差、重叠排除、相邻差与中位数的构造例保留 | 把 TIME/FLUX/ERR 有限性、ERR>0 分成四列逐行显示，且用真实 7404/7405/7465 等编号从输入到 keep 走完整；展示全部 6 条新增排除及“原表各失败总数”和“新增排除”差别；保存逐行台账/掩码/缺口端点编号/带阴影散点，停在此处让学生核对一次再进入 M09 | finite、keep、t；validity-ledger.csv、gaps.csv、keep-mask.csv、valid-q3-gaps.png；M09 只使用这些保留编号 |
| M09 | 比例与下降比例、均值与中位数、误差同步缩放、不是去趋势的解释合格 | 先显示同一批真实 F/E 的中间状态和实际基准，再指定 7405 手算；区别原表位置、保留数组位置、cadenceno，解释 isin 的对齐步骤；输出包含真实原值与比例的核对表，生成实际新图，而不只要求“改轴标签” | F、E、baseline、normalized_flux/error、accepted_cadence、lc；normalization-check.csv、normalization-reference.json、normalized-q3.png |
| M10 | 构造删点反例、百分位含义、固定输入、公平比较可保留 | 从 M04 真实 JSON 读取 start/end，不能悄悄换到预定漂亮区间；程序显示窗口内原有/删除/剩余数量与编号，导出同坐标对照图和 CSV；明确网页 ppm 门槛与 Notebook 百分位演示不是同次实验，未覆盖/无变化允许如实结果 | 保持 lc、keep 不变；deletion-comparison.csv、trial-removed-records.csv、deletion-comparison.png、未采用规则的理由 |
| M11 | 完整台账与分析表的区别、反向追溯、重启核对合格；theories 为 [] 无需填满 | 持久 RUN 目录贯穿导出而不是固定当前目录；将分析表重新读入，验证列、编号、通量/误差等，并在真实保留/排除行上各查一次；read_role 只在此时与逐节过程交叉核对，不能替代 M06–M09 学生操作 | bundle、lc 及前述全套变量；processing-ledger.csv、analysis-set.csv、handoff-M11.json；M12 用同一未去趋势输入 |

## 输入 → 变量 → 输出与首次新操作

| 节 | 实际输入 | 新变量/记录 | 可核对输出 | 需要在首次使用处教的动作 |
|---|---|---|---|---|
| M01 | 几何模型；Q3 CSV 的 10400/10503，独立找 280–282 天缺口 | 观察句、可检验问题、不同解释 | question-card | 查编号、匹配时间与通量、区分实测/构造/待查 |
| M02 | manifest.json；Q3 raw FITS | 自己的数据来源清单 | data-manifest-student.json | 文件夹/路径已解释，仍须教实际打开和在目录运行终端；JSON 清单填写与保存 |
| M03 | Q3 CSV 与未筛选图 | 两行时刻、差值、小时数 | axes-and-gaps.png | 小数相减，乘 24；图像副本标注、保存位置 |
| M04 | 全局 Q3 图/互动比例图/原 CSV | start/end/boundary、真实编号 | candidate-window.json | 中心±宽度/2、选点读数、读取轴单位、转填与导出 |
| M05 | 前四节产物 | 第一份连贯观察卡 | first-observation-card | 引用现有图片、填模板、保留来源和待查状态 |
| M06 | ROOT/raw/...2009350155506_llc.fits | q3_path,d,raw_lc | raw-q3.png、版本记录、实际三行 | 新建/运行单元、内核、相对路径、导入、表取列与行、绘图/保存 |
| M07 | d['SAP_QUALITY'] | q,reject_bits,qkeep,values,counts | quality-rule.json、quality-counts.csv | asarray/int64、np.unique 返回两列、zip 同步取项、for 缩进、assert、布尔取反和计数 |
| M08 | 同一 d、q、qkeep | time_ok/flux_ok/error_ok/error_positive → finite → keep → t → dt → gap_index/gaps | 台账/共同掩码/缺口 CSV/图 | 逐列条件、共同布尔索引、重叠计数、np.diff/median/flatnonzero、j 与 j+1 两端映射；保存不是 print |
| M09 | d[keep]、raw_lc | F,E,baseline,normalized_flux/error,accepted_cadence,aligned,lc | 原值/比例核对 CSV、基准 JSON、图 | 数组逐项除法、绝对值、isin 编号集合、array_equal vs allclose、尺度与单位 |
| M10 | lc、keep、candidate-window.json | window_mask,threshold,trial_remove；lc不改 | 全局及窗口统计/删去编号/对照图 | 打开 JSON、区间条件、局部与全局掩码同长、布尔交集，百分位参数 0.01 |
| M11 | d/q/qkeep/finite/keep/t/normalized_*、原文件 | bundle 仅用于核对，lc继续指向等价输入 | analysis-set.csv、processing-ledger.csv | csv.writerow/列顺序、稳定目录、从磁盘读回、整数编号与浮点量分列、逐值核对 |

## M08 的真实核对材料

已用包内原 FITS 独立读取，而非只抄教师结果。原表 4370 行；按 `1130799` 先质量拒绝 230，随后另拒绝 6，保留 4134；中位采样间隔约 0.0204330081 天。四处筛选后缺口为：

| 左端 BKJD | 右端 BKJD | 间隔（天） |
|---|---|---|
| 267.3962267781 | 267.5596912684 | 0.1634644903 |
| 280.5346668466 | 281.3519867761 | 0.8173199295 |
| 290.5468271778 | 291.4254445149 | 0.8786173370 |
| 321.4414547637 | 323.5460546389 | 2.1045998752 |

可示范真实行：7404 的时间 260.2242107597 有效、quality=0，却缺 PDCSAP 通量和误差，质量通过但数值失败；7405 的时间 260.2446439835、通量 525931.0、误差 20.1256771088、quality=0，两关通过；7465 的 quality=32800，且通量/误差也缺失，两个原因可以同时记录，但只扣一行。质量后新增六条编号是 **7404、7596、9183、9368、10520、11644**，均应让学生在表里看见，不只是出现数字 6。

零通量、零误差、负误差、无穷值的边界用明确构造表展示；不要声称真实 Q3 包含所有这些情况。`finite` 中对通量只要求有限，没有把有限的零通量自动当作 NaN；正误差条件是另一列，这一点宜通过并排真假表教清楚。

## analyze.py 的可复用边界与必须修正的操作文字

- `verify('development')` 可用于来源校验，注明它检查什么；学生 M02 仍要看一个真实文件/校验值对照。初始化不必验证或加载 Q4 亮度。
- `read_role` 对本课程规则已有稳定实现；M06–M09 不能直接调用它替代学习，因为它把本轮要教的操作全部藏在一次函数调用中。M11 可用它作第二套实现核对，检查 `data/qkeep/finite/keep/clean` 一致性。
- `local_median`、`search`、`develop`、`validate` 不用于 M01–M11。它们超出本阶段，尤其 `develop` 一次完成多个后续阶段，不能当作逐节学习格。
- 课文中 M06 “再打开 kepler10-reproduction.ipynb”、M08 “在 Notebook 第 2 部分读取 Q3”、M09 “打开 Notebook 第 2、3 部分”必须直接改为 junior-guide.ipynb 同名 Mxx；旧 Notebook 保留为后期参考复现用途，不能只在前面加一个互相冲突的新链接。
- B02 “重启并运行全部”应限定为独立基础练习本或已学完的当前范围；不能指整个含 Q4 的复现本。
- M10 “从自己在第 9 节得到的分析表”需校正：现有 M09 没有导出后续分析表，只有变量与核对记录；正式 analysis-set.csv 在 M11。应明确 M10 用 `lc` 和 M04 区间文件。
- M11 的 `open('processing-ledger.csv',...)`、`np.savetxt('analysis-set.csv',...)` 与“新结果目录”不一致，应改为统一 RUN 输出。保存后从磁盘读回并核验；科学计算与输出路径不能靠学生猜。

## 补丁验收所需证据

新增学习本应在空内核从 M06 运行到 M11，无隐藏教师变量，显示每节中间表，并确实产生声明的文件。M10 必须能接受一个任意有效 Q3 选区，包括无明显下降或删点数为零的区间；没有选区文件应明确停下补齐，不能自动塞入教师最优候选。M11 与 read_role 核对后，分析表仍须 4134 行且未去趋势，M10 的试验不得污染正式数据。M01–M05 的 iPad 填卡与保存路径还需另做设备验收；代码跑通不能替代这项验收。
