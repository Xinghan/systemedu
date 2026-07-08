# 车辆类行驶动作规范 (mars-analog-rover 沉淀, 所有车辆/移动机器人项目复用)

> 用户逐条盯出来的"这不像真车在开"清单。任何带轮子/履带/行走的成品都照这个做。

## 1. 车头对齐速度方向 (否则"横着滑")
- 模型前向通常是 +z; 世界行进方向 (cos h, sin h) → **yaw = π/2 − heading**。
  (曾用 `−heading + π` 差了 90°, 车身垂直于行进方向平移, 看着像横着滑。)
- Euler order 用 `'YXZ'` (先 yaw 再 pitch/roll 在车身系)。
- pitch>0 = 车头higher = 抬头 → `rotation.x = −pitch*k`。

## 2. 车轮真滚动
- **转整个轮子 group 绕轴 X**, 不是只转光滑胎面 mesh (只转胎面, 抓地筋/轮毂不动就穿帮;
  且给已 `rotation.z=π/2` 的胎面再叠 rotation.x 会被欧拉合成弄歪轴)。
- 转速 = v / wheelRadius; **左右差速** (skid-steer): `spin += (v ± yawDot*halfTrack)/r * DT`
  (外侧轮快、内侧慢); 原地转向时两侧**反转** (yawDot 大、v≈0)。
- 转弯速度耦合: heading 误差大时降速; 误差 >1.2 rad 原地转 (v→0)。

## 3. 逐轮贴地悬挂 (rocker-bogie 的灵魂 = 每个轮子独立贴地, 行程可见)
- 每帧采样**每个轮子脚下**的解析地形高度, 反解摇臂/转向架关节角让每个轮贴地:
  - 摇臂角 `θ += −(dyFront − dyBogie)/armLen * k` (armLen = 前轮力臂到 bogie 枢轴的 z 距离);
  - 转向架角 `φ += −(dyMid − dyRear)/bogieHalf * k`;
  - dy = (解析地面高 + 轮半径 − 0.1) − 轮子当前世界 y。压进 0.1 见 pitfalls-3d "地形/底座"。
- **横坡的左右高差摇臂在纵向平面吸收不了 → 必须反馈进车身 roll**:
  `rollAdj += ((dySideRight − dySideLeft)/track) * k`。
- 平滑: `k = min(1, dt*9)` 做一阶跟随, clamp 关节角上下限。
- 摇臂画成**真实连杆** (枢轴→轮毂的斜拉杆 + bogie 枢轴销), 驱动线缆沿摇臂走线并随臂联动,
  比一根光杆读感真实得多。

## 4. 行驶扬尘
- 后轮后方粒子池 (billboard 面片朝相机), 速度触发生成, **生命 1.6-2.4s 才能拉出可见尾迹长度**
  (太短看不见尾巴), 松软地形 (sinkRisk 高) 尘量约翻倍。
- **尘色要比地面暗一档否则看不见** (同色系+被提亮 → 隐形); CanvasTexture 设 sRGBEncoding。
- 生命曲线用"先保持后淡出" `opacity = base*(1 − (t/max)²)`, 拉出拖尾感。

## 车轮几何 (Curiosity 铝轮, 金属轮通用)
- 开放金属胎面带 (CylinderGeometry openEnded) + 双缘轮辋 (Torus) + 十几条细人字抓地筋 (细 Box) +
  辐条 + 螺栓轮毂。真火星车轮是机加工铝, 不是橡胶光胎。
