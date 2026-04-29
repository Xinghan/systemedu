# Step 3 — Animation 学习意图 (fogsight 风格 detail_plan)

你为 Step 5 的 implement 阶段提供**学习意图蓝图**。
implement 阶段会自由发挥视觉/时间轴/分镜/比例尺,你**绝对不要**预先规划这些。

## 当前 idea

- idea_id: {idea_id}
- topic: {topic}
- context_summary: {context_summary}
- style_key (theme_style id): {style_key}
- chosen pattern (来自 Step 2.5): {chosen_pattern}
- hands_on_ref: {hands_on_ref}
- acceptance_ref: {acceptance_ref}
- core_question (对齐): {core_question}

## 本 animation 的本质要求 (必读, 决定所有字段)

**animation = 一个独立科学概念的过程展示**

不是项目里某个步骤的可视化, 也不是静态结构图的"动起来", 而是讲透一条**能脱离本项目独立成立**的物理/化学/生物/数学/工程规律, 并通过过程演示让学生理解"是什么 / 为什么发生 / 怎么演变"。

判别标准 (4 个):
1. **概念可独立**: 即使把"火箭设计"换成别的项目, 这个 anim 仍然成立 (例: "反作用力" 不依赖火箭场景)
2. **必须是过程**: 必须有时间维度的变化、因果链或演化, 不能是一张图
3. **科学规律层**: 解释"为什么会这样" (机制), 不是"长什么样" (外观)
4. **学生能内化**: 看完能用自己话复述这个规律, 而不是记住 anim 的视觉细节

**反例 (禁止)**:
- "火箭起飞流程图动起来" → 是项目步骤, 不是科学概念
- "火箭部件结构展示" → 是结构图, 不是过程
- "火箭飞行轨迹" → 是现象, 不是规律 (除非真在讲抛体运动等独立物理规律)

## 任务

仅输出以下 JSON, 字段都是**意图层**, 不是执行层。implement 阶段读完会自己设计具体表达:

```json
{{
  "style_key": "{style_key}",
  "title": "10 字以内中文动画标题, 体现独立科学概念名 (如 '反作用力' 而不是 '气球前冲')",
  "scientific_concept": "10-20 字: 本 anim 演示的独立科学规律名称, 即使脱离本项目也能成立 (如 '牛顿第三定律: 作用力与反作用力')",
  "core_concept": "30-60 字: 这条规律的内容是什么? 包含'是什么 + 为什么发生'的科学解释",
  "process_to_show": "30-60 字: 这条规律的**过程**怎么演 — 必须有时间维度的因果链 (如 '气球内气压差 → 气体喷出 → 反方向推力 → 气球前冲'), 不是静态展示",
  "answers_question": "20-40 字: 看完后学生应该能用自己话回答 core_question 的什么",
  "takeaway": "15-30 字: 学生记住的一句话, 必须指向 acceptance_ref",
  "physical_facts": [
    "演示中涉及的真实物理量/数值/单位 (如 '重力加速度 9.8 m/s²' / '气球放气推力约 0.1 N'), 仅提供事实, 不指定怎么用"
  ],
  "directional_rules": [
    "**关键科学一致性约束** — 列出本场景所有量的方向规约, 必须严格写明: '推力 F 沿 +x 方向施加 → 物体沿 +x 方向加速度 a 增加 → 速度 v 沿 +x 方向变大 → 位置 x 增加'。如果有反向力, 也要明确: '撤去推力, 摩擦力 f 沿 -x 方向 → 物体加速度沿 -x 方向 → 速度减小 → 最终静止'。每个力必须明确施力方向 → 物体响应方向, 禁止反方向运动假象。"
  ],
  "layout_zones": {{
    "main_stage": "主舞台位置 + 占比 (如 '居中, 70% 宽度')",
    "hud": "HUD 位置 + 哪些数字 (如 '右上, 显示 F/a/v/x 4 个量, 60x180px 玻璃面板')",
    "subtitle": "字幕位置 (如 '底部 80px 内, 中文 24px + 英文 14px italic')",
    "title": "标题位置 (如 '左上角 24px')"
  }},
  "narrative_hint": "30-60 字: 用什么真实场景或类比能最快讲透这条规律 (如 '用气球放气演示反作用力'), 不规划帧数/分镜",
  "what_must_show": [
    "学生必须看到的关键过程元素 (3-5 条, 如 '推力箭头随时间变化' / '物体加速度变化曲线'), 不指定视觉风格"
  ]
}}
```

## 硬规则

1. **不要规划视觉细节**: 禁止输出 frames / beats / frame_count / visual_elements / asset_plan / canvas_fill 等执行层字段 (除 layout_zones 外, 因为分区防重叠)
2. **scientific_concept 必须是独立科学规律名** (上面四条判别标准全过), 不是项目场景描述
3. **process_to_show 必须有因果链**: A → B → C 形式, 不能是 "1.展示 X 2.展示 Y" 的列举
4. **answers_question 必须呼应 core_question**: "{core_question}"
5. **takeaway 必须指向 acceptance_ref**: "{acceptance_ref}"
6. **physical_facts 写真实数值**, 不要"很大""很快"等模糊词
7. **directional_rules 必须每个力都标明施力方向 + 物体响应方向** — 防止 implement 写成"向左施力物体向右运动"这种反科学情况
8. **layout_zones 4 个区域不重叠** — 主舞台/HUD/字幕/标题各占独立屏幕区域

仅输出 JSON, 无其它文本。
