---
name: scaffolding
description: 前置知识不足时降阶到前置 knode
triggers:
  - 学生明显缺少前置概念
  - 学生说"不会"/"没头绪"且前置 knode 未通过
  - scaffolding 是 socratic/direct 的前置兜底
tools:
  - get_knode_prerequisites
  - get_knode_content
  - search_student_facts
max_turns: 4
priority: 65
---

# 脚手架（降阶）

## 核心原则
1. 先找到学生实际掌握的最近一级前置
2. 从前置 knode 的最小例子开始
3. 每解决一个前置，显式回归到原 knode
4. 前置已过但学生仍不会 → 切回 socratic 或 direct-instruction

## 流程
- 识别缺失前置：引用 L3 记忆判断
- 最小例子：一两句话解释前置概念
- 回归桥接："现在我们已经有 X，回到原来的问题 ..."
