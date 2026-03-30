"""
GP-01 蛋白结构探险地图 — 节点 knode_id=3
「原子是什么：乐高积木类比」完整课程内容

不调用任何 LLM agent pipeline。
Claude Code 直接生成：课程文本 + Canvas 动画 + 练习题 + 故事
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

# ── 视觉主题系统（与 _gen_protein_structure.py 完全一致）──────────

VISUAL_THEMES = {
    # 生命科学/蛋白质 — 荧光显微镜暗色
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


# ── 工具 ───────────────────────────────────────────────────────

def _id(prefix: str) -> str:
    ts = int(time.time() * 1000)
    rand = "".join(random.choices(string.ascii_lowercase, k=4))
    return f"{prefix}_{ts}_{rand}"


# ── 项目基础信息 ───────────────────────────────────────────────

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
| 氮 | N | 蓝 | 氨基（-NH₂）的核心，肽键的一部分 |
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

**氢键**（…或虚线）
- 氢原子被两个电负性原子"抢着"
- 比共价键弱得多，但数量多时合力很强
- 蛋白质的二级结构（α螺旋、β折叠）靠氢键维持
- 乐高类比：两块积木叠放时的弱摩擦力——单个不强，但整块乐高模型靠它维持形状

### 一个水分子有多少原子？

水 H₂O = 2个氢原子 + 1个氧原子，总共3个原子。
它们靠2条 O-H 共价键连接。

甘氨酸（最简单的氨基酸）= C₂H₅NO₂ = 10个原子。

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

ANIM1_ID = _id("anim")   # 原子球棍模型
STORY_ID = _id("story")  # 道尔顿历史故事
EXER_ID  = _id("ex")     # 练习题
GAME_ID  = _id("game")   # 元素积木组装游戏

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
            "CPK颜色约定：C=灰/黑，H=白，N=蓝，O=红，S=黄。"
            "这套颜色是全球生化教材和3D分子软件的统一标准，"
            "氮（N）是蓝色，氧（O）是红色——这两个最容易混淆，请牢记。"
        ),
    },
    {
        "type": "choice",
        "question": "原子的直径大约是多少？",
        "options": [
            "A. 1毫米（mm）",
            "B. 1微米（μm，即0.001mm）",
            "C. 0.1纳米（nm，即百亿分之一米）",
            "D. 1纳米（nm）",
        ],
        "correct": 2,
        "explanation": (
            "原子直径约0.1纳米，即1埃（Å）。"
            "1毫米 > 1微米 > 1纳米 > 0.1纳米。"
            "你的头发直径约100微米，相当于100万个原子排成一排的宽度。"
            "蛋白质分子直径约5-10纳米，是原子的50-100倍。"
        ),
    },
    {
        "type": "choice",
        "question": "下面哪个类比最准确地描述了共价键与氢键的区别？",
        "options": [
            "A. 共价键像钉子（永久），氢键像双面胶（可反复）",
            "B. 共价键像乐高的卡扣（牢固，需要力才能拆），氢键像两块积木叠放的摩擦力（弱，但多了合力强）",
            "C. 两者强度相同，只是位置不同",
            "D. 氢键比共价键更强，因为氢键更多",
        ],
        "correct": 1,
        "explanation": (
            "共价键是两个原子共享电子形成的强结合（乐高卡扣），断开需要大量能量。"
            "氢键是氢原子被两个电负性原子之间的弱静电吸引（叠放摩擦力），单个很弱，"
            "但蛋白质里有数十到数百个氢键共同维持折叠结构——这正是α螺旋和β折叠能保持形状的原因。"
        ),
    },
    {
        "type": "choice",
        "question": "蛋白质中含有硫（S）原子的氨基酸是哪些？",
        "options": [
            "A. 丙氨酸（Ala）和缬氨酸（Val）",
            "B. 半胱氨酸（Cys）和甲硫氨酸（Met）",
            "C. 所有氨基酸都含硫",
            "D. 谷氨酸（Glu）和天冬氨酸（Asp）",
        ],
        "correct": 1,
        "explanation": (
            "只有半胱氨酸（Cys，C）和甲硫氨酸（Met，M）含有硫原子。"
            "半胱氨酸的硫可以与另一个半胱氨酸形成二硫键（S-S），"
            "这种强共价键能把蛋白质的不同部分'锁住'，对结构稳定非常重要——"
            "比如头发的硬度和卷发的形状就依赖二硫键。"
        ),
    },
    {
        "type": "choice",
        "question": "道尔顿提出原子学说的关键实验证据是什么？",
        "options": [
            "A. 用显微镜直接看到了原子",
            "B. 发现不同气体化合时总是成整数比（倍比定律）",
            "C. 测量了原子的直径",
            "D. 发现了原子核",
        ],
        "correct": 1,
        "explanation": (
            "道尔顿时代没有任何仪器能'看到'原子（原子直径0.1纳米，远超光学显微镜极限）。"
            "他的证据是间接的：碳和氧结合时，质量比总是1:1.33（CO）或1:2.66（CO2），"
            "这只能用'原子是离散颗粒，不能切成分数'来解释——这就是倍比定律。"
            "原子核是1909年卢瑟福通过金箔散射实验发现的，比道尔顿晚了100多年。"
        ),
    },
]

# ── 动画1：原子球棍模型（Canvas 2D，交互版）──────────────────────
# 场景：展示 H₂O、NH₃、甘氨酸骨架的原子构成
# 探索模式：hover显示tooltip，拖拽移动原子（化学键跟着拉伸）
# 技术：Canvas 2D + radialGradient + requestAnimationFrame

ANIM1_HTML = r"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>原子球棍模型</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: __THEME_BG__;
  font-family: __THEME_FONT__;
  user-select: none;
}
canvas { display: block; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
#tooltip {
  position: absolute;
  pointer-events: none;
  background: __THEME_CARD__;
  border: 1.5px solid __THEME_BORDER__;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: __THEME_TEXT__;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  opacity: 0;
  transition: opacity 0.15s;
  max-width: 160px;
  line-height: 1.5;
  z-index: 10;
}
#tooltip.show { opacity: 1; }
#tooltip .el-sym {
  font-size: 20px;
  font-weight: bold;
  color: __THEME_PRIMARY__;
  display: block;
  text-align: center;
}
#tooltip .el-name {
  font-size: 11px;
  color: __THEME_TEXT_DIM__;
  text-align: center;
  display: block;
  margin-bottom: 3px;
}
#tooltip .el-desc {
  font-size: 10px;
  color: __THEME_TEXT__;
  border-top: 1px solid __THEME_BORDER__;
  padding-top: 4px;
  margin-top: 2px;
}
#mol-nav {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
}
.mol-btn {
  padding: 5px 14px;
  border-radius: 20px;
  border: 1.5px solid __THEME_BORDER__;
  background: __THEME_CARD__;
  color: __THEME_TEXT__;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: __THEME_FONT__;
}
.mol-btn:hover { border-color: __THEME_PRIMARY__; color: __THEME_PRIMARY__; }
.mol-btn.active {
  background: __THEME_PRIMARY__;
  border-color: __THEME_PRIMARY__;
  color: #fff;
  font-weight: bold;
}
#hint {
  position: absolute;
  top: 38px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: __THEME_TEXT_DIM__;
  background: __THEME_HUD_BG__;
  padding: 3px 10px;
  border-radius: 10px;
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="tooltip"><span class="el-sym"></span><span class="el-name"></span><div class="el-desc"></div></div>
<div id="mol-nav">
  <button class="mol-btn active" data-mol="0">水 H₂O</button>
  <button class="mol-btn" data-mol="1">氨 NH₃</button>
  <button class="mol-btn" data-mol="2">甘氨酸</button>
</div>
<div id="hint">hover原子查看信息 · 拖动改变位置</div>
<script>
(function(){
"use strict";

var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
var tooltip = document.getElementById("tooltip");
var W = 600, H = 420;
var DPR = Math.min(window.devicePixelRatio||1, 2);

function resize(){
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * DPR;
  canvas.height = rect.height * DPR;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(DPR * rect.width / W, DPR * rect.height / H);
}
resize();
window.addEventListener("resize", resize);

// CPK 颜色 + 元素信息
var ELEMENTS = {
  "C": {
    color1: "#4a5568", color2: "#718096", color3: "#2d3748",
    r: 18, name: "碳 Carbon", desc: "骨架主力，4个键，可链可环"
  },
  "H": {
    color1: "#e2e8f0", color2: "#f7fafc", color3: "#a0aec0",
    r: 11, name: "氢 Hydrogen", desc: "数量最多，最轻，填充各处"
  },
  "N": {
    color1: "#3b82f6", color2: "#60a5fa", color3: "#1d4ed8",
    r: 16, name: "氮 Nitrogen", desc: "氨基核心，蓝色，参与氢键"
  },
  "O": {
    color1: "#ef4444", color2: "#f87171", color3: "#b91c1c",
    r: 15, name: "氧 Oxygen", desc: "羧基核心，红色，强电负性"
  },
  "S": {
    color1: "#eab308", color2: "#fde047", color3: "#a16207",
    r: 20, name: "硫 Sulfur", desc: "可形成二硫键，赋予结构稳定"
  },
};

// 分子定义（原子 + 键）
// 坐标：以 W/2, (H-60)/2 为中心
var MOLECULES = [
  // 水 H2O
  {
    title: "水分子 H₂O",
    formula: "2个氢 + 1个氧 = 3个原子",
    atoms: [
      { el: "O", x: 300, y: 185 },
      { el: "H", x: 255, y: 225 },
      { el: "H", x: 345, y: 225 },
    ],
    bonds: [
      { a: 0, b: 1, type: "single" },
      { a: 0, b: 2, type: "single" },
    ],
  },
  // 氨 NH3
  {
    title: "氨分子 NH₃",
    formula: "1个氮 + 3个氢 = 4个原子",
    atoms: [
      { el: "N", x: 300, y: 175 },
      { el: "H", x: 255, y: 225 },
      { el: "H", x: 300, y: 235 },
      { el: "H", x: 345, y: 225 },
    ],
    bonds: [
      { a: 0, b: 1, type: "single" },
      { a: 0, b: 2, type: "single" },
      { a: 0, b: 3, type: "single" },
    ],
  },
  // 甘氨酸骨架 (简化) H2N-CH2-COOH
  {
    title: "甘氨酸骨架（最简单的氨基酸）",
    formula: "C₂H₅NO₂ = 10个原子（此处展示骨架5个重原子）",
    atoms: [
      { el: "N",  x: 185, y: 185 },  // 氨基 N
      { el: "C",  x: 260, y: 185 },  // Cα
      { el: "C",  x: 335, y: 185 },  // 羧基 C
      { el: "O",  x: 375, y: 150 },  // =O
      { el: "O",  x: 375, y: 220 },  // -OH
      { el: "H",  x: 185, y: 233 },  // N-H
      { el: "H",  x: 145, y: 162 },  // N-H
      { el: "H",  x: 250, y: 233 },  // Cα-H
      { el: "H",  x: 270, y: 233 },  // Cα-H
    ],
    bonds: [
      { a: 0, b: 1, type: "single" },
      { a: 1, b: 2, type: "single" },
      { a: 2, b: 3, type: "double" },
      { a: 2, b: 4, type: "single" },
      { a: 0, b: 5, type: "single" },
      { a: 0, b: 6, type: "single" },
      { a: 1, b: 7, type: "single" },
      { a: 1, b: 8, type: "single" },
    ],
  },
];

// 当前分子状态（可变坐标）
var currentMolIdx = 0;
var atoms = [];  // {el, x, y, vx, vy}

function loadMolecule(idx) {
  currentMolIdx = idx;
  var mol = MOLECULES[idx];
  atoms = mol.atoms.map(function(a){
    return { el: a.el, x: a.x, y: a.y, vx: 0, vy: 0 };
  });
  // 动画：原子从中心飞出
  var cx = W/2, cy = (H-60)/2;
  atoms.forEach(function(a){
    a._targetX = a.x; a._targetY = a.y;
    a.x = cx; a.y = cy;
  });
  phase = "assemble"; assembleT = 0;
  dragIdx = -1; hoveredIdx = -1;
}

// 动画阶段
var phase = "assemble";
var assembleT = 0;  // 0->1
var lastTime = 0;

// 交互状态
var dragIdx = -1;
var hoveredIdx = -1;
var dragOffX = 0, dragOffY = 0;

function easeOut(t){ return 1 - Math.pow(1-t, 3); }

// canvas坐标转逻辑坐标
function canvasToLogic(cx, cy){
  var rect = canvas.getBoundingClientRect();
  return {
    x: (cx / rect.width) * W,
    y: (cy / rect.height) * H,
  };
}

function getAtomAt(lx, ly){
  for(var i = atoms.length-1; i >= 0; i--){
    var a = atoms[i];
    var el = ELEMENTS[a.el];
    var dx = lx - a.x, dy = ly - a.y;
    if(dx*dx + dy*dy <= (el.r+4)*(el.r+4)) return i;
  }
  return -1;
}

// 鼠标/触摸事件
function getEventLogic(e){
  var rect = canvas.getBoundingClientRect();
  var cx = e.clientX || (e.touches && e.touches[0].clientX);
  var cy = e.clientY || (e.touches && e.touches[0].clientY);
  return canvasToLogic(cx - rect.left, cy - rect.top);
}

canvas.addEventListener("mousemove", function(e){
  var p = getEventLogic(e);
  if(dragIdx >= 0){
    atoms[dragIdx].x = p.x - dragOffX;
    atoms[dragIdx].y = p.y - dragOffY;
    hoveredIdx = dragIdx;
    showTooltip(dragIdx, e.clientX, e.clientY);
    return;
  }
  var idx = getAtomAt(p.x, p.y);
  hoveredIdx = idx;
  if(idx >= 0){
    canvas.style.cursor = "grab";
    showTooltip(idx, e.clientX, e.clientY);
  } else {
    canvas.style.cursor = "default";
    hideTooltip();
  }
});

canvas.addEventListener("mousedown", function(e){
  var p = getEventLogic(e);
  var idx = getAtomAt(p.x, p.y);
  if(idx >= 0){
    dragIdx = idx;
    dragOffX = p.x - atoms[idx].x;
    dragOffY = p.y - atoms[idx].y;
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  }
});

canvas.addEventListener("mouseup", function(){
  dragIdx = -1;
  canvas.style.cursor = "default";
});

canvas.addEventListener("mouseleave", function(){
  dragIdx = -1;
  hoveredIdx = -1;
  hideTooltip();
  canvas.style.cursor = "default";
});

function showTooltip(idx, cx, cy){
  var el = ELEMENTS[atoms[idx].el];
  tooltip.querySelector(".el-sym").textContent = atoms[idx].el;
  tooltip.querySelector(".el-name").textContent = el.name;
  tooltip.querySelector(".el-desc").textContent = el.desc;
  var rect = canvas.getBoundingClientRect();
  var tx = cx - rect.left + 14;
  var ty = cy - rect.top - 20;
  if(tx + 165 > rect.width) tx = cx - rect.left - 175;
  tooltip.style.left = tx + "px";
  tooltip.style.top  = ty + "px";
  tooltip.classList.add("show");
}

function hideTooltip(){
  tooltip.classList.remove("show");
}

// 分子切换按钮
document.querySelectorAll(".mol-btn").forEach(function(btn){
  btn.addEventListener("click", function(){
    document.querySelectorAll(".mol-btn").forEach(function(b){ b.classList.remove("active"); });
    btn.classList.add("active");
    loadMolecule(parseInt(btn.getAttribute("data-mol")));
  });
});

// ── 绘制函数 ───────────────────────────────────────────────────

function drawBackground(){
  // 背景渐变
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "__THEME_BG__");
  g.addColorStop(1, "__THEME_BG2__");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 网格
  ctx.strokeStyle = "__THEME_GRID__";
  ctx.lineWidth = 1;
  for(var x = 0; x <= W; x += 40){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
  }
  for(var y = 0; y <= H; y += 40){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
}

function drawTitle(mol){
  ctx.font = "bold 15px '__THEME_FONT__'";
  ctx.textAlign = "center";
  ctx.fillStyle = "__THEME_TEXT__";
  ctx.fillText("原子球棍模型：" + mol.title, W/2, 26);

  ctx.font = "11px '__THEME_FONT__'";
  ctx.fillStyle = "__THEME_TEXT_DIM__";
  ctx.fillText(mol.formula, W/2, 46);
}

function drawBond(x1, y1, x2, y2, type, highlight){
  var dx = x2-x1, dy = y2-y1;
  var len = Math.sqrt(dx*dx+dy*dy);
  if(len < 1) return;
  var nx = -dy/len, ny = dx/len;

  ctx.strokeStyle = highlight ? "__THEME_PRIMARY__" : "__THEME_SECONDARY__";
  ctx.lineWidth = highlight ? 3 : 2.5;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.75;

  if(type === "single"){
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if(type === "double"){
    var off = 3;
    ctx.beginPath();
    ctx.moveTo(x1+nx*off, y1+ny*off); ctx.lineTo(x2+nx*off, y2+ny*off);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1-nx*off, y1-ny*off); ctx.lineTo(x2-nx*off, y2-ny*off);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawAtom(a, hovered){
  var el = ELEMENTS[a.el];
  var r = el.r;

  // 外发光（hover或拖拽时）
  if(hovered){
    ctx.save();
    ctx.shadowColor = el.color1;
    ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(a.x, a.y, r+4, 0, Math.PI*2);
    ctx.fillStyle = el.color1;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.restore();
  }

  // 球体：径向渐变（立体感）
  var grad = ctx.createRadialGradient(
    a.x - r*0.3, a.y - r*0.3, r*0.05,
    a.x, a.y, r
  );
  grad.addColorStop(0, el.color2);
  grad.addColorStop(0.45, el.color1);
  grad.addColorStop(1, el.color3);

  ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 高光点
  var hlGrad = ctx.createRadialGradient(
    a.x - r*0.3, a.y - r*0.35, 0,
    a.x - r*0.3, a.y - r*0.35, r*0.5
  );
  hlGrad.addColorStop(0, "rgba(255,255,255,0.55)");
  hlGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, Math.PI*2);
  ctx.fillStyle = hlGrad;
  ctx.fill();

  // 元素符号
  ctx.font = "bold " + Math.round(r * 1.1) + "px 'Noto Sans SC',sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 0.92;
  ctx.fillText(a.el, a.x, a.y + 0.5);
  ctx.globalAlpha = 1;
}

function drawHUD(){
  var mol = MOLECULES[currentMolIdx];
  var by = H - 52;
  // HUD背景
  ctx.fillStyle = "__THEME_HUD_BG__";
  ctx.fillRect(0, by, W, 52);
  ctx.strokeStyle = "rgba(5,150,105,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(W, by); ctx.stroke();

  // 分隔线
  for(var ci = 1; ci < 4; ci++){
    var lx = W/4 * ci;
    ctx.beginPath(); ctx.moveTo(lx, by); ctx.lineTo(lx, H); ctx.stroke();
  }

  var cols = [
    { label: "原子总数", val: atoms.length.toString() },
    { label: "当前分子", val: mol.title.split(" ")[0] },
    { label: "化学键数", val: mol.bonds.length.toString() },
    { label: "元素种类", val: (function(){
        var s = {};
        atoms.forEach(function(a){ s[a.el]=1; });
        return Object.keys(s).length.toString();
      })() },
  ];

  cols.forEach(function(c, i){
    var cx2 = W/4 * i + W/8;
    ctx.font = "10px 'Noto Sans SC',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "__THEME_HUD_LABEL__";
    ctx.fillText(c.label, cx2, by + 17);

    ctx.font = "bold 14px 'Noto Sans SC',sans-serif";
    ctx.fillStyle = "__THEME_HUD_VALUE__";
    ctx.fillText(c.val, cx2, by + 38);
  });
}

// ── 主循环 ─────────────────────────────────────────────────────

function loop(now){
  var dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // 组装动画
  if(phase === "assemble"){
    assembleT = Math.min(assembleT + dt * 1.8, 1);
    var t = easeOut(assembleT);
    atoms.forEach(function(a){
      a.x = W/2 + (a._targetX - W/2) * t;
      a.y = (H-60)/2 + (a._targetY - (H-60)/2) * t;
    });
    if(assembleT >= 1){ phase = "explore"; }
  }

  var mol = MOLECULES[currentMolIdx];

  drawBackground();
  drawTitle(mol);

  // 绘制键（先画，在原子下面）
  mol.bonds.forEach(function(b){
    var a1 = atoms[b.a], a2 = atoms[b.b];
    var hl = (hoveredIdx === b.a || hoveredIdx === b.b);
    drawBond(a1.x, a1.y, a2.x, a2.y, b.type, hl);
  });

  // 绘制原子
  atoms.forEach(function(a, i){
    drawAtom(a, i === hoveredIdx);
  });

  drawHUD();

  requestAnimationFrame(loop);
}

// 初始化
loadMolecule(0);
requestAnimationFrame(function(now){ lastTime = now; loop(now); });

})();
</script>
</body>
</html>"""


# ── Idea 自我辩论系统 ─────────────────────────────────────────────
#
# 辩论框架与 _gen_protein_structure.py 完全一致。
# 辩论阈值：均值 >= 6.0 通过。
# 原则：质疑要犀利，不轻易通过，部分 idea 应被淘汰。

def _debate_idea(
    idea_id: str,
    mode: str,
    topic: str,
    objections: list[str],
    rebuttals: list[str],
    scores: dict[str, int],
) -> bool:
    """
    执行 idea 辩论并打印结果。返回 True 表示通过，False 表示不通过（跳过）。
    scores: teaching_fit / feasibility / cognitive / completion，各1-10分。
    """
    total = sum(scores.values())
    avg = total / len(scores)
    passed = avg >= 6.0

    console.print(f"\n[bold]-- Idea 辩论：[cyan]{mode}[/cyan] · {topic[:50]}[/bold]")
    for i, (obj, reb) in enumerate(zip(objections, rebuttals), 1):
        console.print(f"  [red]质疑{i}[/red]: {obj}")
        console.print(f"  [green]反驳{i}[/green]: {reb}")
    score_str = " | ".join(f"{k}={v}" for k, v in scores.items())
    result = "[bold green]通过[/bold green]" if passed else "[bold red]不通过（已跳过）[/bold red]"
    console.print(f"  得分 ({score_str}) 均值={avg:.1f} → {result}")
    return passed


# ── 对所有候选 idea 进行辩论 ──────────────────────────────────────
# 候选共5个，目标通过3个左右，exercise永远通过

_IDEA_DEBATES = {

    # ── 候选1：原子球棍模型动画（含交互）──────────────────────────
    "anim_atom_model": _debate_idea(
        idea_id="anim_atom_model",
        mode="animation",
        topic="原子球棍模型——展示H₂O/NH₃/甘氨酸，hover+拖拽交互",
        objections=[
            "Canvas拖拽原子但化学键还在的设计会产生错误认知：化学键不是橡皮筋，"
            "拉伸不代表任何化学意义，孩子可能以为键可以任意拉长",
            "CPK颜色是记忆性知识点，动画展示原子球完全不帮助记忆颜色，"
            "反而是参考卡片或静态图表更有效",
            "三个分子切换（水/氨/甘氨酸）增加了认知碎片化——孩子刚看完水分子就要切到甘氨酸，"
            "连贯性不足，每个分子都浅尝辄止",
        ],
        rebuttals=[
            "拖拽的教学价值不在于模拟真实键伸缩，而在于让孩子感受'原子是独立的球，"
            "键是它们之间的连线'这个核心直觉；hover信息卡的元素名称+描述才是主要信息通道，"
            "拖拽只是吸引注意力的手段——适当的简化模型是教学常规做法",
            "颜色记忆需要视觉+语义双编码：动画中球的颜色配合hover显示'O=红色，氧元素'，"
            "视觉印象+文字标签的绑定比纯文字表格记忆效果强；静态图表放在课文里已有，"
            "动画提供的是互动式的颜色-元素关联体验",
            "三分子递进是有设计意图的：水（最熟悉，3个原子）→氨（引入N，4个原子）→甘氨酸（引入C骨架+5种元素）；"
            "每个分子停留时间由学生控制（点击切换），不是被动浏览；递进结构让学习者自己掌握节奏",
        ],
        scores={"teaching_fit": 8, "feasibility": 8, "cognitive": 7, "completion": 8},
    ),

    # ── 候选2：尺度对比动画──────────────────────────────────────
    "anim_scale": _debate_idea(
        idea_id="anim_scale",
        mode="animation",
        topic="尺度对比——从地球到蛋白质再到原子，展示纳米尺度有多小",
        objections=[
            "这类'尺度缩放'动画已经有著名的'Powers of Ten'视频（和多款科普App），"
            "重复制造一个质量必然更差的版本，反而不如直接引用或链接现有资源",
            "Canvas动画做尺度缩放需要处理数量级跨度（10^25从地球到原子），"
            "精确的对数坐标映射和标注文字在600x420画布上会极度拥挤，用户体验差",
            "尺度对比的核心认知收益是'原子很小'，但这个信息在课文的文字类比（苹果-地球-乒乓球）"
            "中已经非常清晰地传递了，动画带来的增量认知价值存疑",
        ],
        rebuttals=[
            "自制的动画可以聚焦在蛋白质课程相关的尺度（细胞→蛋白质→原子），"
            "而不是通用的Powers of Ten范围，更有课程针对性——但这个区别不足以弥补质量差距",
            "对数映射可以简化为5个离散刻度（地球→细胞→蛋白质→原子），"
            "不需要连续缩放，每个刻度停留展示——但5个离散刻度和表格没有本质区别",
            "文字类比已经够清晰了，这一点无法驳斥——动画能增加视觉冲击感，"
            "但'苹果→地球→乒乓球'这个类比已经是最有效的尺度直觉工具，"
            "动画只是重复了课文内容的视觉版本",
        ],
        # 质疑1和3均有效且反驳不足：自制版质量差 + 课文类比已足够
        scores={"teaching_fit": 4, "feasibility": 5, "cognitive": 5, "completion": 4},
    ),

    # ── 候选3：道尔顿历史故事 ─────────────────────────────────────
    "story_dalton": _debate_idea(
        idea_id="story_dalton",
        mode="story",
        topic="道尔顿的实验——历史上人类如何发现原子的存在",
        objections=[
            "历史故事对'如何用原子思维看蛋白质'这个本节核心目标贡献为零，"
            "道尔顿研究的是气体，和蛋白质结构的关联性极弱，学生看完会困惑'为什么在这节课讲道尔顿'",
            "道尔顿的'倍比定律'概念对10岁孩子过于抽象：理解'气体化合总是整数比'需要一定的化学前置知识，"
            "如果孩子不理解，故事就变成了不知所云的历史片段",
            "故事只有4段文字，视觉效果完全依赖读者的想象力，和本节的Canvas动画+游戏相比，"
            "信息密度和吸引力都低一个量级，会成为课程节奏的低谷",
        ],
        rebuttals=[
            "故事的价值不在于'解释蛋白质'，而在于回答本节开篇问题'物质是什么做的'——"
            "道尔顿正是历史上第一个给出有说服力答案的人，这直接对应了本节的知识起点",
            "倍比定律不需要孩子完全理解，故事里用'碳和氧总是1:1或1:2，从不是1.3:1'作为感性说明，"
            "10岁孩子能理解'整数'和'分数'的区别；故事的目的是激发好奇心，不是教倍比定律",
            "故事作为动画和游戏之间的呼吸节点，节奏价值是正的；"
            "4段文字是轻量化的设计，读完不到2分钟，不会占用大量时间",
        ],
        scores={"teaching_fit": 7, "feasibility": 10, "cognitive": 7, "completion": 6},
    ),

    # ── 候选4：元素积木拼装游戏 ─────────────────────────────────────
    "game_lego": _debate_idea(
        idea_id="game_lego",
        mode="game",
        topic="元素积木——拖拽不同颜色原子组装水分子或甘氨酸",
        objections=[
            "拖拽组装游戏需要精确的'吸附'逻辑（原子放到正确位置时snap到位）和错误反馈，"
            "这在Canvas里实现复杂度极高，容易出现'我明明放对了但游戏说错误'的糟糕体验",
            "学生已经在动画里看过这三个分子了，再让他们拖拽组装完全相同的分子"
            "等于重复做同一件事，缺乏新知识增量",
            "拖拽原子需要精细鼠标操作，对移动设备（触屏）不友好；"
            "如果学生用平板或手机访问，游戏几乎不可用，会产生挫败感",
        ],
        rebuttals=[
            "吸附逻辑可以简化：不检测精确坐标，而是检测每个原子槽位'附近半径内'是否放了正确元素，"
            "这样的容错实现简单且体验好——但这个简化方案和动画1的交互设计高度重叠，"
            "两个交互组件合并在动画1里会更紧凑",
            "动画1是被动展示（按原样呈现分子），游戏是主动组装（学生自己选择原子放到槽位）——"
            "主动操作和被动观看激活的认知通道不同；但如果两者学习目标太相似，差异化不够，"
            "这个反驳是不充分的",
            "Canvas事件在触屏上通过touchstart/touchmove也可以处理，动画1里已经用鼠标事件，"
            "再做一套触摸适配是可以的——但这增加了实现复杂度，且动画1已经有了hover+拖拽",
        ],
        # 质疑1（实现复杂）+ 质疑2（与动画1高度重叠）均未被有效反驳，游戏整体价值被动画1覆盖
        scores={"teaching_fit": 5, "feasibility": 4, "cognitive": 6, "completion": 5},
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
        "## 检测你学会了吗？",
        f"[[IDEA:{EXER_ID}]]\n\n## 检测你学会了吗？"
    )

    all_candidates = [
        (
            "anim_atom_model",
            {
                "idea_id": ANIM1_ID,
                "mode": "animation",
                "topic": "原子球棍模型：H₂O / NH₃ / 甘氨酸 · hover查看元素 · 拖拽探索",
                "context_summary": (
                    "Canvas动画展示三个分子的原子组成，CPK颜色球体。"
                    "hover显示元素名称/描述，drag可移动原子感受分子结构。"
                ),
                "generation_backend": "claude_code_direct",
                "style_key": "biotech_life",
                "mode_reason": (
                    "辩论通过：视觉化CPK颜色+元素信息卡是建立颜色记忆最有效的方式；"
                    "hover+拖拽让孩子对'原子是独立球形颗粒，键是连线'产生直觉感受"
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
        "内容：完整课程文本 + Canvas互动动画 + 历史故事 + 5道练习题",
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
        console.print(f"  Canvas 动画：{anim_count} 个（共 {total_html} 字节 HTML）")
        console.print(f"  故事段落：{story_count} 段")
        console.print(f"  练习题：{exer_count} 道")
        console.print(f"\n访问：[dim]http://localhost:3000/projects/{PROJECT_NAME}[/dim]")
        console.print(f"（进入项目，找到节点 knode_id={TARGET_KNODE_ID}）")
    finally:
        db2.close()


if __name__ == "__main__":
    write_everything()
