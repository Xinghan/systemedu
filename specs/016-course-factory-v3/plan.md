# Plan 016 — Course Factory v3 实现方案

## 1. 模块拓扑

```
src/systemedu/course_factory_v3/
├── __init__.py                   # 仅暴露 generate_course_v3, GenerateOptions
├── pipeline.py                   # 主编排器:12 步状态机 + SSE + revise loop
├── progress.py                   # SSE 事件类型 (TypedDict / dataclass)
├── kimi_client.py                # 统一 LLM 客户端 (复用 core.llm_client.get_llm)
│                                  # streaming + 429 重试 + 失败转储
├── theme_loader.py               # 解析 theme_style/themes.js → 26 个 dict
│                                  # + theme_style/subjects-deep.js → 学科映射
│                                  # 不依赖 V8,用正则提取 JS 字面量
│
├── steps/                        # 一步一文件,单一职责
│   ├── s00_boot.py               # load_knode_context + 开工声明 event
│   ├── s05_research.py           # Tavily (factory.research_knode)
│   ├── s07_labxchange.py         # factory.search_labxchange_for_knode
│   ├── s10_plan.py               # plan_markdown LLM
│   ├── s15_theory.py             # theories + level_bodies (LLM,并行)
│   ├── s20_ideation.py           # 8 类 debate (LLM)
│   ├── s25_divergence.py         # 3 方案发散 (LLM)
│   ├── s26_creativity_gate.py    # 4 问 (LLM)
│   ├── s30_detail.py             # detail_plan (LLM,并行)
│   ├── s40_debate.py             # 决策 reject/approve/revise (LLM)
│   ├── s50_implement_anim.py     # animation HTML (LLM)
│   ├── s50_implement_game.py     # game HTML (LLM)
│   ├── s50_implement_exercise.py # make_exercises (无 LLM,从 detail_plan 抽)
│   ├── s50_implement_story.py
│   ├── s50_implement_image.py    # download_course_image (无 LLM)
│   ├── s50_implement_diagram.py  # SVG/HTML (LLM)
│   ├── s50_implement_kit.py      # hands_on_kit (LLM)
│   ├── s60_assemble.py           # make_course_content + preflight + upsert_lesson
│   ├── s65_assignment.py         # factory.generate_assignment + upsert
│   └── s66_audio.py              # factory.generate_audio_scripts
│
├── gates/                        # Step 5.5 六道闸门,每个有统一接口
│   ├── base.py                   # GateResult / Gate ABC
│   ├── g_a_code_review.py        # 5.5a 静态正则 (无 LLM)
│   ├── g_b_browser_verify.py     # 5.5b 子进程 verify/animation.mjs / game.mjs
│   ├── g_c_science.py            # 5.5c LLM agent
│   ├── g_d_theory_grader.py      # 5.5d LLM agent (跨 level)
│   ├── g_e_game_aesthetic.py     # 5.5e LLM agent
│   └── g_f_text_overlap.py       # 5.5f 截图 (5.5b 副产物) + LLM agent
│
├── revise.py                     # 闸门反馈 → 上一步 LLM 重新生成
│                                  # 提供统一 revise(step, original, issues) 接口
│
└── prompts/                      # 所有 prompt 集中
    ├── plan.md
    ├── theory_pick.md            # 1.5a 选 2-5 个理论
    ├── theory_body.md            # 1.5b 写每个 level
    ├── ideation_8class_debate.md
    ├── divergence_3pattern.md
    ├── creativity_4q.md
    ├── detail_anim.md
    ├── detail_game.md
    ├── detail_exercise.md
    ├── debate_decide.md
    ├── implement_anim.md         # ← theme_style 注入入口
    ├── implement_game.md         # ← theme_style 注入入口
    ├── implement_diagram.md
    ├── implement_kit.md
    ├── revise_anim.md
    ├── revise_game.md
    ├── revise_theory.md
    ├── gate_science.md
    ├── gate_theory_grader.md
    ├── gate_game_aesthetic.md
    └── gate_text_overlap.md
```

每个 step 文件暴露 `async run(ctx, ...) -> StepResult`，pipeline.py 串起来。

## 2. 12 步状态机执行序

```
generate_course_v3(project, knode_id, *, regenerate, progress_cb)
  ↓
ctx = boot()                                          # Step 0
research = run_research()    # 0.5 Tavily (用户传 skip 可跳)
lx = run_labxchange()        # 0.7 (允许空)
plan = run_plan(retry≤2)     # Step 1, 自检失败重写
theories = run_theory(retry≤2) # Step 1.5, 8 项硬规
ideas_raw = run_ideation()   # Step 2, 8 类 debate
for idea in anim/game:
    cands = run_divergence(idea, retry≤2)  # 2.5
    chosen, gate_pass = run_creativity_gate(idea, retry≤2)  # 2.6, 失败回 2.5
ideas = await gather(run_detail(i) for i in ideas)    # Step 3 并行
ideas_kept = run_debate(ideas)                        # Step 4 决策
results = await gather(run_implement(i) for i in ideas_kept)  # Step 5 并行
for impl in results.anim_or_game:
    impl = run_gate_chain(impl, idea)   # Step 5.5a→b→c→d→e→f
    # 任一 gate fail → revise(impl) → 重跑该 gate(最多 N 次,N 见下表)
course_content = run_assemble(plan, ideas, theories, research, lx)  # Step 6
upsert_lesson(...)
assignment = run_assignment()                         # Step 6.5
sections = run_audio()                                # Step 6.6
emit done
```

## 3. SKILL ↔ v3 完整对齐表

| SKILL Step | 文件 | LLM? | 闸门 | 失败行为 |
|---|---|---|---|---|
| 0 启动 | s00_boot.py | 否 | preflight 字段齐 | 抛 ValueError |
| 0.5 Tavily | s05_research.py | 否 | web ∪ youtube ≥ 1 | 换 query 重试 1 次,仍空则 skip + warn |
| 0.7 LabXchange | s07_labxchange.py | 否 | top_k≥0 | 允许空 |
| 1 plan | s10_plan.py | 是 | 长度 800-1500 + core_question 出现 + 有 hands_on 段 + 有 推荐互动资源 段 | revise ≤ 2 |
| 1.5 theories | s15_theory.py | 是 | 每 theory 有 K1+项目等级 + exercises≥1 | revise ≤ 2 |
| 2 8 类 debate | s20_ideation.py | 是 | 8 行齐 + reject 带理由 + ≥1 keep | revise ≤ 2 |
| 2.5 divergence | s25_divergence.py | 是 | 3 个不同 Pattern | revise ≤ 2 |
| 2.6 4 问 | s26_creativity_gate.py | 是 | 4 问全过 | 回 2.5 ≤ 2 次 |
| 3 detail | s30_detail.py | 是 | 必填字段齐 | revise ≤ 1 |
| 4 debate | s40_debate.py | 是 | reject 带理由 | 直接执行 |
| 5 implement | s50_*.py | 是(anim/game/diagram) / 否(exercise/image) | 长度无上限 | 失败 result=null,继续 |
| 5.5a code review | g_a_code_review.py | 否 | 静态规则全过 | revise ≤ 3 |
| 5.5b browser verify | g_b_browser_verify.py | 否 | exit 0 | revise ≤ 3 |
| 5.5c science | g_c_science.py | 是 | verdict=pass | revise ≤ 2 |
| 5.5d theory grader | g_d_theory_grader.py | 是 | 全 level pass | revise ≤ 2 |
| 5.5e game aesthetic | g_e_game_aesthetic.py | 是 | verdict=pass | revise ≤ 2 |
| 5.5f text overlap | g_f_text_overlap.py | 是 | verdict=pass | revise ≤ 1 |
| 6 assemble | s60_assemble.py | 否 | preflight=[] | 抛错(无法 revise) |
| 6.5 assignment | s65_assignment.py | 是(factory 内) | 非空 | warn |
| 6.6 audio | s66_audio.py | 是(factory 内) | sections 非空 | warn |

**单 idea 闸门最终失败规则**：连续 3 轮（按上表 N）revise 仍失败 → 该 idea `result=null` `status=failed`，整个 knode 仍写入 DB 状态 `ready`。

## 4. theme_style 接入

### 4.1 数据加载

`theme_loader.py` 用正则把 `theme_style/themes.js` 的 `THEMES` 数组解析为 Python list，每条含 id/title/chinese/palette/mascot/props/typeSample。同时解析 `subjects-deep.js` 拿到学科 → subject id 映射，便于按 knode 学科自动选 theme。

### 4.2 prompt 注入

`implement_anim.md` / `implement_game.md` 中插入 `{{THEME_BLOCK}}`，运行时 pipeline 根据 knode.category + theme_loader 选 1 个最匹配的 theme，把 palette 5 色 + mascot + props + typeSample + glow 规则全部注入 prompt。LLM 只能在该 palette 内选色。

### 4.3 旧引用清理

- `media_art_direction.py` 整文件删（含 STYLE_KITS、`get_style_kit`、`style_kit_prompt_block` 等所有导出）
- `animation_game_design/` 目录在 v3 上线后保留作历史档案（不再被任何 prompt 引用），SKILL.md 中 `animation_game_design/<style_key>/DESIGN.md` 的提法 v3 不沿用

## 5. Kimi 客户端

```python
# kimi_client.py
from systemedu.core.llm_client import get_llm
def kimi(streaming=False, max_tokens=None) -> ChatOpenAI:
    return get_llm(provider="kimi", streaming=streaming, max_tokens=max_tokens)
```

config 改动（`~/.systemedu/config.yaml` + `core/config.py` 的 `_default_config_dict`）：

```yaml
llm:
  default: kimi
  providers:
    kimi:
      base_url: https://api.moonshot.cn/v1
      api_key: sk-aeYYpJVY50elAOth4630DP97OXpYXmemKiCcFZH2uIAOYH3J
      model: kimi-k2.6
      temperature: 0.7
      max_tokens: 32768
```

如果 `kimi-k2.6` 直接调 Moonshot API 报 invalid model，自动回退到 `kimi-k2-turbo-preview` 并打 warning（kimi_client.py 内一次性探活）。

## 6. SSE 事件协议（前端契约）

| event | data |
|---|---|
| `boot` | `{project, knode_id, role, overrides}` |
| `step_start` | `{step:"0.5"|"1"|...|"6.6"}` |
| `step_done` | `{step, summary}` |
| `gate_start` | `{step:"5.5a"|...|"5.5f", idea_id}` |
| `gate_pass` | `{step, idea_id, attempt}` |
| `gate_fail` | `{step, idea_id, attempt, issues:[...]}` |
| `revise_start` | `{step, idea_id, attempt}` |
| `idea_complete` | `{idea_id, mode, status:"ready"|"failed"}` |
| `done` | `{status:"ready"}` |
| `error` | `{step, message}` |

## 7. API 路由（前端跟着升）

```
POST   /api/projects/{name}/nodes/{id}/course/v3/generate         同步,返回 course_content
GET    /api/projects/{name}/nodes/{id}/course/v3/stream           SSE
POST   /api/projects/{name}/nodes/{id}/course/v3/cancel
GET    /api/projects/{name}/nodes/{id}/course/v3                  读 cached course_content
GET    /api/projects/{name}/nodes/{id}/course/v3/assignment       读 cached assignment
```

`web/src/lib/api/index.ts` 中 5 处 `/course/v2/...` 全部改 `/course/v3/...`。

## 8. 删除清单（v3 上线后）

```
# Python (v2 流水线 + agent)
src/systemedu/education/lesson_generator.py
src/systemedu/agents/builtin/course_planner.py
src/systemedu/agents/builtin/course_idea_agent.py
src/systemedu/agents/builtin/course_idea_detail_agent.py
src/systemedu/agents/builtin/course_idea_detail_planner_agent.py
src/systemedu/agents/builtin/course_idea_detail_critic_agent.py
src/systemedu/agents/builtin/course_idea_detail_simplifier_agent.py
src/systemedu/agents/builtin/course_idea_reviewer_agent.py
src/systemedu/agents/builtin/course_segment_agent.py
src/systemedu/agents/builtin/animation_gen_agent.py
src/systemedu/agents/builtin/animation_backend_router_agent.py
src/systemedu/agents/builtin/animation_patterns/
src/systemedu/agents/builtin/animation_runtime.js          # 旧拷贝,真品在 course_factory/runtime/
src/systemedu/agents/builtin/animation_spec.py
src/systemedu/agents/builtin/game_gen_agent.py
src/systemedu/agents/builtin/exercise_gen_agent.py
src/systemedu/agents/builtin/story_gen_agent.py
src/systemedu/agents/builtin/manim_gen_agent.py
src/systemedu/agents/builtin/icon_gen_agent.py
src/systemedu/agents/builtin/integration_agent.py
src/systemedu/agents/builtin/debate_agent.py
src/systemedu/agents/builtin/scientific_model_agent.py
src/systemedu/agents/builtin/pattern_router_agent.py
src/systemedu/agents/builtin/revise_agent.py
src/systemedu/agents/builtin/search_agent.py
src/systemedu/agents/builtin/media_art_direction.py        # STYLE_KITS 整套
src/systemedu/education/step_generator.py                  # v1 残留
src/systemedu/education/career_path.py 中如有引用 lesson_generator 的,清理

# 网关旧路由
src/systemedu/gateway/server.py 中 v2 路由 + handler 整段:
  api_generate_course_v2, api_course_v2_stream, api_course_v2_cancel,
  api_get_course_v2, api_get_course_v2_assignment
  及 /api/projects/.../course/v2/... 5 个 Route 注册

# 前端
web/src/lib/api/index.ts 5 处 /course/v2/* → /course/v3/*
```

**保留**：`src/systemedu/agents/{base.py,manager.py,builtin/{tutor.py,assessor.py,planner.py}}` —— 与 tutor / 知识树相关，不在本 spec 范围。

## 9. 测试

| 类型 | 路径 | 内容 |
|---|---|---|
| 单元 | `tests/test_cf_v3_theme_loader.py` | 解析 themes.js → 26 条,subjects-deep.js → 学科映射 |
| 单元 | `tests/test_cf_v3_gates.py` | code_review 正则规则、browser_verify 子进程包装(mock subprocess) |
| 单元 | `tests/test_cf_v3_revise.py` | 闸门 fail → revise → 通过 / 反复 fail → result=failed |
| 集成 | `tests/test_cf_v3_pipeline_e2e.py` | 用 `rocket-design` knode 0 真跑一次,断言 course_content 字段齐 |
| 手测 | restart.sh + UI | 网页触发,SSE 实时显示每步 |

## 10. 影响面

- **DB schema**：无变更（继续用 LessonContent.course_content / project_assignment / status）
- **配置**：`~/.systemedu/config.yaml` 默认 provider 切 kimi（迁移脚本一行）
- **前端**：仅 `web/src/lib/api/index.ts` URL 改后缀；UI 组件不变
- **生产服务器**：`./scripts/deploy.sh` 后需 `systemctl restart systemedu-backend`，无其它操作

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Kimi `kimi-k2.6` 模型名错 | 启动时探活,自动回退并 warn |
| Tavily / LabXchange 网络抖动 | 重试 1 次,允许 skip 但 emit warning event |
| browser verify 慢（每个 anim/game 8-15s） | 并行执行,SSE 显示进度 |
| 多闸门 LLM 累计 token 爆炸 | 闸门 prompt 只传 HTML 关键片段 + idea/theory 摘要,不传整 plan_markdown |
| revise loop 死循环 | 每闸门硬上限 1-3 次,超出标 failed |
| 26 theme 选错 | theme_loader 提供 fallback="space",pipeline 在选不到时打 warn 用默认 |

## 12. 开发顺序（与 tasks.md 对应）

阶段 A：基础设施（不影响现有 v2）
阶段 B：12 步骨架（mock LLM 跑通流程）
阶段 C：6 闸门 + revise loop
阶段 D：theme_style 接入 + Kimi 切换
阶段 E：API + 前端切换
阶段 F：删 v2 死代码 + 端到端验证
阶段 G：与 SKILL.md 逐 Step 对账（用户要求的最终验证步骤）
