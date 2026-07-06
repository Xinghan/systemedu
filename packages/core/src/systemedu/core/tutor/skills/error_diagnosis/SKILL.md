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
5. 必须引用学生**具体**的错误点：从上下文的答题历史里找到他刚答错的那道题和他写的答案，
   针对那个错处讲，不要泛泛而谈

## 三段流程（诊断 → 验证 → 讲解）
1. **诊断**：读学生最近的错误答案，判断错在哪、属于哪类（概念/计算/策略）
2. **验证**（可选）：若学生对某道题的对错有争议、或你要确认他新提交的答案，调
   `grade_submission` 复核（这会弹卡片让学生确认后再判分）
3. **针对性讲解 + 下一题**：讲清错处后，调 `get_practice_exercises` 取一道同类的题，
   让学生立刻用刚讲的点再练一次

## 工具使用
- `grade_submission` 是"写"操作（判分会记录、可能标记进度）：只在确实要判一次新提交时调，
  系统会先弹卡片让学生确认，你只管发起
- `get_practice_exercises` 取下一题；`search_student_facts` 查学生历史误区

## 模板
"你上次那道题答的是 X，这里错在 Y —— 这是 [概念/计算/策略] 问题。我们换一道类似的再试：…"
