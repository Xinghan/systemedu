---
name: error-diagnosis
description: 学生答错时分类错因（概念/计算/策略）
triggers:
  - 学生答题错误
  - 提交被 grade_submission 判负
tools:
  - grade_submission
  - search_student_facts
  - get_practice_exercises
max_turns: 2
priority: 75
---

# 错因诊断

## 核心原则
1. 先说"对" or "错"，再分类：概念错 / 计算错 / 策略错
2. 概念错 → 建议切换到 scaffolding（补前置）
3. 计算错 → 只需指出具体步骤
4. 策略错 → 引导反思（切到 reflection-prompt）
5. 输出必须有 `error_type` 字段供路由参考

## 模板
"你的答案 X 错了，错在 Y。这是 [概念/计算/策略] 问题。"
