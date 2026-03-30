"""
GP-01 蛋白结构探险地图 — 完全由 Claude Code 生成
节点：M05N01「α螺旋：大自然的弹簧」完整课程

不调用任何 LLM agent pipeline。
Claude Code 直接生成：知识树 + 课程文本 + SVG 动画 + 练习题 + 故事
然后写入数据库。
"""

from __future__ import annotations

import json
import sys
import time
import random
import string
from datetime import datetime
from pathlib import Path

_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_ROOT / "src"))
sys.path.insert(0, str(_ROOT))

import yaml
from rich.console import Console
from rich.panel import Panel

console = Console()

# ── 工具 ────────────────────────────────────────────────────────

def _id(prefix: str) -> str:
    ts = int(time.time() * 1000)
    rand = "".join(random.choices(string.ascii_lowercase, k=4))
    return f"{prefix}_{ts}_{rand}"

# ── 项目基础信息 ────────────────────────────────────────────────

PROJECT_NAME = "protein-structure"
PROJECT_TITLE = "蛋白结构探险地图"
PROJECT_DESCRIPTION = (
    "从氨基酸到 AlphaFold，少年版蛋白质序列—结构—功能可视化探索课程。"
    "基于10岁儿童知识水平构建完整学习路径，涵盖化学直觉、二级结构、三级结构、"
    "活性位点、折叠病与 AI 预测。"
)
PROJECT_CATEGORY = "biotech"
PROJECT_AGE_RANGE = [10, 16]
PROJECT_ESTIMATED_HOURS = 16.5
PROJECT_TAGS = ["biology", "protein", "structure", "biochemistry", "AlphaFold"]

TREE_PATH = _ROOT / "projects" / "protein-structure" / "knowledge_tree.json"

# ── 课程节点：M05N01 α螺旋 ──────────────────────────────────────
# 在知识树中的全局 knode_id（按模块顺序计算）：
# M01: 3节(0,1,2), M02: 3节(3,4,5), M03: 3节(6,7,8), M04: 3节(9,10,11)
# M05N01 = 第12个节点，knode_id = 12
TARGET_KNODE_ID = 12
TARGET_NODE_TITLE = "α螺旋：大自然的弹簧"
TARGET_NODE_SUMMARY = (
    "α螺旋是蛋白质链绕成的右手螺旋结构，每3.6个氨基酸旋转一圈，"
    "靠骨架氢键维持，侧链朝外。头发和指甲富含α螺旋。"
)

# ── 步骤1：完整课程文本（plan_markdown）────────────────────────
# 标准：参考 lesson_M04N03_secondary_structure.md 的质量和深度
# 包含：故事开篇、知识讲解（带类比）、数字、历史、实验、小结

PLAN_MARKDOWN = """# M05N01：α螺旋——大自然的弹簧

> **模块**：二级结构：局部折叠规律
> **知识等级**：L2-操作 | **难度**：3/10 | **预计时长**：30分钟
> **先修知识**：肽键（M04N01）、氢键直觉（M02N02）

---

## 开篇故事：铁丝的记忆

想象你手里有一段铁丝。把它笔直拉开——它是直的。现在，把铁丝紧紧绕在铅笔上，一圈一圈，绕满整根铅笔。然后，小心地抽出铅笔。

神奇的事发生了：铁丝"记住"了螺旋的形状，保持成一个弹簧。

你的头发，就是由千千万万条这样的"蛋白质弹簧"组成的。

---

## 第一部分：什么是α螺旋？

α螺旋是蛋白质多肽链在局部区域形成的一种有规则的**右手螺旋**结构。

"右手"是什么意思？用右手握住一根想象中的螺旋轴，四根手指弯曲的方向，就是α螺旋旋转的方向。世界上大多数α螺旋都是右手螺旋（左手螺旋极为罕见）。

### 关键数字（理解，不用背）

| 参数 | 数值 | 意义 |
|------|------|------|
| 每圈氨基酸数 | **3.6个** | 不是整数！这是α螺旋稳定性的来源之一 |
| 螺距（每圈高度） | **0.54纳米** | 约等于5-6个氢原子叠起来的高度 |
| 每个氨基酸上升距离 | 0.15纳米 | 0.54 ÷ 3.6 |
| 螺旋直径（骨架） | ~0.5纳米 | 侧链朝外，更宽 |

---

## 第二部分：氢键是如何让弹簧保持形状的？

α螺旋能保持螺旋形状，靠的是**氢键**——一种弱但数量多的力。

### 氢键的位置

多肽骨架上有两种原子团：
- **N-H**（每个氨基酸骨架上都有）—— 氢键的**给体**（提供H）
- **C=O**（每个氨基酸骨架上都有）—— 氢键的**受体**（接受H）

规律是：**第 i 个**残基的 C=O，和**第 (i+4) 个**残基的 N-H，之间形成氢键。

类比：想象一条很长的拉链——不是普通的拉链（相邻两格扣在一起），而是每隔4格才扣一次。这样形成的拉链会自然弯成螺旋形。

### 为什么每隔4个？

因为3.6这个数字：每圈3.6个残基，差不多转完一圈正好是4个残基——所以第i个和第(i+4)个在三维空间中刚好彼此靠近，能形成氢键。这是精妙的几何巧合（其实是进化筛选的结果）。

### 氢键有多少个？

一条10个氨基酸的α螺旋大概有6个氢键（从第1-5到第6-10）。一条100个氨基酸的螺旋有大约96个氢键。数量越多，整体越稳定——就像很多弱磁铁叠放在一起，拉力总和很大。

---

## 第三部分：侧链去哪了？

细心的你可能会问：氨基酸的侧链（R基）去哪了？

答案是：**侧链全部朝外，指向螺旋轴外侧**，不参与形成氢键。

这非常重要：
- 螺旋的核心由骨架形成，稳定而刚性
- 侧链朝外，可以自由接触水分子，或与其他蛋白质区域互动
- 疏水侧链朝外时，在水环境中会"不舒服"——这解释了为什么有些序列容易形成α螺旋，有些不容易

### 哪些氨基酸喜欢形成α螺旋？

- **爱好者**：丙氨酸（A）、谷氨酸（E）、亮氨酸（L）、甲硫氨酸（M）
- **讨厌者**：脯氨酸（P）——它的环状结构会在骨架上"打一个结"，破坏螺旋；甘氨酸（G）——太灵活，无法固定在螺旋构象

脯氨酸是α螺旋的"终止信号"：遇到脯氨酸，螺旋必须结束。

---

## 第四部分：α螺旋在哪里出现？

### 在你的身体里

**角蛋白**是由几乎纯α螺旋组成的结构蛋白，存在于：
- 头发（头发丝 = 角蛋白螺旋缠绕成的超螺旋）
- 指甲（坚硬是因为螺旋之间有二硫键交联）
- 皮肤最外层（角质层）

**肌红蛋白**（储存氧气的肌肉蛋白）有8段α螺旋，这些螺旋围成一个口袋，把血红素（携氧的铁卟啉）固定在里面。Linus Pauling 1951年预测了α螺旋，John Kendrew 1958年用X射线晶体学解析了肌红蛋白结构，确认了螺旋的存在——这是历史上第一个被解析的蛋白质结构。

**跨膜螺旋**：细胞膜是由疏水油脂组成的，一段约20个疏水氨基酸的α螺旋可以像针一样穿过细胞膜，成为离子通道和受体的基本结构单元。

---

## 第五部分：历史故事——Linus Pauling 和模型棒

1951年，Linus Pauling（双诺贝尔奖得主）在生病卧床期间，用一张纸折出了多肽链的几何模型，从键长和键角出发，纯靠几何推导，预测出了α螺旋和β折叠的存在——**在任何X射线证据之前**。

他的方法：不是从实验出发，而是从"什么样的几何构型能让骨架氢键最稳定"这个问题出发，用纸和铅笔推导。七年后，John Kendrew 解析了肌红蛋白的原子结构，发现 Pauling 的预测完全正确。

> "科学不是记忆，是推理。"—— Linus Pauling

---

## 第六部分：动手实验

### 实验：制作α螺旋模型

**材料**：毛根条一根（或细铁丝）、铅笔一支、彩色小磁铁珠（或小纸团）

**步骤**：
1. 把毛根条紧紧绕在铅笔上，绕满后轻轻抽出铅笔
2. 你得到了一个螺旋——但它还不是真正的"α螺旋模型"
3. 用小磁铁珠（代表氢键）：在第1圈的位置和第1圈+4个单元的位置各挂一颗，连上线
4. 重复：每圈都连上氢键
5. 观察：所有氢键都沿着螺旋轴方向排列，像一根隐形的棍子贯穿螺旋中心

**思考**：如果在螺旋中间插入一个"脯氨酸"（把某一圈的毛根剪断再接上），螺旋会怎样？

---

## 本节小结

| 特征 | α螺旋 |
|------|-------|
| 形状 | 右手螺旋（弹簧） |
| 维持力 | 骨架氢键：第i残基C=O ↔ 第(i+4)残基N-H |
| 参数 | 3.6残基/圈，螺距0.54nm |
| 侧链位置 | 朝外，不参与骨架氢键 |
| 破坏因素 | 脯氨酸（P）打断螺旋 |
| 代表蛋白 | 角蛋白（头发/指甲）、肌红蛋白、跨膜受体 |
| 发现者 | Linus Pauling，1951年 |

**核心直觉**：α螺旋是多肽链在局部区域，靠骨架氢键自发形成的弹簧形状。侧链朝外，骨架在内，每隔4个残基一个氢键。头发的弹性和弯曲性，来自你细胞里亿万个这样的纳米弹簧。

---

## 检测你学会了吗？

1. α螺旋是"左手"还是"右手"螺旋？（右手）
2. 维持α螺旋形状的是什么化学键？（氢键）
3. 第i个残基的C=O和第几个残基的N-H形成氢键？（第i+4个）
4. α螺旋每圈包含多少个氨基酸？（3.6个）
5. 哪种氨基酸会打断α螺旋？（脯氨酸，Pro，P）
6. 你身体里哪里有大量α螺旋？（头发、指甲，角蛋白）
"""

# ── 步骤2：从课程文本中提取 3 个 idea ──────────────────────────
# 判断依据：哪些知识点用2D SVG动画展示效果最好？
#
# Idea 1 (animation): α螺旋形成过程 — 展示多肽链如何通过氢键逐步卷成螺旋
#   原因：动态过程，抽象概念，最适合动画
#
# Idea 2 (animation): 氢键位置可视化 — 展示 i↔(i+4) 规律，侧链朝外
#   原因：空间几何关系，静态图讲不清楚，动画可以旋转/标注
#
# Idea 3 (story): 开篇故事——铁丝的弹簧记忆
#   原因：情境引入，帮助建立直觉
#
# Idea 4 (exercise): 巩固练习
#   原因：检验理解

ANIM1_ID = _id("anim")
ANIM2_ID = _id("anim")
STORY_ID = _id("story")
EXER_ID  = _id("ex")

# ── 步骤3：SVG 动画 1 —— α螺旋形成过程 ─────────────────────────
# 技术：SVG + CSS Animation + JavaScript
# 场景：多肽链从直链→逐步卷曲→形成完整螺旋，氢键依次出现并发光

ANIM1_HTML = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>α螺旋形成过程</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: #0a0f1e;
  font-family: "Noto Sans SC", "PingFang SC", system-ui, sans-serif;
}
svg { display: block; width: 100%; height: 100%; }

/* 氨基酸珠子 */
.bead { transition: all 0.6s ease; }
.bead-core {
  fill: url(#beadGrad);
  filter: url(#beadGlow);
}
.bead-side {
  fill: url(#sideGrad);
  opacity: 0.9;
}

/* 骨架键 */
.backbone {
  stroke: url(#backboneGrad);
  stroke-width: 3;
  fill: none;
  stroke-linecap: round;
}

/* 氢键 */
.hbond {
  stroke: #fbbf24;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  fill: none;
  opacity: 0;
  filter: url(#hbondGlow);
}
.hbond.visible { opacity: 1; }

/* HUD */
.hud-bg { fill: rgba(0,0,0,0.6); }
.hud-label { fill: rgba(160,180,255,0.6); font-size: 10px; }
.hud-value { fill: rgba(255,255,255,0.9); font-size: 13px; font-weight: bold; }
.hud-line { stroke: rgba(255,255,255,0.08); stroke-width: 1; }

/* 标注文字 */
.annotation {
  fill: rgba(250,250,255,0.85);
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.5s;
}
.annotation.show { opacity: 1; }
.ann-line {
  stroke: rgba(200,220,255,0.4);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  opacity: 0;
  transition: opacity 0.5s;
}
.ann-line.show { opacity: 1; }

/* 阶段标题 */
.phase-title {
  fill: rgba(129,140,248,0.9);
  font-size: 14px;
  font-weight: bold;
}
.phase-sub {
  fill: rgba(200,210,255,0.6);
  font-size: 11px;
}
</style>
</head>
<body>
<svg id="svg" viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 背景渐变 -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0f1e"/>
      <stop offset="100%" stop-color="#0f1628"/>
    </linearGradient>
    <!-- 网格图案 -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0L0 0L0 40" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1"/>
    </pattern>
    <!-- 珠子渐变 -->
    <radialGradient id="beadGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#a5b4fc"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#3730a3"/>
    </radialGradient>
    <!-- 侧链渐变 -->
    <radialGradient id="sideGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#86efac"/>
      <stop offset="60%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#15803d"/>
    </radialGradient>
    <!-- 骨架渐变 -->
    <linearGradient id="backboneGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
    <!-- 珠子发光滤镜 -->
    <filter id="beadGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <!-- 氢键发光 -->
    <filter id="hbondGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <!-- 标题发光 -->
    <filter id="titleGlow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- 背景 -->
  <rect width="600" height="420" fill="url(#bgGrad)"/>
  <rect width="600" height="420" fill="url(#grid)"/>

  <!-- 标题 -->
  <text x="300" y="26" text-anchor="middle"
        fill="rgba(255,255,255,0.9)" font-size="15" font-weight="bold"
        filter="url(#titleGlow)">α螺旋形成过程</text>

  <!-- 主动画区域 (y: 40 ~ 340) -->
  <g id="scene" transform="translate(0, 0)"></g>

  <!-- HUD 底栏 -->
  <rect class="hud-bg" x="0" y="368" width="600" height="52" rx="0"/>
  <line class="hud-line" x1="0" y1="368" x2="600" y2="368"/>
  <line class="hud-line" x1="150" y1="368" x2="150" y2="420"/>
  <line class="hud-line" x1="300" y1="368" x2="300" y2="420"/>
  <line class="hud-line" x1="450" y1="368" x2="450" y2="420"/>

  <text class="hud-label" x="75" y="383" text-anchor="middle">阶段</text>
  <text class="hud-label" x="225" y="383" text-anchor="middle">氢键数量</text>
  <text class="hud-label" x="375" y="383" text-anchor="middle">每圈残基数</text>
  <text class="hud-label" x="525" y="383" text-anchor="middle">结构类型</text>

  <text id="hud-phase"  class="hud-value" x="75" y="406" text-anchor="middle">初始</text>
  <text id="hud-hbonds" class="hud-value" x="225" y="406" text-anchor="middle">0</text>
  <text id="hud-rpm"    class="hud-value" x="375" y="406" text-anchor="middle">—</text>
  <text id="hud-type"   class="hud-value" x="525" y="406" text-anchor="middle">无规则卷曲</text>
</svg>

<script>
(function() {
"use strict";

var svgNS = "http://www.w3.org/2000/svg";
var scene = document.getElementById("scene");

// ── 动画参数 ──────────────────────────────────────────────────
var BEADS = 13;       // 展示的氨基酸数量
var BEAD_R = 10;      // 骨架Cα珠子半径
var SIDE_R = 6;       // 侧链珠子半径

// 三个阶段的珠子坐标
// 阶段0：直链（水平展开）
// 阶段1：部分卷曲（S形曲线）
// 阶段2：完整α螺旋（螺旋投影）

// α螺旋参数：右视投影到2D
// 螺旋轴竖直，旋转投影
var HELIX_CX = 300;
var HELIX_TOP = 55;
var HELIX_PITCH_PX = 40;   // 每圈高度（像素，代表0.54nm）
var HELIX_RX = 55;          // 水平半径（椭圆透视效果）
var HELIX_RY = 18;          // 垂直半径（透视压缩）

// 角度步进：3.6残基/圈 → 每残基 360°/3.6 ≈ 100°
var ANGLE_STEP = 100;

function helixPos(i) {
  var angle = (i * ANGLE_STEP - 90) * Math.PI / 180;  // -90使第0个在顶部
  var y = HELIX_TOP + i * (HELIX_PITCH_PX / 3.6);
  var x = HELIX_CX + HELIX_RX * Math.cos(angle);
  // 透视：前面的珠子y偏移HELIX_RY
  var yOffset = HELIX_RY * Math.sin(angle);
  return { x: x, y: y + yOffset, angle: angle, depth: Math.sin(angle) };
}

// 侧链方向：从中心向外，稍微朝上
function sidePos(hx, hy, angle) {
  var dist = BEAD_R + SIDE_R + 6;
  return {
    x: hx + dist * Math.cos(angle),
    y: hy + dist * Math.sin(angle) * 0.5 - 4,
  };
}

// 直链坐标
function linearPos(i) {
  var startX = 80;
  var spacing = (440) / (BEADS - 1);
  return { x: startX + i * spacing, y: 195 };
}

// 中间过渡：正弦波弯曲
function wavePos(i, t) {
  var lp = linearPos(i);
  var hp = helixPos(i);
  // t: 0=直线, 1=螺旋
  return {
    x: lp.x + (hp.x - lp.x) * t,
    y: lp.y + (hp.y - lp.y) * t,
    angle: hp.angle,
    depth: hp.depth,
  };
}

// ── 创建 SVG 元素 ──────────────────────────────────────────────

function makeSVG(tag, attrs) {
  var el = document.createElementNS(svgNS, tag);
  for (var k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// 珠子组
var beadGroups = [];
var hbondLines = [];
var backbonePath = makeSVG("path", {
  class: "backbone", id: "backbone-path"
});
scene.appendChild(backbonePath);

// 氢键（共 BEADS-4 条）
for (var hi = 0; hi < BEADS - 4; hi++) {
  var hb = makeSVG("path", { class: "hbond", id: "hb-" + hi });
  scene.appendChild(hb);
  hbondLines.push(hb);
}

// 珠子（从后到前排序，先画深度大的）
for (var bi = 0; bi < BEADS; bi++) {
  var g = document.createElementNS(svgNS, "g");
  g.setAttribute("class", "bead");
  g.setAttribute("id", "bead-" + bi);

  // 侧链
  var sideCirc = makeSVG("circle", {
    class: "bead-side", r: SIDE_R,
  });
  g.appendChild(sideCirc);

  // 主链Cα
  var coreCirc = makeSVG("circle", {
    class: "bead-core", r: BEAD_R,
  });
  g.appendChild(coreCirc);

  // 序号标签
  var label = makeSVG("text", {
    "text-anchor": "middle",
    "dominant-baseline": "central",
    "fill": "rgba(255,255,255,0.8)",
    "font-size": "8",
    "font-weight": "bold",
  });
  label.textContent = (bi + 1).toString();
  g.appendChild(label);

  scene.appendChild(g);
  beadGroups.push({ g: g, core: coreCirc, side: sideCirc, label: label });
}

// ── 阶段标注 ───────────────────────────────────────────────────
var phaseTitle = makeSVG("text", {
  class: "phase-title", x: "300", y: "350", "text-anchor": "middle"
});
phaseTitle.textContent = "直链多肽";
scene.appendChild(phaseTitle);

var phaseSub = makeSVG("text", {
  class: "phase-sub", x: "300", y: "365", "text-anchor": "middle"
});
phaseSub.textContent = "氨基酸刚从核糖体合成，还没有折叠";
scene.appendChild(phaseSub);

// 氢键标注
var hbLabel = makeSVG("text", {
  class: "annotation", x: "520", y: "120", "text-anchor": "middle",
  fill: "rgba(251,191,36,0.9)", "font-size": "11"
});
hbLabel.textContent = "氢键";
scene.appendChild(hbLabel);
hbLabel.id = "hb-label";

var hbArrow = makeSVG("line", {
  class: "ann-line", x1: "520", y1: "125",
  x2: "490", y2: "145", id: "hb-arrow"
});
scene.appendChild(hbArrow);

// 螺旋参数标注（最终阶段）
var paramLabel = makeSVG("text", {
  class: "annotation", x: "90", y: "100", "text-anchor": "middle",
  fill: "rgba(167,243,208,0.9)", "font-size": "10"
});
paramLabel.id = "param-label";
scene.appendChild(paramLabel);

// ── 渲染函数 ───────────────────────────────────────────────────

function updatePositions(t, showHbonds) {
  // 排序珠子（按深度从后到前）
  var sorted = [];
  for (var i = 0; i < BEADS; i++) {
    var pos = wavePos(i, t);
    sorted.push({ i: i, pos: pos });
  }
  sorted.sort(function(a, b) { return a.pos.depth - b.pos.depth; });

  // 重新排序DOM（深度较小=在后面，先渲染）
  for (var si = 0; si < sorted.length; si++) {
    scene.appendChild(beadGroups[sorted[si].i].g);
  }

  // 更新骨架路径
  var pathD = "";
  for (var pi = 0; pi < BEADS; pi++) {
    var p = wavePos(pi, t);
    if (pi === 0) {
      pathD = "M" + p.x.toFixed(1) + "," + p.y.toFixed(1);
    } else {
      pathD += " L" + p.x.toFixed(1) + "," + p.y.toFixed(1);
    }
  }
  backbonePath.setAttribute("d", pathD);

  // 更新珠子位置
  for (var bi2 = 0; bi2 < BEADS; bi2++) {
    var pos2 = wavePos(bi2, t);
    var sp = sidePos(pos2.x, pos2.y, pos2.angle);
    var bg = beadGroups[bi2];

    bg.core.setAttribute("cx", pos2.x.toFixed(1));
    bg.core.setAttribute("cy", pos2.y.toFixed(1));
    bg.side.setAttribute("cx", sp.x.toFixed(1));
    bg.side.setAttribute("cy", sp.y.toFixed(1));
    bg.label.setAttribute("x", pos2.x.toFixed(1));
    bg.label.setAttribute("y", pos2.y.toFixed(1));

    // 深度影响透明度（后面的珠子稍暗）
    var alpha = 0.6 + 0.4 * (pos2.depth + 1) / 2;
    bg.core.style.opacity = alpha.toFixed(2);
    bg.side.style.opacity = (alpha * 0.9).toFixed(2);
  }

  // 更新氢键
  for (var hbi = 0; hbi < hbondLines.length; hbi++) {
    var p1 = wavePos(hbi, t);
    var p2 = wavePos(hbi + 4, t);
    var hb = hbondLines[hbi];

    // 曲线路径（弧形）
    var mx = (p1.x + p2.x) / 2;
    var my = (p1.y + p2.y) / 2 - 15 * Math.abs(Math.cos(p1.angle));
    hb.setAttribute("d",
      "M" + p1.x.toFixed(1) + "," + p1.y.toFixed(1) +
      " Q" + mx.toFixed(1) + "," + my.toFixed(1) +
      " " + p2.x.toFixed(1) + "," + p2.y.toFixed(1)
    );

    if (showHbonds && t > 0.7) {
      hb.classList.add("visible");
      hb.style.opacity = ((t - 0.7) / 0.3).toFixed(2);
    } else {
      hb.classList.remove("visible");
      hb.style.opacity = "0";
    }
  }
}

// ── 动画状态机 ────────────────────────────────────────────────
var hudPhase   = document.getElementById("hud-phase");
var hudHbonds  = document.getElementById("hud-hbonds");
var hudRpm     = document.getElementById("hud-rpm");
var hudType    = document.getElementById("hud-type");

var PHASES = [
  { name: "直链多肽", sub: "氨基酸刚从核糖体合成，还没有折叠",
    tStart: 0, tEnd: 0, holdMs: 2000,
    hbonds: 0, rpm: "—", type: "无规则卷曲" },
  { name: "开始卷曲", sub: "疏水残基被水推向内侧，链条弯曲",
    tStart: 0, tEnd: 0.5, holdMs: 1500,
    hbonds: 0, rpm: "≈3.6", type: "过渡态" },
  { name: "螺旋形成", sub: "氢键依次建立，螺旋结构稳定化",
    tStart: 0.5, tEnd: 1.0, holdMs: 1500,
    hbonds: 9, rpm: "3.6", type: "过渡态" },
  { name: "α螺旋", sub: "完全稳定的右手螺旋，每圈3.6个残基",
    tStart: 1.0, tEnd: 1.0, holdMs: 3000,
    hbonds: 9, rpm: "3.6", type: "α螺旋" },
];

var currentPhase = 0;
var phaseStart = performance.now();
var animT = 0;
var lastPhaseTime = 0;

var ANIM_DURATION = 1500;  // 过渡动画时长(ms)

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function loop(now) {
  var elapsed = now - phaseStart;
  var ph = PHASES[currentPhase];

  if (ph.tStart === ph.tEnd) {
    // 静止阶段
    animT = ph.tEnd;
    if (elapsed > ph.holdMs && currentPhase < PHASES.length - 1) {
      currentPhase++;
      phaseStart = now;
    }
  } else {
    // 动画阶段
    var progress = Math.min(elapsed / ANIM_DURATION, 1);
    animT = ph.tStart + (ph.tEnd - ph.tStart) * easeInOut(progress);
    if (progress >= 1) {
      if (elapsed > ANIM_DURATION + ph.holdMs && currentPhase < PHASES.length - 1) {
        currentPhase++;
        phaseStart = now;
      }
    }
  }

  // 最后一阶段循环
  if (currentPhase === PHASES.length - 1) {
    var loopTime = now - phaseStart;
    if (loopTime > 4000) {
      // 重置回第0阶段
      currentPhase = 0;
      phaseStart = now;
    }
  }

  updatePositions(animT, animT > 0.6);

  // 更新 HUD
  var pName = PHASES[currentPhase].name;
  hudPhase.textContent = pName;

  var hbCount = Math.round(animT * 9);
  hudHbonds.textContent = hbCount.toString();
  hudRpm.textContent = animT < 0.3 ? "—" : "3.6";
  hudType.textContent = animT < 0.9 ? (animT < 0.3 ? "无规则卷曲" : "过渡态") : "α螺旋";

  // 更新阶段标题
  phaseTitle.textContent = PHASES[currentPhase].name;
  phaseSub.textContent = PHASES[currentPhase].sub;

  // 氢键标注
  var hbLabelEl = document.getElementById("hb-label");
  var hbArrowEl = document.getElementById("hb-arrow");
  if (animT > 0.75) {
    hbLabelEl.classList.add("show");
    hbArrowEl.classList.add("show");
  } else {
    hbLabelEl.classList.remove("show");
    hbArrowEl.classList.remove("show");
  }

  // 螺旋参数标注
  var paramLabelEl = document.getElementById("param-label");
  if (animT > 0.9) {
    paramLabelEl.classList.add("show");
    paramLabelEl.textContent = "每圈3.6个残基 · 螺距0.54nm";
    paramLabelEl.setAttribute("y", "340");
    paramLabelEl.setAttribute("x", "300");
    paramLabelEl.setAttribute("fill", "rgba(167,243,208,0.85)");
    paramLabelEl.setAttribute("font-size", "11");
  } else {
    paramLabelEl.classList.remove("show");
  }

  requestAnimationFrame(loop);
}

// ── 初始化 ────────────────────────────────────────────────────
updatePositions(0, false);
requestAnimationFrame(loop);

})();
</script>
</body>
</html>"""

# ── SVG 动画 2 —— 氢键 i↔(i+4) 规律可视化 ──────────────────────
# 场景：α螺旋侧视图，高亮显示各条氢键，标注编号，展示3.6规律

ANIM2_HTML = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>α螺旋氢键规律：第i↔第(i+4)</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: #0a0f1e;
  font-family: "Noto Sans SC", "PingFang SC", system-ui, sans-serif;
}
svg { display: block; width: 100%; height: 100%; }

.hud-bg { fill: rgba(0,0,0,0.6); }
.hud-label { fill: rgba(160,180,255,0.6); font-size: 10px; }
.hud-value { fill: rgba(255,255,255,0.9); font-size: 13px; font-weight: bold; }
.hud-line { stroke: rgba(255,255,255,0.08); stroke-width: 1; }
</style>
</head>
<body>
<svg id="svg" viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0f1e"/>
      <stop offset="100%" stop-color="#0d1530"/>
    </linearGradient>
    <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0L0 0L0 40" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1"/>
    </pattern>
    <filter id="glow2">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="softGlow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <!-- 当前高亮氢键颜色 -->
    <radialGradient id="hlBeadGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </radialGradient>
    <!-- 普通珠子 -->
    <radialGradient id="normalBeadGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#a5b4fc"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#3730a3"/>
    </radialGradient>
    <!-- 侧链 -->
    <radialGradient id="sideGrad2" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#86efac"/>
      <stop offset="50%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#15803d"/>
    </radialGradient>
  </defs>

  <rect width="600" height="420" fill="url(#bg2)"/>
  <rect width="600" height="420" fill="url(#grid2)"/>

  <text x="300" y="26" text-anchor="middle"
        fill="rgba(255,255,255,0.9)" font-size="15" font-weight="bold"
        filter="url(#glow2)">氢键规律：第 i 残基 ↔ 第 (i+4) 残基</text>

  <!-- 主绘图区 -->
  <g id="scene2"></g>

  <!-- 规则说明框 -->
  <g id="rule-box">
    <rect x="390" y="42" width="195" height="110" rx="8"
          fill="rgba(15,20,50,0.85)" stroke="rgba(99,102,241,0.4)" stroke-width="1.5"/>
    <text x="487" y="62" text-anchor="middle"
          fill="rgba(167,243,208,0.9)" font-size="11" font-weight="bold">氢键形成规律</text>
    <text id="rule-cur" x="487" y="82" text-anchor="middle"
          fill="rgba(251,191,36,0.95)" font-size="13" font-weight="bold">第1↔第5</text>
    <text x="487" y="100" text-anchor="middle"
          fill="rgba(200,210,255,0.65)" font-size="10">C=O（第i个）</text>
    <text x="487" y="115" text-anchor="middle"
          fill="rgba(200,210,255,0.65)" font-size="10">与 N-H（第i+4个）</text>
    <text x="487" y="130" text-anchor="middle"
          fill="rgba(200,210,255,0.65)" font-size="10">之间形成氢键</text>
    <text id="rule-count" x="487" y="146" text-anchor="middle"
          fill="rgba(129,140,248,0.8)" font-size="10">当前高亮第 1 条</text>
  </g>

  <!-- HUD -->
  <rect class="hud-bg" x="0" y="368" width="600" height="52"/>
  <line class="hud-line" x1="0" y1="368" x2="600" y2="368"/>
  <line class="hud-line" x1="150" y1="368" x2="150" y2="420"/>
  <line class="hud-line" x1="300" y1="368" x2="300" y2="420"/>
  <line class="hud-line" x1="450" y1="368" x2="450" y2="420"/>

  <text class="hud-label" x="75"  y="383" text-anchor="middle">当前氢键</text>
  <text class="hud-label" x="225" y="383" text-anchor="middle">间隔残基数</text>
  <text class="hud-label" x="375" y="383" text-anchor="middle">每圈残基数</text>
  <text class="hud-label" x="525" y="383" text-anchor="middle">氢键总数（共9条）</text>

  <text id="hud2-cur"    class="hud-value" x="75"  y="406" text-anchor="middle">1↔5</text>
  <text id="hud2-gap"    class="hud-value" x="225" y="406" text-anchor="middle">4</text>
  <text id="hud2-rpm"    class="hud-value" x="375" y="406" text-anchor="middle">3.6</text>
  <text id="hud2-total"  class="hud-value" x="525" y="406" text-anchor="middle">1 / 9</text>
</svg>

<script>
(function() {
"use strict";
var svgNS = "http://www.w3.org/2000/svg";
var scene2 = document.getElementById("scene2");

var BEADS = 13;
// α螺旋侧视：螺旋轴水平（左→右），珠子沿螺旋排列
// 使用侧面投影：x=沿轴方向，y=螺旋在侧面的投影（正弦波）
var AXIS_Y = 200;    // 螺旋轴高度
var AXIS_X0 = 60;    // 起始x
var X_STEP = 37;     // 每个残基的轴向步进（代表0.15nm）
var AMP = 55;        // 侧面投影振幅
var BEAD_R = 10;
var SIDE_R = 5.5;

// 每圈100°
function getPos(i) {
  var angle = (i * 100) * Math.PI / 180;
  return {
    x: AXIS_X0 + i * X_STEP,
    y: AXIS_Y - AMP * Math.sin(angle),  // 侧面投影
    angle: angle,
    depth: Math.cos(angle),  // 深度（正=前面）
  };
}

function getSidePos(bx, by, angle) {
  // 侧链朝"外"：在侧视图中朝上或朝下（取决于当前螺旋面的法向量）
  var perpAngle = angle + Math.PI / 2;
  return {
    x: bx + (BEAD_R + SIDE_R + 4) * Math.cos(perpAngle) * 0.3,
    y: by + (BEAD_R + SIDE_R + 4) * Math.sin(perpAngle),
  };
}

function makeSVG(tag, attrs) {
  var el = document.createElementNS(svgNS, tag);
  for (var k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// 骨架线
var backbone = makeSVG("path", {
  "stroke": "rgba(99,102,241,0.5)", "stroke-width": "2.5",
  "fill": "none", "stroke-linecap": "round"
});
scene2.appendChild(backbone);

// 计算骨架路径
var pathD = "";
for (var pi = 0; pi < BEADS; pi++) {
  var pp = getPos(pi);
  pathD += (pi === 0 ? "M" : "L") + pp.x.toFixed(1) + "," + pp.y.toFixed(1) + " ";
}
backbone.setAttribute("d", pathD);

// 氢键线（9条，初始隐藏）
var hbLines = [];
for (var hi = 0; hi < BEADS - 4; hi++) {
  var p1 = getPos(hi);
  var p2 = getPos(hi + 4);
  var mx = (p1.x + p2.x) / 2;
  var my = Math.min(p1.y, p2.y) - 22;
  var hb = makeSVG("path", {
    "d": "M" + p1.x.toFixed(1) + "," + p1.y.toFixed(1) +
         " Q" + mx.toFixed(1) + "," + my.toFixed(1) +
         " " + p2.x.toFixed(1) + "," + p2.y.toFixed(1),
    "stroke": "#fbbf24",
    "stroke-width": "2",
    "stroke-dasharray": "4 3",
    "fill": "none",
    "opacity": "0",
    "filter": "url(#softGlow)",
  });
  scene2.appendChild(hb);
  hbLines.push(hb);
}

// 珠子和侧链（排序后创建）
var beadData = [];
for (var bi = 0; bi < BEADS; bi++) {
  var pos = getPos(bi);
  beadData.push({ i: bi, pos: pos });
}

// 按深度排序，后面的先画
beadData.sort(function(a, b) { return a.pos.depth - b.pos.depth; });

var beadEls = new Array(BEADS);
for (var si = 0; si < beadData.length; si++) {
  var d = beadData[si];
  var bp = d.pos;
  var sp = getSidePos(bp.x, bp.y, bp.angle);

  var g = document.createElementNS(svgNS, "g");

  // 侧链
  var sideCirc = makeSVG("circle", {
    cx: sp.x.toFixed(1), cy: sp.y.toFixed(1), r: SIDE_R,
    fill: "url(#sideGrad2)",
    opacity: (0.55 + 0.4 * (bp.depth + 1) / 2).toFixed(2),
  });
  g.appendChild(sideCirc);

  // 主链珠子
  var core = makeSVG("circle", {
    cx: bp.x.toFixed(1), cy: bp.y.toFixed(1), r: BEAD_R,
    fill: "url(#normalBeadGrad)",
    opacity: (0.6 + 0.4 * (bp.depth + 1) / 2).toFixed(2),
    id: "bead2-" + d.i,
  });
  g.appendChild(core);

  // 序号
  var lbl = makeSVG("text", {
    x: bp.x.toFixed(1), y: bp.y.toFixed(1),
    "text-anchor": "middle", "dominant-baseline": "central",
    fill: "rgba(255,255,255,0.8)", "font-size": "8", "font-weight": "bold",
  });
  lbl.textContent = (d.i + 1).toString();
  g.appendChild(lbl);

  scene2.appendChild(g);
  beadEls[d.i] = { g: g, core: core };
}

// 螺旋轴线
var axisLine = makeSVG("line", {
  x1: AXIS_X0, y1: AXIS_Y,
  x2: AXIS_X0 + (BEADS - 1) * X_STEP, y2: AXIS_Y,
  stroke: "rgba(99,102,241,0.2)", "stroke-width": "1",
  "stroke-dasharray": "6 4",
});
scene2.appendChild(axisLine);

// 轴标注
var axisLabel = makeSVG("text", {
  x: (AXIS_X0 + (BEADS - 1) * X_STEP / 2).toFixed(0),
  y: (AXIS_Y + 16).toFixed(0),
  "text-anchor": "middle",
  fill: "rgba(99,102,241,0.5)", "font-size": "9",
});
axisLabel.textContent = "螺旋轴（C 端 →）";
scene2.appendChild(axisLabel);

// ── 动画逻辑：逐一点亮氢键 ────────────────────────────────────
var TOTAL_HBONDS = 9;
var curHbond = 0;  // 当前高亮的氢键（0-based）
var lastSwitch = performance.now();
var HOLD_MS = 1400;

var hud2Cur   = document.getElementById("hud2-cur");
var hud2Total = document.getElementById("hud2-total");
var ruleCur   = document.getElementById("rule-cur");
var ruleCount = document.getElementById("rule-count");

function loop2(now) {
  if (now - lastSwitch > HOLD_MS) {
    curHbond = (curHbond + 1) % TOTAL_HBONDS;
    lastSwitch = now;
  }

  // 全部氢键显示（淡色），当前高亮
  for (var hi = 0; hi < TOTAL_HBONDS; hi++) {
    if (hi <= curHbond) {
      if (hi === curHbond) {
        // 当前高亮：亮色，宽
        hbLines[hi].setAttribute("stroke", "#fbbf24");
        hbLines[hi].setAttribute("stroke-width", "2.5");
        hbLines[hi].setAttribute("opacity", "1");
      } else {
        // 已显示：暗色
        hbLines[hi].setAttribute("stroke", "rgba(251,191,36,0.35)");
        hbLines[hi].setAttribute("stroke-width", "1.5");
        hbLines[hi].setAttribute("opacity", "1");
      }
    } else {
      hbLines[hi].setAttribute("opacity", "0");
    }
  }

  // 高亮当前氢键的两个珠子
  for (var bi = 0; bi < BEADS; bi++) {
    var isHL = (bi === curHbond || bi === curHbond + 4);
    var baseAlpha = 0.6 + 0.4 * (getPos(bi).depth + 1) / 2;
    if (isHL) {
      beadEls[bi].core.setAttribute("fill", "url(#hlBeadGrad)");
      beadEls[bi].core.setAttribute("r", "12");
      beadEls[bi].core.setAttribute("opacity", "1");
      beadEls[bi].core.setAttribute("filter", "url(#softGlow)");
    } else {
      beadEls[bi].core.setAttribute("fill", "url(#normalBeadGrad)");
      beadEls[bi].core.setAttribute("r", "10");
      beadEls[bi].core.setAttribute("opacity", baseAlpha.toFixed(2));
      beadEls[bi].core.removeAttribute("filter");
    }
  }

  // 更新HUD和标注
  var i1 = curHbond + 1, i2 = curHbond + 5;
  hud2Cur.textContent = i1 + "↔" + i2;
  hud2Total.textContent = (curHbond + 1) + " / " + TOTAL_HBONDS;
  ruleCur.textContent = "第" + i1 + "↔第" + i2;
  ruleCount.textContent = "当前高亮第 " + (curHbond + 1) + " 条";

  requestAnimationFrame(loop2);
}

requestAnimationFrame(loop2);
})();
</script>
</body>
</html>"""

# ── 故事段落（情境引入）────────────────────────────────────────
STORY_PARAGRAPHS = [
    {
        "text": "1951年的某个深夜，加州理工学院的实验室里，Linus Pauling 正在病床上。他感冒发烧，但手里拿着一张纸，正在折叠——不是折纸，而是在折叠多肽链的几何模型。",
        "image_url": "",
    },
    {
        "text": "他发现：如果每个氨基酸的键角都保持理想值，链条会自然而然地卷成弹簧形状。第1个残基的C=O，与第5个残基的N-H，恰好靠近到可以形成氢键的距离。",
        "image_url": "",
    },
    {
        "text": "七年后，John Kendrew 用X射线晶体学解析了肌红蛋白的原子结构——世界上第一个被看清楚的蛋白质。镜子里映出的，正是Pauling在病床上折出的弹簧。他当年的推理，分毫不差。",
        "image_url": "",
    },
]

# ── 练习题 ──────────────────────────────────────────────────────
EXERCISES = [
    {
        "type": "choice",
        "question": "α螺旋每圈包含多少个氨基酸？",
        "options": ["A. 3.0个", "B. 3.6个", "C. 4.0个", "D. 4.5个"],
        "correct": 1,
        "explanation": "每圈3.6个残基，这不是整数，正是因为100°的旋转角（360°÷3.6≈100°），使得每隔约一圈（4个残基）的氨基酸在三维空间中刚好靠近，能形成氢键。",
    },
    {
        "type": "choice",
        "question": "α螺旋靠什么力量保持螺旋形状？",
        "options": [
            "A. 肽键（骨架共价键）",
            "B. 骨架氢键（C=O 与 N-H 之间）",
            "C. 侧链之间的共价键",
            "D. 离子键",
        ],
        "correct": 1,
        "explanation": "α螺旋靠骨架氢键维持——每个残基的C=O与第(i+4)个残基的N-H之间形成氢键，沿螺旋轴方向排列。侧链不参与这些氢键，而是朝外排列。",
    },
    {
        "type": "choice",
        "question": "哪种氨基酸会打断α螺旋？",
        "options": ["A. 丙氨酸（A）", "B. 亮氨酸（L）", "C. 脯氨酸（P）", "D. 甘氨酸（G）"],
        "correct": 2,
        "explanation": "脯氨酸的侧链与骨架氮原子形成环状结构，使骨架氮上没有可以提供氢键的H原子，同时环结构限制了骨架的旋转自由度。因此脯氨酸是α螺旋的天然终止符。",
    },
    {
        "type": "choice",
        "question": "你的头发主要由哪种蛋白质组成？这种蛋白质富含什么结构？",
        "options": [
            "A. 胶原蛋白，富含β折叠",
            "B. 角蛋白，富含α螺旋",
            "C. 血红蛋白，富含β折叠",
            "D. 丝蛋白，富含α螺旋",
        ],
        "correct": 1,
        "explanation": "头发和指甲主要由角蛋白组成，角蛋白几乎全部由α螺旋构成。多条α螺旋缠绕形成超螺旋，再组装成头发纤维。这正是头发有弹性的原因——α螺旋就像弹簧。",
    },
]

# ── 组装 CourseContent ──────────────────────────────────────────

def build_course_content() -> dict:
    plan_with_placeholders = PLAN_MARKDOWN

    # 在故事段落前插入 story 占位符（在"开篇故事"后）
    # 在动画1前插入（在"第一部分"前）
    # 在动画2前插入（在"第二部分"前）
    # 在练习前插入（在"检测你学会了吗"前）
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 开篇故事：铁丝的记忆",
        f"[[IDEA:{STORY_ID}]]\n\n## 开篇故事：铁丝的记忆"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 第一部分：什么是α螺旋？",
        f"[[IDEA:{ANIM1_ID}]]\n\n## 第一部分：什么是α螺旋？"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 第二部分：氢键是如何让弹簧保持形状的？",
        f"[[IDEA:{ANIM2_ID}]]\n\n## 第二部分：氢键是如何让弹簧保持形状的？"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 检测你学会了吗？",
        f"[[IDEA:{EXER_ID}]]\n\n## 检测你学会了吗？"
    )

    ideas = [
        {
            "idea_id": STORY_ID,
            "mode": "story",
            "topic": "Pauling 病床上的发现——α螺旋的历史故事",
            "context_summary": "通过Pauling 1951年用纸折叠发现α螺旋的故事引入主题，建立历史感和直觉",
            "generation_backend": "claude_code_direct",
            "style_key": "chromatic_depth",
            "mode_reason": "历史情境故事最适合激发兴趣和建立直觉，在学概念前先埋下情感锚点",
        },
        {
            "idea_id": ANIM1_ID,
            "mode": "animation",
            "topic": "多肽链从直链到α螺旋的形成过程",
            "context_summary": "动态展示多肽链如何通过氢键驱动逐步卷曲成稳定的右手螺旋，珠子代表氨基酸，黄色虚线代表氢键",
            "generation_backend": "claude_code_direct",
            "style_key": "chromatic_depth",
            "mode_reason": "动态卷曲过程是抽象概念，静态图无法表达；SVG动画可以展示每一步的变化",
        },
        {
            "idea_id": ANIM2_ID,
            "mode": "animation",
            "topic": "氢键 i↔(i+4) 规律逐一高亮展示",
            "context_summary": "α螺旋侧视图，逐一高亮每条氢键（第1↔第5、第2↔第6...），直观展示每隔4个残基形成一对氢键的规律",
            "generation_backend": "claude_code_direct",
            "style_key": "chromatic_depth",
            "mode_reason": "i↔(i+4)的空间几何规律用静态图很难理解，动态高亮可以让学生清晰看到每对氢键的关系",
        },
        {
            "idea_id": EXER_ID,
            "mode": "exercise",
            "topic": "α螺旋关键知识点巩固练习",
            "context_summary": "检验学生对α螺旋参数、维持力、破坏因素和生活实例的理解",
            "generation_backend": "claude_code_direct",
            "style_key": "",
            "mode_reason": "练习题巩固学习，即时检测理解",
        },
    ]

    rendered_sections = {
        STORY_ID: {
            "mode": "story",
            "status": "ready",
            "html": None,
            "story_paragraphs": STORY_PARAGRAPHS,
            "exercises": None,
            "generation_backend": "claude_code_direct",
        },
        ANIM1_ID: {
            "mode": "animation",
            "status": "ready",
            "html": ANIM1_HTML,
            "story_paragraphs": None,
            "exercises": None,
            "generation_backend": "claude_code_direct",
        },
        ANIM2_ID: {
            "mode": "animation",
            "status": "ready",
            "html": ANIM2_HTML,
            "story_paragraphs": None,
            "exercises": None,
            "generation_backend": "claude_code_direct",
        },
        EXER_ID: {
            "mode": "exercise",
            "status": "ready",
            "html": None,
            "story_paragraphs": None,
            "exercises": EXERCISES,
            "generation_backend": "claude_code_direct",
        },
    }

    return {
        "plan_markdown": plan_with_placeholders,
        "ideas": ideas,
        "rendered_sections": rendered_sections,
    }


# ── 写入数据库 ──────────────────────────────────────────────────

def write_everything():
    from scripts.course_factory import (
        _ensure_db_tables, _upsert_project, _init_progress, _write_project_files
    )
    from systemedu.storage.db import LessonContent, get_session as get_db_session
    from datetime import datetime as dt

    console.print(Panel.fit(
        "[bold cyan]GP-01 蛋白结构探险地图[/bold cyan]\n\n"
        "完全由 Claude Code 生成（不调用 LLM agent pipeline）\n"
        "节点：M05N01 α螺旋——大自然的弹簧\n"
        "内容：完整课程文本 + 2个SVG动画 + 3段故事 + 4道练习题",
        title="写入数据库",
    ))

    # 读取知识树
    with open(TREE_PATH, encoding="utf-8") as f:
        tree_raw = json.load(f)

    # 转换为 write_to_db 需要的 milestones 格式
    # 从知识树JSON构建内部格式
    nodes_by_id = {}
    for node in tree_raw["知识树节点"]:
        nodes_by_id[node["id"]] = node

    # 按模块分组，计算全局 knode_id
    module_order = [m["模块id"] for m in tree_raw["模块依赖图"]]
    milestones = []
    global_idx = 0
    for mid in module_order:
        mod_nodes = [n for n in tree_raw["知识树节点"] if n["模块id"] == mid]
        if not mod_nodes:
            continue
        module_title = mod_nodes[0]["模块"]
        knodes = []
        for n in mod_nodes:
            knodes.append({
                "title": n["标题"],
                "summary": n["详细描述"][:300],
                "difficulty_level": n["难度评分"],
                "content_type": "interactive",
                "acceptance_type": "quiz",
                "estimated_minutes": n["预估学习时长_分钟"],
                "xp_reward": 30,
                "order": global_idx,
                "prerequisite_indices": [],  # 简化处理
            })
            nodes_by_id[n["id"]]["_global_idx"] = global_idx
            global_idx += 1
        milestones.append({
            "title": module_title,
            "description": "",
            "order": len(milestones),
            "xp_reward": 100,
            "knodes": knodes,
        })

    tree_data = {"milestones": milestones}
    node_count = global_idx

    console.print(f"知识树：{len(milestones)} 个模块，{node_count} 个节点")
    console.print(f"目标节点 knode_id = {TARGET_KNODE_ID}（{TARGET_NODE_TITLE}）")

    # 1. 确保数据库表存在
    _ensure_db_tables()

    # 2. 写入项目文件
    _write_project_files(
        PROJECT_NAME, PROJECT_TITLE, PROJECT_DESCRIPTION,
        PROJECT_CATEGORY, PROJECT_AGE_RANGE, PROJECT_ESTIMATED_HOURS,
        PROJECT_TAGS, tree_data,
    )
    console.print("[green]v 项目文件写入[/green]")

    # 3. 注册项目
    _upsert_project(
        PROJECT_NAME, PROJECT_TITLE, PROJECT_DESCRIPTION,
        PROJECT_CATEGORY, PROJECT_AGE_RANGE, PROJECT_ESTIMATED_HOURS,
        PROJECT_TAGS,
    )
    console.print("[green]v 项目注册到数据库[/green]")

    # 4. 初始化进度（第0节可用，其余锁定）
    _init_progress(PROJECT_NAME, node_count)
    console.print("[green]v 学习进度初始化[/green]")

    # 5. 为所有节点创建 pending 状态的占位 lesson
    db = get_db_session()
    try:
        for kid in range(node_count):
            existing = db.query(LessonContent).filter_by(
                project_name=PROJECT_NAME, knode_id=kid
            ).first()
            if not existing:
                db.add(LessonContent(
                    project_name=PROJECT_NAME,
                    knode_id=kid,
                    status="pending",
                    content_type="interactive",
                    course_content="",
                ))
        db.commit()
        console.print(f"[green]v {node_count} 个节点占位记录创建[/green]")
    finally:
        db.close()

    # 6. 写入目标节点的完整课程内容
    course_content = build_course_content()
    content_json = json.dumps(course_content, ensure_ascii=False)

    db2 = get_db_session()
    try:
        lesson = db2.query(LessonContent).filter_by(
            project_name=PROJECT_NAME, knode_id=TARGET_KNODE_ID
        ).first()
        if lesson:
            lesson.status = "ready"
            lesson.course_content = content_json
            lesson.content_type = "interactive"
            lesson.generated_at = dt.now()
        else:
            db2.add(LessonContent(
                project_name=PROJECT_NAME,
                knode_id=TARGET_KNODE_ID,
                status="ready",
                course_content=content_json,
                content_type="interactive",
                generated_at=dt.now(),
            ))
        db2.commit()

        # 统计
        anim_count = sum(1 for s in course_content["rendered_sections"].values() if s["mode"] == "animation")
        story_count = sum(len(s.get("story_paragraphs") or []) for s in course_content["rendered_sections"].values())
        exer_count  = sum(len(s.get("exercises") or []) for s in course_content["rendered_sections"].values())
        total_html  = sum(len(s.get("html") or "") for s in course_content["rendered_sections"].values())

        console.print(f"\n[bold green]完成！[/bold green]")
        console.print(f"  节点 {TARGET_KNODE_ID}（{TARGET_NODE_TITLE}）已写入")
        console.print(f"  课程文本：{len(PLAN_MARKDOWN)} 字符")
        console.print(f"  SVG 动画：{anim_count} 个（共 {total_html} 字节 HTML）")
        console.print(f"  故事段落：{story_count} 段")
        console.print(f"  练习题：{exer_count} 道")
        console.print(f"\n访问：[dim]http://localhost:3000/projects/{PROJECT_NAME}[/dim]")
        console.print(f"（先在系统里打开该项目，进入节点 M05N01）")
    finally:
        db2.close()


if __name__ == "__main__":
    write_everything()
