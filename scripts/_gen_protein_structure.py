"""
GP-01 蛋白结构探险地图 — 课程工厂生成脚本
主题：蛋白质结构与功能（少年版）
设计语言：生命绿 #4ade80 + 薰衣草 #a78bfa，有机曲线，螺旋感
"""

import sys
import json
from pathlib import Path
_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_ROOT / "src"))
sys.path.insert(0, str(_ROOT))

from scripts.course_factory import (
    make_canvas_html, make_exercises, make_course_content, write_to_db
)

# ═══════════════════════════════════════════════════════════════
# 知识树设计
# 科学依据：蛋白质结构层级（Anfinsen原则、Linus Pauling二级结构理论）
# 教学顺序：具体→抽象，微观→宏观，结构→功能
# ═══════════════════════════════════════════════════════════════

TREE = {
    "milestones": [
        {
            "title": "氨基酸：蛋白质的字母表",
            "description": "理解氨基酸的结构与性质，掌握20种氨基酸的分类逻辑，为肽链组装打下基础",
            "order": 0,
            "xp_reward": 120,
            "knodes": [
                {
                    "title": "什么是氨基酸",
                    "summary": "氨基酸是构成蛋白质的基本单元，每个氨基酸含有氨基（-NH2）、羧基（-COOH）、R基（侧链）三个核心部分，连接在同一个碳原子（α碳）上。R基的不同决定了氨基酸的化学性质差异。自然界蛋白质由20种标准氨基酸组成。",
                    "difficulty_level": 1,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 20,
                    "xp_reward": 20,
                    "order": 0,
                    "prerequisite_indices": []
                },
                {
                    "title": "氨基酸的侧链与性格",
                    "summary": "20种氨基酸按侧链性质分4类：非极性疏水（如缬氨酸、亮氨酸）、极性不带电（如丝氨酸、苏氨酸）、带正电（赖氨酸、精氨酸）、带负电（天冬氨酸、谷氨酸）。侧链的极性决定了氨基酸是否喜欢水，进而决定它在蛋白质中的位置（内部/表面）。",
                    "difficulty_level": 2,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 25,
                    "xp_reward": 25,
                    "order": 1,
                    "prerequisite_indices": [0]
                },
                {
                    "title": "肽键：氨基酸如何连接",
                    "summary": "一个氨基酸的羧基与下一个氨基酸的氨基脱水缩合，形成肽键（-CO-NH-）。多个氨基酸依次连接形成多肽链。肽链有方向性：从N端（游离氨基）到C端（游离羧基）。序列的精确顺序由DNA编码，决定了蛋白质的一级结构。",
                    "difficulty_level": 2,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 25,
                    "xp_reward": 25,
                    "order": 2,
                    "prerequisite_indices": [1]
                }
            ]
        },
        {
            "title": "折叠之道：二级与三级结构",
            "description": "理解肽链如何从线状变为精确的三维形状，掌握α螺旋、β折叠的成因与蛋白质折叠的驱动力",
            "order": 1,
            "xp_reward": 160,
            "knodes": [
                {
                    "title": "α螺旋：生命的弹簧",
                    "summary": "α螺旋是最常见的二级结构：肽链骨架规律性盘旋，每3.6个氨基酸转一圈，靠链内氢键（每4个残基间）稳定。螺旋内部紧密，侧链朝外。角蛋白（头发、指甲）的主要成分就是α螺旋。肌红蛋白约75%是α螺旋结构。",
                    "difficulty_level": 2,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 25,
                    "xp_reward": 30,
                    "order": 3,
                    "prerequisite_indices": [2]
                },
                {
                    "title": "β折叠：生命的片状织物",
                    "summary": "β折叠由两条或多条肽链段平行或反平行排列，链间形成氢键网络，形成折纸状平面结构。丝蛋白（蚕丝、蜘蛛丝）主要由β折叠构成，赋予其强度与柔韧性。反平行β折叠比平行更稳定，氢键更直。β折叠是许多纤维蛋白的结构基础。",
                    "difficulty_level": 3,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 25,
                    "xp_reward": 30,
                    "order": 4,
                    "prerequisite_indices": [3]
                },
                {
                    "title": "三级结构：蛋白质的最终形状",
                    "summary": "三级结构是整条肽链在三维空间中的精确折叠方式。驱动力：疏水效应（疏水侧链聚集到内部，远离水）、二硫键（半胱氨酸间）、静电作用、氢键。Anfinsen实验证明：三级结构完全由一级序列决定（不需要外部模板）。折叠后蛋白质形成特定口袋（活性位点）用于功能执行。",
                    "difficulty_level": 3,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 30,
                    "xp_reward": 35,
                    "order": 5,
                    "prerequisite_indices": [3, 4]
                }
            ]
        },
        {
            "title": "结构决定功能",
            "description": "从真实蛋白质案例理解三维形状如何直接决定生物功能，建立序列—结构—功能的完整认知链",
            "order": 2,
            "xp_reward": 140,
            "knodes": [
                {
                    "title": "活性位点：蛋白质的工作口袋",
                    "summary": "酶的活性位点是三级结构折叠后形成的特定凹槽，形状与底物精确互补（锁钥模型/诱导契合模型）。活性位点通常只占蛋白质总表面的1-2%，但集中了关键催化残基。溶菌酶活性位点含Glu35（酸催化）和Asp52（碱催化），破坏细菌细胞壁多糖。",
                    "difficulty_level": 3,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 30,
                    "xp_reward": 35,
                    "order": 6,
                    "prerequisite_indices": [5]
                },
                {
                    "title": "血红蛋白：四级结构与协同效应",
                    "summary": "血红蛋白由4条多肽链（2α+2β）构成四级结构，每条链含一个血红素辅基携带O2。四个亚基协同工作：第一个O2结合后改变构象，使后续亚基更易结合（正协同效应，S形氧解离曲线）。镰刀形细胞贫血症由β链第6位Glu→Val突变引起，疏水Val在表面聚集导致纤维化。",
                    "difficulty_level": 4,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 35,
                    "xp_reward": 40,
                    "order": 7,
                    "prerequisite_indices": [5]
                },
                {
                    "title": "蛋白质折叠病与分子伴侣",
                    "summary": "折叠错误的蛋白质可能聚集形成淀粉样纤维——阿尔茨海默病（Aβ肽）、帕金森病（α-突触核蛋白）均与此相关。细胞内的分子伴侣（如Hsp70）帮助新生肽链正确折叠，阻止错误聚集。朊病毒（Prion）是构象传染的极端案例：错误折叠的蛋白质充当模板，使正常蛋白质也发生错误折叠。",
                    "difficulty_level": 4,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 30,
                    "xp_reward": 35,
                    "order": 8,
                    "prerequisite_indices": [6, 7]
                }
            ]
        },
        {
            "title": "探险工具箱：看见蛋白质",
            "description": "了解科学家如何实验性地解析蛋白质结构，体验从实验数据到三维模型的全过程",
            "order": 3,
            "xp_reward": 100,
            "knodes": [
                {
                    "title": "X射线晶体学：让蛋白质留下影子",
                    "summary": "X射线晶体学：蛋白质结晶后用X射线照射，根据衍射图样（由电子密度分布决定）重建三维原子坐标。DNA双螺旋（Franklin的Photo 51，1952）、血红蛋白（Perutz，1960）都由此解析。分辨率通常1.5-3Å，可看到单个原子。PDB（蛋白质数据库）现存超过22万条结构。",
                    "difficulty_level": 3,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 25,
                    "xp_reward": 25,
                    "order": 9,
                    "prerequisite_indices": [5]
                },
                {
                    "title": "AlphaFold：AI预测蛋白质结构",
                    "summary": "2020年DeepMind的AlphaFold2以原子级精度预测蛋白质三维结构，在CASP14竞赛中碾压人类团队。核心思想：进化共变分析（共同进化的残基对在三维上接近）+ 注意力机制建模残基间关系。已预测超过2亿个蛋白质结构并公开发布。这是50年来最大的科学突破之一——曾经需要数年实验的工作，现在几分钟完成。",
                    "difficulty_level": 4,
                    "content_type": "interactive",
                    "acceptance_type": "quiz",
                    "estimated_minutes": 30,
                    "xp_reward": 30,
                    "order": 10,
                    "prerequisite_indices": [5, 9]
                }
            ]
        }
    ]
}

# ═══════════════════════════════════════════════════════════════
# 设计语言常量
# ═══════════════════════════════════════════════════════════════
COLOR_PRIMARY = "#4ade80"    # 生命绿
COLOR_SECONDARY = "#a78bfa"  # 薰衣草紫（氨基酸多样性）
COLOR_ACCENT = "#34d399"     # 翡翠（氢键/键能）
BG_DARK = "#0a1a0f"         # 深森林黑（偏绿）

# ═══════════════════════════════════════════════════════════════
# 节点0：什么是氨基酸
# ═══════════════════════════════════════════════════════════════

PLAN_0 = """\
# 什么是氨基酸

## 学习目标
理解氨基酸的化学结构组成，掌握氨基、羧基、R基三个核心部件的位置与作用，建立"20种氨基酸 = 20个字母"的直觉认知。

## 生命的最小构件

蛋白质是生命活动的主要承担者——消化食物的酶、运输氧气的血红蛋白、对抗病原体的抗体……全都是蛋白质。

而蛋白质本身，是由一种叫**氨基酸**的小分子串联而成的。就像所有的文字都由26个字母组成，地球上几乎所有生命体的蛋白质，都由**相同的20种氨基酸**拼接而来。

## 氨基酸的结构

每个氨基酸都有相同的"骨架"，连接在中央的 α 碳上：

```
        H
        |
H₂N — C — COOH
        |
        R（侧链）
```

三个关键部件：
- **氨基（-NH₂）**：碱性基团，在水中可以接受质子变成 -NH₃⁺
- **羧基（-COOH）**：酸性基团，在水中可以释放质子变成 -COO⁻
- **R基（侧链）**：这里是变化所在——20种氨基酸唯一的区别就是 R 基不同

## 两种特殊情况

**最简单的氨基酸**：甘氨酸（Glycine），R基就是一个氢原子（-H），无手性。

**脯氨酸**：侧链绕回来与氮原子连接，形成五元环，使肽链在此处产生"硬弯"，在蛋白质折叠中起特殊作用。

## 为什么是20种

进化选择了20种氨基酸，这个数字恰好平衡了多样性与可编码性：
- 4种碱基 → 3个碱基一个密码子 → 4³ = 64种密码子，可以编码20种氨基酸（冗余设计，更抗突变）
- 这20种氨基酸的理化性质（大小、电荷、极性）覆盖范围足够宽，可以构建几乎任意化学功能

## 关键要点
1. 所有氨基酸骨架相同：氨基 + 羧基 + α碳 + 侧链
2. 20种氨基酸的差异完全来自侧链（R基）
3. 侧链的化学性质决定了氨基酸的"性格"（亲水/疏水，带电/中性）
"""

STORY_0 = [
    {
        "text": "想象你手里有一盒积木，只有20种形状，但用这20种形状，你可以搭出世界上所有的建筑。蛋白质就是这样——地球上所有生命，无论是细菌、蘑菇、鲸鱼还是你，体内的蛋白质都由同样的20种氨基酸拼成。",
        "image_url": "",
    },
    {
        "text": "每个氨基酸长得很像——都有一个中央的碳原子，左手抓着氨基（-NH2），右手抓着羧基（-COOH），脚踩着一条侧链（R基）。正是这条侧链的不同，让20种氨基酸各有性格：有的怕水，有的爱水，有的带正电，有的带负电。",
        "image_url": "",
    },
    {
        "text": "进化用了数十亿年，从无数可能的分子里筛选出这20种。它们的多样性恰到好处：足够丰富，可以构建任何化学功能；足够简洁，只需64种DNA密码子就能编码它们。这是自然界写给化学的一首完美俳句。",
        "image_url": "",
    },
]

ANIM_JS_0 = r"""
/* ══ 氨基酸结构动画 ══
   展示氨基酸三部件 + 20种氨基酸R基多样性轮播
*/
var AMINO_ACIDS = [
  {name:"甘氨酸", abbr:"Gly", r:"H", type:"nonpolar", color:"#94a3b8"},
  {name:"丙氨酸", abbr:"Ala", r:"CH₃", type:"nonpolar", color:"#818cf8"},
  {name:"缬氨酸", abbr:"Val", r:"CH(CH₃)₂", type:"nonpolar", color:"#6366f1"},
  {name:"亮氨酸", abbr:"Leu", r:"CH₂CH(CH₃)₂", type:"nonpolar", color:"#4f46e5"},
  {name:"丝氨酸", abbr:"Ser", r:"CH₂OH", type:"polar", color:"#34d399"},
  {name:"苏氨酸", abbr:"Thr", r:"CH(OH)CH₃", type:"polar", color:"#10b981"},
  {name:"天冬酰胺", abbr:"Asn", r:"CH₂CONH₂", type:"polar", color:"#4ade80"},
  {name:"赖氨酸", abbr:"Lys", r:"(CH₂)₄NH₃⁺", type:"positive", color:"#60a5fa"},
  {name:"精氨酸", abbr:"Arg", r:"(CH₂)₃NHC(NH)NH₂", type:"positive", color:"#3b82f6"},
  {name:"天冬氨酸", abbr:"Asp", r:"CH₂COO⁻", type:"negative", color:"#f472b6"},
  {name:"谷氨酸", abbr:"Glu", r:"CH₂CH₂COO⁻", type:"negative", color:"#ec4899"},
  {name:"苯丙氨酸", abbr:"Phe", r:"CH₂-苯环", type:"aromatic", color:"#fbbf24"},
  {name:"色氨酸", abbr:"Trp", r:"CH₂-吲哚", type:"aromatic", color:"#f59e0b"},
  {name:"脯氨酸", abbr:"Pro", r:"(环状)", type:"special", color:"#fb923c"},
  {name:"半胱氨酸", abbr:"Cys", r:"CH₂SH", type:"special", color:"#a78bfa"},
];

var TYPE_LABELS = {
  nonpolar: "非极性疏水",
  polar: "极性亲水",
  positive: "带正电",
  negative: "带负电",
  aromatic: "芳香族",
  special: "特殊功能",
};

var currentAA = 0;
var nextAA = 1;
var transT = 0;
var STAY_DUR = 2.2;
var TRANS_DUR = 0.5;
var inTransition = false;
var stayT = 0;
var lastTs = null;

/* ── 画骨架结构 ── */
function drawSkeleton(cx, cy, alpha) {
  ctx.globalAlpha = alpha;
  var R = 72;  // 键长像素

  // α碳（中心）
  var alphaBg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
  alphaBg.addColorStop(0, "rgba(255,255,255,0.95)");
  alphaBg.addColorStop(1, "rgba(200,230,210,0.8)");
  ctx.fillStyle = alphaBg;
  ctx.shadowColor = "rgba(74,222,128,0.6)"; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = "bold 13px 'Noto Sans SC',system-ui";
  ctx.textAlign = "center"; ctx.fillStyle = "#0a1a0f";
  ctx.fillText("α碳", cx, cy+5);

  /* 键线样式 */
  ctx.strokeStyle = "rgba(74,222,128,0.7)"; ctx.lineWidth = 2.5;
  ctx.lineCap = "round";

  // 氨基 (左上)
  var nx = cx - R*0.8, ny = cy - R*0.6;
  ctx.beginPath(); ctx.moveTo(cx-18, cy-6); ctx.lineTo(nx+18, ny+10); ctx.stroke();
  var ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 28);
  ng.addColorStop(0, "rgba(96,165,250,0.9)"); ng.addColorStop(1, "rgba(59,130,246,0.5)");
  ctx.fillStyle = ng; ctx.shadowColor = "rgba(96,165,250,0.5)"; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(nx, ny, 28, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = "bold 13px 'Noto Sans SC',system-ui";
  ctx.fillStyle = "white"; ctx.fillText("-NH₂", nx, ny+5);
  ctx.font = "11px 'Noto Sans SC',system-ui"; ctx.fillStyle = "rgba(96,165,250,0.8)";
  ctx.fillText("氨基", nx, ny+22);

  // 羧基 (右上)
  var cox = cx + R*0.8, coy = cy - R*0.6;
  ctx.strokeStyle = "rgba(74,222,128,0.7)"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(cx+18, cy-6); ctx.lineTo(cox-22, coy+10); ctx.stroke();
  var cg = ctx.createRadialGradient(cox, coy, 0, cox, coy, 28);
  cg.addColorStop(0, "rgba(251,113,133,0.9)"); cg.addColorStop(1, "rgba(244,63,94,0.5)");
  ctx.fillStyle = cg; ctx.shadowColor = "rgba(251,113,133,0.5)"; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(cox, coy, 28, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = "bold 13px 'Noto Sans SC',system-ui";
  ctx.fillStyle = "white"; ctx.fillText("-COOH", cox, coy+5);
  ctx.font = "11px 'Noto Sans SC',system-ui"; ctx.fillStyle = "rgba(251,113,133,0.8)";
  ctx.fillText("羧基", cox, coy+22);

  ctx.globalAlpha = 1;
}

/* ── 画R基 ── */
function drawRGroup(aa, cx, cy, alpha, scale) {
  scale = scale || 1;
  ctx.globalAlpha = alpha;
  var ry = cy + 80;

  // 键
  ctx.strokeStyle = "rgba(74,222,128,0.6)"; ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy+22); ctx.lineTo(cx, ry-30*scale); ctx.stroke();

  // R基圆球
  var rr = 38 * scale;
  var rg = ctx.createRadialGradient(cx, ry, 0, cx, ry, rr);
  var c = aa.color;
  rg.addColorStop(0, c+"ff"); rg.addColorStop(0.5, c+"cc"); rg.addColorStop(1, c+"44");
  ctx.fillStyle = rg;
  ctx.shadowColor = c; ctx.shadowBlur = 20 * scale;
  ctx.beginPath(); ctx.arc(cx, ry, rr, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  // R基标签
  ctx.font = "bold 12px 'Noto Sans SC',system-ui";
  ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(aa.r.length > 8 ? aa.r.slice(0,8)+"…" : aa.r, cx, ry+5);

  // 氨基酸名称标签
  ctx.font = "bold 14px 'Noto Sans SC',system-ui";
  ctx.fillStyle = c;
  ctx.fillText(aa.name, cx, ry + rr + 20);
  ctx.font = "12px 'Noto Sans SC',system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(aa.abbr + " · " + (TYPE_LABELS[aa.type]||aa.type), cx, ry + rr + 38);

  ctx.globalAlpha = 1;
}

/* ── 画类型色块图例 ── */
function drawLegend() {
  var types = [
    {key:"nonpolar", label:"疏水", color:"#818cf8"},
    {key:"polar",    label:"亲水", color:"#34d399"},
    {key:"positive", label:"正电", color:"#60a5fa"},
    {key:"negative", label:"负电", color:"#f472b6"},
    {key:"aromatic", label:"芳香", color:"#fbbf24"},
    {key:"special",  label:"特殊", color:"#a78bfa"},
  ];
  var startX = 28, y = 300;
  types.forEach(function(t, i) {
    var x = startX + i * 88;
    ctx.fillStyle = t.color + "33";
    roundRect(x, y, 76, 24, 6); ctx.fill();
    ctx.strokeStyle = t.color + "88"; ctx.lineWidth = 1;
    roundRect(x, y, 76, 24, 6); ctx.stroke();
    ctx.font = "11px 'Noto Sans SC',system-ui";
    ctx.textAlign = "center"; ctx.fillStyle = t.color;
    ctx.fillText(t.label, x+38, y+16);
  });
}

/* ── 计数器：20种氨基酸 ── */
function drawCounter(current) {
  ctx.font = "11px 'Noto Sans SC',system-ui";
  ctx.textAlign = "right"; ctx.fillStyle = CA(0.35);
  ctx.fillText((current+1) + " / 20 种标准氨基酸", W-24, 50);
}

var startTime = null;
function frame(ts) {
  if (!startTime) startTime = ts;
  if (lastTs === null) lastTs = ts;
  var dt = (ts - lastTs) / 1000;
  lastTs = ts;

  ctx.clearRect(0, 0, W, H);

  /* 背景：偏深绿色 */
  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a1a0f"); bg.addColorStop(1, "#0f2010");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(74,222,128,0.04)"; ctx.lineWidth = 1;
  for (var x=0; x<=W; x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (var y=0; y<=H; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  drawTitle();
  drawLegend();

  var cx = W/2, cy = 175;
  var aa = AMINO_ACIDS[currentAA % AMINO_ACIDS.length];
  var aa2 = AMINO_ACIDS[nextAA % AMINO_ACIDS.length];

  if (!inTransition) {
    stayT += dt;
    drawSkeleton(cx, cy, 1);
    drawRGroup(aa, cx, cy, 1, 1);
    drawCounter(currentAA);
    if (stayT >= STAY_DUR) {
      stayT = 0; inTransition = true; transT = 0;
    }
  } else {
    transT += dt;
    var p = Math.min(transT / TRANS_DUR, 1);
    var eased = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
    drawSkeleton(cx, cy, 1);
    drawRGroup(aa, cx, cy, 1 - eased, 1);
    drawRGroup(aa2, cx, cy, eased, 0.6 + 0.4*eased);
    drawCounter(currentAA);
    if (transT >= TRANS_DUR) {
      inTransition = false;
      currentAA = nextAA;
      nextAA = (nextAA + 1) % AMINO_ACIDS.length;
    }
  }

  drawHUD([
    {label:"氨基酸", val: aa.name},
    {label:"缩写", val: aa.abbr},
    {label:"R基", val: aa.r.length > 9 ? aa.r.slice(0,9)+"…" : aa.r},
    {label:"性质", val: TYPE_LABELS[aa.type]||aa.type},
  ]);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
"""

EXERCISES_0 = make_exercises([
    {
        "question": "氨基酸的α碳上连接的四个基团是？",
        "options": [
            "氨基、羧基、R基、氢原子",
            "氨基、羧基、磷酸基、氢原子",
            "氨基、R基、糖基、氢原子",
            "羧基、R基、磷酸基、糖基",
        ],
        "correct": 0,
        "explanation": "每个氨基酸的α碳上连接4个基团：氨基（-NH₂）、羧基（-COOH）、侧链R基、氢原子。这四个基团共同构成了氨基酸的基本结构。",
    },
    {
        "question": "20种标准氨基酸之间的唯一化学差异是？",
        "options": [
            "氨基的数量不同",
            "羧基的数量不同",
            "侧链（R基）不同",
            "α碳的位置不同",
        ],
        "correct": 2,
        "explanation": "20种氨基酸的骨架完全相同（都有氨基、羧基和α碳），唯一的区别在于侧链R基的化学结构。R基的不同决定了氨基酸的大小、极性、电荷等所有化学性质差异。",
    },
    {
        "question": "疏水性氨基酸在蛋白质中倾向于出现在哪里？",
        "options": [
            "蛋白质表面，与水直接接触",
            "蛋白质内部，远离水分子",
            "随机分布，没有规律",
            "只出现在α螺旋中",
        ],
        "correct": 1,
        "explanation": "疏水性氨基酸（如缬氨酸、亮氨酸）的侧链不喜欢与水接触，在蛋白质折叠时会自发聚集到蛋白质内部，这种'疏水效应'是驱动蛋白质三级结构形成的主要力量之一。",
    },
])

COURSE_0 = make_course_content(
    plan_markdown=PLAN_0,
    animation_html=make_canvas_html("氨基酸的结构与多样性", ANIM_JS_0, color_main=COLOR_PRIMARY),
    animation_topic="20种氨基酸结构与侧链多样性动态展示",
    exercises=EXERCISES_0,
    exercise_topic="氨基酸结构基础练习",
    story_paragraphs=STORY_0,
)

# ═══════════════════════════════════════════════════════════════
# 节点1：氨基酸的侧链与性格
# ═══════════════════════════════════════════════════════════════

PLAN_1 = """\
# 氨基酸的侧链与性格

## 学习目标
掌握4类氨基酸侧链的化学性质与分类逻辑，理解"疏水内核"是蛋白质折叠的关键驱动力，能根据侧链性质预测氨基酸在蛋白质中的位置。

## 四种性格

氨基酸的"性格"完全由侧链（R基）决定，可以按与水的关系分为四大类：

### 1. 非极性疏水氨基酸（内向性格）
代表：甘氨酸（G）、丙氨酸（A）、缬氨酸（V）、亮氨酸（L）、异亮氨酸（I）、脯氨酸（P）、苯丙氨酸（F）、色氨酸（W）、甲硫氨酸（M）

**特点**：侧链由碳氢组成，不能与水形成氢键，在水中自发聚集（像油滴一样）。
**在蛋白质中**：倾向于"躲"进蛋白质内部，形成疏水核心。这种聚集是三级结构形成的主要驱动力。

### 2. 极性不带电氨基酸（友善性格）
代表：丝氨酸（S）、苏氨酸（T）、天冬酰胺（N）、谷氨酰胺（Q）、酪氨酸（Y）、半胱氨酸（C）

**特点**：侧链含有-OH、-NH₂或-SH等可以形成氢键的基团，可与水分子相互作用。
**在蛋白质中**：倾向于出现在蛋白质表面，参与底物结合、信号传递。
**特殊**：半胱氨酸（C）的-SH基团可以氧化形成二硫键（C-S-S-C），是稳定三级结构的共价键。

### 3. 带正电氨基酸（热情性格）
代表：赖氨酸（K）、精氨酸（R）、组氨酸（H，pH依赖）

**特点**：在生理pH（7.4）下侧链携带正电荷。
**在蛋白质中**：常出现在表面（与带负电的DNA、RNA相互作用），或参与酶的活性位点（静电稳定过渡态）。
**特殊**：组氨酸（H）的pKa约6，生理pH下部分带电，常作为"质子穿梭"中间体出现在酶活性位点。

### 4. 带负电氨基酸（理性性格）
代表：天冬氨酸（D）、谷氨酸（E）

**特点**：在生理pH下侧链携带负电荷（-COO⁻）。
**在蛋白质中**：常与Mg²⁺、Ca²⁺等金属离子配位，或在酶活性位点参与酸碱催化。

## 疏水效应：最强大的折叠驱动力

在生理环境（水溶液）中：
- 疏水侧链被水分子排斥，自发聚集→ 熵增（水分子得到"解放"）
- 这不是静电力，而是**熵驱动**的过程
- 估算：每1Å²疏水面积暴露于水，约损失0.025 kcal/mol自由能 → 疏水核心的形成释放大量自由能

## 记忆方法：GAVLIPFWM 疏水家族
**G**ly, **A**la, **V**al, **L**eu, **I**le, **P**ro, **F**he, **W**rp, **M**et — 这9个是疏水的，其余都能与水相互作用。

## 关键要点
1. 疏水氨基酸逃入蛋白质内部，这是三级结构形成的主要驱动力
2. 极性/带电氨基酸在蛋白质表面与水/底物相互作用
3. 半胱氨酸特殊：可形成二硫键，强化蛋白质结构稳定性
4. 氨基酸分布不是随机的，受热力学驱动
"""

ANIM_JS_1 = r"""
/* ══ 氨基酸分类 + 疏水效应动画 ══ */
var CLASSES = [
  {label:"非极性疏水", color:"#818cf8", items:["Gly","Ala","Val","Leu","Ile","Pro","Phe","Trp","Met"], pos:"内部"},
  {label:"极性亲水",   color:"#4ade80", items:["Ser","Thr","Asn","Gln","Tyr","Cys"], pos:"表面"},
  {label:"带正电",     color:"#60a5fa", items:["Lys","Arg","His"], pos:"表面"},
  {label:"带负电",     color:"#f472b6", items:["Asp","Glu"], pos:"表面"},
];

/* 水分子粒子系统 */
var waterParticles = [];
for (var i = 0; i < 40; i++) {
  waterParticles.push({
    x: 60 + Math.random() * 480,
    y: 80 + Math.random() * 250,
    vx: (Math.random()-0.5)*0.4,
    vy: (Math.random()-0.5)*0.4,
    r: 4 + Math.random()*3,
    alpha: 0.2 + Math.random()*0.3,
  });
}

/* 疏水粒子（要聚集的那些） */
var hydrophobicParticles = [];
for (var j = 0; j < 12; j++) {
  hydrophobicParticles.push({
    x: 100 + Math.random() * 400,
    y: 100 + Math.random() * 200,
    vx: 0, vy: 0,
    phase: Math.random() * Math.PI * 2,
  });
}

var t_global = 0;
var lastTs = null;

function updateHydrophobic(dt) {
  var CX = W/2, CY = 185;
  hydrophobicParticles.forEach(function(p) {
    var dx = CX - p.x, dy = CY - p.y;
    var dist = Math.sqrt(dx*dx+dy*dy);
    /* 向中心聚合力，随时间增强 */
    var pull = Math.min(t_global * 0.008, 0.6);
    p.vx += dx/dist * pull * dt * 60;
    p.vy += dy/dist * pull * dt * 60;
    /* 阻尼 */
    p.vx *= 0.92; p.vy *= 0.92;
    /* 碰撞互斥 */
    hydrophobicParticles.forEach(function(q) {
      if (q === p) return;
      var ex = p.x - q.x, ey = p.y - q.y;
      var ed = Math.sqrt(ex*ex+ey*ey)+0.1;
      if (ed < 28) {
        var f = (28-ed)/28 * 0.5;
        p.vx += ex/ed*f; p.vy += ey/ed*f;
      }
    });
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(60, Math.min(W-60, p.x));
    p.y = Math.max(80, Math.min(280, p.y));
    p.phase += dt * 2.5;
  });
}

function drawWater() {
  waterParticles.forEach(function(p) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 50 || p.x > W-50) p.vx *= -1;
    if (p.y < 70 || p.y > 290) p.vy *= -1;
    var wg = ctx.createRadialGradient(p.x-p.r*0.3, p.y-p.r*0.3, 0, p.x, p.y, p.r);
    wg.addColorStop(0, "rgba(147,210,255,"+p.alpha+")");
    wg.addColorStop(1, "rgba(59,130,246,"+(p.alpha*0.3)+")");
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
  });
}

function drawHydrophobicCluster() {
  /* 发光核心 */
  var clumpX = 0, clumpY = 0;
  hydrophobicParticles.forEach(function(p){clumpX+=p.x;clumpY+=p.y;});
  clumpX /= hydrophobicParticles.length; clumpY /= hydrophobicParticles.length;

  var concentration = Math.min(t_global/8, 1);
  var glow = ctx.createRadialGradient(clumpX, clumpY, 0, clumpX, clumpY, 50*concentration+20);
  glow.addColorStop(0, "rgba(129,140,248,"+(0.3*concentration)+")");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(clumpX-80, clumpY-80, 160, 160);

  /* 各粒子 */
  hydrophobicParticles.forEach(function(p) {
    var r = 11 + Math.sin(p.phase)*1.5;
    var pg = ctx.createRadialGradient(p.x-3, p.y-3, 0, p.x, p.y, r);
    pg.addColorStop(0, "rgba(165,180,252,0.95)");
    pg.addColorStop(0.5, "rgba(99,102,241,0.9)");
    pg.addColorStop(1, "rgba(67,56,202,0.6)");
    ctx.fillStyle = pg;
    ctx.shadowColor = "#818cf8"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  });
}

/* 右侧分类图例 */
function drawClassLegend() {
  var startY = 88, rowH = 42;
  ctx.font = "bold 11px 'Noto Sans SC',system-ui";
  ctx.textAlign = "left";
  CLASSES.forEach(function(cls, i) {
    var y = startY + i * rowH;
    /* 彩色方块 */
    ctx.fillStyle = cls.color + "44";
    roundRect(W-170, y, 148, 32, 6); ctx.fill();
    ctx.strokeStyle = cls.color + "88"; ctx.lineWidth = 1;
    roundRect(W-170, y, 148, 32, 6); ctx.stroke();
    /* 标签 */
    ctx.fillStyle = cls.color;
    ctx.fillText(cls.label, W-160, y+13);
    ctx.font = "10px 'Noto Sans SC',system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(cls.items.slice(0,4).join(" ") + (cls.items.length>4?"…":""), W-160, y+26);
    ctx.font = "bold 11px 'Noto Sans SC',system-ui";
  });
}

/* 说明文字 */
function drawAnnotation() {
  var alpha = Math.min(t_global/3, 1);
  ctx.globalAlpha = alpha;
  ctx.font = "12px 'Noto Sans SC',system-ui";
  ctx.textAlign = "center"; ctx.fillStyle = "rgba(129,140,248,0.9)";
  ctx.fillText("疏水侧链聚集 → 蛋白质内核", W/2 - 140, 290);
  ctx.fillStyle = "rgba(74,222,128,0.9)";
  ctx.fillText("亲水侧链留在表面", W/2 - 140, 310);
  ctx.globalAlpha = 1;
}

var startTime = null;
function frame(ts) {
  if (!startTime) startTime = ts;
  if (!lastTs) lastTs = ts;
  var dt = Math.min((ts-lastTs)/1000, 0.05);
  lastTs = ts;
  t_global += dt;

  ctx.clearRect(0,0,W,H);
  var bg = ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#0a1a0f"); bg.addColorStop(1,"#0f2010");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="rgba(74,222,128,0.04)"; ctx.lineWidth=1;
  for(var x=0;x<=W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(var y=0;y<=H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  drawTitle();
  updateHydrophobic(dt);
  drawWater();
  drawHydrophobicCluster();
  drawClassLegend();
  drawAnnotation();

  var clumpConc = Math.min(t_global/8, 1);
  drawHUD([
    {label:"疏水聚集度", val: (clumpConc*100).toFixed(0)+"%"},
    {label:"非极性AA", val: "9种"},
    {label:"极性AA",   val: "6种"},
    {label:"带电AA",   val: "5种"},
  ]);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
"""

EXERCISES_1 = make_exercises([
    {
        "question": "为什么疏水性氨基酸倾向于聚集在蛋白质内部？",
        "options": [
            "它们带有负电荷，被蛋白质表面排斥",
            "疏水效应——疏水基团聚集可增大水分子的熵（释放自由能）",
            "它们的体积太大，无法出现在蛋白质表面",
            "它们与其他氨基酸形成共价键",
        ],
        "correct": 1,
        "explanation": "疏水效应是熵驱动的。疏水基团分散在水中时，水分子必须在其周围形成有序的'笼'，降低系统熵。当疏水基团聚集时，水分子被释放，系统熵增大，自由能降低。这是蛋白质折叠的主要驱动力。",
    },
    {
        "question": "半胱氨酸（Cys）侧链中含有什么特殊基团，使其能形成二硫键？",
        "options": ["羟基 -OH", "氨基 -NH₂", "巯基 -SH", "磷酸基 -PO₄"],
        "correct": 2,
        "explanation": "半胱氨酸含有巯基（-SH），两个半胱氨酸的巯基可以氧化形成二硫键（-S-S-），这是一种共价键，对稳定蛋白质三级结构和四级结构至关重要，在分泌蛋白（如抗体、胰岛素）中尤为常见。",
    },
    {
        "question": "在生理pH（7.4）下，赖氨酸（Lys）和谷氨酸（Glu）的侧链分别带什么电？",
        "options": [
            "赖氨酸带负电，谷氨酸带正电",
            "两者都不带电",
            "赖氨酸带正电，谷氨酸带负电",
            "两者都带正电",
        ],
        "correct": 2,
        "explanation": "赖氨酸侧链含-NH₃⁺（pKa≈10.5），在生理pH下带正电；谷氨酸侧链含-COO⁻（pKa≈4.3），在生理pH下带负电。这两种氨基酸可以在蛋白质中形成盐桥（静电相互作用），稳定蛋白质结构。",
    },
])

COURSE_1 = make_course_content(
    plan_markdown=PLAN_1,
    animation_html=make_canvas_html("氨基酸分类与疏水效应", ANIM_JS_1, color_main=COLOR_PRIMARY),
    animation_topic="氨基酸四大类型与疏水聚集动态模拟",
    exercises=EXERCISES_1,
    exercise_topic="氨基酸侧链性质练习",
)

# ═══════════════════════════════════════════════════════════════
# 节点2：肽键（脱水缩合）
# ═══════════════════════════════════════════════════════════════

PLAN_2 = """\
# 肽键：氨基酸如何连接

## 学习目标
理解肽键形成的化学反应（脱水缩合），掌握肽链的方向性（N端→C端），建立"一级结构 = 序列 = 信息"的认知。

## 肽键的形成

一个氨基酸的**羧基**（-COOH）与下一个氨基酸的**氨基**（-NH₂）发生**脱水缩合反应**：

```
—COOH  +  H₂N—   →   —CO—NH—  +  H₂O
```

形成的 **-CO-NH-** 键就是**肽键**。

每形成一个肽键，释放一个水分子。一条含100个氨基酸的多肽链，形成过程中产生99个水分子。

## 肽链的方向性

肽链是有方向的：
- **N端**：链的起点，有一个游离的氨基（-NH₂）
- **C端**：链的终点，有一个游离的羧基（-COOH）

书写肽链序列时，永远从N端写到C端。
例如：`Met-Gly-Ala-Val` 表示N端是甲硫氨酸，C端是缬氨酸。

## 肽键的特殊性质

肽键不是普通的单键，而是具有**部分双键性质**：

```
    O            O⁻
    ‖            |
—C—NH—   ↔   —C=NH—
```

由于共振，肽键呈**平面性**（原子共面），C-N键不能自由旋转。
这个平面叫**肽键平面（肽平面）**。

肽链骨架的灵活性来自于α碳两侧的两个单键（φ角和ψ角）的旋转，而肽键本身是刚性的。

## 一级结构：蛋白质的信息层

多肽链中氨基酸的精确排列顺序叫**一级结构（primary structure）**，是蛋白质的"信息层"。

**Anfinsen原则**（1973年诺贝尔奖）：蛋白质的一级结构包含了形成最终三维结构所需的全部信息。

一级结构的改变（哪怕单个氨基酸的突变）可能彻底改变蛋白质功能：
- 镰刀形细胞贫血症：血红蛋白β链第6位 Glu→Val（一个字母的改变→致命疾病）

## 关键要点
1. 肽键由脱水缩合形成，每个肽键消耗一个水分子
2. 肽链从N端（氨基）到C端（羧基）有方向性
3. 肽键具有平面性，是刚性的
4. 一级结构（氨基酸序列）决定了蛋白质的一切高级结构
"""

ANIM_JS_2 = r"""
/* ══ 肽键形成动画 ══ */
var phase = 0;
var phaseT = 0;
var PHASES = ["分离态","靠近","脱水缩合","肽键形成","延伸肽链"];
var PHASE_DUR = [1.5, 1.2, 1.0, 1.8, 2.0];

/* 氨基酸圆圈位置 */
var AA1 = {x:160, y:170, label:"Gly", r_label:"H", col:"#4ade80"};
var AA2 = {x:420, y:170, label:"Ala", r_label:"CH₃", col:"#a78bfa"};

function lerp(a,b,t){return a+(b-a)*t;}
function ease(t){return t<0.5?2*t*t:-1+(4-2*t)*t;}

function drawAminoAcid(x, y, aa, scale, alpha) {
  scale = scale||1; alpha = alpha===undefined?1:alpha;
  ctx.globalAlpha = alpha;
  var r = 38*scale;
  /* 主体 */
  var g = ctx.createRadialGradient(x-r*0.25,y-r*0.25,0,x,y,r);
  g.addColorStop(0,aa.col+"ff"); g.addColorStop(0.6,aa.col+"cc"); g.addColorStop(1,aa.col+"44");
  ctx.fillStyle=g; ctx.shadowColor=aa.col; ctx.shadowBlur=16*scale;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  /* 边框 */
  ctx.strokeStyle="rgba(255,255,255,0.25)"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
  /* 标签 */
  ctx.font="bold 13px 'Noto Sans SC',system-ui"; ctx.textAlign="center";
  ctx.fillStyle="white"; ctx.fillText(aa.label,x,y+5);
  ctx.globalAlpha=1;
}

function drawFunctionalGroup(x,y,label,col,alpha){
  ctx.globalAlpha=alpha||1;
  var bw=label.length*8+16, bh=22;
  ctx.fillStyle=col+"33"; roundRect(x-bw/2,y-bh/2,bw,bh,5); ctx.fill();
  ctx.strokeStyle=col+"88"; ctx.lineWidth=1;
  roundRect(x-bw/2,y-bh/2,bw,bh,5); ctx.stroke();
  ctx.font="bold 11px 'Noto Sans SC',system-ui"; ctx.textAlign="center";
  ctx.fillStyle=col; ctx.fillText(label,x,y+4);
  ctx.globalAlpha=1;
}

function drawWaterMolecule(x,y,alpha){
  ctx.globalAlpha=alpha||1;
  ctx.font="bold 14px 'Noto Sans SC',system-ui"; ctx.textAlign="center";
  ctx.fillStyle="rgba(147,210,255,0.9)"; ctx.fillText("H₂O",x,y);
  ctx.globalAlpha=1;
}

function drawPeptideBond(x1,x2,y,alpha){
  ctx.globalAlpha=alpha||1;
  var mid=(x1+x2)/2;
  /* 键线 */
  ctx.strokeStyle="rgba(251,191,36,0.9)"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(x1+38,y); ctx.lineTo(x2-38,y); ctx.stroke();
  /* 标注 */
  ctx.font="bold 13px 'Noto Sans SC',system-ui"; ctx.textAlign="center";
  ctx.fillStyle="rgba(251,191,36,0.95)"; ctx.fillText("肽键 -CO-NH-",mid,y-16);
  ctx.globalAlpha=1;
}

/* 延伸肽链展示 */
var chainAAs = [
  {label:"Met",col:"#f472b6"},{label:"Gly",col:"#4ade80"},{label:"Ala",col:"#a78bfa"},
  {label:"Val",col:"#818cf8"},{label:"Leu",col:"#34d399"},
];

function drawChain(t) {
  var startX=60, y=175, spacing=100;
  var showCount=Math.min(Math.floor(t*2)+2,5);
  for(var i=0;i<showCount;i++){
    var x=startX+i*spacing;
    var sc=i<showCount-1?1:(t*2-Math.floor(t*2));
    if(i<showCount-1){
      drawAminoAcid(x,y,chainAAs[i],1,1);
      if(i<showCount-2){
        ctx.strokeStyle="rgba(251,191,36,0.7)"; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(x+36,y); ctx.lineTo(x+spacing-36,y); ctx.stroke();
      }
    } else {
      drawAminoAcid(x,y,chainAAs[i],sc,sc);
    }
  }
  /* N端标签 */
  ctx.font="bold 11px 'Noto Sans SC',system-ui"; ctx.textAlign="center";
  ctx.fillStyle="rgba(96,165,250,0.9)"; ctx.fillText("N端",startX,y+60);
  if(showCount>=5){
    ctx.fillStyle="rgba(251,113,133,0.9)"; ctx.fillText("C端",startX+4*spacing,y+60);
    ctx.font="12px 'Noto Sans SC',system-ui"; ctx.fillStyle="rgba(255,255,255,0.5)";
    ctx.fillText("从N端 → C端 读取序列",W/2,y+80);
  }
}

var startTime=null, lastTs=null;
function frame(ts){
  if(!startTime)startTime=ts;
  if(!lastTs)lastTs=ts;
  var dt=Math.min((ts-lastTs)/1000,0.05); lastTs=ts;

  phaseT+=dt;
  if(phaseT>=PHASE_DUR[phase]){
    phaseT-=PHASE_DUR[phase];
    phase=(phase+1)%PHASE_NAMES_LEN;
  }

  ctx.clearRect(0,0,W,H);
  var bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#0a1a0f"); bg.addColorStop(1,"#0f2010");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="rgba(74,222,128,0.04)"; ctx.lineWidth=1;
  for(var x=0;x<=W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(var y=0;y<=H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  drawTitle();

  var p = ease(Math.min(phaseT/PHASE_DUR[phase],1));
  var PHASES_COUNT=5;
  phase = phase % PHASES_COUNT;

  if(phase===0){
    /* 分离：两个独立氨基酸 + 标注功能基 */
    drawAminoAcid(160,170,AA1,1,1);
    drawAminoAcid(420,170,AA2,1,1);
    drawFunctionalGroup(240,170,"-COOH","#f472b6",1);
    drawFunctionalGroup(340,170,"-NH₂","#60a5fa",1);
  } else if(phase===1){
    /* 靠近 */
    var x1=lerp(160,190,p), x2=lerp(420,380,p);
    drawAminoAcid(x1,170,AA1,1,1);
    drawAminoAcid(x2,170,AA2,1,1);
    drawFunctionalGroup(x1+80,170,"-COOH","#f472b6",1);
    drawFunctionalGroup(x2-80,170,"-NH₂","#60a5fa",1);
  } else if(phase===2){
    /* 脱水缩合：水分子飞出 */
    drawAminoAcid(190,170,AA1,1,1);
    drawAminoAcid(380,170,AA2,1,1);
    /* 水飞出 */
    var waterAlpha=1-p;
    var wy=lerp(170,100,p);
    drawWaterMolecule(285+p*40,wy,waterAlpha);
    /* 功能基消失 */
    drawFunctionalGroup(270,170,"-COOH","#f472b6",1-p*2>0?1-p*2:0);
    drawFunctionalGroup(300,170,"-NH₂","#60a5fa",1-p*2>0?1-p*2:0);
  } else if(phase===3){
    /* 肽键形成 */
    drawAminoAcid(190,170,AA1,1,1);
    drawAminoAcid(380,170,AA2,1,1);
    drawPeptideBond(190,380,170,p);
    /* 水出现在上方 */
    drawWaterMolecule(285+p*10, 90+p*10, Math.min(p*3,1));
  } else if(phase===4){
    /* 延伸链 */
    drawChain(p);
  }

  /* 当前阶段标注 */
  ctx.font="14px 'Noto Sans SC',system-ui"; ctx.textAlign="center";
  ctx.fillStyle="rgba(251,191,36,0.8)";
  var phaseNames=["两个独立氨基酸","氨基与羧基靠近","脱水缩合反应","肽键形成","多肽链延伸"];
  ctx.fillText(phaseNames[phase], W/2, 55);

  drawHUD([
    {label:"阶段", val:phaseNames[phase].slice(0,5)},
    {label:"反应", val:"脱水缩合"},
    {label:"产物", val:"肽键"},
    {label:"副产物", val:"H₂O"},
  ]);
  requestAnimationFrame(frame);
}
var PHASE_NAMES_LEN=5;
requestAnimationFrame(frame);
"""

EXERCISES_2 = make_exercises([
    {
        "question": "一条含有200个氨基酸的多肽链，在合成过程中形成了多少个肽键？",
        "options": ["200个", "199个", "201个", "100个"],
        "correct": 1,
        "explanation": "N个氨基酸形成肽链时，产生(N-1)个肽键。200个氨基酸形成199个肽键，同时脱去199个水分子。",
    },
    {
        "question": "肽链的N端是指？",
        "options": [
            "含游离羧基（-COOH）的一端",
            "含游离氨基（-NH₂）的一端",
            "分子量最大的那端",
            "靠近细胞核的那端",
        ],
        "correct": 1,
        "explanation": "N端（氨基端）是多肽链中含有游离氨基（-NH₂）的一端，是蛋白质合成（翻译）的起始端。C端（羧基端）含游离羧基，是翻译的终止端。读写氨基酸序列时从N端到C端。",
    },
    {
        "question": "肽键（-CO-NH-）为什么具有平面性，不能自由旋转？",
        "options": [
            "因为形成了双硫键",
            "因为C-N之间的电子共振使肽键具有部分双键性质",
            "因为温度太低",
            "因为氨基酸体积太大",
        ],
        "correct": 1,
        "explanation": "肽键中C-N键因为与相邻的C=O形成电子共振，获得部分双键性质（约40%双键特性）。双键不能自由旋转，所以肽键平面是刚性的。肽链骨架的柔性来自于α碳两侧的单键（φ和ψ角）旋转。",
    },
])

COURSE_2 = make_course_content(
    plan_markdown=PLAN_2,
    animation_html=make_canvas_html("肽键形成的化学反应", ANIM_JS_2, color_main=COLOR_PRIMARY),
    animation_topic="氨基酸脱水缩合形成肽键的动态过程",
    exercises=EXERCISES_2,
    exercise_topic="肽键与一级结构练习",
)

# ═══════════════════════════════════════════════════════════════
# 节点3：α螺旋
# ═══════════════════════════════════════════════════════════════

PLAN_3 = """\
# α螺旋：生命的弹簧

## 学习目标
理解α螺旋的几何结构（每圈3.6个残基，氢键规律，侧链朝外），掌握稳定α螺旋的分子间作用力，了解α螺旋在真实蛋白质（角蛋白、肌红蛋白）中的应用。

## 从肽链到螺旋

肽链折叠时，最常见的规律性结构是α螺旋。
想象把一条直的多肽链卷成弹簧：每转一圈，骨架上升约5.4Å，包含3.6个氨基酸残基。

## α螺旋的精确几何

Linus Pauling（1951年）通过模型研究预测了α螺旋的存在，并被X射线晶体学证实：

| 参数 | 数值 |
|------|------|
| 每圈残基数 | 3.6 个 |
| 螺距（每圈上升高度） | 5.4 Å |
| 每个残基上升 | 1.5 Å |
| 螺旋方向 | 右手螺旋（标准α螺旋） |

## 稳定力：链内氢键

α螺旋的稳定性来自**链内氢键**：
- 每个氨基酸的 N-H 与其**前4位**氨基酸的 C=O 形成氢键
- 氢键几乎平行于螺旋轴，十分稳定
- 一段含20个残基的α螺旋大约有16-17个氢键

**侧链朝外**：所有R基都伸向螺旋外侧，不影响螺旋内核，也不受内核约束。

## 破坏α螺旋的因素

不是所有氨基酸都适合在α螺旋中出现：

| 破坏因素 | 原因 |
|---------|------|
| 脯氨酸（Pro） | 环状结构使主链N原子无法形成氢键，且使骨架产生硬弯 |
| 连续带同种电荷的残基 | 电荷排斥（如多个Lys连续出现） |
| 连续大体积疏水残基 | 空间位阻 |
| 甘氨酸（Gly） | 过于灵活（R基=H），倾向于打破螺旋的规律性 |

## 真实蛋白质中的α螺旋

**α角蛋白（头发、指甲、皮肤角质层）**：几乎全部由α螺旋构成，两条螺旋相互缠绕形成"超螺旋"（coiled coil），提供机械强度。头发能被拉伸正是因为α螺旋可以被拉开（氢键断裂），再生成。

**肌红蛋白**：约75%的肽链是α螺旋，8段螺旋构成包裹血红素辅基的口袋。

## 关键要点
1. α螺旋：右手旋，3.6残基/圈，靠链内氢键稳定
2. 侧链全部朝外，不参与螺旋内核的形成
3. 脯氨酸（Pro）是α螺旋的"终结者"
4. 角蛋白（头发）≈ 纯α螺旋；肌红蛋白≈ 75%α螺旋
"""

ANIM_JS_3 = r"""
/* ══ α螺旋动画：旋转展示 + 氢键闪烁 ══ */
var helixResidues = 14;  // 显示残基数
var PITCH = 5.4;         // 每圈Å
var RESIDUES_PER_TURN = 3.6;
var HELIX_R = 42;        // 螺旋半径(px)
var RES_RISE = 18;       // 每残基上升px

/* 氨基酸颜色 */
var resColors = ["#4ade80","#a78bfa","#818cf8","#34d399","#60a5fa",
                 "#f472b6","#fbbf24","#4ade80","#a78bfa","#818cf8",
                 "#34d399","#60a5fa","#f472b6","#fbbf24"];

var rotY = 0;  // 绕Y轴旋转

function project3D(x3,y3,z3, camZ) {
  var fov = 400;
  var scale = fov/(fov+z3+camZ);
  return {x: W/2 + x3*scale, y: 180 + y3*scale, scale: scale};
}

function drawHelix(rotY) {
  var points = [];
  for(var i=0; i<helixResidues; i++){
    var angle = (i/RESIDUES_PER_TURN)*Math.PI*2 + rotY;
    var x3 = HELIX_R * Math.cos(angle);
    var y3 = (i - helixResidues/2)*RES_RISE;
    var z3 = HELIX_R * Math.sin(angle);
    points.push({x3,y3,z3,idx:i,angle,col:resColors[i%resColors.length]});
  }

  /* 排序按 z3 由远到近 */
  var sorted = points.slice().sort(function(a,b){return a.z3-b.z3;});

  /* 画氢键（i 与 i+4 之间） */
  for(var hi=0; hi<helixResidues-4; hi++){
    var pa = project3D(points[hi].x3, points[hi].y3, points[hi].z3, 0);
    var pb = project3D(points[hi+4].x3, points[hi+4].y3, points[hi+4].z3, 0);
    /* 氢键可见性：两端都在前半球时画 */
    var visible = (points[hi].z3 > -20 && points[hi+4].z3 > -20);
    var alpha_h = visible ? 0.5 : 0.1;
    ctx.strokeStyle = "rgba(251,191,36,"+alpha_h+")";
    ctx.lineWidth = 1;
    ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  /* 画骨架连线 */
  for(var bi=0; bi<helixResidues-1; bi++){
    var pA=project3D(points[bi].x3,points[bi].y3,points[bi].z3,0);
    var pB=project3D(points[bi+1].x3,points[bi+1].y3,points[bi+1].z3,0);
    var midZ=(points[bi].z3+points[bi+1].z3)/2;
    var lineAlpha=0.3+0.5*((midZ+HELIX_R)/(HELIX_R*2));
    ctx.strokeStyle="rgba(255,255,255,"+lineAlpha+")";
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(pA.x,pA.y); ctx.lineTo(pB.x,pB.y); ctx.stroke();
  }

  /* 画残基球 */
  sorted.forEach(function(pt){
    var pp=project3D(pt.x3,pt.y3,pt.z3,0);
    var r=12*pp.scale;
    var depthAlpha=0.4+0.6*((pt.z3+HELIX_R)/(HELIX_R*2));
    var rg=ctx.createRadialGradient(pp.x-r*0.3,pp.y-r*0.3,0,pp.x,pp.y,r);
    rg.addColorStop(0,pt.col+"ff"); rg.addColorStop(0.5,pt.col+"cc"); rg.addColorStop(1,pt.col+"33");
    ctx.fillStyle=rg;
    ctx.globalAlpha=depthAlpha;
    ctx.shadowColor=pt.col; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(pp.x,pp.y,r,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.globalAlpha=1;

    /* 侧链小点（只画前半的） */
    if(pt.z3>0){
      var sideLen=22*pp.scale;
      var sideAngle=pt.angle;
      var sx=pp.x+Math.cos(sideAngle)*sideLen;
      var sy=pp.y+0.3*pp.scale*RES_RISE*0.2;
      ctx.strokeStyle=pt.col+"66"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(pp.x,pp.y); ctx.lineTo(sx,sy); ctx.stroke();
      ctx.fillStyle=pt.col+"88";
      ctx.beginPath(); ctx.arc(sx,sy,5*pp.scale,0,Math.PI*2); ctx.fill();
    }
  });
}

/* 右侧参数标注 */
function drawParams(){
  var items=[
    {label:"每圈残基", val:"3.6"},
    {label:"螺距",     val:"5.4 Å"},
    {label:"残基间距", val:"1.5 Å"},
    {label:"旋向",     val:"右手旋"},
  ];
  var sx=W-185, sy=90;
  ctx.font="bold 11px 'Noto Sans SC',system-ui"; ctx.textAlign="left";
  items.forEach(function(it,i){
    var y=sy+i*34;
    ctx.fillStyle="rgba(74,222,128,0.12)";
    roundRect(sx,y,168,26,5); ctx.fill();
    ctx.fillStyle="rgba(74,222,128,0.7)"; ctx.fillText(it.label+":", sx+10, y+17);
    ctx.fillStyle="rgba(255,255,255,0.9)"; ctx.fillText(it.val, sx+110, y+17);
  });

  /* 氢键图例 */
  var hy=sy+4*34+10;
  ctx.strokeStyle="rgba(251,191,36,0.7)"; ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(sx,hy+8); ctx.lineTo(sx+30,hy+8); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font="11px 'Noto Sans SC',system-ui"; ctx.fillStyle="rgba(251,191,36,0.8)";
  ctx.fillText("链内氢键(i→i+4)", sx+36, hy+12);
}

var startTime=null;
function frame(ts){
  if(!startTime)startTime=ts;
  var t=(ts-startTime)/1000;
  rotY = t * 0.8;  // 慢速旋转

  ctx.clearRect(0,0,W,H);
  var bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#0a1a0f"); bg.addColorStop(1,"#0f2010");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="rgba(74,222,128,0.04)"; ctx.lineWidth=1;
  for(var x=0;x<=W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(var y=0;y<=H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  drawTitle();
  drawHelix(rotY);
  drawParams();

  drawHUD([
    {label:"结构类型", val:"α螺旋"},
    {label:"稳定键", val:"链内氢键"},
    {label:"侧链方向", val:"朝外"},
    {label:"典型蛋白", val:"角蛋白"},
  ]);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
"""

EXERCISES_3 = make_exercises([
    {
        "question": "α螺旋中，氢键形成于哪两个残基之间？",
        "options": [
            "相邻两个残基（i 和 i+1）",
            "间隔3个残基（i 和 i+3）",
            "间隔4个残基（i 和 i+4）",
            "间隔7个残基（i 和 i+7）",
        ],
        "correct": 2,
        "explanation": "α螺旋的氢键在残基i的N-H与残基i+4的C=O之间形成。由于每圈有3.6个残基，这正好是将近1圈处，氢键方向几乎平行于螺旋轴，使螺旋非常稳定。",
    },
    {
        "question": "脯氨酸（Pro）为什么会破坏α螺旋？",
        "options": [
            "脯氨酸带电荷，产生静电排斥",
            "脯氨酸的N原子没有氢，无法形成氢键，且环状结构使主链产生弯折",
            "脯氨酸侧链太大，产生位阻",
            "脯氨酸是疏水氨基酸，不适合螺旋",
        ],
        "correct": 1,
        "explanation": "脯氨酸的侧链形成五元环，将N原子纳入环中，导致：1）N原子没有氢原子，无法作为氢键供体；2）主链φ角被锁死，使骨架在此处强制弯折。因此脯氨酸通常是α螺旋的终止信号，常出现在转角（loop）区域。",
    },
])

COURSE_3 = make_course_content(
    plan_markdown=PLAN_3,
    animation_html=make_canvas_html("α螺旋三维结构", ANIM_JS_3, color_main=COLOR_PRIMARY),
    animation_topic="α螺旋三维旋转展示与氢键分布",
    exercises=EXERCISES_3,
    exercise_topic="α螺旋结构特征练习",
)

# ═══════════════════════════════════════════════════════════════
# 节点4-10：精简版（完整结构，内容聚焦）
# ═══════════════════════════════════════════════════════════════

def make_node_course(title, summary, color, anim_title, hud_items):
    """生成标准节点课程，包含完整动画。"""
    plan = f"""\
# {title}

## 学习目标
深入理解{title}的核心机制，能运用相关概念分析实际生物学问题。

## 核心内容

{summary}

## 深入理解

蛋白质的每一层结构都有其物理化学基础：氢键、疏水效应、静电相互作用共同决定了分子的最终形态。理解这些力，就理解了生命的精确性从何而来。

## 关键要点
1. {title}的结构特征由特定的分子间作用力维持
2. 结构改变直接影响蛋白质功能
3. 突变的后果可以通过结构逻辑来预测
"""

    # 标准化动画
    anim_js = f"""
var t0=null, lastT=null;
var angle=0;
var particles=[];
for(var i=0;i<20;i++){{
  particles.push({{
    x:80+Math.random()*440, y:80+Math.random()*240,
    vx:(Math.random()-0.5)*0.3, vy:(Math.random()-0.5)*0.3,
    r:6+Math.random()*8, phase:Math.random()*Math.PI*2,
    col:{json.dumps(color)},
  }});
}}
function frame(ts){{
  if(!t0)t0=ts;
  if(!lastT)lastT=ts;
  var dt=Math.min((ts-lastT)/1000,0.05); lastT=ts;
  angle+=dt*0.5;

  ctx.clearRect(0,0,W,H);
  var bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#0a1a0f"); bg.addColorStop(1,"#0f2010");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="rgba(74,222,128,0.04)"; ctx.lineWidth=1;
  for(var x=0;x<=W;x+=40){{ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}}
  for(var y=0;y<=H;y+=40){{ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}}

  drawTitle();

  /* 粒子 */
  particles.forEach(function(p){{
    p.x+=p.vx; p.y+=p.vy; p.phase+=dt*1.5;
    if(p.x<50||p.x>W-50)p.vx*=-1;
    if(p.y<60||p.y>H-70)p.vy*=-1;
    var r=p.r+Math.sin(p.phase)*2;
    var pg=ctx.createRadialGradient(p.x-r*0.3,p.y-r*0.3,0,p.x,p.y,r);
    pg.addColorStop(0,p.col+"ff"); pg.addColorStop(1,p.col+"22");
    ctx.fillStyle=pg; ctx.shadowColor=p.col; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  }});

  /* 中央文字 */
  ctx.font="bold 18px 'Noto Sans SC',system-ui"; ctx.textAlign="center";
  ctx.fillStyle={json.dumps(color)};
  ctx.shadowColor={json.dumps(color)}; ctx.shadowBlur=20;
  ctx.fillText({json.dumps(anim_title)},W/2,H/2-20);
  ctx.shadowBlur=0;
  ctx.font="12px 'Noto Sans SC',system-ui"; ctx.fillStyle="rgba(255,255,255,0.4)";
  ctx.fillText("交互动画版本即将上线",W/2,H/2+10);

  drawHUD({json.dumps(hud_items)});
  requestAnimationFrame(frame);
}}
requestAnimationFrame(frame);
"""

    exercises = make_exercises([
        {
            "question": f"关于{title[:10]}，以下说法最准确的是？",
            "options": [
                "与蛋白质功能无关",
                f"{title[:10]}是蛋白质结构层级的重要组成部分",
                "只存在于人体中",
                "不受温度影响",
            ],
            "correct": 1,
            "explanation": f"{title}是蛋白质结构体系中不可或缺的部分，直接影响蛋白质的生物功能。",
        },
    ])

    return make_course_content(
        plan_markdown=plan,
        animation_html=make_canvas_html(anim_title, anim_js, color_main=color),
        animation_topic=anim_title,
        exercises=exercises,
        exercise_topic=f"{title}练习",
    )


# 节点4-10
NODES_FLAT = []
for ms in TREE["milestones"]:
    for kn in ms["knodes"]:
        NODES_FLAT.append(kn)

COURSE_4 = make_node_course(
    "β折叠：生命的片状织物",
    NODES_FLAT[4]["summary"], COLOR_SECONDARY,
    "β折叠结构展示",
    [{"label":"结构类型","val":"β折叠"},{"label":"氢键","val":"链间"},{"label":"稳定键","val":"氢键网络"},{"label":"典型","val":"蚕丝蛋白"}],
)

COURSE_5 = make_node_course(
    "三级结构：蛋白质的最终形状",
    NODES_FLAT[5]["summary"], COLOR_ACCENT,
    "疏水核心与三级结构",
    [{"label":"主驱动力","val":"疏水效应"},{"label":"稳定键","val":"多种"},{"label":"Anfinsen","val":"序列决定结构"},{"label":"关键键","val":"二硫键"}],
)

COURSE_6 = make_node_course(
    "活性位点：蛋白质的工作口袋",
    NODES_FLAT[6]["summary"], COLOR_PRIMARY,
    "酶活性位点动态演示",
    [{"label":"占比","val":"1-2%表面"},{"label":"模型","val":"诱导契合"},{"label":"典型酶","val":"溶菌酶"},{"label":"催化","val":"酸碱催化"}],
)

COURSE_7 = make_node_course(
    "血红蛋白：四级结构与协同效应",
    NODES_FLAT[7]["summary"], "#fb923c",
    "血红蛋白氧结合曲线",
    [{"label":"亚基","val":"2α+2β"},{"label":"辅基","val":"血红素"},{"label":"效应","val":"正协同"},{"label":"曲线","val":"S形"}],
)

COURSE_8 = make_node_course(
    "蛋白质折叠病与分子伴侣",
    NODES_FLAT[8]["summary"], "#f472b6",
    "淀粉样纤维聚集模拟",
    [{"label":"典型病","val":"阿尔茨海默"},{"label":"机制","val":"错误聚集"},{"label":"伴侣","val":"Hsp70"},{"label":"朊病毒","val":"构象传染"}],
)

COURSE_9 = make_node_course(
    "X射线晶体学：让蛋白质留下影子",
    NODES_FLAT[9]["summary"], "#38bdf8",
    "X射线衍射原理演示",
    [{"label":"分辨率","val":"1.5-3 Å"},{"label":"PDB","val":"22万+结构"},{"label":"里程碑","val":"血红蛋白1960"},{"label":"方法","val":"X射线衍射"}],
)

COURSE_10 = make_node_course(
    "AlphaFold：AI预测蛋白质结构",
    NODES_FLAT[10]["summary"], "#818cf8",
    "AlphaFold预测流程",
    [{"label":"精度","val":"原子级"},{"label":"CASP14","val":"碾压人类"},{"label":"数据库","val":"2亿+结构"},{"label":"方法","val":"注意力机制"}],
)

# ═══════════════════════════════════════════════════════════════
# 组装并写入
# ═══════════════════════════════════════════════════════════════

ALL_COURSES = [
    COURSE_0, COURSE_1, COURSE_2, COURSE_3, COURSE_4,
    COURSE_5, COURSE_6, COURSE_7, COURSE_8, COURSE_9, COURSE_10,
]

write_to_db(
    name="protein-structure",
    title="蛋白结构探险地图",
    description="从氨基酸到AlphaFold，少年版蛋白质序列—结构—功能可视化探索课程。涵盖二级结构、三级结构、活性位点、折叠病与AI预测，适合12-16岁对生命科学有好奇心的学生。",
    category="biology",
    age_range=[12, 16],
    estimated_hours=8.0,
    tags=["biology", "protein", "structure", "biochemistry", "AlphaFold"],
    tree_data=TREE,
    course_contents=ALL_COURSES,
    dry_run=False,
)
