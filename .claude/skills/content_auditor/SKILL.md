# CONTENT_AUDITOR.md — 内容生成质量审计 Skill

> 当用户说「跑一次 audit / 审计 / 验收 <slug>」时, Claude Code 按本手册执行.
> 目标: **诊断 course_factory 生成的内容是否真的因节点而异, 还是被 skill 模板化均一了**.

---

## 设计动机 (用户痛点直引)

> "我比较关注的就是你使用同一套 skill 对每个节点进行生成, 最后的结果是每个节点长度都类似, 但实际上节点之间的差异巨大, 你应该对不同难度, 关键程度等做出不同详细程度的设计."

这条 skill 就是为了**让 LLM 自己暴露这个问题**, 给出可执行的修复清单.

---

## 4 维度审计 (强制全部跑, 不准跳)

### D1: 科学性 (Scientific Correctness)
每节 theory 是否:
- 概念准确 (不糊弄, 不用错类比)
- K1 真零公式零字母符号 (preflight 已查但还有 false negative)
- K3 真有学术深度 (不只是 K1 + 公式)
- 没有"绕过硬知识"的隐性降级

### D2: 整体连续性 (Cross-node Continuity)
- 节点 N 的 plan / theory / hands_on 是否引用前置节点
- depends_on 是否对应到实际内容
- 学生从 N-1 走到 N 是否会断链 (前置变量 / 文件名 / 概念是否真出现过)
- 数学融入是否按规划走 (e.g., complexity_plan.md 说 M22 嵌方差, 实际 M22 theory 是否真讲方差)

### D3: 难度-内容量匹配 (Proportionality) ★ 核心
**用户最关切的维度**.

每个节点根据其 metadata 推一个**应有体量分**:
- `mission_role` (foundation / core / deepening / synthesis / capstone)
- `wow_moment` (是否标识为哇时刻)
- `knowledge_level` (K1 / K3)
- `concept_count` (theory 涉及概念数)
- `position_in_stage` (开局 / 中段 / 收官)

应有体量 vs 实际体量对比, 找:
- **过度均一化**: 实际方差 << 应有方差 (skill 把所有节点拉平到相似长度)
- **倒挂**: 简单节点比关键节点还长
- **缺料**: 哇时刻 / capstone 体量不足

### D4: 重要性差异 (Importance Differentiation)
节点之间的"分量"是否在内容上体现:
- 关键节点 anim/game 是否有更精致的交互, 还是套同样模板
- capstone 节点 plan 是否有总结性回顾, 还是跟普通节点一样
- 哇时刻是否有仪式感, 还是跟相邻节点平淡过渡

---

## 启动协议

收到 `audit <slug>` 后, 第一回复必须输出:

```
=== content_auditor 开工声明 ===
slug: <slug>
节点范围: M01-M64 (或用户指定)
基准: content-workspace/_review/<slug>_complexity_plan.md (若有) + V5 tree
审计维度: [ ] D1 科学性  [ ] D2 连续性  [ ] D3 体量匹配  [ ] D4 重要性
输出: content-workspace/_review/<slug>_audit_report.md
```

然后按 4 步执行:

### Step 1: 加载基线数据 (用 `audit_tools.py`)

```python
from content_auditor.lib.audit_tools import (
    load_project_corpus, compute_size_stats, classify_node_role
)
corpus = load_project_corpus("<slug>")
# corpus = {M01: {plan_chars, theories_chars, anim_chars, game_chars, 
#                 theories_k1_chars, theories_k3_chars, exercises_n, ...}}
```

### Step 2: 算 D3 体量匹配 (机械, 不靠 LLM)

```python
from content_auditor.lib.audit_tools import (
    expected_size_score, proportionality_report
)
prop_report = proportionality_report(corpus, tree, complexity_plan)
# 输出 4 张表:
#   - 实际 vs 期望 每节字数
#   - 过度均一化指标 (CV — coefficient of variation)
#   - top-10 缺料节点 (capstone/wow 但内容少)
#   - top-10 过度膨胀节点 (transitional 但内容多)
```

### Step 3: 跑 3 个并行 sub-agent (D1/D2/D4)

并行用 Agent 工具, run_in_background=true, 同时发 3 个:

**Sub-agent A: science**
- 输入: theories.json + plan.md (每节)
- 检查: K1 是否真零公式 (扫 = 号 / 上下标 / 字母变量), K3 是否真深度 (≥ 600 字, 含至少 1 个公式或代码块或数据表), 类比是否合理
- 输出: per-node 0-30 分 + Critical/Minor 清单

**Sub-agent B: continuity**
- 输入: 项目全部 plan.md + complexity_plan.md 的"数学融入"映射表
- 检查: 每节 plan_markdown 是否真讲了"承诺要讲"的 theory, depends_on 节点的产物是否在本节被引用, 跨节点术语一致
- 输出: 断链清单 + 0-30 分

**Sub-agent C: importance**
- 输入: tree.json (含 mission_role + wow_moment) + 每节字数
- 检查: 哇时刻节点是否真有仪式感, capstone 节点是否真总结, transitional 节点是否真该短
- 输出: 重要性体现度 0-30 分 + 改进建议

### Step 4: 合并 + 出报告

```python
from content_auditor.lib.audit_tools import compose_report
compose_report(
    slug="<slug>",
    proportionality=prop_report,
    science=agent_a_result,
    continuity=agent_b_result,
    importance=agent_c_result,
    output="content-workspace/_review/<slug>_audit_report.md"
)
```

报告结构:
```markdown
# <slug> 内容质量审计报告

## TL;DR
- 4 维度评分 (各 0-30, 总 0-120)
- 最关键发现 (top 3 problem)
- 建议优先修哪些节点 (top 10)

## D3 体量匹配 (★ 核心)
- CV (variation coefficient) 全项目 vs 预期
- 字数分布柱状图 (ASCII)
- 倒挂节点清单 (简单节点 > 关键节点)
- 缺料节点 top 10 (按 |实际 - 应有| 排序)

## D1 科学性
...

## D2 连续性
...

## D4 重要性差异
...

## 修复优先级
P0 (必修): ...
P1 (应修): ...
P2 (可改): ...
```

---

## 工具速查

```python
# lib/audit_tools.py 提供:
load_project_corpus(slug) -> dict        # 加载所有节点产物的统计
compute_size_stats(corpus) -> dict       # mean/std/CV/percentile
classify_node_role(node) -> str          # foundation/core/synthesis/capstone/wow
expected_size_score(node) -> int         # 推每节"应有"字数
proportionality_report(...) -> dict      # D3 完整报告 dict
compose_report(...) -> None              # 写 markdown
```

---

## 重要原则

1. **D3 不靠 LLM 判断**: 纯统计 + 规则, 客观.
2. **D1/D2/D4 必须并行 sub-agent**: Claude 自己审自己生的内容会盲点, 必须独立视角.
3. **报告必须可执行**: 每条问题对应具体节点 + 具体字段 + 建议改什么.
4. **不要给安慰分**: 实际差就报差, 假装满分等于失职.
5. **审计本身不改内容**: 只输出报告. 修复是单独 skill (`content_revise`, 未实现, audit 报告会提示).
