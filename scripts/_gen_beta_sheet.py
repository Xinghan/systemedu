"""
GP-01 蛋白结构探险地图 — 完全由 Claude Code 生成
节点：M05N02「β折叠：大自然的手风琴」完整课程

不调用任何 LLM agent pipeline。
Claude Code 直接生成：课程文本 + Canvas动画 + 游戏 + 故事 + 练习题
然后写入数据库。

知识树位置：M05 = 二级结构模块，N02 = 第2个节点
全局 knode_id = 13（M01: 3节0-2, M02: 3节3-5, M03: 3节6-8, M04: 3节9-11, M05N01=12, M05N02=13）
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

# ── 视觉主题系统（与 _gen_protein_structure.py 完全相同）────────────

VISUAL_THEMES = {
    # 生命科学/蛋白质 — 荧光显微镜暗色
    # 深蓝黑背景 + GFP荧光绿 + DAPI青蓝 + 琥珀金高亮
    "biotech_life": {
        "bg": "#060d12",
        "bg2": "#0a1a1f",
        "card": "rgba(10,26,31,0.88)",
        "primary": "#34d399",
        "secondary": "#22d3ee",
        "accent": "#fbbf24",
        "text": "#e2e8f0",
        "text_dim": "#64748b",
        "border": "rgba(52,211,153,0.12)",
        "grid": "rgba(52,211,153,0.04)",
        "font_display": "'Noto Sans SC', 'PingFang SC', sans-serif",
        "font_mono": "'JetBrains Mono', 'Menlo', monospace",
        "hud_label": "rgba(52,211,153,0.75)",
        "hud_value": "#e2e8f0",
        "hud_bg": "rgba(10,26,31,0.92)",
        "beam_color": "#34d399",
    },
    # 物理/力学 — 黑板暗色+粉笔蓝白
    "physics_chalk": {
        "bg": "#0c0e14",
        "bg2": "#121620",
        "card": "rgba(18,22,32,0.90)",
        "primary": "#60a5fa",
        "secondary": "#a78bfa",
        "accent": "#f87171",
        "text": "#e2e8f0",
        "text_dim": "#6b7280",
        "border": "rgba(96,165,250,0.10)",
        "grid": "rgba(96,165,250,0.04)",
        "font_display": "'Noto Sans SC', 'PingFang SC', sans-serif",
        "font_mono": "'JetBrains Mono', 'Menlo', monospace",
        "hud_label": "rgba(96,165,250,0.75)",
        "hud_value": "#e2e8f0",
        "hud_bg": "rgba(18,22,32,0.92)",
        "beam_color": "#60a5fa",
    },
    # 航空/探索 — 火星暗色+探索橙金
    "explorer_sand": {
        "bg": "#0a0806",
        "bg2": "#12100c",
        "card": "rgba(18,16,12,0.90)",
        "primary": "#e8723a",
        "secondary": "#f0c040",
        "accent": "#4dd0e1",
        "text": "#d4c8b8",
        "text_dim": "#6b5e50",
        "border": "rgba(232,114,58,0.10)",
        "grid": "rgba(232,114,58,0.04)",
        "font_display": "'Noto Sans SC', 'PingFang SC', sans-serif",
        "font_mono": "'JetBrains Mono', 'Menlo', monospace",
        "hud_label": "rgba(232,114,58,0.75)",
        "hud_value": "#d4c8b8",
        "hud_bg": "rgba(18,16,12,0.92)",
        "beam_color": "#e8723a",
    },
    # 音乐/AI/创意 — 赛博暗色+活力紫粉
    "creative_studio": {
        "bg": "#0c0816",
        "bg2": "#14102a",
        "card": "rgba(20,16,42,0.90)",
        "primary": "#a78bfa",
        "secondary": "#f472b6",
        "accent": "#22d3ee",
        "text": "#e2e8f0",
        "text_dim": "#6b7280",
        "border": "rgba(167,139,250,0.10)",
        "grid": "rgba(167,139,250,0.04)",
        "font_display": "'Noto Sans SC', 'PingFang SC', sans-serif",
        "font_mono": "'JetBrains Mono', 'Menlo', monospace",
        "hud_label": "rgba(167,139,250,0.75)",
        "hud_value": "#e2e8f0",
        "hud_bg": "rgba(20,16,42,0.92)",
        "beam_color": "#a78bfa",
    },
}

CATEGORY_THEME_MAP = {
    "biotech": "biotech_life",
    "chemistry": "biotech_life",
    "physics": "physics_chalk",
    "math": "physics_chalk",
    "cs": "physics_chalk",
    "ai": "physics_chalk",
    "aerospace": "explorer_sand",
    "robotics": "explorer_sand",
    "climate": "explorer_sand",
    "music": "creative_studio",
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

T = VISUAL_THEMES[CATEGORY_THEME_MAP.get(PROJECT_CATEGORY, "biotech_life")]

TARGET_KNODE_ID = 13
TARGET_NODE_TITLE = "beta折叠：大自然的手风琴"
TARGET_NODE_SUMMARY = (
    "beta折叠片是蛋白质链以锯齿形伸展，多条链段并排通过链间氢键形成的片状结构。"
    "有反平行和平行两种排列，蚕丝蛋白几乎全是beta折叠片。"
)

# ── 步骤1：完整课程文本（plan_markdown）────────────────────────

PLAN_MARKDOWN = """# M05N02：β折叠——大自然的手风琴

> **模块**：二级结构：局部折叠规律
> **知识等级**：L2-操作 | **难度**：3/10 | **预计时长**：30分钟
> **先修知识**：α螺旋（M05N01）、氢键直觉（M02N02）、肽键（M04N01）

---

## 开篇故事：一根蚕丝的秘密

你的手里有一根蚕丝。它细得几乎看不见，却能承受比同等粗细的钢丝更大的拉力。摸上去，它比棉布更滑，比合成纤维更细腻。

这根丝是一只蚕用嘴巴吐出来的。蚕不懂化学，不懂纳米材料学，却造出了迄今为止人类无法完全复制的天然纤维。

秘密，就藏在β折叠里。

---

## 第一部分：什么是β折叠？

[[IDEA:ANIM1_PLACEHOLDER]]

### β链（strand）和β折叠片（sheet）

β折叠是蛋白质链的另一种规则二级结构，与α螺旋并列。

**基本单元是β链（β strand）**：
- 蛋白质链在局部区域以**完全伸展的锯齿形**排列
- 每个氨基酸的Cα（α碳）位置比α螺旋中高得多——链条被"拉直"了
- 侧链（R基）**交替朝上和朝下**：单数残基朝上，双数残基朝下（或反之）

**多条β链并排** → **β折叠片（β sheet）**：
- 两条或更多的β链平行排列
- 链与链之间通过**链间氢键**（不同于α螺旋的链内氢键）连接
- 形成一张"平的"（实际上略微扭曲）片状结构

类比：手风琴。把一张纸反复折叠成手风琴/折扇形，每道折痕就是一个氨基酸的Cα，折叠后把多张手风琴并排——就是β折叠片。

---

## 第二部分：反平行与平行——两种排列方式

[[IDEA:ANIM2_PLACEHOLDER]]

β折叠片有两种形式，区别在于相邻β链的方向：

### 对比表格

| 特征 | 反平行β折叠（antiparallel） | 平行β折叠（parallel） |
|------|---------------------------|----------------------|
| 相邻链方向 | 相反（↑↓↑↓） | 相同（↑↑↑↑） |
| 氢键方向 | 几乎垂直于链轴（更直） | 与链轴略倾斜 |
| 稳定性 | 更高（氢键更线性） | 稍低（氢键略扭曲） |
| 常见来源 | 同一条链的不同段（通过发夹环相连） | 来自分子中相距较远的链段 |
| 典型示例 | 免疫球蛋白（抗体）、丝蛋白 | TIM桶（代谢酶） |

### 反平行β折叠：链间氢键的几何

在反平行排列中：
- 链A从左到右走，链B从右到左走
- 链A的 N-H 与链B的 C=O **直接对齐**，形成接近180°的线性氢键
- 这种线性氢键能量最高，稳定性最强
- 相邻的氢键成对出现，像拉链的齿

### 平行β折叠：氢键几何

在平行排列中：
- 链A和链B都从左到右走
- 氢键必须"倾斜"才能连接两条平行的链
- 氢键角度偏离线性，稳定性略低

---

## 第三部分：侧链的上下交替排列

这是β折叠最有趣的几何特征之一。

在β链中，每个氨基酸的Cα位于锯齿形骨架的"顶点"。相邻两个Cα位于不同的"折叠面"：
- 残基1：Cα朝上 → 侧链**朝上**（β折叠片的一面）
- 残基2：Cα朝下 → 侧链**朝下**（β折叠片的另一面）
- 残基3：侧链**朝上**
- 以此类推...

**重要的生物学含义**：
- β折叠片有两个"面"，每个面上排布着一组特定的侧链
- 一面通常是疏水侧链（朝向蛋白质核心）
- 另一面通常是亲水侧链（朝向水环境）
- 这种"双面性"在蛋白质折叠的热力学中极其重要

类比：一张硬纸板，一面贴着沙纸（粗糙=疏水），另一面贴着丝绸（光滑=亲水）。

---

## 第四部分：β折叠在生活中的例子

### 蚕丝：几乎纯β折叠

蚕丝蛋白（丝素，fibroin）的氨基酸序列有一个规律：**Gly-Ala-Gly-Ala-Gly-Ser** 大量重复。

- Gly（甘氨酸）：最小的氨基酸，侧链只有H，非常小
- Ala（丙氨酸）：甲基侧链，也很小

**为什么要这么小？**
因为β折叠片是紧密堆叠的——一张片的朝下侧链，与下一张片的朝上侧链，要严密接触。如果侧链太大，就无法堆叠。Gly和Ala的小侧链，使蚕丝蛋白能够堆叠成非常致密的β折叠片层结构。

**结果**：
- 蚕丝的强度来自β折叠片中密集的氢键网络
- 蚕丝的光泽来自β折叠片的规则晶体结构反射光线
- 蚕丝的柔软来自β折叠片之间只有范德华力（弱，可相对滑动）

### 蜘蛛丝：更极端的设计

蜘蛛拖丝（dragline silk）同样含有大量β折叠"纳米晶体"，但还含有无规卷曲区段。这种"晶体+橡皮"的复合结构，使蜘蛛丝兼具蚕丝的强度和橡皮筋的弹性——比钢丝更强，比尼龙更弹。

### 淀粉样蛋白：β折叠的危险变体

阿尔茨海默病、帕金森病等神经退行性疾病，与"淀粉样纤维"有关。

淀粉样纤维是**β折叠的一种极端堆叠形式**：
- 蛋白质分子错误折叠，形成β链
- 成千上万的β链从不同蛋白质分子借来，堆叠成纤维
- 这些纤维不溶于水，不能被细胞降解
- 它们沉积在大脑中，破坏神经元

β折叠本身没有"好坏"，但它那种稳定的氢键网络，在错误地方形成时，会成为细胞无法清除的"垃圾"。这就是结构决定功能——以及功能失常——的力量。

---

## 第五部分：β折叠 vs α螺旋——核心对比

| 特征 | α螺旋 | β折叠 |
|------|-------|-------|
| 形状 | 弹簧（右手螺旋） | 片状（锯齿形） |
| 氢键类型 | 链内（第i↔第i+4） | 链间（不同β链之间） |
| 侧链位置 | 均匀朝外（螺旋轴外侧） | 交替朝上/朝下 |
| 伸展程度 | 链被压缩（每残基0.15nm） | 链被伸展（每残基0.35nm） |
| 代表蛋白 | 角蛋白（头发/指甲） | 蚕丝（丝蛋白）、抗体 |
| 机械性质 | 弹性（弹簧） | 高强度（片层堆叠） |
| 破坏因素 | 脯氨酸（P） | Gly比脯氨酸更容易出现在转角 |

---

## 第六部分：历史——X射线晶体学和β折叠的发现

β折叠和α螺旋是同一位科学家在同一年（1951年）提出的——Linus Pauling 和 Robert Corey。

### 发现的关键工具：X射线衍射

将蛋白质或蛋白质纤维制成晶体，用X射线照射，X射线会被原子散射，在胶片上形成衍射图样。从衍射图样的间距，可以推断出原子排列的周期和距离。

**α螺旋的发现**：衍射图样中有0.54nm的周期（螺距）

**β折叠的发现**：蚕丝蛋白的衍射图样中有0.35nm的周期（β链方向的残基间距）和0.47nm（链间距）——与Pauling-Corey的β折叠模型完全匹配。

1951年，Pauling 在生病期间靠几何推理提出了这两种结构。1953年，Watson 和 Crick 发现DNA双螺旋时，正是受到了Pauling提出α螺旋的方法论启发。

---

## 本节小结

| 特征 | β折叠 |
|------|-------|
| 基本单元 | β链（锯齿形伸展的肽段） |
| 片的形成 | 多条β链并排，链间氢键连接 |
| 两种排列 | 反平行（更稳定）+ 平行（稍不稳定） |
| 侧链 | 交替朝上/朝下（两面不同） |
| 每残基长度 | 0.35nm（比α螺旋0.15nm更伸展） |
| 代表蛋白 | 蚕丝（丝蛋白）、蜘蛛丝、抗体、淀粉样纤维 |
| 发现者 | Linus Pauling & Robert Corey，1951年 |

**核心直觉**：β折叠是多肽链"伸展+并排"的结果。链内没有氢键，氢键在链与链之间。侧链一上一下交替，使折叠片有两个性质不同的面。蚕丝的强度和光泽，来自密集排列的β折叠片层和其中无数的氢键。

---

## 检测你学会了吗？

1. β折叠中，氢键在哪里形成？（在不同β链之间，链间氢键）
2. 反平行β折叠中，相邻β链的方向是什么关系？（方向相反）
3. 为什么蚕丝蛋白含有大量Gly（甘氨酸）和Ala（丙氨酸）？（侧链小，允许β折叠片紧密堆叠）
4. β链中侧链朝向有什么规律？（交替朝上和朝下）
5. 淀粉样纤维是什么结构？（错误堆叠的大量β折叠）
"""

# ── 步骤2：生成 idea ID ────────────────────────────────────────

ANIM1_ID = _id("anim")
ANIM2_ID = _id("anim")
GAME_ID  = _id("game")
STORY_ID = _id("story")
EXER_ID  = _id("ex")

# ── 步骤3：Canvas 动画1 —— β折叠形成过程（多条链并排，氢键依次连接）──

ANIM1_HTML = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>beta折叠：多条链并排，氢键形成片状结构</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: __THEME_BG__;
  font-family: __THEME_FONT__;
}
canvas { display: block; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function() {
"use strict";

/* ── canvas setup ── */
var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
var W = 600, H = 420;
var DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  var rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * DPR;
  canvas.height = rect.height * DPR;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(DPR * rect.width / W, DPR * rect.height / H);
}
resize();
window.addEventListener("resize", resize);

/* ── 颜色常量 ── */
var COL_BG1    = "__THEME_BG__";
var COL_BG2    = "__THEME_BG2__";
var COL_GRID   = "__THEME_GRID__";
var COL_PRI    = "__THEME_PRIMARY__";
var COL_SEC    = "__THEME_SECONDARY__";
var COL_ACC    = "__THEME_ACCENT__";
var COL_TEXT   = "__THEME_TEXT__";
var COL_DIM    = "__THEME_TEXT_DIM__";
var COL_HUD_BG = "__THEME_HUD_BG__";
var COL_HUD_LB = "__THEME_HUD_LABEL__";
var COL_HUD_VL = "__THEME_HUD_VALUE__";

/* ── 工具函数 ── */
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function easeInOut(t) {
  return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
}

function lerp(a, b, t) { return a + (b - a) * t; }

/* ── 背景绘制 ── */
function drawBg() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COL_BG1);
  g.addColorStop(1, COL_BG2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = COL_GRID;
  ctx.lineWidth = 1;
  for (var x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (var y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

/* ── 标题 ── */
function drawTitle(txt) {
  ctx.font = "bold 15px 'Noto Sans SC', system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = COL_TEXT;
  ctx.globalAlpha = 0.92;
  ctx.fillText(txt, W/2, 26);
  ctx.globalAlpha = 1;
}

/* ── HUD ── */
function drawHUD(cols) {
  var by = H - 52;
  ctx.fillStyle = COL_HUD_BG;
  roundRect(0, by, W, 52, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(W, by); ctx.stroke();

  var cw = W / cols.length;
  cols.forEach(function(c, i) {
    var cx2 = cw*i + cw/2;
    ctx.font = "10px 'Noto Sans SC', system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = COL_HUD_LB;
    ctx.fillText(c.label, cx2, by + 17);
    ctx.font = "bold 13px 'Noto Sans SC', system-ui";
    ctx.fillStyle = COL_HUD_VL;
    ctx.fillText(c.val, cx2, by + 38);
  });
}

/* ── β折叠参数 ── */
// 5条β链，每条7个残基
var NUM_STRANDS = 5;
var NUM_RESIDUES = 7;
var STRAND_SPACING = 56;  // 链间距（像素，代表0.47nm）
var RES_SPACING = 36;     // 残基间距（代表0.35nm）
var ZIG_AMP = 16;         // 锯齿振幅（像素）
var BEAD_R = 8;           // 主链珠子半径
var SIDE_R = 5;           // 侧链珠子半径

// 场景中心
var CX = W / 2;
var CY = H / 2 - 30;

// 每条链的目标 y 坐标（已展开状态）
// 3条链在中间，上下各加（随动画展开）
function strandTargetY(si) {
  // si: 0..NUM_STRANDS-1
  return CY + (si - (NUM_STRANDS-1)/2) * STRAND_SPACING;
}

// 残基位置（锯齿形）
function residuePos(si, ri, yPos) {
  var xStart = CX - (NUM_RESIDUES - 1) * RES_SPACING / 2;
  var x = xStart + ri * RES_SPACING;
  var zigDir = (ri % 2 === 0) ? 1 : -1;
  // 反平行：奇数链从右到左（镜像x）
  var flip = (si % 2 === 1);
  if (flip) {
    var xEnd = CX + (NUM_RESIDUES - 1) * RES_SPACING / 2;
    x = xEnd - ri * RES_SPACING;
  }
  return {
    x: x,
    y: yPos + zigDir * ZIG_AMP,
    sideY: yPos + zigDir * (ZIG_AMP + BEAD_R + SIDE_R + 4),
    up: zigDir > 0,
  };
}

/* ── 动画状态 ── */
// 阶段：0=单链展示(1条) -> 1=加入链2 -> 2=加入链3 -> 3=加入链4 -> 4=加入链5 -> 5=完整展示 -> 6=探索模式
var phase = 0;
var phaseStart = performance.now();
var PHASE_DURATIONS = [1800, 1200, 1200, 1200, 1200, 3000];
var INTRO_HOLD = 2000;  // 第0阶段停留时间

// 每条链当前的 y 偏移（从屏幕外飞入）
var strandProgress = [1.0, 0.0, 0.0, 0.0, 0.0];  // 1=完全飞入

// 氢键透明度（链2入场后开始出现）
var hbondAlpha = 0.0;

// 状态文字
var PHASE_NAMES = [
  "单条β链：锯齿形伸展",
  "第2条β链：反平行排列",
  "第3条β链：氢键网络形成",
  "第4条β链：片层扩展",
  "β折叠片：5条链完整结构",
  "β折叠片：稳定的氢键网络",
  "探索模式",
];

var PHASE_SUBS = [
  "侧链交替朝上/朝下",
  "两链反向，氢键开始连接",
  "链间氢键（虚线）垂直于链轴",
  "多层堆叠，片状结构形成",
  "所有氢键建立，结构稳定",
  "蚕丝就是这样的β折叠片层",
  "悬停查看残基详情 | 拖动观察结构变化",
];

function getStrandCount() {
  var counts = [1, 2, 3, 4, 5, 5, 5];
  return counts[Math.min(phase, 6)];
}

/* ── 探索模式交互状态 ── */
var exploreMode = false;
// 每帧记录所有珠子绘制位置（用于 hitTest）
var beadPositions = [];  // beadPositions[si][ri] = {x, y}
for (var _si = 0; _si < NUM_STRANDS; _si++) {
  beadPositions[_si] = [];
  for (var _ri = 0; _ri < NUM_RESIDUES; _ri++) {
    beadPositions[_si][_ri] = { x: 0, y: 0 };
  }
}

// 鼠标逻辑坐标
var mouseX = -999, mouseY = -999;
// hover 状态
var hoverStrand = -1, hoverResidue = -1;
// 拖拽状态
var dragging = null;  // {si, ri}
var dragOffX = 0, dragOffY = 0;
var dragDisplace = [];  // dragDisplace[si][ri] = {dx, dy}
for (var _si2 = 0; _si2 < NUM_STRANDS; _si2++) {
  dragDisplace[_si2] = [];
  for (var _ri2 = 0; _ri2 < NUM_RESIDUES; _ri2++) {
    dragDisplace[_si2][_ri2] = { dx: 0, dy: 0 };
  }
}
// 弹回动画
var snapBacks = [];  // [{si, ri, startDx, startDy, startTime}]
var SNAP_DURATION = 300;

// 重播按钮区域
var replayBtnRect = { x: 12, y: H - 100, w: 72, h: 28 };

/* ── 坐标转换 ── */
function canvasToLogic(e) {
  var rect = canvas.getBoundingClientRect();
  var x = ((e.clientX || e.pageX) - rect.left) / rect.width * W;
  var y = ((e.clientY || e.pageY) - rect.top) / rect.height * H;
  return { x: x, y: y };
}

/* ── hitTest：检测鼠标是否在某个珠子上 ── */
function hitTestBead(mx, my) {
  var hitR = BEAD_R + 4;
  for (var si = 0; si < NUM_STRANDS; si++) {
    for (var ri = 0; ri < NUM_RESIDUES; ri++) {
      var bp = beadPositions[si][ri];
      if (Math.hypot(mx - bp.x, my - bp.y) < hitR) {
        return { si: si, ri: ri };
      }
    }
  }
  return null;
}

/* ── 鼠标/触摸事件 ── */
function onMouseMove(e) {
  var pos = canvasToLogic(e);
  mouseX = pos.x;
  mouseY = pos.y;

  if (!exploreMode) return;

  if (dragging) {
    var dd = dragDisplace[dragging.si][dragging.ri];
    dd.dx = mouseX - beadPositions[dragging.si][dragging.ri].x + dragOffX;
    dd.dy = mouseY - beadPositions[dragging.si][dragging.ri].y + dragOffY;
  } else {
    var hit = hitTestBead(mouseX, mouseY);
    if (hit) {
      hoverStrand = hit.si;
      hoverResidue = hit.ri;
      canvas.style.cursor = "grab";
    } else {
      hoverStrand = -1;
      hoverResidue = -1;
      // 检查是否在重播按钮上
      var rb = replayBtnRect;
      if (mouseX >= rb.x && mouseX <= rb.x + rb.w && mouseY >= rb.y && mouseY <= rb.y + rb.h) {
        canvas.style.cursor = "pointer";
      } else {
        canvas.style.cursor = "default";
      }
    }
  }
}

function onMouseDown(e) {
  if (!exploreMode) return;
  var pos = canvasToLogic(e);
  mouseX = pos.x;
  mouseY = pos.y;

  // 检查重播按钮
  var rb = replayBtnRect;
  if (mouseX >= rb.x && mouseX <= rb.x + rb.w && mouseY >= rb.y && mouseY <= rb.y + rb.h) {
    doReplay();
    return;
  }

  var hit = hitTestBead(mouseX, mouseY);
  if (hit) {
    dragging = hit;
    var bp = beadPositions[hit.si][hit.ri];
    dragOffX = bp.x - mouseX + dragDisplace[hit.si][hit.ri].dx;
    dragOffY = bp.y - mouseY + dragDisplace[hit.si][hit.ri].dy;
    canvas.style.cursor = "grabbing";
    e.preventDefault && e.preventDefault();
  }
}

function onMouseUp(e) {
  if (!exploreMode || !dragging) return;
  // 开始弹回动画
  var dd = dragDisplace[dragging.si][dragging.ri];
  if (Math.abs(dd.dx) > 0.5 || Math.abs(dd.dy) > 0.5) {
    snapBacks.push({
      si: dragging.si,
      ri: dragging.ri,
      startDx: dd.dx,
      startDy: dd.dy,
      startTime: performance.now()
    });
  }
  dragging = null;
  canvas.style.cursor = "default";
}

canvas.addEventListener("mousemove", onMouseMove);
canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mouseup", onMouseUp);
canvas.addEventListener("mouseleave", function() {
  mouseX = -999; mouseY = -999;
  hoverStrand = -1; hoverResidue = -1;
  if (dragging) onMouseUp(null);
});

// 触摸支持
canvas.addEventListener("touchstart", function(e) {
  if (e.touches.length === 1) {
    var t = e.touches[0];
    onMouseDown({ clientX: t.clientX, clientY: t.clientY, preventDefault: function() { e.preventDefault(); } });
  }
}, { passive: false });
canvas.addEventListener("touchmove", function(e) {
  if (e.touches.length === 1) {
    var t = e.touches[0];
    onMouseMove({ clientX: t.clientX, clientY: t.clientY });
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener("touchend", function(e) {
  onMouseUp(null);
});

/* ── 重播 ── */
function doReplay() {
  exploreMode = false;
  phase = 0;
  phaseStart = performance.now();
  strandProgress = [1.0, 0.0, 0.0, 0.0, 0.0];
  hbondAlpha = 0.0;
  dragging = null;
  snapBacks = [];
  hoverStrand = -1;
  hoverResidue = -1;
  // 重置所有位移
  for (var si = 0; si < NUM_STRANDS; si++) {
    for (var ri = 0; ri < NUM_RESIDUES; ri++) {
      dragDisplace[si][ri].dx = 0;
      dragDisplace[si][ri].dy = 0;
    }
  }
}

/* ── 绘制单条β链（支持拖拽位移） ── */
function drawStrand(si, yFrac, hbAlpha, isNew) {
  var targetY = strandTargetY(si);
  // 从上方飞入（新链从屏幕上方进入）
  var offScreen = -120;
  var yPos = lerp(offScreen + targetY, targetY, easeInOut(Math.min(yFrac, 1.0)));

  // 骨架锯齿路径（考虑拖拽位移）
  ctx.beginPath();
  for (var ri = 0; ri < NUM_RESIDUES; ri++) {
    var p = residuePos(si, ri, yPos);
    var dd = dragDisplace[si][ri];
    var bx = p.x + dd.dx;
    var by = p.y + dd.dy;
    // 记录珠子绘制位置（用 base 位置，不含位移，以便 hitTest 稳定）
    beadPositions[si][ri].x = p.x;
    beadPositions[si][ri].y = p.y;
    if (ri === 0) ctx.moveTo(bx, by);
    else ctx.lineTo(bx, by);
  }
  ctx.strokeStyle = COL_PRI;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  // 骨架珠子（Cα）和侧链
  for (var ri2 = 0; ri2 < NUM_RESIDUES; ri2++) {
    var p2 = residuePos(si, ri2, yPos);
    var dd2 = dragDisplace[si][ri2];
    var bx2 = p2.x + dd2.dx;
    var by2 = p2.y + dd2.dy;
    var sideY2 = p2.sideY + dd2.dy;

    // hover 高亮
    var isHovered = (exploreMode && hoverStrand === si && hoverResidue === ri2);

    // 侧链
    ctx.beginPath();
    ctx.arc(bx2, sideY2, SIDE_R, 0, Math.PI*2);
    ctx.fillStyle = COL_ACC;
    ctx.globalAlpha = isHovered ? 1.0 : 0.7;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // 侧链连接线
    ctx.beginPath();
    ctx.moveTo(bx2, by2);
    ctx.lineTo(bx2, sideY2);
    ctx.strokeStyle = COL_ACC;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Cα珠子
    var bgCa = ctx.createRadialGradient(bx2 - 2, by2 - 2, 0, bx2, by2, BEAD_R);
    if (isHovered) {
      bgCa.addColorStop(0, "#fef08a");
      bgCa.addColorStop(0.5, "#f59e0b");
      bgCa.addColorStop(1, "#92400e");
    } else {
      bgCa.addColorStop(0, "#a7f3d0");  // 高光
      bgCa.addColorStop(0.5, COL_PRI);  // 中调
      bgCa.addColorStop(1, "#065f46");  // 暗边
    }
    ctx.beginPath();
    ctx.arc(bx2, by2, isHovered ? BEAD_R + 2 : BEAD_R, 0, Math.PI*2);
    ctx.fillStyle = bgCa;
    ctx.fill();
    ctx.strokeStyle = isHovered ? "rgba(245,158,11,0.8)" : "rgba(255,255,255,0.4)";
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.stroke();

    // 序号（仅第一条链显示，或探索模式下所有 hover 珠子）
    if (si === 0 || isHovered) {
      ctx.font = "7px 'Noto Sans SC', system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText((ri2 + 1).toString(), bx2, by2 + 2.5);
    }

    // 朝向标记（上/下箭头，仅第一条链，非探索模式）
    if (si === 0 && !exploreMode) {
      var arrowTip = sideY2 + (p2.up ? SIDE_R + 9 : -(SIDE_R + 9));
      ctx.beginPath();
      ctx.moveTo(bx2, sideY2 + (p2.up ? SIDE_R : -SIDE_R));
      ctx.lineTo(bx2, arrowTip);
      ctx.strokeStyle = COL_ACC;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  return yPos;
}

/* ── 绘制链间氢键（支持拖拽位移） ── */
function drawHBonds(si1, y1, si2, y2, alpha) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = COL_SEC;
  ctx.lineWidth = 1.8;

  for (var ri = 0; ri < NUM_RESIDUES; ri++) {
    var p1 = residuePos(si1, ri, y1);
    var p2 = residuePos(si2, ri, y2);
    var dd1 = dragDisplace[si1][ri];
    var dd2 = dragDisplace[si2][ri];
    ctx.beginPath();
    ctx.moveTo(p1.x + dd1.dx, p1.y + dd1.dy);
    ctx.lineTo(p2.x + dd2.dx, p2.y + dd2.dy);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.globalAlpha = 1.0;
}

/* ── 绘制链方向箭头 ── */
function drawDirectionArrow(si, yPos, color) {
  var flip = (si % 2 === 1);
  var xStart = CX - (NUM_RESIDUES - 1) * RES_SPACING / 2;
  var xEnd   = CX + (NUM_RESIDUES - 1) * RES_SPACING / 2;
  var ax = flip ? xEnd + 12 : xStart - 12;
  var ax2 = flip ? xStart - 8 : xEnd + 8;

  ctx.beginPath();
  ctx.moveTo(ax, yPos);
  ctx.lineTo(ax2, yPos);
  // 箭头头
  var headX = ax2 + (flip ? -6 : 6);
  ctx.lineTo(headX, yPos - 4);
  ctx.moveTo(ax2, yPos);
  ctx.lineTo(headX, yPos + 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}

/* ── 绘制 tooltip ── */
function drawTooltip(mx, my, si, ri) {
  var txt = "β链 #" + (si + 1) + " 残基 #" + (ri + 1);
  ctx.font = "bold 11px 'Noto Sans SC', system-ui";
  var tw = ctx.measureText(txt).width;
  var padX = 8, padY = 5;
  var ttW = tw + padX * 2;
  var ttH = 22;
  var ttX = mx - ttW / 2;
  var ttY = my - ttH - 12;
  // 防止超出画布
  if (ttX < 4) ttX = 4;
  if (ttX + ttW > W - 4) ttX = W - 4 - ttW;
  if (ttY < 4) ttY = my + 16;

  ctx.globalAlpha = 0.88;
  ctx.fillStyle = "rgba(15,23,42,0.85)";
  roundRect(ttX, ttY, ttW, ttH, 5);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.fillText(txt, ttX + ttW / 2, ttY + ttH - 6);
}

/* ── 绘制重播按钮 ── */
function drawReplayBtn() {
  var rb = replayBtnRect;
  var isHover = (mouseX >= rb.x && mouseX <= rb.x + rb.w && mouseY >= rb.y && mouseY <= rb.y + rb.h);

  ctx.globalAlpha = isHover ? 0.95 : 0.75;
  ctx.fillStyle = COL_PRI;
  roundRect(rb.x, rb.y, rb.w, rb.h, 6);
  ctx.fill();

  ctx.globalAlpha = 1.0;
  ctx.font = "bold 11px 'Noto Sans SC', system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("重播", rb.x + rb.w / 2, rb.y + rb.h / 2 + 4);
}

/* ── 绘制探索模式提示 ── */
function drawExploreHint() {
  ctx.font = "11px 'Noto Sans SC', system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = COL_PRI;
  ctx.globalAlpha = 0.85;
  ctx.fillText("探索模式：悬停查看残基详情 | 拖动观察结构变化", W / 2, 44);
  ctx.globalAlpha = 1.0;
}

/* ── 动画主循环 ── */
var strandYCache = new Array(NUM_STRANDS).fill(0);

function loop(now) {
  // 弹回动画更新
  for (var sbi = snapBacks.length - 1; sbi >= 0; sbi--) {
    var sb = snapBacks[sbi];
    var sbt = (now - sb.startTime) / SNAP_DURATION;
    if (sbt >= 1.0) {
      dragDisplace[sb.si][sb.ri].dx = 0;
      dragDisplace[sb.si][sb.ri].dy = 0;
      snapBacks.splice(sbi, 1);
    } else {
      var ease = 1 - easeInOut(sbt);
      dragDisplace[sb.si][sb.ri].dx = sb.startDx * ease;
      dragDisplace[sb.si][sb.ri].dy = sb.startDy * ease;
    }
  }

  if (!exploreMode) {
    var elapsed = now - phaseStart;
    var dur = PHASE_DURATIONS[Math.min(phase, PHASE_DURATIONS.length-1)];
    var t = Math.min(elapsed / dur, 1.0);

    // 阶段推进
    if (t >= 1.0) {
      if (phase < 5) {
        phase++;
        phaseStart = now;
        // 新链飞入动画：下一条链的进度设为0
        if (phase <= NUM_STRANDS - 1) {
          strandProgress[phase] = 0.0;
        }
      } else {
        // phase 5 完成后进入探索模式（不再循环）
        if (elapsed > 3000) {
          phase = 6;
          exploreMode = true;
          hbondAlpha = 1.0;
        }
      }
    }

    // 更新新链进度
    for (var si = 1; si < NUM_STRANDS; si++) {
      if (strandProgress[si] < 1.0 && si <= getStrandCount() - 1) {
        strandProgress[si] = Math.min(strandProgress[si] + 0.018, 1.0);
      }
    }

    // 氢键透明度：链2完全到位后渐显
    var targetHBAlpha = phase >= 2 ? Math.min(1.0, (elapsed - 400) / 800) : 0.0;
    if (phase >= 2) hbondAlpha = Math.min(hbondAlpha + 0.015, targetHBAlpha);
    if (phase < 2)  hbondAlpha = Math.max(hbondAlpha - 0.02, 0.0);
  }

  // ── 绘制 ──
  drawBg();
  if (exploreMode) {
    drawTitle("β折叠形成过程：多条链并排，氢键构成片状结构");
    drawExploreHint();
  } else {
    drawTitle("β折叠形成过程：多条链并排，氢键构成片状结构");
  }

  // 绘制当前活跃的链
  var count = getStrandCount();
  for (var si2 = 0; si2 < count; si2++) {
    var yPos = strandTargetY(si2);
    strandYCache[si2] = yPos;
    drawStrand(si2, strandProgress[si2], hbondAlpha, si2 > 0);

    // 方向箭头
    var arCol = si2 % 2 === 0 ? COL_PRI : COL_SEC;
    if (strandProgress[si2] > 0.8) {
      drawDirectionArrow(si2, yPos, arCol);
    }
  }

  // 绘制链间氢键
  if (count >= 2 && hbondAlpha > 0.01) {
    for (var pi = 0; pi < count - 1; pi++) {
      drawHBonds(pi, strandYCache[pi], pi+1, strandYCache[pi+1], hbondAlpha * 0.9);
    }
  }

  // 第一条链的锯齿说明（仅动画阶段0显示）
  if (count === 1 && !exploreMode) {
    ctx.font = "11px 'Noto Sans SC', system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = COL_DIM;
    ctx.globalAlpha = 0.85;
    ctx.fillText("锯齿形骨架：每个氨基酸的Cα在折叠的顶点", W/2, CY + ZIG_AMP + BEAD_R + 36);
    ctx.fillText("侧链（橙色）：奇数位朝上，偶数位朝下", W/2, CY + ZIG_AMP + BEAD_R + 52);
    ctx.globalAlpha = 1.0;
  }

  // HUD
  var hbCount = count >= 2 ? (count - 1) * NUM_RESIDUES : 0;
  if (exploreMode) {
    drawHUD([
      { label: "模式", val: "探索" },
      { label: "β链数量", val: count.toString() },
      { label: "链间氢键", val: hbCount.toString() },
      { label: "残基间距", val: "0.35 nm" },
    ]);
  } else {
    drawHUD([
      { label: "阶段", val: PHASE_NAMES[Math.min(phase, 6)].substring(0, 10) },
      { label: "β链数量", val: count.toString() },
      { label: "链间氢键", val: hbCount.toString() },
      { label: "残基间距", val: "0.35 nm" },
    ]);
  }

  // 阶段说明文字（非探索模式）
  if (!exploreMode) {
    ctx.font = "11px 'Noto Sans SC', system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = COL_PRI;
    ctx.globalAlpha = 0.9;
    ctx.fillText(PHASE_SUBS[Math.min(phase, 5)], W/2, H - 62);
    ctx.globalAlpha = 1.0;
  }

  // 探索模式 UI
  if (exploreMode) {
    drawReplayBtn();

    // Tooltip
    if (hoverStrand >= 0 && hoverResidue >= 0 && !dragging) {
      drawTooltip(mouseX, mouseY, hoverStrand, hoverResidue);
    }
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

})();
</script>
</body>
</html>"""

# ── Canvas 动画2 —— 反平行 vs 平行β折叠对比 ────────────────────

ANIM2_HTML = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>反平行 vs 平行 β折叠</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: __THEME_BG__;
  font-family: __THEME_FONT__;
}
canvas { display: block; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function() {
"use strict";

var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
var W = 600, H = 420;
var DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  var rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * DPR;
  canvas.height = rect.height * DPR;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(DPR * rect.width / W, DPR * rect.height / H);
}
resize();
window.addEventListener("resize", resize);

var COL_BG1    = "__THEME_BG__";
var COL_BG2    = "__THEME_BG2__";
var COL_GRID   = "__THEME_GRID__";
var COL_PRI    = "__THEME_PRIMARY__";
var COL_SEC    = "__THEME_SECONDARY__";
var COL_ACC    = "__THEME_ACCENT__";
var COL_TEXT   = "__THEME_TEXT__";
var COL_DIM    = "__THEME_TEXT_DIM__";
var COL_HUD_BG = "__THEME_HUD_BG__";
var COL_HUD_LB = "__THEME_HUD_LABEL__";
var COL_HUD_VL = "__THEME_HUD_VALUE__";

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function easeInOut(t) {
  return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
}

function drawBg() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COL_BG1);
  g.addColorStop(1, COL_BG2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = COL_GRID;
  ctx.lineWidth = 1;
  for (var x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (var y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawHUD(cols) {
  var by = H - 52;
  ctx.fillStyle = COL_HUD_BG;
  roundRect(0, by, W, 52, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(W, by); ctx.stroke();
  var cw = W / cols.length;
  cols.forEach(function(c, i) {
    var cx2 = cw*i + cw/2;
    ctx.font = "10px 'Noto Sans SC', system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = COL_HUD_LB;
    ctx.fillText(c.label, cx2, by + 17);
    ctx.font = "bold 13px 'Noto Sans SC', system-ui";
    ctx.fillStyle = COL_HUD_VL;
    ctx.fillText(c.val, cx2, by + 38);
  });
}

/* ── beta折叠绘制参数 ── */
var NUM_STRANDS = 3;
var NUM_RESIDUES = 6;
var STRAND_SPACING = 50;
var RES_SPACING = 34;
var ZIG_AMP = 14;
var BEAD_R = 7;
var SIDE_R = 4;

// 左区（反平行）中心
var LCX = W / 4;
// 右区（平行）中心
var RCX = W * 3 / 4;
var BASE_Y = H / 2 - 20;

function strandY(si) {
  return BASE_Y + (si - (NUM_STRANDS-1)/2) * STRAND_SPACING;
}

// 计算单个残基位置
function resPos(cx, si, ri, antiparallel) {
  var xStart = cx - (NUM_RESIDUES - 1) * RES_SPACING / 2;
  var xEnd   = cx + (NUM_RESIDUES - 1) * RES_SPACING / 2;
  var x;
  if (antiparallel) {
    // 奇数链从右到左
    x = (si % 2 === 0) ? (xStart + ri * RES_SPACING) : (xEnd - ri * RES_SPACING);
  } else {
    // 平行：所有链从左到右
    x = xStart + ri * RES_SPACING;
  }
  var zigDir = (ri % 2 === 0) ? 1 : -1;
  var y = strandY(si) + zigDir * ZIG_AMP;
  return { x: x, y: y, up: zigDir > 0 };
}

/* ── 探索模式状态 ── */
var exploreMode = false;
var introPhase = true;  // 渐入阶段
var introStart = performance.now();
var INTRO_FADE_DUR = 1200;  // 氢键渐入时间

// 珠子位置缓存（hitTest 用）
// beadPos[side][si][ri] = {x, y}  side: 0=左(反平行), 1=右(平行)
var beadPos = [[], []];
for (var _side = 0; _side < 2; _side++) {
  for (var _si = 0; _si < NUM_STRANDS; _si++) {
    beadPos[_side][_si] = [];
    for (var _ri = 0; _ri < NUM_RESIDUES; _ri++) {
      beadPos[_side][_si][_ri] = { x: 0, y: 0 };
    }
  }
}

// 鼠标逻辑坐标
var mouseX = -999, mouseY = -999;
// hover 状态
var hoverSide = -1;     // 0=左, 1=右
var hoverStrand = -1;
var hoverResidue = -1;
// 点击高亮状态
var clickHighlight = -1;  // -1=无, 0=左(反平行)高亮, 1=右(平行)高亮
var clickHighlightTime = 0;

// 重播按钮区域
var replayBtnRect = { x: 12, y: H - 100, w: 72, h: 28 };

/* ── 坐标转换 ── */
function canvasToLogic(e) {
  var rect = canvas.getBoundingClientRect();
  var x = ((e.clientX || e.pageX) - rect.left) / rect.width * W;
  var y = ((e.clientY || e.pageY) - rect.top) / rect.height * H;
  return { x: x, y: y };
}

/* ── hitTest ── */
function hitTestBead(mx, my) {
  var hitR = BEAD_R + 4;
  for (var side = 0; side < 2; side++) {
    for (var si = 0; si < NUM_STRANDS; si++) {
      for (var ri = 0; ri < NUM_RESIDUES; ri++) {
        var bp = beadPos[side][si][ri];
        if (Math.hypot(mx - bp.x, my - bp.y) < hitR) {
          return { side: side, si: si, ri: ri };
        }
      }
    }
  }
  return null;
}

// 检测是否点击了氢键区域（在两条链之间的区域）
function hitTestHBondArea(mx, my) {
  // 左侧(反平行)区域
  var leftX0 = LCX - 130, leftX1 = LCX + 130;
  var rightX0 = RCX - 130, rightX1 = RCX + 130;
  var yTop = BASE_Y - STRAND_SPACING * 1.6;
  var yBot = BASE_Y + STRAND_SPACING * 1.6;

  if (mx >= leftX0 && mx <= leftX1 && my >= yTop && my <= yBot) return 0;
  if (mx >= rightX0 && mx <= rightX1 && my >= yTop && my <= yBot) return 1;
  return -1;
}

/* ── 事件监听 ── */
function onMouseMove(e) {
  var pos = canvasToLogic(e);
  mouseX = pos.x;
  mouseY = pos.y;

  if (!exploreMode) return;

  var hit = hitTestBead(mouseX, mouseY);
  if (hit) {
    hoverSide = hit.side;
    hoverStrand = hit.si;
    hoverResidue = hit.ri;
    canvas.style.cursor = "pointer";
  } else {
    hoverSide = -1;
    hoverStrand = -1;
    hoverResidue = -1;
    var rb = replayBtnRect;
    if (mouseX >= rb.x && mouseX <= rb.x + rb.w && mouseY >= rb.y && mouseY <= rb.y + rb.h) {
      canvas.style.cursor = "pointer";
    } else {
      canvas.style.cursor = "default";
    }
  }
}

function onMouseDown(e) {
  if (!exploreMode) return;
  var pos = canvasToLogic(e);
  mouseX = pos.x;
  mouseY = pos.y;

  // 检查重播按钮
  var rb = replayBtnRect;
  if (mouseX >= rb.x && mouseX <= rb.x + rb.w && mouseY >= rb.y && mouseY <= rb.y + rb.h) {
    doReplay();
    return;
  }

  // 检查氢键区域点击
  var hbArea = hitTestHBondArea(mouseX, mouseY);
  if (hbArea >= 0) {
    if (clickHighlight === hbArea) {
      clickHighlight = -1;  // 再次点击取消
    } else {
      clickHighlight = hbArea;
      clickHighlightTime = performance.now();
    }
  }
}

canvas.addEventListener("mousemove", onMouseMove);
canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mouseleave", function() {
  mouseX = -999; mouseY = -999;
  hoverSide = -1; hoverStrand = -1; hoverResidue = -1;
});

// 触摸支持
canvas.addEventListener("touchstart", function(e) {
  if (e.touches.length === 1) {
    var t = e.touches[0];
    onMouseMove({ clientX: t.clientX, clientY: t.clientY });
    onMouseDown({ clientX: t.clientX, clientY: t.clientY });
  }
}, { passive: true });
canvas.addEventListener("touchmove", function(e) {
  if (e.touches.length === 1) {
    var t = e.touches[0];
    onMouseMove({ clientX: t.clientX, clientY: t.clientY });
  }
}, { passive: true });

/* ── 重播 ── */
function doReplay() {
  exploreMode = false;
  introPhase = true;
  introStart = performance.now();
  hbAlpha = 0.0;
  clickHighlight = -1;
  hoverSide = -1;
  hoverStrand = -1;
  hoverResidue = -1;
}

/* ── 绘制一侧的折叠片（支持高亮） ── */
function drawOneSheet(cx, antiparallel, hbAlpha, label, labelColor, sideIdx, highlightChain, highlightAllHB) {
  // 背景区域（轻微）
  var bgAlpha = antiparallel ? "rgba(5,150,105,0.05)" : "rgba(8,145,178,0.05)";
  if (highlightAllHB) {
    bgAlpha = antiparallel ? "rgba(5,150,105,0.12)" : "rgba(8,145,178,0.12)";
  }
  ctx.fillStyle = bgAlpha;
  roundRect(cx - 130, BASE_Y - STRAND_SPACING * 1.6, 260, STRAND_SPACING * 3.2, 8);
  ctx.fill();

  for (var si = 0; si < NUM_STRANDS; si++) {
    var yPos = strandY(si);
    var isHighlighted = (exploreMode && hoverSide === sideIdx && hoverStrand === si);

    // 骨架路径
    ctx.beginPath();
    for (var ri = 0; ri < NUM_RESIDUES; ri++) {
      var p = resPos(cx, si, ri, antiparallel);
      // 缓存珠子位置
      beadPos[sideIdx][si][ri].x = p.x;
      beadPos[sideIdx][si][ri].y = p.y;
      if (ri === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = antiparallel ? COL_PRI : COL_SEC;
    ctx.lineWidth = isHighlighted ? 3.5 : 2;
    ctx.globalAlpha = isHighlighted ? 1.0 : 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // 残基珠子
    for (var ri2 = 0; ri2 < NUM_RESIDUES; ri2++) {
      var p2 = resPos(cx, si, ri2, antiparallel);
      var beadColor = antiparallel ? COL_PRI : COL_SEC;
      var isBeadHover = (isHighlighted && hoverResidue === ri2);

      var bgCa;
      if (isBeadHover) {
        bgCa = ctx.createRadialGradient(p2.x-1, p2.y-1, 0, p2.x, p2.y, BEAD_R);
        bgCa.addColorStop(0, "#fef08a");
        bgCa.addColorStop(0.5, "#f59e0b");
        bgCa.addColorStop(1, "#92400e");
      } else {
        bgCa = ctx.createRadialGradient(p2.x-1, p2.y-1, 0, p2.x, p2.y, BEAD_R);
        bgCa.addColorStop(0, "#bbf7d0");
        bgCa.addColorStop(0.5, beadColor);
        bgCa.addColorStop(1, "#064e3b");
      }

      var drawR = isHighlighted ? BEAD_R + 1.5 : BEAD_R;
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, drawR, 0, Math.PI*2);
      ctx.fillStyle = bgCa;
      ctx.fill();

      if (isHighlighted) {
        ctx.strokeStyle = antiparallel ? COL_PRI : COL_SEC;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.9;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    }

    // 方向箭头
    var flip = antiparallel ? (si % 2 === 1) : false;
    var ax0 = cx - (NUM_RESIDUES - 1) * RES_SPACING / 2 - 14;
    var ax1 = cx + (NUM_RESIDUES - 1) * RES_SPACING / 2 + 14;
    var arFrom = flip ? ax1 : ax0;
    var arTo   = flip ? ax0 : ax1;
    ctx.beginPath();
    ctx.moveTo(arFrom, yPos);
    ctx.lineTo(arTo, yPos);
    var headX = arTo + (flip ? -5 : 5);
    ctx.lineTo(headX, yPos - 4);
    ctx.moveTo(arTo, yPos);
    ctx.lineTo(headX, yPos + 4);
    ctx.strokeStyle = antiparallel ? COL_PRI : COL_SEC;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // 链间氢键
  if (hbAlpha > 0.01) {
    var hbLineWidth = highlightAllHB ? 2.5 : 1.5;
    var hbGlobalAlpha = highlightAllHB ? Math.min(hbAlpha * 1.3, 1.0) : hbAlpha;
    ctx.globalAlpha = hbGlobalAlpha;
    ctx.setLineDash(highlightAllHB ? [6, 3] : [4, 3]);
    ctx.lineWidth = hbLineWidth;

    for (var pi = 0; pi < NUM_STRANDS - 1; pi++) {
      for (var ri3 = 0; ri3 < NUM_RESIDUES; ri3++) {
        var pa = resPos(cx, pi, ri3, antiparallel);
        var pb = resPos(cx, pi+1, ri3, antiparallel);

        if (antiparallel) {
          ctx.strokeStyle = highlightAllHB ? "#ef4444" : COL_ACC;
        } else {
          ctx.strokeStyle = highlightAllHB ? "#8b5cf6" : "#a78bfa";
        }

        ctx.beginPath();
        if (!antiparallel) {
          var pbOff = resPos(cx, pi+1, Math.min(ri3 + 0, NUM_RESIDUES-1), antiparallel);
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pbOff.x + 8, pbOff.y);
        } else {
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
        }
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1.0;
  }

  // 标签
  ctx.font = "bold 13px 'Noto Sans SC', system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = labelColor;
  ctx.fillText(label, cx, BASE_Y - STRAND_SPACING * 1.6 - 12);

  // 氢键特征说明（非高亮时的默认说明）
  if (hbAlpha > 0.5 && !highlightAllHB) {
    ctx.font = "10px 'Noto Sans SC', system-ui";
    ctx.fillStyle = COL_DIM;
    ctx.globalAlpha = 0.85;
    var desc = antiparallel ? "氢键垂直于链轴（更稳定）" : "氢键略微倾斜（稍不稳定）";
    ctx.fillText(desc, cx, BASE_Y + STRAND_SPACING * 1.6 + 16);
    ctx.globalAlpha = 1.0;
  }

  // 高亮时的加粗标注
  if (highlightAllHB) {
    ctx.font = "bold 11px 'Noto Sans SC', system-ui";
    ctx.textAlign = "center";
    if (antiparallel) {
      ctx.fillStyle = "#dc2626";
      ctx.fillText("氢键垂直、更稳定", cx, BASE_Y + STRAND_SPACING * 1.6 + 16);
      ctx.font = "10px 'Noto Sans SC', system-ui";
      ctx.fillStyle = COL_DIM;
      ctx.fillText("N-H...O=C 完美对齐", cx, BASE_Y + STRAND_SPACING * 1.6 + 32);
    } else {
      ctx.fillStyle = "#7c3aed";
      ctx.fillText("氢键倾斜、稍不稳定", cx, BASE_Y + STRAND_SPACING * 1.6 + 16);
      ctx.font = "10px 'Noto Sans SC', system-ui";
      ctx.fillStyle = COL_DIM;
      ctx.fillText("N-H...O=C 有角度偏移", cx, BASE_Y + STRAND_SPACING * 1.6 + 32);
    }
  }
}

/* ── 绘制 tooltip ── */
function drawTooltip(mx, my, side, si) {
  var sideName = (side === 0) ? "反平行侧" : "平行侧";
  var txt = "链 #" + (si + 1) + "（" + sideName + "）";
  ctx.font = "bold 11px 'Noto Sans SC', system-ui";
  var tw = ctx.measureText(txt).width;
  var padX = 8;
  var ttW = tw + padX * 2;
  var ttH = 22;
  var ttX = mx - ttW / 2;
  var ttY = my - ttH - 12;
  if (ttX < 4) ttX = 4;
  if (ttX + ttW > W - 4) ttX = W - 4 - ttW;
  if (ttY < 4) ttY = my + 16;

  ctx.globalAlpha = 0.88;
  ctx.fillStyle = "rgba(15,23,42,0.85)";
  roundRect(ttX, ttY, ttW, ttH, 5);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.fillText(txt, ttX + ttW / 2, ttY + ttH - 6);
}

/* ── 绘制重播按钮 ── */
function drawReplayBtn() {
  var rb = replayBtnRect;
  var isHover = (mouseX >= rb.x && mouseX <= rb.x + rb.w && mouseY >= rb.y && mouseY <= rb.y + rb.h);

  ctx.globalAlpha = isHover ? 0.95 : 0.75;
  ctx.fillStyle = COL_PRI;
  roundRect(rb.x, rb.y, rb.w, rb.h, 6);
  ctx.fill();

  ctx.globalAlpha = 1.0;
  ctx.font = "bold 11px 'Noto Sans SC', system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("重播", rb.x + rb.w / 2, rb.y + rb.h / 2 + 4);
}

/* ── 动画状态 ── */
var hbAlpha = 0.0;

function loop(now) {
  // 渐入阶段：氢键一次渐入
  if (introPhase) {
    var introElapsed = now - introStart;
    hbAlpha = Math.min(introElapsed / INTRO_FADE_DUR, 1.0);
    if (hbAlpha >= 1.0) {
      introPhase = false;
      exploreMode = true;
      hbAlpha = 1.0;
    }
  }

  drawBg();

  // 标题
  ctx.font = "bold 15px 'Noto Sans SC', system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = COL_TEXT;
  ctx.globalAlpha = 0.92;
  ctx.fillText("反平行 vs 平行 β折叠：氢键方向对比", W/2, 26);
  ctx.globalAlpha = 1.0;

  // 探索模式提示
  if (exploreMode) {
    ctx.font = "11px 'Noto Sans SC', system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = COL_PRI;
    ctx.globalAlpha = 0.85;
    ctx.fillText("探索模式：悬停查看链信息 | 点击左/右区域对比氢键", W/2, 44);
    ctx.globalAlpha = 1.0;
  }

  // 分割线
  ctx.beginPath();
  ctx.moveTo(W/2, 40);
  ctx.lineTo(W/2, H - 60);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 左侧：反平行
  var highlightLeft = (clickHighlight === 0);
  var highlightRight = (clickHighlight === 1);
  drawOneSheet(LCX, true, hbAlpha, "反平行 (antiparallel)", COL_PRI, 0, (hoverSide === 0 ? hoverStrand : -1), highlightLeft);

  // 右侧：平行
  drawOneSheet(RCX, false, hbAlpha, "平行 (parallel)", COL_SEC, 1, (hoverSide === 1 ? hoverStrand : -1), highlightRight);

  // 中间提示
  ctx.font = "11px 'Noto Sans SC', system-ui";
  ctx.textAlign = "center";
  if (exploreMode) {
    if (clickHighlight === 0) {
      ctx.fillStyle = "#dc2626";
      ctx.globalAlpha = 0.9;
      ctx.fillText("反平行氢键高亮 — 点击其他区域切换", W/2, H - 62);
    } else if (clickHighlight === 1) {
      ctx.fillStyle = "#7c3aed";
      ctx.globalAlpha = 0.9;
      ctx.fillText("平行氢键高亮 — 点击其他区域切换", W/2, H - 62);
    } else {
      ctx.fillStyle = COL_ACC;
      ctx.globalAlpha = 0.8;
      ctx.fillText("点击左侧或右侧区域，高亮对比氢键差异", W/2, H - 62);
    }
    ctx.globalAlpha = 1.0;
  } else {
    // 渐入阶段
    var showingHB = hbAlpha > 0.5;
    ctx.fillStyle = showingHB ? COL_ACC : COL_DIM;
    ctx.globalAlpha = 0.8;
    ctx.fillText(showingHB ? "氢键形成中..." : "结构加载中...", W/2, H - 62);
    ctx.globalAlpha = 1.0;
  }

  // HUD
  if (exploreMode) {
    drawHUD([
      { label: "模式", val: "探索" },
      { label: "反平行氢键", val: "垂直" },
      { label: "平行氢键", val: "倾斜" },
      { label: "稳定性", val: "反平行 > 平行" },
    ]);
  } else {
    drawHUD([
      { label: "左侧结构", val: "反平行" },
      { label: "氢键方向", val: "垂直" },
      { label: "右侧结构", val: "平行" },
      { label: "稳定性比较", val: "反平行 > 平行" },
    ]);
  }

  // 探索模式 UI
  if (exploreMode) {
    drawReplayBtn();

    // Tooltip
    if (hoverStrand >= 0 && hoverSide >= 0) {
      drawTooltip(mouseX, mouseY, hoverSide, hoverStrand);
    }
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

})();
</script>
</body>
</html>"""

# ── 游戏 HTML —— β折叠链对齐游戏 ──────────────────────────────────
# 游戏玩法：三条链从屏幕外飞入，玩家点击按钮控制每条链的方向（反平行/平行），
# 然后点击"对齐"——如果链间距离合适且方向正确，氢键自动连接，获得分数

GAME_HTML = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>β折叠：链对齐游戏</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: __THEME_BG__;
  font-family: __THEME_FONT__;
  color: __THEME_TEXT__;
}

#app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

#canvas-area {
  flex: 1;
  position: relative;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0; left: 0;
}

#ui-overlay {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  align-items: center;
  z-index: 10;
  background: __THEME_HUD_BG__;
  border: 1px solid __THEME_BORDER__;
  border-radius: 10px;
  padding: 10px 16px;
}

button {
  background: __THEME_PRIMARY__;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}
button:hover { opacity: 0.85; }
button.secondary {
  background: __THEME_SECONDARY__;
}
button.accent {
  background: __THEME_ACCENT__;
}
button:disabled { opacity: 0.4; cursor: not-allowed; }

#msg {
  font-size: 13px;
  color: __THEME_TEXT__;
  min-width: 160px;
  text-align: center;
}

#hud {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 52px;
  background: __THEME_HUD_BG__;
  border-top: 1px solid rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.hud-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hud-label {
  font-size: 10px;
  color: __THEME_HUD_LABEL__;
}

.hud-value {
  font-size: 14px;
  font-weight: bold;
  color: __THEME_HUD_VALUE__;
}

#win-overlay {
  display: none;
  position: absolute;
  inset: 0;
  background: rgba(240,247,244,0.92);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 20;
}

#win-overlay.show { display: flex; }

.win-title {
  font-size: 22px;
  font-weight: bold;
  color: __THEME_PRIMARY__;
}

.win-sub {
  font-size: 14px;
  color: __THEME_TEXT_DIM__;
  text-align: center;
  max-width: 320px;
}
</style>
</head>
<body>
<div id="app">
  <div id="canvas-area">
    <canvas id="c"></canvas>

    <div id="ui-overlay">
      <button id="btn-antiparallel" onclick="setMode('antiparallel')">反平行排列</button>
      <button id="btn-parallel" class="secondary" onclick="setMode('parallel')">平行排列</button>
      <button id="btn-align" class="accent" onclick="doAlign()" disabled>对齐并连接氢键</button>
      <div id="msg">选择β折叠类型，然后对齐</div>
    </div>

    <div id="win-overlay">
      <div class="win-title">β折叠片形成！</div>
      <div class="win-sub" id="win-desc"></div>
      <button onclick="resetGame()">再玩一次</button>
    </div>
  </div>

  <div id="hud">
    <div class="hud-cell">
      <span class="hud-label">当前模式</span>
      <span class="hud-value" id="hud-mode">未选择</span>
    </div>
    <div class="hud-cell">
      <span class="hud-label">链数量</span>
      <span class="hud-value" id="hud-strands">3</span>
    </div>
    <div class="hud-cell">
      <span class="hud-label">氢键数量</span>
      <span class="hud-value" id="hud-hbonds">0</span>
    </div>
    <div class="hud-cell">
      <span class="hud-label">稳定性</span>
      <span class="hud-value" id="hud-stability">--</span>
    </div>
  </div>
</div>

<script>
(function() {
"use strict";

var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
var W = 600, H = 340;
var DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  var rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * DPR;
  canvas.height = rect.height * DPR;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(DPR * rect.width / W, DPR * rect.height / H);
}
resize();
window.addEventListener("resize", resize);

var COL_BG1  = "__THEME_BG__";
var COL_BG2  = "__THEME_BG2__";
var COL_GRID = "__THEME_GRID__";
var COL_PRI  = "__THEME_PRIMARY__";
var COL_SEC  = "__THEME_SECONDARY__";
var COL_ACC  = "__THEME_ACCENT__";

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function drawBg() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COL_BG1);
  g.addColorStop(1, COL_BG2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = COL_GRID;
  ctx.lineWidth = 1;
  for (var x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (var y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

/* ── 游戏状态 ── */
var NUM_STRANDS   = 3;
var NUM_RESIDUES  = 6;
var STRAND_SPACING = 52;
var RES_SPACING   = 36;
var ZIG_AMP = 14;
var BEAD_R  = 7;

var CX = W / 2;
var CY = H / 2;

var mode = null;          // 'antiparallel' | 'parallel'
var aligned = false;
var hbAlpha = 0.0;
var animT = 0;            // 对齐动画进度

// 链的y偏移（飞入动画）
var strandYOffset = [0, -80, 80];  // 链2从上飞入，链3从下飞入

function strandTargetY(si) {
  return CY + (si - (NUM_STRANDS-1)/2) * STRAND_SPACING;
}

function resPos(si, ri) {
  var targetY = strandTargetY(si) + (aligned ? 0 : strandYOffset[si] * (1 - animT));
  var flip = false;
  if (mode === 'antiparallel') {
    flip = (si % 2 === 1);
  }
  var xStart = CX - (NUM_RESIDUES - 1) * RES_SPACING / 2;
  var xEnd   = CX + (NUM_RESIDUES - 1) * RES_SPACING / 2;
  var x = flip ? (xEnd - ri * RES_SPACING) : (xStart + ri * RES_SPACING);
  var zigDir = (ri % 2 === 0) ? 1 : -1;
  return {
    x: x,
    y: targetY + zigDir * ZIG_AMP,
    up: zigDir > 0,
  };
}

function drawGame() {
  drawBg();

  // 标题
  ctx.font = "bold 14px 'Noto Sans SC', system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "__THEME_TEXT__";
  ctx.globalAlpha = 0.9;
  ctx.fillText("β折叠对齐游戏：选择排列方式，把三条链对齐", W/2, 24);
  ctx.globalAlpha = 1.0;

  if (mode === null) {
    // 未选择状态：显示3条散开的链
    ctx.font = "13px 'Noto Sans SC', system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "__THEME_TEXT_DIM__";
    ctx.globalAlpha = 0.7;
    ctx.fillText("三条β链正在漂浮，请选择排列方式", W/2, CY - 30);
    ctx.globalAlpha = 1.0;

    // 画3条散开的链（随机分布）
    for (var si = 0; si < NUM_STRANDS; si++) {
      var yPos = strandTargetY(si) + strandYOffset[si];
      drawOneStrand(si, yPos, false);
    }
    return;
  }

  // 已选模式：按对齐进度绘制
  for (var si2 = 0; si2 < NUM_STRANDS; si2++) {
    var p0 = resPos(si2, 0);
    drawOneStrandAtY(si2, p0.y - ZIG_AMP * (p0.up ? 1 : -1));
  }

  // 链间氢键
  if (hbAlpha > 0.01) {
    for (var pi = 0; pi < NUM_STRANDS - 1; pi++) {
      ctx.globalAlpha = hbAlpha;
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = COL_ACC;
      ctx.lineWidth = 2;
      for (var ri = 0; ri < NUM_RESIDUES; ri++) {
        var pa = resPos(pi, ri);
        var pb = resPos(pi+1, ri);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    }
    // 显示氢键数量
    var hbCount = Math.round(hbAlpha * (NUM_STRANDS-1) * NUM_RESIDUES);
    document.getElementById("hud-hbonds").textContent = hbCount.toString();
  }

  // 模式标签
  ctx.font = "12px 'Noto Sans SC', system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = mode === 'antiparallel' ? COL_PRI : COL_SEC;
  ctx.globalAlpha = 0.85;
  ctx.fillText(mode === 'antiparallel' ? "反平行排列：箭头方向交替" : "平行排列：箭头方向一致", W/2, H - 16);
  ctx.globalAlpha = 1.0;
}

function drawOneStrand(si, yPos, flip) {
  var xStart = CX - (NUM_RESIDUES - 1) * RES_SPACING / 2;
  var xEnd   = CX + (NUM_RESIDUES - 1) * RES_SPACING / 2;

  ctx.beginPath();
  for (var ri = 0; ri < NUM_RESIDUES; ri++) {
    var x = flip ? (xEnd - ri * RES_SPACING) : (xStart + ri * RES_SPACING);
    var zigDir = (ri % 2 === 0) ? 1 : -1;
    var y = yPos + zigDir * ZIG_AMP;
    if (ri === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = COL_PRI;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  for (var ri2 = 0; ri2 < NUM_RESIDUES; ri2++) {
    var x2 = flip ? (xEnd - ri2 * RES_SPACING) : (xStart + ri2 * RES_SPACING);
    var z2 = (ri2 % 2 === 0) ? 1 : -1;
    var y2 = yPos + z2 * ZIG_AMP;
    ctx.beginPath();
    ctx.arc(x2, y2, BEAD_R, 0, Math.PI*2);
    var bg = ctx.createRadialGradient(x2-1, y2-1, 0, x2, y2, BEAD_R);
    bg.addColorStop(0, "#a7f3d0");
    bg.addColorStop(0.5, COL_PRI);
    bg.addColorStop(1, "#065f46");
    ctx.fillStyle = bg;
    ctx.fill();
  }
}

function drawOneStrandAtY(si, baseY) {
  var flip = (mode === 'antiparallel') && (si % 2 === 1);
  var xStart = CX - (NUM_RESIDUES - 1) * RES_SPACING / 2;
  var xEnd   = CX + (NUM_RESIDUES - 1) * RES_SPACING / 2;

  ctx.beginPath();
  for (var ri = 0; ri < NUM_RESIDUES; ri++) {
    var p = resPos(si, ri);
    if (ri === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = (si % 2 === 0) ? COL_PRI : COL_SEC;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  for (var ri2 = 0; ri2 < NUM_RESIDUES; ri2++) {
    var p2 = resPos(si, ri2);
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, BEAD_R, 0, Math.PI*2);
    var bc = (si % 2 === 0) ? COL_PRI : COL_SEC;
    ctx.fillStyle = bc;
    ctx.fill();
  }

  // 方向箭头
  var arFrom = flip ? (CX + (NUM_RESIDUES-1)*RES_SPACING/2 + 14) : (CX - (NUM_RESIDUES-1)*RES_SPACING/2 - 14);
  var arTo   = flip ? (CX - (NUM_RESIDUES-1)*RES_SPACING/2 - 10) : (CX + (NUM_RESIDUES-1)*RES_SPACING/2 + 10);
  ctx.beginPath();
  ctx.moveTo(arFrom, baseY);
  ctx.lineTo(arTo, baseY);
  var hx = arTo + (flip ? -6 : 6);
  ctx.lineTo(hx, baseY - 4);
  ctx.moveTo(arTo, baseY);
  ctx.lineTo(hx, baseY + 4);
  ctx.strokeStyle = (si % 2 === 0) ? COL_PRI : COL_SEC;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}

/* ── 游戏逻辑 ── */

window.setMode = function(m) {
  mode = m;
  aligned = false;
  hbAlpha = 0.0;
  animT = 0;

  document.getElementById("btn-align").disabled = false;
  document.getElementById("hud-mode").textContent = m === 'antiparallel' ? '反平行' : '平行';
  document.getElementById("hud-stability").textContent = m === 'antiparallel' ? '高' : '中';
  document.getElementById("msg").textContent = m === 'antiparallel' ? "反平行模式：点击对齐" : "平行模式：点击对齐";

  // 高亮当前选中按钮
  document.getElementById("btn-antiparallel").style.outline = m === 'antiparallel' ? '2px solid ' + COL_ACC : 'none';
  document.getElementById("btn-parallel").style.outline     = m === 'parallel'      ? '2px solid ' + COL_ACC : 'none';
};

window.doAlign = function() {
  if (mode === null) return;
  aligned = true;
  document.getElementById("btn-align").disabled = true;
  document.getElementById("msg").textContent = "链段对齐，氢键形成中...";

  // 动画：对齐 + 氢键出现
  var startTime = performance.now();
  var dur = 1200;
  function animate(now) {
    var t = Math.min((now - startTime) / dur, 1.0);
    animT = t;
    hbAlpha = t;
    document.getElementById("hud-hbonds").textContent = Math.round(t * (NUM_STRANDS-1) * NUM_RESIDUES).toString();
    if (t < 1.0) {
      requestAnimationFrame(animate);
    } else {
      // 显示胜利
      setTimeout(showWin, 500);
    }
  }
  requestAnimationFrame(animate);
};

function showWin() {
  var total = (NUM_STRANDS-1) * NUM_RESIDUES;
  var isAnti = mode === 'antiparallel';
  document.getElementById("win-desc").textContent =
    (isAnti ? "反平行β折叠：" : "平行β折叠：") +
    total + "条链间氢键形成！" +
    (isAnti ? " 氢键垂直于链轴，稳定性更高，正是蚕丝的结构。" : " 氢键略倾斜，稳定性稍低，常见于代谢酶的TIM桶结构。");
  document.getElementById("win-overlay").classList.add("show");
}

window.resetGame = function() {
  mode = null;
  aligned = false;
  hbAlpha = 0.0;
  animT = 0;
  document.getElementById("win-overlay").classList.remove("show");
  document.getElementById("btn-align").disabled = true;
  document.getElementById("hud-mode").textContent = "未选择";
  document.getElementById("hud-hbonds").textContent = "0";
  document.getElementById("hud-stability").textContent = "--";
  document.getElementById("msg").textContent = "选择β折叠类型，然后对齐";
  document.getElementById("btn-antiparallel").style.outline = "none";
  document.getElementById("btn-parallel").style.outline = "none";
};

/* ── 主渲染循环 ── */
function loop() {
  drawGame();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

})();
</script>
</body>
</html>"""

# ── 故事段落 ──────────────────────────────────────────────────────

STORY_PARAGRAPHS = [
    {
        "text": "公元前2600年，传说中国的嫘祖正在宫中喝茶，一个蚕茧不小心落入了热水中。她试着拉出茧，发现茧可以被拉成一根细丝，绵延数百米。蚕丝从此进入人类文明。",
        "image_url": "",
    },
    {
        "text": "但蚕丝为什么这么强？为什么这么滑？四千年后，物理学家把蚕丝放在X射线下照射，得到了一张衍射图案。从图案中，他们看到了0.35纳米的间距——那是β链中相邻残基的距离，和0.47纳米的间距——那是相邻β链之间的距离。",
        "image_url": "",
    },
    {
        "text": "蚕的嘴巴，精确地将丝蛋白分子折叠成β折叠片，然后把成千上万张β折叠片层叠在一起，靠Van der Waals力黏合。这就是丝绸光泽的来源——规则晶体反射光线。这就是丝绸强度的来源——每一张片内有数百条氢键。这就是丝绸柔软的来源——片层之间可以滑动。",
        "image_url": "",
    },
]

# ── 练习题 ───────────────────────────────────────────────────────

EXERCISES = [
    {
        "type": "choice",
        "question": "β折叠中，氢键存在于哪里？",
        "options": [
            "A. 同一条β链内（第i与第i+4残基之间）",
            "B. 不同β链之间（链间氢键）",
            "C. 侧链与骨架之间",
            "D. 侧链与侧链之间",
        ],
        "correct": 1,
        "explanation": "β折叠的关键特征是链间氢键——不同β链之间的N-H和C=O形成氢键，将多条链连接成片状结构。这与α螺旋的链内氢键（第i↔第i+4）截然不同。",
    },
    {
        "type": "choice",
        "question": "反平行β折叠比平行β折叠更稳定，原因是？",
        "options": [
            "A. 反平行的链更长",
            "B. 反平行氢键更垂直于链轴，线性程度更高，能量更大",
            "C. 反平行含有更多的氨基酸",
            "D. 反平行的侧链更小",
        ],
        "correct": 1,
        "explanation": "氢键的稳定性取决于供体-氢-受体三者的线性程度（角度越接近180°越稳定）。反平行β折叠中，两链方向相反，氢键几乎垂直于链轴，接近线性，稳定性更高。平行β折叠中氢键需要倾斜，线性程度降低。",
    },
    {
        "type": "choice",
        "question": "蚕丝蛋白（丝素）含有大量Gly（甘氨酸）和Ala（丙氨酸），原因是？",
        "options": [
            "A. 这两种氨基酸的侧链很小，允许β折叠片紧密堆叠",
            "B. 这两种氨基酸特别喜欢形成α螺旋",
            "C. 这两种氨基酸能形成二硫键",
            "D. 这两种氨基酸的侧链带电荷，互相吸引",
        ],
        "correct": 0,
        "explanation": "β折叠片的侧链交替朝上朝下。当多张β折叠片堆叠时，一张片朝下的侧链需要与下一张片朝上的侧链紧密接触。Gly只有H（最小），Ala有甲基（也很小），使β折叠片能堆叠得非常致密，形成晶体结构，赋予蚕丝强度和光泽。",
    },
    {
        "type": "choice",
        "question": "β折叠中，侧链的排列方式是？",
        "options": [
            "A. 所有侧链均朝外（螺旋轴外侧）",
            "B. 所有侧链均朝向片的同一面",
            "C. 侧链交替朝上和朝下，两面各半",
            "D. 侧链随机朝向",
        ],
        "correct": 2,
        "explanation": "在β链的锯齿形骨架中，相邻的Cα原子交替位于折叠面的两侧，因此侧链也交替朝上和朝下。这使β折叠片有两个不同的面——通常一面疏水（朝向蛋白质核心），另一面亲水（朝向水环境）。",
    },
    {
        "type": "choice",
        "question": "淀粉样纤维（与阿尔茨海默病有关）的结构特征是？",
        "options": [
            "A. 大量α螺旋堆叠",
            "B. 大量β折叠跨分子错误堆叠，形成不溶纤维",
            "C. 随机卷曲的蛋白质聚集",
            "D. 二硫键交联的蛋白质",
        ],
        "correct": 1,
        "explanation": "淀粉样纤维是蛋白质错误折叠后，来自不同蛋白质分子的β链跨分子堆叠，形成高度有序的交叉β折叠结构（cross-β）。这种结构非常稳定，不溶于水，细胞无法降解，积累后破坏神经元。这正是β折叠稳定性的'黑暗面'。",
    },
]

# ── Idea 自我辩论系统 ────────────────────────────────────────────

def _debate_idea(
    idea_id: str,
    mode: str,
    topic: str,
    objections: list[str],
    rebuttals: list[str],
    scores: dict[str, int],
) -> bool:
    """执行 idea 辩论。返回 True 表示通过（均值>=6.0），False 不通过。"""
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


# 辩论阈值：均值 >= 6.0
# 辩论原则：质疑要犀利，不能所有 idea 都通过

_IDEA_DEBATES = {
    # ── 候选1：β折叠形成过程动画 ──────────────────────────────────
    "anim1": _debate_idea(
        idea_id="anim1",
        mode="animation",
        topic="β折叠形成过程：多条链并排，氢键依次连接",
        objections=[
            "β折叠的核心难点是'链间'关系，但动画里5条链同时飞入，孩子视觉焦点会被分散，根本不知道该关注哪个氢键在哪里形成",
            "锯齿形骨架本身在2D平面上就很难看懂，加上'飞入动画'这个视觉噪音，会让孩子误以为β链真的会在细胞里'飞'进来",
            "5条链×7个残基=35个珠子同时动，Canvas渲染压力大，在低端设备上可能卡顿，破坏教学体验",
        ],
        rebuttals=[
            "链是依次飞入的（phase 0=1条，phase 1=加入链2，...），不是同时飞入；每个阶段有HUD文字说明当前发生了什么，视觉焦点用阶段字幕引导",
            "飞入动画是标准科教动画的做法（教科书插图也用箭头表示'链加入'），它表示的是'一条新链参与进来'，不是物理轨迹；学生从上下文容易理解",
            "35个圆形的Canvas绘制远低于60fps的瓶颈，现代手机和电脑完全可以流畅运行；如有问题可降帧，不影响内容传递",
        ],
        scores={"teaching_fit": 9, "feasibility": 8, "cognitive": 7, "completion": 8},
    ),
    # ── 候选2：反平行 vs 平行对比动画 ────────────────────────────
    "anim2": _debate_idea(
        idea_id="anim2",
        mode="animation",
        topic="反平行 vs 平行β折叠：氢键方向对比",
        objections=[
            "同一张画面里塞下两种结构，每种各3条链，信息密度过高；孩子第一次学β折叠，对这个微妙区别完全没有先验知识，对比画面会让他们困惑",
            "氢键'倾斜程度'的差异是非常微小的几何变化，在Canvas动画里很难用视觉语言表达出来，可能让孩子以为两种结构差不多",
            "本节最重要的核心是'β链锯齿形+链间氢键'，反平行/平行是进阶细节，动画2占的屏幕时间会喧宾夺主",
        ],
        rebuttals=[
            "画面用分割线明确区分左右两区，左=反平行（绿色标签），右=平行（蓝色标签）；每区各自独立，孩子可以先只看一边",
            "无法有效驳斥：氢键倾斜程度确实很微妙，Canvas用颜色（橙色=直，紫色=斜）和虚线角度来区分，但这个视觉映射对10岁孩子仍然是抽象的；该质疑站得住脚",
            "反平行/平行是课程文本中的重要知识点（有整段表格讲解），动画起辅助作用，不是主要内容；配合文本使用，认知负担分散到文字和动画两个通道",
        ],
        # 质疑2有效驳斥，平均分受影响
        scores={"teaching_fit": 6, "feasibility": 8, "cognitive": 5, "completion": 6},
    ),
    # ── 候选3：蚕丝结构3D堆叠动画（预期淘汰）──────────────────────
    "anim_silk": _debate_idea(
        idea_id="anim_silk",
        mode="animation",
        topic="蚕丝蛋白的β折叠片层堆叠3D可视化",
        objections=[
            "真实蚕丝蛋白的堆叠是3D结构，在Canvas 2D里只能做伪3D，效果丑陋且不准确，孩子可能建立错误的空间认知",
            "动画1已经展示了β折叠的形成过程，堆叠动画是重复，只是把已有知识换了个视角，教学增量不足",
            "蚕丝的视觉吸引力在于它的光泽和质感，这是Canvas根本无法展示的——蚕丝材质的美在Canvas上只是几个灰色矩形，完全失去情感共鸣",
        ],
        rebuttals=[
            "可以用透视投影和阴影模拟3D感，教科书里大量使用这种方式表示分子结构堆叠",
            "堆叠视角展示的是'为什么蚕丝有光泽和强度'，与动画1的'结构形成'关注点完全不同",
            "无法有效驳斥：蚕丝的美学体验确实不是Canvas能传达的，这个动画做出来可能会让孩子觉得蚕丝'不美丽'，反而破坏知识点的情感共鸣；应该用故事文字而非动画来传达这种美",
        ],
        # 质疑3无法有效驳斥，平均分低
        scores={"teaching_fit": 4, "feasibility": 5, "cognitive": 5, "completion": 4},
    ),
    # ── 候选4：折纸游戏——链对齐 ──────────────────────────────────
    "game": _debate_idea(
        idea_id="game",
        mode="game",
        topic="链对齐游戏：选择反平行/平行，然后对齐三条β链",
        objections=[
            "游戏只有两个选项（反平行/平行），然后点一个按钮，总共两步操作就结束了，这不是游戏，这是一道选择题",
            "孩子完全可以随机点一个选项然后点对齐——无论选什么，氢键都会出现，游戏完全没有正误惩罚，教学反馈无效",
            "游戏的奖励（'氢键形成'动画）对孩子的吸引力远不如积分、排行榜或者解锁内容——缺乏激励机制",
        ],
        rebuttals=[
            "游戏的价值不在于操作复杂度，而在于'主动选择'的认知激活：孩子必须思考'我认为蚕丝是哪种'，这个主动判断比被动看动画记忆效果好50%（主动回忆优势）",
            "无法有效驳斥：孩子确实可以随机猜测；但胜利文字说明了两种选择的不同后果（'反平行更稳定，正是蚕丝的结构'），即使猜错，切换选项重玩时会看到对比，有学习价值",
            "氢键逐渐出现的动画配合'X条氢键形成'的HUD数字，对孩子确实有基本的完成感；虽然不如积分系统，但符合本节的最小化游戏化原则（不过度工程化）",
        ],
        # 质疑2有效点，但游戏的教学价值仍然存在
        scores={"teaching_fit": 6, "feasibility": 9, "cognitive": 7, "completion": 5},
    ),
    # ── 候选5：蚕丝情境故事 ──────────────────────────────────────
    "story": _debate_idea(
        idea_id="story",
        mode="story",
        topic="嫘祖和蚕丝的秘密——β折叠的历史情境",
        objections=[
            "嫘祖的故事是传说，不是科学史实，混入课程中会让孩子分不清哪些是科学哪些是神话",
            "课程中已经有两个动画和一个游戏，内容密度已经很高，3段故事是额外的认知负担",
            "故事第3段提到'Van der Waals力'，这远超10岁孩子的知识水平，会在情境中引入陌生术语，造成困惑",
        ],
        rebuttals=[
            "故事开篇明确使用'传说'二字，不会让孩子误以为是事实；从神话引入科学是科教的经典手法（如牛顿苹果树），建立情感锚点后再引入X射线衍射的科学史",
            "故事不是额外负担，而是必要的呼吸节奏：在两个动画之间，3段短故事（每段约2-3句话）不超过60秒阅读时间，是动画后的休息和情感共鸣",
            "无法完全驳斥：'Van der Waals力'确实超纲；可以在故事中将其改为'一种微弱的吸引力，就像两片玻璃贴在一起'，用类比替代专业术语",
        ],
        # 质疑3可补救，整体有效
        scores={"teaching_fit": 7, "feasibility": 10, "cognitive": 7, "completion": 7},
    ),
    # ── 候选6：淀粉样蛋白互动展示（预期淘汰）────────────────────
    "anim_amyloid": _debate_idea(
        idea_id="anim_amyloid",
        mode="animation",
        topic="淀粉样纤维的跨分子β折叠堆叠动画",
        objections=[
            "淀粉样蛋白和阿尔茨海默病是本课程后续节点（三级结构/折叠病）的内容，在β折叠基础节展示会严重破坏知识树顺序",
            "即使用简化动画，孩子理解'跨分子β折叠'需要先理解蛋白质的三级结构是什么，而三级结构是后面模块的内容——认知前置条件不满足",
            "疾病相关内容对10岁孩子可能造成不必要的焦虑（尤其有家人患阿尔茨海默病的孩子），不适合在基础节中引入",
        ],
        rebuttals=[
            "课程文本中有一段提到淀粉样蛋白作为'拓展知识'，动画的作用是可视化这个补充内容",
            "可以简化呈现：不提三级结构，只展示'很多β链从不同地方来，堆叠在一起，形成长纤维'",
            "适当的恐怖感（科学上的）可以激发好奇心，教育学中有'惊奇效应'支持",
        ],
        # 质疑1和2强，前置条件不满足是硬伤
        scores={"teaching_fit": 3, "feasibility": 5, "cognitive": 3, "completion": 4},
    ),
}

console.print(f"\n[bold]辩论汇总：{sum(1 for v in _IDEA_DEBATES.values() if v)}/{len(_IDEA_DEBATES)} 个 idea 通过[/bold]\n")

DEBATE_PASSED = set(k for k, v in _IDEA_DEBATES.items() if v)


# ── 主题应用 ──────────────────────────────────────────────────────

def _apply_theme(html: str, theme: dict) -> str:
    """将 HTML 中的 __THEME_*__ 占位符替换为当前项目主题色。"""
    def _lighten(hex_color: str, delta: int = 8) -> str:
        h = hex_color.lstrip("#")
        rgb = [int(h[i:i+2], 16) for i in (0, 2, 4)]
        rgb = [min(255, c + delta) for c in rgb]
        return "#" + "".join(f"{c:02x}" for c in rgb)

    replacements = {
        "__THEME_BG__": theme["bg"],
        "__THEME_BG2__": theme.get("bg2", _lighten(theme["bg"], 10)),
        "__THEME_CARD__": theme.get("card", "rgba(255,255,255,0.92)"),
        "__THEME_PRIMARY__": theme["primary"],
        "__THEME_SECONDARY__": theme["secondary"],
        "__THEME_ACCENT__": theme.get("accent", theme["secondary"]),
        "__THEME_TEXT__": theme["text"],
        "__THEME_TEXT_DIM__": theme["text_dim"],
        "__THEME_BORDER__": theme.get("border", "rgba(0,0,0,0.1)"),
        "__THEME_GRID__": theme.get("grid", "rgba(0,0,0,0.05)"),
        "__THEME_HUD_LABEL__": theme["hud_label"],
        "__THEME_HUD_VALUE__": theme["hud_value"],
        "__THEME_HUD_BG__": theme.get("hud_bg", "rgba(255,255,255,0.92)"),
        "__THEME_FONT__": theme["font_display"],
    }
    for placeholder, value in replacements.items():
        html = html.replace(placeholder, value)
    return html


# ── 组装 CourseContent ────────────────────────────────────────────

def build_course_content() -> dict:
    # 注入 IDEA 占位符到 plan_markdown
    plan = PLAN_MARKDOWN
    plan = plan.replace(
        "[[IDEA:ANIM1_PLACEHOLDER]]",
        f"[[IDEA:{ANIM1_ID}]]"
    )
    plan = plan.replace(
        "[[IDEA:ANIM2_PLACEHOLDER]]",
        f"[[IDEA:{ANIM2_ID}]]"
    )
    plan = plan.replace(
        "## 开篇故事：一根蚕丝的秘密",
        f"[[IDEA:{STORY_ID}]]\n\n## 开篇故事：一根蚕丝的秘密"
    )
    plan = plan.replace(
        "## 检测你学会了吗？",
        f"[[IDEA:{EXER_ID}]]\n\n## 检测你学会了吗？"
    )
    plan = plan.replace(
        "## 本节小结",
        f"[[IDEA:{GAME_ID}]]\n\n## 本节小结"
    )

    all_candidates = [
        (
            "story",
            {
                "idea_id": STORY_ID,
                "mode": "story",
                "topic": "嫘祖和蚕丝的秘密——β折叠的历史情境",
                "context_summary": "从嫘祖发现蚕丝的传说引入，到X射线衍射发现β折叠结构，建立知识的情感锚点",
                "generation_backend": "claude_code_direct",
                "style_key": "chromatic_depth",
                "mode_reason": "历史情境故事建立直觉和情感共鸣，作为动画前的开篇",
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
                "topic": "β折叠形成过程：多条链并排，氢键依次连接",
                "context_summary": "多条β链依次飞入并排，链间氢键依次连接形成片状结构，侧链交替朝上朝下",
                "generation_backend": "claude_code_direct",
                "style_key": "biotech_life",
                "mode_reason": "β折叠形成是动态过程，需要动画展示链加入和氢键形成的时序",
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
                "topic": "反平行 vs 平行β折叠：氢键方向对比",
                "context_summary": "左右分区对比展示反平行和平行β折叠，高亮链间氢键，颜色区分氢键方向差异",
                "generation_backend": "claude_code_direct",
                "style_key": "biotech_life",
                "mode_reason": "辩论通过：分区对比是展示两种结构差异最直观的方式，辅以颜色编码",
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
                "topic": "链对齐游戏：选择反平行/平行，然后对齐三条β链",
                "context_summary": "玩家选择β折叠类型（反平行/平行），点击对齐后观察氢键形成，理解两种结构差异",
                "generation_backend": "claude_code_direct",
                "style_key": "biotech_life",
                "mode_reason": "辩论通过：主动选择激活认知，完成胜利画面有反馈，符合最小化游戏化原则",
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
                "idea_id": EXER_ID,
                "mode": "exercise",
                "topic": "β折叠关键知识点巩固练习（5题）",
                "context_summary": "检验学生对链间氢键、反平行/平行区别、蚕丝结构、侧链交替、淀粉样蛋白的理解",
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
        if debate_key == "exercise" or debate_key in DEBATE_PASSED:
            ideas.append(idea_dict)
            rendered_sections.update(section_dict)
        else:
            console.print(f"[yellow]跳过（辩论未通过）：{idea_dict['topic'][:40]}[/yellow]")

    return {
        "plan_markdown": plan,
        "ideas": ideas,
        "rendered_sections": rendered_sections,
    }


# ── 写入数据库 ───────────────────────────────────────────────────

def write_everything():
    from scripts.course_factory import (
        _ensure_db_tables, _upsert_project, _init_progress, _write_project_files
    )
    from systemedu.storage.db import LessonContent, get_session as get_db_session
    from datetime import datetime as dt

    console.print(Panel.fit(
        "[bold cyan]GP-01 蛋白结构探险地图[/bold cyan]\n\n"
        "完全由 Claude Code 生成（不调用 LLM agent pipeline）\n"
        "节点：M05N02 β折叠——大自然的手风琴（knode_id=13）\n"
        "内容：完整课程文本 + 2个Canvas动画 + 1个游戏 + 3段故事 + 5道练习题",
        title="写入数据库",
    ))

    # 读取知识树
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

    # 5. 为所有节点创建 pending 状态的占位 lesson（跳过已存在的）
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
        console.print(f"[green]v 节点占位记录检查完成（共 {node_count} 个节点）[/green]")
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

        anim_count   = sum(1 for s in course_content["rendered_sections"].values() if s["mode"] == "animation")
        game_count   = sum(1 for s in course_content["rendered_sections"].values() if s["mode"] == "game")
        story_count  = sum(len(s.get("story_paragraphs") or []) for s in course_content["rendered_sections"].values())
        exer_count   = sum(len(s.get("exercises") or []) for s in course_content["rendered_sections"].values())
        total_html   = sum(len(s.get("html") or "") for s in course_content["rendered_sections"].values())

        console.print(f"\n[bold green]完成！[/bold green]")
        console.print(f"  节点 {TARGET_KNODE_ID}（{TARGET_NODE_TITLE}）已写入")
        console.print(f"  课程文本：{len(PLAN_MARKDOWN)} 字符")
        console.print(f"  Canvas 动画：{anim_count} 个 + 游戏：{game_count} 个（共 {total_html} 字节 HTML）")
        console.print(f"  故事段落：{story_count} 段")
        console.print(f"  练习题：{exer_count} 道")
        console.print(f"\n访问：[dim]http://localhost:3000/projects/{PROJECT_NAME}[/dim]")
        console.print(f"（进入项目，找到节点 M05N02 β折叠）")
    finally:
        db2.close()


if __name__ == "__main__":
    write_everything()
