# 地球脉动：节点整合对照

完整验收状态见 verification-summary.md。全部原节点、媒体、作业及学习记录保留。

## 为同一个地方提出可回答的问题

路径：main；站点：question。

输入：一次影像或轨迹观察

交付：地点问题、数据身份与缺测标记

迁移：公开或合成数据先练习方法；不能写成本人传感器实测。

原节点：purpleair-airquality-node:M01 → purpleair-airquality-node:M02 → purpleair-airquality-node:M03 → read-an-air-day:M01 → read-an-air-day:M02

## 把观测问题放在可重建的位置

路径：main；站点：question。

输入：地点问题与单位说明

交付：坐标约定、记录身份和手算 AQI

迁移：场地米坐标与真实经纬度分开。取得器材前可保留教学作品，不填成实际采样。

原节点：make-an-observation-map:M01 → make-an-observation-map:M02 → purpleair-airquality-node:M04 → purpleair-airquality-node:M05 → purpleair-airquality-node:M06

## 让自己的传感器留下原始行

路径：main；站点：fieldwork。

输入：地点、采样对象与准备清单

交付：可追查的传感器原始数据链

迁移：按原课器材和实际单位核对；成人负责供电与焊接，不把平台曲线当本机数据。

原节点：purpleair-airquality-node:M07 → purpleair-airquality-node:M08 → purpleair-airquality-node:M09 → purpleair-airquality-node:M10 → purpleair-airquality-node:M11 → purpleair-airquality-node:M12 → purpleair-airquality-node:M13 → purpleair-airquality-node:M14 → purpleair-airquality-node:M15

## 把测点和结构一同登记

路径：main；站点：fieldwork。

输入：原始采集链与后续点位问题

交付：本人观测节点、选址和设备身份

迁移：自制安装结构走 3D 打印；旧课通用盒体不等于已经提供打印文件。通风、防水与安装需实测；不靠主动制造烟雾验证。

原节点：make-an-observation-map:M03 → purpleair-airquality-node:M16 → purpleair-airquality-node:M17 → purpleair-airquality-node:M17b

## 先在同一组数据上看处理代价

路径：main；站点：quality。

输入：带时间和单位的原始数据

交付：空气观察报告、计数解释与 NowCast 演算

迁移：小课向前平均不是 NowCast；保留各自算法、原始值与缺测，不能直接替换真实管线。

原节点：read-an-air-day:M03 → read-an-air-day:M04 → purpleair-airquality-node:M18 → purpleair-airquality-node:M19 → purpleair-airquality-node:M20 → purpleair-airquality-node:M21 → purpleair-airquality-node:M22 → purpleair-airquality-node:M23

## 让校正保留依据和适用范围

路径：main；站点：quality。

输入：湿度、颗粒物与时间记录

交付：可复查的原始—校正—AQI 数据管线

迁移：原公式版本与传感器适用范围须核对，不把误差变小称为官方认证。

原节点：purpleair-airquality-node:M24 → purpleair-airquality-node:M25 → purpleair-airquality-node:M26 → purpleair-airquality-node:M27 → purpleair-airquality-node:M28 → purpleair-airquality-node:M28b

## 让网络数据和自己的节点对上身份

路径：main；站点：network。

输入：已校验的采集与处理版本

交付：长期采集、公开对照来源及缺测档案

迁移：第三方平台接入资格先核实；自制节点不保证可注册 PurpleAir。无法接入时保留原节点和本地成果，明确该项未完成。

原节点：purpleair-airquality-node:M29 → purpleair-airquality-node:M30 → purpleair-airquality-node:M31 → purpleair-airquality-node:M32 → purpleair-airquality-node:M33 → purpleair-airquality-node:M34 → purpleair-airquality-node:M35 → purpleair-airquality-node:M36 → purpleair-airquality-node:M36b

## 先在调查档案里抓住接口故障

路径：main；站点：network。

输入：本人空气与地图小课作品

交付：固定作品索引、故障和复测

迁移：小课实际支持的参数与点位接口可导入；真实 CSV 需另按字段适配，不声称已自动互通。

原节点：make-an-observation-map:M04 → assemble-a-field-notebook:M01 → assemble-a-field-notebook:M02 → assemble-a-field-notebook:M03

## 用没调过的日期追问传感器

路径：main；站点：validation。

输入：按时刻配对的数据和冻结规则

交付：误差图、留出检验与单独修订版

迁移：相近地点不一定同一空气环境。报告配对条件；留出集不用于挑选校正参数。

原节点：purpleair-airquality-node:M37 → purpleair-airquality-node:M38 → purpleair-airquality-node:M39 → purpleair-airquality-node:M40 → purpleair-airquality-node:M41 → purpleair-airquality-node:M42 → purpleair-airquality-node:M43

## 把每个结论接回证据

路径：main；站点：explanation。

输入：首轮检验与失败记录

交付：验证报告、调查档案与数据集说明

迁移：小课合成场地与真实地点分别归档；保存证据路径、未知项，不用地图连线宣称因果。

原节点：assemble-a-field-notebook:M04 → purpleair-airquality-node:M44 → purpleair-airquality-node:M45 → purpleair-airquality-node:M46 → purpleair-airquality-node:M47 → purpleair-airquality-node:M47b → assemble-a-field-notebook:M05

## 让另一个人复跑同一座观测站

路径：main；站点：handover。

输入：完整版本、原始数据与验证报告

交付：可复跑观测站及自己的环境公报

迁移：发布和位置公开由本人及监护人另行决定；记录未接入项，不把索引保存当公开成功。

原节点：purpleair-airquality-node:M48 → purpleair-airquality-node:M48b → purpleair-airquality-node:M49 → purpleair-airquality-node:M50 → purpleair-airquality-node:M51 → purpleair-airquality-node:M52

## 背景·区域·卫星怎么看地面

路径：satellite；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的负责任考古侦察起步包

迁移：独立卫星研究路径，使用原课程数据、坐标与披露规则；空气节点和蚁群结果不能直接作为遗址证据。原课全部节点及记录保留。

原节点：satellite-archaeology:M01 → satellite-archaeology:M02 → satellite-archaeology:M03 → satellite-archaeology:M04 → satellite-archaeology:M05 → satellite-archaeology:M06 → satellite-archaeology:M07 → satellite-archaeology:M08 → satellite-archaeology:M09 → satellite-archaeology:M10 → satellite-archaeology:M11

## 多光谱物理·指数·预处理

路径：satellite；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的多光谱预处理管线

迁移：独立卫星研究路径，使用原课程数据、坐标与披露规则；空气节点和蚁群结果不能直接作为遗址证据。原课全部节点及记录保留。

原节点：satellite-archaeology:M12 → satellite-archaeology:M13 → satellite-archaeology:M14 → satellite-archaeology:M15 → satellite-archaeology:M16 → satellite-archaeology:M17 → satellite-archaeology:M18 → satellite-archaeology:M19 → satellite-archaeology:M20 → satellite-archaeology:M21 → satellite-archaeology:M21b

## 标注·数据集·地理防泄漏

路径：satellite；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的防泄漏遗址标注数据集

迁移：独立卫星研究路径，使用原课程数据、坐标与披露规则；空气节点和蚁群结果不能直接作为遗址证据。原课全部节点及记录保留。

原节点：satellite-archaeology:M22 → satellite-archaeology:M23 → satellite-archaeology:M24 → satellite-archaeology:M25 → satellite-archaeology:M26 → satellite-archaeology:M27 → satellite-archaeology:M27b

## 从基线到卷积·CNN·U-Net·校准

路径：satellite；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的校准遗址检测模型

迁移：独立卫星研究路径，使用原课程数据、坐标与披露规则；空气节点和蚁群结果不能直接作为遗址证据。原课全部节点及记录保留。

原节点：satellite-archaeology:M28 → satellite-archaeology:M29 → satellite-archaeology:M30 → satellite-archaeology:M31 → satellite-archaeology:M32 → satellite-archaeology:M33 → satellite-archaeology:M34 → satellite-archaeology:M35 → satellite-archaeology:M36 → satellite-archaeology:M37 → satellite-archaeology:M38 → satellite-archaeology:M39 → satellite-archaeology:M40 → satellite-archaeology:M41 → satellite-archaeology:M41b

## 真实搜寻·迭代·专家过审·披露

路径：satellite；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的 top3 考古候选证据档案

迁移：独立卫星研究路径，使用原课程数据、坐标与披露规则；空气节点和蚁群结果不能直接作为遗址证据。原课全部节点及记录保留。

原节点：satellite-archaeology:M42 → satellite-archaeology:M43 → satellite-archaeology:M44 → satellite-archaeology:M45 → satellite-archaeology:M46 → satellite-archaeology:M47 → satellite-archaeology:M48 → satellite-archaeology:M49 → satellite-archaeology:M50 → satellite-archaeology:M50b

## 负责任地发表

路径：satellite；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的负责任卫星考古分享包

迁移：独立卫星研究路径，使用原课程数据、坐标与披露规则；空气节点和蚁群结果不能直接作为遗址证据。原课全部节点及记录保留。

原节点：satellite-archaeology:M51 → satellite-archaeology:M52 → satellite-archaeology:M53 → satellite-archaeology:M54 → satellite-archaeology:M54b → satellite-archaeology:M55 → satellite-archaeology:M56

## 看懂蚂蚁社会 + 摸清 RFID 怎么用

路径：ant；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的蚁巢观察起步包

迁移：原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。

原节点：ai-ant-ethologist:M01 → ai-ant-ethologist:M02 → ai-ant-ethologist:M03 → ai-ant-ethologist:M04 → ai-ant-ethologist:M05 → ai-ant-ethologist:M06 → ai-ant-ethologist:M07 → ai-ant-ethologist:M08

## 装机 + 给蚂蚁打上标签

路径：ant；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的 RFID 蚁群观测装置

迁移：原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。

原节点：ai-ant-ethologist:M09 → ai-ant-ethologist:M10 → ai-ant-ethologist:M11 → ai-ant-ethologist:M12 → ai-ant-ethologist:M13 → ai-ant-ethologist:M14 → ai-ant-ethologist:M15 → ai-ant-ethologist:M16 → ai-ant-ethologist:M17 → ai-ant-ethologist:M18 → ai-ant-ethologist:M18b

## 让 LLM 当你的 PI 写日报

路径：ant；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的蚂蚁日报助手

迁移：原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。

原节点：ai-ant-ethologist:M19 → ai-ant-ethologist:M20 → ai-ant-ethologist:M21 → ai-ant-ethologist:M22 → ai-ant-ethologist:M23 → ai-ant-ethologist:M24 → ai-ant-ethologist:M25 → ai-ant-ethologist:M26 → ai-ant-ethologist:M27 → ai-ant-ethologist:M28 → ai-ant-ethologist:M29 → ai-ant-ethologist:M30 → ai-ant-ethologist:M30b

## 跑一次真实验看蚁群怎么应变

路径：ant；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的蚁群应变实验记录包

迁移：原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。

原节点：ai-ant-ethologist:M31 → ai-ant-ethologist:M32 → ai-ant-ethologist:M33 → ai-ant-ethologist:M34 → ai-ant-ethologist:M35 → ai-ant-ethologist:M36 → ai-ant-ethologist:M37 → ai-ant-ethologist:M38 → ai-ant-ethologist:M39 → ai-ant-ethologist:M40 → ai-ant-ethologist:M41 → ai-ant-ethologist:M42 → ai-ant-ethologist:M43 → ai-ant-ethologist:M44 → ai-ant-ethologist:M44b

## 发布 + 沟通 + 复盘

路径：ant；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的蚂蚁研究成果展

迁移：原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。

原节点：ai-ant-ethologist:M45 → ai-ant-ethologist:M46 → ai-ant-ethologist:M47 → ai-ant-ethologist:M48 → ai-ant-ethologist:M49 → ai-ant-ethologist:M50 → ai-ant-ethologist:M51 → ai-ant-ethologist:M52 → ai-ant-ethologist:M52b → ai-ant-ethologist:M53 → ai-ant-ethologist:M54 → ai-ant-ethologist:M55 → ai-ant-ethologist:M56
