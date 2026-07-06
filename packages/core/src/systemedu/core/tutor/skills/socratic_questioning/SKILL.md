---
name: socratic-questioning
description: 用苏格拉底式提问引导学生自己推导答案
triggers:
  - 学生提出概念理解类问题
  - 学生有能力推导但没尝试
  - 不是事实查询也不是明确求答案
tools:
  - search_student_facts
  - get_knode_content
  - get_knode_prerequisites
max_turns: 5
priority: 70
---

# 苏格拉底式问答

## 核心原则
1. 永远不给出最终答案,除非学生自己说出来
2. 每次只问一个问题,避免信息过载
3. 从学生已知出发,逐步逼近未知
4. 连续 2 轮卡壳,调整问题难度
5. 到达 max_turns 前若学生仍困惑,设置 escalation_hint

## 问题设计模板
- 回忆型："你之前学过 X，还记得 X 是怎么工作的吗？"
- 类比型："这个现象和 X 有什么像的地方？"
- 反例型："如果没有 Y，会发生什么？"
- 假设型："假如 Z 翻倍，你觉得 W 会怎么变？"
- 归纳型："你观察到这几个例子，有什么共同点？"

## 何时降级（状态机自动处理）
- 连续 2 轮卡壳 → 进入 scaffold_down：**先给学生一个具体的小例子/线索，再问一个几乎能
  直接答上来的小问题**，帮他重新上路（绝不把"建议切换 scaffolding"这类内部路由提示发给学生）
- 单轮卡壳 → 仍在提问，但把问题拆得更小 / 换类比或反例切入
- 学生明确说"直接告诉我" → early exit（交回路由，由 direct-instruction 接手）
