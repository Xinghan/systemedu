# 课程创建 Agent 模型迁移报告

## 修改概述

已将课程创建相关的所有 Agent 模型从默认的 `qwen3-max` 迁移到 `kimi-k2.5`。

## 修改文件

### 1. `src/systemedu/core/config.py`
- 在 `_default_config_dict()` 中新增 **kimi provider** 配置
- 修改默认 LLM provider 为 `kimi`

```python
"kimi": {
    "base_url": "https://api.moonshot.cn/v1",
    "api_key": "${MOONSHOT_API_KEY}",
    "model": "kimi-k2.5",
},
```

### 2. `src/systemedu/education/lesson_generator.py`
- 修改第 82 行，显式指定使用 kimi provider 和 kimi-k2.5 模型

```python
# 修改前
llm = get_llm(streaming=False)

# 修改后  
llm = get_llm(provider="kimi", model="kimi-k2.5", streaming=False)
```

## 受影响的 Agent 列表

以下 6-Agent Pipeline 中的所有 agent 现在使用 `kimi-k2.5`：

| Agent | 文件路径 | 职责 |
|-------|----------|------|
| CoursePlannerAgent | `agents/builtin/course_planner.py` | 生成详细学习计划 |
| CourseIdeaAgent | `agents/builtin/course_idea_agent.py` | 识别富媒体知识点 |
| CourseIdeaDetailAgent | `agents/builtin/course_idea_detail_agent.py` | 详细规划每个 idea |
| CourseIdeaDetailPlannerAgent | `agents/builtin/course_idea_detail_planner_agent.py` | 生成动画/游戏/故事方案 |
| AnimationGenAgent | `agents/builtin/animation_gen_agent.py` | 生成动画 HTML |
| GameGenAgent | `agents/builtin/game_gen_agent.py` | 生成互动游戏 HTML |
| StoryGenAgent | `agents/builtin/story_gen_agent.py` | 生成故事段落 |
| ExerciseGenAgent | `agents/builtin/exercise_gen_agent.py` | 生成练习题 |
| CourseSegmentAgent | `agents/builtin/course_segment_agent.py` | 分段并生成音频脚本 |

## 环境变量配置要求

需要设置 Moonshot API Key：

```bash
export MOONSHOT_API_KEY="your-moonshot-api-key"
```

或者在 `~/.systemedu/config.yaml` 中直接配置：

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

## 课程创建 Pipeline 架构

```
generate_course_v2()
├── Step 1: CoursePlannerAgent.plan_detailed() 
│   └── 生成 Markdown 学习计划 (800-1500字)
├── Step 2: CourseIdeaAgent.identify()
│   └── 识别 3-5 个富媒体知识点
├── Step 3: CourseIdeaDetailAgent.elaborate() [并行]
│   └── 为每个 idea 生成详细方案
├── Step 4: 内容生成 [并行]
│   ├── AnimationGenAgent.generate() → HTML
│   ├── GameGenAgent.generate() → HTML  
│   ├── StoryGenAgent.generate() → 段落+图片
│   └── ExerciseGenAgent.generate() → 练习题
├── Step 5: IntegrationAgent.integrate()
│   └── 整合所有内容为 CourseContent
├── Step 6: 生成作业
└── Step 6a: CourseSegmentAgent.segment()
    └── 分段并生成音频脚本
```

## Agent 代码分析

### CoursePlannerAgent
- **核心 Prompt**: `COURSE_PLANNER_PROMPT` + `PLAN_DETAILED_PROMPT`
- **输出格式**: JSON (步骤规划) + Markdown (详细计划)
- **关键方法**: `plan()`, `plan_detailed()`

### CourseIdeaAgent  
- **核心 Prompt**: `COURSE_IDEA_PROMPT`
- **输出格式**: Markdown + `---SEPARATOR---` + JSON
- **识别模式**: animation | exercise | story

### CourseIdeaDetailAgent
- **Pipeline**: Planner → Critic → Simplifier
- **子 Agent**: 
  - CourseIdeaDetailPlannerAgent (生成详细方案)
  - CourseIdeaDetailCriticAgent (评分反馈)
  - CourseIdeaDetailSimplifierAgent (简化降级)

### AnimationGenAgent
- **三层架构**:
  1. Parametric Template (最高质量)
  2. AnimationSpec DSL (当前主力)
  3. Fallback HTML (保底)
- **核心 Prompt**: `ANIMATION_SPEC_PROMPT`
- **输出**: 自包含 HTML 动画

### GameGenAgent
- **包装器**: 包装 GameSpecPlannerAgent + GameCompiler
- **Mechanic 支持**: simulation | drag_sort | match_pairs | timeline_order | boss_quiz
- **输出**: 互动游戏 HTML

### ExerciseGenAgent
- **核心 Prompt**: `EXERCISE_GEN_PROMPT`
- **输出**: 选择题 JSON 数组

## 测试验证

运行测试确保修改无误：

```bash
source .venv/bin/activate && python -m pytest tests/ -v -k "lesson" --tb=short
```

## 回滚方案

如需回滚到 qwen，修改 `lesson_generator.py` 第 82 行：

```python
llm = get_llm(provider="qwen", model="qwen3-max", streaming=False)
```

或修改 `~/.systemedu/config.yaml`：

```yaml
llm:
  default: qwen
```
