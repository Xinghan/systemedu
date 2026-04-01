# Claude Code Course Generator

Claude Code 驱动的课程内容生成资源包。包含 prompt 模板、HTML 骨架和参考示例。

## 目录结构

```
claude-code-course-gen/
  prompts/
    plan.md              # Step 1: 分析节点 -> 学习计划 + ideas
    debate.md            # Step 2: idea 辩论（质疑者 vs 辩护者）
    animation.md         # Step 3a: Canvas 动画核心逻辑
    game.md              # Step 3b: DOM 交互游戏核心逻辑
    exercise.md          # Step 3c: 练习题
    integrate.md         # Step 4: 组装 course_content JSON
  templates/
    animation_base.html  # sci-fi 深色 Canvas/SVG 骨架
    game_base.html       # sci-fi 交互游戏骨架
  examples/
    sample_animation.html  # 火星地貌分类动画参考
    sample_game.html       # 火星地貌拖拽匹配参考
```

## 使用方式

手动触发 Claude Code 读取目标节点文件，Claude Code 读取对应 prompt 后自动执行生成流程。

## Pipeline（5 步）

1. **计划 + Idea 提取** — 分析节点 -> 学习计划 markdown + animation/game/exercise ideas
2. **辩论** — 质疑者 vs 辩护者，筛选值得生成的 idea
3. **内容生成** — 每个通过辩论的 idea 分别生成 HTML/JSON
4. **组装** — 拆分 sections + audio_script，组装 course_content JSON
5. **写入 DB** — LessonContent.course_content 字段

## Sci-Fi 视觉规范

- 背景: `#0a0e14` -> `#1a1035` 渐变 + 半透明网格
- 主色: `#00d2ff` (蓝), `#00ff9d` (绿), `#818cf8` (紫)
- 强调色: `#ffd700` (金), `#ff4b2b` (红)
- 发光效果 + 粒子系统 + 贝塞尔曲线
- Animation 画布: 600x420, Game 容器: 600x560
