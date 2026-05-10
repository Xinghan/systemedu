# Step 4 — Debate 决策 (approve / reject / revise)

你是一位**严格的教育内容评审官**,要对每个 idea 做正反辩论后给出最终决策。

## 待评审 ideas (含 Step 3 的 detail_plan)

```json
{ideas_json}
```

## 节点上下文

- core_question: {core_question}
- hands_on_components: {hands_on_components_short}
- acceptance_artifacts: {acceptance_artifacts_short}
- module_role: {module_role}

## 任务

对每个 idea 进行正反辩论,然后输出决策:

### 正方 (教学价值)
- 这个富媒体比纯文字描述有多大增益?
- 学生能从交互中得到什么纯阅读得不到的?

### 反方 (可行性质疑)
- HTML 实现难度是否超出单文件 100vh 限制?
- 视觉效果能否真正做好(避免简陋影响学习体验)?
- 交互逻辑是否过于复杂导致 bug 风险高?
- 有没有更简单的方式达到同样的教学效果?

### Game 专项 (必问)

仅对 mode=game 的 idea 加问:
- 这个 game 是不是又一个"分类/匹配/放置正确位置"的判断类玩法 (Pattern X)?
- 如果是,能否改写成 Pattern 1-10 之一?
- 玩家在游戏里是"操纵动态系统"还是"挑选正确答案"? 只有前者算合格 game。
- 如果玩家不知道答案就无法开始,说明这是 exercise 变装,直接 reject

## 决策规则

- **教学逻辑错误** → reject
- **技术不可行** (100vh 内布不下、交互过于复杂) → reject
- **纯文字就能讲清楚, 富媒体增益不大** → reject
- **game 本质是选择题** (boss_quiz) → reject (保留 exercise 即可)
- **game 落入 Pattern X 且非"本质就是分类"** → reject 或 revise 成 Pattern 1-10 之一
- 其它 → approve 或 revise (简化后通过)

## 输出格式

严格输出以下 JSON,无其它文本:

```json
{{
  "decisions": [
    {{
      "idea_id": "anim_xxx",
      "decision": "approve",
      "reason": "动态可视化能让学生看到推力随时间变化,文字写不出。"
    }},
    {{
      "idea_id": "game_yyy",
      "decision": "revise",
      "reason": "原方案让玩家选'正确速度',Pattern X 变装。",
      "revise_hint": "改为 Pattern 1 Sandbox: 滑块调速度,实时看到火箭轨迹。"
    }},
    {{
      "idea_id": "ex_zzz",
      "decision": "approve",
      "reason": "题目直接对应 acceptance_standard 中'能解释推力公式'。"
    }}
  ]
}}
```

每个 idea 必须有一条 decision,不能漏。
