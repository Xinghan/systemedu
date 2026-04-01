"""
GP-01 蛋白结构探险地图 — 节点 knode_id=3
「原子是什么：乐高积木类比」完整课程内容

不调用任何 LLM agent pipeline。
Claude Code 直接生成：课程文本 + HUD 仪表盘动画 + 练习题 + 故事
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

_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_ROOT / "src"))
sys.path.insert(0, str(_ROOT))

import yaml
from rich.console import Console
from rich.panel import Panel

console = Console()

# ── 视觉主题系统（Stitch HUD 仪表盘风格 — 高饱和霓虹色）──────────

VISUAL_THEMES = {
    # 生命科学/蛋白质 — obsidian + 荧光绿
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
    # 物理/力学 — obsidian + 青蓝
    "physics_chalk": {
        "bg": "#0c0e12",
        "bg2": "#111318",
        "surface": "#171a1f",
        "surface_high": "#1d2025",
        "surface_highest": "#23262c",
        "card": "rgba(23,26,31,0.6)",
        "primary": "#00F0FF",
        "secondary": "#2ae500",
        "accent": "#DBFCFF",
        "text": "#e3e1e9",
        "text_dim": "#849495",
        "border": "rgba(59,73,75,0.15)",
        "font_display": "'Space Grotesk', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Grotesk', monospace",
        "hud_label": "#849495",
        "hud_value": "#e3e1e9",
        "hud_bg": "rgba(18,19,24,0.95)",
        "beam_color": "#00F0FF",
    },
    # 探索/航天 — obsidian + 橙红
    "explorer_sand": {
        "bg": "#0c0e12",
        "bg2": "#111318",
        "surface": "#171a1f",
        "surface_high": "#1d2025",
        "surface_highest": "#23262c",
        "card": "rgba(23,26,31,0.6)",
        "primary": "#FF8A50",
        "secondary": "#FFB060",
        "accent": "#FF6B6B",
        "text": "#f6f6fc",
        "text_dim": "#aaabb0",
        "border": "rgba(70,72,77,0.15)",
        "font_display": "'Space Grotesk', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Grotesk', monospace",
        "hud_label": "#aaabb0",
        "hud_value": "#f6f6fc",
        "hud_bg": "rgba(12,14,18,0.95)",
        "beam_color": "#FF8A50",
    },
    # 音乐/AI/创意 — obsidian + 霓虹紫
    "creative_studio": {
        "bg": "#0c0e12",
        "bg2": "#111318",
        "surface": "#171a1f",
        "surface_high": "#1d2025",
        "surface_highest": "#23262c",
        "card": "rgba(23,26,31,0.6)",
        "primary": "#EBB2FF",
        "secondary": "#F472B6",
        "accent": "#A78BFA",
        "text": "#f6f6fc",
        "text_dim": "#aaabb0",
        "border": "rgba(70,72,77,0.15)",
        "font_display": "'Space Grotesk', 'Noto Sans SC', sans-serif",
        "font_mono": "'Space Grotesk', monospace",
        "hud_label": "#aaabb0",
        "hud_value": "#f6f6fc",
        "hud_bg": "rgba(12,14,18,0.95)",
        "beam_color": "#EBB2FF",
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


# ── 工具 ───────────────────────────────────────────────────────

def _id(prefix: str) -> str:
    ts = int(time.time() * 1000)
    rand = "".join(random.choices(string.ascii_lowercase, k=4))
    return f"{prefix}_{ts}_{rand}"


# ── 项目基础信息 ───────────────────────────────────────────────

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

# ── 课程节点：knode_id=3 原子是什么 ──────────────────────────────
TARGET_KNODE_ID = 3
TARGET_NODE_TITLE = "原子是什么：乐高积木类比"
TARGET_NODE_SUMMARY = (
    "原子是物质的基本单元，就像乐高积木。不同颜色的乐高代表不同元素："
    "碳（灰色）、氢（白色）、氮（蓝色）、氧（红色）、硫（黄色）。"
    "这五种元素组成了几乎所有蛋白质。"
)

# ── 步骤1：完整课程文本（plan_markdown）────────────────────────

PLAN_MARKDOWN = """# M01N04：原子是什么——乐高积木类比

> **模块**：化学直觉入门
> **知识等级**：L1-感知 | **难度**：1/10 | **预计时长**：25分钟
> **先修知识**：无（本节是起点）

---

## 开篇问题：如果一直切下去会怎样？

想象你手里有一粒盐。把它切成两半——还是盐。再切成两半——还是盐。继续切、切、切……

你会切到什么时候不能再切了？

两千多年前，一位希腊人叫德谟克利特，他想到了同一个问题。他的答案是：最终你会得到一个再也不能再切的"最小颗粒"——他叫它 **atomos**（原子），在希腊语里就是"不可分割的"。

他说对了——物质确实由原子组成。

---

## 第一部分：原子有多小？

原子小到难以想象。我们来做一个尺度对比：

| 对象 | 大小 |
|------|------|
| 地球直径 | 12,700 公里 |
| 足球 | 22 厘米 |
| 头发直径 | 0.1 毫米（100微米） |
| 细菌 | 1 微米（0.001毫米） |
| 蛋白质分子 | 5~10 纳米 |
| **原子直径** | **约0.1纳米（1埃）** |

换一个让你有感觉的类比：

如果把一个苹果放大到整个地球那么大，苹果里的原子就变成了一颗**乒乓球**那么大。

再换一个：你的小拇指指甲上，紧挨着排了大约 **10亿个**碳原子——横排一行，正好10亿个。

---

## 第二部分：蛋白质里有哪些原子？

蛋白质是一种大分子，但它只由**五种元素的原子**组成（记住这五种，后面会一直用到）：

| 元素 | 符号 | CPK颜色 | 在蛋白质里的角色 |
|------|------|---------|----------------|
| 碳 | C | 深灰 / 黑 | 骨架主力，几乎每个氨基酸都有 |
| 氢 | H | 白 | 数量最多，非常小，填充在各处 |
| 氮 | N | 蓝 | 氨基（-NH2）的核心，肽键的一部分 |
| 氧 | O | 红 | 羧基（-COOH）的核心，肽键的一部分 |
| 硫 | S | 黄 | 只在半胱氨酸和甲硫氨酸里出现，可形成二硫键 |

**CPK颜色**是化学界的统一约定：无论你看哪本生化教科书、用哪款3D分子软件，碳永远是灰/黑，氧永远是红，氮永远是蓝。这就像交通灯的颜色——全世界一致，不用每次重新学。

### 乐高类比

想象五种颜色的乐高积木：
- 灰色乐高 = 碳原子（C）
- 白色乐高 = 氢原子（H）
- 蓝色乐高 = 氮原子（N）
- 红色乐高 = 氧原子（O）
- 黄色乐高 = 硫原子（S）

氨基酸就是用这五种乐高拼成的小模型。蛋白质是把很多个氨基酸模型连在一起的长链。

乐高和原子的区别：
1. 乐高可以从任意方向连接，原子的连接方向是固定的（化学键有方向性）
2. 乐高积木大小一样，不同原子大小略有差异（氢最小，硫最大）
3. 乐高连接可以随时拆开，化学键需要能量才能断开

---

## 第三部分：化学键——原子的"乐高凸起"

原子和原子之间靠**化学键**连接，就像乐高积木靠凸起和凹口卡在一起。

最常见的两种化学键：

**共价键**（单键 -，双键 =）
- 两个原子**共享**电子
- 非常牢固，需要大量能量才能断开
- 骨架的 C-C、C-N、C=O 都是共价键
- 乐高类比：用力卡紧的凸起，很难扳开

**氢键**（...或虚线）
- 氢原子被两个电负性原子"抢着"
- 比共价键弱得多，但数量多时合力很强
- 蛋白质的二级结构（alpha螺旋、beta折叠）靠氢键维持
- 乐高类比：两块积木叠放时的弱摩擦力——单个不强，但整块乐高模型靠它维持形状

### 一个水分子有多少原子？

水 H2O = 2个氢原子 + 1个氧原子，总共3个原子。
它们靠2条 O-H 共价键连接。

甘氨酸（最简单的氨基酸）= C2H5NO2 = 10个原子。

一个蛋白质分子通常有数千到数万个原子。

---

## 第四部分：历史故事——约翰·道尔顿和彩色小球

1803年，英国化学家约翰·道尔顿提出了**原子学说**：

1. 物质由极小的原子构成
2. 同一种元素的原子完全相同（质量和性质）
3. 不同元素的原子不同
4. 化合物由不同原子按固定比例组合而成

道尔顿是一位色盲患者（他本人也研究了色盲，色盲有时被称为"道尔顿症"）。他用**木质小球**来表示原子，不同大小的球代表不同元素——这是人类历史上第一套"分子模型"。

1869年，门捷列夫把已知元素按原子量排列，发现了规律性——元素周期表诞生。

1909年，卢瑟福用金箔散射实验证明原子有一个致密的**原子核**（而不是均匀的"葡萄干蛋糕"）。

今天我们知道原子由**质子、中子、电子**组成——但对于学蛋白质来说，你只需要知道原子的**种类**（决定化学性质）和**大小**（决定空间形状）。

---

## 第五部分：为什么蛋白质只用5种元素？

地球上有118种元素，蛋白质为什么只用5种？

这是生命在40亿年进化中"找到"的最优解：
- **碳（C）**：4个化学键，可以形成链、环、支链——骨架的理想材料
- **氢（H）**：1个键，最轻，填充间隙，调节极性
- **氮（N）**：3个键，碱性，氨基的核心，参与氢键
- **氧（O）**：2个键，强电负性，参与氢键，赋予极性
- **硫（S）**：2个键，可以形成二硫键，为蛋白质加固

这5种元素的组合给了蛋白质：一个稳定但可折叠的骨架（C/N/O）、大量可调节的侧链（C/H/N/O/S）、以及精确的立体形状。

---

## 本节小结

| 概念 | 要点 |
|------|------|
| 原子 | 物质的基本单元，约0.1纳米大小 |
| 蛋白质的5种元素 | C（灰）、H（白）、N（蓝）、O（红）、S（黄） |
| CPK颜色 | 化学界统一约定，全球通用 |
| 共价键 | 原子间强结合，乐高的卡扣 |
| 氢键 | 弱连接，但数量多合力强，维持蛋白质形状 |
| 乐高类比 | 原子是积木块，化学键是凸起，分子是组装好的模型 |

**核心直觉**：蛋白质就是用5种"乐高颜色"的原子拼成的精密模型。掌握 C/H/N/O/S 的颜色和角色，你就有了读懂所有蛋白质3D结构图的基础。

---

## 检测你学会了吗？

1. 原子大小大约是多少？（约0.1纳米，即1埃）
2. 蛋白质由哪五种元素组成？（C、H、N、O、S）
3. 在CPK颜色约定里，氧是什么颜色？（红色）
4. 共价键和氢键哪个更强？（共价键）
5. 道尔顿最早用什么来表示原子？（木质小球）
6. 为什么碳是骨架的理想材料？（有4个化学键，可形成链和环）
"""

# ── ID 生成（在辩论前生成，后面引用）────────────────────────────

ANIM1_ID = _id("anim")   # 原子结构 HUD
STORY_ID = _id("story")  # 道尔顿历史故事
EXER_ID  = _id("ex")     # 练习题
GAME_ID  = _id("game")   # 分子组装台

# ── 故事段落 ────────────────────────────────────────────────────

STORY_PARAGRAPHS = [
    {
        "text": (
            "1803年的英国曼彻斯特，一个近视又色盲的学校老师，每天放学后会用一套木质小球做实验。"
            "他叫约翰·道尔顿，37岁，从未上过大学，却深深着迷于一个问题：物质究竟是什么做的？"
        ),
        "image_url": "",
    },
    {
        "text": (
            "道尔顿注意到：不同气体混合在一起时，每种气体好像都'不知道'另一种气体的存在，"
            "各自按自己的规律行动。他推断：气体一定是由分离的小颗粒组成的，颗粒之间有空隙。"
            "这些颗粒，他叫它们 atoms（原子）。"
        ),
        "image_url": "",
    },
    {
        "text": (
            "更惊人的是他接下来的发现：当碳和氧结合时，总是以1:1或1:2的整数比——"
            "不是1.3:1，不是0.7:2。为什么？因为原子是一颗一颗的，不能切成半颗！"
            "这个'倍比定律'是原子存在的第一个硬证据。"
        ),
        "image_url": "",
    },
    {
        "text": (
            "道尔顿为每种元素画了一个符号，制作了木质模型球。"
            "当时没有人能直接看到原子，但他用气体混合的数据"
            "推算出原子的相对质量——氢最轻，设为1；碳约为12；氧约为16。"
            "这些数字今天还在用，两百年后的中学化学课本里，你还能看到道尔顿的遗产。"
        ),
        "image_url": "",
    },
]

# ── 练习题 ───────────────────────────────────────────────────────

EXERCISES = [
    {
        "type": "choice",
        "question": "在CPK颜色约定中，蛋白质里氮原子（N）用什么颜色表示？",
        "options": [
            "A. 红色",
            "B. 蓝色",
            "C. 白色",
            "D. 黄色",
        ],
        "correct": 1,
        "explanation": (
            "CPK颜色约定：碳=灰/黑，氢=白，氮=蓝，氧=红，硫=黄。"
            "氮原子在3D分子模型中用蓝色球表示。"
        ),
    },
    {
        "type": "choice",
        "question": "原子的直径大约是多少？",
        "options": [
            "A. 0.1毫米",
            "B. 1微米",
            "C. 0.1纳米（1埃）",
            "D. 10纳米",
        ],
        "correct": 2,
        "explanation": (
            "原子直径约0.1纳米=1埃。"
            "蛋白质分子5-10纳米，细菌1微米，头发0.1毫米。原子比蛋白质还小50-100倍。"
        ),
    },
    {
        "type": "choice",
        "question": "共价键和氢键相比，哪种更强？",
        "options": [
            "A. 氢键更强",
            "B. 共价键更强",
            "C. 两者一样强",
            "D. 要看元素种类",
        ],
        "correct": 1,
        "explanation": (
            "共价键是原子共享电子形成的，非常牢固。氢键弱得多（约为共价键的1/20），"
            "但数量多时合力也很可观——蛋白质的二级结构就靠大量氢键维持。"
        ),
    },
    {
        "type": "choice",
        "question": "蛋白质中只出现在半胱氨酸和甲硫氨酸中的元素是哪个？",
        "options": [
            "A. 碳（C）",
            "B. 氮（N）",
            "C. 硫（S）",
            "D. 氧（O）",
        ],
        "correct": 2,
        "explanation": (
            "硫（S）在蛋白质中只存在于两种氨基酸：半胱氨酸（Cys）和甲硫氨酸（Met）。"
            "半胱氨酸的硫可以形成二硫键（-S-S-），为蛋白质加固。"
        ),
    },
    {
        "type": "choice",
        "question": "道尔顿用什么证据推断原子的存在？",
        "options": [
            "A. 显微镜直接观察到了原子",
            "B. 气体混合的质量比总是整数比（倍比定律）",
            "C. 金箔散射实验",
            "D. X射线衍射图",
        ],
        "correct": 1,
        "explanation": (
            "他的证据是间接的：碳和氧结合时，质量比总是1:1.33（CO）或1:2.66（CO2），"
            "这只能用'原子是离散颗粒，不能切成分数'来解释——这就是倍比定律。"
            "原子核是1909年卢瑟福通过金箔散射实验发现的，比道尔顿晚了100多年。"
        ),
    },
]

# ── 动画1：原子结构 HUD（HTML+SVG 仪表盘，Stitch 设计稿风格）─────
# 场景：HUD 仪表盘展示原子结构
# 中央：SVG 原子模型（电子云轨道 + 核心呼吸灯）
# 左侧 glass panel：元素数据读数（ATOMIC_NUMBER, MASS, ELECTRON_CONFIG）
# 右侧 glass panel：CPK 颜色图例
# 底部 HUD：当前元素统计
# 点击切换 C/H/N/O/S 五种元素
# Probe 连接线 + 脉冲动画

ANIM1_HTML = r"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ATOM_EXPLORER</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet"/>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: __THEME_BG__;
  font-family: __THEME_FONT__;
  color: __THEME_TEXT__;
  user-select: none;
}

/* -- Layout: Bento Grid -- */
.hud-container {
  width: 100%; height: 100%;
  display: grid;
  grid-template-rows: 44px 1fr 56px;
  grid-template-columns: 200px 1fr 180px;
  gap: 0;
  padding: 0;
}

/* -- Top Bar -- */
.top-bar {
  grid-column: 1 / -1;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px;
  background: rgba(12,14,18,0.6);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid __THEME_BORDER__;
  z-index: 10;
}
.top-bar .title {
  font-size: 11px; font-weight: 700; letter-spacing: 0.15em;
  text-transform: uppercase; color: __THEME_PRIMARY__;
  text-shadow: 0 0 15px __THEME_PRIMARY__40;
}
.top-bar .status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: __THEME_PRIMARY__;
  box-shadow: 0 0 8px __THEME_PRIMARY__;
  animation: pulse-dot 2s infinite;
}
.element-nav {
  display: flex; gap: 4px;
}
.el-btn {
  width: 32px; height: 28px; border-radius: 4px;
  border: 1px solid __THEME_BORDER__;
  background: __THEME_SURFACE__;
  color: __THEME_TEXT_DIM__;
  font-family: __THEME_FONT__;
  font-size: 11px; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
  letter-spacing: 0.05em;
}
.el-btn:hover {
  border-color: __THEME_PRIMARY__60;
  color: __THEME_PRIMARY__;
  box-shadow: 0 0 12px __THEME_PRIMARY__20;
}
.el-btn.active {
  background: __THEME_PRIMARY__18;
  border-color: __THEME_PRIMARY__;
  color: __THEME_PRIMARY__;
  box-shadow: 0 0 16px __THEME_PRIMARY__30;
}

/* -- Glass Panel (Left/Right) -- */
.panel-left, .panel-right {
  padding: 12px 10px;
  overflow-y: auto;
  background: __THEME_CARD__;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid __THEME_BORDER__;
}
.panel-right {
  border-right: none;
  border-left: 1px solid __THEME_BORDER__;
}

.panel-section {
  margin-bottom: 14px;
}
.circuit-header {
  width: 32px; height: 2px;
  background: __THEME_PRIMARY__;
  margin-bottom: 8px;
  box-shadow: 0 0 8px __THEME_PRIMARY__60;
}
.circuit-header.secondary { background: __THEME_SECONDARY__; box-shadow: 0 0 8px __THEME_SECONDARY__60; }
.circuit-header.accent { background: __THEME_ACCENT__; box-shadow: 0 0 8px __THEME_ACCENT__60; }

.hud-label {
  font-size: 9px; font-weight: 500;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: __THEME_HUD_LABEL__;
  margin-bottom: 4px;
}
.hud-value {
  font-size: 22px; font-weight: 700;
  color: __THEME_HUD_VALUE__;
  line-height: 1.1;
}
.hud-value.primary { color: __THEME_PRIMARY__; text-shadow: 0 0 12px __THEME_PRIMARY__40; }
.hud-value.small { font-size: 13px; }
.hud-unit {
  font-size: 9px; color: __THEME_TEXT_DIM__;
  letter-spacing: 0.08em; text-transform: uppercase;
}

/* -- Data Row -- */
.data-row {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 3px 0;
  border-bottom: 1px solid rgba(70,72,77,0.08);
}
.data-row .key {
  font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
  color: __THEME_TEXT_DIM__;
}
.data-row .val {
  font-size: 11px; font-weight: 600;
  color: __THEME_TEXT__;
}

/* -- CPK Index (Right panel) -- */
.cpk-item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 0;
  cursor: pointer; transition: all 0.15s;
  border-radius: 4px;
}
.cpk-item:hover { background: rgba(70,72,77,0.1); }
.cpk-item.active { background: __THEME_PRIMARY__12; }
.cpk-dot {
  width: 14px; height: 14px; border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px var(--dot-color);
}
.cpk-sym {
  font-size: 12px; font-weight: 700; min-width: 14px;
  color: __THEME_TEXT__;
}
.cpk-name {
  font-size: 9px; letter-spacing: 0.08em;
  color: __THEME_TEXT_DIM__; text-transform: uppercase;
}

/* -- Center Stage (SVG Area) -- */
.center-stage {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, __THEME_BG2__ 0%, __THEME_BG__ 70%);
  overflow: hidden;
}
.center-stage svg {
  width: 100%; height: 100%;
}

/* -- Bottom HUD -- */
.bottom-hud {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  background: __THEME_HUD_BG__;
  border-top: 1px solid __THEME_BORDER__;
}
.bottom-hud::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, __THEME_PRIMARY__, __THEME_SECONDARY__, __THEME_PRIMARY__, transparent);
  opacity: 0.6;
}
.hud-cell {
  position: relative;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 6px 0;
}
.hud-cell:not(:last-child)::after {
  content: '';
  position: absolute; right: 0; top: 12px; bottom: 12px;
  width: 1px;
  background: rgba(70,72,77,0.15);
}
.hud-cell .hud-label { margin-bottom: 2px; font-size: 8px; }
.hud-cell .hud-value { font-size: 16px; }

/* -- Probe Lines (SVG overlay) -- */
.probe-overlay {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}

/* -- Animations -- */
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes orbit-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes core-pulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes scan-line {
  from { transform: translateY(-100%); }
  to { transform: translateY(100%); }
}
.fade-in { animation: fade-in 0.5s ease-out both; }
</style>
</head>
<body>
<div class="hud-container">
  <!-- Top Bar -->
  <div class="top-bar">
    <div style="display:flex;align-items:center;gap:10px;">
      <span class="status-dot"></span>
      <span class="title">ATOM_EXPLORER</span>
    </div>
    <div class="element-nav" id="elNav">
      <button class="el-btn active" data-el="C">C</button>
      <button class="el-btn" data-el="H">H</button>
      <button class="el-btn" data-el="N">N</button>
      <button class="el-btn" data-el="O">O</button>
      <button class="el-btn" data-el="S">S</button>
    </div>
  </div>

  <!-- Left Panel: Element Data -->
  <div class="panel-left" id="panelLeft">
    <div class="panel-section fade-in">
      <div class="circuit-header"></div>
      <div class="hud-label">ELEMENT</div>
      <div class="hud-value primary" id="elSymbol">C</div>
      <div class="hud-unit" id="elFullName">CARBON</div>
    </div>
    <div class="panel-section fade-in" style="animation-delay:0.1s">
      <div class="circuit-header secondary"></div>
      <div class="hud-label">ATOMIC_NUMBER</div>
      <div class="hud-value small" id="elNumber">6</div>
    </div>
    <div class="panel-section fade-in" style="animation-delay:0.15s">
      <div class="hud-label">MASS</div>
      <div class="hud-value small" id="elMass">12.011</div>
      <div class="hud-unit">AMU</div>
    </div>
    <div class="panel-section fade-in" style="animation-delay:0.2s">
      <div class="hud-label">ELECTRON_CONFIG</div>
      <div class="hud-value small" id="elConfig">1s2 2s2 2p2</div>
    </div>
    <div class="panel-section fade-in" style="animation-delay:0.25s">
      <div class="hud-label">BONDS</div>
      <div class="hud-value small" id="elBonds">4</div>
    </div>
    <div class="panel-section fade-in" style="animation-delay:0.3s">
      <div class="circuit-header accent"></div>
      <div class="hud-label">ROLE_IN_PROTEIN</div>
      <div style="font-size:10px;color:__THEME_TEXT__;line-height:1.5;margin-top:4px" id="elRole">
        骨架主力，几乎每个氨基酸都有碳原子构成的骨架
      </div>
    </div>
  </div>

  <!-- Center: SVG Atom Model -->
  <div class="center-stage" id="centerStage">
    <svg id="atomSvg" viewBox="0 0 400 340" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Core gradient -->
        <radialGradient id="coreGrad" cx="40%" cy="35%" r="55%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
          <stop offset="20%" stop-color="__THEME_PRIMARY__" stop-opacity="0.8"/>
          <stop offset="60%" stop-color="__THEME_PRIMARY__" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="__THEME_BG__" stop-opacity="0.9"/>
        </radialGradient>
        <!-- Outer glow -->
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="__THEME_PRIMARY__" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="__THEME_PRIMARY__" stop-opacity="0"/>
        </radialGradient>
        <!-- Electron glow -->
        <radialGradient id="electronGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="__THEME_PRIMARY__" stop-opacity="0"/>
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <!-- Background scan line -->
      <rect x="0" y="0" width="400" height="2" fill="__THEME_PRIMARY__" opacity="0.06">
        <animateTransform attributeName="transform" type="translate" values="0,0;0,340;0,0" dur="8s" repeatCount="indefinite"/>
      </rect>

      <!-- Concentric reference rings -->
      <g id="refRings" opacity="0.06" stroke="__THEME_PRIMARY__" fill="none" stroke-width="0.5">
        <circle cx="200" cy="160" r="40"/>
        <circle cx="200" cy="160" r="80"/>
        <circle cx="200" cy="160" r="120"/>
        <circle cx="200" cy="160" r="160"/>
      </g>

      <!-- Orbit Ellipses (rotating dashed) -->
      <g id="orbits">
        <ellipse cx="200" cy="160" rx="110" ry="45" fill="none" stroke="__THEME_PRIMARY__" stroke-width="0.8" stroke-dasharray="4,6" opacity="0.3" style="transform-origin:200px 160px">
          <animateTransform attributeName="transform" type="rotate" values="0 200 160;360 200 160" dur="8s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx="200" cy="160" rx="95" ry="55" fill="none" stroke="__THEME_SECONDARY__" stroke-width="0.6" stroke-dasharray="3,5" opacity="0.2" style="transform-origin:200px 160px">
          <animateTransform attributeName="transform" type="rotate" values="60 200 160;420 200 160" dur="12s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx="200" cy="160" rx="80" ry="65" fill="none" stroke="__THEME_ACCENT__" stroke-width="0.5" stroke-dasharray="2,7" opacity="0.15" style="transform-origin:200px 160px">
          <animateTransform attributeName="transform" type="rotate" values="120 200 160;480 200 160" dur="16s" repeatCount="indefinite"/>
        </ellipse>
      </g>

      <!-- Electrons on orbits -->
      <g id="electrons" filter="url(#glow)">
        <circle r="3" fill="#ffffff" opacity="0.9">
          <animateMotion dur="8s" repeatCount="indefinite" rotate="auto">
            <mpath href="#orbitPath1"/>
          </animateMotion>
        </circle>
        <circle r="2.5" fill="__THEME_SECONDARY__" opacity="0.8">
          <animateMotion dur="12s" repeatCount="indefinite" rotate="auto">
            <mpath href="#orbitPath2"/>
          </animateMotion>
        </circle>
        <circle r="2" fill="__THEME_ACCENT__" opacity="0.7">
          <animateMotion dur="16s" repeatCount="indefinite" rotate="auto">
            <mpath href="#orbitPath3"/>
          </animateMotion>
        </circle>
      </g>
      <!-- Hidden orbit paths for animateMotion -->
      <path id="orbitPath1" d="M310,160 A110,45 0 1,1 90,160 A110,45 0 1,1 310,160" fill="none" stroke="none"/>
      <path id="orbitPath2" d="M295,160 A95,55 0 1,1 105,160 A95,55 0 1,1 295,160" fill="none" stroke="none"/>
      <path id="orbitPath3" d="M280,160 A80,65 0 1,1 120,160 A80,65 0 1,1 280,160" fill="none" stroke="none"/>

      <!-- Atom Core -->
      <g id="atomCore">
        <circle cx="200" cy="160" r="50" fill="url(#coreGlow)" opacity="0.5">
          <animate attributeName="r" values="50;55;50" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="200" cy="160" r="32" fill="url(#coreGrad)" filter="url(#softGlow)">
          <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" repeatCount="indefinite"/>
        </circle>
        <!-- Specular highlight -->
        <ellipse cx="190" cy="150" rx="12" ry="8" fill="white" opacity="0.25"/>
        <!-- Element symbol on core -->
        <text id="coreSym" x="200" y="167" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="24" font-weight="700" fill="__THEME_BG__" opacity="0.9">C</text>
      </g>

      <!-- Probe Lines (from core to data points) -->
      <g id="probeLines" opacity="0.4">
        <line x1="168" y1="160" x2="10" y2="60" stroke="__THEME_PRIMARY__" stroke-width="0.5" stroke-dasharray="2,4"/>
        <circle cx="10" cy="60" r="2" fill="__THEME_PRIMARY__">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/>
        </circle>
        <line x1="168" y1="175" x2="10" y2="200" stroke="__THEME_SECONDARY__" stroke-width="0.5" stroke-dasharray="2,4"/>
        <circle cx="10" cy="200" r="2" fill="__THEME_SECONDARY__">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <line x1="232" y1="160" x2="390" y2="50" stroke="__THEME_ACCENT__" stroke-width="0.5" stroke-dasharray="2,4"/>
        <circle cx="390" cy="50" r="2" fill="__THEME_ACCENT__">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite"/>
        </circle>
      </g>

      <!-- Info label near core -->
      <g id="coreLabel" opacity="0.7">
        <text x="200" y="215" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="9" fill="__THEME_TEXT_DIM__" letter-spacing="0.12em" text-transform="uppercase">NUCLEUS</text>
        <text x="200" y="228" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="8" fill="__THEME_TEXT_DIM__" letter-spacing="0.08em" id="coreDesc">6 PROTONS / 6 NEUTRONS</text>
      </g>

      <!-- Bottom: atom size label -->
      <g opacity="0.5">
        <line x1="140" y1="280" x2="260" y2="280" stroke="__THEME_TEXT_DIM__" stroke-width="0.5"/>
        <line x1="140" y1="276" x2="140" y2="284" stroke="__THEME_TEXT_DIM__" stroke-width="0.5"/>
        <line x1="260" y1="276" x2="260" y2="284" stroke="__THEME_TEXT_DIM__" stroke-width="0.5"/>
        <text x="200" y="296" text-anchor="middle" font-family="'Space Grotesk', sans-serif" font-size="8" fill="__THEME_TEXT_DIM__" letter-spacing="0.1em" id="sizeLabel">~0.077 NM (COVALENT RADIUS)</text>
      </g>
    </svg>
  </div>

  <!-- Right Panel: CPK Index -->
  <div class="panel-right" id="panelRight">
    <div class="panel-section">
      <div class="circuit-header"></div>
      <div class="hud-label">CPK_INDEX</div>
    </div>
    <div id="cpkList">
      <!-- Filled by JS -->
    </div>
    <div class="panel-section" style="margin-top:14px;">
      <div class="circuit-header secondary"></div>
      <div class="hud-label">SIZE_COMPARISON</div>
      <div id="sizeBar" style="margin-top:6px;"></div>
    </div>
  </div>

  <!-- Bottom HUD -->
  <div class="bottom-hud" style="position:relative;" id="bottomHud">
    <div class="hud-cell">
      <div class="hud-label">ATOMIC_NUM</div>
      <div class="hud-value" id="hudNum">6</div>
    </div>
    <div class="hud-cell">
      <div class="hud-label">TYPE</div>
      <div class="hud-value" id="hudType" style="font-size:13px;">NONMETAL</div>
    </div>
    <div class="hud-cell">
      <div class="hud-label">BONDS</div>
      <div class="hud-value" id="hudBonds">4</div>
    </div>
    <div class="hud-cell">
      <div class="hud-label">ELECTRONEGATIVITY</div>
      <div class="hud-value" id="hudEN">2.55</div>
    </div>
  </div>
</div>

<script>
(function(){
"use strict";

var ELEMENTS = {
  C: {
    sym: "C", name: "CARBON", cnName: "碳",
    number: 6, mass: "12.011", config: "1s2 2s2 2p2",
    bonds: 4, en: "2.55", type: "NONMETAL",
    radius: "0.077", sizeLabel: "~0.077 NM (COVALENT RADIUS)",
    nucleusDesc: "6 PROTONS / 6 NEUTRONS",
    role: "骨架主力，几乎每个氨基酸都有碳原子构成的骨架",
    cpkColor: "#4a5568", cpkHex: "#4a5568"
  },
  H: {
    sym: "H", name: "HYDROGEN", cnName: "氢",
    number: 1, mass: "1.008", config: "1s1",
    bonds: 1, en: "2.20", type: "NONMETAL",
    radius: "0.031", sizeLabel: "~0.031 NM (COVALENT RADIUS)",
    nucleusDesc: "1 PROTON / 0 NEUTRONS",
    role: "数量最多，最轻，填充间隙，调节极性",
    cpkColor: "#e2e8f0", cpkHex: "#e2e8f0"
  },
  N: {
    sym: "N", name: "NITROGEN", cnName: "氮",
    number: 7, mass: "14.007", config: "1s2 2s2 2p3",
    bonds: 3, en: "3.04", type: "NONMETAL",
    radius: "0.075", sizeLabel: "~0.075 NM (COVALENT RADIUS)",
    nucleusDesc: "7 PROTONS / 7 NEUTRONS",
    role: "氨基核心，蓝色标记，参与氢键形成",
    cpkColor: "#3b82f6", cpkHex: "#3b82f6"
  },
  O: {
    sym: "O", name: "OXYGEN", cnName: "氧",
    number: 8, mass: "15.999", config: "1s2 2s2 2p4",
    bonds: 2, en: "3.44", type: "NONMETAL",
    radius: "0.073", sizeLabel: "~0.073 NM (COVALENT RADIUS)",
    nucleusDesc: "8 PROTONS / 8 NEUTRONS",
    role: "羧基核心，强电负性，参与氢键",
    cpkColor: "#ef4444", cpkHex: "#ef4444"
  },
  S: {
    sym: "S", name: "SULFUR", cnName: "硫",
    number: 16, mass: "32.06", config: "[Ne] 3s2 3p4",
    bonds: 2, en: "2.58", type: "NONMETAL",
    radius: "0.102", sizeLabel: "~0.102 NM (COVALENT RADIUS)",
    nucleusDesc: "16 PROTONS / 16 NEUTRONS",
    role: "二硫键形成者，只在Cys和Met中出现",
    cpkColor: "#eab308", cpkHex: "#eab308"
  }
};

var ORDER = ["C","H","N","O","S"];
var currentEl = "C";

// Build CPK list
var cpkList = document.getElementById("cpkList");
ORDER.forEach(function(sym){
  var el = ELEMENTS[sym];
  var item = document.createElement("div");
  item.className = "cpk-item" + (sym === currentEl ? " active" : "");
  item.dataset.el = sym;
  item.style.setProperty("--dot-color", el.cpkColor);
  item.innerHTML =
    '<div class="cpk-dot" style="background:' + el.cpkColor + ';"></div>' +
    '<span class="cpk-sym">' + sym + '</span>' +
    '<span class="cpk-name">' + el.cnName + '</span>';
  item.addEventListener("click", function(){ selectElement(sym); });
  cpkList.appendChild(item);
});

// Build size bars
var sizeBar = document.getElementById("sizeBar");
ORDER.forEach(function(sym){
  var el = ELEMENTS[sym];
  var r = parseFloat(el.radius);
  var pct = Math.round(r / 0.12 * 100);
  var row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:4px;";
  row.innerHTML =
    '<span style="font-size:9px;width:12px;color:__THEME_TEXT_DIM__;font-weight:600;">' + sym + '</span>' +
    '<div style="flex:1;height:4px;background:__THEME_SURFACE_HIGHEST__;border-radius:2px;overflow:hidden;">' +
    '<div style="width:' + pct + '%;height:100%;background:' + el.cpkColor + ';border-radius:2px;box-shadow:0 0 6px ' + el.cpkColor + ';"></div>' +
    '</div>' +
    '<span style="font-size:8px;color:__THEME_TEXT_DIM__;">' + el.radius + '</span>';
  sizeBar.appendChild(row);
});

// Nav buttons
document.querySelectorAll(".el-btn").forEach(function(btn){
  btn.addEventListener("click", function(){
    selectElement(btn.dataset.el);
  });
});

function selectElement(sym){
  currentEl = sym;
  var el = ELEMENTS[sym];

  // Update nav buttons
  document.querySelectorAll(".el-btn").forEach(function(b){
    b.classList.toggle("active", b.dataset.el === sym);
  });

  // Update CPK list
  document.querySelectorAll(".cpk-item").forEach(function(item){
    item.classList.toggle("active", item.dataset.el === sym);
  });

  // Update left panel data
  document.getElementById("elSymbol").textContent = sym;
  document.getElementById("elFullName").textContent = el.name;
  document.getElementById("elNumber").textContent = el.number;
  document.getElementById("elMass").textContent = el.mass;
  document.getElementById("elConfig").textContent = el.config;
  document.getElementById("elBonds").textContent = el.bonds;
  document.getElementById("elRole").textContent = el.role;

  // Update bottom HUD
  document.getElementById("hudNum").textContent = el.number;
  document.getElementById("hudType").textContent = el.type;
  document.getElementById("hudBonds").textContent = el.bonds;
  document.getElementById("hudEN").textContent = el.en;

  // Update SVG core
  document.getElementById("coreSym").textContent = sym;
  document.getElementById("coreDesc").textContent = el.nucleusDesc;
  document.getElementById("sizeLabel").textContent = el.sizeLabel;

  // Update SVG gradients to CPK color
  updateCoreColor(el.cpkColor);

  // Animate: scale pulse on core
  var core = document.getElementById("atomCore");
  core.style.transition = "transform 0.3s ease";
  core.style.transform = "scale(0.8)";
  setTimeout(function(){
    core.style.transform = "scale(1)";
  }, 150);
}

function updateCoreColor(color){
  // Update gradient stops dynamically
  var stops = document.querySelectorAll("#coreGrad stop");
  if(stops.length >= 4){
    stops[1].setAttribute("stop-color", color);
    stops[2].setAttribute("stop-color", color);
  }
  var glowStops = document.querySelectorAll("#coreGlow stop");
  if(glowStops.length >= 1){
    glowStops[0].setAttribute("stop-color", color);
    glowStops[1].setAttribute("stop-color", color);
  }
}

})();
</script>
</body>
</html>"""


# ── 动画2：分子组装台 HUD（HTML+SVG 仪表盘风格）───────────────────
# 中央：分子 ball-and-stick 模型（SVG circle + line）
# 左侧 panel：BOND_ANALYSIS（键长、键角数据）
# 右侧 panel：COMPOSITION（元素占比条形图）
# 底部 HUD：ATOMS / BONDS / FORMULA
# 按钮切换 H2O / NH3 / Glycine

ANIM2_ID = _id("anim")

ANIM2_HTML = r"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>MOLECULE_LAB</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet"/>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: __THEME_BG__;
  font-family: __THEME_FONT__;
  color: __THEME_TEXT__;
  user-select: none;
}

.hud-container {
  width: 100%; height: 100%;
  display: grid;
  grid-template-rows: 44px 1fr 56px;
  grid-template-columns: 180px 1fr 180px;
  gap: 0;
}

.top-bar {
  grid-column: 1 / -1;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px;
  background: rgba(12,14,18,0.6);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid __THEME_BORDER__;
  z-index: 10;
}
.top-bar .title {
  font-size: 11px; font-weight: 700; letter-spacing: 0.15em;
  text-transform: uppercase; color: __THEME_PRIMARY__;
  text-shadow: 0 0 15px __THEME_PRIMARY__40;
}
.top-bar .status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: __THEME_SECONDARY__;
  box-shadow: 0 0 8px __THEME_SECONDARY__;
  animation: pulse-dot 2s infinite;
}
.mol-nav { display: flex; gap: 4px; }
.mol-btn {
  padding: 5px 14px; border-radius: 4px;
  border: 1px solid __THEME_BORDER__;
  background: __THEME_SURFACE__;
  color: __THEME_TEXT_DIM__;
  font-family: __THEME_FONT__;
  font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
  cursor: pointer; transition: all 0.2s; text-transform: uppercase;
}
.mol-btn:hover {
  border-color: __THEME_PRIMARY__60; color: __THEME_PRIMARY__;
}
.mol-btn.active {
  background: __THEME_PRIMARY__18; border-color: __THEME_PRIMARY__;
  color: __THEME_PRIMARY__; box-shadow: 0 0 12px __THEME_PRIMARY__25;
}

.panel-left, .panel-right {
  padding: 12px 10px;
  background: __THEME_CARD__;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  overflow-y: auto;
}
.panel-left { border-right: 1px solid __THEME_BORDER__; }
.panel-right { border-left: 1px solid __THEME_BORDER__; }

.circuit-header { width: 32px; height: 2px; background: __THEME_PRIMARY__; margin-bottom: 8px; box-shadow: 0 0 8px __THEME_PRIMARY__60; }
.circuit-header.s { background: __THEME_SECONDARY__; box-shadow: 0 0 8px __THEME_SECONDARY__60; }
.circuit-header.a { background: __THEME_ACCENT__; box-shadow: 0 0 8px __THEME_ACCENT__60; }
.hud-label { font-size: 9px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: __THEME_HUD_LABEL__; margin-bottom: 4px; }
.hud-value { font-size: 18px; font-weight: 700; color: __THEME_HUD_VALUE__; line-height: 1.2; }
.hud-value.p { color: __THEME_PRIMARY__; text-shadow: 0 0 10px __THEME_PRIMARY__40; }
.hud-value.sm { font-size: 12px; }
.panel-section { margin-bottom: 12px; }

.data-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(70,72,77,0.08); }
.data-row .k { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: __THEME_TEXT_DIM__; }
.data-row .v { font-size: 10px; font-weight: 600; color: __THEME_TEXT__; }

.center-stage {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, __THEME_BG2__ 0%, __THEME_BG__ 70%);
  overflow: hidden;
}

.bottom-hud {
  grid-column: 1 / -1;
  display: grid; grid-template-columns: repeat(4, 1fr);
  background: __THEME_HUD_BG__;
  border-top: 1px solid __THEME_BORDER__;
  position: relative;
}
.bottom-hud::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, __THEME_PRIMARY__, __THEME_SECONDARY__, __THEME_PRIMARY__, transparent);
  opacity: 0.6;
}
.hud-cell {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 6px 0; position: relative;
}
.hud-cell:not(:last-child)::after {
  content: ''; position: absolute; right: 0; top: 12px; bottom: 12px;
  width: 1px; background: rgba(70,72,77,0.15);
}
.hud-cell .hud-label { margin-bottom: 2px; font-size: 8px; }
.hud-cell .hud-value { font-size: 15px; }

@keyframes pulse-dot { 0%,100%{ opacity:1; } 50%{ opacity:0.4; } }
@keyframes fade-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
.fade-in { animation: fade-in 0.5s ease-out both; }
</style>
</head>
<body>
<div class="hud-container">
  <div class="top-bar">
    <div style="display:flex;align-items:center;gap:10px;">
      <span class="status-dot"></span>
      <span class="title">MOLECULE_LAB</span>
    </div>
    <div class="mol-nav" id="molNav">
      <button class="mol-btn active" data-mol="0">H2O</button>
      <button class="mol-btn" data-mol="1">NH3</button>
      <button class="mol-btn" data-mol="2">GLYCINE</button>
    </div>
  </div>

  <div class="panel-left" id="panelLeft">
    <div class="panel-section fade-in">
      <div class="circuit-header"></div>
      <div class="hud-label">MOLECULE</div>
      <div class="hud-value p" id="molName">H2O</div>
      <div style="font-size:10px;color:__THEME_TEXT_DIM__;margin-top:2px;" id="molCnName">水分子</div>
    </div>
    <div class="panel-section fade-in" style="animation-delay:0.1s">
      <div class="circuit-header s"></div>
      <div class="hud-label">BOND_ANALYSIS</div>
      <div id="bondInfo"></div>
    </div>
    <div class="panel-section fade-in" style="animation-delay:0.2s">
      <div class="circuit-header a"></div>
      <div class="hud-label">PROPERTIES</div>
      <div id="propInfo"></div>
    </div>
  </div>

  <div class="center-stage" id="centerStage">
    <svg id="molSvg" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="atomGlow">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="bondGlow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <!-- Background grid -->
      <g opacity="0.04" stroke="__THEME_PRIMARY__" stroke-width="0.5">
        <line x1="0" y1="150" x2="400" y2="150"/><line x1="200" y1="0" x2="200" y2="300"/>
        <circle cx="200" cy="150" r="60" fill="none"/><circle cx="200" cy="150" r="120" fill="none"/>
      </g>
      <g id="bonds"></g>
      <g id="atoms"></g>
      <g id="labels"></g>
    </svg>
  </div>

  <div class="panel-right" id="panelRight">
    <div class="panel-section fade-in">
      <div class="circuit-header"></div>
      <div class="hud-label">COMPOSITION</div>
      <div id="compBars" style="margin-top:6px;"></div>
    </div>
    <div class="panel-section fade-in" style="animation-delay:0.1s;margin-top:14px;">
      <div class="circuit-header s"></div>
      <div class="hud-label">ATOM_COUNT</div>
      <div id="atomCounts"></div>
    </div>
  </div>

  <div class="bottom-hud">
    <div class="hud-cell"><div class="hud-label">ATOMS</div><div class="hud-value" id="hudAtoms">3</div></div>
    <div class="hud-cell"><div class="hud-label">BONDS</div><div class="hud-value" id="hudBonds">2</div></div>
    <div class="hud-cell"><div class="hud-label">FORMULA</div><div class="hud-value" id="hudFormula" style="font-size:13px;">H2O</div></div>
    <div class="hud-cell"><div class="hud-label">ELEMENTS</div><div class="hud-value" id="hudElements">2</div></div>
  </div>
</div>

<script>
(function(){
"use strict";

var CPK = { C:"#4a5568", H:"#e2e8f0", N:"#3b82f6", O:"#ef4444", S:"#eab308" };
var RADII = { C:18, H:10, N:16, O:15, S:20 };

var MOLECULES = [
  {
    name: "H2O", cnName: "水分子", formula: "H2O",
    atoms: [{el:"O",x:200,y:140},{el:"H",x:145,y:190},{el:"H",x:255,y:190}],
    bonds: [{a:0,b:1,type:"single"},{a:0,b:2,type:"single"}],
    bondInfo: [{k:"O-H_LENGTH",v:"0.096 nm"},{k:"H-O-H_ANGLE",v:"104.5 deg"},{k:"BOND_TYPE",v:"COVALENT"}],
    props: [{k:"STATE",v:"LIQUID"},{k:"POLARITY",v:"POLAR"},{k:"BOILING",v:"100 C"}]
  },
  {
    name: "NH3", cnName: "氨分子", formula: "NH3",
    atoms: [{el:"N",x:200,y:120},{el:"H",x:140,y:185},{el:"H",x:200,y:200},{el:"H",x:260,y:185}],
    bonds: [{a:0,b:1,type:"single"},{a:0,b:2,type:"single"},{a:0,b:3,type:"single"}],
    bondInfo: [{k:"N-H_LENGTH",v:"0.101 nm"},{k:"H-N-H_ANGLE",v:"107.8 deg"},{k:"BOND_TYPE",v:"COVALENT"}],
    props: [{k:"STATE",v:"GAS"},{k:"POLARITY",v:"POLAR"},{k:"BOILING",v:"-33 C"}]
  },
  {
    name: "Glycine", cnName: "甘氨酸", formula: "C2H5NO2",
    atoms: [
      {el:"N",x:80,y:150},{el:"C",x:155,y:150},{el:"C",x:235,y:150},
      {el:"O",x:295,y:100},{el:"O",x:295,y:200},
      {el:"H",x:80,y:205},{el:"H",x:40,y:120},
      {el:"H",x:140,y:205},{el:"H",x:170,y:205}
    ],
    bonds: [
      {a:0,b:1,type:"single"},{a:1,b:2,type:"single"},
      {a:2,b:3,type:"double"},{a:2,b:4,type:"single"},
      {a:0,b:5,type:"single"},{a:0,b:6,type:"single"},
      {a:1,b:7,type:"single"},{a:1,b:8,type:"single"}
    ],
    bondInfo: [{k:"C-N_LENGTH",v:"0.147 nm"},{k:"C-C_LENGTH",v:"0.152 nm"},{k:"C=O_LENGTH",v:"0.123 nm"},{k:"TOTAL_BONDS",v:"8"}],
    props: [{k:"TYPE",v:"AMINO_ACID"},{k:"MW",v:"75.03 Da"},{k:"ATOMS",v:"10"}]
  }
];

var currentMol = 0;
var svg = document.getElementById("molSvg");
var bondsG = document.getElementById("bonds");
var atomsG = document.getElementById("atoms");
var labelsG = document.getElementById("labels");

function renderMol(idx){
  currentMol = idx;
  var mol = MOLECULES[idx];
  bondsG.innerHTML = ""; atomsG.innerHTML = ""; labelsG.innerHTML = "";

  // Draw bonds
  mol.bonds.forEach(function(b){
    var a1 = mol.atoms[b.a], a2 = mol.atoms[b.b];
    if(b.type === "single"){
      var line = document.createElementNS("http://www.w3.org/2000/svg","line");
      line.setAttribute("x1",a1.x); line.setAttribute("y1",a1.y);
      line.setAttribute("x2",a2.x); line.setAttribute("y2",a2.y);
      line.setAttribute("stroke","__THEME_PRIMARY__"); line.setAttribute("stroke-width","2");
      line.setAttribute("opacity","0.6"); line.setAttribute("filter","url(#bondGlow)");
      bondsG.appendChild(line);
    } else {
      var dx=a2.x-a1.x, dy=a2.y-a1.y, len=Math.sqrt(dx*dx+dy*dy);
      var nx=-dy/len*4, ny=dx/len*4;
      [-1,1].forEach(function(s){
        var l = document.createElementNS("http://www.w3.org/2000/svg","line");
        l.setAttribute("x1",a1.x+nx*s); l.setAttribute("y1",a1.y+ny*s);
        l.setAttribute("x2",a2.x+nx*s); l.setAttribute("y2",a2.y+ny*s);
        l.setAttribute("stroke","__THEME_PRIMARY__"); l.setAttribute("stroke-width","2");
        l.setAttribute("opacity","0.6"); l.setAttribute("filter","url(#bondGlow)");
        bondsG.appendChild(l);
      });
    }
  });

  // Draw atoms
  mol.atoms.forEach(function(a,i){
    var r = RADII[a.el];
    // Glow
    var gc = document.createElementNS("http://www.w3.org/2000/svg","circle");
    gc.setAttribute("cx",a.x); gc.setAttribute("cy",a.y); gc.setAttribute("r",r*2);
    gc.setAttribute("fill",CPK[a.el]); gc.setAttribute("opacity","0.1");
    atomsG.appendChild(gc);
    // Main circle
    var c = document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",a.x); c.setAttribute("cy",a.y); c.setAttribute("r",r);
    c.setAttribute("fill",CPK[a.el]); c.setAttribute("filter","url(#atomGlow)");
    atomsG.appendChild(c);
    // Specular
    var sp = document.createElementNS("http://www.w3.org/2000/svg","ellipse");
    sp.setAttribute("cx",a.x-r*0.25); sp.setAttribute("cy",a.y-r*0.3);
    sp.setAttribute("rx",r*0.35); sp.setAttribute("ry",r*0.2);
    sp.setAttribute("fill","white"); sp.setAttribute("opacity","0.35");
    atomsG.appendChild(sp);
    // Label
    var t = document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x",a.x); t.setAttribute("y",a.y+4);
    t.setAttribute("text-anchor","middle");
    t.setAttribute("font-family","'Space Grotesk', sans-serif");
    t.setAttribute("font-size", r > 12 ? "12" : "8");
    t.setAttribute("font-weight","700");
    t.setAttribute("fill", a.el === "H" ? "#1a1a2e" : "#ffffff");
    t.textContent = a.el;
    labelsG.appendChild(t);
  });

  // Update panels
  document.getElementById("molName").textContent = mol.name;
  document.getElementById("molCnName").textContent = mol.cnName;

  var bondInfoEl = document.getElementById("bondInfo");
  bondInfoEl.innerHTML = "";
  mol.bondInfo.forEach(function(b){
    bondInfoEl.innerHTML += '<div class="data-row"><span class="k">'+b.k+'</span><span class="v">'+b.v+'</span></div>';
  });

  var propInfoEl = document.getElementById("propInfo");
  propInfoEl.innerHTML = "";
  mol.props.forEach(function(p){
    propInfoEl.innerHTML += '<div class="data-row"><span class="k">'+p.k+'</span><span class="v">'+p.v+'</span></div>';
  });

  // Composition bars
  var counts = {};
  mol.atoms.forEach(function(a){ counts[a.el] = (counts[a.el]||0) + 1; });
  var total = mol.atoms.length;
  var compEl = document.getElementById("compBars");
  compEl.innerHTML = "";
  Object.keys(counts).sort().forEach(function(el){
    var pct = Math.round(counts[el]/total*100);
    compEl.innerHTML +=
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">' +
      '<span style="font-size:10px;width:14px;font-weight:600;color:'+CPK[el]+';">'+el+'</span>' +
      '<div style="flex:1;height:5px;background:__THEME_SURFACE_HIGHEST__;border-radius:3px;overflow:hidden;">' +
      '<div style="width:'+pct+'%;height:100%;background:'+CPK[el]+';border-radius:3px;box-shadow:0 0 6px '+CPK[el]+';transition:width 0.5s;"></div>' +
      '</div>' +
      '<span style="font-size:8px;color:__THEME_TEXT_DIM__;">'+pct+'%</span>' +
      '</div>';
  });

  var acEl = document.getElementById("atomCounts");
  acEl.innerHTML = "";
  Object.keys(counts).sort().forEach(function(el){
    acEl.innerHTML += '<div class="data-row"><span class="k">'+el+'</span><span class="v">'+counts[el]+'</span></div>';
  });

  // Bottom HUD
  document.getElementById("hudAtoms").textContent = total;
  document.getElementById("hudBonds").textContent = mol.bonds.length;
  document.getElementById("hudFormula").textContent = mol.formula;
  var elCount = Object.keys(counts).length;
  document.getElementById("hudElements").textContent = elCount;
}

document.querySelectorAll(".mol-btn").forEach(function(btn){
  btn.addEventListener("click", function(){
    document.querySelectorAll(".mol-btn").forEach(function(b){ b.classList.remove("active"); });
    btn.classList.add("active");
    renderMol(parseInt(btn.dataset.mol));
  });
});

renderMol(0);
})();
</script>
</body>
</html>"""


# ── Idea 自我辩论系统 ─────────────────────────────────────────────

def _debate_idea(
    idea_id: str,
    mode: str,
    topic: str,
    objections: list[str],
    rebuttals: list[str],
    scores: dict[str, int],
) -> bool:
    total = sum(scores.values())
    avg = total / len(scores)
    passed = avg >= 6.0

    console.print(f"\n[bold]-- Idea 辩论：[cyan]{mode}[/cyan] · {topic[:50]}[/bold]")
    for i, (obj, reb) in enumerate(zip(objections, rebuttals), 1):
        console.print(f"  [red]质疑{i}[/red]: {obj}")
        console.print(f"  [green]反驳{i}[/green]: {reb}")
    score_str = " | ".join(f"{k}={v}" for k, v in scores.items())
    result = "[bold green]通过[/bold green]" if passed else "[bold red]不通过（已跳过）[/bold red]"
    console.print(f"  得分 ({score_str}) 均值={avg:.1f} -> {result}")
    return passed


_IDEA_DEBATES = {

    # 候选1：原子结构 HUD（SVG + HTML 仪表盘）
    "anim_atom_hud": _debate_idea(
        idea_id="anim_atom_hud",
        mode="animation",
        topic="原子结构 HUD 仪表盘——SVG 原子模型+元素数据面板+CPK图例",
        objections=[
            "HUD 仪表盘展示原子数据（原子序数/质量/电子构型）对10岁孩子来说信息密度过高，"
            "孩子看不懂'1s2 2s2 2p2'这样的电子构型符号，面板数据可能变成视觉噪音",
            "五个元素的切换交互只是简单的数据替换，教学深度不足——"
            "孩子点了5个按钮就结束了，没有渐进式学习体验",
        ],
        rebuttals=[
            "电子构型是'看不懂也没关系'的高阶数据展示，目的不是让孩子理解符号本身，"
            "而是传达'每个原子有独特身份信息'这个直觉；HUD面板的主要信息通道是"
            "CPK颜色图例和原子半径大小对比，这些10岁孩子完全能理解",
            "五元素切换的核心教学目标是建立'C/H/N/O/S各不相同'的直觉，"
            "配合右侧CPK颜色图例和大小对比条，形成视觉记忆锚点；"
            "深度学习交给分子组装台（ANIM2）的分子级别交互",
        ],
        scores={"teaching_fit": 8, "feasibility": 9, "cognitive": 7, "completion": 8},
    ),

    # 候选2：分子组装台 HUD
    "anim_molecule_lab": _debate_idea(
        idea_id="anim_molecule_lab",
        mode="animation",
        topic="分子组装台——HUD展示H2O/NH3/甘氨酸的ball-and-stick模型",
        objections=[
            "Ball-and-stick模型是静态SVG渲染，缺乏动画效果，"
            "和ANIM1的原子浏览器教学目标高度重叠——都是'看原子/分子的组成'",
            "甘氨酸有10个原子8条键，SVG静态图上很拥挤，"
            "在小屏幕上元素标签会互相遮挡",
        ],
        rebuttals=[
            "ANIM1聚焦单个原子的属性探索（微观），ANIM2聚焦分子整体（中观），"
            "视角不同：ANIM1回答'原子是什么'，ANIM2回答'原子如何组成分子'——"
            "这是本节课两个核心学习目标的自然分层",
            "甘氨酸的10个原子在400x300的SVG中分布合理，"
            "氢原子用小圆（r=10）碳氮氧用大圆（r=15-18），标签在原子内部不会遮挡；"
            "键角和键长数据放在左侧面板，不占用SVG空间",
        ],
        scores={"teaching_fit": 7, "feasibility": 8, "cognitive": 7, "completion": 7},
    ),

    # 候选3：道尔顿历史故事
    "story_dalton": _debate_idea(
        idea_id="story_dalton",
        mode="story",
        topic="道尔顿的实验——历史上人类如何发现原子的存在",
        objections=[
            "历史故事对'如何用原子思维看蛋白质'这个本节核心目标贡献为零，"
            "道尔顿研究的是气体，和蛋白质结构的关联性极弱",
            "故事只有4段文字，和HUD动画相比信息密度和吸引力都低一个量级",
        ],
        rebuttals=[
            "故事回答本节开篇问题'物质是什么做的'——道尔顿正是历史上第一个给出有说服力答案的人",
            "故事作为两个动画之间的呼吸节点，节奏价值是正的；4段文字读完不到2分钟",
        ],
        scores={"teaching_fit": 7, "feasibility": 10, "cognitive": 7, "completion": 6},
    ),

    # 候选4：元素识别游戏
    "game_element_quiz": _debate_idea(
        idea_id="game_element_quiz",
        mode="game",
        topic="元素识别——给出CPK颜色猜元素名称的快速问答游戏",
        objections=[
            "CPK颜色只有5种，做成猜测游戏最多5轮就结束了，游戏深度极浅",
            "ANIM1的CPK图例面板已经提供了颜色-元素的直接对应，"
            "再做一个'看颜色猜元素'是重复教学",
            "游戏需要计分/计时/反馈机制，实现复杂度高且容易出bug",
        ],
        rebuttals=[
            "5种颜色可以通过随机重复、限时模式增加难度——但这只是延长时间，不增加知识深度",
            "被动看图例和主动回忆是不同的记忆通道——但差异化不够，"
            "因为ANIM1的点击切换已经是半主动操作",
            "计分机制可以极简化：只显示正确/错误，不做排行榜——但即便如此，"
            "收益和ANIM1+ANIM2已覆盖的教学目标高度重叠",
        ],
        scores={"teaching_fit": 5, "feasibility": 5, "cognitive": 5, "completion": 4},
    ),
}

console.print(f"\n[bold]辩论汇总：{sum(1 for v in _IDEA_DEBATES.values() if v)}/{len(_IDEA_DEBATES)} 个 idea 通过[/bold]\n")

DEBATE_PASSED = set(k for k, v in _IDEA_DEBATES.items() if v)


# ── 主题替换 ────────────────────────────────────────────────────

def _apply_theme(html: str, theme: dict) -> str:
    """
    将动画 HTML 中的 __THEME_*__ 占位符替换为当前项目主题色。
    """
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
    }
    for placeholder, value in replacements.items():
        html = html.replace(placeholder, value)
    return html


# ── 组装 CourseContent ──────────────────────────────────────────

def build_course_content() -> dict:
    plan_with_placeholders = PLAN_MARKDOWN

    # 在课文中插入 idea 占位符
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 第四部分：历史故事——约翰·道尔顿和彩色小球",
        f"[[IDEA:{STORY_ID}]]\n\n## 第四部分：历史故事——约翰·道尔顿和彩色小球"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 第一部分：原子有多小？",
        f"[[IDEA:{ANIM1_ID}]]\n\n## 第一部分：原子有多小？"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 第二部分：蛋白质里有哪些原子？",
        f"[[IDEA:{ANIM2_ID}]]\n\n## 第二部分：蛋白质里有哪些原子？"
    )
    plan_with_placeholders = plan_with_placeholders.replace(
        "## 检测你学会了吗？",
        f"[[IDEA:{EXER_ID}]]\n\n## 检测你学会了吗？"
    )

    all_candidates = [
        (
            "anim_atom_hud",
            {
                "idea_id": ANIM1_ID,
                "mode": "animation",
                "topic": "原子结构 HUD 仪表盘：SVG 原子模型+元素数据面板+CPK颜色图例+Probe连线",
                "context_summary": (
                    "HUD 仪表盘风格展示原子结构。中央 SVG 原子模型（电子云轨道+核心呼吸灯），"
                    "左侧 glass panel 展示元素数据（ATOMIC_NUMBER, MASS, ELECTRON_CONFIG），"
                    "右侧 glass panel 展示 CPK 颜色图例。点击切换 C/H/N/O/S。"
                ),
                "generation_backend": "claude_code_direct",
                "style_key": "biotech_life",
                "mode_reason": (
                    "辩论通过：HUD仪表盘风格直观展示原子属性，CPK颜色图例建立视觉记忆锚点，"
                    "五元素切换提供互动式学习体验"
                ),
            },
            {
                ANIM1_ID: {
                    "mode": "animation",
                    "status": "ready",
                    "html": _apply_theme(ANIM1_HTML, T),
                    "story_paragraphs": None,
                    "exercises": None,
                    "generation_backend": "claude_code_direct",
                }
            },
        ),
        (
            "anim_molecule_lab",
            {
                "idea_id": ANIM2_ID,
                "mode": "animation",
                "topic": "分子组装台 HUD：ball-and-stick 模型+键分析面板+元素占比",
                "context_summary": (
                    "HUD 仪表盘风格展示分子结构。中央 SVG ball-and-stick 模型，"
                    "左侧 glass panel 展示键分析（键长、键角），"
                    "右侧展示元素占比条形图。切换 H2O/NH3/Glycine。"
                ),
                "generation_backend": "claude_code_direct",
                "style_key": "biotech_life",
                "mode_reason": (
                    "辩论通过：从单原子到分子的视角递进，ball-and-stick模型直观展示原子如何组成分子"
                ),
            },
            {
                ANIM2_ID: {
                    "mode": "animation",
                    "status": "ready",
                    "html": _apply_theme(ANIM2_HTML, T),
                    "story_paragraphs": None,
                    "exercises": None,
                    "generation_backend": "claude_code_direct",
                }
            },
        ),
        (
            "story_dalton",
            {
                "idea_id": STORY_ID,
                "mode": "story",
                "topic": "道尔顿的发现——倍比定律与第一个原子模型",
                "context_summary": (
                    "通过道尔顿用气体混合比例推断原子存在的故事，"
                    "建立'物质由原子组成'这一世界观的历史根基。"
                ),
                "generation_backend": "claude_code_direct",
                "style_key": "",
                "mode_reason": "辩论通过：对应开篇问题'物质是什么'，激发历史感和科学直觉",
            },
            {
                STORY_ID: {
                    "mode": "story",
                    "status": "ready",
                    "html": None,
                    "story_paragraphs": STORY_PARAGRAPHS,
                    "exercises": None,
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
                "topic": "原子与元素知识点巩固练习",
                "context_summary": "检验学生对CPK颜色、原子大小、化学键类型和道尔顿证据的理解",
                "generation_backend": "claude_code_direct",
                "style_key": "",
                "mode_reason": "练习题巩固学习，即时检测理解",
            },
            {
                EXER_ID: {
                    "mode": "exercise",
                    "status": "ready",
                    "html": None,
                    "story_paragraphs": None,
                    "exercises": EXERCISES,
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
            console.print(f"[yellow]跳过（辩论未通过）：{idea_dict['topic'][:50]}[/yellow]")

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
        f"节点：knode_id={TARGET_KNODE_ID} · {TARGET_NODE_TITLE}\n"
        "内容：完整课程文本 + HUD仪表盘动画x2 + 历史故事 + 5道练习题\n"
        "风格：Stitch HUD 仪表盘（Space Grotesk + glass panel + 霓虹色）",
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

    # 5. 为所有节点创建 pending 状态的占位 lesson（已有则跳过）
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
        console.print(f"[green]v {node_count} 个节点占位记录确认[/green]")
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

        anim_count  = sum(1 for s in course_content["rendered_sections"].values()
                         if s["mode"] == "animation")
        story_count = sum(
            len(s.get("story_paragraphs") or [])
            for s in course_content["rendered_sections"].values()
        )
        exer_count  = sum(
            len(s.get("exercises") or [])
            for s in course_content["rendered_sections"].values()
        )
        total_html  = sum(
            len(s.get("html") or "")
            for s in course_content["rendered_sections"].values()
        )

        console.print(f"\n[bold green]完成！[/bold green]")
        console.print(f"  节点 {TARGET_KNODE_ID}（{TARGET_NODE_TITLE}）已写入")
        console.print(f"  课程文本：{len(PLAN_MARKDOWN)} 字符")
        console.print(f"  HUD 动画：{anim_count} 个（共 {total_html} 字节 HTML）")
        console.print(f"  故事段落：{story_count} 段")
        console.print(f"  练习题：{exer_count} 道")
        console.print(f"\n访问：[dim]http://localhost:3000/projects/{PROJECT_NAME}[/dim]")
        console.print(f"（进入项目，找到节点 knode_id={TARGET_KNODE_ID}）")
    finally:
        db2.close()


if __name__ == "__main__":
    write_everything()
