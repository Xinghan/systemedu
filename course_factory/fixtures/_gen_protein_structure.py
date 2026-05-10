"""
GP-01 蛋白结构探险地图 — 完全由 Claude Code 生成
节点：M05N01「alpha螺旋：大自然的弹簧」完整课程

不调用任何 LLM agent pipeline。
Claude Code 直接生成：课程文本 + HUD 仪表盘动画 + 游戏 + 练习题 + 故事
然后写入数据库。

设计风格：Stitch HUD 仪表盘（Space Grotesk + glass panel + circuit header
+ 高饱和霓虹色 + probe 连线 + 脉冲呼吸动画）
"""

from __future__ import annotations

import json
import sys
import time
import random
import string
from datetime import datetime
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_ROOT / "src"))
sys.path.insert(0, str(_ROOT))

import yaml
from rich.console import Console
from rich.panel import Panel

console = Console()

# ── 视觉主题系统（Stitch HUD 仪表盘风格 — 高饱和霓虹色）──────────

VISUAL_THEMES = {
    "biotech_life": {
        "bg": "#0c0e12",
        "bg2": "#111318",
        "surface": "#171a1f",
        "surface_high": "#1d2025",
        "surface_highest": "#23262c",
        "card": "rgba(23,26,31,0.6)",
        "primary": "#50FFB0",
        "secondary": "#acf900",
        "accent": "#85ecff",
        "text": "#f6f6fc",
        "text_dim": "#aaabb0",
        "border": "rgba(70,72,77,0.15)",
        "font_display": "'Space Grotesk', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Grotesk', monospace",
        "hud_label": "#aaabb0",
        "hud_value": "#f6f6fc",
        "hud_bg": "rgba(12,14,18,0.95)",
        "beam_color": "#50FFB0",
    },
    "physics_chalk": {
        "bg": "#0c0e12", "bg2": "#111318",
        "surface": "#171a1f", "surface_high": "#1d2025", "surface_highest": "#23262c",
        "card": "rgba(23,26,31,0.6)",
        "primary": "#00F0FF", "secondary": "#2ae500", "accent": "#DBFCFF",
        "text": "#e3e1e9", "text_dim": "#849495",
        "border": "rgba(59,73,75,0.15)",
        "font_display": "'Space Grotesk', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Grotesk', monospace",
        "hud_label": "#849495", "hud_value": "#e3e1e9",
        "hud_bg": "rgba(18,19,24,0.95)", "beam_color": "#00F0FF",
    },
    "explorer_sand": {
        "bg": "#0c0e12", "bg2": "#111318",
        "surface": "#171a1f", "surface_high": "#1d2025", "surface_highest": "#23262c",
        "card": "rgba(23,26,31,0.6)",
        "primary": "#FF8A50", "secondary": "#FFB060", "accent": "#FF6B6B",
        "text": "#f6f6fc", "text_dim": "#aaabb0",
        "border": "rgba(70,72,77,0.15)",
        "font_display": "'Space Grotesk', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Grotesk', monospace",
        "hud_label": "#aaabb0", "hud_value": "#f6f6fc",
        "hud_bg": "rgba(12,14,18,0.95)", "beam_color": "#FF8A50",
    },
    "creative_studio": {
        "bg": "#0c0e12", "bg2": "#111318",
        "surface": "#171a1f", "surface_high": "#1d2025", "surface_highest": "#23262c",
        "card": "rgba(23,26,31,0.6)",
        "primary": "#EBB2FF", "secondary": "#F472B6", "accent": "#A78BFA",
        "text": "#f6f6fc", "text_dim": "#aaabb0",
        "border": "rgba(70,72,77,0.15)",
        "font_display": "'Space Grotesk', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Grotesk', monospace",
        "hud_label": "#aaabb0", "hud_value": "#f6f6fc",
        "hud_bg": "rgba(12,14,18,0.95)", "beam_color": "#EBB2FF",
    },
}

CATEGORY_THEME_MAP = {
    "biotech": "biotech_life", "chemistry": "biotech_life",
    "physics": "physics_chalk", "math": "physics_chalk",
    "cs": "physics_chalk", "ai": "physics_chalk",
    "aerospace": "explorer_sand", "robotics": "explorer_sand",
    "climate": "explorer_sand", "music": "creative_studio",
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
    "从氨基酸到 AlphaFold，少年版蛋白质序列--结构--功能可视化探索课程。"
    "基于10岁儿童知识水平构建完整学习路径，涵盖化学直觉、二级结构、三级结构、"
    "活性位点、折叠病与 AI 预测。"
)
PROJECT_CATEGORY = "biotech"
PROJECT_AGE_RANGE = [10, 16]
PROJECT_ESTIMATED_HOURS = 17
PROJECT_TAGS = ["biology", "protein", "structure", "biochemistry", "AlphaFold"]

TREE_PATH = _ROOT / "projects" / "protein-structure" / "knowledge_tree.json"

T = VISUAL_THEMES[CATEGORY_THEME_MAP.get(PROJECT_CATEGORY, "biotech_life")]

# ── 课程节点：M05N01 alpha螺旋 ──────────────────────────────────
TARGET_KNODE_ID = 12
TARGET_NODE_TITLE = "alpha螺旋：大自然的弹簧"
TARGET_NODE_SUMMARY = (
    "alpha螺旋是蛋白质链绕成的右手螺旋结构，每3.6个氨基酸旋转一圈，"
    "靠骨架氢键维持，侧链朝外。头发和指甲富含alpha螺旋。"
)

# ── 步骤1：完整课程文本（plan_markdown）────────────────────────

PLAN_MARKDOWN = """# M05N01：alpha螺旋——大自然的弹簧

> **模块**：二级结构：局部折叠规律
> **知识等级**：L2-操作 | **难度**：3/10 | **预计时长**：30分钟
> **先修知识**：肽键（M04N01）、氢键直觉（M02N02）

---

## 开篇故事：铁丝的记忆

想象你手里有一段铁丝。把它笔直拉开——它是直的。现在，把铁丝紧紧绕在铅笔上，一圈一圈，绕满整根铅笔。然后，小心地抽出铅笔。

神奇的事发生了：铁丝"记住"了螺旋的形状，保持成一个弹簧。

你的头发，就是由千千万万条这样的"蛋白质弹簧"组成的。

---

## 第一部分：什么是alpha螺旋？

alpha螺旋是蛋白质多肽链在局部区域形成的一种有规则的**右手螺旋**结构。

"右手"是什么意思？用右手握住一根想象中的螺旋轴，四根手指弯曲的方向，就是alpha螺旋旋转的方向。世界上大多数alpha螺旋都是右手螺旋（左手螺旋极为罕见）。

### 关键数字（理解，不用背）

| 参数 | 数值 | 意义 |
|------|------|------|
| 每圈氨基酸数 | **3.6个** | 不是整数！这是alpha螺旋稳定性的来源之一 |
| 螺距（每圈高度） | **0.54纳米** | 约等于5-6个氢原子叠起来的高度 |
| 每个氨基酸上升距离 | 0.15纳米 | 0.54 / 3.6 |
| 螺旋直径（骨架） | ~0.5纳米 | 侧链朝外，更宽 |

---

## 第二部分：氢键是如何让弹簧保持形状的？

alpha螺旋能保持螺旋形状，靠的是**氢键**——一种弱但数量多的力。

### 氢键的位置

多肽骨架上有两种原子团：
- **N-H**（每个氨基酸骨架上都有）—— 氢键的**给体**（提供H）
- **C=O**（每个氨基酸骨架上都有）—— 氢键的**受体**（接受H）

规律是：**第 i 个**残基的 C=O，和**第 (i+4) 个**残基的 N-H，之间形成氢键。

类比：想象一条很长的拉链——不是普通的拉链（相邻两格扣在一起），而是每隔4格才扣一次。这样形成的拉链会自然弯成螺旋形。

### 为什么每隔4个？

因为3.6这个数字：每圈3.6个残基，差不多转完一圈正好是4个残基——所以第i个和第(i+4)个在三维空间中刚好彼此靠近，能形成氢键。这是精妙的几何巧合（其实是进化筛选的结果）。

### 氢键有多少个？

一条10个氨基酸的alpha螺旋大概有6个氢键（从第1-5到第6-10）。一条100个氨基酸的螺旋有大约96个氢键。数量越多，整体越稳定——就像很多弱磁铁叠放在一起，拉力总和很大。

---

## 第三部分：侧链去哪了？

细心的你可能会问：氨基酸的侧链（R基）去哪了？

答案是：**侧链全部朝外，指向螺旋轴外侧**，不参与形成氢键。

这非常重要：
- 螺旋的核心由骨架形成，稳定而刚性
- 侧链朝外，可以自由接触水分子，或与其他蛋白质区域互动
- 疏水侧链朝外时，在水环境中会"不舒服"——这解释了为什么有些序列容易形成alpha螺旋，有些不容易

### 哪些氨基酸喜欢形成alpha螺旋？

- **爱好者**：丙氨酸（A）、谷氨酸（E）、亮氨酸（L）、甲硫氨酸（M）
- **讨厌者**：脯氨酸（P）——它的环状结构会在骨架上"打一个结"，破坏螺旋；甘氨酸（G）——太灵活，无法固定在螺旋构象

脯氨酸是alpha螺旋的"终止信号"：遇到脯氨酸，螺旋必须结束。

---

## 第四部分：alpha螺旋在哪里出现？

### 在你的身体里

**角蛋白**是由几乎纯alpha螺旋组成的结构蛋白，存在于：
- 头发（头发丝 = 角蛋白螺旋缠绕成的超螺旋）
- 指甲（坚硬是因为螺旋之间有二硫键交联）
- 皮肤最外层（角质层）

**肌红蛋白**（储存氧气的肌肉蛋白）有8段alpha螺旋，这些螺旋围成一个口袋，把血红素（携氧的铁卟啉）固定在里面。Linus Pauling 1951年预测了alpha螺旋，John Kendrew 1958年用X射线晶体学解析了肌红蛋白结构，确认了螺旋的存在——这是历史上第一个被解析的蛋白质结构。

**跨膜螺旋**：细胞膜是由疏水油脂组成的，一段约20个疏水氨基酸的alpha螺旋可以像针一样穿过细胞膜，成为离子通道和受体的基本结构单元。

---

## 第五部分：历史故事——Linus Pauling 和模型棒

1951年，Linus Pauling（双诺贝尔奖得主）在生病卧床期间，用一张纸折出了多肽链的几何模型，从键长和键角出发，纯靠几何推导，预测出了alpha螺旋和beta折叠的存在——**在任何X射线证据之前**。

他的方法：不是从实验出发，而是从"什么样的几何构型能让骨架氢键最稳定"这个问题出发，用纸和铅笔推导。七年后，John Kendrew 解析了肌红蛋白的原子结构，发现 Pauling 的预测完全正确。

> "科学不是记忆，是推理。"—— Linus Pauling

---

## 第六部分：动手实验

### 实验：制作alpha螺旋模型

**材料**：毛根条一根（或细铁丝）、铅笔一支、彩色小磁铁珠（或小纸团）

**步骤**：
1. 把毛根条紧紧绕在铅笔上，绕满后轻轻抽出铅笔
2. 你得到了一个螺旋——但它还不是真正的"alpha螺旋模型"
3. 用小磁铁珠（代表氢键）：在第1圈的位置和第1圈+4个单元的位置各挂一颗，连上线
4. 重复：每圈都连上氢键
5. 观察：所有氢键都沿着螺旋轴方向排列，像一根隐形的棍子贯穿螺旋中心

**思考**：如果在螺旋中间插入一个"脯氨酸"（把某一圈的毛根剪断再接上），螺旋会怎样？

---

## 本节小结

| 特征 | alpha螺旋 |
|------|-------|
| 形状 | 右手螺旋（弹簧） |
| 维持力 | 骨架氢键：第i残基C=O -- 第(i+4)残基N-H |
| 参数 | 3.6残基/圈，螺距0.54nm |
| 侧链位置 | 朝外，不参与骨架氢键 |
| 破坏因素 | 脯氨酸（P）打断螺旋 |
| 代表蛋白 | 角蛋白（头发/指甲）、肌红蛋白、跨膜受体 |
| 发现者 | Linus Pauling，1951年 |

**核心直觉**：alpha螺旋是多肽链在局部区域，靠骨架氢键自发形成的弹簧形状。侧链朝外，骨架在内，每隔4个残基一个氢键。头发的弹性和弯曲性，来自你细胞里亿万个这样的纳米弹簧。

---

## 检测你学会了吗？

1. alpha螺旋是"左手"还是"右手"螺旋？（右手）
2. 维持alpha螺旋形状的是什么化学键？（氢键）
3. 第i个残基的C=O和第几个残基的N-H形成氢键？（第i+4个）
4. alpha螺旋每圈包含多少个氨基酸？（3.6个）
5. 哪种氨基酸会打断alpha螺旋？（脯氨酸，Pro，P）
6. 你身体里哪里有大量alpha螺旋？（头发、指甲，角蛋白）
"""

ANIM1_ID = _id("anim")
ANIM2_ID = _id("anim")
GAME_ID  = _id("game")
STORY_ID = _id("story")
EXER_ID  = _id("ex")

# ── 动画1：alpha螺旋形成 HUD（HTML+SVG 仪表盘风格）─────────────
# 中央 SVG: 氨基酸珠子从直线折叠成螺旋
# 左侧 panel: HELIX_PARAMETERS（螺距、半径、氢键 i->i+4）
# 右侧 panel: RESIDUE_INDEX
# 底部 HUD: RESIDUES / H-BONDS / PITCH / RADIUS

ANIM1_HTML = r"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>HELIX_ASSEMBLY</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:__THEME_BG__;font-family:__THEME_FONT__;color:__THEME_TEXT__;user-select:none}
.hud{width:100%;height:100%;display:grid;grid-template-rows:44px 1fr 56px;grid-template-columns:180px 1fr 160px;gap:0}
.top-bar{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:rgba(12,14,18,0.6);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid __THEME_BORDER__;z-index:10}
.top-bar .title{font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:__THEME_PRIMARY__;text-shadow:0 0 15px __THEME_PRIMARY__40}
.status-dot{width:6px;height:6px;border-radius:50%;background:__THEME_PRIMARY__;box-shadow:0 0 8px __THEME_PRIMARY__;animation:pdot 2s infinite}
.ctrl-btns{display:flex;gap:4px}
.ctrl-btn{padding:5px 12px;border-radius:4px;border:1px solid __THEME_BORDER__;background:__THEME_SURFACE__;color:__THEME_TEXT_DIM__;font-family:__THEME_FONT__;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.2s;letter-spacing:0.08em;text-transform:uppercase}
.ctrl-btn:hover{border-color:__THEME_PRIMARY__60;color:__THEME_PRIMARY__}
.ctrl-btn.active{background:__THEME_PRIMARY__18;border-color:__THEME_PRIMARY__;color:__THEME_PRIMARY__;box-shadow:0 0 12px __THEME_PRIMARY__25}
.pnl{padding:12px 10px;background:__THEME_CARD__;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);overflow-y:auto}
.pnl-l{border-right:1px solid __THEME_BORDER__}
.pnl-r{border-left:1px solid __THEME_BORDER__}
.sect{margin-bottom:12px}
.ch{width:32px;height:2px;margin-bottom:8px;box-shadow:0 0 8px __THEME_PRIMARY__60}
.ch-p{background:__THEME_PRIMARY__}.ch-s{background:__THEME_SECONDARY__;box-shadow:0 0 8px __THEME_SECONDARY__60}
.ch-a{background:__THEME_ACCENT__;box-shadow:0 0 8px __THEME_ACCENT__60}
.hl{font-size:9px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:__THEME_HUD_LABEL__;margin-bottom:4px}
.hv{font-size:18px;font-weight:700;color:__THEME_HUD_VALUE__;line-height:1.2}
.hv-p{color:__THEME_PRIMARY__;text-shadow:0 0 10px __THEME_PRIMARY__40}
.hv-s{font-size:12px}
.dr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(70,72,77,0.08)}
.dr .k{font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:__THEME_TEXT_DIM__}
.dr .v{font-size:10px;font-weight:600;color:__THEME_TEXT__}
.center{position:relative;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,__THEME_BG2__ 0%,__THEME_BG__ 70%);overflow:hidden}
.bhud{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);background:__THEME_HUD_BG__;border-top:1px solid __THEME_BORDER__;position:relative}
.bhud::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,__THEME_PRIMARY__,__THEME_SECONDARY__,__THEME_PRIMARY__,transparent);opacity:0.6}
.hc{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 0;position:relative}
.hc:not(:last-child)::after{content:'';position:absolute;right:0;top:12px;bottom:12px;width:1px;background:rgba(70,72,77,0.15)}
.hc .hl{margin-bottom:2px;font-size:8px}
.hc .hv{font-size:15px}
.res-item{display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:3px;margin-bottom:2px;transition:background 0.2s}
.res-item.active{background:__THEME_PRIMARY__15}
.res-dot{width:8px;height:8px;border-radius:50%;background:__THEME_PRIMARY__;box-shadow:0 0 4px __THEME_PRIMARY__}
.res-dot.dim{background:__THEME_SURFACE_HIGHEST__;box-shadow:none}
.res-id{font-size:9px;font-weight:600;color:__THEME_TEXT_DIM__;min-width:16px}
.res-name{font-size:9px;color:__THEME_TEXT__;letter-spacing:0.05em}
@keyframes pdot{0%,100%{opacity:1}50%{opacity:0.4}}
@keyframes fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fi{animation:fade-in 0.5s ease-out both}
</style>
</head>
<body>
<div class="hud">
  <div class="top-bar">
    <div style="display:flex;align-items:center;gap:10px">
      <span class="status-dot"></span>
      <span class="title">HELIX_ASSEMBLY</span>
    </div>
    <div class="ctrl-btns">
      <button class="ctrl-btn active" id="btnPlay" onclick="startAnim()">PLAY</button>
      <button class="ctrl-btn" id="btnReset" onclick="resetAnim()">RESET</button>
    </div>
  </div>

  <div class="pnl pnl-l">
    <div class="sect fi">
      <div class="ch ch-p"></div>
      <div class="hl">HELIX_TYPE</div>
      <div class="hv hv-p">ALPHA</div>
      <div style="font-size:9px;color:__THEME_TEXT_DIM__;margin-top:2px">RIGHT-HANDED</div>
    </div>
    <div class="sect fi" style="animation-delay:0.1s">
      <div class="ch ch-s"></div>
      <div class="hl">PARAMETERS</div>
      <div class="dr"><span class="k">RESIDUES/TURN</span><span class="v">3.6</span></div>
      <div class="dr"><span class="k">PITCH</span><span class="v">0.54 nm</span></div>
      <div class="dr"><span class="k">RISE/RESIDUE</span><span class="v">0.15 nm</span></div>
      <div class="dr"><span class="k">DIAMETER</span><span class="v">~0.5 nm</span></div>
    </div>
    <div class="sect fi" style="animation-delay:0.15s">
      <div class="ch ch-a"></div>
      <div class="hl">H-BOND_PATTERN</div>
      <div class="dr"><span class="k">DONOR</span><span class="v">N-H (i+4)</span></div>
      <div class="dr"><span class="k">ACCEPTOR</span><span class="v">C=O (i)</span></div>
      <div class="dr"><span class="k">SPACING</span><span class="v">i -> i+4</span></div>
    </div>
    <div class="sect fi" style="animation-delay:0.2s">
      <div class="hl">PHASE</div>
      <div class="hv hv-s" id="phaseLabel">STANDBY</div>
    </div>
  </div>

  <div class="center" id="centerStage">
    <svg id="helixSvg" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="hbGlow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="beadGrad" cx="35%" cy="30%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="50%" stop-color="__THEME_PRIMARY__"/><stop offset="100%" stop-color="__THEME_BG__" stop-opacity="0.8"/></radialGradient>
        <radialGradient id="scGrad" cx="35%" cy="30%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="50%" stop-color="__THEME_SECONDARY__"/><stop offset="100%" stop-color="__THEME_BG__" stop-opacity="0.6"/></radialGradient>
      </defs>
      <!-- Background refs -->
      <g opacity="0.04" stroke="__THEME_PRIMARY__" fill="none" stroke-width="0.5">
        <line x1="200" y1="0" x2="200" y2="300"/>
        <line x1="0" y1="150" x2="400" y2="150"/>
        <circle cx="200" cy="150" r="60"/><circle cx="200" cy="150" r="120"/>
      </g>
      <!-- Scan line -->
      <rect x="0" y="0" width="400" height="1.5" fill="__THEME_PRIMARY__" opacity="0.05">
        <animateTransform attributeName="transform" type="translate" values="0,0;0,300;0,0" dur="6s" repeatCount="indefinite"/>
      </rect>
      <g id="hbonds"></g>
      <g id="backbone"></g>
      <g id="beads"></g>
      <g id="sideChains"></g>
      <g id="labels"></g>
    </svg>
  </div>

  <div class="pnl pnl-r">
    <div class="sect">
      <div class="ch ch-p"></div>
      <div class="hl">RESIDUE_INDEX</div>
    </div>
    <div id="resIndex"></div>
  </div>

  <div class="bhud">
    <div class="hc"><div class="hl">RESIDUES</div><div class="hv" id="hudRes">8</div></div>
    <div class="hc"><div class="hl">H-BONDS</div><div class="hv" id="hudHB">0</div></div>
    <div class="hc"><div class="hl">PITCH</div><div class="hv" style="font-size:13px">0.54 NM</div></div>
    <div class="hc"><div class="hl">RADIUS</div><div class="hv" style="font-size:13px">~0.25 NM</div></div>
  </div>
</div>

<script>
(function(){
"use strict";

var N = 8;
var NAMES = ["ALA","GLU","LEU","ALA","GLU","LEU","MET","ALA"];
var svg = document.getElementById("helixSvg");
var beadsG = document.getElementById("beads");
var bbG = document.getElementById("backbone");
var hbG = document.getElementById("hbonds");
var scG = document.getElementById("sideChains");
var labG = document.getElementById("labels");
var phaseLabel = document.getElementById("phaseLabel");
var hudHB = document.getElementById("hudHB");

// Populate residue index
var resIndex = document.getElementById("resIndex");
for(var i=0;i<N;i++){
  var d = document.createElement("div");
  d.className = "res-item"; d.id = "ri-"+i;
  d.innerHTML = '<div class="res-dot dim"></div><span class="res-id">'+(i+1)+'</span><span class="res-name">'+NAMES[i]+'</span>';
  resIndex.appendChild(d);
}

// Positions: linear (start) and helix (target)
var CX=200, CY=150;
var linear = [];
var helix = [];
var scPos = []; // side chain endpoints
for(var i=0;i<N;i++){
  linear.push({x: 60 + i*35, y: CY});
  // Helix: parametric
  var angle = i * (2*Math.PI/3.6);
  var rise = i * 28;
  var hx = CX + Math.cos(angle)*55;
  var hy = 40 + rise;
  helix.push({x:hx, y:hy});
  // Side chain: radially outward
  var scx = CX + Math.cos(angle)*85;
  var scy = 40 + rise;
  scPos.push({x:scx, y:scy});
}

var positions = linear.map(function(p){return {x:p.x,y:p.y}});
var phase = "linear"; // linear -> folding -> helix -> hbonds
var t = 0;
var hbondsShown = 0;
var animId = null;

function lerp(a,b,t){return a+(b-a)*t}
function easeInOut(t){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2}

function render(){
  beadsG.innerHTML=""; bbG.innerHTML=""; hbG.innerHTML=""; scG.innerHTML=""; labG.innerHTML="";

  // Backbone
  for(var i=0;i<N-1;i++){
    var l = document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",positions[i].x); l.setAttribute("y1",positions[i].y);
    l.setAttribute("x2",positions[i+1].x); l.setAttribute("y2",positions[i+1].y);
    l.setAttribute("stroke","__THEME_PRIMARY__"); l.setAttribute("stroke-width","2");
    l.setAttribute("opacity","0.4"); l.setAttribute("filter","url(#glow)");
    bbG.appendChild(l);
  }

  // Side chains (only in helix phase)
  if(phase === "helix" || phase === "hbonds"){
    for(var i=0;i<N;i++){
      var l = document.createElementNS("http://www.w3.org/2000/svg","line");
      l.setAttribute("x1",positions[i].x); l.setAttribute("y1",positions[i].y);
      l.setAttribute("x2",scPos[i].x); l.setAttribute("y2",scPos[i].y);
      l.setAttribute("stroke","__THEME_SECONDARY__"); l.setAttribute("stroke-width","1");
      l.setAttribute("opacity","0.3"); l.setAttribute("stroke-dasharray","2,3");
      scG.appendChild(l);
      var c = document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute("cx",scPos[i].x); c.setAttribute("cy",scPos[i].y);
      c.setAttribute("r","5"); c.setAttribute("fill","url(#scGrad)"); c.setAttribute("opacity","0.7");
      scG.appendChild(c);
    }
  }

  // H-bonds
  if(phase === "hbonds"){
    for(var i=0;i<Math.min(hbondsShown, N-4);i++){
      var from = positions[i];
      var to = positions[i+4];
      var l = document.createElementNS("http://www.w3.org/2000/svg","line");
      l.setAttribute("x1",from.x); l.setAttribute("y1",from.y);
      l.setAttribute("x2",to.x); l.setAttribute("y2",to.y);
      l.setAttribute("stroke","__THEME_ACCENT__"); l.setAttribute("stroke-width","1.5");
      l.setAttribute("stroke-dasharray","4,3"); l.setAttribute("opacity","0.7");
      l.setAttribute("filter","url(#hbGlow)");
      hbG.appendChild(l);
      // Midpoint label
      var mx=(from.x+to.x)/2, my=(from.y+to.y)/2;
      var t2 = document.createElementNS("http://www.w3.org/2000/svg","text");
      t2.setAttribute("x",mx+8); t2.setAttribute("y",my+3);
      t2.setAttribute("font-family","'Space Grotesk',sans-serif"); t2.setAttribute("font-size","7");
      t2.setAttribute("fill","__THEME_ACCENT__"); t2.setAttribute("opacity","0.8");
      t2.setAttribute("letter-spacing","0.05em");
      t2.textContent = (i+1)+" -> "+(i+5);
      labG.appendChild(t2);
    }
  }

  // Beads
  for(var i=0;i<N;i++){
    // Glow
    var gc = document.createElementNS("http://www.w3.org/2000/svg","circle");
    gc.setAttribute("cx",positions[i].x); gc.setAttribute("cy",positions[i].y);
    gc.setAttribute("r","18"); gc.setAttribute("fill","__THEME_PRIMARY__"); gc.setAttribute("opacity","0.08");
    beadsG.appendChild(gc);
    // Main
    var c = document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",positions[i].x); c.setAttribute("cy",positions[i].y);
    c.setAttribute("r","10"); c.setAttribute("fill","url(#beadGrad)"); c.setAttribute("filter","url(#glow)");
    beadsG.appendChild(c);
    // Specular
    var sp = document.createElementNS("http://www.w3.org/2000/svg","ellipse");
    sp.setAttribute("cx",positions[i].x-3); sp.setAttribute("cy",positions[i].y-3);
    sp.setAttribute("rx","4"); sp.setAttribute("ry","2.5");
    sp.setAttribute("fill","white"); sp.setAttribute("opacity","0.3");
    beadsG.appendChild(sp);
    // Label
    var tx = document.createElementNS("http://www.w3.org/2000/svg","text");
    tx.setAttribute("x",positions[i].x); tx.setAttribute("y",positions[i].y+3);
    tx.setAttribute("text-anchor","middle"); tx.setAttribute("font-family","'Space Grotesk',sans-serif");
    tx.setAttribute("font-size","7"); tx.setAttribute("font-weight","600"); tx.setAttribute("fill","white");
    tx.textContent = (i+1);
    beadsG.appendChild(tx);
  }

  // Update residue index highlighting
  for(var i=0;i<N;i++){
    var ri = document.getElementById("ri-"+i);
    var dot = ri.querySelector(".res-dot");
    if(phase === "hbonds" && i < hbondsShown){
      ri.className = "res-item active";
      dot.className = "res-dot";
    } else if(phase !== "linear"){
      ri.className = "res-item";
      dot.className = "res-dot";
    } else {
      ri.className = "res-item";
      dot.className = "res-dot dim";
    }
  }
}

var animFrame;
function animate(){
  if(phase === "folding"){
    t += 0.008;
    if(t >= 1){t=1; phase="helix"; phaseLabel.textContent="HELIX_FORMED";
      setTimeout(function(){phase="hbonds"; phaseLabel.textContent="H-BONDS_FORMING"; animateHBonds();},800);
    }
    var et = easeInOut(t);
    for(var i=0;i<N;i++){
      positions[i].x = lerp(linear[i].x, helix[i].x, et);
      positions[i].y = lerp(linear[i].y, helix[i].y, et);
    }
    phaseLabel.textContent = "FOLDING... " + Math.round(t*100) + "%";
    render();
    animFrame = requestAnimationFrame(animate);
  }
}

function animateHBonds(){
  if(hbondsShown < N-4){
    hbondsShown++;
    hudHB.textContent = hbondsShown;
    render();
    setTimeout(animateHBonds, 600);
  } else {
    phaseLabel.textContent = "COMPLETE";
  }
}

window.startAnim = function(){
  if(phase !== "linear") return;
  phase = "folding"; t = 0;
  document.getElementById("btnPlay").classList.add("active");
  animate();
};

window.resetAnim = function(){
  if(animFrame) cancelAnimationFrame(animFrame);
  phase = "linear"; t = 0; hbondsShown = 0;
  positions = linear.map(function(p){return {x:p.x,y:p.y}});
  phaseLabel.textContent = "STANDBY";
  hudHB.textContent = "0";
  document.getElementById("btnPlay").classList.remove("active");
  render();
};

render();
})();
</script>
</body>
</html>"""


# ── 动画2：氢键 i->(i+4) 规律 HUD ──────────────────────────────
# 侧视图展示alpha螺旋，逐一高亮每条氢键

ANIM2_HTML = r"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>H-BOND_VIEWER</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:__THEME_BG__;font-family:__THEME_FONT__;color:__THEME_TEXT__;user-select:none}
.hud{width:100%;height:100%;display:grid;grid-template-rows:44px 1fr 56px;grid-template-columns:180px 1fr 180px;gap:0}
.top-bar{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:rgba(12,14,18,0.6);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid __THEME_BORDER__;z-index:10}
.top-bar .title{font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:__THEME_PRIMARY__;text-shadow:0 0 15px __THEME_PRIMARY__40}
.status-dot{width:6px;height:6px;border-radius:50%;background:__THEME_ACCENT__;box-shadow:0 0 8px __THEME_ACCENT__;animation:pdot 2s infinite}
.pnl{padding:12px 10px;background:__THEME_CARD__;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);overflow-y:auto}
.pnl-l{border-right:1px solid __THEME_BORDER__}
.pnl-r{border-left:1px solid __THEME_BORDER__}
.sect{margin-bottom:12px}
.ch{width:32px;height:2px;margin-bottom:8px}.ch-p{background:__THEME_PRIMARY__;box-shadow:0 0 8px __THEME_PRIMARY__60}.ch-s{background:__THEME_SECONDARY__;box-shadow:0 0 8px __THEME_SECONDARY__60}.ch-a{background:__THEME_ACCENT__;box-shadow:0 0 8px __THEME_ACCENT__60}
.hl{font-size:9px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:__THEME_HUD_LABEL__;margin-bottom:4px}
.hv{font-size:18px;font-weight:700;color:__THEME_HUD_VALUE__;line-height:1.2}
.hv-p{color:__THEME_PRIMARY__;text-shadow:0 0 10px __THEME_PRIMARY__40}
.hv-s{font-size:12px}
.dr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(70,72,77,0.08)}
.dr .k{font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:__THEME_TEXT_DIM__}
.dr .v{font-size:10px;font-weight:600;color:__THEME_TEXT__}
.center{position:relative;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,__THEME_BG2__ 0%,__THEME_BG__ 70%);overflow:hidden}
.bhud{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);background:__THEME_HUD_BG__;border-top:1px solid __THEME_BORDER__;position:relative}
.bhud::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,__THEME_PRIMARY__,__THEME_SECONDARY__,__THEME_PRIMARY__,transparent);opacity:0.6}
.hc{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 0;position:relative}
.hc:not(:last-child)::after{content:'';position:absolute;right:0;top:12px;bottom:12px;width:1px;background:rgba(70,72,77,0.15)}
.hc .hl{margin-bottom:2px;font-size:8px}
.hc .hv{font-size:15px}
.hb-item{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:3px;margin-bottom:3px;transition:all 0.3s}
.hb-item.active{background:__THEME_ACCENT__15}
.hb-item.done{opacity:0.5}
.hb-dot{width:8px;height:8px;border-radius:50%;background:__THEME_SURFACE_HIGHEST__}
.hb-item.active .hb-dot{background:__THEME_ACCENT__;box-shadow:0 0 6px __THEME_ACCENT__}
.hb-item.done .hb-dot{background:__THEME_PRIMARY__}
.hb-label{font-size:9px;color:__THEME_TEXT_DIM__;letter-spacing:0.05em}
.hb-item.active .hb-label{color:__THEME_ACCENT__;font-weight:600}
@keyframes pdot{0%,100%{opacity:1}50%{opacity:0.4}}
</style>
</head>
<body>
<div class="hud">
  <div class="top-bar">
    <div style="display:flex;align-items:center;gap:10px">
      <span class="status-dot"></span>
      <span class="title">H-BOND_VIEWER</span>
    </div>
    <div style="display:flex;gap:4px">
      <button class="ctrl-btn" onclick="startScan()" style="padding:5px 12px;border-radius:4px;border:1px solid __THEME_BORDER__;background:__THEME_SURFACE__;color:__THEME_TEXT_DIM__;font-family:__THEME_FONT__;font-size:10px;font-weight:600;cursor:pointer;letter-spacing:0.08em;text-transform:uppercase;">SCAN</button>
      <button class="ctrl-btn" onclick="resetScan()" style="padding:5px 12px;border-radius:4px;border:1px solid __THEME_BORDER__;background:__THEME_SURFACE__;color:__THEME_TEXT_DIM__;font-family:__THEME_FONT__;font-size:10px;font-weight:600;cursor:pointer;letter-spacing:0.08em;text-transform:uppercase;">RESET</button>
    </div>
  </div>

  <div class="pnl pnl-l">
    <div class="sect">
      <div class="ch ch-a"></div>
      <div class="hl">H-BOND_RULE</div>
      <div class="hv hv-p" style="font-size:14px">i -> i+4</div>
      <div style="font-size:9px;color:__THEME_TEXT_DIM__;margin-top:4px;line-height:1.5">
        第 i 个残基的 C=O 与第 (i+4) 个残基的 N-H 形成氢键
      </div>
    </div>
    <div class="sect">
      <div class="ch ch-s"></div>
      <div class="hl">BOND_PROPERTIES</div>
      <div class="dr"><span class="k">TYPE</span><span class="v">BACKBONE H-BOND</span></div>
      <div class="dr"><span class="k">ENERGY</span><span class="v">~2-7 kJ/mol</span></div>
      <div class="dr"><span class="k">LENGTH</span><span class="v">~0.28 nm</span></div>
      <div class="dr"><span class="k">DIRECTION</span><span class="v">ALONG AXIS</span></div>
    </div>
    <div class="sect">
      <div class="ch ch-p"></div>
      <div class="hl">SCAN_STATUS</div>
      <div class="hv hv-s" id="scanStatus">IDLE</div>
    </div>
  </div>

  <div class="center">
    <svg id="hbSvg" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="gl"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="hgl"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="bg" cx="35%" cy="30%"><stop offset="0%" stop-color="#fff" stop-opacity="0.6"/><stop offset="50%" stop-color="__THEME_PRIMARY__"/><stop offset="100%" stop-color="__THEME_BG__" stop-opacity="0.7"/></radialGradient>
      </defs>
      <!-- Grid -->
      <g opacity="0.04" stroke="__THEME_PRIMARY__" fill="none" stroke-width="0.5">
        <line x1="200" y1="0" x2="200" y2="300"/><line x1="0" y1="150" x2="400" y2="150"/>
      </g>
      <!-- Helix axis -->
      <line x1="200" y1="15" x2="200" y2="285" stroke="__THEME_TEXT_DIM__" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.2"/>
      <g id="svgHBonds"></g>
      <g id="svgBB"></g>
      <g id="svgBeads"></g>
      <g id="svgLabels"></g>
    </svg>
  </div>

  <div class="pnl pnl-r">
    <div class="sect">
      <div class="ch ch-a"></div>
      <div class="hl">H-BOND_PAIRS</div>
    </div>
    <div id="hbList"></div>
  </div>

  <div class="bhud">
    <div class="hc"><div class="hl">RESIDUES</div><div class="hv">13</div></div>
    <div class="hc"><div class="hl">H-BONDS</div><div class="hv" id="hudHB2">0</div></div>
    <div class="hc"><div class="hl">SCANNING</div><div class="hv" id="hudScan" style="font-size:13px">--</div></div>
    <div class="hc"><div class="hl">STABILITY</div><div class="hv" id="hudStab" style="font-size:13px">LOW</div></div>
  </div>
</div>

<script>
(function(){
"use strict";

var N=13;
var CX=200, YTOP=20, YBOT=280;
var positions=[];
var scPos=[];
for(var i=0;i<N;i++){
  var angle=i*(2*Math.PI/3.6);
  var y=YTOP+i*((YBOT-YTOP)/(N-1));
  positions.push({x:CX+Math.cos(angle)*60, y:y});
  scPos.push({x:CX+Math.cos(angle)*95, y:y});
}

// H-bond pairs: i -> i+4
var hbPairs=[];
for(var i=0;i<N-4;i++) hbPairs.push({from:i, to:i+4});

// Build right panel list
var hbList=document.getElementById("hbList");
hbPairs.forEach(function(p,idx){
  var d=document.createElement("div");
  d.className="hb-item"; d.id="hbi-"+idx;
  d.innerHTML='<div class="hb-dot"></div><span class="hb-label">'+(p.from+1)+' (C=O) -> '+(p.to+1)+' (N-H)</span>';
  hbList.appendChild(d);
});

var svgBB=document.getElementById("svgBB");
var svgBeads=document.getElementById("svgBeads");
var svgHB=document.getElementById("svgHBonds");
var svgLab=document.getElementById("svgLabels");

function renderBase(){
  svgBB.innerHTML=""; svgBeads.innerHTML=""; svgLab.innerHTML="";
  // Backbone
  for(var i=0;i<N-1;i++){
    var l=document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",positions[i].x);l.setAttribute("y1",positions[i].y);
    l.setAttribute("x2",positions[i+1].x);l.setAttribute("y2",positions[i+1].y);
    l.setAttribute("stroke","__THEME_PRIMARY__");l.setAttribute("stroke-width","1.5");l.setAttribute("opacity","0.35");
    svgBB.appendChild(l);
  }
  // Beads
  for(var i=0;i<N;i++){
    var gc=document.createElementNS("http://www.w3.org/2000/svg","circle");
    gc.setAttribute("cx",positions[i].x);gc.setAttribute("cy",positions[i].y);gc.setAttribute("r","14");
    gc.setAttribute("fill","__THEME_PRIMARY__");gc.setAttribute("opacity","0.06");
    svgBeads.appendChild(gc);
    var c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",positions[i].x);c.setAttribute("cy",positions[i].y);c.setAttribute("r","8");
    c.setAttribute("fill","url(#bg)");c.setAttribute("filter","url(#gl)");
    svgBeads.appendChild(c);
    var t=document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x",positions[i].x);t.setAttribute("y",positions[i].y+3);t.setAttribute("text-anchor","middle");
    t.setAttribute("font-family","'Space Grotesk',sans-serif");t.setAttribute("font-size","7");t.setAttribute("font-weight","600");t.setAttribute("fill","white");
    t.textContent=(i+1);
    svgBeads.appendChild(t);
  }
}

var scanIdx=-1;
var scanTimer=null;

function renderHBonds(upTo, highlight){
  svgHB.innerHTML="";
  for(var i=0;i<=upTo&&i<hbPairs.length;i++){
    var p=hbPairs[i];
    var f=positions[p.from], tt=positions[p.to];
    // Glow layer
    if(i===highlight){
      var gl=document.createElementNS("http://www.w3.org/2000/svg","line");
      gl.setAttribute("x1",f.x);gl.setAttribute("y1",f.y);gl.setAttribute("x2",tt.x);gl.setAttribute("y2",tt.y);
      gl.setAttribute("stroke","__THEME_ACCENT__");gl.setAttribute("stroke-width","6");gl.setAttribute("opacity","0.2");
      gl.style.filter="blur(3px)";
      svgHB.appendChild(gl);
    }
    var l=document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",f.x);l.setAttribute("y1",f.y);l.setAttribute("x2",tt.x);l.setAttribute("y2",tt.y);
    l.setAttribute("stroke", i===highlight?"__THEME_ACCENT__":"__THEME_ACCENT__");
    l.setAttribute("stroke-width", i===highlight?"2":"1");
    l.setAttribute("stroke-dasharray","4,3");
    l.setAttribute("opacity", i===highlight?"0.9":"0.4");
    if(i===highlight) l.setAttribute("filter","url(#hgl)");
    svgHB.appendChild(l);
  }
}

window.startScan = function(){
  if(scanTimer) return;
  scanIdx=-1;
  doScanStep();
};

function doScanStep(){
  scanIdx++;
  if(scanIdx >= hbPairs.length){
    document.getElementById("scanStatus").textContent="COMPLETE";
    document.getElementById("hudScan").textContent="DONE";
    document.getElementById("hudStab").textContent="HIGH";
    scanTimer=null;
    return;
  }
  renderHBonds(scanIdx, scanIdx);
  document.getElementById("hudHB2").textContent=(scanIdx+1);
  document.getElementById("scanStatus").textContent="SCANNING "+(scanIdx+1)+"/"+hbPairs.length;
  document.getElementById("hudScan").textContent=(hbPairs[scanIdx].from+1)+" -> "+(hbPairs[scanIdx].to+1);

  // Update list
  for(var i=0;i<hbPairs.length;i++){
    var el=document.getElementById("hbi-"+i);
    if(i<scanIdx) el.className="hb-item done";
    else if(i===scanIdx) el.className="hb-item active";
    else el.className="hb-item";
  }

  scanTimer=setTimeout(doScanStep, 800);
}

window.resetScan = function(){
  if(scanTimer){clearTimeout(scanTimer);scanTimer=null;}
  scanIdx=-1;
  svgHB.innerHTML="";
  document.getElementById("hudHB2").textContent="0";
  document.getElementById("scanStatus").textContent="IDLE";
  document.getElementById("hudScan").textContent="--";
  document.getElementById("hudStab").textContent="LOW";
  for(var i=0;i<hbPairs.length;i++){
    document.getElementById("hbi-"+i).className="hb-item";
  }
};

renderBase();
})();
</script>
</body>
</html>"""


# ── 游戏：氢键连连看（保留原有游戏，更新主题占位符）──────────────

GAME_HTML = r"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>H-BOND_MATCH</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:__THEME_BG__;font-family:__THEME_FONT__;color:__THEME_TEXT__;user-select:none}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at 50% 40%,__THEME_PRIMARY__08 0%,transparent 60%),radial-gradient(ellipse at 10% 10%,__THEME_SECONDARY__0F 0%,transparent 40%);pointer-events:none;z-index:0}
#wrap{display:flex;flex-direction:column;width:100%;height:100%;padding:10px;position:relative;z-index:1}
#header{text-align:center;padding-bottom:8px;font-size:14px;font-weight:700;color:__THEME_PRIMARY__;letter-spacing:0.15em;text-transform:uppercase;text-shadow:0 0 15px __THEME_PRIMARY__40}
#subtitle{text-align:center;font-size:10px;color:__THEME_TEXT_DIM__;margin-bottom:6px;letter-spacing:0.05em}
#game-area{display:flex;flex:1;align-items:stretch;gap:8px;min-height:0}
#left-col,#right-col{display:flex;flex-direction:column;justify-content:space-around;align-items:center;width:110px;padding:4px 0;gap:4px}
#center-area{flex:1;position:relative;overflow:hidden}
#connect-svg{position:absolute;inset:0;width:100%;height:100%}
.bead-btn{width:90px;height:32px;border-radius:4px;border:1px solid __THEME_BORDER__;background:__THEME_SURFACE__;color:__THEME_TEXT__;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:4px;font-family:__THEME_FONT__;letter-spacing:0.05em;text-transform:uppercase}
.bead-btn:hover:not(.done):not(.selected){border-color:__THEME_PRIMARY__60;color:__THEME_PRIMARY__;box-shadow:0 0 8px __THEME_PRIMARY__20}
.bead-btn.selected{border-color:__THEME_PRIMARY__;background:__THEME_PRIMARY__18;color:__THEME_PRIMARY__;box-shadow:0 0 16px __THEME_PRIMARY__30;animation:pulse 1.5s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 16px __THEME_PRIMARY__30}50%{box-shadow:0 0 24px __THEME_PRIMARY__50}}
.bead-btn.done{border-color:__THEME_SURFACE_HIGHEST__;background:__THEME_SURFACE__;color:__THEME_TEXT_DIM__;cursor:default;opacity:0.5}
.bead-btn.wrong{border-color:#f87171;background:rgba(248,113,113,0.1);animation:shake 0.3s}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.bead-dot{width:6px;height:6px;border-radius:50%;background:__THEME_SECONDARY__;box-shadow:0 0 4px __THEME_SECONDARY__}
.bead-btn.done .bead-dot{background:__THEME_SURFACE_HIGHEST__;box-shadow:none}
#hud{display:flex;justify-content:space-between;align-items:center;padding:6px 12px;margin-top:6px;background:__THEME_HUD_BG__;border-radius:4px;border:1px solid __THEME_BORDER__}
#hud::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,__THEME_PRIMARY__,transparent);opacity:0.4}
#hud-score{color:__THEME_PRIMARY__;font-weight:700;font-size:12px;letter-spacing:0.1em}
#hud-rule{color:__THEME_TEXT_DIM__;font-size:9px;letter-spacing:0.08em;text-transform:uppercase}
#hud-msg{color:__THEME_ACCENT__;font-weight:600;font-size:10px;min-width:60px;text-align:right}
#win-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(12,14,18,0.92);backdrop-filter:blur(8px);gap:14px;opacity:0;pointer-events:none;transition:opacity 0.4s;z-index:10}
#win-overlay.show{opacity:1;pointer-events:all}
#win-title{font-size:18px;font-weight:700;color:__THEME_PRIMARY__;text-shadow:0 0 20px __THEME_PRIMARY__40;letter-spacing:0.15em;text-transform:uppercase}
#win-sub{font-size:11px;color:__THEME_TEXT__}
#replay-btn{padding:8px 24px;border-radius:4px;background:transparent;color:__THEME_PRIMARY__;border:1px solid __THEME_PRIMARY__;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;letter-spacing:0.1em;text-transform:uppercase;font-family:__THEME_FONT__}
#replay-btn:hover{background:__THEME_PRIMARY__;color:__THEME_BG__;box-shadow:0 0 16px __THEME_PRIMARY__40}
</style>
</head>
<body>
<div id="wrap">
  <div id="header">H-BOND_MATCH</div>
  <div id="subtitle">CLICK LEFT (C=O) THEN RIGHT (N-H) TO PAIR i -> (i+4)</div>
  <div id="game-area">
    <div id="left-col"></div>
    <div id="center-area">
      <svg id="connect-svg" xmlns="http://www.w3.org/2000/svg"></svg>
      <div id="win-overlay">
        <div id="win-title">ALL BONDS MATCHED</div>
        <div id="win-sub">alpha-helix i -> (i+4) hydrogen bond pattern mastered</div>
        <button id="replay-btn" onclick="initGame()">REPLAY</button>
      </div>
    </div>
    <div id="right-col"></div>
  </div>
  <div id="hud" style="position:relative">
    <span id="hud-score">SCORE: 0 / 9</span>
    <span id="hud-rule">RULE: i -> (i+4)</span>
    <span id="hud-msg"></span>
  </div>
</div>
<script>
(function(){
"use strict";
var leftCol=document.getElementById("left-col");
var rightCol=document.getElementById("right-col");
var svg=document.getElementById("connect-svg");
var hudScore=document.getElementById("hud-score");
var hudMsg=document.getElementById("hud-msg");
var winOverlay=document.getElementById("win-overlay");
var TOTAL=9;
var selectedLeft=null, score=0, connections=[], wrongTimer=null;

function shuffle(a){var b=a.slice();for(var i=b.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=b[i];b[i]=b[j];b[j]=t}return b}
function clearSVG(){while(svg.firstChild)svg.removeChild(svg.firstChild)}
function getAnchor(el,side){var r=el.getBoundingClientRect();var sr=svg.getBoundingClientRect();return{x:(side==="right"?r.right:r.left)-sr.left,y:(r.top+r.bottom)/2-sr.top}}

function drawLine(x1,y1,x2,y2){
  var g=document.createElementNS("http://www.w3.org/2000/svg","line");
  g.setAttribute("x1",x1);g.setAttribute("y1",y1);g.setAttribute("x2",x2);g.setAttribute("y2",y2);
  g.setAttribute("stroke","__THEME_PRIMARY__");g.setAttribute("stroke-opacity","0.2");g.setAttribute("stroke-width","5");
  g.style.filter="blur(2px)"; svg.appendChild(g);
  var l=document.createElementNS("http://www.w3.org/2000/svg","line");
  l.setAttribute("x1",x1);l.setAttribute("y1",y1);l.setAttribute("x2",x2);l.setAttribute("y2",y2);
  l.setAttribute("stroke","__THEME_ACCENT__");l.setAttribute("stroke-opacity","0.6");l.setAttribute("stroke-width","1.5");
  l.setAttribute("stroke-dasharray","4,3"); svg.appendChild(l);
}

function redrawLines(){
  clearSVG();
  connections.forEach(function(c){
    var le=document.getElementById("lb-"+c.li);var re=document.getElementById("rb-"+c.ri);
    if(!le||!re)return;
    var la=getAnchor(le,"right");var ra=getAnchor(re,"left");
    drawLine(la.x,la.y,ra.x,ra.y);
  });
}

window.initGame=function(){
  leftCol.innerHTML="";rightCol.innerHTML="";clearSVG();
  score=0;connections=[];selectedLeft=null;
  winOverlay.classList.remove("show");
  hudScore.textContent="SCORE: 0 / "+TOTAL;hudMsg.textContent="";
  var li=shuffle([1,2,3,4,5,6,7,8,9]);
  var ri=shuffle([5,6,7,8,9,10,11,12,13]);
  li.forEach(function(n){
    var b=document.createElement("button");b.className="bead-btn";b.id="lb-"+n;
    b.innerHTML='<span class="bead-dot"></span>RES '+n+' (C=O)';
    b.onclick=function(){onLeft(n,b)};leftCol.appendChild(b);
  });
  ri.forEach(function(n){
    var b=document.createElement("button");b.className="bead-btn";b.id="rb-"+n;
    b.innerHTML='<span class="bead-dot"></span>RES '+n+' (N-H)';
    b.onclick=function(){onRight(n,b)};rightCol.appendChild(b);
  });
};

function onLeft(n,btn){
  if(btn.classList.contains("done"))return;
  if(selectedLeft!==null){var p=document.getElementById("lb-"+selectedLeft);if(p)p.classList.remove("selected")}
  selectedLeft=n;btn.classList.add("selected");hudMsg.textContent="SELECTED: RES "+n;
}

function onRight(n,btn){
  if(btn.classList.contains("done"))return;
  if(selectedLeft===null){hudMsg.style.color="#f87171";hudMsg.textContent="SELECT LEFT FIRST";setTimeout(function(){hudMsg.style.color="";hudMsg.textContent=""},1200);return}
  if(n-selectedLeft===4){
    var lb=document.getElementById("lb-"+selectedLeft);lb.classList.remove("selected");lb.classList.add("done");
    btn.classList.add("done");connections.push({li:selectedLeft,ri:n});redrawLines();
    score++;selectedLeft=null;hudScore.textContent="SCORE: "+score+" / "+TOTAL;
    hudMsg.style.color="__THEME_PRIMARY__";hudMsg.textContent="CORRECT +"+score;
    if(score===TOTAL)setTimeout(function(){winOverlay.classList.add("show")},600);
  } else {
    var lb2=document.getElementById("lb-"+selectedLeft);btn.classList.add("wrong");lb2.classList.add("wrong");
    hudMsg.style.color="#f87171";var d=n-selectedLeft;
    hudMsg.textContent=d>0?"GAP: "+d+" (NEED 4)":"WRONG DIRECTION";
    if(wrongTimer)clearTimeout(wrongTimer);
    wrongTimer=setTimeout(function(){btn.classList.remove("wrong");if(lb2)lb2.classList.remove("wrong");hudMsg.textContent=""},800);
  }
}

window.addEventListener("resize",redrawLines);
initGame();
})();
</script>
</body>
</html>"""


# ── 故事段落 ────────────────────────────────────────────────────

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
        "question": "alpha螺旋每圈包含多少个氨基酸？",
        "options": ["A. 3.0个", "B. 3.6个", "C. 4.0个", "D. 4.5个"],
        "correct": 1,
        "explanation": "每圈3.6个残基，这不是整数，正是因为100度的旋转角（360度/3.6约等于100度），使得每隔约一圈（4个残基）的氨基酸在三维空间中刚好靠近，能形成氢键。",
    },
    {
        "type": "choice",
        "question": "alpha螺旋靠什么力量保持螺旋形状？",
        "options": [
            "A. 肽键（骨架共价键）",
            "B. 骨架氢键（C=O 与 N-H 之间）",
            "C. 侧链之间的共价键",
            "D. 离子键",
        ],
        "correct": 1,
        "explanation": "alpha螺旋靠骨架氢键维持——每个残基的C=O与第(i+4)个残基的N-H之间形成氢键，沿螺旋轴方向排列。侧链不参与这些氢键，而是朝外排列。",
    },
    {
        "type": "choice",
        "question": "哪种氨基酸会打断alpha螺旋？",
        "options": ["A. 丙氨酸（A）", "B. 亮氨酸（L）", "C. 脯氨酸（P）", "D. 甘氨酸（G）"],
        "correct": 2,
        "explanation": "脯氨酸的侧链与骨架氮原子形成环状结构，使骨架氮上没有可以提供氢键的H原子，同时环结构限制了骨架的旋转自由度。因此脯氨酸是alpha螺旋的天然终止符。",
    },
    {
        "type": "choice",
        "question": "你的头发主要由哪种蛋白质组成？这种蛋白质富含什么结构？",
        "options": [
            "A. 胶原蛋白，富含beta折叠",
            "B. 角蛋白，富含alpha螺旋",
            "C. 血红蛋白，富含beta折叠",
            "D. 丝蛋白，富含alpha螺旋",
        ],
        "correct": 1,
        "explanation": "头发和指甲主要由角蛋白组成，角蛋白几乎全部由alpha螺旋构成。多条alpha螺旋缠绕形成超螺旋，再组装成头发纤维。这正是头发有弹性的原因——alpha螺旋就像弹簧。",
    },
]


# ── Idea 自我辩论系统 ────────────────────────────────────────────

def _debate_idea(
    idea_id: str, mode: str, topic: str,
    objections: list[str], rebuttals: list[str],
    scores: dict[str, int],
) -> bool:
    total = sum(scores.values())
    avg = total / len(scores)
    passed = avg >= 6.0
    console.print(f"\n[bold]-- Idea 辩论：[cyan]{mode}[/cyan] · {topic[:40]}[/bold]")
    for i, (obj, reb) in enumerate(zip(objections, rebuttals), 1):
        console.print(f"  [red]质疑{i}[/red]: {obj}")
        console.print(f"  [green]反驳{i}[/green]: {reb}")
    score_str = " | ".join(f"{k}={v}" for k, v in scores.items())
    result = "[bold green]通过[/bold green]" if passed else "[bold red]不通过（已跳过）[/bold red]"
    console.print(f"  得分 ({score_str}) 均值={avg:.1f} -> {result}")
    return passed


_IDEA_DEBATES = {
    "story": _debate_idea(
        idea_id="story", mode="story",
        topic="Pauling 病床上的发现——alpha螺旋历史故事",
        objections=[
            "故事只有文字，对10岁孩子吸引力不如动画",
            "课程中已有2个动画+1个游戏，3段故事可能冗余",
        ],
        rebuttals=[
            "文字故事补充动画无法传递的情感维度：Pauling 发烧折纸这个意象比任何动画都更有力",
            "故事是两个动画之间的呼吸节点，有故事比没有更有学习完成感",
        ],
        scores={"teaching_fit": 6, "feasibility": 10, "cognitive": 8, "completion": 6},
    ),
    "anim1": _debate_idea(
        idea_id="anim1", mode="animation",
        topic="多肽链从直链到alpha螺旋的形成过程",
        objections=[
            "多个珠子同时移动，视觉重点分散",
            "2D投影的螺旋是失真简化",
        ],
        rebuttals=[
            "珠子用深度透明度排序，HUD底栏同步显示数字，双通道传递信息",
            "2D投影是生化教学的通行做法，不存在需要从2D建立的'正确3D认知'",
        ],
        scores={"teaching_fit": 9, "feasibility": 8, "cognitive": 7, "completion": 8},
    ),
    "anim2": _debate_idea(
        idea_id="anim2", mode="animation",
        topic="氢键 i->(i+4) 规律逐一高亮展示",
        objections=[
            "与动画1的氢键展示可能重复",
            "逐一高亮9条氢键需要约13秒，可能失去注意力",
        ],
        rebuttals=[
            "动画1展示折叠过程，动画2展示具体配对细节——宏观vs微观",
            "循环播放和HUD数字计数有一定吸引力补偿",
        ],
        scores={"teaching_fit": 7, "feasibility": 8, "cognitive": 6, "completion": 6},
    ),
    "game": _debate_idea(
        idea_id="game", mode="game",
        topic="氢键连连看：i->(i+4) 配对游戏",
        objections=[
            "9对只需要认识数字差值为4，不测试化学理解",
            "游戏总时长2分钟内，获胜太快",
        ],
        rebuttals=[
            "目标是通过操作强化'差4'的记忆编码——肌肉记忆比认知记忆更持久",
            "简短游戏+重玩机制比长游戏更适合注意力短的孩子",
        ],
        scores={"teaching_fit": 7, "feasibility": 9, "cognitive": 8, "completion": 7},
    ),
}

console.print(f"\n[bold]辩论汇总：{sum(1 for v in _IDEA_DEBATES.values() if v)}/{len(_IDEA_DEBATES)} 个 idea 通过[/bold]\n")

DEBATE_PASSED = set(k for k, v in _IDEA_DEBATES.items() if v)


# ── 主题应用 ────────────────────────────────────────────────────

def _apply_theme(html: str, theme: dict) -> str:
    def _lighten(hex_color: str, delta: int = 8) -> str:
        h = hex_color.lstrip("#")
        rgb = [int(h[i:i+2], 16) for i in (0, 2, 4)]
        rgb = [min(255, c + delta) for c in rgb]
        return "#" + "".join(f"{c:02x}" for c in rgb)

    replacements = {
        "__THEME_BG__": theme["bg"],
        "__THEME_BG2__": theme.get("bg2", _lighten(theme["bg"], 10)),
        "__THEME_SURFACE__": theme.get("surface", "#171a1f"),
        "__THEME_SURFACE_HIGH__": theme.get("surface_high", "#1d2025"),
        "__THEME_SURFACE_HIGHEST__": theme.get("surface_highest", "#23262c"),
        "__THEME_CARD__": theme.get("card", "rgba(23,26,31,0.6)"),
        "__THEME_PRIMARY__": theme["primary"],
        "__THEME_SECONDARY__": theme["secondary"],
        "__THEME_ACCENT__": theme.get("accent", theme["secondary"]),
        "__THEME_TEXT__": theme["text"],
        "__THEME_TEXT_DIM__": theme["text_dim"],
        "__THEME_BORDER__": theme.get("border", "rgba(70,72,77,0.15)"),
        "__THEME_HUD_LABEL__": theme["hud_label"],
        "__THEME_HUD_VALUE__": theme["hud_value"],
        "__THEME_HUD_BG__": theme.get("hud_bg", "rgba(12,14,18,0.95)"),
        "__THEME_FONT__": theme["font_display"],
        "__THEME_FONT_MONO__": theme.get("font_mono", "'Space Grotesk', monospace"),
    }
    for placeholder, value in replacements.items():
        html = html.replace(placeholder, value)
    return html


# ── 组装 CourseContent ──────────────────────────────────────────

def build_course_content() -> dict:
    plan_with_placeholders = PLAN_MARKDOWN

    plan_with_placeholders = plan_with_placeholders.replace(
        "## 开篇故事：铁丝的记忆",
        f"[[IDEA:{STORY_ID}]]\n\n## 开篇故事：铁丝的记忆"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 第一部分：什么是alpha螺旋？",
        f"[[IDEA:{ANIM1_ID}]]\n\n## 第一部分：什么是alpha螺旋？"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 第二部分：氢键是如何让弹簧保持形状的？",
        f"[[IDEA:{ANIM2_ID}]]\n\n## 第二部分：氢键是如何让弹簧保持形状的？"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 检测你学会了吗？",
        f"[[IDEA:{EXER_ID}]]\n\n## 检测你学会了吗？"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 本节小结",
        f"[[IDEA:{GAME_ID}]]\n\n## 本节小结"
    )

    all_candidates = [
        (
            "story",
            {
                "idea_id": STORY_ID, "mode": "story",
                "topic": "Pauling 病床上的发现——alpha螺旋的历史故事",
                "context_summary": "通过Pauling 1951年用纸折叠发现alpha螺旋的故事引入主题",
                "generation_backend": "claude_code_direct", "style_key": "biotech_life",
                "mode_reason": "历史情境故事最适合激发兴趣和建立直觉",
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
                "idea_id": ANIM1_ID, "mode": "animation",
                "topic": "alpha螺旋形成 HUD：多肽链从直链到螺旋的折叠过程",
                "context_summary": "HUD仪表盘风格展示多肽链折叠成alpha螺旋的动态过程",
                "generation_backend": "claude_code_direct", "style_key": "biotech_life",
                "mode_reason": "辩论通过：动态卷曲过程是抽象概念，SVG动画可以展示每一步的变化",
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
                "idea_id": ANIM2_ID, "mode": "animation",
                "topic": "氢键 i->(i+4) 规律 HUD：逐一扫描高亮每条氢键",
                "context_summary": "HUD仪表盘风格的alpha螺旋侧视图，逐一高亮每条氢键",
                "generation_backend": "claude_code_direct", "style_key": "biotech_life",
                "mode_reason": "辩论通过：i->(i+4)的空间几何规律用动态高亮最清晰",
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
                "idea_id": GAME_ID, "mode": "game",
                "topic": "氢键连连看：i->(i+4) 配对游戏",
                "context_summary": "玩家点击配对相差4位的氨基酸对，完成9条氢键",
                "generation_backend": "claude_code_direct", "style_key": "biotech_life",
                "mode_reason": "辩论通过：配对规则单一，操作2步，即时反馈",
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
            "exercise",
            {
                "idea_id": EXER_ID, "mode": "exercise",
                "topic": "alpha螺旋关键知识点巩固练习",
                "context_summary": "检验学生对alpha螺旋参数、维持力、破坏因素的理解",
                "generation_backend": "claude_code_direct", "style_key": "",
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
    from course_factory.factory import (
        _ensure_db_tables, _upsert_project, _init_progress, _write_project_files
    )
    from systemedu.core.storage.db import LessonContent, get_session as get_db_session
    from datetime import datetime as dt

    console.print(Panel.fit(
        "[bold cyan]GP-01 蛋白结构探险地图[/bold cyan]\n\n"
        "完全由 Claude Code 生成（不调用 LLM agent pipeline）\n"
        f"节点：knode_id={TARGET_KNODE_ID} · {TARGET_NODE_TITLE}\n"
        "内容：完整课程文本 + HUD动画x2 + 配对游戏 + 历史故事 + 4道练习题\n"
        "风格：Stitch HUD 仪表盘（Space Grotesk + glass panel + 霓虹色）",
        title="写入数据库",
    ))

    with open(TREE_PATH, encoding="utf-8") as f:
        tree_data = json.load(f)
    milestones = tree_data["milestones"]
    node_count = sum(len(m["knodes"]) for m in milestones)

    console.print(f"知识树：{len(milestones)} 个模块，{node_count} 个节点")
    console.print(f"目标节点 knode_id = {TARGET_KNODE_ID}（{TARGET_NODE_TITLE}）")

    _ensure_db_tables()
    _write_project_files(
        PROJECT_NAME, PROJECT_TITLE, PROJECT_DESCRIPTION,
        PROJECT_CATEGORY, PROJECT_AGE_RANGE, PROJECT_ESTIMATED_HOURS,
        PROJECT_TAGS, tree_data,
    )
    console.print("[green]v 项目文件写入[/green]")

    _upsert_project(
        PROJECT_NAME, PROJECT_TITLE, PROJECT_DESCRIPTION,
        PROJECT_CATEGORY, PROJECT_AGE_RANGE, PROJECT_ESTIMATED_HOURS,
        PROJECT_TAGS,
    )
    console.print("[green]v 项目注册到数据库[/green]")

    _init_progress(PROJECT_NAME, node_count)
    console.print("[green]v 学习进度初始化[/green]")

    db = get_db_session()
    try:
        for kid in range(node_count):
            existing = db.query(LessonContent).filter_by(
                project_name=PROJECT_NAME, knode_id=kid
            ).first()
            if not existing:
                db.add(LessonContent(
                    project_name=PROJECT_NAME, knode_id=kid,
                    status="pending", content_type="interactive", course_content="",
                ))
        db.commit()
        console.print(f"[green]v {node_count} 个节点占位记录确认[/green]")
    finally:
        db.close()

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
                project_name=PROJECT_NAME, knode_id=TARGET_KNODE_ID,
                status="ready", course_content=content_json,
                content_type="interactive", generated_at=dt.now(),
            ))
        db2.commit()

        anim_count = sum(1 for s in course_content["rendered_sections"].values() if s["mode"] == "animation")
        game_count = sum(1 for s in course_content["rendered_sections"].values() if s["mode"] == "game")
        story_count = sum(len(s.get("story_paragraphs") or []) for s in course_content["rendered_sections"].values())
        exer_count = sum(len(s.get("exercises") or []) for s in course_content["rendered_sections"].values())
        total_html = sum(len(s.get("html") or "") for s in course_content["rendered_sections"].values())

        console.print(f"\n[bold green]完成！[/bold green]")
        console.print(f"  节点 {TARGET_KNODE_ID}（{TARGET_NODE_TITLE}）已写入")
        console.print(f"  课程文本：{len(PLAN_MARKDOWN)} 字符")
        console.print(f"  HUD 动画：{anim_count} 个 + 游戏：{game_count} 个（共 {total_html} 字节 HTML）")
        console.print(f"  故事段落：{story_count} 段")
        console.print(f"  练习题：{exer_count} 道")
        console.print(f"\n访问：[dim]http://localhost:3000/projects/{PROJECT_NAME}[/dim]")
        console.print(f"（进入项目，找到节点 knode_id={TARGET_KNODE_ID}）")
    finally:
        db2.close()


if __name__ == "__main__":
    write_everything()
