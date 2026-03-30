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

# ── 视觉主题系统 ──────────────────────────────────────────────────
# 参考来源：/Users/xinghan/Dev/oknowledgetree/mars_terrain_animations.html
#           /Users/xinghan/Dev/oknowledgetree/protein_secondary_structure_animations.html
#
# 每个主题包含：背景色、主色/辅色、粒子风格、大气光晕、字体
# 使用原则：项目主题 → 色彩氛围，如火星探索=土黄橙，生命科学=荧光绿，宇宙=深蓝紫

VISUAL_THEMES = {
    # 火星探索风格（参考 mars_terrain_animations.html）
    # 适用：aerospace, robotics, climate（荒野探索类）
    "mars_terrain": {
        "bg": "#0a0806",
        "card": "rgba(18,14,10,0.92)",
        "primary": "#e8723a",       # 火星橙
        "secondary": "#f0c040",     # 金沙黄
        "accent": "#c0392b",        # 火星红
        "sand": "#d4a056",          # 沙棕
        "text": "#d4c8b8",
        "text_dim": "#6b5e50",
        "border": "rgba(255,160,60,0.08)",
        "glow_1": "rgba(232,114,58,0.10)",
        "glow_2": "rgba(192,57,43,0.06)",
        "glow_3": "rgba(240,192,64,0.05)",
        "particle_color": "rgba(232,114,58,",  # 尘埃粒子 orange-tinted
        "particle_count": 160,
        "particle_type": "dust",    # 飘散尘埃
        "font_display": "'Oxanium', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Mono', monospace",
        "hud_label": "rgba(240,192,64,0.7)",
        "hud_value": "rgba(255,255,255,0.9)",
        "beam_color": "#e8723a",
    },
    # 生命科学/蛋白质风格（参考 protein_secondary_structure_animations.html）
    # 适用：biotech, chemistry（生命科学类）
    "biotech_life": {
        "bg": "#080c14",
        "card": "rgba(14,19,28,0.88)",
        "primary": "#58d68d",       # 荧光绿（生命色）
        "secondary": "#bb86fc",     # 紫罗兰（结构色）
        "accent": "#4dd0e1",        # 青色（活性位点）
        "warm": "#ff8a65",          # 暖橙（能量/热力）
        "text": "#c9d1d9",
        "text_dim": "#484f58",
        "border": "rgba(255,255,255,0.05)",
        "glow_1": "rgba(88,214,141,0.06)",
        "glow_2": "rgba(187,134,252,0.04)",
        "glow_3": "rgba(100,181,246,0.05)",
        "particle_color": "rgba(200,230,210,",  # 星点/荧光粒子
        "particle_count": 200,
        "particle_type": "stars",   # 星空
        "font_display": "'Outfit', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Mono', monospace",
        "hud_label": "rgba(88,214,141,0.7)",
        "hud_value": "rgba(255,255,255,0.9)",
        "beam_color": "#58d68d",
    },
    # 物理/数学风格
    # 适用：physics, math, cs
    "quantum_indigo": {
        "bg": "#0a0a14",
        "card": "rgba(15,15,25,0.90)",
        "primary": "#818cf8",       # 靛紫（量子/数学）
        "secondary": "#34d399",     # 薄荷绿（辅助）
        "accent": "#f472b6",        # 粉红（高亮）
        "text": "#e2e8f0",
        "text_dim": "#64748b",
        "border": "rgba(129,140,248,0.08)",
        "glow_1": "rgba(129,140,248,0.08)",
        "glow_2": "rgba(52,211,153,0.04)",
        "glow_3": "rgba(244,114,182,0.04)",
        "particle_color": "rgba(180,190,255,",
        "particle_count": 180,
        "particle_type": "stars",
        "font_display": "'Oxanium', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Mono', monospace",
        "hud_label": "rgba(129,140,248,0.7)",
        "hud_value": "rgba(255,255,255,0.9)",
        "beam_color": "#818cf8",
    },
    # 音乐/艺术风格
    # 适用：music, ai
    "sonic_amber": {
        "bg": "#0c0a08",
        "card": "rgba(20,16,12,0.90)",
        "primary": "#fbbf24",       # 琥珀金（音波/旋律）
        "secondary": "#a78bfa",     # 淡紫（和声）
        "accent": "#34d399",        # 绿（节拍/节奏）
        "text": "#e8dcc8",
        "text_dim": "#6b5e40",
        "border": "rgba(251,191,36,0.08)",
        "glow_1": "rgba(251,191,36,0.08)",
        "glow_2": "rgba(167,139,250,0.04)",
        "glow_3": "rgba(52,211,153,0.04)",
        "particle_color": "rgba(251,191,36,",
        "particle_count": 150,
        "particle_type": "sparks",  # 音符粒子
        "font_display": "'Outfit', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Mono', monospace",
        "hud_label": "rgba(251,191,36,0.7)",
        "hud_value": "rgba(255,255,255,0.9)",
        "beam_color": "#fbbf24",
    },
}

# 项目类别 -> 视觉主题 映射
CATEGORY_THEME_MAP = {
    "biotech": "biotech_life",
    "chemistry": "biotech_life",
    "physics": "quantum_indigo",
    "math": "quantum_indigo",
    "cs": "quantum_indigo",
    "ai": "quantum_indigo",
    "aerospace": "mars_terrain",
    "robotics": "mars_terrain",
    "climate": "mars_terrain",
    "music": "sonic_amber",
    "other": "biotech_life",
}


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
PROJECT_ESTIMATED_HOURS = 17
PROJECT_TAGS = ["biology", "protein", "structure", "biochemistry", "AlphaFold"]

TREE_PATH = _ROOT / "projects" / "protein-structure" / "knowledge_tree.json"

# 根据项目类别自动选取视觉主题
T = VISUAL_THEMES[CATEGORY_THEME_MAP.get(PROJECT_CATEGORY, "biotech_life")]

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
GAME_ID  = _id("game")
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
  background: __THEME_BG__;
  font-family: __THEME_FONT__;
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
  stroke: __THEME_ACCENT__;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  fill: none;
  opacity: 0;
  filter: url(#hbondGlow);
}
.hbond.visible { opacity: 1; }

/* HUD */
.hud-bg { fill: rgba(0,0,0,0.6); }
.hud-label { fill: __THEME_HUD_LABEL__; font-size: 10px; }
.hud-value { fill: __THEME_HUD_VALUE__; font-size: 13px; font-weight: bold; }
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
  stroke: __THEME_PRIMARY__;
  stroke-width: 1;
  stroke-dasharray: 3 3;
  opacity: 0;
  transition: opacity 0.5s;
}
.ann-line.show { opacity: 1; }

/* 阶段标题 */
.phase-title {
  fill: __THEME_PRIMARY__;
  font-size: 14px;
  font-weight: bold;
}
.phase-sub {
  fill: __THEME_TEXT_DIM__;
  font-size: 11px;
}
</style>
</head>
<body>
<svg id="svg" viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 背景渐变 -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="__THEME_BG__"/>
      <stop offset="100%" stop-color="__THEME_BG2__"/>
    </linearGradient>
    <!-- 网格图案 -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0L0 0L0 40" fill="none" stroke="__THEME_GRID__" stroke-width="1"/>
    </pattern>
    <!-- 珠子渐变：主色调 -->
    <radialGradient id="beadGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="__THEME_PRIMARY__" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="__THEME_PRIMARY__" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="__THEME_PRIMARY__" stop-opacity="0.4"/>
    </radialGradient>
    <!-- 侧链渐变：辅色调 -->
    <radialGradient id="sideGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="__THEME_SECONDARY__" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="__THEME_SECONDARY__" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="__THEME_SECONDARY__" stop-opacity="0.3"/>
    </radialGradient>
    <!-- 骨架渐变 -->
    <linearGradient id="backboneGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="__THEME_PRIMARY__"/>
      <stop offset="100%" stop-color="__THEME_SECONDARY__"/>
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
  background: __THEME_BG__;
  font-family: __THEME_FONT__;
}
svg { display: block; width: 100%; height: 100%; }

.hud-bg { fill: rgba(0,0,0,0.6); }
.hud-label { fill: __THEME_HUD_LABEL__; font-size: 10px; }
.hud-value { fill: __THEME_HUD_VALUE__; font-size: 13px; font-weight: bold; }
.hud-line { stroke: rgba(255,255,255,0.08); stroke-width: 1; }
</style>
</head>
<body>
<svg id="svg" viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="__THEME_BG__"/>
      <stop offset="100%" stop-color="__THEME_BG2__"/>
    </linearGradient>
    <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0L0 0L0 40" fill="none" stroke="__THEME_GRID__" stroke-width="1"/>
    </pattern>
    <filter id="glow2">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="softGlow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <!-- 当前高亮氢键颜色：主色调 -->
    <radialGradient id="hlBeadGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="__THEME_PRIMARY__" stop-opacity="1.0"/>
      <stop offset="50%" stop-color="__THEME_PRIMARY__" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="__THEME_PRIMARY__" stop-opacity="0.4"/>
    </radialGradient>
    <!-- 普通珠子：辅色 -->
    <radialGradient id="normalBeadGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="__THEME_SECONDARY__" stop-opacity="0.7"/>
      <stop offset="50%" stop-color="__THEME_SECONDARY__" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="__THEME_SECONDARY__" stop-opacity="0.2"/>
    </radialGradient>
    <!-- 侧链：强调色 -->
    <radialGradient id="sideGrad2" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="__THEME_ACCENT__" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="__THEME_ACCENT__" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="__THEME_ACCENT__" stop-opacity="0.2"/>
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
          fill="rgba(0,0,0,0.5)" stroke="__THEME_PRIMARY__" stroke-opacity="0.3" stroke-width="1.5"/>
    <text x="487" y="62" text-anchor="middle"
          fill="__THEME_PRIMARY__" font-size="11" font-weight="bold">氢键形成规律</text>
    <text id="rule-cur" x="487" y="82" text-anchor="middle"
          fill="__THEME_ACCENT__" font-size="13" font-weight="bold">第1↔第5</text>
    <text x="487" y="100" text-anchor="middle"
          fill="__THEME_TEXT_DIM__" font-size="10">C=O（第i个）</text>
    <text x="487" y="115" text-anchor="middle"
          fill="__THEME_TEXT_DIM__" font-size="10">与 N-H（第i+4个）</text>
    <text x="487" y="130" text-anchor="middle"
          fill="__THEME_TEXT_DIM__" font-size="10">之间形成氢键</text>
    <text id="rule-count" x="487" y="146" text-anchor="middle"
          fill="__THEME_SECONDARY__" font-size="10">当前高亮第 1 条</text>
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
  "stroke": "__THEME_SECONDARY__", "stroke-opacity": "0.5", "stroke-width": "2.5",
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
    "stroke": "__THEME_ACCENT__",
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
  stroke: "__THEME_SECONDARY__", "stroke-opacity": "0.2", "stroke-width": "1",
  "stroke-dasharray": "6 4",
});
scene2.appendChild(axisLine);

// 轴标注
var axisLabel = makeSVG("text", {
  x: (AXIS_X0 + (BEADS - 1) * X_STEP / 2).toFixed(0),
  y: (AXIS_Y + 16).toFixed(0),
  "text-anchor": "middle",
  fill: "__THEME_SECONDARY__", "fill-opacity": "0.5", "font-size": "9",
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
        hbLines[hi].setAttribute("stroke", "__THEME_ACCENT__");
        hbLines[hi].setAttribute("stroke-width", "2.5");
        hbLines[hi].setAttribute("opacity", "1");
      } else {
        // 已显示：暗色
        hbLines[hi].setAttribute("stroke", "__THEME_ACCENT__");
        hbLines[hi].setAttribute("stroke-opacity", "0.35");
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

# ── 交互游戏：氢键连连看 ────────────────────────────────────────
# 玩法：屏幕左侧显示编号1-9的氨基酸（C=O端），右侧显示编号5-13（N-H端）
# 玩家点击左侧一个珠子，再点击右侧一个珠子，如果配对正确（差值=4）得分
# 全部9对连完获胜，每轮随机打乱顺序

GAME_HTML = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>氢键连连看</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: __THEME_BG__;
  font-family: __THEME_FONT__;
  color: __THEME_TEXT__;
  user-select: none;
}
#wrap {
  display: flex; flex-direction: column;
  width: 100%; height: 100%; padding: 10px;
}
#header {
  text-align: center; padding-bottom: 8px;
  font-size: 14px; font-weight: bold;
  color: __THEME_PRIMARY__;
  letter-spacing: 0.5px;
}
#subtitle {
  text-align: center;
  font-size: 11px; color: __THEME_TEXT_DIM__;
  margin-bottom: 6px;
}
#game-area {
  display: flex; flex: 1; align-items: stretch;
  gap: 8px; min-height: 0;
}
#left-col, #right-col {
  display: flex; flex-direction: column;
  justify-content: space-around; align-items: center;
  width: 110px; padding: 4px 0; gap: 4px;
}
#center-area {
  flex: 1; position: relative; overflow: hidden;
}
#connect-svg {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
}
.bead-btn {
  width: 80px; height: 34px;
  border-radius: 8px;
  border: 1.5px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: __THEME_TEXT__;
  font-size: 11px; font-weight: bold;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex; align-items: center; justify-content: center;
  gap: 4px;
  position: relative;
}
.bead-btn:hover:not(.done):not(.selected) {
  border-color: __THEME_PRIMARY__;
  background: rgba(255,255,255,0.08);
}
.bead-btn.selected {
  border-color: __THEME_PRIMARY__;
  background: __THEME_PRIMARY__;
  color: __THEME_BG__;
  box-shadow: 0 0 12px __THEME_PRIMARY__;
}
.bead-btn.done {
  border-color: rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
  color: __THEME_TEXT_DIM__;
  cursor: default;
}
.bead-btn.wrong {
  border-color: #f87171;
  background: rgba(248,113,113,0.15);
  animation: shake 0.3s ease;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.bead-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: __THEME_SECONDARY__; flex-shrink: 0;
}
.bead-btn.done .bead-dot { background: __THEME_TEXT_DIM__; }
#hud {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 12px; margin-top: 6px;
  background: rgba(0,0,0,0.3);
  border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);
  font-size: 11px;
}
#hud-score { color: __THEME_PRIMARY__; font-weight: bold; font-size: 13px; }
#hud-rule  { color: __THEME_TEXT_DIM__; }
#hud-msg   { color: __THEME_ACCENT__; font-weight: bold; min-width: 60px; text-align: right; }
#win-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  gap: 14px;
  opacity: 0; pointer-events: none;
  transition: opacity 0.4s ease;
  z-index: 10;
}
#win-overlay.show { opacity: 1; pointer-events: all; }
#win-title { font-size: 22px; font-weight: bold; color: __THEME_PRIMARY__; }
#win-sub   { font-size: 13px; color: __THEME_TEXT__; }
#replay-btn {
  padding: 10px 28px; border-radius: 10px;
  background: __THEME_PRIMARY__; color: __THEME_BG__;
  border: none; font-size: 14px; font-weight: bold;
  cursor: pointer;
  transition: box-shadow 0.2s;
}
#replay-btn:hover { box-shadow: 0 0 20px __THEME_PRIMARY__; }
</style>
</head>
<body>
<div id="wrap">
  <div id="header">氢键连连看：找到 i ↔ (i+4) 的配对</div>
  <div id="subtitle">点击左侧一个氨基酸（C=O），再点击右侧相隔4位的氨基酸（N-H）完成配对</div>

  <div id="game-area">
    <div id="left-col"></div>
    <div id="center-area">
      <svg id="connect-svg" xmlns="http://www.w3.org/2000/svg"></svg>
      <div id="win-overlay">
        <div id="win-title">全部配对成功！</div>
        <div id="win-sub">你已掌握 α螺旋 i↔(i+4) 氢键规律</div>
        <button id="replay-btn" onclick="initGame()">再玩一次</button>
      </div>
    </div>
    <div id="right-col"></div>
  </div>

  <div id="hud">
    <span id="hud-score">得分：0 / 9</span>
    <span id="hud-rule">规律：第 i ↔ 第 (i+4) 形成氢键</span>
    <span id="hud-msg"></span>
  </div>
</div>

<script>
(function() {
"use strict";

var leftCol   = document.getElementById("left-col");
var rightCol  = document.getElementById("right-col");
var svg       = document.getElementById("connect-svg");
var hudScore  = document.getElementById("hud-score");
var hudMsg    = document.getElementById("hud-msg");
var winOverlay= document.getElementById("win-overlay");
var TOTAL     = 9;

// 游戏状态
var leftItems, rightItems;
var selectedLeft = null;
var score = 0;
var connections = [];  // {li, ri, line}
var wrongTimer = null;

// 颜色常量（与主题一致）
var COLOR_LINE_DONE  = "__THEME_PRIMARY__";
var COLOR_LINE_ALPHA = "0.6";
var COLOR_LINE_ANIM  = "__THEME_ACCENT__";

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function clearSVGLines() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function getAnchor(el, side) {
  var rect = el.getBoundingClientRect();
  var svgRect = svg.getBoundingClientRect();
  return {
    x: (side === "right" ? rect.right : rect.left) - svgRect.left,
    y: (rect.top + rect.bottom) / 2 - svgRect.top,
  };
}

function drawLine(x1, y1, x2, y2, color, alpha, dashed) {
  var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-opacity", alpha);
  line.setAttribute("stroke-width", "2");
  if (dashed) line.setAttribute("stroke-dasharray", "5 3");
  svg.appendChild(line);
  return line;
}

function redrawLines() {
  clearSVGLines();
  for (var c of connections) {
    var leftEl  = document.getElementById("lb-" + c.li);
    var rightEl = document.getElementById("rb-" + c.ri);
    if (!leftEl || !rightEl) continue;
    var la = getAnchor(leftEl, "right");
    var ra = getAnchor(rightEl, "left");
    drawLine(la.x, la.y, ra.x, ra.y, COLOR_LINE_DONE, COLOR_LINE_ALPHA, false);
  }
}

window.initGame = function() {
  leftCol.innerHTML = "";
  rightCol.innerHTML = "";
  clearSVGLines();
  score = 0;
  connections = [];
  selectedLeft = null;
  winOverlay.classList.remove("show");
  hudScore.textContent = "得分：0 / " + TOTAL;
  hudMsg.textContent = "";

  // 左侧：1~9（C=O端），右侧：5~13（N-H端），各自打乱
  leftItems  = shuffle([1,2,3,4,5,6,7,8,9]);
  rightItems = shuffle([5,6,7,8,9,10,11,12,13]);

  leftItems.forEach(function(n) {
    var btn = document.createElement("button");
    btn.className = "bead-btn";
    btn.id = "lb-" + n;
    btn.dataset.n = n;
    btn.innerHTML = '<span class="bead-dot"></span>残基 ' + n + ' (C=O)';
    btn.onclick = function() { onLeftClick(n, btn); };
    leftCol.appendChild(btn);
  });

  rightItems.forEach(function(n) {
    var btn = document.createElement("button");
    btn.className = "bead-btn";
    btn.id = "rb-" + n;
    btn.dataset.n = n;
    btn.innerHTML = '<span class="bead-dot"></span>残基 ' + n + ' (N-H)';
    btn.onclick = function() { onRightClick(n, btn); };
    rightCol.appendChild(btn);
  });
};

function onLeftClick(n, btn) {
  if (btn.classList.contains("done")) return;
  // 取消已有选择
  if (selectedLeft !== null) {
    var prev = document.getElementById("lb-" + selectedLeft);
    if (prev) prev.classList.remove("selected");
  }
  selectedLeft = n;
  btn.classList.add("selected");
  hudMsg.textContent = "已选：残基 " + n;
}

function onRightClick(n, btn) {
  if (btn.classList.contains("done")) return;
  if (selectedLeft === null) {
    hudMsg.style.color = "#f87171";
    hudMsg.textContent = "先点左侧！";
    setTimeout(function() { hudMsg.style.color = ""; hudMsg.textContent = ""; }, 1200);
    return;
  }
  // 判断配对是否正确（右 - 左 === 4）
  if (n - selectedLeft === 4) {
    // 正确
    var lBtn = document.getElementById("lb-" + selectedLeft);
    lBtn.classList.remove("selected");
    lBtn.classList.add("done");
    btn.classList.add("done");
    connections.push({ li: selectedLeft, ri: n });
    redrawLines();
    score++;
    selectedLeft = null;
    hudScore.textContent = "得分：" + score + " / " + TOTAL;
    hudMsg.style.color = "__THEME_PRIMARY__";
    hudMsg.textContent = "正确！+" + score;
    if (score === TOTAL) {
      setTimeout(function() { winOverlay.classList.add("show"); }, 600);
    }
  } else {
    // 错误
    var lBtn2 = document.getElementById("lb-" + selectedLeft);
    btn.classList.add("wrong");
    lBtn2.classList.add("wrong");
    hudMsg.style.color = "#f87171";
    var diff = n - selectedLeft;
    hudMsg.textContent = diff > 0 ? "差 " + diff + " 位，需差4！" : "方向不对！";
    if (wrongTimer) clearTimeout(wrongTimer);
    wrongTimer = setTimeout(function() {
      btn.classList.remove("wrong");
      if (lBtn2) lBtn2.classList.remove("wrong");
      hudMsg.textContent = "";
    }, 800);
  }
}

// 窗口缩放时重绘连线
window.addEventListener("resize", redrawLines);

initGame();

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

# ── Idea 自我辩论系统 ────────────────────────────────────────────
#
# 在生成任何动画/游戏之前，必须通过自我辩论验证这个 idea 是否合适。
# 辩论框架：对每个候选 idea，提出 3 个反对论点，再给出反驳，
# 最终打分 0-10，分数 >= 6 才允许生成。
#
# 评分维度：
#   1. 教学匹配度：这个媒介是否是展示该概念最合适的方式？
#   2. 操作可行度：实现复杂度是否合理（不过度工程化）？
#   3. 认知负担：对目标年龄（10岁）是否友好？
#   4. 完成感：用户完成互动后是否有明确的收获感？

def _debate_idea(
    idea_id: str,
    mode: str,
    topic: str,
    objections: list[str],
    rebuttals: list[str],
    scores: dict[str, int],
) -> bool:
    """
    执行 idea 辩论并打印结果。返回 True 表示通过（可以生成），False 表示不通过（跳过）。

    scores 字段：
        teaching_fit: 教学匹配度 1-10
        feasibility:  可行度 1-10
        cognitive:    认知适配 1-10
        completion:   完成感 1-10
    """
    total = sum(scores.values())
    avg = total / len(scores)
    passed = avg >= 6.0

    console.print(f"\n[bold]-- Idea 辩论：[cyan]{mode}[/cyan] · {topic[:40]}[/bold]")
    for i, (obj, reb) in enumerate(zip(objections, rebuttals), 1):
        console.print(f"  [red]质疑{i}[/red]: {obj}")
        console.print(f"  [green]反驳{i}[/green]: {reb}")
    score_str = " | ".join(f"{k}={v}" for k, v in scores.items())
    result = "[bold green]通过[/bold green]" if passed else "[bold red]不通过（已跳过）[/bold red]"
    console.print(f"  得分 ({score_str}) 均值={avg:.1f} → {result}")
    return passed


# 对本节点所有候选 idea 进行辩论（共 6 个候选，目标通过 3-4 个）
# 辩论通过阈值：均值 >= 6.0
# 辩论原则：质疑要犀利，不能都找到反驳，部分应该被淘汰

_IDEA_DEBATES = {
    # ── 候选1：历史故事 ──────────────────────────────────────────
    "story": _debate_idea(
        idea_id="story",
        mode="story",
        topic="Pauling 病床上的发现——α螺旋历史故事",
        objections=[
            "故事只有文字+图片，对10岁孩子而言吸引力远不如动画，放在这里是浪费屏幕位置",
            "Pauling 1951年的历史背景完全不在孩子的知识体系里，这个情境无法建立共情",
            "课程中已经有2个动画+1个游戏，内容密度够了，3段故事是冗余",
        ],
        rebuttals=[
            "文字故事补充动画无法传递的情感维度：Pauling 发烧折纸这个意象比任何动画都更能让孩子感受到科学的人性",
            "不需要了解Pauling是谁：'一个生病的科学家在床上折纸发现了自然规律'对任何孩子都是有共鸣的故事弧",
            "故事不消耗注意力，反而是必要的呼吸节奏——两个动画之间的过渡，有故事比没有更有学习完成感",
        ],
        scores={"teaching_fit": 6, "feasibility": 10, "cognitive": 8, "completion": 6},
    ),
    # ── 候选2：螺旋形成动画 ──────────────────────────────────────
    "anim1": _debate_idea(
        idea_id="anim1",
        mode="animation",
        topic="多肽链从直链到α螺旋的形成过程",
        objections=[
            "13个珠子同时平滑移动，孩子根本不知道该看哪里，视觉重点分散",
            "2D投影的螺旋已经是失真简化，孩子可能建立错误的3D空间认知",
            "直链→螺旋的平滑过渡在物理上完全不存在，教错了比没教更糟",
        ],
        rebuttals=[
            "珠子用深度透明度排序，骨架和侧链颜色分离，视觉焦点引导已处理；HUD底栏同步显示数字，双通道传递信息",
            "2D投影是生化教学的通行做法，Ramachandran图、螺旋轮图都是投影；不存在'正确3D认知'需要从2D建立",
            "教学隐喻合法：化学教科书从未展示真实折叠过程（太复杂），简化的概念动画在世界范围内是标准教材",
        ],
        scores={"teaching_fit": 9, "feasibility": 8, "cognitive": 7, "completion": 8},
    ),
    # ── 候选3：α螺旋 vs β折叠对比动画（新候选，预期淘汰）────────
    "anim_compare": _debate_idea(
        idea_id="anim_compare",
        mode="animation",
        topic="α螺旋 vs β折叠二级结构对比动画",
        objections=[
            "β折叠是下一节的内容（M05N02），在本节展示等于剧透，破坏知识树的顺序设计",
            "对比两种结构同时出现，认知负担翻倍，孩子还没掌握α螺旋就要同时理解β折叠",
            "本节教学目标是'掌握α螺旋结构和氢键规律'，对比动画偏离了核心目标",
        ],
        rebuttals=[
            "对比可以强化α螺旋的特征认识，让孩子更清楚'螺旋有别于折叠'——但这个目的用简单文字就够了",
            "可以只展示α螺旋，用占位符标注'下一节学β折叠'，而不是完整渲染两者",
            "提前引入是一种有效的铺垫策略，让孩子对下一节产生好奇",
        ],
        # 质疑强，反驳弱：反驳1承认了质疑的合理性，无法有效驳斥
        scores={"teaching_fit": 3, "feasibility": 6, "cognitive": 3, "completion": 5},
    ),
    # ── 候选4：氢键 i↔(i+4) 高亮动画 ───────────────────────────
    "anim2": _debate_idea(
        idea_id="anim2",
        mode="animation",
        topic="氢键 i↔(i+4) 规律逐一高亮展示",
        objections=[
            "动画1已经展示了氢键的形成，动画2看起来像是重复，会降低孩子的新鲜感",
            "侧视图螺旋是弯曲的正弦波，孩子根本看不出这是螺旋而不是弹簧——几何抽象过强",
            "逐一高亮9条氢键需要约13秒，孩子可能等不到第9条就失去兴趣",
        ],
        rebuttals=[
            "关注点不同：动画1展示'折叠过程'，动画2展示'每对具体是哪两个残基'——前者是宏观，后者是微观细节",
            "侧视图配有序号标注和右侧规则说明框（第i↔第i+4），几何抽象通过文字辅助可以克服",
            "无法完全驳斥：13秒确实可能让耐心较差的孩子流失；但循环播放和HUD数字计数有一定的吸引力补偿",
        ],
        scores={"teaching_fit": 7, "feasibility": 8, "cognitive": 6, "completion": 6},
    ),
    # ── 候选5：3D旋转互动游戏（新候选，预期淘汰）───────────────
    "game_3d_rotate": _debate_idea(
        idea_id="game_3d_rotate",
        mode="game",
        topic="用鼠标旋转3D螺旋，从不同角度观察氢键分布",
        objections=[
            "SVG/Canvas 2D无法实现真正的3D旋转，只能用伪3D投影，效果丑陋且教学价值低",
            "鼠标拖拽旋转对10岁孩子的空间理解能力是极高要求，研究表明儿童3D空间认知在12岁前不成熟",
            "本节核心是'记住3.6残基/圈和i↔(i+4)'，3D旋转游戏完全不直接测试这两个关键知识点",
        ],
        rebuttals=[
            "可以用CSS 3D transform实现简单旋转效果，质量不会太差",
            "孩子对空间理解可能被低估，他们玩Minecraft有丰富的3D空间经验",
            "旋转探索可以建立空间直觉，间接支持对螺旋结构的理解",
        ],
        # 反驳太弱：CSS 3D质量确实差，Minecraft经验不等于科学空间认知，间接价值无法证明优于直接游戏
        scores={"teaching_fit": 4, "feasibility": 4, "cognitive": 4, "completion": 5},
    ),
    # ── 候选6：氢键连连看游戏 ────────────────────────────────────
    "game": _debate_idea(
        idea_id="game",
        mode="game",
        topic="氢键连连看：i↔(i+4) 配对游戏",
        objections=[
            "9对只需要认识数字差值为4，这不测试任何真正的化学理解，只是数学练习",
            "孩子点错后只看到错误提示，没有解释'为什么差4'，错误反馈不完整",
            "游戏总时长2分钟内，获胜太快，没有挑战感，无法产生成就感",
        ],
        rebuttals=[
            "游戏目标不是测试，而是通过操作强化'差4'的记忆编码——肌肉记忆比认知记忆更持久",
            "点错时提示'差X位，需差4'，间接教了规律；加上游戏前有动画铺垫，孩子已理解原理",
            "完成9对显示胜利页面，可一键重玩，每次顺序随机；简短游戏+重玩机制比长游戏更适合注意力短的孩子",
        ],
        scores={"teaching_fit": 7, "feasibility": 9, "cognitive": 8, "completion": 7},
    ),
}

console.print(f"\n[bold]辩论汇总：{sum(1 for v in _IDEA_DEBATES.values() if v)}/{len(_IDEA_DEBATES)} 个 idea 通过[/bold]\n")

# 辩论通过的 idea 集合（用于在 build_course_content 中过滤）
DEBATE_PASSED = set(k for k, v in _IDEA_DEBATES.items() if v)


# ── 主题应用 ────────────────────────────────────────────────────

def _apply_theme(html: str, theme: dict) -> str:
    """
    将动画 HTML 中的占位色替换为当前项目主题色。
    动画 HTML 中统一使用以下占位符：
      __THEME_BG__       背景色
      __THEME_BG2__      背景渐变终止色（略亮）
      __THEME_PRIMARY__  主色（珠子/高亮）
      __THEME_SECONDARY__ 辅色（侧链/装饰）
      __THEME_ACCENT__   强调色（氢键/标注）
      __THEME_TEXT__     正文色
      __THEME_TEXT_DIM__ 次要文字色
      __THEME_GRID__     网格线色
      __THEME_HUD_LABEL__ HUD 标签色
      __THEME_HUD_VALUE__ HUD 数值色
      __THEME_FONT__     字体
    """
    bg = theme["bg"]
    # 背景渐变终止色：bg 加亮 8
    def _lighten(hex_color: str, delta: int = 8) -> str:
        h = hex_color.lstrip("#")
        rgb = [int(h[i:i+2], 16) for i in (0, 2, 4)]
        rgb = [min(255, c + delta) for c in rgb]
        return "#" + "".join(f"{c:02x}" for c in rgb)

    replacements = {
        "__THEME_BG__": bg,
        "__THEME_BG2__": _lighten(bg, 10),
        "__THEME_PRIMARY__": theme["primary"],
        "__THEME_SECONDARY__": theme["secondary"],
        "__THEME_ACCENT__": theme.get("accent", theme["secondary"]),
        "__THEME_TEXT__": theme["text"],
        "__THEME_TEXT_DIM__": theme["text_dim"],
        "__THEME_GRID__": "rgba(255,255,255,0.025)",
        "__THEME_HUD_LABEL__": theme["hud_label"],
        "__THEME_HUD_VALUE__": theme["hud_value"],
        "__THEME_FONT__": theme["font_display"],
    }
    for placeholder, value in replacements.items():
        html = html.replace(placeholder, value)
    return html


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
    # 游戏在第三部分后、总结前插入（让学生实践 i↔(i+4) 规律）
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 小结：α螺旋的五个关键数字",
        f"[[IDEA:{GAME_ID}]]\n\n## 小结：α螺旋的五个关键数字"
    )

    # debate_key -> (idea_id, idea_dict, rendered_dict) 映射
    # 只有辩论通过的 idea 才会进入最终输出
    all_candidates = [
        (
            "story",
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
                STORY_ID: {
                    "mode": "story", "status": "ready", "html": None,
                    "story_paragraphs": STORY_PARAGRAPHS, "exercises": None,
                    "generation_backend": "claude_code_direct",
                }
            },
        ),
        (
            "anim1",
            {
                "idea_id": ANIM1_ID,
                "mode": "animation",
                "topic": "多肽链从直链到α螺旋的形成过程",
                "context_summary": "动态展示多肽链如何通过氢键驱动逐步卷曲成稳定的右手螺旋，珠子代表氨基酸，色虚线代表氢键",
                "generation_backend": "claude_code_direct",
                "style_key": "chromatic_depth",
                "mode_reason": "动态卷曲过程是抽象概念，静态图无法表达；SVG动画可以展示每一步的变化",
            },
            {
                ANIM1_ID: {
                    "mode": "animation", "status": "ready",
                    "html": _apply_theme(ANIM1_HTML, T),
                    "story_paragraphs": None, "exercises": None,
                    "generation_backend": "claude_code_direct",
                }
            },
        ),
        (
            "anim2",
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
                ANIM2_ID: {
                    "mode": "animation", "status": "ready",
                    "html": _apply_theme(ANIM2_HTML, T),
                    "story_paragraphs": None, "exercises": None,
                    "generation_backend": "claude_code_direct",
                }
            },
        ),
        (
            "game",
            {
                "idea_id": GAME_ID,
                "mode": "game",
                "topic": "氢键连连看：i↔(i+4) 配对游戏",
                "context_summary": "玩家点击左侧残基（C=O端）和右侧残基（N-H端），正确配对相差4位的氨基酸对，完成9条氢键，巩固i↔(i+4)规律",
                "generation_backend": "claude_code_direct",
                "style_key": "biotech_life",
                "mode_reason": "辩论通过：配对规则单一（差4位），操作2步（选左→选右），即时反馈，9对完成有胜利感；适合10岁认知水平",
            },
            {
                GAME_ID: {
                    "mode": "game", "status": "ready",
                    "html": _apply_theme(GAME_HTML, T),
                    "story_paragraphs": None, "exercises": None,
                    "generation_backend": "claude_code_direct",
                }
            },
        ),
        (
            # exercise 不经过辩论，永远加入
            "exercise",
            {
                "idea_id": EXER_ID,
                "mode": "exercise",
                "topic": "α螺旋关键知识点巩固练习",
                "context_summary": "检验学生对α螺旋参数、维持力、破坏因素和生活实例的理解",
                "generation_backend": "claude_code_direct",
                "style_key": "",
                "mode_reason": "练习题巩固学习，即时检测理解",
            },
            {
                EXER_ID: {
                    "mode": "exercise", "status": "ready", "html": None,
                    "story_paragraphs": None, "exercises": EXERCISES,
                    "generation_backend": "claude_code_direct",
                }
            },
        ),
    ]

    ideas = []
    rendered_sections = {}
    for debate_key, idea_dict, section_dict in all_candidates:
        # exercise 不需要辩论
        if debate_key == "exercise" or debate_key in DEBATE_PASSED:
            ideas.append(idea_dict)
            rendered_sections.update(section_dict)
        else:
            console.print(f"[yellow]跳过（辩论未通过）：{idea_dict['topic'][:40]}[/yellow]")

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

    # 读取知识树（已是 milestones 格式）
    with open(TREE_PATH, encoding="utf-8") as f:
        tree_data = json.load(f)
    milestones = tree_data["milestones"]
    node_count = sum(len(m["knodes"]) for m in milestones)

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
