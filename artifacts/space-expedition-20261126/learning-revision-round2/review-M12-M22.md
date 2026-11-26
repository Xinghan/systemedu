# M12–M22：零基础初中生的完整学习链审读

审读日期：2026-11-26。对象为当前 `lightkurve-transit-detective` 正式源，非上一轮插入稿。结论：**revise，仍有影响独立学习和产物真实性的阻断，不能以代码能够批量生成图表代替教学完成。**

本次完整阅读 M12–M22 的 lesson、assignment、theories（包括 K1/K3；M17、M22 的 theories 为空），核对 M06–M11 的实际变量建立过程、M23 接口、基础材料 B03/B04/B05/B06/B07/B08/B11，并逐行检查 `practice/analyze.py` 与 17 格 `kepler10-reproduction.ipynb`。另外静态检查 M18/M20/M21 的真实数据互动程序。保留全部正式源，未修改课文、程序、稳定 ID、媒体或学习记录。

依据：[course_factory 教学完整性与独立评审规范](/Users/xinghan/Dev/systemeduidea/course_factory/SKILL.md:3238)、[中文教学语言规范](/Users/xinghan/Dev/systemeduidea/course_factory/references/chinese-teaching-language.md)。K3 是额外深入层；其公式或示例不能用来认定正文已完成首次教学。

## 最严重的五项

1. **M17 指向的原 Notebook 第 4 部分不是分步搜索。** 它一格调用 `develop(run_dir)`，已经搜索、奇偶比较、倍周期比较、像素诊断、写方法记录和 Q4 预测；学生还没完成 M18–M22 的反证检查，方法文件就已被写出。正文另有较好的分步代码，但变量、文件名、产物与 Notebook 是两条链。需要按课节推进的教程 Notebook，并在 M23 前保持候选草稿状态。
2. **M13/M19 的“深度”与所指向的 `measure` 不是同一测量。** 正文是局部区间内外均值的相对差；`measure` 是周期折叠后多事件合并、留空过渡带、在归一化尺度上直接作均值差。若不解释，学生既无法复算也无法比较。应保留历史算法版本，并另建名称明确的局部相对深度教学函数，不悄悄更改旧输出。
3. **M18–M20 要求的主要成果没有对应的学生操作单元。** 半/原/双周期三图、额外预测窗、逐事件奇偶表、原始质量窗台账，不能从“打开 Notebook 第 4 部分”直接得到。尤其参考程序只有合并后的奇偶统计，没有逐事件表和缺测空行。必须实现并教读每个输出的第一行，然后让学生完成另一行。
4. **M12–M17 的构造例到数组代码仍有大跳步。** 已补的算术例确实有帮助，但布尔数组选取、多个返回值、循环内函数、`np.where`、取整编号、峰值数组切片与误差权重没有相应主线走读。基础材料存在不等于学生知道何时必须补、补到何种能力才可继续。
5. **M21 要学生找色条，但两种当前图都没有数值色条。** Python 图还使用时间中位数并取对数，互动图使用时间平均值与幂律色彩；这些不同不能统称为同一张平均图。必须把图上真正存在的元素、计算方法及作业要求对齐。

## 先厘清两条不同的运行路径

严格按正文 M06→M11 逐段复制执行时，M06 已导入 `np/plt/lk/fits` 并创建 `d/raw_lc`，M07 建立 `q/qkeep`，M08 建立 `finite/keep/t`，M09 建立 `normalized_flux/normalized_error/lc`，M11 最后再次令 `lc=bundle['clean']`。所以不能把正文 M12 的 `lc` 简单判为“从来没有定义”。

问题在于课文反复引导学生去运行**另一份** Notebook：该文件只建立 `development_data/clean/first_flat/first_trend`，没有 `lc/flat/d/qkeep/plt` 这套教学变量，且跳过学生逐步筛选的过程。两条路线混用就会出现未定义变量，或者用新结果覆盖旧结果。新的教程应保留原参考版，同时给每节明确的单元编号与返回位置。

建议主线保留四个不同对象：`q3_bundle`（含原表和筛选台账）、`q3_normalized`（M11 输出）、`q3_flat_initial`（M12 初次去趋势）、`q3_flat_protected`（M17 保护候选后的版本）。候选参数单列 `candidate_q3`；M15 的试探值叫 `trial_period/trial_epoch`，不可继续冒充 M17 的新候选。

## 当前接口与必须补齐的产物对应

| 课节 | 确实存在的输入/接口 | 当前会得到什么 | 教程还须建立或明确保存什么 |
|---|---|---|---|
| M12 | `local_median(lc, ephemeris=None, window_day=None)` | 返回两个 LightCurve：`flat, baseline`；前者有 `trend_support_count` 列 | 手核窗口的实际行表；人工测试表 `trend-check.csv`；原/趋势/处理后三图。正文仅打印 `recovery_rows`，没有导出与绘图单元。 |
| M13 | M12 的未注入 `flat`；正文自选 `a,b,left,right` | 打印一次局部深度字典 | 有边界、编号、原采样编号、中心范围的 `event-measurements.csv`；不能以 `measure(flat,eph)` 直接替代。 |
| M14 | 学生自己的中心/范围表 | `np.diff` 和间隔除以 1/2/3 后打印 | `event-intervals.csv`；数据不足时保留状态，并有继续去 M15 的合理路径。 |
| M15 | `flat`、试探 P/t0；`phase(t,eph)` 仅返回天，不返回圈号或无量纲相位 | 正文打印前三行无列名矩阵并绘图 | `phase-handcheck.csv`，包含采样编号、原时刻、最近中心、周期编号、相对天数、无量纲相位；保存图并读回表。 |
| M16 | `box_score(y, inside)` 是正文自己定义，`analyze.py` 中没有它 | 返回等权均值、SSE、ΔSSE；实际小网格只打印 | 逐点计算表与 `box-score-handcheck.csv`；不能把 `measure` 当作该函数。 |
| M17 | `search(lc, periods)` 返回 `(pg, eph)`；正文自定义 `candidate_from(pg)` | 正文生成粗/细周期图、候选表、折叠图和 `candidate-q3.json` | 保存 `initial/masked/final` 三版趋势与支持点对照；从候选文件重建 M18 的参数，而不是沿用 M15 P/t0。 |
| M18 | 同一 `q3_flat_protected` 与 `candidate_q3` | `develop` 只有三个倍率的总体测量字典，无三联图及额外窗表 | `aliases.png/candidates.csv/extra-windows.csv`、一处实际时间图；明确周期来自哪个候选版本。 |
| M19 | 固定候选参数与全部预测编号 | `develop` 的 `even/odd` 是各组观测点合并后的 `measure`，无逐事件行 | `events.csv/odd-even.png/comparison.md`；逐事件测量后再汇总，缺测编号也在。 |
| M20 | `q3_bundle['data'/'qkeep'/'finite'/'keep']`、候选参数 | `read_role` 返回全段筛选计数和质量码解释，无按事件/对照窗统计 | `timing.png/window-ledger.csv/flag-notes.md`，原表同一行对齐，互斥排除理由。 |
| M21 | `pixel_diagnostics(role,eph,out)`，`eph` 实际未使用 | 写 `out/browser/pixels-development.json` 与 `out/audit/pixels-development.png`；返回孔径计数/shape/限制 | 调用前建立 `out/audit`；有数值色条、方法、来源、时间范围的学生诊断图和 `pixel-source.json`。不能假定返回值里有图像或完整来源。 |
| M22 | 本人 M17–M21 结果及版本 | 无自动生成教学证据表的函数，这本身合理 | 一条从主张到具体行号、原记录的完整示范，再建立本人 `evidence.csv/claim.md/decision.md`。没有反证时不能编造。 |

## M12：窗口原则已经讲清，实际窗口和人工注入仍未被逐步教会

**必须修 1：真实手核只是一条任务指令。** [正文第 33 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M12-w0-module/lesson.md:33) 要“选择远离缺口的一条记录”，却未展示怎样判断远离、怎样列出参与窗口的行、趋势输出究竟在哪一列。原 Notebook `CELL 7` 固定取索引 300 并打印两个数，自动算出了中位数，却没有展示排序过程。建议嵌入当前 Q3 一个窗口的表：`CADENCENO/time/segment/是否落窗/是否参与/flux`，注明 1 天总宽及同段要求；先让学生标出边界，再打印参加的实际行并排序。检查动作：换另一个采样编号，学生说明哪一行进出窗口，而不只确认两个自动计算的数相等。

**必须修 2：注入代码同时引入太多尚未走读的动作。** `flat,trend=...`、`probe_lc=lc[布尔数组]`、`.copy()`、`injected.flux[mask]`、科学记数法、`try/except`、循环内定义函数连续出现。已有文字说明了函数和异常用途，尚未教会“一个逐行真假表怎样用于两列筛选”。建议先给 6 行构造时间/通量/内窗/背景窗表，逐行对应 `abs(...)<0.08`、`>0.16 and <0.7`，解释中间故意留空的过渡带；再拆成“复制→只改内窗→两份分别处理→同规则测深度→求差”五个可暂停单元。检查副本变了哪些采样编号，以及正式 `lc` 的通量逐项未变。

**必须修 3：保存承诺未落地。** [正文第 112 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M12-w0-module/lesson.md:112) 和作业要三图、`trend-check.csv`，现有正文只有列表打印；参考 Notebook 没有注入恢复单元。应就地给出记录三列不同类型的表头 `window_day/status/recovered_depth_ppm/reason`，失败时数值留空、理由单列，保存并读回；图按同一时间窗对齐。说明 `local_median` 只要有一个时刻支持不足就拒绝本次调用，当前错误并不等于“全部时刻无资料”或“恢复深度为零”。

## M13：定义正确，但边界输入、代码和测量接口没有统一

**必须修 1：第一次让学生输入四个时间，没有给一张带四条边界的实际表/图。** [第 71 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M13-w0-module/lesson.md:71) 立刻使用 `map(float,input().split())` 和两个掩码；目前只检查点数，没有检查 `left < a < b < right`。学生输入背景边界落在内部时，代码仍可能打印数字。应先明确左背景 `[left,a)`、内部 `[a,b)`、右背景 `[b,right)`，用 6–8 行标出归属和边界含/不含，再展示两行有效性检查与可理解的纠错提示。把输入改为显式命名参数格更利于初学者复查，不能只留交互输入历史。

**必须修 2：指向 `measure` 会使同名深度出现不同答案。** [学习目标](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M13-w0-module/lesson.md:5) 指向 [analyze.py:153](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/practice/analyze.py:153)。这个函数需要 `eph`，M13 还没有 M17 候选；其内部按所有周期分组，外部取 `abs(phase)>0.75D`，并返回 `(om-im)*1e6`，没有除 `om`。构造核算：外部 1.02、内部 1.0198，正文相对深度为约 196.078 ppm，函数的归一化均值差是 200 ppm。应提供独立的局部 `relative_depth` 教学函数，保留原函数历史行为，另用对照框解释两种测量、窗口、单位及近似关系。禁止为了让数字相同而把背景强制改成 1。

**必须修 3：本节作业要求中心/时长范围，正文只教了深度。** 起止范围怎样变成中心与持续时间，只在 `theory_m13_2` 的 K3 中有具体计算。M14 马上要使用这些中心。把该必要操作移入主线：在实际局部图标“最后一个背景点/第一个低点/最后一个低点/下一个背景点”，给出起止可能区间，再手算中心与时长范围；对不清楚边界的真实事件允许填“无法定位”。导出时保留选区和范围，不能把区间中点的显示小数当精度。

## M14：手算已足够，但真实资料不足时路线断开

**必须修 1：正文允许只有一次事件，代码却强制至少三个，下一节又要求真实候选 P。** [第 35 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M14-w0-module/lesson.md:35) 与 [第 69 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M14-w0-module/lesson.md:69) 没有给出两种结果怎样接下去。微弱真实信号本就未必能凭局部图定位三次，不能把“凑齐三次下降”设成前进门槛。建议保留一个明确的状态分支：真实中心不足→真实表写不足→完成构造例→M15 用明确标注的教学试探值理解坐标→M17 再通过搜索得到本人候选。教学值不可写进真实候选表，也不能因为要推进而预填已知周期答案。

**必须修 2：中心范围经过排序后丢了身份与不确定性。** 代码只输入一串中心，排序后取差，不能再查回哪两次事件、它们的范围和缺口。嵌入三行事件表，保留 `event_id/cadence_ids/centre_low/centre_high`；一行示范后减前的中心值及间隔范围，第二行让学生计算。导出行应带两个事件 ID 与假定圈数，而不只是打印几个除法结果。这样 M15 选择的 P/t0 才有可检查来源。

## M15：相位说明已改善，但圈号计算与文件身份仍跳步

**必须修 1：`floor(...+0.5).astype(int)` 没有主线解释。** [第 65 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M15-w0-module/lesson.md:65) 的圈号决定 M19 奇偶，不能视作辅助代码略过。补一张“原时间→相对圈数→加半圈→向下取整→中心”的表，解释负编号可存在、刚好半周期的边界归属。构造 P=2、t0=10 时，t=11 得 n=1、相对天数 −1，与左闭右开范围一致；t=9.8 得 n=0、相对 −0.2。检查恒等式 `t = t0 + cycle*P + phase_day`，再让学生独立处理一个参考时刻以前的点。不要把 `floor` 解释为“删掉小数”，负数时错误。

**必须修 2：输出没保留作业要求的稳定编号。** 当前打印前三条 `times/cycle/phase/phase_day` 无表头，也不包含 `CADENCENO`；散点颜色没有圈号图例，图也未保存。建议就地生成完整命名表，随机选三条实际采样编号手核，保存并读回 `phase-handcheck.csv`；图加颜色含义，保留未分箱点。可选分箱另列 `n_points/n_events`，没有实际做分箱时不要求伪造该成果。

## M16：等权手算能跟随，正式加权与数组评分仍不足

**必须修 1：学生还不能把六点算术对应到函数每一步。** [第 62 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M16-w0-module/lesson.md:62) `np.where`、`~inside`、平方后 `sum` 一口气完成。补同一个六点例子的逐行表：`time/inside/y/model/residual/residual²`，再将每列指向代码一行；先用普通列表循环实现一次，再引入数组写法。独立换例必须有一个非零残差且不删点，验学生能解释总分中任一项。把几种 `dur` 的结果保存成实际参数表，失败组合也留行，不能静默略过。

**必须修 2：作业要求解释误差加权，但正文只有一句“误差小权重大”。** K3 给出了权重公式，主线没有让零基础学生理解为什么和怎样算。先用两次测量及不同误差比较“差 1 单位”相当于多少倍各自误差，再示范残差除误差后平方。随后用两点值 1、3，误差 1、2，对比等权均值 2 与权重 1、1/4 得到 1.4。说明这是假定误差可用的计算规则，不是“更相信喜欢的点”。若暂不让学生实现加权 BLS，必须明确库代做了哪项计算、输入误差是哪列，主线仍须完成此基础示范，不能让 K3 承担首次教学。

## M17：教学与参考流水线混在一起，并且重处理状态不透明

**必须修 1：原 Notebook 第 4 部分提前执行后续整段任务。** [正文第 15 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M17-w0-module/lesson.md:15) 指向的 `CELL 9` 调用 [develop](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/practice/analyze.py:254)，包含 M19 合并奇偶诊断、M21 像素图及 M23 方法文件。没有读取 Q4 亮度，这点应肯定；但“尚未冻结的候选草稿”与已生成 `method-freeze.json` 的课堂语义不一致。新教程按正文的粗搜/保护趋势/细搜/最终趋势四步拆开，在 M23 前不调用整个 `develop()`；原参考 Notebook 保留作复现参考。每步先看输入变量和输出字段，再运行。

**必须修 2：首次教读参数搜索时仍是整块 30 多行压缩代码。** `np.argmax` 是找最高值的位置而不是最高值本身；`pg.period.value[k]` 与 `pg.power.value[k]` 的同索引对应、`peaks` 的相邻比较、`argsort(...)[::-1][:5]` 均无展开。嵌入小型三/五周期结果表，先手选局部峰与最高峰，再走读一组周期/中心/时长对应。把库返回对象拆成学生可见表，明确 20001 粗网格间隔 0.00005 天，细网格间隔 0.000001 天，两者都不是观测时间分辨率。当前只在最高粗峰附近细化，不能说其余局部峰也已精查。

**必须修 3：三次趋势处理未保存足够来源，候选保护宽度也未讲到实际实现。** [local_median 第 120 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/practice/analyze.py:120) 排除总宽为 `1.5*duration` 的区间，即距中心不大于 0.75D 的点，不是只排除事件内部 D。细搜索输入是按粗候选保护的 `masked`，最后又按细候选生成 `flat`。补一张三版表：使用的候选/保护宽度/保留记录数/参与趋势点数/搜索是否使用此版。图示 D 的事件内部与 1.5D 保护带，说明保护带不等于删除观测。保留 `initial/masked/final` 各版和参数；M18 从 `candidate-q3.json` 读出新 P/t0/D，不沿用 M15 试探变量。

## M18：反证逻辑足够，真实比较却没有桥

**必须修 1：三联互动使用课程内嵌预处理点，不是本人 M17 的输出。** [互动程序](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M18-w0-module/media/game.html:46) 从 `dataset.points` 取 `detrended_flux`；第 152 行默认 P=1 天、参考时刻为 tmin+0.5，没有接收本人 `candidate-q3.json`。正文说使用 M17 保存的同一数据，学生易误以为页面自动接续。新教程从同一 `q3_flat_protected` 直接画 P/2、P、2P；浏览器明确标“课程示例预处理数据”，若要作为本人正式结果则须真正导入本人数据和候选，不能只改页面说明。

**必须修 2：要求统计额外预测窗，未提供“怎样找到一处”的过程。** [正文第 55 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M18-w0-module/lesson.md:55) 只让学生回 Notebook 统计。建议在原时间轴画同一 t0 下两个周期的中心，示范选择 `t0+(n+0.5)P` 这类半周期额外位置，再用原时间布尔窗列出具体记录、质量通过数和有效点数。把 `start/end/centre/candidate_factor/observed_count/status/reason` 存表。覆盖不足与测量精度不足分别写理由；不以“至少两个点”自动判足以看出浅信号。

**必须修 3：两倍周期的第二处下降容易在边界被截成两半。** 本课相位范围左闭右开，2P 图里的原 P 中间事件落在半周期边界，可能分在左右两端；当前只说“检查超出显示范围”。嵌入同一构造事件在圆周与展开轴的对应图，标左右端其实相接；把周期 P 与2P的时刻/相位算一遍。保持全周期图，再提供明确说明过的平移显示作辅助，不能因为中央只有一个凹陷就忽略边界处数据。

## M19：作业要求逐事件检查，参考程序只有合并统计

**必须修 1：逐事件表尚不存在。** [正文第 53 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M19-w0-module/lesson.md:53) 要按表逐行测量，但实践包 [第 265–267 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/practice/analyze.py:265) 只把全部奇/偶观测分别传入 `measure(select=...)`。它不生成每个事件的背景窗、深度、缺测行。新教程应先列固定完整编号，再为一行算中心、内部与背景窗，打印纳入的实际观测，最后循环全部编号；每行保存 `n_in/n_out/coverage/reason`。此操作是主线必要教学，不能要求学生自己从总函数推导。

**必须修 2：每事件深度的中位数与所有点合并的深度不可互换。** 课文允许用中位数概括事件深度，K3 虽提醒不同量，仍未展示实际差异。用一个构造反例：两次偶事件深度 0、1000 ppm，内部点数 2、20，基准均为1；事件中位数500 ppm，而按所有内部点合并约909 ppm。两次奇事件均500 ppm，则两种比较的结论强弱不同。建议并列表头，先完成逐事件描述，再明确参考 `odd_even` 是另一项合并诊断；不得把参考的 `difference_empirical_sigma` 直接贴为本节中位数组差的显著性。

**必须修 3：从范围比较直接跳到经验标准误和噪声模拟。** 本节要求在 Notebook 构造交替、加噪声、缺测情景，但没有对应单元；基础 B11 只介绍标准差与范围，没有教均值标准误、合成误差和相关噪声影响。主线先给同一套事件/覆盖规则的三张小表逐个修改，学生预测组中位数、事件数、未知状态如何变化；对真实每次只有少量点的情况允许无法可靠估计。若显示“几倍标准误”，必须前置完整示范，否则作为标明的未展开参考诊断，不能让学生负责解释尚未学过的指标。

## M20：统计规则清楚，缺少实际原表到同轴图的第一步

**必须修 1：不能直接拿筛选后数组与原质量数组并排画。** 正文正确要求原表诊断，但没有示范原始 4370 行、Lightkurve 自动略去缺失时间的 raw、4134 行 clean 如何选择。建议主线直接用 `q3_bundle['data']` 的同一行索引读取 TIME/PDCSAP_FLUX/SAP_QUALITY，只筛 `TIME` 有限的行用于时间图；亮度无值的行仍在状态/台账中保留，不能造亮度。展示一条“有时间无通量”的实际记录和一条被质量规则排除的记录，用 `CADENCENO` 连接上下图。不要使用 `q3_bundle['raw']` 的位置去索引原表质量列。

**必须修 2：事件窗/对照窗台账没有代码和完成实例。** [作业字段](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M20-w0-module/assignment.md:11) 很明确，但参考程序只有全季 counts。补一行原窗手工台账，再展示 `window & ~qkeep`、`window & qkeep & ~finite`、`window & keep` 三个互斥集合，检查 `raw=rejected_quality+rejected_finite+retained`；随后学生另选一处事件和一处等长非事件对照。上下图用共享横轴、事件窗用同一数值边界，质量码按类别/解码状态展示，不用折线把码的大小画成异常严重程度。

## M21：给学生的读图任务与图上实际元素不一致

**必须修 1：学生无法找到正文要求的色条。** [正文第 11 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M21-w0-module/lesson.md:11) 与作业要求色条；[Python 第 222–228 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/practice/analyze.py:222) 没有 `fig.colorbar`，互动 `drawPixels` 也没有数值色条。必须生成带单位、刻度和显示变换说明的色条，并让学生在图上读一个像素数值再回原数据核对。已有 x/y“cutout row/column”不等于天球坐标，需要注明局部行列与真实探测器起点的对应；不要求未教过的 WCS 推导。

**必须修 2：时间平均与中位数、原值与显示对数混用。** `pixel_diagnostics` 以 `np.nanmedian(...,axis=0)` 生成图，实际显示 `log10(max(img,1))`；互动显示 `mean_flux_image` 并做幂律伸展。相同像素时间序列 0、0、90，平均30、中位数0，可直观看到这不是同一统计量。应给一张三时刻、两像素的小表说明“沿时间汇总后剩一幅二维图”，明确选哪种版本做作业、为什么显示亮度与原电子/秒数值不同。初学主线可用线性色标；如保留对数图必须教读其刻度。补实际调用单元，先创建输出目录，保存目标、文件、时间范围、汇总方法和质量规则；不能靠已生成参考图声称本人执行了像素分析。

## M22：不要让“反对证据”变成必须凑齐的作业名额

**必须修 1：作业强制复查一条反对证据，可能诱导编造。** [作业第 7 行](/Users/xinghan/Dev/systemeduidea/projects_data/lightkurve-transit-detective/knodes/M22-w0-module/assignment.md:7) 没有处理本人结果暂未发现明确反证的情况。应改为复查一条关键支持，以及一条反对/尚不明确/最薄弱检查；如无可靠反证就明写“本次检查未发现，覆盖与来源限制仍在”。正文可以讲三类证据，真实提交不应要求三类都必须有实证。检查动作：将一个“尚未完成像素定位”放入正确状态，不能写成反对或排除污染。

**必须修 2：证据索引还缺一条真正贯穿实际文件的走读。** 现有示范是构造逻辑，不能教会怎样从 `candidate-q3.json`、某一事件行、质量窗台账追到原 `CADENCENO`。新教程选一条本人实际生成的判断，展示 `claim→文件相对路径→行键/时间窗→处理版本→原采样编号` 五步；检查路径存在只是第一层，还要读回数据核对目标/Q3/时间单位/参数版本。移除“回原 Notebook 第4部分重新生成图即可”的模糊指路，该单元会重算整套方法；改为具体 M17/M20/M21 绘图单元，防止复查时无意覆盖或换版。

## 新教程必须保持的运行与科学边界

- M12 注入副本不覆盖正式 Q3；M17 的候选保护仅改变趋势估计参加者，不删信号点；同一结果名不得混装初始与保护后版本。
- M13 局部相对深度、M16 等权 SSE、M17 BLS 目标、M19 逐事件组中位数、参考程序合并盒深度分别命名和解释。统一显示 ppm 不意味着它们是同一统计量。
- M14–M16 在真实信号太弱时有明确的“构造练习已会、真实结果待搜索”状态；不逼学生凭肉眼凑候选，不预填已知周期，不把练习值写成真实测量。
- M18–M22 所有判断允许未知和未完成。没有足够覆盖或测量能力时不将“没看到”写成反证；没有反证也不写确认行星。
- M23 前不运行 Q4 亮度读取/检验；M23 前的自动配置文件只能标草稿，不能假称学生已经完成了方法审查。生成 Q4 预测只用已公开的时间元数据时，也要清楚指出尚未读取亮度。
- iPad 尚无 Python 环境是产品限制。按课节 Notebook 可以修复电脑上的学习链，不能因此宣称 iPad 已能完成真实代码计算。每个入口明确在何处执行、保存什么、如何回到当前课程。

## 验证记录与限制

实际完成：全部指定正文/理论/作业阅读；实践函数签名、返回值、写文件路径和调用顺序的静态核对；Notebook 所有 17 格读取；相关真实互动的数据来源/绘图逻辑静态核对；用 Python Fraction/math 复算深度定义差异、事件合并反例、圈号边界与粗细网格间隔。未读取 Q4 光变来选择任何建议参数。

本次未完成完整科学程序重跑。源记录曾使用 `/private/tmp/lk-venv/bin/python`，该环境目前不存在；两个仓库的 `.venv` 均没有 Lightkurve。没有为了审读安装环境或修改正式源，也没有把过去作者运行日志当作本次运行通过。父任务的教程实现须在恢复的正确依赖环境中做空内核按课程顺序验收。

没有在 iPad/网页实际点击验收，也没有初中生试教。关于 M21 无色条的判断来自当前绘图代码，属于确定的静态缺项；显示适配、触控操作和端上可见性仍需设备验收。

官方说明交叉核对：[Astropy BLS 数学与搜索说明](https://docs.astropy.org/en/stable/timeseries/bls.html)、[Lightkurve fold 的单位与相位选项](https://lightkurve.github.io/lightkurve/reference/api/lightkurve.LightCurve.fold.html)、[NumPy floor 对负数的定义](https://numpy.org/doc/stable/reference/generated/numpy.floor.html)。本次不把当前在线文档版本当作课程锁定版本；具体实现差异以实践包固定版本与代码为准。
