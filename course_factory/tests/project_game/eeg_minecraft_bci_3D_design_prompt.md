# EEG-Minecraft BCI 成品使用 3D 版 — 设计 Prompt

> 项目: eeg-minecraft-bci (EEG-Controlled Minecraft, Real Brain-Computer Interface)
> 范式: 项目级产出物模拟 — **成品使用体验**, 全屏 3D, 成品是主角。skill: project_product_game。
> 前作参照(均已验收): emg_prosthetic_hand_3D / mars_analog_rover_3D / satellite_archaeology_3D /
> molecule_monster_hunter_3D。

## 0. 范式声明(硬约束)

- 玩家打开时, **BCI 已训练好、解码器已部署**: 一套脑机接口在线, CSP+LDA 分类器已在 BCI
  Competition IV + 你自己的脑电数据上训练完 (HUD 摆着准确率 74%)。没有任何"学 mne / 实现 CSP /
  录数据 / 训练"步骤。
- 玩家做的事 = **用意念控制方块世界**: 做运动想象 (想左手 / 想右手 / 放松) → 实时看脑电波在
  C3/C4 电极去同步 → CSP 空间滤波 → LDA 判别出意图 → 方块世界里的角色/方块随之动。
  全程"戴着自己造的 BCI 用脑子玩 Minecraft"。
- 全屏 3D (Three.js r149 内联, 自写轨道相机)。脑电头环 + 脑电波信号流 + 方块世界都是 3D 实体。
  ❌ 不做 2D 看板。HUD 只是薄薄一层遥测 + 波形。
- **诚实框架 (呼应 blueprint 的 "EEG is hard")**: EEG 信号噪声大, 准确率是真实的 (不是 100%);
  眨眼/咬牙会引入 artifact 干扰; 每 session 要校准应对漂移。这是真 BCI, 不是魔法。

## 1. 成品定义(玩家拥有的东西)

学生 28 周后的最终产出物, 在游戏里表现为一套已部署的 **意念控制系统 "NEUROBLOCK"**:

1. **脑电头环 + 电极** (Muse/OpenBCI 风格): 3D 头模型 + 头环 + 若干电极 (C3/C4/Cz 高亮为
   运动皮层电极)。电极随脑活动亮度脉动。cover 的头环意象。
2. **实时信号链可视化**: 头环 → 一条起伏的**脑电波信号带** (cover 的橙色波流) → CSP 滤波盒 →
   LDA 判别 → 意图输出。信号带在场景里从头飞向方块世界, 波形真实反映当前 mu/beta 功率。
3. **训练好的 CSP+LDA 解码器**: 2-3 类运动想象 (左手→左移 / 右手→右移 / 放松→停/放置方块)。
   HUD 模型卡: `CSP+LDA · 2-class 74% · BCI IV + self`。
4. **方块世界 (Minecraft-like)**: 体素地形 + 一个玩家角色 (Steve-ish) 或一个可操控的悬浮方块,
   意图驱动它移动/挖/放。一个需要脑控完成的小任务 (走到目标 / 搭三格桥 / 挖到矿)。

## 2. 3D 场景与美术

### 2.1 脑电头环 + 头 (主角之一, 左侧)
- 低模人头 (肤色, 闭眼安详, 致敬 cover) + 头环带 (深灰塑料 + 金属电极触点)。
- 电极小圆盘, C3(左运动皮层)/C4(右运动皮层)/Cz 用不同色高亮; 电极亮度 = 该电极当前信号功率。
- 想左手 → 右脑 C4 的 mu 节律 ERD (功率下降) → C4 电极变暗/换色; 想右手 → C3 ERD。
  (真实神经科学: 运动想象在**对侧**感觉运动皮层产生 mu/beta 去同步。)

### 2.2 脑电波信号带 (主角之二, 中段)
- 从头环流向方块世界的一条**实时波形带** (cover 的橙色信号流): 用一串点/条带 mesh, 高度 =
  当前 EEG 采样值 (真算, 见 §4)。放松时低幅 alpha; 运动想象时对应频段功率变化肉眼可见。
- 波流中段穿过一个半透明的 **CSP 滤波盒** + **LDA 判别器** 小装置 (发光), 表示信号被处理。
- 判出意图时, 信号带末端**染成该意图的颜色** (左=蓝, 右=橙, 放松=绿) 并脉冲, 打到方块世界。

### 2.3 方块世界 (主角之三, 右侧)
- 体素地形 (草块/土块/石块/水, InstancedMesh 拼): 一小片 Minecraft 风格地块 + 几棵方块树。
- 一个**可操控主体**: 悬浮的发光方块 (光标) 或简易角色。意图驱动它左移/右移/放置方块。
- 目标标记 (任务点): 一个金色方块 / 一片待搭的桥 / 一处矿脉。
- 体素材质用 CC0 纹理或程序化 canvas 拼色 (草绿顶+土棕侧), 硬边像素感。

### 2.4 光照与基调
- 暖纸色/柔和背景 (致敬 cover 水彩感) 或深色科技空间二选一; 建议偏暖科技 —— 头/头环冷色仪器,
  方块世界暖色, 信号流橙色贯穿。主平行光 + 补光, 柔阴影。PMREM 给电极金属反射。

## 3. 交互与任务链

### 3.1 核心交互(用 BCI)
1. **发起运动想象**: 三个大按钮 `想左手 / 想右手 / 放松` (或键盘 A/D/S), 按住模拟"持续想象"。
   → 引擎驱动对应电极 ERD + 波形变化 → CSP+LDA 实时判别 → 出意图 + 置信度 → 主体动。
   (真 BCI 里玩家真的做运动想象; 这里用按钮"点播"想象状态, 但下游信号链全真算。)
2. **实时遥测**: HUD 显示当前意图 / 置信度 / C3-C4 功率条 / 延迟 (ms) / 本 session 准确率。
3. **artifact 干扰**: 一个 `眨眼/咬牙` 按钮, 按下往波形注入大幅 artifact → 分类器短暂失准
   (置信度掉、可能误判) → 点破"真 BCI 要实时剔除眨眼伪迹"。
4. **重新校准**: 信号会随时间**漂移** (baseline 缓慢偏移, 准确率下降); `校准` 按钮重设 baseline,
   准确率回升 → 点破"每 session 要校准"。
5. **任务**: 用意图把主体开到目标 / 搭三格桥 / 挖到矿。完成给"闭环成功"仪式。

### 3.2 任务链(里程碑式仪式, 非门控)
1. 做一次运动想象, 看脑电波去同步 + 判出意图。
2. 用左/右意念把光标移到目标列。
3. 处理一次 artifact (眨眼后校准回来)。
4. 用"放置"意图搭完三格桥 (或挖到矿), 完成脑控任务 → BCI 闭环报告 (准确率/延迟/ITR 信息传输率)。

### 3.3 隐形礼物 bubble
- 第一次判出意图: "解码器刚从 <b>4 个电极的微伏级噪声</b>里读出了你的意图 —— 你 28 周学的 CSP+LDA。"
- 第一次 artifact: "它得学会<b>忽略眨眼</b>: 一次眨眼的电压是脑波的 10 倍。"
- 完成任务: "Synchron、Neuralink 用的<b>正是这套运动想象范式</b>让瘫痪患者重新控制光标。"

## 4. 真算引擎(纯函数, node 可单测)

- `eegSample(t, state, chan)`: 逐通道 (C3/C4/Cz) 生成 EEG 采样。基底: alpha(10Hz)+beta(20Hz)+
  粉噪声。运动想象态: **对侧** mu(8-12Hz)/beta 功率按 ERD 系数下降 (想左手→C4 功率×0.5,
  想右手→C3 功率×0.5, 放松→双侧 alpha 抬升)。确定性 (hash 噪声, 同 t/seed 同值)。
- `bandPower(samples, f_lo, f_hi)`: 对一窗采样估计频段功率 (简化: 带通后 RMS² 或 Goertzel 单频)。
- `cspProject(winC3, winC4)`: CSP 空间滤波 → 2 个方差特征 (log-variance)。用一个固定的
  2×2 CSP 矩阵 (预"训练"好) 把 C3/C4 功率投影成最大化左右可分性的两维。
- `ldaClassify(features)`: 预训练 LDA (固定权重向量 w + 偏置) → {intent: left/right/rest,
  conf: 0-1, scores}。真算判别函数 wᵀx+b → softmax。
- `applyArtifact(samples, kind)`: 眨眼 (低频大幅 ~10×) / 咬牙 (高频肌电) 叠加, 让特征偏移。
- `driftedBaseline(t)`: baseline 随 t 缓慢漂移; `calibrate()` 重设。
- `accuracy(recentDecisions, truth)`: 滑窗真实准确率 (受 artifact/drift 影响, 校准后回升)。
- `itr(acc, nClasses, secPerDecision)`: 信息传输率 bits/min (真公式, 报告用)。
- 抽样断言: 想左手时 C4 mu 功率 < C3; LDA 对干净的左/右想象判对; artifact 后 conf 下降;
  校准后 accuracy 回升。

## 5. UI 硬规范(继承前作)

- **所有说明文字深底亮字**。顶部任务讲解条、左任务卡、右遥测卡 (意图/置信度/C3-C4功率/延迟/准确率)、
  底部指令条 (想左手/想右手/放松/眨眼/校准 + 任务按钮)。
- 波形/功率谱用 canvas 手绘; 数字/指标 JetBrains Mono; 正文 Inter/PingFang SC。
- 模型卡: `CSP+LDA · 2-class 74% · BCI IV + self · Muse 4ch` (静态铭牌, 强化"你训练的模型")。
- 中英双语即时切换; 禁 emoji; 1280×800 无滚动条; devicePixelRatio 适配。

## 6. 技术规格

- 单文件 HTML, 内联 three r149 + 少量 CC0 法线纹理 base64, 零依赖。
- 状态机: `S = { ready, intent, conf, imagining(left/right/rest/none), artifact, baseline,
  accuracy, latency, world(体素+光标位置), task, tasks[], lang, camFollow, phase }`。
- rAF + `simStep(dt)` 帧率无关; EEG 波形环形缓冲, 每帧推进; 关键纯函数挂 window 供 e2e。
- 头/头环/电极/信号带/CSP盒/方块世界均 3D; 波形/功率谱 canvas。

## 7. 验收清单

- [ ] 打开即见: 戴头环的头(左) + 脑电波信号带(中) + 方块世界(右), 无任何"学习/训练/录数据"步骤;
      3 秒内能做一次运动想象看到反应。
- [ ] 神经科学正确: 想左手 → **右脑 C4** mu/beta ERD (对侧去同步), 想右手 → C3, 电极亮度联动。
- [ ] 信号链成立: 脑电波实时反映频段功率 → CSP 滤波 → LDA 判出意图 + 置信度, 信号带染意图色打到方块世界。
- [ ] 意念控制成立: 左/右/放松意图驱动方块世界主体移动/放置, 能完成脑控任务。
- [ ] 诚实维度成立: 准确率真实(非100%); 眨眼/咬牙 artifact 让分类器短暂失准; 漂移 + 校准回升。
- [ ] 任务链完成, 结尾 BCI 闭环报告 (准确率/延迟/ITR + Synchron/Neuralink 致敬)。
- [ ] 真算抽查一致: eegSample ERD 方向、cspProject、ldaClassify、accuracy 受 artifact/drift 影响,
      引擎 node 单测通过。
- [ ] 视觉达标: 头环电极质感 + 脑电波信号流 + 方块世界体素 + 意图色脉冲, 达 emg/mars/satellite/
      molecule 3D 版精致度。
- [ ] UI 全部深底亮字清晰; 中英切换无漏翻; 1280×800 无滚动条; 零 console error。
- [ ] 整体基调: "戴着你自己造的 BCI, 用意念玩方块世界", 传达"undergraduate-thesis-level 真 BCI"的
      成就感与诚实(EEG 很难, 但你做到了 74%)。
