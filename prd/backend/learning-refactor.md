# 课程生成 v2 - 后端 PRD

## 概述

课程生成 v2 是对原有 LessonPlanner/TeacherAgent/StudentAgent 三段式流水线的完全重写。核心目标是生成多媒体富文本学习内容，而非纯文本课程。

**状态**: 已上线 (2026-03-27)

---

## 架构

### 入口函数

```
src/systemedu/education/lesson_generator.py
generate_course_v2(project_name, knode_id, progress_cb=None)
```

`progress_cb(event, data)` 用于 SSE 向前端推送进度，事件类型：
- `planning_start` / `ideating_start` / `detailing_start` / `generating_start`
- `assignment_start` / `audio_ready` / `done` / `error`

### 7步流水线

```
Step 1  CoursePlannerAgent.plan_detailed()
        → plan_markdown (800-1500字 Markdown，<1600字自动扩写)

Step 2  CourseIdeaAgent.identify()
        → 修改后的 plan_markdown（含 [[IDEA:uuid]] 占位符）
        → ideas 列表 (3-6个，包含 idea_id/mode/style_key/topic/context_summary)

Step 3  CourseIdeaDetailAgent.elaborate() [N ideas 并行]
        → 每个 idea 得到 detail_plan (JSON)
        内部 3 节点管道:
          PlannerAgent → detail_plan 初稿
          CriticAgent  → 评分 (complexity_score + persuasion_score)
          SimplifierAgent → 简化/fallback

Step 4  媒体生成 [N ideas 并行]
        → animation → AnimationGenAgent → SVG+CSS HTML
        → game      → GameGenAgent     → 模拟实验 HTML
        → story     → StoryGenAgent    → [{text, image_url}]

Step 5  IntegrationAgent.integrate()
        → CourseContent {plan_markdown, ideas, rendered_sections}

Step 6  AssignmentAgent
        → project_assignment (Markdown 文本)
        事件: assignment_start 在生成前发送

Step 6a CourseSegmentAgent.segment()
        → sections 列表 [{section_id, heading, body_markdown, audio_script, audio_url}]

Step 6b TTS 合成 [M sections 并行]
        → 每段调用 DashScope qwen3-tts-flash
        → 音频存 SYSTEMEDU_HOME/media/{project}/{knode_id}/section_{id[:8]}.wav
        事件: audio_ready 在全部完成后发送

Step 7  DB 保存
        → LessonContent(course_content=..., project_assignment=...)
```

---

## 数据结构

### CourseContent（存储于 LessonContent.course_content，JSON 字符串）

```json
{
  "plan_markdown": "## 学习目标\n...",
  "sections": [
    {
      "section_id": "uuid",
      "heading": "学习目标",
      "body_markdown": "...",
      "audio_script": "今天我们来学习...",
      "audio_url": "project-name/0/section_abc12345.wav"
    }
  ],
  "ideas": [
    {
      "idea_id": "uuid",
      "mode": "animation",
      "style_key": "edu_soft_tech",
      "topic": "知识点名称",
      "context_summary": "该知识点的上下文(30-50字)",
      "mode_reason": "为什么选这个mode",
      "generation_backend": "manim"
    }
  ],
  "rendered_sections": {
    "uuid": {
      "mode": "animation",
      "status": "ready",
      "html": "<!DOCTYPE html>...",
      "story_paragraphs": null,
      "generation_backend": "manim"
    }
  }
}
```

### API 响应 (GET /course/v2)

```json
{
  "project_name": "project-name",
  "knode_id": 0,
  "status": "ready",
  "course_content": { ...CourseContent... }
}
```

---

## Agent 文件清单

| 文件 | 职责 |
|------|------|
| `src/systemedu/agents/builtin/course_planner.py` | Step 1：详细学习计划 |
| `src/systemedu/agents/builtin/course_idea_agent.py` | Step 2：富媒体知识点识别 |
| `src/systemedu/agents/builtin/course_idea_detail_agent.py` | Step 3 协调器 |
| `src/systemedu/agents/builtin/course_idea_detail_planner_agent.py` | Step 3 规划子节点 |
| `src/systemedu/agents/builtin/course_idea_detail_critic_agent.py` | Step 3 评审子节点 |
| `src/systemedu/agents/builtin/course_idea_detail_simplifier_agent.py` | Step 3 简化子节点 |
| `src/systemedu/agents/builtin/animation_gen_agent.py` | Step 4 动画生成 |
| `src/systemedu/agents/builtin/manim_gen_agent.py` | Step 4 Manim 数学动画 |
| `src/systemedu/agents/builtin/animation_backend_router_agent.py` | Step 4 动画后端路由 |
| `src/systemedu/agents/builtin/game_gen_agent.py` | Step 4 模拟游戏生成 |
| `src/systemedu/agents/builtin/story_gen_agent.py` | Step 4 图文故事生成 |
| `src/systemedu/agents/builtin/integration_agent.py` | Step 5 内容整合 |
| `src/systemedu/agents/builtin/course_segment_agent.py` | Step 6a 分段 + TTS稿 |
| `src/systemedu/agents/builtin/scientific_model_agent.py` | 理科节点科学约束预提取（P2） |
| `src/systemedu/agents/builtin/media_art_direction.py` | 风格系统、质量评估、简化工具、KaTeX 注入 |
| `src/systemedu/education/tts.py` | Step 6b TTS 合成 (DashScope) |
| `src/systemedu/education/image_gen.py` | 故事图片生成 (DashScope Wanx) |
| `src/systemedu/education/lesson_generator.py` | 主协调入口 |

---

## 质量保障

### Critic 评分维度（CourseIdeaDetailCriticAgent）

**complexity_score**（复杂度，越高越简洁，通过线 72）：
- 动画：帧数>6 (-20)、视觉元素>20 (-20)、beats>6 (-15)、safe_area_fill<0.55 (-8)
- 游戏：params>3 (-25)、flow步骤>4 (-15)、storyboard>3 (-10)
- 故事：段落>4 (-15)、单段>180字 (-6)

**persuasion_score**（说服力，越高越有教学主张，通过线 65）：
- 缺少 persuasion 字段 (-35)
- persuasion 信息不足 (-20)

**降级策略**：
1. 不通过 → Planner.revise() 修改
2. 修改后仍不通过 → Simplifier.fallback() 确定性备选方案

### 动画 HTML 质量评分（AnimationGenAgent）

检查项：SVG 存在、@keyframes、transform、opacity、gradient、defs、postMessage 完备性，焦点元素 ≥ 220×120px。综合评分 ≥ 72 通过，否则触发 ANIMATION_REPAIR_PROMPT 修复，修复后仍不通过使用确定性 fallback 模板。

---

## 媒体风格系统（media_art_direction.py）

| style_key | 风格名 | 主色 | 字体 |
|-----------|--------|------|------|
| `edu_soft_tech` | 教育科技感 | #1d4ed8 蓝 | Noto Sans SC + Nunito |
| `concept_lab_clean` | 实验室洁净感 | #0891b2 深青 | Noto Sans SC + Rubik |
| `storybook_vivid` | 故事书生动感 | #d97706 琥珀 | Noto Serif SC + Nunito |

---

## API 端点

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:name/nodes/:id/course/v2` | 获取 v2 课程内容 |
| POST | `/api/projects/:name/nodes/:id/course/v2/generate` | 触发生成（SSE 流式进度） |
| GET | `/api/media/:path` | 获取媒体文件（TTS 音频、生成图片） |

---

## OpenMAIC 借鉴改进（已完成）

### KaTeX 数学公式渲染（2026-03-27）
- `media_art_direction.py` 新增 `inject_katex_if_needed(html)` 后处理函数
- 检测 LaTeX 标记（`\(`, `\[`, `$`, `\frac`, `\int` 等），自动注入 KaTeX CDN
- `KATEX_PROMPT_HINT` 常量注入到动画/游戏生成 prompt，引导 LLM 使用 KaTeX 语法写公式
- 零成本设计：无 LaTeX 标记时不注入任何代码

### P1 游戏机制选择去硬编码（2026-03-27）
- 重写 `GAME_DETAIL_PROMPT`，加入 5 种机制的选择规则和示例
- `GameGenAgent` 从 `detail_plan["game_mechanic"]` 读取 LLM 决策，不再硬编码 `simulation`
- 支持：`simulation`、`drag_sort`、`match_pairs`、`timeline_order`、`boss_quiz`
- 未知机制 fallback 到 `simulation` 并输出 warning 日志

### P2 ScientificModelAgent 科学约束预提取（2026-03-27）
- 新建 `scientific_model_agent.py`
- 理科节点（physics/chemistry/math/biology 等 9 类 + 关键词检测）在生成前先提取：
  - `core_formulas`：关键公式（LaTeX 格式）
  - `key_mechanisms`：核心工作原理（2-3 条）
  - `visual_constraints`：视觉呈现约束
  - `common_misconceptions`：常见错误认知（不得强化）
  - `forbidden_errors`：绝对禁止的科学错误
  - `suggested_variables`：适合做滑块的参数（game 模式）
- 集成到 `AnimationGenAgent` 和 `GameGenAgent` 的 prompt 构建流程
- 非致命设计：`extract()` 失败返回 `None`，生成流程正常继续

---

## 已知问题 / 待优化

- [ ] AnimationGenAgent 当前强制走 Manim（临时测试模式），正式版应恢复路由逻辑
- [ ] StoryGenAgent 图片生成串行（避免速率限制 2req/s），可考虑动态并发
- [ ] CourseSegmentAgent 分段依赖 `##` 标题，对无标题的 plan_markdown 效果较差
- [ ] TTS 音频路径目前为相对路径，前端通过 `/api/media/` 代理访问
- [ ] 作业（Assignment）目前为纯 Markdown 文本，待重构为结构化 JSON 支持前端交互答题
