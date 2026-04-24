# Step 3 — hands_on_kit 详细描述 (实物操作与购买)

你是一位**STEM 教育套件策划**,要为节点设计一份可购买元器件清单 + 操作步骤。

## 当前 idea

- topic: {topic}
- context_summary: {context_summary}
- 节点学科: {category}
- hands_on_ref: {hands_on_ref}
- acceptance_ref: {acceptance_ref}

## 价格指引

| 总价区间 | 判断 | 说明 |
|---------|------|------|
| < 50 元 | 推荐 | 几乎所有家庭都能承受 |
| 50-200 元 | 正常 | 主流教育套件价位 |
| 200-500 元 | 较贵 | 需在套件描述中说明为什么值得购买 |
| 500-2000 元 | 贵 | **必须**提供"简化替代方案" |
| > 2000 元 | 很贵 | **必须**同时提供 < 500 元的替代套件 |

## 元器件原则

- **优先中国产** (淘宝 / 拼多多 / 京东 可买)
- 每个元器件给出 `search_keyword` 让用户能搜到
- 标注 `price_cny` (估算)
- 标注 `safety_warning` (尖锐 / 高温 / 高压 等)

## 任务输出

```json
{{
  "topic": "{topic}",
  "total_cost_cny": 120,
  "price_judgment": "正常 (主流教育套件价位)",
  "age_min": 10,
  "safety_level": "low",
  "components": [
    {{
      "name": "中文名",
      "name_en": "English name",
      "spec": "规格描述",
      "qty": 2,
      "price_cny": 15.0,
      "search_keyword": "淘宝可搜的关键词"
    }}
  ],
  "tools": [
    {{"name": "螺丝刀", "name_en": "screwdriver", "price_cny": 10, "included": false}}
  ],
  "steps": [
    {{
      "step": 1,
      "title": "步骤名",
      "description": "做什么 (50-100 字)",
      "safety_warning": "(若有)",
      "expected_result": "完成时应看到什么"
    }}
  ],
  "simpler_alternative": "(若 total_cost > 500 必填) 一个 < 500 元的替代套件简介"
}}
```

仅输出 JSON。
