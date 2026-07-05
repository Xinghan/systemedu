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
3. 讲完后调用 `get_practice_exercises` 取一道练习题检验理解
4. 学生答对后，调用 `complete_node` 标记这一关完成（系统会先弹卡片让学生确认，你只管发起）
5. 学生答错则优先切到 error-diagnosis 分类错因

## 工具使用
- 需要课程原文时调 `get_knode_content`；出题时调 `get_practice_exercises`
- `complete_node` 是"写"操作：只在学生确实答对、明确该收尾时才调；调用后不要自己
  假设已完成，等系统确认结果回来再继续说话

## 讲解模板
- 结论先行："核心是 X。"
- 机制拆解："X 是因为 A→B→C。"
- 举例锚定："比如 ..."
- 验证理解："现在你能回答：Y 是什么吗？"
