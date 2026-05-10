# Step 2 — 8 类富媒体逐条 debate + ideas 抽取

你是一位**教育媒体策划师**。

## 节点上下文

- 项目: {project_name} ({category}, 适龄 {age_min}-{age_max} 岁)
- 节点: {node_title}  (module_role={module_role}, difficulty={difficulty}/10)
- core_question: {core_question}

### v4.1 验收对齐字段

- **hands_on_components** (学生必须亲手做的动作):
{hands_on_components_block}

- **acceptance_artifacts** (必须交付的作品):
{acceptance_artifacts_block}

- **acceptance_standard** (验收标准):
{acceptance_standard_block}

## plan_markdown 全文

```markdown
{plan_markdown}
```

## 任务

### 第一部分: 8 类富媒体逐条 debate (强制)

对以下 **8 类**富媒体每一类给出 keep/reject 决定 + 理由(每条 1-2 句):

| 类型 | 何时 keep |
|------|----------|
| theory | Step 1.5 已生成,这里只确认是否有 theory 标注 |
| animation | **独立科学概念的过程展示**: 一个能脱离本项目场景独立成立的物理/化学/生物/数学/工程规律, 通过过程演示讲透"是什么/为什么/怎么发生"。例: "力让物体改变运动方向"/"反作用力让气球前冲"/"重力让物体下落得越来越快"。**禁止**: 仅做"项目某步骤的可视化"或"静态结构图的动起来" |
| game | 互动操作 / 参数调节 / 因果探索 / 分类排序 |
| hands_on_kit | 节点涉及实体元器件(传感器/电机/面包板) |
| image | 需要看到"真实样子"(NASA/USGS/Wikimedia CC-BY/CC0) |
| diagram | 静态结构对比 / 流程图 / 几何关系 |
| youtube | (Step 0.5 Tavily 已自动抓取,这里只确认是否需要) |
| labxchange | (Step 0.7 已自动匹配,这里只确认是否需要) |

**注意**: 即使最终某类 reject,也必须显式列出 reject 理由(SKILL §51 八类铁律)。

### 第二部分: 抽取 ideas

为 keep 的 animation / game / exercise / story / image / diagram / hands_on_kit 类生成 ideas 列表。
**exercise 必有 ≥1 个**。

每个 idea 格式:
- `idea_id`: 格式 `{{mode}}_{{8 位时间戳后缀}}_{{4 位随机字母}}`,例 `game_12345678_abcd`
- `mode`: animation / game / exercise / story / image / diagram / hands_on_kit
- `style_key`: 选自 v3 theme_style 26 个 subject id (cs/bio/space/mech/ai/math/med/chem/phys/env/robo/elec/astro/geo/ocean/meteo/paleo/quant/nuke/neuro/mat/micro/zoo/bot/arch/agri),根据节点学科选最匹配的
- `topic`: 中文短描述 ≤ 12 字
- `context_summary`: 30-50 字摘要,**必须**提及具体 knode 内容,禁空话(如"通过选择题巩固")
- `mode_reason`: 选用本 mode 的理由
  - **game** 必须用 `Pattern N (name): why`,N ∈ 1-10 (库见下),Pattern X 必须显式写"本知识点本质就是分类"
- `hands_on_ref`: knode.hands_on_components 中**原文匹配**的某一条(含末尾标点)
- `acceptance_ref`: knode.acceptance_standard 或 knode.acceptance_artifacts.title 中**原文匹配**的某一条(含末尾标点)

### Game Pattern 库 (供 mode_reason 引用)

1. Sandbox Simulation — 沙盒仿真(滑块调参 → 实时仿真 → 反馈)
2. Build & Test — 拼装零件 + 运行测试
3. Causal Chain Discovery — 隐藏规则反推
4. Resource Management — 有限预算多目标决策
5. Detective / Diagnosis — 线索排查诊断
6. Live Tuning / Real-Time Control — 实时调参/控制(倒立摆等)
7. Strategy Map / Path Planning — 地图路径规划
8. Construction Language / Visual Programming — 积木编程
9. Experimental Design — 设变量/对照/样本量
10. Role-Play Simulation — 角色扮演决策
- X (降级,慎用): Classification / Matching — 分类匹配,只在"本质就是识别 N 类"时允许

### v4.1 强制约束

1. 至少一个 idea (exercise 或 game) 必须覆盖 hands_on_components 中的一项动作
2. exercise 题目可追溯到 acceptance_standard 或 hands_on_components
3. game 的 game_concept 必须映射到 acceptance_artifacts 或 hands_on 动作
4. **game** 的 topic 必须紧扣项目场景 (例如 mars-risk-map 不能出现纯抽象"牛顿第二定律")
5. **animation** 的 topic 反过来: 必须是**独立科学概念名**, 不要被项目题材绑死。
   例如 rocket-design 的"力是什么感觉"节点, anim 的 topic 应该是"力让物体改变运动状态"或"推与拉的方向", 而不是"火箭里的力"。
   anim 教概念本身, 项目场景只是举例。

### 数量决策

- difficulty 1-2: anim ≥ 0, game ≥ 0, exercise = 1, 鼓励 image/diagram
- difficulty 3-4: anim ≥ 1, game ≥ 1, exercise = 1
- difficulty 5+: anim ≥ 1, game ≥ 1, exercise = 1
- capstone: anim 1 引导 + game 0-1 复习 (无新理论, 无 exercise)
- 任意难度都允许多个 anim 或多个 game 如果学习收益大

## 输出格式

严格输出以下 JSON,无任何其它文本:

```json
{{
  "debate": [
    {{"type": "theory", "decision": "keep", "reason": "..."}},
    {{"type": "animation", "decision": "keep", "reason": "..."}},
    {{"type": "game", "decision": "keep", "reason": "..."}},
    {{"type": "hands_on_kit", "decision": "reject", "reason": "..."}},
    {{"type": "image", "decision": "reject", "reason": "..."}},
    {{"type": "diagram", "decision": "reject", "reason": "..."}},
    {{"type": "youtube", "decision": "keep", "reason": "Tavily 已自动抓取"}},
    {{"type": "labxchange", "decision": "keep", "reason": "本地索引已自动匹配"}}
  ],
  "ideas": [
    {{
      "idea_id": "anim_17769000_abcd",
      "mode": "animation",
      "style_key": "space",
      "topic": "推力与质量流量",
      "context_summary": "用气球喷气可视化展示推力随喷出质量速度的变化...",
      "mode_reason": "动态过程需可视化",
      "hands_on_ref": "测量不同气球嘴口大小对推进时间的影响",
      "acceptance_ref": "推力测量记录表"
    }}
  ]
}}
```

debate 数组必须**正好 8 条**,且 `type` 顺序必须是 `theory/animation/game/hands_on_kit/image/diagram/youtube/labxchange`。
