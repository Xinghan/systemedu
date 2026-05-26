# GENERATION_GUIDE — V5 KnowledgeTree 节点级生成预算字段

> 设计动机: course_factory skill 用同一套流程生成所有节点, 实际输出长度趋同, 把哇时刻 / capstone / 复杂概念跟过渡节点拉到差不多体量, 教学价值不匹配. 解决方案: 在 V5 tree 设计阶段 (P0.5 / P1) 就为每个 module 显式写 `generation_guide`, 后续 course_factory 生成时**必须先读 guide 然后宣布预算**, 让节点之间内容差异由设计决定, 不由生成时疲劳度决定.

---

## Schema (放在每个 `tree.modules[i]` 下, 字段名 `generation_guide`)

```jsonc
{
  "module_id": "M55",
  "title": "第一次用念头让角色动起来",
  "stage_id": "S6",
  // ... 现有 V5 字段 ...

  "generation_guide": {
    // === 总体定位 (决定整体投入) ===
    "importance": 5,                    // 1-5 星: 1=过渡 / 3=核心概念 / 5=哇时刻或 capstone
    "wow_moment": "wow_4",              // null 或 wow_1/wow_2/wow_3/wow_4 (哪个项目级哇时刻)
    "mission_role": "capstone",         // foundation / concept_intro / hands_on / synthesis / capstone
    "narrative_role": "celebration",    // intro / build / climax / celebration / wind_down

    // === 难度维度 (决定 K1/K3 多深) ===
    "theory_depth": "shallow",          // shallow / medium / deep
                                        //   shallow: 已学概念的应用, K3 无需新理论
                                        //   medium: 引入新工具/方法, K3 含 1 个公式或 1 段代码
                                        //   deep: 引入硬数学/算法, K3 必须含公式 + 代码 + 数据表
    "handson_difficulty": "high",       // low / medium / high
                                        //   low: 读/看/讨论 (无代码)
                                        //   medium: 跑现成代码 + 改 1-2 个参数
                                        //   high: 写新代码 / 实采数据 / 调试

    // === 显式字数预算 (硬约束, course_factory 必须遵守 ±20%) ===
    "expected_lengths": {
      "plan_chars": [1500, 2500],       // plan_markdown 字数 [min, max]
      "k1_chars_per_theory": [1200, 2000],  // 每个 K1 body 字数
      "k3_chars_per_theory": [600, 1200],   // 每个 K3 body
      "n_theories": [2, 3],             // 节点应有 theories 数
      "assignment_chars": [800, 1500],
      "n_exercises": [4, 6]             // 总练习题数
    },

    // === 富媒体复杂度 (决定 anim/game 设计风格) ===
    "anim_complexity": "ceremonial",    // simple / standard / rich / ceremonial
                                        //   simple: 1-2 帧静态对比
                                        //   standard: 4 帧概念递进 (默认)
                                        //   rich: 4 帧 + 复杂交互动画 + 多视角
                                        //   ceremonial: 仪式感 (庆祝/总结画面 + 大字 + 视觉高潮)
    "game_complexity": "rich",          // simple / standard / rich
                                        //   simple: 1 个交互按钮 + 1 关
                                        //   standard: 3 关挑战 (默认)
                                        //   rich: 多机制 sandbox + 5+ 关 / 自由探索

    // === 叙事衔接 (跨节点连续性) ===
    "prereq_recap_chars": 300,          // plan 开头应回顾多少前置节点
    "next_preview_chars": 200,          // plan 结尾应预告下一节多少
    "must_reference_modules": ["M54"],  // 必须引用的前置节点 (内容里出现 module_id)

    // === 主题指引 (帮 Claude 决定 anim/game 主题) ===
    "key_concepts": ["完全脱手控制", "BCI 临床意义", "Neuralink 类比"],
    "must_include_artifacts": [         // 节点必须产出的具体文件
      "my-demo-video.mp4",
      "celebration-screenshot.png"
    ]
  }
}
```

---

## importance 五星量表 (决定全局体量倍率)

| 星 | 类型 | 字数倍率 (vs 1 星基线) | 例子 |
|----|------|------|------|
| ★ | 过渡节点 / 链接 | 1.0x | M01 读 BCI 入门 / M64 社区分享 |
| ★★ | 基础铺垫 | 1.3x | M04 装 mne 加载数据 |
| ★★★ | 核心概念引入 | 1.7x | M22 方差 / M29 CSP |
| ★★★★ | 综合 / 实战 | 2.0x | M42 训自己模型 / M50 封装模块 |
| ★★★★★ | 哇时刻 / 阶段 capstone | 2.5x | M12 第一次见 alpha / M55 念头控 MC |

---

## theory_depth × handson_difficulty 矩阵 (决定章节结构)

|               | low handson | medium | high |
|---------------|-----|-----|------|
| **shallow theory** | 读 + 讨论 | 跑 demo | 实采 / 工程化 (此节几乎都在 hands-on) |
| **medium theory** | 概念入门 | 经典节点 | 工具复杂实战 |
| **deep theory**   | 数学讲解 (硬节) | 算法实现 | 硬算法 + 实战双重 (最难) |

不同象限**自动决定 章节比例**:

```python
# Claude 生成 plan 时按 theory_depth × handson_difficulty 分配比例
ratio = {
    ("shallow","high"): {"theory":0.2,"handson":0.6,"reflect":0.2},
    ("deep","high"):    {"theory":0.45,"handson":0.4,"reflect":0.15},
    ("deep","low"):     {"theory":0.7,"handson":0.15,"reflect":0.15},
    # ... 默认 standard
}
```

---

## narrative_role 决定开头结尾风格

| 角色 | plan 开头 | plan 结尾 |
|-----|-----------|-----------|
| `intro` | 「今天我们开始..., 接下来 N 节会教你...」 | 「下节 M02 ...」 |
| `build` | 「上节 M(N-1) 你做完了 X, 今天用它来 ...」 | 「下节 M(N+1) ...」 |
| `climax` | 「这是 stage 高潮 — 之前 K 节都为今天铺路」 | 「★ 庆祝!」 |
| `celebration` | 「★ 哇时刻! 今天你将 ... (情绪扬起)」 | 「下一个里程碑 ...」 |
| `wind_down` | 「上节我们冲到了 ..., 今天巩固」 | 「stage 收官!」 |

---

## anim_complexity 决定动画 spec

| 级别 | 帧数 | 交互 | 视觉冲击 | 文件大小目标 |
|-----|-----|------|---------|------|
| simple | 1-2 | 无 | 概念图 | 5-8KB |
| standard | 4 | 自动播放 | 4 段递进 | 10-15KB |
| rich | 4-6 | 自动 + 1 个 hover/click | 多视角 / 数据可视化 | 15-20KB |
| ceremonial | 4 | 自动 + 庆祝动效 | 大字 / 高潮画面 / emoji | 12-18KB (内容凝练但有仪式感) |

---

## game_complexity 决定游戏 spec

| 级别 | 机制 | 关卡 | 例子 |
|-----|-----|------|---|
| simple | 1 按钮 / 1 滑块 | 1 关或自由 | M01 (读论文, 不需玩什么) |
| standard | 3-5 按钮 + 滑块 | 3 关递进 (默认) | 大多数节点 |
| rich | 多机制 sandbox | 5+ 关 / 自由探索 / 解谜 | M55 (脑控 demo 沙盒) |

---

## 工作流

### 设计阶段 (P0.5 / P1)
Claude 设计 V5 tree 时**必须为每个 module 填 generation_guide**. 这是 P1.5 三维评估的输入之一 (科学性 agent 看 theory_depth 是否合理, 教学法 agent 看 narrative_role 节奏).

### 生成阶段 (单 knode 流程)
Step 0 之前, 必须先**输出"生成预算声明"**:

```
=== M55 生成预算声明 ===
importance: ★★★★★ (wow_4_capstone)
narrative_role: celebration → plan 必须有仪式感总结
theory_depth: shallow → K3 不需要新理论, 重点是体验
handson_difficulty: high → assignment 1000+ 字详细
预算: plan 2000±500, K1 1500/theory, K3 800/theory
anim: ceremonial 4 帧含庆祝场景
game: rich 沙盒 + 多关
```

跑完一节后 audit 自动检查 actual 是否在 expected_lengths 区间.

### 审计阶段 (content_auditor)
audit_tools 优先读 generation_guide 当作 expected, 没有 guide 时退回 EXPECTED 表 (推测). 报告里标:
- 哪些节点没填 guide → 设计阶段补
- 哪些节点 guide 填了但实际偏离 → 生成阶段重做

---

## 向后兼容 (已废弃 — 现在 generation_guide 是 V5 schema **必填**)

历史上 `generation_guide` 字段在 V5 schema 中是可选的, validator 只发 warn 不抛
error. 实测发现这导致 ai-ant / alphafold / purpleair 三个项目全部跳过该字段,
所有节点退化到模板化均值 (wow_moment 全为 None, importance 全为 None).

**现规则 (2026-05-26 起)**: `generation_guide` 是 V5 module 必填字段,
`workspace_bridge._validate_v5_tree` 缺失或字段不合规直接 ValueError, 不允许
save. 老项目想生成内容前必须先补 guide.

### 必填子字段 (validator 强约束)

- `importance`: int 1..5
- `wow_moment`: null 或 'wow_N' (N 是数字)
- `mission_role`: 'foundation' | 'concept_intro' | 'hands_on' | 'synthesis' | 'capstone'
- `narrative_role`: 'intro' | 'build' | 'climax' | 'celebration' | 'wind_down'
- `theory_depth`: 'shallow' | 'medium' | 'deep'
- `handson_difficulty`: 'low' | 'medium' | 'high'
- `expected_lengths`: dict, 必须含 plan_chars / k1_chars_per_theory /
  k3_chars_per_theory / n_theories / assignment_chars / n_exercises,
  每个值是 [min, max] 整数列表 (min ≤ max)
- `anim_complexity`: 'simple' | 'standard' | 'rich' | 'ceremonial'
- `game_complexity`: 'simple' | 'standard' | 'rich'
- `key_concepts`: list[str]

可选: `rationale` (200 字, 解释为什么这节这么定级, 给 P1.5 教学法 agent 复审).

### 谁来填 generation_guide

不是 Claude 自己设计树时顺手填, 而是 **SKILL.md Step P1.4 课程生成指导者
sub-agent** 独立 dispatch 出来的产物. 详见 SKILL.md 项目级流程 Step P1.4.
