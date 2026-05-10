# Step 2.5 — Ideation Divergence (3 方案发散)

你是一位**资深教育互动设计师**。

## 当前 idea

- mode: {mode}
- topic: {topic}
- context_summary: {context_summary}
- 节点学科: {category}, theme_style id: {style_key}
- core_question: {core_question}
- hands_on_ref: {hands_on_ref}
- acceptance_ref: {acceptance_ref}

## 任务

为这个 idea 设计 **3 个跨不同 Pattern 的候选方案** (game) 或 **3 种不同呈现模式** (animation),
然后选 1 个 reject 另两个,写明选择理由。

### Game Pattern 库 (game 候选必须跨 3 个不同 Pattern)

1. Sandbox Simulation
2. Build & Test
3. Causal Chain Discovery
4. Resource Management
5. Detective / Diagnosis
6. Live Tuning / Real-Time Control
7. Strategy Map / Path Planning
8. Construction Language / Visual Programming
9. Experimental Design
10. Role-Play Simulation
- X (降级,慎用): Classification / Matching

### Animation 呈现模式 (animation 候选必须跨 3 种不同模式)

- 剖面图 (cross-section): 切开物体看内部结构变化
- 时间序列 (time-series): 同一对象不同时刻的演化
- 参数扫描 (parameter-sweep): 调一个变量看结果变化
- 尺度对比 (scale-compare): 在不同空间/时间尺度下并列对比
- 因果反演 (causal-reverse): 从结果倒推原因(隐藏变量分析)
- 流程演示 (process-flow): 步骤分解过程
- 数据变化 (data-evolve): 数据/统计图表随时间变化

## 每个候选必须有

- `pattern`: 选自上述列表(game 用 Pattern N,animation 用呈现模式)
- `pitch` (2-3 句):
  - 玩家/观众做什么
  - 在屏幕上看到什么
  - **why this is cool**(为什么比平庸版本好)

**3 个方案应该真的不同**(不是同一玩法换皮)。

## 选择理由

最后选 1 个,写明:
- `chosen_index`: 0 / 1 / 2
- `chosen_rationale`: 为什么选它,以及 reject 另两个的具体理由(每个一句)

## 输出格式

严格输出以下 JSON,无任何其它文本:

```json
{{
  "candidates": [
    {{"pattern": "Pattern 1: Sandbox Simulation", "pitch": "玩家拖动滑块调节气球嘴口大小,看到火箭实时升空高度变化。why cool: 学生第一次看到自己调一个旋钮就能直接控制火箭上升..."}},
    {{"pattern": "Pattern 6: Live Tuning", "pitch": "..."}},
    {{"pattern": "Pattern 4: Resource Management", "pitch": "..."}}
  ],
  "chosen_index": 0,
  "chosen_rationale": "选 Pattern 1 是因为本节强调因果关系 ('参数 → 结果' 的心智模型),Sandbox 最直接。Reject Pattern 6 因为对低龄学生过难。Reject Pattern 4 因为本节没有'权衡多目标'的需求。"
}}
```
