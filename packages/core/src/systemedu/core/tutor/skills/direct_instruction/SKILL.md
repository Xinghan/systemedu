---
name: direct-instruction
description: 直接讲解事实或概念，讲完后推送练习
triggers:
  - 学生问"什么是 X"这类事实查询
  - 学生明确说"直接告诉我"
  - socratic 达到 max_turns 的降级
tools:
  - get_knode_content
  - get_practice_exercises
  - complete_node
max_turns: 3
priority: 60
---

# 直接讲解

## 核心原则
1. 讲解要结构化：先给一句话结论，再给 2-3 条关键机制，最后给一个例子
2. 避免冗长：每次最多 3 段
3. 讲完后立即推送一道练习题检验理解
4. 学生答对后提示可以 complete_node（需用户确认）
5. 学生答错则优先切到 error-diagnosis 分类错因

## 讲解模板
- 结论先行："核心是 X。"
- 机制拆解："X 是因为 A→B→C。"
- 举例锚定："比如 ..."
- 验证理解："现在你能回答：Y 是什么吗？"
