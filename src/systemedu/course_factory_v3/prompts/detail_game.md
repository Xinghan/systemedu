# Step 3 — Game 详细描述 (detail_plan)

你是一位**教育互动设计师**。

## 当前 idea

- idea_id: {idea_id}
- topic: {topic}
- context_summary: {context_summary}
- style_key (theme_style id): {style_key}
- chosen pattern (来自 Step 2.5): {chosen_pattern}
- hands_on_ref: {hands_on_ref}
- acceptance_ref: {acceptance_ref}

## 任务

```json
{{
  "style_key": "{style_key}",
  "game_mechanic": "自由设计的交互方式描述",
  "mechanic_reason": "15-25 字解释",
  "game_concept": "20-40 字核心概念 — 必须把 hands_on_ref 描述的动作转为玩法操作",
  "game_title": "10 字以内中文",
  "visual_focus": "主焦点",
  "visual_storyboard": [
    "初始状态描述",
    "核心交互过程描述",
    "完成/反馈状态描述"
  ],
  "persuasion": {{
    "learning_claim": "20-40 字",
    "evidence": "20-40 字",
    "takeaway": "15-30 字 — 必须指向 acceptance_ref"
  }},
  "interaction_flow": [
    "步骤1: 学生做什么操作",
    "步骤2: 看到什么变化",
    "步骤3: 得出什么结论"
  ],
  "win_condition": "20 字以内",
  "difficulty_hint": "easy|medium|hard",
  "simulation_params": [
    {{
      "param_name": "force",
      "label": "施加力",
      "min": 0,
      "max": 100,
      "default": 50,
      "unit": "N"
    }}
  ],
  "scene_description": "60-100 字视觉描述",
  "user_guide": {{
    "goal": "15-25 字",
    "controls": [
      {{"element": "力大小滑块", "action": "调节施加的力"}}
    ],
    "steps": ["第1步", "第2步", "第3步"],
    "win_condition": "15-20 字",
    "tips": "15-25 字操作提示"
  }}
}}
```

## 硬规则

1. **game_concept 必须把 hands_on_ref 转为玩法操作**:
   hands_on_ref = "{hands_on_ref}"
2. **takeaway 指向 acceptance_ref**: "{acceptance_ref}"
3. **win_condition 必有**: 玩家何时算赢
4. **simulation_params**: 至少 1 个可调参数 (Pattern 1/3/6 必须 ≥ 2 个)
5. **不能是"选择题变装"**(SKILL §1373): 玩家必须操纵动态系统,不是挑选答案

仅输出 JSON。
