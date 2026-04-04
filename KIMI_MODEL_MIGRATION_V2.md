# 课程创建 Agent 模型迁移与审核机制 - V2

## 修改概述

本次修改包含三个核心变更：
1. **新增 CourseIdeaReviewerAgent** - 审核每个 idea，不通过的不会进入生成
2. **确保 AnimationGenAgent 和 GameGenAgent 使用 kimi-k2.5** - 高质量内容生成
3. **修改默认配置** - 支持 kimi provider

## 新增文件

### `src/systemedu/agents/builtin/course_idea_reviewer_agent.py`

全新的审核 agent，职责：
- 审核每个 CourseIdeaAgent 产出的 idea
- 从 4 个维度评分：教学价值、可行性、适合度、复杂度
- 决策：approved / rejected / needs_revision
- 只有 approved 的 idea 才会进入后续生成流程

**审核规则：**
- 总分 >= 28 且 教学价值 >= 7 且 可行性 >= 6：通过
- 总分 < 24 或 教学价值 < 6 或 可行性 < 5：拒绝
- 其他情况：需要修改

**核心方法：**
- `review()` - 审核单个 idea
- `review_all()` - 批量审核，返回 (approved_ideas, rejected_ideas)

## 修改文件

### 1. `src/systemedu/core/config.py`
- 新增 kimi provider 配置
- 修改默认 LLM provider 为 kimi

```python
"kimi": {
    "base_url": "https://api.moonshot.cn/v1",
    "api_key": "${MOONSHOT_API_KEY}",
    "model": "kimi-k2.5",
},
```

### 2. `src/systemedu/education/lesson_generator.py`

**修改 1：导入 CourseIdeaReviewerAgent**
```python
from systemedu.agents.builtin.course_idea_reviewer_agent import CourseIdeaReviewerAgent
```

**修改 2：新增 Step 2.5 - 审核流程**
```python
# Step 2.5: Review ideas (approval gate)
if ideas:
    logger.info(f"[v2] Step 2.5: CourseIdeaReviewerAgent reviewing {len(ideas)} ideas")
    reviewer = CourseIdeaReviewerAgent(llm)
    approved_ideas, rejected_ideas = await reviewer.review_all(...)
    ideas = approved_ideas  # 只保留通过的 ideas
```

**修改 3：Step 4 使用独立的 kimi_llm**
```python
# Dedicated kimi LLM for animation and game generation (high-quality content)
kimi_llm = get_llm(provider="kimi", model="kimi-k2.5", streaming=False)

# 在 _generate_idea 中：
if mode == "animation":
    result = await AnimationGenAgent(kimi_llm).generate(...)  # 使用 kimi
elif mode == "game":
    result = await GameGenAgent(kimi_llm).generate(...)  # 使用 kimi
```

## 更新后的 Pipeline 架构

```
generate_course_v2()
├── Step 1: CoursePlannerAgent.plan_detailed() 
│   └── 生成 Markdown 学习计划 (800-1500字)
├── Step 2: CourseIdeaAgent.identify()
│   └── 识别 3-5 个富媒体知识点
├── Step 2.5: CourseIdeaReviewerAgent.review_all() [新增]
│   ├── 审核每个 idea (4维度评分)
│   ├── 分离 approved / rejected
│   └── 只有 approved 进入下一步
├── Step 3: CourseIdeaDetailAgent.elaborate() [并行]
│   └── 为每个 approved idea 生成详细方案
├── Step 4: 内容生成 [并行]
│   ├── AnimationGenAgent(kimi_llm).generate() → HTML
│   ├── GameGenAgent(kimi_llm).generate() → HTML  [使用kimi]
│   ├── StoryGenAgent().generate() → 段落+图片
│   └── ExerciseGenAgent(llm).generate() → 练习题
├── Step 5: IntegrationAgent.integrate()
└── Step 6: 作业生成 + 分段
```

## Model 使用情况

| Agent | 使用的 LLM | 说明 |
|-------|-----------|------|
| CoursePlannerAgent | 通用 llm | 学习计划生成 |
| CourseIdeaAgent | 通用 llm | Idea 识别 |
| **CourseIdeaReviewerAgent** | 通用 llm | **新增：审核 gate** |
| CourseIdeaDetailAgent | 通用 llm | Detail plan 生成 |
| **AnimationGenAgent** | **kimi_llm** | **强制使用 kimi-k2.5** |
| **GameGenAgent** | **kimi_llm** | **强制使用 kimi-k2.5** |
| StoryGenAgent | 无 LLM | 仅调用图片生成 |
| ExerciseGenAgent | 通用 llm | 练习题生成 |
| CourseSegmentAgent | 通用 llm | 分段和音频脚本 |

**通用 llm 配置：**
```python
llm = get_llm(provider="kimi", model="kimi-k2.5", streaming=False)
```

**专用 kimi_llm 配置（animation/game）：**
```python
kimi_llm = get_llm(provider="kimi", model="kimi-k2.5", streaming=False)
```

## 环境变量配置

```bash
export MOONSHOT_API_KEY="your-moonshot-api-key"
```

或配置 `~/.systemedu/config.yaml`：
```yaml
llm:
  default: kimi
  providers:
    kimi:
      base_url: https://api.moonshot.cn/v1
      api_key: your-moonshot-api-key
      model: kimi-k2.5
      temperature: 0.7
```

## 审核效果示例

**通过的 idea：**
```json
{
  "decision": "approved",
  "total_score": 32,
  "scores": {
    "teaching_value": 9,
    "feasibility": 8,
    "appropriateness": 8,
    "complexity": 7
  },
  "reasoning": "动画能有效展示光合作用的过程...",
  "suggestions": ""
}
```

**拒绝的 idea：**
```json
{
  "decision": "rejected",
  "total_score": 18,
  "scores": {
    "teaching_value": 5,
    "feasibility": 4,
    "appropriateness": 5,
    "complexity": 4
  },
  "reasoning": "该概念不适合用游戏展示，更适合动画...",
  "suggestions": "建议改为 animation 模式"
}
```

## 测试验证

```bash
source .venv/bin/activate && python -m pytest tests/ -v --tb=short
```

## 回滚方案

如需回退到无审核版本，修改 `lesson_generator.py`：
1. 注释掉 Step 2.5 的审核代码块
2. 将 `ideas = approved_ideas` 改为保留原始 ideas

如需更换 animation/game 的模型，修改第 215 行：
```python
kimi_llm = get_llm(provider="other", model="other-model", streaming=False)
```
