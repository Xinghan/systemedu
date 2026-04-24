# Spec 016 — Course Factory v3

Status: draft (2026-04-24)

## WHAT

把网页端"生成课程"流水线 (`POST /api/projects/{name}/nodes/{id}/course/v3/generate`) 重写为 v3，让 API 跑出与 `course_factory/SKILL.md` 手动跑等价的课程内容。

v3 是 `course_factory/SKILL.md` 的**程序化复刻**：一个由 Python 编排的 12 步状态机，每一步等价于 SKILL 中的一个 Step（含 5.5 六道闸门和 2.5/2.6 创意闸门），所有 LLM 调用走 Kimi (`kimi-k2.6`)。

v2 (`src/systemedu/education/lesson_generator.py` + 全部 `agents/builtin/course_*` `*_gen_agent.py`) 整套删除，由新模块 `src/systemedu/course_factory_v3/` 替代。

## WHY

当前 v2 流水线只覆盖了 SKILL 12 个 Step 中的约 4 个，缺了：

- Step 0.5 / 0.7：Tavily + LabXchange 外部资源
- Step 1.5：theories（基础理论标注）
- Step 2 的 8 类富媒体 debate（现在只有 anim/game/story/exercise）
- Step 2.5 / 2.6：3 方案发散 + 创意四问
- Step 4：Debate 决策（代码里写死 DISABLED）
- Step 5.5a-f：六道闸门（科学性、theory 等级、游戏性美观、文字重叠、code review、browser verify）
- Step 6 preflight、Step 6.6 audio_scripts（被禁用）
- 闸门失败 → revise loop（完全不存在）

后果：网页端跑出的课程**质量低于** Claude Code 手动跑 SKILL 的产物，无法替代手工流程。

v3 一次性把 12 步全部接上，并做以下硬切换：

1. LLM 切到 Kimi（Moonshot 平台，OpenAI 兼容 API）
2. anim/game 视觉系统统一用 `theme_style/themes.js`（26 学科 oklch palette，id 含 cs/bio/space/mech/ai/math/med/chem/phys/env/robo/elec/astro/geo/ocean/meteo/paleo/quant/nuke/neuro/mat/micro/zoo/bot/arch/agri；二级学科映射见 `theme_style/subjects-deep.js`），抛弃旧 `media_art_direction.STYLE_KITS` + `animation_game_design/`
3. API 路径升 `/course/v3/*`，前端同步切

## 边界（不动）

- `course_factory/`（factory.py, runtime/, validate/, SKILL.md, tests/, fixtures/）—— 是 v3 调用的工具库
- `theme_style/` —— 是 v3 必须参考的样式 source of truth
- `src/systemedu/tutor/` —— 与课程生成无关
- `src/systemedu/agents/{base,manager,builtin/{tutor,assessor,planner}}.py` —— 知识树 / tutor 用，保留

## 验收标准

1. `POST /api/projects/rocket-design/nodes/0/course/v3/generate` 完整跑通，DB 中产出的 `course_content` 含：
   - `plan_markdown` 800-1500 字 + `> Module:` 引用块 + `core_question` 出现 + 末尾 `## 推荐互动资源`
   - `theories` ≥ 2 项，每项有 K1 + 项目等级的 `level_bodies` 和 `exercises`
   - `external_resources.youtube_results / web_results / labxchange_results` 至少各 1 条
   - `ideas` 含 anim/game/exercise，每条 `hands_on_ref` / `acceptance_ref` 原文匹配
   - `rendered_sections.<id>.html` 通过 `course_factory/validate/verify/animation.mjs` exit 0
   - `sections[].audio_script` 非空
   - `project_assignment` 非空
2. 闸门失败可触发 revise，最多 3 次后单 idea 标记 failed，但 knode 整体仍 status=ready 写入
3. SSE 流 `/course/v3/stream` 实时推送每步 + 每闸门事件，前端能看到完整流程
4. `factory.preflight_v41(knode, course_content)` 返回 `[]`
5. v2 死代码全部删除（`lesson_generator.py` + `agents/builtin/{course_*,animation_*,game_*,exercise_*,story_*,debate_*,integration_*,scientific_model_*,manim_*,icon_*,course_segment_*,course_idea_*,pattern_router_*,revise_*,search_*,media_art_direction,animation_patterns/,animation_runtime.js,animation_spec}.py`），grep `lesson_generator|generate_course_v2|STYLE_KITS|animation_game_design` 全仓 0 命中（test 与 SKILL 历史档案除外）
6. `web/src/lib/api/index.ts` 中 `course/v2` 全部改为 `course/v3`，前端能在 UI 上触发并实时看到进度

## 不在本 spec 范围

- 知识树生成（`tree_generator.py`）—— 独立流程
- 项目封面图、icon 生成 —— 独立流程
- 大作业评分（capstone submit）—— 独立流程
- 多 anim/多 game 同时生成（factory.make_course_content 当前只接 1+1，本 spec 先维持单 anim+单 game 上限，多 anim/game 留 v3.1）

## 参考

- `course_factory/SKILL.md`（v3 的执行手册，权威）
- `theme_style/themes.js` + `index.html`（v3 anim/game 视觉规范）
- `course_factory/factory.py`（v3 的工具函数库）
- `course_factory/validate/verify/{animation,game,learn_page}.mjs`（v3 闸门 5.5b/5.5f 的子进程）
