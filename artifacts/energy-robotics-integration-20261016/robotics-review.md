# 机器人觉醒：节点整合对照

状态：编排已生成，运行验收见 verification-summary.md。原正文、媒体、作业、历史入口与记录标识保持不变。

课堂节点 106，主路径 106，任务段 19。原文件指纹和逐节点对应表另存。

## 先分清谁在指挥机器人的动作

路径：main；站点：specification。

输入：一次夹爪几何体验

交付：双手任务规格、控制权与字段契约

迁移：从同一个托盘与插块任务展开；遥操作、固定回放和学习策略各有独立证据。

原节点：aloha-bimanual-apprentice:M01 → aloha-bimanual-apprentice:M02 → aloha-bimanual-apprentice:M03 → aloha-bimanual-apprentice:M04

## 让动作请求有清楚的条件

路径：main；站点：specification。

输入：信号身份和动作模式

交付：合成信号处理卡与可检验抓取规则

迁移：信号课程留在原路径且仍归脑科学；此处只复用控制方法。双阈值规则不是 EEG 解码或 ACT 策略。

原节点：clean-a-signal:M01 → clean-a-signal:M02 → clean-a-signal:M03 → clean-a-signal:M04 → write-a-grasp-rule:M01 → write-a-grasp-rule:M02 → write-a-grasp-rule:M03 → write-a-grasp-rule:M04

## 先让无动力工位的接口跑通

路径：main；站点：specification。

输入：任务字段与控制规则的经验

交付：可复现环境和无动力工位接口

迁移：原单舵机程序不能发给 SO-101；在正式字段、单位与采样约定下重新核对。

原节点：aloha-bimanual-apprentice:M05 → aloha-bimanual-apprentice:M06 → aloha-bimanual-apprentice:M07 → aloha-bimanual-apprentice:M08

## 先印小夹爪，验证配合再放大

路径：main；站点：fabrication。

输入：实际载荷预算与几何草图

交付：本人试配件、单夹爪与真实端点记录

迁移：单夹爪是独立实物里程碑；试配方法迁移到四臂，尺寸和舵机标定不能直接复制。

原节点：aloha-bimanual-apprentice:M09 → design-a-printed-gripper:M01 → design-a-printed-gripper:M02 → aloha-bimanual-apprentice:M10 → design-a-printed-gripper:M03 → design-a-printed-gripper:M04 → design-a-printed-gripper:M05

## 把试配经验带到四臂工位

路径：main；站点：fabrication。

输入：孔径试配、工作区与载荷预算

交付：四臂打印结构、托盘、相机座和可切断动力的工位

迁移：结构自制全部 3D 打印；购买标准电机与简单紧固件。按原课完成供电、身份和干涉核验。

原节点：aloha-bimanual-apprentice:M11 → aloha-bimanual-apprentice:M12 → aloha-bimanual-apprentice:M13 → aloha-bimanual-apprentice:M14 → aloha-bimanual-apprentice:M15 → aloha-bimanual-apprentice:M16 → aloha-bimanual-apprentice:M17 → aloha-bimanual-apprentice:M18

## 从一个可诊断的小系统开始联调

路径：main；站点：control。

输入：自己的信号、规则与打印夹爪

交付：实物信号抓取机与接口诊断证据

迁移：消费原工作台支持的前作接口；该旋钮夹爪不是四臂遥操作，也不声称采集人体信号。

原节点：assemble-a-signal-controller:M01 → assemble-a-signal-controller:M02 → assemble-a-signal-controller:M03 → assemble-a-signal-controller:M04 → assemble-a-signal-controller:M05 → assemble-a-signal-controller:M06

## 把四臂的边界变成实际检查

路径：main；站点：control。

输入：四臂工位与小系统接口经验

交付：参考姿态、可达区、限位与响应记录

迁移：逐臂重做标定；请求目标不等于实测位置。调试与实际停机遵守原课要求。

原节点：aloha-bimanual-apprentice:M19 → aloha-bimanual-apprentice:M20 → aloha-bimanual-apprentice:M21 → aloha-bimanual-apprentice:M22 → aloha-bimanual-apprentice:M23

## 让两只执行臂按同一时序协作

路径：main；站点：control。

输入：已标定机构、限位和响应记录

交付：同步双臂遥操作与遮挡检查

迁移：左右接口、动作和相机时间须可追查；遥操作成功仍不是自主学习。

原节点：aloha-bimanual-apprentice:M24 → aloha-bimanual-apprentice:M25 → aloha-bimanual-apprentice:M26 → aloha-bimanual-apprentice:M27 → aloha-bimanual-apprentice:M28

## 为同一任务采下自己的示范

路径：main；站点：demonstration。

输入：稳定遥操作与冻结任务规格

交付：本人原始回合、失败标签和起点覆盖

迁移：保留失败及介入。官方演示或合成样本不能改标成本人采集。

原节点：aloha-bimanual-apprentice:M29 → aloha-bimanual-apprentice:M30 → aloha-bimanual-apprentice:M31 → aloha-bimanual-apprentice:M32

## 在训练前先约定陌生条件

路径：main；站点：demonstration。

输入：原始示范与单夹爪挑战问题

交付：整回合数据划分、本地数据包和独立挑战计划

迁移：夹爪挑战与双臂测试分别封存；按回合划分，不把相邻帧分到训练与验证两边。

原节点：test-an-unseen-object:M01 → test-an-unseen-object:M02 → aloha-bimanual-apprentice:M33 → aloha-bimanual-apprentice:M34 → aloha-bimanual-apprentice:M35

## 从可手算预测走到一套小策略

路径：main；站点：learning。

输入：可追查训练回合与冻结划分

交付：固定回放基线、损失与小策略训练器

迁移：训练、验证、测试身份分开；手算与原实验保留，模型误差不能替代实机成功率。

原节点：aloha-bimanual-apprentice:M36 → aloha-bimanual-apprentice:M37 → aloha-bimanual-apprentice:M38 → aloha-bimanual-apprentice:M39 → aloha-bimanual-apprentice:M40 → aloha-bimanual-apprentice:M41 → aloha-bimanual-apprentice:M42 → aloha-bimanual-apprentice:M43 → aloha-bimanual-apprentice:M44 → aloha-bimanual-apprentice:M45 → aloha-bimanual-apprentice:M46

## 让自己的相机参与动作判断

路径：main；站点：learning。

输入：小策略与本人双相机样本

交付：视觉特征、注意力核对与视觉动作策略

迁移：所有原视觉与梯度节点完整保留；默认特征演示不算本人视觉训练。

原节点：aloha-bimanual-apprentice:M47 → aloha-bimanual-apprentice:M48 → aloha-bimanual-apprentice:M49 → aloha-bimanual-apprentice:M50 → aloha-bimanual-apprentice:M51 → aloha-bimanual-apprentice:M52 → aloha-bimanual-apprentice:M53 → aloha-bimanual-apprentice:M54 → aloha-bimanual-apprentice:M55

## 把未来动作接回当前观测

路径：main；站点：learning。

输入：视觉策略、时间偏移和原始回合

交付：动作分块、时间集成与可重置调度器

迁移：不同预测覆盖同一时刻，先核对权重和时间，再连执行接口。

原节点：aloha-bimanual-apprentice:M56 → aloha-bimanual-apprentice:M57 → aloha-bimanual-apprentice:M58 → aloha-bimanual-apprentice:M59

## 理解多种动作走法怎样进入 ACT

路径：main；站点：learning。

输入：合法片段、本人特征与小策略

交付：潜变量、KL 账单与真实 batch 的学习步

迁移：训练有未来动作，推理没有；原数学与实验逐节保留，不以观看动画免修。

原节点：aloha-bimanual-apprentice:M60 → aloha-bimanual-apprentice:M61 → aloha-bimanual-apprentice:M62 → aloha-bimanual-apprentice:M63 → aloha-bimanual-apprentice:M64 → aloha-bimanual-apprentice:M65 → aloha-bimanual-apprentice:M66

## 用本人数据训练并冻结部署包

路径：main；站点：learning。

输入：已核验学习步、整回合划分与设备预算

交付：可重载的本人 ACT 部署候选

迁移：共享 GPU 可以使用，数据身份、配置、日志与模型版本要属于本次任务。

原节点：aloha-bimanual-apprentice:M67 → aloha-bimanual-apprentice:M68 → aloha-bimanual-apprentice:M69 → aloha-bimanual-apprentice:M70

## 先让陌生物体检验小夹爪

路径：main；站点：validation。

输入：封存的独立小夹爪计划

交付：首次实物挑战与修订档案

迁移：保留小课自己的首次结果；它训练验收方法，不替代双臂随机条件测试。

原节点：test-an-unseen-object:M03 → test-an-unseen-object:M04 → test-an-unseen-object:M05

## 实机执行前先检查时序和停止

路径：main；站点：validation。

输入：固定部署候选、标定和测试计划

交付：整链时序、停机证据与签存验收方案

迁移：原课要求的实际掉线与陈旧画面检查保留；离线通过不能声称实机已安全停机。

原节点：aloha-bimanual-apprentice:M71 → aloha-bimanual-apprentice:M72 → aloha-bimanual-apprentice:M73 → aloha-bimanual-apprentice:M74

## 让自主双臂接受全部预定尝试

路径：main；站点：validation。

输入：签存计划与固定版本

交付：首次自主证据、失败分母、域外边界和发布工位

迁移：全部试次保留；遥操作补救必须记介入，首次失败不被修订覆盖。

原节点：aloha-bimanual-apprentice:M75 → aloha-bimanual-apprentice:M76 → aloha-bimanual-apprentice:M77 → aloha-bimanual-apprentice:M78 → aloha-bimanual-apprentice:M79 → aloha-bimanual-apprentice:M80

## 把整套任务交给下一位工程师

路径：main；站点：handover。

输入：全部实物、数据、训练和自主验收材料

交付：可复现的双臂任务与本人贡献清单

迁移：允许诚实交付未通过状态；演示视频、课堂自检和索引保存不替代最终实物验收。

原节点：aloha-bimanual-apprentice:M81 → aloha-bimanual-apprentice:M82
