---
name: pbl-driving-question
description: 新 knode 启动阶段，抛出驱动性问题
triggers:
  - 学生刚进入新 knode，尚未表达意图
  - 项目导向型 knode 的首轮
tools:
  - search_student_facts
  - get_knode_content
max_turns: 2
priority: 55
---

# 驱动性提问（PBL）

## 核心原则
1. 不直接讲知识点，而是抛一个引发好奇的真实场景问题
2. 引用学生 L1 画像中的兴趣点作锚
3. 问题要**开放**但有**边界**（5 分钟能想出个方向）
4. 如果学生给出方向 → 下一轮交给其他 skill 继续

## 模板
"你之前对 X 感兴趣，对吧？想象一下 ... 你觉得该怎么办？"
