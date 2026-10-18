# 智能造物：节点整合对照

完整验收状态见 verification-summary.md。全部原节点、媒体、作业及学习记录保留。

## 先定义这个影像助手能回答什么

路径：main；站点：question。

输入：自己的影像观察卡

交付：研究区域、目标信号与来源约定

迁移：沿用原课坐标、分辨率、区域背景与外联草稿，不把识别候选称为发现遗址。

原节点：satellite-archaeology:M01 → satellite-archaeology:M02 → satellite-archaeology:M03 → satellite-archaeology:M04 → satellite-archaeology:M05 → satellite-archaeology:M06 → satellite-archaeology:M07 → satellite-archaeology:M08 → satellite-archaeology:M09 → satellite-archaeology:M10 → satellite-archaeology:M11

## 让每个输入像素都有可解释的来历

路径：main；站点：acquisition。

输入：固定区域与来源图像

交付：多波段预处理管线

迁移：完整保留波段、比值、掩膜和归一化节点；原图、参数与版本要能复跑。

原节点：satellite-archaeology:M12 → satellite-archaeology:M13 → satellite-archaeology:M14 → satellite-archaeology:M15 → satellite-archaeology:M16 → satellite-archaeology:M17 → satellite-archaeology:M18 → satellite-archaeology:M19 → satellite-archaeology:M20 → satellite-archaeology:M21 → satellite-archaeology:M21b

## 用小样本练习怎样做可靠标签

路径：main；站点：annotation。

输入：预处理影像和分类目标

交付：标注约定与可追查图块集

迁移：地形样本用于练标注方法，不能直接变成遗址训练集；重新核对对象、标签和图像 ID。

原节点：label-the-terrain:M01 → label-the-terrain:M02 → satellite-archaeology:M22 → satellite-archaeology:M23 → satellite-archaeology:M24 → satellite-archaeology:M25

## 先固定没见过的地块再看成绩

路径：main；站点：annotation。

输入：标注版本与空间身份

交付：地理防泄漏数据划分

迁移：保留原地理切分课程与检验；短课测试通过不能免除目标领域的独立测试。

原节点：label-the-terrain:M03 → satellite-archaeology:M26 → satellite-archaeology:M27 → satellite-archaeology:M27b

## 先做能被检查的简单预测

路径：main；站点：baseline。

输入：冻结的数据用途与两个模型

交付：同集基线对比和复跑配置

迁移：分子预测只迁移分组和基线方法；数值标签不混进卫星影像，保留两个实验的原记录。

原节点：check-a-prediction:M01 → check-a-prediction:M02 → satellite-archaeology:M28 → satellite-archaeology:M29

## 让平均分暴露具体失败

路径：main；站点：baseline。

输入：同集预测记录

交付：带样本 ID 的错误检查报告

迁移：方法练习不是卫星模型验收；下一站在真实目标数据上重做检查。

原节点：check-a-prediction:M03 → check-a-prediction:M04

## 从卷积走到逐像素分割

路径：main；站点：model。

输入：基线、目标标签与划分

交付：CNN 与 U-Net 的可运行模型

迁移：原卷积、边缘、特征和掩膜节点全部保留；平台提供预训练权重须明示。

原节点：satellite-archaeology:M30 → satellite-archaeology:M31 → satellite-archaeology:M32 → satellite-archaeology:M33 → satellite-archaeology:M34 → satellite-archaeology:M35 → satellite-archaeology:M36 → satellite-archaeology:M37

## 让模型说清自己有多不确定

路径：main；站点：evaluation。

输入：冻结模型和未用于训练的数据

交付：混淆统计、校准与错例档案

迁移：保留假阳、假阴与分母；高分不是发现证明，不用测试集反复挑最佳版本。

原节点：satellite-archaeology:M38 → satellite-archaeology:M39 → satellite-archaeology:M40 → satellite-archaeology:M41 → satellite-archaeology:M41b

## 把机器建议交给证据和专家复核

路径：main；站点：handover。

输入：模型版本、扫描范围和披露规则

交付：候选证据、排除理由及独立修订版

迁移：原节点与审核步骤全部保留；候选只代表待核查信号。外联和敏感位置披露需本人明确决定。

原节点：satellite-archaeology:M42 → satellite-archaeology:M43 → satellite-archaeology:M44 → satellite-archaeology:M45 → satellite-archaeology:M46 → satellite-archaeology:M47 → satellite-archaeology:M48 → satellite-archaeology:M49 → satellite-archaeology:M50 → satellite-archaeology:M50b

## 交付可复现的影像研究助手

路径：main；站点：handover。

输入：原始版本、审核与局限

交付：脱敏展示、复跑包与学习反思

迁移：保留原隐私和披露要求；不因提交作品自动向外发消息、发布坐标或宣称科研发现。

原节点：satellite-archaeology:M51 → satellite-archaeology:M52 → satellite-archaeology:M53 → satellite-archaeology:M54 → satellite-archaeology:M54b → satellite-archaeology:M55 → satellite-archaeology:M56

## 看懂蚂蚁社会 + 摸清 RFID 怎么用

路径：agent；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的蚁巢观察起步包

迁移：原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。

原节点：ai-ant-ethologist:M01 → ai-ant-ethologist:M02 → ai-ant-ethologist:M03 → ai-ant-ethologist:M04 → ai-ant-ethologist:M05 → ai-ant-ethologist:M06 → ai-ant-ethologist:M07 → ai-ant-ethologist:M08

## 装机 + 给蚂蚁打上标签

路径：agent；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的 RFID 蚁群观测装置

迁移：原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。

原节点：ai-ant-ethologist:M09 → ai-ant-ethologist:M10 → ai-ant-ethologist:M11 → ai-ant-ethologist:M12 → ai-ant-ethologist:M13 → ai-ant-ethologist:M14 → ai-ant-ethologist:M15 → ai-ant-ethologist:M16 → ai-ant-ethologist:M17 → ai-ant-ethologist:M18 → ai-ant-ethologist:M18b

## 让 LLM 当你的 PI 写日报

路径：agent；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的蚂蚁日报助手

迁移：原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。

原节点：ai-ant-ethologist:M19 → ai-ant-ethologist:M20 → ai-ant-ethologist:M21 → ai-ant-ethologist:M22 → ai-ant-ethologist:M23 → ai-ant-ethologist:M24 → ai-ant-ethologist:M25 → ai-ant-ethologist:M26 → ai-ant-ethologist:M27 → ai-ant-ethologist:M28 → ai-ant-ethologist:M29 → ai-ant-ethologist:M30 → ai-ant-ethologist:M30b

## 跑一次真实验看蚁群怎么应变

路径：agent；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的蚁群应变实验记录包

迁移：原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。

原节点：ai-ant-ethologist:M31 → ai-ant-ethologist:M32 → ai-ant-ethologist:M33 → ai-ant-ethologist:M34 → ai-ant-ethologist:M35 → ai-ant-ethologist:M36 → ai-ant-ethologist:M37 → ai-ant-ethologist:M38 → ai-ant-ethologist:M39 → ai-ant-ethologist:M40 → ai-ant-ethologist:M41 → ai-ant-ethologist:M42 → ai-ant-ethologist:M43 → ai-ant-ethologist:M44 → ai-ant-ethologist:M44b

## 发布 + 沟通 + 复盘

路径：agent；站点：handover。

输入：原课本阶段前作、器材与数据条件

交付：我的蚂蚁研究成果展

迁移：原 RFID 活体研究完整保留为独立路径，不能跳过前段装置与数据要求去声称完成 AI 助手。旧课程的麻醉、贴标和扰动需要专业支持与单独复核，不作为家庭默认动手入口；当前模拟轨迹不算真实蚁群实验。

原节点：ai-ant-ethologist:M45 → ai-ant-ethologist:M46 → ai-ant-ethologist:M47 → ai-ant-ethologist:M48 → ai-ant-ethologist:M49 → ai-ant-ethologist:M50 → ai-ant-ethologist:M51 → ai-ant-ethologist:M52 → ai-ant-ethologist:M52b → ai-ant-ethologist:M53 → ai-ant-ethologist:M54 → ai-ant-ethologist:M55 → ai-ant-ethologist:M56
