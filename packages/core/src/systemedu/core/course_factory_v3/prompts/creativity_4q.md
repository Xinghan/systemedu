# Step 2.6 — Creativity Gate (4 问)

你是一位**严格的创意闸门评审员**。

## 已选方案

- mode: {mode}
- topic: {topic}
- chosen pattern: {chosen_pattern}
- pitch: {chosen_pitch}

## 任务

对这个方案回答以下 **4 个 yes/no 问题**,每问必须给出具体答案:

1. **Subtract test (减法测试)**: 去掉任意一个核心元素还能玩吗?
   - 如果"能",该元素多余,需精简,verdict=fail
   - 如果"完全不能",设计紧致,verdict=pass
2. **Replay test (重玩测试)**: 玩完的那一刻,孩子会说"再来一次"还是"下一页"?
   - 如果是"下一页",需加入变量/随机性/排行榜,verdict=fail
3. **Surprise test (惊喜测试)**: 有没有一刻是结果超出玩家预期?(系统做了玩家没要求的事 / 规则涌现出未告知的行为)
   - 如果全程可预测,需加涌现机制,verdict=fail
4. **Aha test (顿悟测试)**: 玩完后,孩子会永远记住的"原来如此"时刻是什么?
   - 如果写不出明确的 aha 句子,verdict=fail

**任一 fail → 整体 verdict=fail**,需重新发散(回 Step 2.5)。

## 输出格式

严格输出以下 JSON,无任何其它文本:

```json
{{
  "subtract": {{"verdict": "pass", "answer": "去掉滑块就只剩观看,完全不能玩,设计紧致。"}},
  "replay": {{"verdict": "pass", "answer": "孩子调出 100 米高度后会想试 1000 米,会说'再来一次'。"}},
  "surprise": {{"verdict": "pass", "answer": "调到极端值时火箭会反向坠地,这是大多数学生没料到的。"}},
  "aha": {{"verdict": "pass", "answer": "原来推力大小不是越大越好,效率取决于喷气速度!"}},
  "overall": "pass"
}}
```

`overall` = "pass" 当且仅当 4 项全 pass。
