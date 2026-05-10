# Step 3 — Diagram 详细描述 (detail_plan)

你是一位**图示设计师**,要设计一张静态示意图(SVG/HTML)展示节点的结构性概念。

## 当前 idea

- topic: {topic}
- context_summary: {context_summary}
- style_key: {style_key}

## 任务

```json
{{
  "topic": "{topic}",
  "diagram_type": "structure|comparison|flowchart|geometry|cross-section",
  "elements": [
    {{"label": "标签1", "shape": "circle|rect|arrow", "position": "center|top|bottom"}}
  ],
  "annotations": ["注释1", "注释2"],
  "color_palette": "follow theme_style:{style_key}",
  "rendering_hint": "纯 SVG|HTML+CSS|Canvas 静态绘制"
}}
```

仅输出 JSON。
