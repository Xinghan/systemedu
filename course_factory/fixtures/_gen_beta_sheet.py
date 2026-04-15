"""
GP-01 蛋白结构探险地图 — 完全由 Claude Code 生成
节点：M05N02「beta折叠：大自然的手风琴」完整课程

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

# ── 课程节点：M05N02 beta折叠 ──────────────────────────────────
TARGET_KNODE_ID = 13
TARGET_NODE_TITLE = "beta折叠：大自然的手风琴"
TARGET_NODE_SUMMARY = (
    "beta折叠片是蛋白质链以锯齿形伸展，多条链段并排通过链间氢键形成的片状结构。"
    "有反平行和平行两种排列，蚕丝蛋白几乎全是beta折叠片。"
)

# ── 步骤1：完整课程文本（plan_markdown）────────────────────────

PLAN_MARKDOWN = r"""# M05N02：beta折叠——大自然的手风琴

> **模块**：二级结构：局部折叠规律
> **知识等级**：L2-操作 | **难度**：3/10 | **预计时长**：30分钟
> **先修知识**：alpha螺旋（M05N01）、氢键直觉（M02N02）、肽键（M04N01）

---

## 开篇故事：一根蚕丝的秘密

你的手里有一根蚕丝。它细得几乎看不见，却能承受比同等粗细的钢丝更大的拉力。摸上去，它比棉布更滑，比合成纤维更细腻。

这根丝是一只蚕用嘴巴吐出来的。蚕不懂化学，不懂纳米材料学，却造出了迄今为止人类无法完全复制的天然纤维。

秘密，就藏在beta折叠里。

---

## 第一部分：什么是beta折叠？

[[IDEA:ANIM1_PLACEHOLDER]]

### beta链（strand）和beta折叠片（sheet）

beta折叠是蛋白质链的另一种规则二级结构，与alpha螺旋并列。

**基本单元是beta链（beta strand）**：
- 蛋白质链在局部区域以**完全伸展的锯齿形**排列
- 每个氨基酸的C-alpha（alpha碳）位置比alpha螺旋中高得多——链条被"拉直"了
- 侧链（R基）**交替朝上和朝下**：单数残基朝上，双数残基朝下（或反之）

**多条beta链并排** -> **beta折叠片（beta sheet）**：
- 两条或更多的beta链平行排列
- 链与链之间通过**链间氢键**（不同于alpha螺旋的链内氢键）连接
- 形成一张"平的"（实际上略微扭曲）片状结构

类比：手风琴。把一张纸反复折叠成手风琴/折扇形，每道折痕就是一个氨基酸的C-alpha，折叠后把多张手风琴并排——就是beta折叠片。

### 关键数字（理解，不用背）

| 参数 | 数值 | 意义 |
|------|------|------|
| 每残基长度 | **0.35纳米** | 比alpha螺旋的0.15nm更伸展 |
| 链间距 | **0.47纳米** | 相邻beta链之间的距离 |
| 侧链交替 | 上/下交替 | 使折叠片有两个不同的"面" |

---

## 第二部分：反平行与平行——两种排列方式

[[IDEA:ANIM2_PLACEHOLDER]]

beta折叠片有两种形式，区别在于相邻beta链的方向：

### 对比表格

| 特征 | 反平行beta折叠（antiparallel） | 平行beta折叠（parallel） |
|------|---------------------------|----------------------|
| 相邻链方向 | 相反（上下上下） | 相同（上上上上） |
| 氢键方向 | 几乎垂直于链轴（更直） | 与链轴略倾斜 |
| 稳定性 | 更高（氢键更线性） | 稍低（氢键略扭曲） |
| 常见来源 | 同一条链的不同段（通过发夹环相连） | 来自分子中相距较远的链段 |
| 典型示例 | 免疫球蛋白（抗体）、丝蛋白 | TIM桶（代谢酶） |

### 反平行beta折叠：链间氢键的几何

在反平行排列中：
- 链A从左到右走，链B从右到左走
- 链A的 N-H 与链B的 C=O **直接对齐**，形成接近180度的线性氢键
- 这种线性氢键能量最高，稳定性最强
- 相邻的氢键成对出现，像拉链的齿

### 平行beta折叠：氢键几何

在平行排列中：
- 链A和链B都从左到右走
- 氢键必须"倾斜"才能连接两条平行的链
- 氢键角度偏离线性，稳定性略低

---

## 第三部分：侧链的上下交替排列

这是beta折叠最有趣的几何特征之一。

在beta链中，每个氨基酸的C-alpha位于锯齿形骨架的"顶点"。相邻两个C-alpha位于不同的"折叠面"：
- 残基1：C-alpha朝上 -> 侧链**朝上**（beta折叠片的一面）
- 残基2：C-alpha朝下 -> 侧链**朝下**（beta折叠片的另一面）
- 残基3：侧链**朝上**
- 以此类推...

**重要的生物学含义**：
- beta折叠片有两个"面"，每个面上排布着一组特定的侧链
- 一面通常是疏水侧链（朝向蛋白质核心）
- 另一面通常是亲水侧链（朝向水环境）
- 这种"双面性"在蛋白质折叠的热力学中极其重要

类比：一张硬纸板，一面贴着沙纸（粗糙=疏水），另一面贴着丝绸（光滑=亲水）。

---

## 第四部分：beta折叠在生活中的例子

### 蚕丝：几乎纯beta折叠

蚕丝蛋白（丝素，fibroin）的氨基酸序列有一个规律：**Gly-Ala-Gly-Ala-Gly-Ser** 大量重复。

- Gly（甘氨酸）：最小的氨基酸，侧链只有H，非常小
- Ala（丙氨酸）：甲基侧链，也很小

**为什么要这么小？**
因为beta折叠片是紧密堆叠的——一张片的朝下侧链，与下一张片的朝上侧链，要严密接触。如果侧链太大，就无法堆叠。Gly和Ala的小侧链，使蚕丝蛋白能够堆叠成非常致密的beta折叠片层结构。

**结果**：
- 蚕丝的强度来自beta折叠片中密集的氢键网络
- 蚕丝的光泽来自beta折叠片的规则晶体结构反射光线
- 蚕丝的柔软来自beta折叠片之间只有范德华力（弱，可相对滑动）

### 蜘蛛丝：更极端的设计

蜘蛛拖丝（dragline silk）同样含有大量beta折叠"纳米晶体"，但还含有无规卷曲区段。这种"晶体+橡皮"的复合结构，使蜘蛛丝兼具蚕丝的强度和橡皮筋的弹性——比钢丝更强，比尼龙更弹。

### 淀粉样蛋白：beta折叠的危险变体

阿尔茨海默病、帕金森病等神经退行性疾病，与"淀粉样纤维"有关。

淀粉样纤维是**beta折叠的一种极端堆叠形式**：
- 蛋白质分子错误折叠，形成beta链
- 成千上万的beta链从不同蛋白质分子借来，堆叠成纤维
- 这些纤维不溶于水，不能被细胞降解
- 它们沉积在大脑中，破坏神经元

beta折叠本身没有"好坏"，但它那种稳定的氢键网络，在错误地方形成时，会成为细胞无法清除的"垃圾"。这就是结构决定功能——以及功能失常——的力量。

---

## 第五部分：beta折叠 vs alpha螺旋——核心对比

| 特征 | alpha螺旋 | beta折叠 |
|------|-------|-------|
| 形状 | 弹簧（右手螺旋） | 片状（锯齿形） |
| 氢键类型 | 链内（第i与第i+4） | 链间（不同beta链之间） |
| 侧链位置 | 均匀朝外（螺旋轴外侧） | 交替朝上/朝下 |
| 伸展程度 | 链被压缩（每残基0.15nm） | 链被伸展（每残基0.35nm） |
| 代表蛋白 | 角蛋白（头发/指甲） | 蚕丝（丝蛋白）、抗体 |
| 机械性质 | 弹性（弹簧） | 高强度（片层堆叠） |
| 破坏因素 | 脯氨酸（P） | Gly比脯氨酸更容易出现在转角 |

---

## 第六部分：历史——X射线晶体学和beta折叠的发现

beta折叠和alpha螺旋是同一位科学家在同一年（1951年）提出的——Linus Pauling 和 Robert Corey。

### 发现的关键工具：X射线衍射

将蛋白质或蛋白质纤维制成晶体，用X射线照射，X射线会被原子散射，在胶片上形成衍射图样。从衍射图样的间距，可以推断出原子排列的周期和距离。

**alpha螺旋的发现**：衍射图样中有0.54nm的周期（螺距）

**beta折叠的发现**：蚕丝蛋白的衍射图样中有0.35nm的周期（beta链方向的残基间距）和0.47nm（链间距）——与Pauling-Corey的beta折叠模型完全匹配。

1951年，Pauling 在生病期间靠几何推理提出了这两种结构。1953年，Watson 和 Crick 发现DNA双螺旋时，正是受到了Pauling提出alpha螺旋的方法论启发。

---

## 本节小结

| 特征 | beta折叠 |
|------|-------|
| 基本单元 | beta链（锯齿形伸展的肽段） |
| 片的形成 | 多条beta链并排，链间氢键连接 |
| 两种排列 | 反平行（更稳定）+ 平行（稍不稳定） |
| 侧链 | 交替朝上/朝下（两面不同） |
| 每残基长度 | 0.35nm（比alpha螺旋0.15nm更伸展） |
| 代表蛋白 | 蚕丝（丝蛋白）、蜘蛛丝、抗体、淀粉样纤维 |
| 发现者 | Linus Pauling & Robert Corey，1951年 |

**核心直觉**：beta折叠是多肽链"伸展+并排"的结果。链内没有氢键，氢键在链与链之间。侧链一上一下交替，使折叠片有两个性质不同的面。蚕丝的强度和光泽，来自密集排列的beta折叠片层和其中无数的氢键。

---

## 检测你学会了吗？

1. beta折叠中，氢键在哪里形成？（在不同beta链之间，链间氢键）
2. 反平行beta折叠中，相邻beta链的方向是什么关系？（方向相反）
3. 为什么蚕丝蛋白含有大量Gly（甘氨酸）和Ala（丙氨酸）？（侧链小，允许beta折叠片紧密堆叠）
4. beta链中侧链朝向有什么规律？（交替朝上和朝下）
5. 淀粉样纤维是什么结构？（错误堆叠的大量beta折叠）
"""

ANIM1_ID = _id("anim")
ANIM2_ID = _id("anim")
GAME_ID  = _id("game")
STORY_ID = _id("story")
EXER_ID  = _id("ex")

# ── 动画1：beta折叠形成 HUD（HTML+SVG 仪表盘风格）─────────────
# 中央 SVG: 5条beta链以锯齿形水平排列，链间H-bond虚线
# 左侧 panel: SHEET_ANALYSIS（strand count, H-bonds, chain spacing, residue spacing）
# 右侧 panel: STRAND_INDEX
# 底部 HUD: STRANDS / H-BONDS / TYPE / STABILITY

ANIM1_HTML = r"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SHEET_ASSEMBLY</title>
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
.strand-item{display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:3px;margin-bottom:2px;transition:background 0.2s}
.strand-item.active{background:__THEME_PRIMARY__15}
.strand-dot{width:8px;height:8px;border-radius:50%;background:__THEME_PRIMARY__;box-shadow:0 0 4px __THEME_PRIMARY__}
.strand-dot.dim{background:__THEME_SURFACE_HIGHEST__;box-shadow:none}
.strand-id{font-size:9px;font-weight:600;color:__THEME_TEXT_DIM__;min-width:16px}
.strand-dir{font-size:9px;color:__THEME_TEXT__;letter-spacing:0.05em}
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
      <span class="title">SHEET_ASSEMBLY</span>
    </div>
    <div class="ctrl-btns">
      <button class="ctrl-btn active" id="btnPlay" onclick="startAnim()">PLAY</button>
      <button class="ctrl-btn" id="btnReset" onclick="resetAnim()">RESET</button>
    </div>
  </div>

  <div class="pnl pnl-l">
    <div class="sect fi">
      <div class="ch ch-p"></div>
      <div class="hl">SHEET_TYPE</div>
      <div class="hv hv-p">BETA</div>
      <div style="font-size:9px;color:__THEME_TEXT_DIM__;margin-top:2px">ANTIPARALLEL</div>
    </div>
    <div class="sect fi" style="animation-delay:0.1s">
      <div class="ch ch-s"></div>
      <div class="hl">SHEET_ANALYSIS</div>
      <div class="dr"><span class="k">STRAND_COUNT</span><span class="v" id="leftStrands">1</span></div>
      <div class="dr"><span class="k">H-BONDS</span><span class="v" id="leftHB">0</span></div>
      <div class="dr"><span class="k">CHAIN_SPACING</span><span class="v">0.47 nm</span></div>
      <div class="dr"><span class="k">RESIDUE_SPACING</span><span class="v">0.35 nm</span></div>
    </div>
    <div class="sect fi" style="animation-delay:0.15s">
      <div class="ch ch-a"></div>
      <div class="hl">H-BOND_PATTERN</div>
      <div class="dr"><span class="k">TYPE</span><span class="v">INTER-CHAIN</span></div>
      <div class="dr"><span class="k">DIRECTION</span><span class="v">PERPENDICULAR</span></div>
      <div class="dr"><span class="k">GEOMETRY</span><span class="v">~180 DEG</span></div>
    </div>
    <div class="sect fi" style="animation-delay:0.2s">
      <div class="hl">PHASE</div>
      <div class="hv hv-s" id="phaseLabel">STANDBY</div>
    </div>
  </div>

  <div class="center" id="centerStage">
    <svg id="sheetSvg" viewBox="0 0 440 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="hbGlow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="beadGrad" cx="35%" cy="30%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="50%" stop-color="__THEME_PRIMARY__"/><stop offset="100%" stop-color="__THEME_BG__" stop-opacity="0.8"/></radialGradient>
        <radialGradient id="scGrad" cx="35%" cy="30%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="50%" stop-color="__THEME_SECONDARY__"/><stop offset="100%" stop-color="__THEME_BG__" stop-opacity="0.6"/></radialGradient>
        <marker id="arrowR" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L6,2 L0,4" fill="__THEME_PRIMARY__" opacity="0.7"/></marker>
        <marker id="arrowL" markerWidth="6" markerHeight="4" refX="1" refY="2" orient="auto"><path d="M6,0 L0,2 L6,4" fill="__THEME_SECONDARY__" opacity="0.7"/></marker>
      </defs>
      <!-- Background refs -->
      <g opacity="0.04" stroke="__THEME_PRIMARY__" fill="none" stroke-width="0.5">
        <line x1="220" y1="0" x2="220" y2="300"/>
        <line x1="0" y1="150" x2="440" y2="150"/>
        <circle cx="220" cy="150" r="60"/><circle cx="220" cy="150" r="120"/>
      </g>
      <!-- Scan line -->
      <rect x="0" y="0" width="440" height="1.5" fill="__THEME_PRIMARY__" opacity="0.05">
        <animateTransform attributeName="transform" type="translate" values="0,0;0,300;0,0" dur="6s" repeatCount="indefinite"/>
      </rect>
      <g id="hbonds"></g>
      <g id="strands"></g>
      <g id="beads"></g>
      <g id="arrows"></g>
      <g id="labels"></g>
    </svg>
  </div>

  <div class="pnl pnl-r">
    <div class="sect">
      <div class="ch ch-p"></div>
      <div class="hl">STRAND_INDEX</div>
    </div>
    <div id="strandIndex"></div>
  </div>

  <div class="bhud">
    <div class="hc"><div class="hl">STRANDS</div><div class="hv" id="hudStrands">1</div></div>
    <div class="hc"><div class="hl">H-BONDS</div><div class="hv" id="hudHB">0</div></div>
    <div class="hc"><div class="hl">TYPE</div><div class="hv" style="font-size:13px">ANTIPARALLEL</div></div>
    <div class="hc"><div class="hl">STABILITY</div><div class="hv" id="hudStab" style="font-size:13px">LOW</div></div>
  </div>
</div>

<script>
(function(){
"use strict";

var NSTRANDS = 5;
var NRES = 7;
var RES_DX = 40;
var STRAND_DY = 48;
var ZIG = 12;
var CX = 220, CY = 150;
var BEAD_R = 8;

var strandsG = document.getElementById("strands");
var beadsG = document.getElementById("beads");
var hbG = document.getElementById("hbonds");
var arrowsG = document.getElementById("arrows");
var labG = document.getElementById("labels");
var phaseLabel = document.getElementById("phaseLabel");
var hudHB = document.getElementById("hudHB");
var hudStrands = document.getElementById("hudStrands");
var hudStab = document.getElementById("hudStab");
var leftStrands = document.getElementById("leftStrands");
var leftHB = document.getElementById("leftHB");

// Populate strand index
var strandIndex = document.getElementById("strandIndex");
var DIRS = ["N -> C", "C -> N", "N -> C", "C -> N", "N -> C"];
for(var i=0;i<NSTRANDS;i++){
  var d = document.createElement("div");
  d.className = "strand-item"; d.id = "si-"+i;
  d.innerHTML = '<div class="strand-dot dim"></div><span class="strand-id">#'+(i+1)+'</span><span class="strand-dir">'+DIRS[i]+'</span>';
  strandIndex.appendChild(d);
}

// Residue positions for each strand
function resXY(si, ri){
  var topY = CY - (NSTRANDS-1)*STRAND_DY/2;
  var y0 = topY + si * STRAND_DY;
  var flip = (si % 2 === 1); // antiparallel
  var xStart = CX - (NRES-1)*RES_DX/2;
  var xEnd = CX + (NRES-1)*RES_DX/2;
  var x = flip ? (xEnd - ri*RES_DX) : (xStart + ri*RES_DX);
  var zig = ((ri%2===0)?1:-1) * ZIG;
  return {x:x, y:y0+zig};
}

var phase = "standby"; // standby -> strand1 -> strand2 -> ... -> strand5 -> hbonds -> complete
var visibleStrands = 1;
var hbondsShown = 0;
var maxHBonds = (NSTRANDS-1)*NRES;
var animTimer = null;

function render(){
  strandsG.innerHTML=""; beadsG.innerHTML=""; hbG.innerHTML=""; arrowsG.innerHTML=""; labG.innerHTML="";

  // Draw strands (backbone lines)
  for(var si=0; si<visibleStrands; si++){
    var pts = [];
    for(var ri=0; ri<NRES; ri++){
      pts.push(resXY(si, ri));
    }
    // Glow layer
    var pg = document.createElementNS("http://www.w3.org/2000/svg","polyline");
    var pstr = pts.map(function(p){return p.x+","+p.y}).join(" ");
    pg.setAttribute("points",pstr);
    pg.setAttribute("fill","none");
    pg.setAttribute("stroke","__THEME_PRIMARY__");
    pg.setAttribute("stroke-width","5");
    pg.setAttribute("opacity","0.15");
    pg.setAttribute("filter","url(#glow)");
    strandsG.appendChild(pg);
    // Clear layer
    var pc = document.createElementNS("http://www.w3.org/2000/svg","polyline");
    pc.setAttribute("points",pstr);
    pc.setAttribute("fill","none");
    pc.setAttribute("stroke", si%2===0?"__THEME_PRIMARY__":"__THEME_SECONDARY__");
    pc.setAttribute("stroke-width","2");
    pc.setAttribute("opacity","0.8");
    strandsG.appendChild(pc);

    // Direction arrow
    var flip = (si%2===1);
    var topY2 = CY - (NSTRANDS-1)*STRAND_DY/2;
    var ay = topY2 + si*STRAND_DY;
    var xStart = CX - (NRES-1)*RES_DX/2;
    var xEnd = CX + (NRES-1)*RES_DX/2;
    var al = document.createElementNS("http://www.w3.org/2000/svg","line");
    al.setAttribute("x1", flip?(xEnd+8):(xStart-8));
    al.setAttribute("y1", ay);
    al.setAttribute("x2", flip?(xStart-4):(xEnd+4));
    al.setAttribute("y2", ay);
    al.setAttribute("stroke", si%2===0?"__THEME_PRIMARY__":"__THEME_SECONDARY__");
    al.setAttribute("stroke-width","1.5");
    al.setAttribute("opacity","0.5");
    al.setAttribute("marker-end", flip?"url(#arrowL)":"url(#arrowR)");
    arrowsG.appendChild(al);

    // Beads
    for(var ri2=0; ri2<NRES; ri2++){
      var p = resXY(si, ri2);
      // Outer glow
      var gc = document.createElementNS("http://www.w3.org/2000/svg","circle");
      gc.setAttribute("cx",p.x); gc.setAttribute("cy",p.y);
      gc.setAttribute("r","14"); gc.setAttribute("fill",si%2===0?"__THEME_PRIMARY__":"__THEME_SECONDARY__"); gc.setAttribute("opacity","0.08");
      beadsG.appendChild(gc);
      // Main bead
      var c = document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute("cx",p.x); c.setAttribute("cy",p.y);
      c.setAttribute("r",BEAD_R.toString()); c.setAttribute("fill","url(#beadGrad)"); c.setAttribute("filter","url(#glow)");
      beadsG.appendChild(c);
      // Specular
      var sp = document.createElementNS("http://www.w3.org/2000/svg","ellipse");
      sp.setAttribute("cx",p.x-2); sp.setAttribute("cy",p.y-2);
      sp.setAttribute("rx","3"); sp.setAttribute("ry","2");
      sp.setAttribute("fill","white"); sp.setAttribute("opacity","0.3");
      beadsG.appendChild(sp);
      // Label (only on strand 0)
      if(si===0){
        var tx = document.createElementNS("http://www.w3.org/2000/svg","text");
        tx.setAttribute("x",p.x); tx.setAttribute("y",p.y+3);
        tx.setAttribute("text-anchor","middle"); tx.setAttribute("font-family","'Space Grotesk',sans-serif");
        tx.setAttribute("font-size","7"); tx.setAttribute("font-weight","600"); tx.setAttribute("fill","white");
        tx.textContent = (ri2+1).toString();
        beadsG.appendChild(tx);
      }
    }
  }

  // H-bonds between adjacent strands
  if(hbondsShown > 0){
    var drawn = 0;
    for(var si3=0; si3<visibleStrands-1 && drawn<hbondsShown; si3++){
      for(var ri3=0; ri3<NRES && drawn<hbondsShown; ri3++){
        var pa = resXY(si3, ri3);
        var pb = resXY(si3+1, ri3);
        // Glow
        var gl = document.createElementNS("http://www.w3.org/2000/svg","line");
        gl.setAttribute("x1",pa.x); gl.setAttribute("y1",pa.y);
        gl.setAttribute("x2",pb.x); gl.setAttribute("y2",pb.y);
        gl.setAttribute("stroke","__THEME_ACCENT__"); gl.setAttribute("stroke-width","4");
        gl.setAttribute("opacity","0.15"); gl.setAttribute("filter","url(#hbGlow)");
        hbG.appendChild(gl);
        // Dashed bond
        var hl = document.createElementNS("http://www.w3.org/2000/svg","line");
        hl.setAttribute("x1",pa.x); hl.setAttribute("y1",pa.y);
        hl.setAttribute("x2",pb.x); hl.setAttribute("y2",pb.y);
        hl.setAttribute("stroke","__THEME_ACCENT__"); hl.setAttribute("stroke-width","1.5");
        hl.setAttribute("stroke-dasharray","4,3"); hl.setAttribute("opacity","0.7");
        hbG.appendChild(hl);
        drawn++;
      }
    }
  }

  // Update strand index panel
  for(var i2=0; i2<NSTRANDS; i2++){
    var el = document.getElementById("si-"+i2);
    var dot = el.querySelector(".strand-dot");
    if(i2 < visibleStrands){
      el.className = "strand-item active";
      dot.className = "strand-dot";
    } else {
      el.className = "strand-item";
      dot.className = "strand-dot dim";
    }
  }

  // Update HUD numbers
  hudStrands.textContent = visibleStrands.toString();
  leftStrands.textContent = visibleStrands.toString();
  hudHB.textContent = hbondsShown.toString();
  leftHB.textContent = hbondsShown.toString();
}

function addStrand(){
  if(visibleStrands < NSTRANDS){
    visibleStrands++;
    phaseLabel.textContent = "STRAND_" + visibleStrands + "_JOINING";
    render();
    animTimer = setTimeout(function(){
      if(visibleStrands < NSTRANDS){
        addStrand();
      } else {
        phaseLabel.textContent = "H-BONDS_FORMING";
        animTimer = setTimeout(addHBonds, 400);
      }
    }, 800);
  }
}

function addHBonds(){
  if(hbondsShown < maxHBonds){
    hbondsShown += NRES; // add one row of bonds at a time
    if(hbondsShown > maxHBonds) hbondsShown = maxHBonds;
    var pairsDone = Math.ceil(hbondsShown / NRES);
    var stabLevels = ["LOW","LOW","MODERATE","HIGH","VERY_HIGH"];
    hudStab.textContent = stabLevels[Math.min(pairsDone, stabLevels.length-1)];
    render();
    if(hbondsShown < maxHBonds){
      animTimer = setTimeout(addHBonds, 600);
    } else {
      phaseLabel.textContent = "COMPLETE";
      hudStab.textContent = "VERY_HIGH";
    }
  }
}

window.startAnim = function(){
  if(phase !== "standby") return;
  phase = "running";
  phaseLabel.textContent = "STRAND_1_ACTIVE";
  document.getElementById("btnPlay").classList.add("active");
  animTimer = setTimeout(addStrand, 600);
};

window.resetAnim = function(){
  if(animTimer) clearTimeout(animTimer);
  phase = "standby"; visibleStrands = 1; hbondsShown = 0;
  phaseLabel.textContent = "STANDBY";
  hudStab.textContent = "LOW";
  document.getElementById("btnPlay").classList.remove("active");
  render();
};

render();
})();
</script>
</body>
</html>"""


# ── 动画2：反平行 vs 平行 对比 HUD ──────────────────────────────
# 左右分区：ANTIPARALLEL / PARALLEL 切换
# 中央 SVG: 3条链 + 方向箭头 + H-bonds

ANIM2_HTML = r"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SHEET_COMPARATOR</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:__THEME_BG__;font-family:__THEME_FONT__;color:__THEME_TEXT__;user-select:none}
.hud{width:100%;height:100%;display:grid;grid-template-rows:44px 1fr 56px;grid-template-columns:180px 1fr 180px;gap:0}
.top-bar{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:rgba(12,14,18,0.6);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid __THEME_BORDER__;z-index:10}
.top-bar .title{font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:__THEME_PRIMARY__;text-shadow:0 0 15px __THEME_PRIMARY__40}
.status-dot{width:6px;height:6px;border-radius:50%;background:__THEME_ACCENT__;box-shadow:0 0 8px __THEME_ACCENT__;animation:pdot 2s infinite}
.ctrl-btns{display:flex;gap:4px}
.ctrl-btn{padding:5px 12px;border-radius:4px;border:1px solid __THEME_BORDER__;background:__THEME_SURFACE__;color:__THEME_TEXT_DIM__;font-family:__THEME_FONT__;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.2s;letter-spacing:0.08em;text-transform:uppercase}
.ctrl-btn:hover{border-color:__THEME_PRIMARY__60;color:__THEME_PRIMARY__}
.ctrl-btn.active{background:__THEME_PRIMARY__18;border-color:__THEME_PRIMARY__;color:__THEME_PRIMARY__;box-shadow:0 0 12px __THEME_PRIMARY__25}
.ctrl-btn.active-s{background:__THEME_SECONDARY__18;border-color:__THEME_SECONDARY__;color:__THEME_SECONDARY__;box-shadow:0 0 12px __THEME_SECONDARY__25}
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
.cmp-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(70,72,77,0.06)}
.cmp-label{font-size:9px;color:__THEME_TEXT_DIM__;letter-spacing:0.08em;text-transform:uppercase;width:55px}
.cmp-anti{font-size:10px;font-weight:600;color:__THEME_PRIMARY__;text-align:center;flex:1}
.cmp-para{font-size:10px;font-weight:600;color:__THEME_SECONDARY__;text-align:center;flex:1}
@keyframes pdot{0%,100%{opacity:1}50%{opacity:0.4}}
</style>
</head>
<body>
<div class="hud">
  <div class="top-bar">
    <div style="display:flex;align-items:center;gap:10px">
      <span class="status-dot"></span>
      <span class="title">SHEET_COMPARATOR</span>
    </div>
    <div class="ctrl-btns">
      <button class="ctrl-btn active" id="btnAnti" onclick="showType('anti')">ANTIPARALLEL</button>
      <button class="ctrl-btn" id="btnPara" onclick="showType('para')">PARALLEL</button>
    </div>
  </div>

  <div class="pnl pnl-l">
    <div class="sect">
      <div class="ch ch-p"></div>
      <div class="hl">CURRENT_TYPE</div>
      <div class="hv hv-p" id="typeName" style="font-size:14px">ANTIPARALLEL</div>
    </div>
    <div class="sect">
      <div class="ch ch-a"></div>
      <div class="hl">PROPERTIES</div>
      <div class="dr"><span class="k">CHAIN_DIR</span><span class="v" id="propDir">ALTERNATING</span></div>
      <div class="dr"><span class="k">H-BOND_ANGLE</span><span class="v" id="propAngle">~180 DEG</span></div>
      <div class="dr"><span class="k">STABILITY</span><span class="v" id="propStab">HIGH</span></div>
      <div class="dr"><span class="k">H-BOND_SHAPE</span><span class="v" id="propShape">STRAIGHT</span></div>
    </div>
    <div class="sect">
      <div class="ch ch-s"></div>
      <div class="hl">EXAMPLES</div>
      <div class="dr"><span class="k" id="ex1k">SILK</span><span class="v" id="ex1v">FIBROIN</span></div>
      <div class="dr"><span class="k" id="ex2k">IMMUNE</span><span class="v" id="ex2v">ANTIBODY</span></div>
    </div>
  </div>

  <div class="center">
    <svg id="cmpSvg" viewBox="0 0 440 280" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="gl2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="hgl2"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="bg2" cx="35%" cy="30%"><stop offset="0%" stop-color="#fff" stop-opacity="0.6"/><stop offset="50%" stop-color="__THEME_PRIMARY__"/><stop offset="100%" stop-color="__THEME_BG__" stop-opacity="0.7"/></radialGradient>
        <radialGradient id="bg2s" cx="35%" cy="30%"><stop offset="0%" stop-color="#fff" stop-opacity="0.6"/><stop offset="50%" stop-color="__THEME_SECONDARY__"/><stop offset="100%" stop-color="__THEME_BG__" stop-opacity="0.7"/></radialGradient>
        <marker id="ar2R" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L6,2 L0,4" fill="__THEME_PRIMARY__" opacity="0.8"/></marker>
        <marker id="ar2L" markerWidth="6" markerHeight="4" refX="1" refY="2" orient="auto"><path d="M6,0 L0,2 L6,4" fill="__THEME_SECONDARY__" opacity="0.8"/></marker>
        <marker id="ar2Rs" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L6,2 L0,4" fill="__THEME_SECONDARY__" opacity="0.8"/></marker>
      </defs>
      <g opacity="0.04" stroke="__THEME_PRIMARY__" fill="none" stroke-width="0.5">
        <line x1="220" y1="0" x2="220" y2="280"/>
        <line x1="0" y1="140" x2="440" y2="140"/>
      </g>
      <g id="cmpBonds"></g>
      <g id="cmpStrands"></g>
      <g id="cmpBeads"></g>
      <g id="cmpArrows"></g>
      <g id="cmpLabels"></g>
    </svg>
  </div>

  <div class="pnl pnl-r">
    <div class="sect">
      <div class="ch ch-a"></div>
      <div class="hl">COMPARISON</div>
    </div>
    <div class="cmp-row">
      <span class="cmp-label">METRIC</span>
      <span class="cmp-anti" style="font-size:8px;color:__THEME_PRIMARY__">ANTI</span>
      <span class="cmp-para" style="font-size:8px;color:__THEME_SECONDARY__">PARA</span>
    </div>
    <div class="cmp-row">
      <span class="cmp-label">DIR</span>
      <span class="cmp-anti">ALT</span>
      <span class="cmp-para">SAME</span>
    </div>
    <div class="cmp-row">
      <span class="cmp-label">ANGLE</span>
      <span class="cmp-anti">~180</span>
      <span class="cmp-para">~160</span>
    </div>
    <div class="cmp-row">
      <span class="cmp-label">STABLE</span>
      <span class="cmp-anti">HIGH</span>
      <span class="cmp-para">MEDIUM</span>
    </div>
    <div class="cmp-row">
      <span class="cmp-label">BOND</span>
      <span class="cmp-anti">STRAIGHT</span>
      <span class="cmp-para">ANGLED</span>
    </div>
    <div class="cmp-row">
      <span class="cmp-label">EXAMPLE</span>
      <span class="cmp-anti" style="font-size:8px">SILK</span>
      <span class="cmp-para" style="font-size:8px">TIM BARREL</span>
    </div>
  </div>

  <div class="bhud">
    <div class="hc"><div class="hl">TYPE</div><div class="hv" id="bType" style="font-size:13px">ANTIPARALLEL</div></div>
    <div class="hc"><div class="hl">H-BOND_ANGLE</div><div class="hv" id="bAngle" style="font-size:13px">~180 DEG</div></div>
    <div class="hc"><div class="hl">STABILITY</div><div class="hv" id="bStab" style="font-size:13px">HIGH</div></div>
    <div class="hc"><div class="hl">EXAMPLES</div><div class="hv" id="bExamples" style="font-size:11px">SILK / ANTIBODY</div></div>
  </div>
</div>

<script>
(function(){
"use strict";

var NSTRANDS = 3;
var NRES = 6;
var RES_DX = 44;
var STRAND_DY = 60;
var ZIG = 12;
var CX = 220, CY = 140;
var BEAD_R = 7;

var bondsG = document.getElementById("cmpBonds");
var strandsG2 = document.getElementById("cmpStrands");
var beadsG2 = document.getElementById("cmpBeads");
var arrowsG2 = document.getElementById("cmpArrows");
var labG2 = document.getElementById("cmpLabels");

var currentType = "anti"; // "anti" or "para"

function resXY(si, ri, antiparallel){
  var topY = CY - (NSTRANDS-1)*STRAND_DY/2;
  var y0 = topY + si*STRAND_DY;
  var flip = antiparallel && (si%2===1);
  var xStart = CX - (NRES-1)*RES_DX/2;
  var xEnd = CX + (NRES-1)*RES_DX/2;
  var x = flip ? (xEnd - ri*RES_DX) : (xStart + ri*RES_DX);
  var zig = ((ri%2===0)?1:-1)*ZIG;
  return {x:x, y:y0+zig};
}

function renderType(type){
  bondsG.innerHTML=""; strandsG2.innerHTML=""; beadsG2.innerHTML=""; arrowsG2.innerHTML=""; labG2.innerHTML="";
  var isAnti = (type === "anti");
  var col1 = "__THEME_PRIMARY__";
  var col2 = "__THEME_SECONDARY__";

  for(var si=0; si<NSTRANDS; si++){
    var pts=[];
    for(var ri=0; ri<NRES; ri++){
      pts.push(resXY(si, ri, isAnti));
    }
    var pstr = pts.map(function(p){return p.x+","+p.y}).join(" ");
    // Glow
    var pg = document.createElementNS("http://www.w3.org/2000/svg","polyline");
    pg.setAttribute("points",pstr); pg.setAttribute("fill","none");
    pg.setAttribute("stroke",isAnti?(si%2===0?col1:col2):col2);
    pg.setAttribute("stroke-width","5"); pg.setAttribute("opacity","0.12"); pg.setAttribute("filter","url(#gl2)");
    strandsG2.appendChild(pg);
    // Clear
    var pc = document.createElementNS("http://www.w3.org/2000/svg","polyline");
    pc.setAttribute("points",pstr); pc.setAttribute("fill","none");
    pc.setAttribute("stroke",isAnti?(si%2===0?col1:col2):col2);
    pc.setAttribute("stroke-width","2"); pc.setAttribute("opacity","0.85");
    strandsG2.appendChild(pc);

    // Arrow
    var topY = CY - (NSTRANDS-1)*STRAND_DY/2;
    var ay = topY + si*STRAND_DY;
    var xStart = CX - (NRES-1)*RES_DX/2;
    var xEnd = CX + (NRES-1)*RES_DX/2;
    var flip = isAnti && (si%2===1);
    var al = document.createElementNS("http://www.w3.org/2000/svg","line");
    al.setAttribute("x1", flip?(xEnd+10):(xStart-10));
    al.setAttribute("y1", ay);
    al.setAttribute("x2", flip?(xStart-6):(xEnd+6));
    al.setAttribute("y2", ay);
    al.setAttribute("stroke",isAnti?(si%2===0?col1:col2):col2);
    al.setAttribute("stroke-width","1.5"); al.setAttribute("opacity","0.6");
    if(isAnti){
      al.setAttribute("marker-end", flip?"url(#ar2L)":"url(#ar2R)");
    } else {
      al.setAttribute("marker-end","url(#ar2Rs)");
    }
    arrowsG2.appendChild(al);

    // Direction label (N->C or C->N)
    var dirText = document.createElementNS("http://www.w3.org/2000/svg","text");
    var labelX = flip ? (xEnd+18) : (xStart-18);
    dirText.setAttribute("x", labelX); dirText.setAttribute("y", ay+3);
    dirText.setAttribute("text-anchor", flip?"start":"end");
    dirText.setAttribute("font-family","'Space Grotesk',sans-serif"); dirText.setAttribute("font-size","7");
    dirText.setAttribute("fill",isAnti?(si%2===0?col1:col2):col2);
    dirText.setAttribute("letter-spacing","0.05em"); dirText.setAttribute("opacity","0.7");
    if(isAnti){
      dirText.textContent = flip ? "C->N" : "N->C";
    } else {
      dirText.textContent = "N->C";
    }
    labG2.appendChild(dirText);

    // Beads
    for(var ri2=0; ri2<NRES; ri2++){
      var p = resXY(si, ri2, isAnti);
      var beadCol = isAnti?(si%2===0?col1:col2):col2;
      var gc = document.createElementNS("http://www.w3.org/2000/svg","circle");
      gc.setAttribute("cx",p.x); gc.setAttribute("cy",p.y);
      gc.setAttribute("r","12"); gc.setAttribute("fill",beadCol); gc.setAttribute("opacity","0.07");
      beadsG2.appendChild(gc);
      var c = document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute("cx",p.x); c.setAttribute("cy",p.y);
      c.setAttribute("r",BEAD_R.toString());
      c.setAttribute("fill",isAnti?(si%2===0?"url(#bg2)":"url(#bg2s)"):"url(#bg2s)");
      c.setAttribute("filter","url(#gl2)");
      beadsG2.appendChild(c);
      var sp = document.createElementNS("http://www.w3.org/2000/svg","ellipse");
      sp.setAttribute("cx",p.x-2); sp.setAttribute("cy",p.y-2);
      sp.setAttribute("rx","3"); sp.setAttribute("ry","2");
      sp.setAttribute("fill","white"); sp.setAttribute("opacity","0.25");
      beadsG2.appendChild(sp);
    }
  }

  // H-bonds between adjacent strands
  var hbColor = "__THEME_ACCENT__";
  for(var si2=0; si2<NSTRANDS-1; si2++){
    for(var ri3=0; ri3<NRES; ri3++){
      var pa = resXY(si2, ri3, isAnti);
      var pb;
      if(isAnti){
        pb = resXY(si2+1, ri3, isAnti);
      } else {
        // Parallel: bonds are slightly angled
        var targetRi = Math.min(ri3, NRES-1);
        pb = resXY(si2+1, targetRi, isAnti);
        pb.x += 6; // offset to show angle
      }
      // Glow
      var gl = document.createElementNS("http://www.w3.org/2000/svg","line");
      gl.setAttribute("x1",pa.x); gl.setAttribute("y1",pa.y);
      gl.setAttribute("x2",pb.x); gl.setAttribute("y2",pb.y);
      gl.setAttribute("stroke",hbColor); gl.setAttribute("stroke-width","4");
      gl.setAttribute("opacity","0.12"); gl.setAttribute("filter","url(#hgl2)");
      bondsG.appendChild(gl);
      // Bond line
      var hl = document.createElementNS("http://www.w3.org/2000/svg","line");
      hl.setAttribute("x1",pa.x); hl.setAttribute("y1",pa.y);
      hl.setAttribute("x2",pb.x); hl.setAttribute("y2",pb.y);
      hl.setAttribute("stroke",hbColor); hl.setAttribute("stroke-width","1.5");
      hl.setAttribute("stroke-dasharray","4,3"); hl.setAttribute("opacity","0.65");
      bondsG.appendChild(hl);
    }
  }

  // Type label in SVG
  var typeLabel = document.createElementNS("http://www.w3.org/2000/svg","text");
  typeLabel.setAttribute("x","220"); typeLabel.setAttribute("y","20");
  typeLabel.setAttribute("text-anchor","middle");
  typeLabel.setAttribute("font-family","'Space Grotesk',sans-serif");
  typeLabel.setAttribute("font-size","11"); typeLabel.setAttribute("font-weight","700");
  typeLabel.setAttribute("letter-spacing","0.15em");
  typeLabel.setAttribute("fill",isAnti?col1:col2);
  typeLabel.setAttribute("opacity","0.9");
  typeLabel.textContent = isAnti ? "ANTIPARALLEL BETA SHEET" : "PARALLEL BETA SHEET";
  labG2.appendChild(typeLabel);

  // Bond angle annotation
  var angleLabel = document.createElementNS("http://www.w3.org/2000/svg","text");
  angleLabel.setAttribute("x","220"); angleLabel.setAttribute("y","268");
  angleLabel.setAttribute("text-anchor","middle");
  angleLabel.setAttribute("font-family","'Space Grotesk',sans-serif");
  angleLabel.setAttribute("font-size","9"); angleLabel.setAttribute("fill","__THEME_TEXT_DIM__");
  angleLabel.setAttribute("letter-spacing","0.1em");
  angleLabel.textContent = isAnti ? "H-BONDS: STRAIGHT (~180 DEG) -- HIGH STABILITY" : "H-BONDS: ANGLED (~160 DEG) -- MEDIUM STABILITY";
  labG2.appendChild(angleLabel);
}

function updatePanels(type){
  var isAnti = (type === "anti");
  document.getElementById("typeName").textContent = isAnti ? "ANTIPARALLEL" : "PARALLEL";
  document.getElementById("propDir").textContent = isAnti ? "ALTERNATING" : "SAME DIR";
  document.getElementById("propAngle").textContent = isAnti ? "~180 DEG" : "~160 DEG";
  document.getElementById("propStab").textContent = isAnti ? "HIGH" : "MEDIUM";
  document.getElementById("propShape").textContent = isAnti ? "STRAIGHT" : "ANGLED";
  document.getElementById("ex1k").textContent = isAnti ? "SILK" : "ENZYME";
  document.getElementById("ex1v").textContent = isAnti ? "FIBROIN" : "TIM BARREL";
  document.getElementById("ex2k").textContent = isAnti ? "IMMUNE" : "KINASE";
  document.getElementById("ex2v").textContent = isAnti ? "ANTIBODY" : "ROSSMANN";
  document.getElementById("bType").textContent = isAnti ? "ANTIPARALLEL" : "PARALLEL";
  document.getElementById("bAngle").textContent = isAnti ? "~180 DEG" : "~160 DEG";
  document.getElementById("bStab").textContent = isAnti ? "HIGH" : "MEDIUM";
  document.getElementById("bExamples").textContent = isAnti ? "SILK / ANTIBODY" : "TIM BARREL / KINASE";
}

window.showType = function(type){
  currentType = type;
  var isAnti = (type === "anti");
  document.getElementById("btnAnti").className = isAnti ? "ctrl-btn active" : "ctrl-btn";
  document.getElementById("btnPara").className = isAnti ? "ctrl-btn" : "ctrl-btn active-s";
  renderType(type);
  updatePanels(type);
};

renderType("anti");
updatePanels("anti");
})();
</script>
</body>
</html>"""


# ── 故事段落 ────────────────────────────────────────────────────

STORY_PARAGRAPHS = [
    {
        "text": "1951年，Linus Pauling 和 Robert Corey 在同一篇论文中提出了两种蛋白质二级结构——alpha螺旋和beta折叠。Pauling生病卧床期间，靠一张纸和纯几何推理，从键长和键角出发，推导出了多肽链可能形成的所有规则结构。",
        "image_url": "",
    },
    {
        "text": "beta折叠的关键证据来自蚕丝蛋白的X射线衍射。物理学家把蚕丝放在X射线下照射，得到了一张衍射图案。图案中有两个特征性间距：0.35纳米（beta链方向的残基间距）和0.47纳米（相邻beta链之间的距离）。这两个数字与Pauling-Corey的beta折叠模型完全匹配。",
        "image_url": "",
    },
    {
        "text": "蚕的嘴巴精确地将丝蛋白分子折叠成beta折叠片，然后把成千上万张beta折叠片层叠在一起。蚕丝的光泽来自规则晶体反射光线，强度来自每张片内数百条氢键，柔软来自片层之间可以滑动。一只蚕不懂纳米材料学，却制造出了人类至今无法完全复制的天然纤维。",
        "image_url": "",
    },
]

# ── 练习题 ──────────────────────────────────────────────────────

EXERCISES = [
    {
        "type": "choice",
        "question": "beta折叠中，氢键存在于哪里？",
        "options": [
            "A. 同一条beta链内（第i与第i+4残基之间）",
            "B. 不同beta链之间（链间氢键）",
            "C. 侧链与骨架之间",
            "D. 侧链与侧链之间",
        ],
        "correct": 1,
        "explanation": "beta折叠的关键特征是链间氢键——不同beta链之间的N-H和C=O形成氢键，将多条链连接成片状结构。这与alpha螺旋的链内氢键（第i与第i+4）截然不同。",
    },
    {
        "type": "choice",
        "question": "反平行beta折叠比平行beta折叠更稳定，原因是？",
        "options": [
            "A. 反平行的链更长",
            "B. 反平行氢键更垂直于链轴，线性程度更高，能量更大",
            "C. 反平行含有更多的氨基酸",
            "D. 反平行的侧链更小",
        ],
        "correct": 1,
        "explanation": "氢键的稳定性取决于供体-氢-受体三者的线性程度（角度越接近180度越稳定）。反平行beta折叠中，两链方向相反，氢键几乎垂直于链轴，接近线性，稳定性更高。",
    },
    {
        "type": "choice",
        "question": "蚕丝蛋白（丝素）含有大量Gly（甘氨酸）和Ala（丙氨酸），原因是？",
        "options": [
            "A. 这两种氨基酸的侧链很小，允许beta折叠片紧密堆叠",
            "B. 这两种氨基酸特别喜欢形成alpha螺旋",
            "C. 这两种氨基酸能形成二硫键",
            "D. 这两种氨基酸的侧链带电荷，互相吸引",
        ],
        "correct": 0,
        "explanation": "beta折叠片的侧链交替朝上朝下。多张beta折叠片堆叠时，一张片朝下的侧链与下一张片朝上的侧链要紧密接触。Gly只有H（最小），Ala有甲基（也很小），使beta折叠片能堆叠得非常致密。",
    },
    {
        "type": "choice",
        "question": "beta折叠中，侧链的排列方式是？",
        "options": [
            "A. 所有侧链均朝外（螺旋轴外侧）",
            "B. 所有侧链均朝向片的同一面",
            "C. 侧链交替朝上和朝下，两面各半",
            "D. 侧链随机朝向",
        ],
        "correct": 2,
        "explanation": "在beta链的锯齿形骨架中，相邻的C-alpha原子交替位于折叠面的两侧，因此侧链也交替朝上和朝下。这使beta折叠片有两个不同的面。",
    },
    {
        "type": "choice",
        "question": "淀粉样纤维（与阿尔茨海默病有关）的结构特征是？",
        "options": [
            "A. 大量alpha螺旋堆叠",
            "B. 大量beta折叠跨分子错误堆叠，形成不溶纤维",
            "C. 随机卷曲的蛋白质聚集",
            "D. 二硫键交联的蛋白质",
        ],
        "correct": 1,
        "explanation": "淀粉样纤维是蛋白质错误折叠后，来自不同蛋白质分子的beta链跨分子堆叠，形成高度有序的交叉beta折叠结构。这种结构非常稳定，不溶于水，细胞无法降解。",
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
    console.print(f"\n[bold]-- Idea 辩论：[cyan]{mode}[/cyan] . {topic[:40]}[/bold]")
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
        topic="Pauling-Corey 和蚕丝的秘密——beta折叠历史故事",
        objections=[
            "故事只有文字，对10岁孩子吸引力不如动画",
            "课程中已有2个动画，3段故事可能冗余",
        ],
        rebuttals=[
            "文字故事补充动画无法传递的情感维度：蚕丝蛋白+X射线衍射这个组合比动画更有历史纵深感",
            "故事是两个动画之间的呼吸节点，有故事比没有更有学习完成感",
        ],
        scores={"teaching_fit": 7, "feasibility": 10, "cognitive": 7, "completion": 7},
    ),
    "anim1": _debate_idea(
        idea_id="anim1", mode="animation",
        topic="beta折叠形成 HUD：多条链并排，氢键依次连接",
        objections=[
            "5条链同时在视野中，视觉焦点可能分散",
            "HUD仪表盘信息密度高，对10岁孩子可能过于专业",
        ],
        rebuttals=[
            "链是依次加入的（phase控制），每次只关注一条新链；HUD同步显示阶段文字引导视觉焦点",
            "HUD标签使用简短大写英文+数字，是科普动画的常见做法；底栏4格数字一目了然",
        ],
        scores={"teaching_fit": 9, "feasibility": 8, "cognitive": 7, "completion": 8},
    ),
    "anim2": _debate_idea(
        idea_id="anim2", mode="animation",
        topic="反平行 vs 平行 beta折叠对比 HUD",
        objections=[
            "同一画面切换两种模式，孩子可能不理解区别",
            "氢键角度差异是微小的几何变化，视觉上难以表达",
        ],
        rebuttals=[
            "用按钮切换（不是同屏对比），切换时整个画面重绘，焦点明确；右侧比较面板始终可见",
            "用颜色编码（绿=反平行，黄绿=平行）+文字标注角度，双通道传递信息",
        ],
        scores={"teaching_fit": 7, "feasibility": 8, "cognitive": 6, "completion": 6},
    ),
    "game_quiz": _debate_idea(
        idea_id="game_quiz", mode="game",
        topic="beta折叠链对齐游戏：选择反平行/平行",
        objections=[
            "游戏只有两个选项（反平行/平行），两步操作就结束，缺乏深度",
            "无论选什么都能看到氢键形成，缺乏正误惩罚，教学反馈无效",
            "缺乏积分、排行榜等激励机制",
        ],
        rebuttals=[
            "目标是'主动选择'的认知激活，但确实操作太少",
            "无法有效驳斥：两步操作确实不构成游戏",
            "最小化游戏化原则不能成为缺乏深度的借口",
        ],
        scores={"teaching_fit": 4, "feasibility": 9, "cognitive": 4, "completion": 3},
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
        "[[IDEA:ANIM1_PLACEHOLDER]]",
        f"[[IDEA:{ANIM1_ID}]]"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "[[IDEA:ANIM2_PLACEHOLDER]]",
        f"[[IDEA:{ANIM2_ID}]]"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 开篇故事：一根蚕丝的秘密",
        f"[[IDEA:{STORY_ID}]]\n\n## 开篇故事：一根蚕丝的秘密"
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
                "topic": "Pauling-Corey 和蚕丝的秘密——beta折叠的历史故事",
                "context_summary": "从Pauling-Corey 1951年的发现到蚕丝蛋白的X射线衍射验证",
                "generation_backend": "claude_code_direct", "style_key": "biotech_life",
                "mode_reason": "历史情境故事建立直觉和情感共鸣",
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
                "topic": "beta折叠形成 HUD：多条链并排，氢键依次连接",
                "context_summary": "HUD仪表盘风格展示beta折叠片形成过程：链依次加入+氢键逐排连接",
                "generation_backend": "claude_code_direct", "style_key": "biotech_life",
                "mode_reason": "辩论通过：动态过程适合SVG+HUD仪表盘展示",
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
                "topic": "反平行 vs 平行 beta折叠对比 HUD",
                "context_summary": "HUD仪表盘风格对比展示反平行和平行beta折叠的氢键方向差异",
                "generation_backend": "claude_code_direct", "style_key": "biotech_life",
                "mode_reason": "辩论通过：切换按钮+右侧比较面板清晰呈现两种结构差异",
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
            "game_quiz",
            {
                "idea_id": GAME_ID, "mode": "game",
                "topic": "beta折叠链对齐游戏",
                "context_summary": "选择反平行/平行，对齐链段观察氢键形成",
                "generation_backend": "claude_code_direct", "style_key": "biotech_life",
                "mode_reason": "辩论未通过：操作深度不足，已跳过",
            },
            {
                GAME_ID: {
                    "mode": "game", "status": "ready",
                    "html": "",
                    "story_paragraphs": None, "exercises": None,
                    "generation_backend": "claude_code_direct",
                }
            },
        ),
        (
            "exercise",
            {
                "idea_id": EXER_ID, "mode": "exercise",
                "topic": "beta折叠关键知识点巩固练习（5题）",
                "context_summary": "检验学生对链间氢键、反平行/平行区别、蚕丝结构、侧链交替、淀粉样蛋白的理解",
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
    from systemedu.storage.db import LessonContent, get_session as get_db_session
    from datetime import datetime as dt

    console.print(Panel.fit(
        "[bold cyan]GP-01 蛋白结构探险地图[/bold cyan]\n\n"
        "完全由 Claude Code 生成（不调用 LLM agent pipeline）\n"
        f"节点：knode_id={TARGET_KNODE_ID} . {TARGET_NODE_TITLE}\n"
        "内容：完整课程文本 + HUD动画x2 + 历史故事 + 5道练习题\n"
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
