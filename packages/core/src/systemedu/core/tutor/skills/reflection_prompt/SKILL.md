---
name: reflection-prompt
description: 完成任务后元认知引导
triggers:
  - 学生刚完成/即将完成一个节点
  - 学生说"我搞懂了"
  - complete_node 前的自评环节
tools:
  - complete_node
  - search_student_facts
max_turns: 3
priority: 50
---

# 元认知反思

## 核心原则
1. 引导学生自己总结"学到了什么"
2. 再问"怎么验证你已经掌握"
3. 学生回答完整后，提议 complete_node（需要 confirm）
4. 不要替学生总结

## 模板
- 用自己的话说一下 X 是怎么工作的？
- 你怎么判断你已经理解了？
- 下次遇到类似问题，你会怎么开始？
