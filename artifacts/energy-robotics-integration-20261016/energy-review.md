# 未来能源：节点整合对照

状态：编排已生成，运行验收见 verification-summary.md。原正文、媒体、作业、历史入口与记录标识保持不变。

课堂节点 167，主路径 87，任务段 26。原文件指纹和逐节点对应表另存。

## 用同一个观测站问题开题

路径：main；站点：harvest。

输入：一份光、风或供电体验记录

交付：任务口径、器材边界与第一张公开实测功率图

迁移：先固定预报对象。公开 I–V 是方法入口，不能填成本人测量；采购前已有可交付数字作品。

原节点：pvlib-solar-forecast-station:M01 → pvlib-solar-forecast-station:M02 → pvlib-solar-forecast-station:M03

## 从追光试验走向可信的电功率

路径：main；站点：harvest。

输入：观测站口径、角度对照及负载说明

交付：追光草图与经校准的采集链

迁移：角度实验先提出问题，真实 U/I 与扫描峰值重新核验；模拟最优点不能直接当 MPP 实测。

原节点：build-a-solar-tracker:M01 → build-a-solar-tracker:M02 → pvlib-solar-forecast-station:M04 → pvlib-solar-forecast-station:M05 → pvlib-solar-forecast-station:M06 → build-a-solar-tracker:M03 → pvlib-solar-forecast-station:M07 → pvlib-solar-forecast-station:M08 → pvlib-solar-forecast-station:M09

## 把角度方案做成能重复定位的支架

路径：main；站点：harvest。

输入：打印草图、实际小板尺寸与校准链

交付：本人打印支架和带耗电比较的追光方案

迁移：保留两件原课作品；pvlib 使用登记过的固定姿态，追光方案须另计执行器耗电，不能混用姿态记录。

原节点：pvlib-solar-forecast-station:M10 → pvlib-solar-forecast-station:M11 → pvlib-solar-forecast-station:M12 → pvlib-solar-forecast-station:M13 → pvlib-solar-forecast-station:M14 → pvlib-solar-forecast-station:M15 → build-a-solar-tracker:M04 → build-a-solar-tracker:M05

## 为第二种能源建立可比较的证据

路径：main；站点：harvest。

输入：同一观测站的供电需求

交付：本人风轮、对照与卡滞诊断

迁移：风轮是供电支路；pvlib 不预测风机。电气输出与机械试验分别记录，装配前核对接口。

原节点：design-a-wind-rotor:M01 → design-a-wind-rotor:M02 → design-a-wind-rotor:M03 → design-a-wind-rotor:M04 → design-a-wind-rotor:M05

## 为风停与遮光准备能量

路径：main；站点：storage。

输入：风光实验与负载身份

交付：储能台、续航报告和损耗说明

迁移：同一功率不等于相同电量；保留真实电压、时间及测量边界，不用动画亮灯时间冒充续航。

原节点：store-energy-for-later:M01 → store-energy-for-later:M02 → store-energy-for-later:M03 → store-energy-for-later:M04

## 规定谁先得到有限的电

路径：main；站点：storage。

输入：储能与关键负载需求

交付：可执行的调度规则和缺测处理

迁移：调度规则消费明确单位和采样时间；失去读数不能当能量为零。先用小课数据测规则边界。

原节点：write-energy-dispatch-rules:M01 → write-energy-dispatch-rules:M02 → write-energy-dispatch-rules:M03 → write-energy-dispatch-rules:M04

## 让前面的装置和规则协同工作

路径：main；站点：integration。

输入：自己的风光、储能及调度作品

交付：本人打印、装配、测试的能源站

迁移：原工作台按既有接口接入本人前作；缺失的默认模块要明示。集成通过不能替代采集链校准。

原节点：build-a-wind-solar-station:M01 → build-a-wind-solar-station:M02 → build-a-wind-solar-station:M03 → build-a-wind-solar-station:M04 → build-a-wind-solar-station:M05 → build-a-wind-solar-station:M06

## 把同一套装置变成可追查的测点

路径：main；站点：measurement。

输入：固定姿态、校准链与工程版本

交付：原始开发数据、缺测标记与只读快照

迁移：能源站与小板研究各保留设备身份；只有同一测点同一口径的文件才能进入模型。

原节点：pvlib-solar-forecast-station:M16 → pvlib-solar-forecast-station:M17 → pvlib-solar-forecast-station:M18 → pvlib-solar-forecast-station:M19 → pvlib-solar-forecast-station:M20

## 把太阳位置连回观测站任务

路径：main；站点：measurement。

输入：测点位置、姿态与开发数据

交付：太阳几何计算器和事前供电任务

迁移：小课的历史预测是演练；正式 pvlib 天气预报另存来源、有效时间及发布前可用性。

原节点：pvlib-solar-forecast-station:M21 → pvlib-solar-forecast-station:M22 → pvlib-solar-forecast-station:M23 → pvlib-solar-forecast-station:M24 → pvlib-solar-forecast-station:M25 → run-an-energy-mission:M01 → run-an-energy-mission:M02

## 算清板面实际接到了什么光

路径：main；站点：forecast。

输入：太阳几何与天气字段

交付：板面辐照转换器、单位账和边界检查

迁移：不能把水平辐照直接当倾斜板输入；保存来源、时间口径与转换版本。

原节点：pvlib-solar-forecast-station:M26 → pvlib-solar-forecast-station:M27 → pvlib-solar-forecast-station:M28 → pvlib-solar-forecast-station:M29 → pvlib-solar-forecast-station:M30 → pvlib-solar-forecast-station:M31

## 把升温的代价写进模型

路径：main；站点：forecast。

输入：本人温度记录与板面辐照

交付：带假设范围的温度预测器

迁移：未测参数保留假设标签；热机支线不提供太阳能板的温度系数。

原节点：pvlib-solar-forecast-station:M32 → pvlib-solar-forecast-station:M33 → pvlib-solar-forecast-station:M34 → pvlib-solar-forecast-station:M35

## 让模型对应自己手里的小板

路径：main；站点：forecast。

输入：校准、开发数据、辐照与温度模型

交付：冻结开发版本的直流功率模型

迁移：公开大组件参数不能套给小板；保留训练/开发时间窗与尚未测定的量。

原节点：pvlib-solar-forecast-station:M36 → pvlib-solar-forecast-station:M37 → pvlib-solar-forecast-station:M38 → pvlib-solar-forecast-station:M39 → pvlib-solar-forecast-station:M40

## 先保存明天的答案，再安排用电

路径：main；站点：forecast。

输入：冻结模型与发布前可用天气

交付：三方法事前预报与教学调度方案

迁移：真实预报包与小课调度演练分开。没有适配程序时只迁移方法，不声称已自动驱动能源站。

原节点：pvlib-solar-forecast-station:M41 → pvlib-solar-forecast-station:M42 → pvlib-solar-forecast-station:M43 → pvlib-solar-forecast-station:M44 → pvlib-solar-forecast-station:M45 → run-an-energy-mission:M03

## 让尚未发生的天气检验预报

路径：main；站点：validation。

输入：封存的预报、测点与验收口径

交付：首次真实评价和单独的小课挑战记录

迁移：正式扫描与教学结果分开；保留失败、缺测、首次结果和所有分母。

原节点：pvlib-solar-forecast-station:M46 → pvlib-solar-forecast-station:M47 → pvlib-solar-forecast-station:M48 → pvlib-solar-forecast-station:M49 → pvlib-solar-forecast-station:M50 → run-an-energy-mission:M04

## 只改有依据的一处，再换日期复查

路径：main；站点：validation。

输入：首次残差、失败与原始版本

交付：两个日期的复查档案和修订理由

迁移：事后回算用于诊断，不覆盖事前成绩；小课挑战的修订不能改写正式预报历史。

原节点：pvlib-solar-forecast-station:M51 → pvlib-solar-forecast-station:M52 → pvlib-solar-forecast-station:M53 → run-an-energy-mission:M05

## 让另一位工程师复跑同一份证据

路径：main；站点：handover。

输入：装置、环境、模型和两次真实验证

交付：端到端预报站与可复跑工程档案

迁移：打印实物、本人测量、预报与证据缺一不算完整工程；不能把索引保存当最终验收。

原节点：pvlib-solar-forecast-station:M54 → pvlib-solar-forecast-station:M55 → pvlib-solar-forecast-station:M56 → pvlib-solar-forecast-station:M57 → pvlib-solar-forecast-station:M58

## 机构支线 · 先比较转速与功率

路径：mechanism；站点：harvest。

输入：任一供电发现或独立进入

交付：发电对照报告

迁移：可独立完成的方法支线，不锁定太阳能主路径。

原节点：compare-energy-settings:M01 → compare-energy-settings:M02 → compare-energy-settings:M03 → compare-energy-settings:M04

## 机构支线 · 打印与试配传动

路径：mechanism；站点：harvest。

输入：对照报告与尺寸约定

交付：可打印传动设计

迁移：几何方法可迁移；齿轮文件不自动适配风轮或小板。

原节点：design-a-printed-transmission:M01 → design-a-printed-transmission:M02 → design-a-printed-transmission:M03 → design-a-printed-transmission:M04

## 机构支线 · 交付打印发电装置

路径：mechanism；站点：integration。

输入：自己的传动设计与发电报告

交付：真实打印装配、测量与故障证据

迁移：保留原作业和导入接口；该独立作品不作为光伏校准的前置。

原节点：build-a-printed-generator:M01 → build-a-printed-generator:M02 → build-a-printed-generator:M03 → build-a-printed-generator:M04 → build-a-printed-generator:M05 → build-a-printed-generator:M06

## 热机支线 · 热机原理与装置识读

路径：thermal；站点：handover。

输入：原热机课堂规定的前作与器材

交付：热机说明书

迁移：这是独立保留的旧热机工程，涉及原课的成品热机、高温与明火要求。不是默认低压打印路线，不作为风光储前置；是否开展按原课程与成人现场条件判断。

原节点：stirling-thermal-controller:M01 → stirling-thermal-controller:M02 → stirling-thermal-controller:M03 → stirling-thermal-controller:M04 → stirling-thermal-controller:M05 → stirling-thermal-controller:M06 → stirling-thermal-controller:M07 → stirling-thermal-controller:M08 → stirling-thermal-controller:M09

## 热机支线 · 发电与测量入门

路径：thermal；站点：handover。

输入：原热机课堂规定的前作与器材

交付：可报告功率的发电站

迁移：这是独立保留的旧热机工程，涉及原课的成品热机、高温与明火要求。不是默认低压打印路线，不作为风光储前置；是否开展按原课程与成人现场条件判断。

原节点：stirling-thermal-controller:M10 → stirling-thermal-controller:M11 → stirling-thermal-controller:M12 → stirling-thermal-controller:M13 → stirling-thermal-controller:M14 → stirling-thermal-controller:M15 → stirling-thermal-controller:M16 → stirling-thermal-controller:M17 → stirling-thermal-controller:M18 → stirling-thermal-controller:M19

## 热机支线 · 温度、转速与功率联测

路径：thermal；站点：handover。

输入：原热机课堂规定的前作与器材

交付：同步监测台

迁移：这是独立保留的旧热机工程，涉及原课的成品热机、高温与明火要求。不是默认低压打印路线，不作为风光储前置；是否开展按原课程与成人现场条件判断。

原节点：stirling-thermal-controller:M20 → stirling-thermal-controller:M21 → stirling-thermal-controller:M22 → stirling-thermal-controller:M23 → stirling-thermal-controller:M24 → stirling-thermal-controller:M25 → stirling-thermal-controller:M26 → stirling-thermal-controller:M27 → stirling-thermal-controller:M28 → stirling-thermal-controller:M29 → stirling-thermal-controller:M30

## 热机支线 · 执行与控制边界

路径：thermal；站点：handover。

输入：原热机课堂规定的前作与器材

交付：可控发电站

迁移：这是独立保留的旧热机工程，涉及原课的成品热机、高温与明火要求。不是默认低压打印路线，不作为风光储前置；是否开展按原课程与成人现场条件判断。

原节点：stirling-thermal-controller:M31 → stirling-thermal-controller:M32 → stirling-thermal-controller:M33 → stirling-thermal-controller:M34 → stirling-thermal-controller:M35 → stirling-thermal-controller:M36 → stirling-thermal-controller:M37 → stirling-thermal-controller:M38

## 热机支线 · 闭环反馈与整定

路径：thermal；站点：handover。

输入：原热机课堂规定的前作与器材

交付：PID 控制器与整定日志

迁移：这是独立保留的旧热机工程，涉及原课的成品热机、高温与明火要求。不是默认低压打印路线，不作为风光储前置；是否开展按原课程与成人现场条件判断。

原节点：stirling-thermal-controller:M39 → stirling-thermal-controller:M40 → stirling-thermal-controller:M41 → stirling-thermal-controller:M42 → stirling-thermal-controller:M43 → stirling-thermal-controller:M44 → stirling-thermal-controller:M45 → stirling-thermal-controller:M46 → stirling-thermal-controller:M47 → stirling-thermal-controller:M48 → stirling-thermal-controller:M49 → stirling-thermal-controller:M50 → stirling-thermal-controller:M51 → stirling-thermal-controller:M52

## 热机支线 · 寻优与故障保护

路径：thermal；站点：handover。

输入：原热机课堂规定的前作与器材

交付：寻优和保护记录

迁移：这是独立保留的旧热机工程，涉及原课的成品热机、高温与明火要求。不是默认低压打印路线，不作为风光储前置；是否开展按原课程与成人现场条件判断。

原节点：stirling-thermal-controller:M53 → stirling-thermal-controller:M54 → stirling-thermal-controller:M55 → stirling-thermal-controller:M56 → stirling-thermal-controller:M57 → stirling-thermal-controller:M58 → stirling-thermal-controller:M59 → stirling-thermal-controller:M60

## 热机支线 · 完整热机工程验收

路径：thermal；站点：handover。

输入：原热机课堂规定的前作与器材

交付：原热机完整装置、证据和说明书

迁移：这是独立保留的旧热机工程，涉及原课的成品热机、高温与明火要求。不是默认低压打印路线，不作为风光储前置；是否开展按原课程与成人现场条件判断。

原节点：stirling-thermal-controller:M61 → stirling-thermal-controller:M62 → stirling-thermal-controller:M63 → stirling-thermal-controller:M64 → stirling-thermal-controller:M65 → stirling-thermal-controller:M66
