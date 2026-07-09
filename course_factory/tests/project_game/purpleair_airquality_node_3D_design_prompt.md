# PurpleAir Air-Quality Node 成品使用 3D 版 — 设计 Prompt

> 项目: purpleair-airquality-node (PurpleAir/OpenAQ Air-Quality Node Running EPA NowCast)
> 范式: 项目级产出物模拟 — **成品使用体验**, 全屏 3D, 成品是主角。skill: project_product_game。
> 前作参照(均已验收): emg / mars / satellite / molecule / eeg / ant / stirling 3D。
> 注: 本项目曾有旧 2D 制作过程版 (purpleair_project_game.html, 第一试点), 本版按新范式重做为
> 成品使用体验; 旧版留档不删。

## 0. 范式声明(硬约束)

- 玩家打开时, **节点已装好、已校准、已注册**: 一个带通风孔的防水盒挂在后院木柱上 (内含 Pi Zero +
  PMS5003 + BME280), EPA NowCast 在跑, PurpleAir + OpenAQ 账号已注册。没有任何"焊接/装盒/
  写 nowcast.py/注册 API"步骤。
- 玩家做的事 = **运行这个社区空气站**: 看空气粒子流被吸入通风盒变成实时读数 → 经历一次野火烟雾
  事件, 看 raw 尖峰 vs NowCast 平滑 → 下雨天看湿度把光学传感器"骗高", EPA 校正式拉回真值 →
  跑 30 天交叉验证 (r/MAE/bias vs 最近的 EPA AirNow 官方站) → 数据推上 PurpleAir 公共地图,
  自己的点亮起。全程"我的传感器可信到能上新闻主播用的那张地图"。
- 全屏 3D (Three.js r149 内联, 自写轨道相机)。后院场景 + 节点盒 + 空气粒子流 + 社区地图云板
  都是 3D 实体。❌ 不做 2D 看板。HUD 只是薄薄一层遥测 + 三线曲线。
- **诚实框架 (呼应 blueprint 校准/验证主线)**: 便宜光学传感器的 raw 会被湿度骗 (吸湿颗粒散射
  虚高, 真实现象); 只有校正过 + 对官方站验证过 (报告 bias 不藏) 的数据才配上公共地图。

## 1. 成品定义(玩家拥有的东西)

学生 26 周后的最终产出物, 在游戏里表现为一套已部署的 **社区空气质量节点 "AERO-1"**:

1. **节点硬件** (cover 的白盒): 带百叶通风孔的防水盒挂在木柱上, 盒内 Pi Zero 2W + PMS5003
   激光 PM 传感器 + BME280 温湿度 (校正公式需要 RH)。盒外状态 LED (AQI 六色) + 小 OLED 屏
   (canvas: `AQI 52 GOOD` + PM2.5 数值)。
2. **EPA 真公式软件栈**: NowCast AQI (12 小时加权窗)、EPA AQI breakpoints、EPA PurpleAir
   校正式 `PM2.5corr = 0.534·raw − 0.0844·RH + 5.604`。HUD 模型卡:
   `NowCast · EPA correction · PMS5003 UART`。
3. **社区网络接入**: PurpleAir 地图 + OpenAQ API。3D 场景右上一块**社区地图云板**
   (canvas 地图: 自己的节点点位 + 邻近社区节点 + 最近的 EPA AirNow 官方站)。
4. **验证报告生成器**: 30 天 vs AirNow 散点 + r / MAE / bias。

## 2. 3D 场景与美术

### 2.1 后院场景 (cover 的环境)
- 暖色白天后院: 木栅栏一圈 (板条+尖头, cover 同款)、几丛灌木球、一根**木柱** (节点挂在上面)、
  远处邻居屋顶剪影、地面草地绿。天空暖纸色渐变 (贴 cover 水彩基调), 柔和平行光 + 半球光。
- 风: 空气从场景左侧流向节点 (见 2.3)。

### 2.2 节点盒 (主角)
- 白色防水盒 (圆角盒) 挂柱上: 正面/侧面**百叶通风孔** (一排横槽), 底部电缆下垂, 顶部小檐。
  盒盖半透明或开一个"检修窗"能看见内部: 绿色 Pi 板 + 银色 PMS5003 方块 (带小风扇圆孔) +
  小 BME280。金属支架把盒固定在柱上。
- 盒外: **AQI 状态 LED** (大发光点, 六色随 AQI: 绿/黄/橙/红/紫/褐红) + 小 OLED 屏 (canvas:
  AQI 数值 + 等级词 + PM2.5)。
- 节点吸气: 通风孔处有轻微的粒子汇入效果。

### 2.3 空气粒子流 (核心可视化)
- 从场景左侧流向节点盒的**粒子流** (小球点云, 深灰/棕色 PM 颗粒, 普通材质非 additive —— 浅色
  天空背景下 additive 隐形, skill 踩坑清单)。粒子密度/颜色 = 当前真实 PM2.5:
  清洁天稀疏浅灰; 烟雾天密集橙棕; 卡车经过一阵黑灰脉冲; 雨天粒子被打落变稀 + 湿度上升。
- 粒子沿风场缓动 + 靠近通风孔被吸入消失 (读数就是"吃进去的空气")。

### 2.4 社区地图云板 (cover 的云端地图)
- 场景右上悬浮一块**圆角地图板** (canvas 贴图: 街区路网 + 节点圆点)。自己的节点大点 (AQI 色,
  未发布时灰色空心), 周围 5-6 个社区节点 + 一个 EPA 官方站 (方形标记)。发布后自己的点亮起
  实时变色。板下缘一行 `PurpleAir · OpenAQ · AirNow`。

### 2.5 光照与基调
- 暖色白天; 烟雾事件时天空/雾变橙灰 (野火天的那种颜色, 全局氛围随 AQI); 雨天变蓝灰 + 雨丝
  (细线条粒子)。PMREM 给盒体/支架金属反射。

## 3. 交互与任务链

### 3.1 核心交互(运行空气站)
1. **实时读数**: 开场即在跑 —— 粒子流 → 盒 LED/屏 → HUD (PM2.5 raw / corrected / NowCast AQI)。
   时间加速旋钮 (1x/60x), 曲线滚动。
2. **事件按钮**: `野火烟雾` / `卡车经过` / `下雨` 。
   - 烟雾: PM 基线飙到 150+, 天空变橙, raw 曲线尖峰, **NowCast 平滑爬升** (加权窗对突变响应快
     但不瞬跳 —— 真公式行为), 地图上官方站也变色 (整个街区都在烟里)。
   - 卡车: 一次短脉冲, raw 跳一下, NowCast 几乎不动 —— 点破"NowCast 抗瞬时噪声"。
   - 下雨: 真实 PM 下降 (雨洗尘), 但 **RH 飙升 → raw 虚高** (光学传感器被湿度骗), corrected
     被 EPA 公式拉回 → raw 与 corrected 曲线**分叉**, 这是校正的"啊哈"时刻。
3. **校正开关**: 切 raw / EPA-corrected 喂给 NowCast, 看 AQI 差多少 (雨天差一个等级)。
4. **交叉验证**: 点`对比官方站` → overlay: 30 天散点图 (我的 vs AirNow, 真算生成) +
   r / MAE / bias 数字 + 一句诊断 ("湿度校正后 bias 从 +8.2 降到 +1.4 μg/m³")。
5. **发布上图**: 验证通过 (r>0.9) 才可点`发布到 PurpleAir + OpenAQ` → 地图云板上自己的点亮起
   AQI 色 → 社区仪式 (Zenodo DOI + "野火天新闻主播用的就是这张地图, 现在上面有你一个点")。

### 3.2 任务链(里程碑式仪式, 非门控)
1. 看懂实时链路: 粒子流 → 盒 → AQI 色 LED (认出当前等级)。
2. 经历一次野火烟雾事件, 对比 raw 尖峰 vs NowCast 平滑。
3. 下雨天看湿度骗高 raw, 校正式拉回 (raw/corrected 分叉)。
4. 跑交叉验证 (r/MAE/bias) → 发布上图 → 社区地图仪式。

### 3.3 隐形礼物 bubble
- 首次看 NowCast: "NowCast 替你把 <b>12 小时数据</b>揉成一个可信数字 —— 突变时反应快, 平稳时不抖。"
- 雨天分叉: "它知道<b>湿度在骗光学传感器</b> —— 吸了水的颗粒散射更强, EPA 校正式把它拉回真值。"
- 发布时: "你的点现在和 <b>30,000 个节点</b>在同一张野火地图上 —— 新闻主播下次引用的就是它。"

## 4. 真算引擎(纯函数, node 可单测, 全部教科书公式)

- `pmTrue(t, events)`: 场景真实 PM2.5 时间序列 (小时粒度): 基线日循环 (早晚高峰) + 事件
  (烟雾: +150 持续数小时衰减; 卡车: +80 单小时脉冲; 雨: 基线×0.5) + 确定性噪声。
- `rhAt(t, events)`: 相对湿度序列 (日循环 40-70%, 雨天 →95%)。
- `rawSensor(pmTrue, rh)`: PMS5003 读数模型 —— **湿度增长因子** (吸湿颗粒散射虚高):
  `raw = pmTrue × (1 + κ·max(0,RH−60)/40)` (κ≈0.9, RH>60% 起显著虚高) + 小噪声。
- `epaCorrect(raw, rh)`: **真实 EPA 2020 PurpleAir 校正式**: `0.534·raw − 0.0844·RH + 5.604`
  (clamp ≥0)。
- `nowcast(hourly12[])`: **真实 EPA NowCast**: w* = min/max (clamp 到 [0.5,1]), 加权平均
  Σ(wⁱ·cᵢ)/Σ(wⁱ), 最新在 i=0; 缺前 3 小时任一则无效。
- `aqiFromPM(pm)`: **真实 EPA AQI breakpoints 分段线性** (0-12.0-35.4-55.4-150.4-250.4-350.4-500.4
  ↔ 0-50-100-150-200-300-400-500)。`aqiLevel(aqi)`: 六级 (Good/Moderate/USG/Unhealthy/Very/Hazardous)
  + EPA 六色。
- `genMonth(seed, useCorrection)`: 30 天逐小时数据 (my vs AirNow 官方站: 官方站 = pmTrue +
  自身小噪声; 我的 = raw 或 corrected 的日均), 供散点/验证。
- `crossValidate(mine[], theirs[])`: Pearson r、MAE、mean bias 真算。
- 抽样断言: EPA 校正式与手算一致 (raw=20,RH=50 → 0.534×20−0.0844×50+5.604=12.06);
  NowCast 对 EPA 官方示例级数据的行为 (突变时 w=0.5 快响应; 恒定序列 → 等于该常数);
  AQI breakpoints 关键点 (12.0→50, 35.4→100, 55.4→150); 湿度虚高单调; 校正后 bias 显著下降;
  r/MAE/bias 与 numpy 风格手算一致; 卡车脉冲 raw 跳而 NowCast 移动 <15%。

## 5. UI 硬规范(继承前作)

- **所有说明文字深底亮字**。顶部任务讲解条、左任务卡 + 三线曲线 (raw 灰 / corrected 青 /
  NowCast AQI 金, 自适应 Y 轴 —— skill 踩坑: 判读图表必须自适应), 右遥测卡 (PM2.5 raw/corr /
  RH / NowCast AQI 大数字 + 等级色 / 模型卡), 底部指令条 (时间加速 + 三事件 + 校正开关 +
  对比官方站 + 发布)。
- 曲线/散点/地图/OLED 全 canvas; 数字 JetBrains Mono; 正文 Inter/PingFang SC。
- 中英双语即时切换; 禁 emoji; 1280×800 无滚动条; devicePixelRatio 适配。

## 6. 技术规格

- 单文件 HTML, 内联 three r149 + 少量 CC0 法线纹理 base64, 零依赖。
- 状态机: `S = { ready, tHours(模拟时间), speed, event(active), useCorrection, published,
  history[](逐小时 raw/corr/rh/nowcast/aqi), validation(r/mae/bias), tasks[], lang, phase }`。
- rAF + `simStep(dt)` 帧率无关; 小时推进按 speed; 关键纯函数挂 window 供 e2e
  (nowcast/epaCorrect/aqiFromPM/rawSensor/crossValidate/genMonth)。
- 后院/节点盒/粒子流/地图板均 3D; 曲线/散点/OLED/地图 canvas。

## 7. 验收清单

- [ ] 打开即见: 后院木柱上的通风节点盒 (内见 Pi+PMS5003) + 空气粒子流被吸入 + 社区地图云板,
      无任何"焊接/装盒/写公式"步骤; 3 秒内看到实时 AQI。
- [ ] 实时链路成立: 粒子密度 = 真实 PM2.5, 盒 LED/屏/HUD 同步, AQI 六色正确。
- [ ] NowCast 成立: 烟雾事件 raw 尖峰而 NowCast 平滑爬升; 卡车脉冲 NowCast 几乎不动 (真公式行为)。
- [ ] 湿度校正成立: 雨天 RH 飙升 → raw 虚高与 corrected 分叉, EPA 式拉回; 校正开关影响 AQI。
- [ ] 交叉验证成立: 30 天散点 + r/MAE/bias 真算, 校正后 bias 显著下降; r>0.9 才能发布。
- [ ] 发布仪式成立: 地图云板上自己的点亮起 AQI 色, 社区仪式文案 (30,000 节点 + Zenodo DOI)。
- [ ] 真算抽查一致: EPA 校正式/NowCast/AQI breakpoints/相关 MAE bias 与手算一致, 引擎 node 单测通过。
- [ ] 事件氛围: 烟雾天空变橙、雨天蓝灰+雨丝、卡车黑灰脉冲, 粒子流密度随 PM 变化肉眼可辨。
- [ ] 任务链 4 项完成; UI 深底亮字; 中英切换; 1280×800 无滚动; 零 console error。
- [ ] 整体基调: "我的传感器可信到能上新闻主播用的那张地图", 传达校准/验证的科学诚实与
      社区公民科学的成就感。
