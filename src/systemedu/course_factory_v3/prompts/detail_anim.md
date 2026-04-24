# Step 3 — Animation 详细描述 (detail_plan)

你是一位**教育互动设计师**,要为 Step 5 的实现者(就是你自己)提供详尽的执行蓝图。

## 当前 idea

- idea_id: {idea_id}
- topic: {topic}
- context_summary: {context_summary}
- style_key (theme_style id): {style_key}
- chosen pattern (来自 Step 2.5): {chosen_pattern}
- hands_on_ref: {hands_on_ref}
- acceptance_ref: {acceptance_ref}
- core_question (对齐): {core_question}

## 任务

输出以下 JSON,作为 Step 5 实现 animation HTML 的完整蓝图:

```json
{{
  "style_key": "{style_key}",
  "title": "10 字以内中文",
  "frame_count": 4,
  "layout": {{
    "focal_object": "主焦点物体描述",
    "secondary_object": "次焦点物体描述",
    "canvas_fill": 0.62
  }},
  "asset_plan": ["需要绘制的视觉元素列表"],
  "persuasion": {{
    "learning_claim": "20-40 字核心结论 — 必须回答 core_question",
    "evidence": "20-40 字视觉证据",
    "takeaway": "15-30 字学生能复述什么 — 必须指向 acceptance_ref"
  }},
  "beats": [
    {{"t": 0.0, "action": "enter", "focus": "主体出现"}},
    {{"t": 0.2, "action": "anticipation", "focus": "准备动作"}},
    {{"t": 0.5, "action": "main_action", "focus": "核心演示"}},
    {{"t": 0.8, "action": "settle", "focus": "回弹/收敛"}}
  ],
  "frames": [
    {{
      "frame_index": 0,
      "description": "20-40 字场景描述",
      "visual_elements": ["元素1", "元素2"],
      "narration": "可选, 20 字以内"
    }}
  ],
  "animation_type": "流程演示|对比展示|数据变化|物理过程|概念图解",
  "user_guide": {{
    "what_it_shows": "20-30 字一句话描述",
    "observe_points": ["观察重点1", "观察重点2"],
    "controls": "播放控制说明",
    "takeaway": "15-25 字能回答什么"
  }}
}}
```

## 硬规则

1. **frame_count 4-6**(SKILL §1232)
2. **persuasion.learning_claim 必须回答 core_question**: "{core_question}"
3. **user_guide.takeaway 必须指向 acceptance_ref**: "{acceptance_ref}"
4. **一个 animation = 一个概念**(SKILL §1534): 多帧是同一概念递进/深化,不是并列多概念
5. **frames 必须连续**(SKILL §1535-1538): 同一场景的不同时刻,不是 PPT 幻灯片
6. 所有元素描述要具体可绘制(用形状/颜色/位置/大小,不要"美丽""漂亮"等抽象词)

仅输出 JSON,无其它文本。
