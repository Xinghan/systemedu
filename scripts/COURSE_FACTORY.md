# COURSE_FACTORY.md -- Claude Code 课程生成操作手册

> 当用户说"调用 course_factory"时，Claude Code 按照本手册逐步执行。
> 本手册替代 6 个 Agent 的 LLM API 链式调用，由 Claude Code 自己完成所有内容创作和代码编写。

---

## 前置信息收集

在开始之前，确认以下输入参数（向用户询问缺失项）：

| 参数 | 说明 | 示例 |
|------|------|------|
| `project_idea` | 项目主题（一句话） | "牛顿三定律" |
| `project_name` | 英文 slug | "newton-laws" |
| `node_title` | 当前知识节点标题 | "牛顿第二定律 F=ma" |
| `node_summary` | 节点摘要（1-2 句） | "理解力、质量、加速度的关系" |
| `difficulty` | 难度 1-5 | 3 |
| `milestone_title` | 所属里程碑 | "力与运动" |
| `category` | 学科分类 | science / physics / biology / chemistry / math |
| `age_range` | 目标年龄 | [12, 15] |

如果用户提供的是已有项目，从 `projects/{name}/knowledge_tree.json` 读取节点信息。

---

## Step 1: 撰写学习计划 (plan_markdown)

**你是**：一位资深科学教育者，擅长将复杂概念拆解为阶梯式学习路径。

**输入**：node_title, node_summary, difficulty, milestone_title

**输出**：800-1500 字的 Markdown 学习计划

**格式要求**：

```markdown
## 学习目标

[3-5 条具体可衡量的学习目标，用"能够..."开头]

## 引入：[引人入胜的标题]

[用生活实例或故事引入核心概念，100-200 字]

## 核心概念：[标题]

[知识点的科学严谨解释，200-400 字]
[包含关键术语的定义]
[如果涉及数学公式，用 LaTeX 标注：\(F = ma\)]

## 深入理解：[标题]

[进一步展开，包含示例、对比、或推导过程，200-400 字]

## 应用与拓展

[知识在现实世界的应用，100-200 字]

## 学习路径建议

[学生学完本节后的推荐方向，50-100 字]
```

**质量标准**：
- 科学内容必须准确，公式、数据不能有错
- 语言面向 age_range 年龄段学生，不要过于学术化
- 每段都要有具体例子或类比
- 渐进式难度，从直觉到严谨

---

## Step 2: 抽取 Ideas + 插入占位符

**你是**：一位教育媒体策划师，判断哪些知识点最适合用富媒体呈现。

**从 Step 1 的 plan_markdown 中识别适合做富媒体（animation/game）的知识点，加上 exercise。**

不要为凑数量而强加富媒体。exercise 必须有，animation/game 按难度决定。

### 数量决策依据（按 difficulty 分级）

| difficulty | animation 上限 | game 上限 | exercise | 说明 |
|-----------|---------------|----------|----------|------|
| 1（入门型） | **0** | **0** | 1+ | 内容量小，exercise 就够巩固 |
| 2（印象型） | **0-1** | **0** | 1+ | 可以有 1 个 animation 辅助理解，不生成 game |
| 3（核心概念型） | **1** | **1** | 1+ | 有足够内容支撑富媒体交互，各不超过 1 个 |
| 4（深入应用型） | **1-2** | **1-2** | 1+ | 根据内容复杂度灵活选择 1 或 2 个 |
| 5（综合/设计型） | **2** | **2** | 1+ | 复杂概念需要可视化 + 互动双重支撑 |

**核心原则：animation/game 是昂贵资源，只在教学增益明显大于纯文字时才使用。上限不代表必须用满。**

### Mode 选择规则

| Mode | 适合场景 | 约束 |
|------|---------|------|
| `animation` | 动态过程、物理/化学变化、算法步骤、时序流程 | 按上表上限，**不是必须有** |
| `game` | 互动操作、参数调节、因果探索、分类排序 | 按上表上限，**不是必须有** |
| `exercise` | 检测理解、巩固记忆 | **必须有** 1 个 |
| `story` | 抽象概念引入、历史背景、类比解释 | 可选 |

**优先级**：game > animation > story。如果只选 1 个富媒体，优先选 game（互动性最强）。

### Style Key 选择（10 个可用主题）

| style_key | 适合领域 |
|-----------|---------|
| `aether_clinic` | 医学、神经科学、人体解剖、生理学、健康科学 |
| `ares_mission` | 航天、火箭、天文、物理、行星科学、地质 |
| `celestial_observatory` | 天文、宇宙、恒星、黑洞、引力、光学 |
| `helix_lab` | 基因、DNA、细胞、微生物、生物化学、遗传学 |
| `neural_circuit` | 计算机科学、AI、机器人、电路、编程、数据结构 |
| `subatomic_matrix` | 量子物理、粒子物理、原子结构、波动力学、化学键 |
| `rocketry_control` | 火箭工程、推进系统、轨道力学、工程力学 |
| `aqua_flow` | 海洋科学、水文、流体力学、化学溶液、环境科学 |
| `ember_forge` | 地质学、火山、地球内部结构、冶金、热力学、化学反应 |
| `flora_pulse` | 植物学、光合作用、生态系统、农业、食物链、进化论 |

### 操作

1. 为每个 idea 生成唯一 ID（格式：`{mode}_{timestamp}_{4位随机字母}`）
2. 在 plan_markdown 中找到对应知识点的段落，在段落末尾插入 `[[IDEA:{idea_id}]]` 占位符
3. 输出 ideas 列表

### Ideas 列表格式

```json
[
  {
    "idea_id": "game_1712000000_abcd",
    "mode": "game",
    "style_key": "ares_mission",
    "topic": "牛顿第二定律模拟",
    "context_summary": "通过调节质量和力的大小，观察加速度的变化，理解 F=ma",
    "mode_reason": "参数调节因果探索适合 game 模式"
  },
  {
    "idea_id": "anim_1712000001_efgh",
    "mode": "animation",
    "style_key": "ares_mission",
    "topic": "力的合成与分解",
    "context_summary": "展示力的矢量分解过程和平行四边形法则",
    "mode_reason": "矢量变化适合动态可视化"
  },
  {
    "idea_id": "ex_1712000002_ijkl",
    "mode": "exercise",
    "style_key": "",
    "topic": "F=ma 计算练习",
    "context_summary": "通过选择题巩固对牛顿第二定律的理解",
    "mode_reason": "巩固知识点"
  }
]
```

---

## Step 3: 为每个 Idea 撰写详细实现描述

**你是**：一位教育互动设计师，需要为内容实现者（也就是你自己在 Step 5 中）提供详尽的执行蓝图。

### Animation 详细描述

```json
{
  "style_key": "选定主题",
  "title": "10 字以内",
  "frame_count": 4-6,
  "layout": {
    "focal_object": "主焦点物体",
    "secondary_object": "次焦点物体",
    "safe_area_fill": 0.62
  },
  "asset_plan": ["需要绘制的视觉元素列表"],
  "persuasion": {
    "learning_claim": "20-40 字核心结论",
    "evidence": "20-40 字视觉证据",
    "takeaway": "15-30 字学生能复述什么"
  },
  "beats": [
    {"t": 0.0, "action": "enter", "focus": "主体出现"},
    {"t": 0.2, "action": "anticipation", "focus": "准备动作"},
    {"t": 0.5, "action": "main_action", "focus": "核心演示"},
    {"t": 0.8, "action": "settle", "focus": "回弹/收敛"}
  ],
  "frames": [
    {
      "frame_index": 0,
      "description": "20-40 字场景描述",
      "visual_elements": ["元素1", "元素2"],
      "narration": "可选，20 字以内"
    }
  ],
  "animation_type": "流程演示|对比展示|数据变化|物理过程|概念图解",
  "user_guide": {
    "what_it_shows": "20-30 字一句话描述",
    "observe_points": ["观察重点1", "观察重点2"],
    "controls": "播放控制说明",
    "takeaway": "15-25 字能回答什么"
  }
}
```

### Game 详细描述

**Mechanic 选择**（必须从以下 5 种中选 1 种）：

| mechanic | 适合场景 | 交互方式 |
|----------|---------|---------|
| `simulation` | 参数 -> 结果因果规律 | 2-4 个滑块控制变量 |
| `drag_sort` | 多概念/事物归类 | 拖拽到目标区域 |
| `match_pairs` | 配对记忆（概念 <-> 定义） | 点击两个匹配项 |
| `timeline_order` | 先后顺序或步骤流程 | 拖拽排序 |
| `boss_quiz` | 综合选择题测验 | 点击选项 |

```json
{
  "style_key": "选定主题",
  "game_mechanic": "simulation",
  "mechanic_reason": "15-25 字解释",
  "game_concept": "20-40 字核心概念",
  "game_title": "10 字以内",
  "visual_focus": "主焦点",
  "visual_storyboard": [
    "初始状态描述",
    "核心交互过程描述",
    "完成/反馈状态描述"
  ],
  "persuasion": {
    "learning_claim": "20-40 字",
    "evidence": "20-40 字",
    "takeaway": "15-30 字"
  },
  "interaction_flow": [
    "步骤1：学生做什么操作",
    "步骤2：看到什么变化",
    "步骤3：得出什么结论"
  ],
  "win_condition": "20 字以内",
  "difficulty_hint": "easy|medium|hard",
  "simulation_params": [
    {
      "param_name": "force",
      "label": "施加力",
      "min": 0,
      "max": 100,
      "default": 50,
      "unit": "N"
    }
  ],
  "scene_description": "60-100 字视觉描述",
  "user_guide": {
    "goal": "15-25 字",
    "controls": [
      {"element": "力大小滑块", "action": "调节施加的力"},
      {"element": "质量选择", "action": "切换物体质量"}
    ],
    "steps": ["第1步", "第2步", "第3步"],
    "win_condition": "15-20 字",
    "tips": "15-25 字操作提示"
  }
}
```

### Exercise 详细描述

```json
{
  "exercises": [
    {
      "question": "题目文本",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correct": 0,
      "explanation": "详细解析"
    }
  ]
}
```

**练习题要求**：
- 4 道选择题，每题 4 个选项
- 难度渐进：第 1 题概念题 -> 第 2-3 题应用题 -> 第 4 题综合题
- 每题必须有详细解析（50-100 字）
- 干扰项要有教学意义（反映常见错误认知）

### Story 详细描述

```json
{
  "title": "10 字以内",
  "paragraphs": [
    {
      "text": "故事段落，100-150 字",
      "image_url": ""
    }
  ]
}
```

---

## Step 4: 自我质疑 (Debate)

**你是**：一位严格的教育内容评审官，对每个 idea 进行正反辩论。

### 对每个 idea 逐一质疑

**正方（教学价值）**：
- 这个富媒体比纯文字描述有多大增益？
- 学生能从交互中得到什么纯阅读得不到的？

**反方（可行性质疑）**：
- HTML 实现难度是否超出单文件 100vh 的限制？
- 视觉效果能否真正做到好看（而不是简陋到影响学习体验）？
- 交互逻辑是否过于复杂导致 bug 风险高？
- 有没有更简单的方式达到同样的教学效果？

**裁决标准**：
- 如果教学逻辑有错误 -> 直接 **reject**
- 如果技术不可行（100vh 内无法布局、交互过于复杂）-> **reject**
- 如果纯文字就能讲清楚，富媒体增益不大 -> **reject**
- **如果 game 的本质就是选择题（如 boss_quiz 只有点选项），和 exercise 重复 -> reject game，保留 exercise 即可**
- 其他情况 -> **approve** 或 **revise**（简化后通过）

**操作**：
1. 列出每个 idea 的裁决结果
2. 被 reject 的 idea：从 ideas 列表移除，从 plan_markdown 中删除其占位符
3. 需要 revise 的 idea：修改其 detail_plan（通常是简化交互）
4. 向用户报告裁决结果，询问是否同意

---

## Step 5: 实现具体代码

**你是**：一位高级前端开发者 + 教育游戏设计师。

### 通用 HTML 硬性约束（animation 和 game 共用）

```
1. 单文件自包含 HTML（<!DOCTYPE html> 到 </html>）
2. body { overflow: hidden; height: 100vh; margin: 0; padding: 0; }
3. 所有内容必须在一屏内布局完成，禁止垂直滚动条
4. 深色主题背景
5. 字体：Space Grotesk（标题/数据） + Inter/Noto Sans SC（正文）
6. 可使用 Google Fonts CDN
7. 0px 圆角（所有元素 border-radius: 0）
8. 禁止纯色平涂，必须用渐变
9. 禁止传统 drop-shadow，用 ambient glow 代替
10. 玻璃态效果：backdrop-filter: blur(12px); background: rgba(...)
11. 禁止 onclick="fn()" 属性 -- 必须用 addEventListener 绑定事件
12. 布局必须用 flex 列布局（wrapper flex-column + canvas flex:1），禁止 calc(100vh-Npx)
13. Canvas 必须有延迟重绘兜底（setTimeout + fonts.ready）
14. 动画播放必须用 requestAnimationFrame，禁止 setInterval
15. 必须包含 i18n 双语支持（EN/CN），默认中文，左上角放语言切换按钮
16. 所有用户可见文本必须通过 I18N 对象 + t(key) 函数查表，禁止硬编码中文或英文字符串
17. Animation 帧切换必须使用共享元素过渡（getFrameElements + lerp + easeInOut，500ms）
```

### 物理常识约束（必须遵守）

```
1. 重力方向：物体自然下落，向画面下方。
   陨石坑、水面、地面在画面下方或底部。
   天空、太阳、星空在画面上方。树木从地面向上生长。
   雨和雪从上往下落。

2. SVG/Canvas 坐标系：y 轴向下递增。
   y=0 是顶部（天空），y=max 是底部（地面）。

3. 方向性：箭头指向运动方向。河流从高处流向低处。
   火焰和烟雾向上飘。电流从正极到负极。光从光源向外发散。

4. 比例关系：远处物体小，近处物体大。
   太阳比地球大。细胞比人小。原子比分子小。

5. 颜色常识：天空蓝色系，植物绿色系，岩浆/火红橙色系，
   水蓝色透明系，土壤棕色系。不要用反直觉的颜色。
```

### Animation HTML 实现

**结构**：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=Inter:wght@400;500&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
  /* 全局重置 + 深色主题 + 玻璃态 */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100vh; overflow: hidden; background: #0f0a1e; }
  /* ... 根据 style_key 的 palette 定制配色 ... */
</style>
</head>
<body>
  <!-- 观看指南面板（可折叠） -->
  <div class="guide-panel">...</div>

  <!-- 主动画区域（Canvas 或 SVG） -->
  <canvas id="c"></canvas>

  <!-- 控制栏（播放/暂停/上一帧/下一帧） -->
  <div class="controls">...</div>

  <!-- HUD 数据栏 -->
  <div class="hud">...</div>

<script>
  // 动画逻辑
</script>
</body>
</html>
```

**Canvas 动画规范**：
- 使用 `scripts/course_factory.py` 中的 `make_canvas_html()` 格式作为参考
- 底色：深夜蓝黑渐变 `#0f0a1e -> #1a1035`，带微弱网格（3% 透明白）
- 主发光色根据学科选择（见下方色板）
- 渐变质感：`createLinearGradient` 或 `createRadialGradient`，3 层色
- 发光效果：`ctx.shadowColor = color; ctx.shadowBlur = 12-20`
- HUD 底栏：`rgba(0,0,0,0.55)` 半透明条，高 52px，显示 4 列数据
- DPR 感知：`Math.min(window.devicePixelRatio||1, 2)` 缩放
- 动画运动必须由数学/物理公式驱动，禁止关键帧插值

**学科色板**：

| 学科 | 主发光色 | 辅色 |
|------|---------|------|
| 物理/力学 | `#818cf8` 幽蓝紫 | `#6366f1` |
| 数学/几何 | `#34d399` 翡翠绿 | `#10b981` |
| 化学/生物 | `#f472b6` 荧光粉 | `#ec4899` |
| 地球/天文 | `#fb923c` 橙焰 | `#f97316` |
| 通用/综合 | `#38bdf8` 天蓝 | `#0ea5e9` |

### Game HTML 实现

**结构**同 Animation，但增加交互逻辑：

```html
<!-- 额外需要的元素 -->
<div class="game-area">
  <!-- simulation: 滑块 + 实时模拟画面 -->
  <!-- drag_sort: 可拖拽元素 + 目标区域 -->
  <!-- match_pairs: 卡片网格 -->
  <!-- timeline_order: 可排序列表 -->
  <!-- boss_quiz: 选项卡片 -->
</div>

<div class="feedback-panel">
  <!-- 得分/进度/通关提示 -->
</div>
```

**Game 特有要求**：
- 每个按钮/滑块必须绑定事件处理函数
- 拖拽功能必须实现 mousedown/mousemove/mouseup + touch 事件链
- 得分和通关判定逻辑必须能正确触发
- 通关后展示学习总结面板
- user_guide 的操作步骤必须与实际可执行的操作完全一致

### i18n 双语规范

**所有 animation 和 game HTML 都必须包含 i18n 双语支持。**

**语言切换按钮**（固定左上角，玻璃态样式）：

```html
<button class="lang-btn" id="langBtn">CN</button>
```

```css
.lang-btn {
  position: fixed; top: 8px; left: 8px; z-index: 100;
  font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 700;
  padding: 4px 10px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(20,20,35,0.85); backdrop-filter: blur(12px);
  color: #ffb59c; letter-spacing: 1px;
}
```

**I18N 对象 + t() 函数**（JS 中定义）：

```js
var LANG = 'cn'; // 默认中文
var I18N = {
  title:    {en:'ANIMATION TITLE', cn:'\u52a8\u753b\u6807\u9898'},
  subtitle: {en:'SUBTITLE TEXT',   cn:'\u526f\u6807\u9898\u6587\u5b57'},
  btnPlay:  {en:'PLAY',            cn:'\u64ad\u653e'},
  btnPause: {en:'PAUSE',           cn:'\u6682\u505c'},
  btnPrev:  {en:'PREV',            cn:'\u4e0a\u4e00\u5e27'},
  btnNext:  {en:'NEXT',            cn:'\u4e0b\u4e00\u5e27'},
  // ... 所有可见文本，包括 Canvas 绘制的标注、HUD、guide 面板内容
};
function t(key) { return (I18N[key] && I18N[key][LANG]) || (I18N[key] && I18N[key]['en']) || key; }
```

**使用方式**：
- **Animation (Canvas)**：所有 `drawLabel()`/`drawText()` 调用使用 `t('key')` 取文本，切换语言后 redraw
- **Game (DOM)**：DOM 元素的 textContent 通过 `t('key')` 设置，切换时调用 `refreshI18N()` 重新设置

**语言切换事件绑定**：

```js
document.getElementById('langBtn').addEventListener('click', function(){
  LANG = LANG === 'en' ? 'cn' : 'en';
  document.getElementById('langBtn').textContent = LANG.toUpperCase();
  refreshI18N(); // 重新设置所有文本 + 重绘 Canvas
});
```

**refreshI18N() 函数**必须更新：
1. 所有 DOM 文本元素（标题、按钮、HUD 标签、guide 面板）
2. 调用 `drawFrame(currentFrame)` 重绘 Canvas（animation 场景）
3. 重新渲染动态生成的 DOM 列表（game 场景的卡片、区域内容等）

### 帧间过渡规范（Animation 专用）

**Animation 帧切换必须使用共享元素过渡（Shared Element Transition），类似 Keynote Magic Move。**

核心思路：每帧定义一组元素列表（`getFrameElements(f)`），过渡时对两帧中同 ID 的元素做 lerp 位置/大小插值，非共享元素做 alpha 淡入/淡出。

#### 元素模型

每帧返回一个元素数组，每个元素有统一结构：

```js
// 常用元素类型
{id:'photo', type:'photo', x:..., y:..., w:..., h:..., alpha:1}
{id:'title', type:'label', text:'...', x:..., y:..., color:'...', size:14, align:'center', alpha:1}
{id:'arrow01', type:'arrow', x1:..., y1:..., x2:..., y2:..., color:'...', alpha:1}
{id:'dict', type:'dict', x:..., y:..., w:..., h:..., highlight:1, alpha:1}
{id:'decision', type:'decision', x:..., y:..., w:..., h:..., active:true, alpha:1}
{id:'features', type:'features', x:..., y:..., w:..., h:..., alpha:1}
{id:'custom1', type:'custom', draw:function(alpha){...}, alpha:1}
```

`getFrameElements(f)` 根据帧号和当前 W/H 计算并返回元素列表。

#### drawElement(el) 分发绘制

```js
function drawElement(el) {
  if (!el || el.alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = el.alpha;
  switch(el.type) {
    case 'photo':    drawPhotoBoxPrimitive(el.x, el.y, el.w, el.h); break;
    case 'label':    drawLabelPrimitive(el.text, el.x, el.y, el.color, el.size, el.align); break;
    case 'text':     drawTextPrimitive(el.text, el.x, el.y, el.color, el.size, el.align); break;
    case 'arrow':    drawArrowPrimitive(el.x1, el.y1, el.x2, el.y2, el.color); break;
    case 'dict':     drawDictBoxPrimitive(el.x, el.y, el.w, el.h, el.highlight); break;
    case 'decision': drawDecisionBoxPrimitive(el.x, el.y, el.w, el.h, el.active); break;
    case 'box':      drawBox(el.x, el.y, el.w, el.h, el.borderColor, el.fillColor); break;
    case 'custom':   el.draw(el.alpha); break;
  }
  ctx.restore();
}
```

#### 工具函数

```js
function lerp(a, b, p) { return a + (b - a) * p; }
function easeInOut(x) { return x < 0.5 ? 2*x*x : 1 - Math.pow(-2*x+2, 2)/2; }
function merge(base, overrides) {
  var r = {};
  for (var k in base) r[k] = base[k];
  for (var k2 in overrides) r[k2] = overrides[k2];
  return r;
}
```

#### 过渡动画核心

```js
var transitioning = false;

function transitionTo(newFrame) {
  if (newFrame < 0) newFrame = 0;
  if (newFrame >= totalFrames) newFrame = totalFrames - 1;
  if (newFrame === currentFrame && !transitioning) { drawFrame(currentFrame); updateHUD(currentFrame); return; }
  if (transitioning) return;

  var oldElems = getFrameElements(currentFrame);
  var newElems = getFrameElements(newFrame);
  var oldMap = {}; oldElems.forEach(function(e){ oldMap[e.id] = e; });
  var newMap = {}; newElems.forEach(function(e){ newMap[e.id] = e; });

  currentFrame = newFrame;
  updateHUD(newFrame);
  transitioning = true;

  var startTime = null;
  var duration = 500; // ms

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var raw = Math.min((timestamp - startTime) / duration, 1);
    var p = easeInOut(raw);

    drawBg();

    // 旧帧独有元素：淡出
    oldElems.forEach(function(oe) {
      if (!newMap[oe.id]) drawElement(merge(oe, {alpha: 1 - p}));
    });

    // 新帧元素
    newElems.forEach(function(ne) {
      var oe = oldMap[ne.id];
      if (oe) {
        // 共享元素：lerp 位置/大小
        var merged = merge(ne, {
          x: lerp(oe.x||0, ne.x||0, p),
          y: lerp(oe.y||0, ne.y||0, p),
          w: lerp(oe.w||0, ne.w||0, p),
          h: lerp(oe.h||0, ne.h||0, p),
          alpha: 1
        });
        // 箭头类型额外 lerp 端点
        if (ne.type === 'arrow' && oe.type === 'arrow') {
          merged.x1 = lerp(oe.x1, ne.x1, p);
          merged.y1 = lerp(oe.y1, ne.y1, p);
          merged.x2 = lerp(oe.x2, ne.x2, p);
          merged.y2 = lerp(oe.y2, ne.y2, p);
        }
        // 文本不同时做交叉渐变
        if ((ne.type==='label'||ne.type==='text') && oe.text !== ne.text) {
          drawElement(merge(oe, {alpha: 1 - p}));
          drawElement(merge(ne, {alpha: p}));
        } else {
          drawElement(merged);
        }
      } else {
        // 新帧独有元素：淡入
        drawElement(merge(ne, {alpha: p}));
      }
    });

    if (raw < 1) {
      requestAnimationFrame(step);
    } else {
      transitioning = false;
    }
  }
  requestAnimationFrame(step);
}
```

#### drawFrame 保留为即时绘制

`drawFrame(f)` 仍然存在，用于 resize / 语言切换等需要立即重绘的场景：

```js
function drawFrame(f) {
  drawBg();
  var elems = getFrameElements(f);
  elems.forEach(function(el) { drawElement(el); });
}
```

#### 共享元素 ID 约定

animation 作者需要为每帧中相同的物体使用相同的 `id`，这样过渡引擎会自动做平滑插值。例如：

| 元素 ID | Frame 0 | Frame 1 | Frame 2 | Frame 3 |
|---------|---------|---------|---------|---------|
| `photo` | 居中大照片 | 左侧缩小 | 更小照片 | (淡出) |
| `title` | 步骤标题 | 步骤标题(文本变) | 步骤标题(文本变) | 步骤标题(文本变) |
| `desc`  | 底部说明 | 底部说明(文本变) | 底部说明(文本变) | - |

文本变化的共享元素（同 ID 但 text 不同）会自动做交叉渐变（旧文本淡出 + 新文本淡入）。

**使用规则**：
- PREV/NEXT 按钮调用 `transitionTo(f)` 而非直接 `drawFrame(f)`
- PLAY 自动播放时也使用 `transitionTo()`
- 过渡时长 500ms，easeInOut 缓动
- `drawFrame(f)` 仅用于 resize / 语言切换等即时重绘场景

### 内嵌操作指南面板规范

**所有 animation 和 game 都必须包含此面板。**

```css
.guide-panel {
  position: fixed;
  top: 8px;
  right: 8px;
  width: 260px;
  max-height: 40vh;
  overflow-y: auto;
  background: rgba(20, 20, 35, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 12px;
  z-index: 100;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 13px;
  color: rgba(255,255,255,0.85);
}
.guide-panel h3 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
.guide-panel .guide-content { /* 可折叠区域 */ }
.guide-panel ul { padding-left: 16px; line-height: 1.6; }
```

内容来自 detail_plan 的 user_guide 字段：
- Animation：what_it_shows + observe_points + controls + takeaway
- Game：goal + controls + steps + win_condition + tips

### 数学公式渲染

如果 HTML 中需要数学公式：
- 在 `<head>` 中加载 KaTeX CDN（0.16.11 版本）
- 行内公式：`\(E = mc^2\)`
- 块级公式：`$$\int_0^\infty e^{-x}\,dx = 1$$`
- 禁止用 SVG `<text>` 元素手写公式

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"
  onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}]})"></script>
```

### STYLE_KITS 配色速查

从 `media_art_direction.py` 的 STYLE_KITS 中读取对应 style_key 的 palette：

```python
from systemedu.agents.builtin.media_art_direction import STYLE_KITS
kit = STYLE_KITS["你选的style_key"]
palette = kit["palette"]  # bg, surface, primary, secondary, text, muted 等
```

然后将 palette 的颜色值直接写入 HTML 的 CSS 中。

### 输出前自检清单

在完成每个 HTML 后，逐条检查：

```
[ ] body 设置了 overflow: hidden; height: 100vh?
[ ] 没有垂直滚动条?
[ ] 重力方向正确?（物体向下落，地面在底部）
[ ] 所有箭头方向符合物理规律?
[ ] 颜色符合常识?
[ ] 所有按钮/控件都绑定了事件并能正常工作?
[ ] 拖拽功能实现了完整的事件链?（如适用）
[ ] 得分和通关逻辑能正确触发?（如适用）
[ ] 操作指南面板存在且内容与实际操作一致?
[ ] 使用了渐变而非纯色平涂?
[ ] border-radius 全部为 0px?
[ ] 字体使用了 Space Grotesk + Noto Sans SC?
[ ] 包含 I18N 对象和 t() 函数，所有可见文本通过 t(key) 查表?
[ ] 左上角有语言切换按钮（CN/EN），点击可切换所有文本?
[ ] Animation 帧切换使用共享元素过渡（getFrameElements + transitionTo + lerp）?（animation 适用）
```

### Exercise 实现

直接构造 JSON 列表，不需要写 HTML：

```python
exercises = [
    {
        "type": "choice",
        "question": "题目文本",
        "options": ["A", "B", "C", "D"],
        "correct": 0,  # 正确选项索引 0-3
        "explanation": "详细解析"
    },
    # ... 共 4 题
]
```

### Story 实现

构造段落列表：

```python
story_paragraphs = [
    {"text": "第一段故事文本...", "image_url": ""},
    {"text": "第二段故事文本...", "image_url": ""},
    {"text": "第三段故事文本...", "image_url": ""},
]
```

---

## Step 5.5: Code Review & Browser Verify

**在写入 DB 之前，必须对每个 HTML 文件进行代码审查和浏览器验证。**

这一步的目的是捕获"脑中自检"无法发现的运行时问题。

### 5.5a. 代码审查清单

对每个 animation/game HTML 文件逐条检查：

**事件绑定（高频 bug 源）**
```
[ ] 禁止使用 onclick="fn()" 属性绑定 -- 必须用 addEventListener
    原因：IIFE 内定义的函数不在全局作用域，onclick 属性引用全局作用域会找不到函数
[ ] 所有按钮、滑块、拖拽元素都通过 addEventListener 绑定事件
[ ] 拖拽功能同时绑定了 mouse 和 touch 事件链
```

**Canvas 初始化时序（iframe 嵌入场景）**
```
[ ] Canvas 尺寸获取使用父容器 getBoundingClientRect()，而非 canvas 自身
    原因：iframe 嵌入时 canvas 可能尚未获得正确尺寸
[ ] resize() 末尾有 width/height 为 0 的安全检查：if(rect.width < 1 || rect.height < 1) return;
[ ] 有延迟重绘兜底：setTimeout(resize, 200) 和 setTimeout(resize, 600)
[ ] 有字体加载完成后重绘：document.fonts.ready.then(function(){ resize(); })
```

**布局健壮性**
```
[ ] 使用 flex 布局（而非 calc）分配 header/canvas/controls/hud 的高度
    推荐：wrapper 用 display:flex; flex-direction:column; height:100vh;
    canvas 容器用 flex:1; min-height:0; 自动占满剩余空间
[ ] 没有使用 calc(100vh - Npx) 计算 canvas 高度
    原因：iframe 嵌入时 100vh 的含义可能不同，组件高度也可能因字体加载而变化
```

**动画播放逻辑**
```
[ ] 使用 requestAnimationFrame 而非 setInterval
    原因：setInterval 不随页面隐藏暂停，rAF 更流畅且省电
[ ] 播放结束时正确 cancelAnimationFrame 并重置状态
[ ] 播放按钮文本在 PLAY/PAUSE 之间正确切换
[ ] 从最后一帧点击 PLAY 时自动回到第一帧重新播放
```

**交互功能（game 特有）**
```
[ ] 拖拽的 touchmove 事件调用了 e.preventDefault() 防止页面滚动
[ ] 拖拽的 ghost 元素在 touchend 时被正确移除
[ ] 得分/通关判定逻辑在边界条件下不会重复触发
```

**i18n 双语支持（animation + game 共用）**
```
[ ] 定义了 I18N 对象，包含所有可见文本的 en/cn 键值对
[ ] 定义了 t(key) 函数，默认返回当前 LANG 对应文本
[ ] 默认语言为 cn（中文），LANG 变量初始值为 'cn'
[ ] 左上角有语言切换按钮 (.lang-btn)，通过 addEventListener 绑定
[ ] 点击切换按钮后调用 refreshI18N()，更新所有 DOM 文本和 Canvas 重绘
[ ] 没有硬编码的中文或英文字符串（所有文本通过 t() 函数查表）
```

**帧间过渡（animation 特有）**
```
[ ] 定义了 getFrameElements(f) 返回每帧的元素列表（声明式）
[ ] 每个元素有 id 字段，同 ID 元素在帧间自动 lerp 插值
[ ] transitionTo() 函数实现共享元素动画（lerp 位置/大小 + 淡入淡出）
[ ] PREV/NEXT/PLAY 按钮均调用 transitionTo() 而非直接 drawFrame()
[ ] drawFrame(f) 保留用于 resize / 语言切换等即时重绘
[ ] 包含 lerp(), easeInOut(), merge() 工具函数
[ ] 过渡时长 500ms，easeInOut 缓动
```

### 5.5b. Playwright 自动化浏览器验证

Step 5 中已将 HTML 写入 `scripts/_test_anim_xxx.html` 或 `scripts/_test_game_xxx.html`。
使用 Playwright headless Chromium 自动验证，无需手动打开浏览器。

**单文件验证**（快速检查单个 HTML）：
```bash
node scripts/html_validate.mjs scripts/_test_anim_xxx.html --mode animation
node scripts/html_validate.mjs scripts/_test_game_xxx.html --mode game
# mode 可省略，会根据文件名自动检测（_anim_ -> animation, _game_ -> game）
```

输出 JSON 报告，exit 0 = pass, 1 = fail。检查项：
- 页面加载无 JS 错误
- 无 console.error
- Canvas/SVG 非全黑（5 点采样）
- 无垂直滚动条
- Animation: #btnNext 可点击且帧号变化，#langBtn 存在
- Game: 交互元素存在且可见

**批量验证**（验证所有现有 HTML 文件）：
```bash
cd scripts && npx playwright test --config=playwright.config.mjs
```

`html_validate_test.mjs` 自动发现 `scripts/_test_anim_*.html` 和 `scripts/_test_game_*.html`，
对每个文件生成通用测试套件（JS 错误、Canvas 渲染、滚动条），animation 额外测试
NEXT/PREV/PLAY/语言切换，game 额外测试交互元素存在性。

**手动浏览器验证**（可选补充）：
```bash
open scripts/_test_anim_xxx.html
open scripts/_test_game_xxx.html
```

肉眼检查：动画播放流畅度、视觉效果、拖拽交互手感等 Playwright 难以量化的项目。

### 5.5c. 常见问题修复模式

| 症状 | 根因 | 修复 |
|------|------|------|
| 点击按钮无反应 | onclick 属性 + IIFE 作用域冲突 | 改用 addEventListener |
| Canvas 黑屏/空白 | getBoundingClientRect 返回 0 | 加 setTimeout 兜底 + 检查 rect.width |
| 动画卡顿/不流畅 | 使用 setInterval | 改用 requestAnimationFrame |
| 页面有滚动条 | calc(100vh - Npx) 计算不准 | 改用 flex 布局 |
| 字体显示为默认体 | 首次渲染时 Google Fonts 未加载 | fonts.ready 后重绘 |
| 拖拽时页面跟着滚动 | touch 事件未 preventDefault | touchmove 中加 e.preventDefault() |

**如果浏览器验证发现问题，修复后必须重新执行 5.5a 和 5.5b，直到全部通过。**

---

## Step 6: 组装 CourseContent 并写入 DB

### 6a. 组装 CourseContent

使用 `scripts/course_factory.py` 中的 `make_course_content()` 函数：

```python
python3 << 'PYEOF'
import sys, json, time, random, string
sys.path.insert(0, "src")
sys.path.insert(0, ".")
from scripts.course_factory import make_course_content, make_exercises, _upsert_lesson, _ensure_db_tables

# -- plan_markdown (从 Step 1 粘贴) --
plan_markdown = """
...Step 1 的完整 Markdown...
"""

# -- animation HTML (从 Step 5 粘贴) --
animation_html = """
...完整 HTML...
"""

# -- exercises (从 Step 5 粘贴) --
exercises = make_exercises([
    {"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "..."},
    # ...
])

# -- 组装 --
course_content = make_course_content(
    plan_markdown=plan_markdown,
    animation_html=animation_html,
    animation_topic="动画主题",
    exercises=exercises,
    exercise_topic="练习主题",
    story_paragraphs=None,  # 或 [{"text": "...", "image_url": ""}]
)

# -- 写入 DB --
_ensure_db_tables()
_upsert_lesson(
    project_name="项目名",
    knode_id=0,  # 节点 ID
    content_type="interactive",
    course_content=course_content,
)

print("写入成功!")
print(f"ideas 数量: {len(course_content['ideas'])}")
for idea in course_content["ideas"]:
    print(f"  [{idea['mode']}] {idea['topic']}")
PYEOF
```

### 6b. 如果有 game（make_course_content 不够用时手动组装）

当有 game 类型的 idea 时，`make_course_content()` 只支持 animation + exercise + story，
需要手动构造 CourseContent：

```python
python3 << 'PYEOF'
import sys, json, time, random, string
sys.path.insert(0, "src")
sys.path.insert(0, ".")
from scripts.course_factory import _upsert_lesson, _ensure_db_tables

def _id(prefix):
    ts = int(time.time() * 1000)
    rand = "".join(random.choices(string.ascii_lowercase, k=4))
    return f"{prefix}_{ts}_{rand}"

plan_markdown = """..."""

# 构造 ideas 和 rendered_sections
game_id = _id("game")
anim_id = _id("anim")
ex_id = _id("ex")

ideas = [
    {
        "idea_id": game_id,
        "mode": "game",
        "topic": "...",
        "context_summary": "...",
        "generation_backend": "claude_code",
        "style_key": "...",
        "mode_reason": "...",
    },
    {
        "idea_id": anim_id,
        "mode": "animation",
        "topic": "...",
        "context_summary": "...",
        "generation_backend": "claude_code",
        "style_key": "...",
        "mode_reason": "...",
    },
    {
        "idea_id": ex_id,
        "mode": "exercise",
        "topic": "...",
        "context_summary": "...",
        "generation_backend": "",
        "style_key": "",
        "mode_reason": "巩固知识点",
    },
]

rendered_sections = {
    game_id: {
        "mode": "game",
        "status": "ready",
        "html": """...game HTML...""",
        "story_paragraphs": None,
        "exercises": None,
        "generation_backend": "claude_code",
        "user_guide": "...",
    },
    anim_id: {
        "mode": "animation",
        "status": "ready",
        "html": """...animation HTML...""",
        "story_paragraphs": None,
        "exercises": None,
        "generation_backend": "claude_code",
        "user_guide": "...",
    },
    ex_id: {
        "mode": "exercise",
        "status": "ready",
        "html": None,
        "story_paragraphs": None,
        "exercises": [
            {"type": "choice", "question": "...", "options": [...], "correct": 0, "explanation": "..."},
        ],
        "generation_backend": "",
    },
}

course_content = {
    "plan_markdown": plan_markdown,
    "ideas": ideas,
    "rendered_sections": rendered_sections,
}

_ensure_db_tables()
_upsert_lesson("项目名", 0, "interactive", course_content)
print("写入成功!")
PYEOF
```

### 6c. 验证写入结果

```python
python3 << 'PYEOF'
import sys, json
sys.path.insert(0, "src")
from systemedu.storage.db import LessonContent, get_session

db = get_session()
lesson = db.query(LessonContent).filter_by(
    project_name="项目名", knode_id=0
).first()
if lesson:
    cc = json.loads(lesson.course_content)
    print(f"Status: {lesson.status}")
    print(f"Ideas: {len(cc.get('ideas', []))}")
    for idea in cc.get("ideas", []):
        section = cc["rendered_sections"].get(idea["idea_id"], {})
        has_html = bool(section.get("html"))
        has_ex = bool(section.get("exercises"))
        print(f"  [{idea['mode']}] {idea['topic']} | html={has_html} exercises={has_ex}")
else:
    print("未找到课程记录!")
db.close()
PYEOF
```

---

## 设计规范参考文档

### animation_game_design/ 目录

6 个完整设计系统参考：

| 目录 | 设计系统 | 参考文件 |
|------|---------|---------|
| `animation_game_design/aether_clinic/` | 医疗诊断 HUD | `DESIGN.md` + `code.html` |
| `animation_game_design/ares_mission_control/` | 火星任务控制 | `DESIGN.md` + `code.html` |
| `animation_game_design/celestial_observatory/` | 星空天文台 | `DESIGN.md` + `code.html` |
| `animation_game_design/helix_lab_hud/` | 遗传合成实验室 | `DESIGN.md` + `code.html` |
| `animation_game_design/neural_circuit/` | 神经电路实验室 | `DESIGN.md` + `code.html` |
| `animation_game_design/subatomic_matrix/` | 亚原子量子场 | `DESIGN.md` + `code.html` |

**跨设计系统的共享原则**：

1. **无边框规则**：禁止 1px solid 边框划分区域，用背景色调层级划分
2. **色调分层**：surface -> surface_container_low -> surface_container_high -> surface_bright
3. **渐变必需**：禁止纯色平涂，所有主体用 3 层色渐变
4. **玻璃态**：浮动元素用 backdrop-filter: blur(12-20px) + 40-60% 透明度
5. **0px 圆角**：所有角必须 90 度直角
6. **双字体**：Space Grotesk（技术标题）+ Inter/Noto Sans SC（正文）
7. **环境光晕**：主色 5-20% 透明度 + 32-60px 模糊
8. **幽灵边框**：如需辅助边界，用 outline_variant 15-20% 透明度

**实现 HTML 时，先读取对应 style_key 目录下的 `code.html`，参考其真实的 CSS 和 JS 实现。**

---

## 完整执行流程检查清单

```
[ ] Step 1: plan_markdown 800-1500 字，科学准确，有具体例子
[ ] Step 2: 3-4 个 ideas，mode/style_key 选择合理，占位符已插入
[ ] Step 3: 每个 idea 的 detail_plan 完整（含 user_guide）
[ ] Step 4: debate 完成，reject 的已移除，向用户确认
[ ] Step 5: HTML 通过自检清单，exercises 有 4 题且有解析
[ ] Step 5.5a: Code Review 通过（事件绑定、Canvas 时序、flex 布局、rAF）
[ ] Step 5.5b: Playwright 验证通过: node scripts/html_validate.mjs <file> 返回 exit 0
[ ] Step 5.5b: 批量验证通过: cd scripts && npx playwright test --config=playwright.config.mjs
[ ] Step 6: 成功写入 DB，验证查询通过
[ ] 启动前端确认：./scripts/restart.sh 后访问对应页面查看效果
```

---

## 快速参考：CourseContent 数据结构

```json
{
  "plan_markdown": "完整学习计划 Markdown（含 [[IDEA:xxx]] 占位符）",
  "ideas": [
    {
      "idea_id": "唯一ID",
      "mode": "animation|game|exercise|story",
      "topic": "简短描述",
      "context_summary": "30-50字摘要",
      "generation_backend": "claude_code",
      "style_key": "STYLE_KITS中的key",
      "mode_reason": "选择原因"
    }
  ],
  "rendered_sections": {
    "idea_id": {
      "mode": "animation|game|exercise|story",
      "status": "ready",
      "html": "完整HTML字符串 或 null",
      "story_paragraphs": "[{text,image_url}] 或 null",
      "exercises": "[{type,question,options,correct,explanation}] 或 null",
      "generation_backend": "claude_code",
      "user_guide": "操作说明文本"
    }
  }
}
```
