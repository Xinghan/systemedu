# Step 3 — Exercise 详细描述 (detail_plan)

你是一位**教育评测设计师**。

## 当前 idea

- idea_id: {idea_id}
- topic: {topic}
- context_summary: {context_summary}
- core_question: {core_question}
- hands_on_ref: {hands_on_ref}
- acceptance_ref: {acceptance_ref}

### 节点 acceptance_standard (题目应可追溯)
{acceptance_standard_block}

### 节点 hands_on_components
{hands_on_components_block}

## 任务

设计 4 道选择题,**难度渐进**: 第 1 题概念题 → 第 2-3 题应用题 → 第 4 题综合题。

每题 4 个选项,1 个正确,有 explanation (50-100 字),且每题必须绑定一个 hands_on_ref 或 acceptance_ref (作为 ref 字段)。

```json
{{
  "exercise_count": 4,
  "exercises": [
    {{
      "type": "choice",
      "question": "题目文本",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correct": 0,
      "explanation": "详细解析,50-100 字",
      "ref": "在样例图上手工圈出危险区域并写理由"
    }}
  ]
}}
```

## 硬规则

1. **4 道**(SKILL §1336)
2. **干扰项有教学意义**(反映常见错误认知,不能明显荒谬)
3. **每题 ref 必须**是 hands_on_components 或 acceptance_standard / acceptance_artifacts.title 中的原文
4. **禁止通用科普题**(如"哪个行星最大"与本节无关)
5. **explanation 50-100 字**: 解释正确为什么对、常见错误为什么错

仅输出 JSON。
