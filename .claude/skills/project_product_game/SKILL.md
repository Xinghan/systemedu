---
name: project_product_game
description: 为一个项目生成"项目级产出物模拟游戏" — 单个全屏 3D 交互 HTML, 让学生在开始学习前就"用到"这个项目 26/32/44 周后将做出的最终成品。被 course_factory 在项目级流程(知识树确认后)调用, 也可独立按 slug 调用。
---

# PROJECT_PRODUCT_GAME.md — 项目级产出物模拟游戏 操作手册

> 当用户说「给 <slug> 做产出物模拟游戏 / 项目级游戏 / product game」, 或 course_factory
> 项目级流程走到"知识树已确认、最终产出物已明确"时调用本 skill。
> 本 skill 独立于 course_factory 的 9 类**逐 knode** 富媒体 (那是节点级 game/3d_object)。
> 本 skill 产出的是 **一项目一个** HTML, 模拟**整个项目的最终交付物**, 是学生的"未来预览"。

---

## 0. 这是什么 / 为什么 (最高准绳, 违反即返工)

**一句话**: 每个项目做**一个仅一个互动 HTML 游戏**, 整体模拟这个项目的**最终产出物**,
让学生在开始学习前就亲手"玩到"他们学完能做出的东西, 建立价值感与成就动机。

**四条不可违反的定位 (用户反复纠正沉淀, 每条都踩过坑)**:

1. **成品使用体验, 不是制作过程。** 玩家操作的是**已经做好的成品本身**, 感受"学完能得到什么" ——
   打开就是一台部署好的机器/一件做好的产品, 直接用它、看结果。
   ❌ 绝不做"分章节走一遍开发流程/调参/返工/训练"的制作模拟。
   （软件类同理: 给一个成品, 输入 → 操作 → 看输出, 而不是重走"写代码"的过程。）

2. **全屏 3D 场景, 成品是主角, 不是 2D 看板。** Three.js r149 UMD **内联进单文件**,
   自写轨道相机。成品是可旋转/缩放的 3D 实体, 放在它真实应用的环境里操作。
   ❌ 绝不做仪表盘/看板式 2D UI。HUD 只是薄薄一层遥测 + 指令条。

3. **两步流程, 强制。** 先根据项目 blueprint 写一份**非常详细的设计 prompt** (`<slug>_3D_design_prompt.md`),
   **再**据此实现 HTML。❌ 绝不把项目描述直接当 prompt 一把梭生成。

4. **极度逼真 + 大量细节, 瞄准 cover/story 图的精细度。** 用真实开源资源 (three.js + CC0 PBR 纹理)。
   细节要"多而细": 例如线束要几十根细线而不是 3-5 根粗管; 车轮要辐条+抓地筋+轮辋而不是光胎。
   这个 3D 只是**样例**(不必每根线真实), 但要让它**有科技感、像真的**。

**不限领域, 所有项目都要做。** 已验证 5 领域: 实时力控 (义肢手) / 车辆+地形 (火星车) /
遥感数据+伦理 (卫星考古) / 生物化学数据科学纯软件 (分子药物发现)。纯软件类也是"模拟一个真实场景"。

---

## 1. 输入 / 前置

- **项目 blueprint**: `~/dev/systemeduidea/projects_data/<slug>/blueprint/README.md`
  (注意: 在 systemeduidea 仓, 不在 systemedu2)。含 Hook / Final Deliverable / Syllabus / 真实世界类比。
- **cover + story 图** (若有): `~/dev/systemeduidea/projects_data/<slug>/cover.png` 与 `story/story-*.jpg`。
  **必读**: 它们定义了这个项目的**核心叙事意象**与目标精细度。往往 cover 一张图就点破了成品的灵魂
  (例: molecule 的 cover 是"分子钥匙插进怪物蛋白的钥匙孔" → 3D 主角就定为分子球棍 + 蛋白口袋对接)。
- **最终产出物描述**: blueprint 的 `## Final Deliverable`; 若由 course_factory 调用, 也可用知识树的
  `final_outcomes` (项目终极产出物结构化对象)。

- **产物落位**: `course_factory/tests/project_game/<slug>_3D_design_prompt.md` + `<slug>_3D.html`。
- **临时区**: 用会话 scratchpad 放引擎脚本 / 单测 / e2e / 截图 / 纹理 (可后续删)。

---

## 2. 第一步 — 写详细设计 prompt (`<slug>_3D_design_prompt.md`)

**读 blueprint + cover/story → 提炼领域模型 → 写设计 prompt。** 结构固定 8 节 (照抄骨架, 填领域内容):

```
# <项目名> 成品使用 3D 版 — 设计 Prompt
> 范式声明 + 前作参照 + 本试点定位

## 0. 范式声明(硬约束)      —— 抄第 0 节四定位, 点明本项目的成品与"使用"动作
## 1. 成品定义(玩家拥有的东西) —— 给成品起个产品代号; 列它的组成部件(3D 实体清单)
## 2. 3D 场景与美术           —— 主角(们)的几何/材质/布局; 应用环境; 光照基调; 致敬 cover 意象
## 3. 交互与任务链            —— 核心交互(用成品的动作); 任务链(里程碑式仪式, 非门控);
                               隐形礼物 bubble(点破产品替玩家做了什么)
## 4. 真算引擎(纯函数)        —— 逐个列纯函数签名 + 真实公式/算法(见第 5 节"真算"铁律)
## 5. UI 硬规范              —— 深底亮字; HUD 布局; 字体; i18n; 1280×800 无滚动
## 6. 技术规格              —— 单文件内联 three+纹理; 状态机 S 字段; rAF+simStep(dt); window 暴露
## 7. 验收清单              —— 逐条可勾: 打开即成品 / 核心体验成立 / 真算一致 / 视觉达标 / UI可读 / 基调正确
```

**领域建模要点** (设计 prompt 的灵魂 = 找到"这个成品在用时算什么"):
- 找到成品的**核心动作**: 派卫星过境扫描 / 让车自主开过去 / 给分子怪物配钥匙对接 / 让义肢手抓鸡蛋。
- 找到**真实可算的物理/数据模型**: NDVI 光谱、rocker-bogie 悬挂、ESOL 溶解度经验式、PID 力闭环。
- 找到**"隐形礼物"**: 成品替玩家做了什么了不起的事 (探测器 3 秒扫完一个县 / CNN 拆出 8 个特征)。
- 若项目有**伦理/诚实维度**, 做成硬闸门 (见第 6 节"闸门模式")。

---

## 3. 第二步 — 实现 HTML

### 3.1 复用管线 (不要重造轮子)
参照最近一个已验收的 `*_3D.html` (mars / satellite / molecule) 作为脚手架起点, 复用:
- 内联 three r149 UMD、CC0 纹理 base64、自写轨道相机 (CAM az/pol/rad + updateCamera)、
  射线拾取、深底亮字 UI 调色板、i18n T 表、rAF + `simStep(dt)` 帧率无关循环。
- **素材获取** 与 **内联脚本** 见 `references/pipeline.md` (three.js 从哪拿、CC0 纹理直链、
  base64 内联脚本、`<!--ENGINE-->`/`<!--TEX_DATA-->`/`<!--THREE_INLINE-->` marker 注入法)。
- 现成可复用脚本在 `scripts/`: `check_js.mjs` (多段 script 语法检查)、`inline_three.mjs` (注入模板)。

### 3.2 单文件结构 (marker 注入法)
HTML 里放三个注释 marker, 用 node 脚本把大块内容注入 (保持源码可读, 避免手贴 600KB):
```html
<script><!--ENGINE--></script>        <!-- 纯算引擎(若独立开发); 否则直接写在页面 script 里 -->
<script><!--TEX_DATA--></script>       <!-- window.TEX_DATA = {key:'data:image/...'} -->
<script><!--THREE_INLINE--></script>   <!-- three.js r149 UMD 全文 -->
<script> /* 页面逻辑: 状态机 S + 3D 场景 + UI + 输入 + simStep */ </script>
```

### 3.3 状态机与调试暴露 (Playwright 依赖)
- `const S = { ready, ...领域态, tasks[], lang, camFollow, phase }`; `window.S = S`。
- 关键对象与**纯函数**挂 window (`window.simStep`, `window.parseX`, `window.dockScore` ...),
  供 e2e `evaluate` 驱动与断言。
- **帧率无关**: `function simStep(dt){ const DT=(dt>0)?Math.min(dt,0.05):(1/60); ... }`;
  主循环 `const _clock=new THREE.Clock(); simStep(_clock.getDelta())`。
  **为什么**: headless swiftshader 的 rAF 只有 ~5-10fps, 固定 DT 会让动作变慢帧; e2e 靠直接
  `simStep(step)` ×N 确定性推进。

---

## 4. 真算铁律 (与 course_factory "真算不假动画" 一脉相承)

**所有数值必须真算, 不做假动画。** 引擎是纯函数, 抽到 node 跑单测, 抽样与手算/教科书值一致。

- 例: 分子 MW 用元素质量和 (阿司匹林算出 180.16、咖啡因 194.19, 跟教科书对齐);
  溶解度用真实 Delaney ESOL 经验式; 地形分类逐像素真算; PID 真积分。
- **有区分度**: 打分/预测要有梯度和重叠 (否则阈值旋钮、排序、Top-N 就是假的)。
  例: dockScore 若所有满足特征的分子都给满分 → Top10 全 100 分, 排序无意义 →
  必须加连续互补性项做梯度。
- **确定性**: 用 hash 噪声, 同 seed 同结果 (方便单测与复现); 真值/诱因由同一函数确定性注入。
- **先写引擎, node 单测跑通再接 3D。** 引擎 bug 在 node 里几行就能定位, 塞进 1.5MB HTML 里难查。

---

## 5. UI 硬规范 (深底亮字, 每次烙进去)

- **所有说明文字深底亮字**, 绝不让文字裸糊在 3D 场景/地表/星空上 (用户踩过"说明文字都看不到"的坑)。
  统一: 深色半透明面板 `rgba(20,24,34,~0.86)` + 亮字 `#eef2fb`/`#f5ecdc`; 顶部任务讲解条、
  左任务卡、右遥测/分析卡、底部指令条各自带深底。浅色按钮给深字 (`#2a2118` on `#efe0c8`)。
- 数字/坐标/指标/代码 用 `JetBrains Mono`; 正文 Inter/PingFang SC。
- **禁 emoji** (全项目铁律); 反馈用纯文字 / SVG / canvas / 3D。
- 中英双语即时切换 (EN 键, 全文案走 T 表, 无漏翻无溢出)。
- 固定 **1280×800 无滚动条**; devicePixelRatio 适配。

---

## 6. 可复用的体验模式 (从 5 试点提炼, 按项目取用)

- **任务链 (里程碑式仪式, 非门控)**: 3-5 个任务引导玩家把成品的核心能力走一遍, 结尾一个
  "报告/日志"仪式收尾 (NASA traverse log / 披露报告 / R&D 候选报告), 配一句真实世界致敬语
  (Parcak 17 座金字塔 / Insilico·Atomwise)。仪式是成就感锚点, 不是及格门槛。
- **隐形礼物 bubble**: 关键动作首次触发时弹一句, 点破"成品刚替你做了什么了不起的事"。
- **诚实 / 伦理闸门** (项目有此维度时做成硬闸门): 报告里放一个**诱饵按钮** (公开精确坐标 /
  宣布找到治愈), 点了触发**警示演出** (红闪 + 规范说明: ICOMOS 负责任披露 / "AI 只缩小搜索空间"),
  必须选负责任的那个 (移交文物局 / 移交湿实验室) 才能完成任务。伦理是产品的一部分。
- **自适应/权衡旋钮**: 让玩家体感真实取舍 (阈值滑杆的查准/查全、地形自适应减速)。

---

## 7. 验证 (必须真跑, 不靠推断 — 与 course_factory 一致)

三层验证, 全绿才算完成:

1. **引擎 node 单测**: 抽纯函数到 node, 断言与手算/教科书值一致 + 边界 (无效输入不崩、
   打分单调、去重有效)。典型 20-48 条。
2. **Playwright 浏览器 e2e**: headless swiftshader, 走**正确使用路径** + 关键断言
   (成品渲染非空、核心交互改变状态、真算数字与引擎一致、闸门行为正确、i18n、**零 console error**)。
   典型 20-41 条。用确定性 `simStep(step)` ×N 推进, 不靠 wall-clock。
   e2e 骨架见 `references/verification.md`。
3. **截图 eyeball 迭代 (视觉铁律)**: 见 [[3d-visual-verify-by-screenshot]] —— **不截图不许说"修好了"**。
   多角度截图确认布局/朝向/可见性; 定位问题元素时染红 + 冻结姿态 + 多角度; 盲调欧拉角前先
   用 `lookAt`/`getWorldPosition` 投影到屏幕坐标核对物体在不在画面、在哪。

---

## 8. 累积踩坑清单 (务必先读 references, 别重犯)

- `references/pitfalls-3d.md` — 3D 视觉与几何踩坑:
  相机太近看不到主角、口袋/凹陷被半透明表面糊住 (depthTest:false)、AdditiveBlending 把多个彩色
  发光点烧成一坨白、dock 落点要用"世界坐标+世界法线"精确定位、侧裙/底盒顶面高于地形最低点会吞画面、
  自定义 BufferGeometry 要手动加 UV 才能贴图、PMREM 环境给金属真反射、CanvasTexture 记得 sRGBEncoding。
- `references/pitfalls-vehicle.md` — 车辆类行驶动作规范 (mars 沉淀, 通用):
  车头对齐速度方向 (yaw↔heading 映射严格推导, 差 90° 就是横滑)、车轮真滚动 (v/r 转速 + 左右差速 +
  原地转向反转, 转整个轮 group 绕轴 X)、逐轮贴地悬挂 (每帧采样轮下地形, 增量反解摇臂/转向架角,
  横坡反馈车身 roll, 轮底压进解析地面 ~0.1 防悬空)、行驶扬尘尾迹 (生命 1.6-2.4s, 尘色比地暗一档)。
- `references/pipeline.md` — three.js/CC0 素材获取 + 内联脚本 + marker 注入。
- `references/verification.md` — node 单测 + Playwright e2e 骨架代码。

---

## 9. 工具调用纪律 (来自项目 CLAUDE.md, 本 skill 会大量跑脚本, 尤其要守)

- **禁止在 Bash 里内联带缩进的多行 Python** (`python3 -c "..."` 含 for/if/try/def 多行块) ——
  这是本仓 malformed tool call 的高频触发点。要解析 JSON / 跑结构检查, **先 Write 成 `.py` 文件再跑**。
  单行 `python3 -c "print(...)"` 可以; 一旦要缩进就走文件。Playwright 脚本一律写成 `.py`/`.mjs` 文件跑。
- 工具结果返回前不臆测、不接着写后续步骤。

---

## 10. 完成后

- `commit + push` (conventional commit, 讲清成品定位 + 真算模型 + 验证结果 + 视觉踩坑;
  `Co-Authored-By: Claude ...`)。
- 更新记忆 [[project-level-product-game]] (追加本项目 + 新踩坑)。
- 若 course_factory 调用: 把产物路径回报给主流程, 供项目包引用。

---

## 附: 已验收试点 (参照精细度与结构)

| slug | 领域 | 成品 | 独有维度 |
|---|---|---|---|
| emg-prosthetic-hand | 实时力控 | 义肢手抓鸡蛋 | 抓取全程状态机 + PID 力闭环 |
| mars-analog-rover | 车辆+地形 | 自主火星车 | rocker-bogie 逐轮贴地 + NASA traverse log |
| satellite-archaeology | 遥感+伦理 | 卫星考古平台 | NDVI 揭示 + 负责任披露闸门 |
| molecule-monster-hunter | 生化数据科学(纯软件) | AI 药物发现工作台 | 药效团对接 + 科学诚信闸门 |

产物均在 `course_factory/tests/project_game/<slug>_3D.html` + `_3D_design_prompt.md`。
