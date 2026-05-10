# Step 3 — Game 学习意图 (fogsight 风格 detail_plan)

你为 Step 5 的 implement 阶段提供**学习意图与交互目标**蓝图。
implement 会自由发挥视觉/控件/物理引擎/UI 布局, 你**绝对不要**预先规划这些。

## 当前 idea

- idea_id: {idea_id}
- topic: {topic}
- context_summary: {context_summary}
- style_key (theme_style id): {style_key}
- chosen pattern (来自 Step 2.5): {chosen_pattern}
- hands_on_ref: {hands_on_ref}
- acceptance_ref: {acceptance_ref}

## 任务

仅输出以下 JSON, 字段都是**意图与目标层**, 不是执行层:

```json
{{
  "style_key": "{style_key}",
  "title": "10 字以内中文游戏标题",
  "core_mechanic_intent": "30-60 字: 学生通过什么样的真实交互来获得理解 (如 '通过滑块调节力的大小, 实时看到物体加速度变化, 直觉建立 F=ma'), 不指定具体控件类型",
  "hands_on_alignment": "20-40 字: 这个 game 如何把 hands_on_ref 描述的真实动手动作转化为屏幕交互",
  "takeaway": "15-30 字: 玩完后学生记住的一句话, 必须指向 acceptance_ref",
  "physical_facts": [
    "可能涉及的真实物理量/范围/单位 (如 '推力 0-100 N' / '质量 0.05-2 kg'), 仅提供事实, 不指定怎么映射"
  ],
  "directional_rules": [
    "**关键科学一致性约束** — 列出所有量的方向规约, 必须严格写明: '推力 F 沿 +x 方向施加 → 物体沿 +x 方向加速度 a = F/m → 速度 v 沿 +x 方向增加 → 位置 x 增加'。每个力必须明确施力方向 → 物体响应方向, 禁止反方向运动假象。"
  ],
  "layout_zones": {{
    "control_panel": "控件区位置 + 含哪些控件 (如 '左侧 200px, 含 1 个力大小滑块 + 1 个质量滑块 + 1 个 lang 切换按钮 + 1 个重置按钮')",
    "main_stage": "主舞台位置 + 占比 (如 '右侧, 占剩余宽度 100%, 高度 100vh')",
    "hud": "HUD 位置 + 显示哪些数字 (如 '右上玻璃面板 200x140px, 显示 F/a/v/x 4 个量')",
    "subtitle": "字幕位置 (如 '主舞台底部 60px 内, 中文 18px + 英文 12px italic')"
  }},
  "win_or_aha_moment": "20-40 字: 玩家什么时候获得'啊哈'时刻或赢条件 (如 '当推力≈重力时火箭悬停, 学生理解平衡')",
  "must_let_player_do": [
    "玩家必须能做的关键操作意图清单 (3-5 条, 如 '调节推力大小并实时看效果' / '尝试不同质量观察规律'), 不指定 UI 元素类型"
  ]
}}
```

## 硬规则

1. **不要规划执行细节**: 禁止输出 simulation_params / controls / steps / win_condition / scene_description / visual_storyboard / interaction_flow / user_guide 等任何执行层字段 (除 layout_zones 外)
2. **必须是真交互, 不能退化为选择题** (SKILL §1373): must_let_player_do 必须含"调节/拖拽/操纵动态系统"类操作, 不能只是"挑选答案"
3. **hands_on_alignment 真把 hands_on_ref 转为玩法**: hands_on_ref = "{hands_on_ref}"
4. **takeaway 指向 acceptance_ref**: "{acceptance_ref}"
5. **physical_facts 写真实数值范围**, 不要"很大""适中"等模糊词
6. **directional_rules 必须每个力都标明施力方向 + 物体响应方向** — 防止 implement 写成"向左施力物体向右运动"
7. **layout_zones 4 个区域不重叠** — 控制面板/主舞台/HUD/字幕各占独立屏幕区域

仅输出 JSON, 无其它文本。
