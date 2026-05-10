# Step 3 — Story 详细描述 (detail_plan)

你是一位**儿童故事作者**,要为这个节点写一个 3-5 段的引入故事(用类比/比喻/历史背景帮孩子建立直觉)。

## 当前 idea

- topic: {topic}
- context_summary: {context_summary}
- 适龄 {age_min}-{age_max} 岁

## 任务

```json
{{
  "title": "10 字以内中文",
  "paragraphs": [
    {{"text": "故事段落, 100-150 字", "image_url": ""}}
  ]
}}
```

## 硬规则

1. **3-5 段**
2. 每段 100-150 字, 用日常语言, 含具体场景描写
3. 故事必须**自然引出**节点核心概念,不是讲完故事再做题
4. image_url 留空字符串(后续可补)

仅输出 JSON。
