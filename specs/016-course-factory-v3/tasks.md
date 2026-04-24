# Tasks 016 — Course Factory v3

按阶段顺序执行。每完成一个 task 勾选 `[x]`，commit 一次。

## 阶段 A — 基础设施

- [x] A1 切换 Kimi 配置：`~/.systemedu/config.yaml` + `core/config.py:_default_config_dict()` 把 default→kimi，base_url=`https://api.moonshot.cn/v1`，model=`kimi-k2.6`，key 写入。本地用 `python -c "from systemedu.core.llm_client import get_llm; print(get_llm().invoke('hi').content)"` 探活，404 则改 model 名重试
- [x] A2 新建模块骨架 `src/systemedu/course_factory_v3/` 全部空文件（`__init__.py`、`pipeline.py`、`progress.py`、`kimi_client.py`、`theme_loader.py`、`revise.py`、`steps/`、`gates/`、`prompts/`），每个 step/gate 一个 `async def run(...)` 占位
- [x] A3 写 `theme_loader.py`：用正则解析 `theme_style/themes.js` → 26 条 dict，写测试 `tests/test_cf_v3_theme_loader.py` 断言 26 条 + 关键字段齐
- [x] A4 写 `kimi_client.py`：薄封装 `core.llm_client.get_llm`，加 429 退避（最多 3 次）+ 失败转储到 `~/.systemedu/logs/kimi_failures/`
- [x] A5 写 `progress.py` + `pipeline.py` 主循环骨架（每步 emit step_start/step_done，全部步骤 mock 返回固定值），用单元测试跑通 SSE 流

## 阶段 B — 12 步骨架（用 LLM，但暂不接闸门）

- [x] B1 `s00_boot.py`：调 `factory.load_knode_context(project, idx)`，emit boot event，返回 `BootContext{knode, milestone, sub_project, project, knowledge_level, category}`
- [x] B2 `s05_research.py`：调 `factory.research_knode`，web_query / youtube_query 由 LLM 从 knode.core_question 抽取（一个 mini prompt），失败一次后 skip
- [x] B3 `s07_labxchange.py`：调 `factory.search_labxchange_for_knode(knode, top_k=3)`
- [x] B4 `s10_plan.py` + `prompts/plan.md`：用 v4.1 全字段 + Module 引用块 + core_question 占位 + 末尾"## 推荐互动资源"。生成后做 4 项硬规自检（长度/core_question/hands_on/末段），失败由 revise 重生
- [x] B5 `s15_theory.py` + `prompts/theory_pick.md` + `prompts/theory_body.md`：先选 2-5 个 theory_id，再并行为每个生成 K1+项目等级的 level_bodies 和 1-3 道 exercises。`[[THEORY:xxx]]` 占位符插回 plan_markdown
- [x] B6 `s20_ideation.py` + `prompts/ideation_8class_debate.md`：强制 8 类（theory/anim/game/kit/image/diagram/youtube/labxchange）逐条 keep/reject + 理由，输出 ideas 列表（含 hands_on_ref / acceptance_ref 原文）
- [x] B7 `s25_divergence.py` + `prompts/divergence_3pattern.md`：每个 anim/game 给 3 个跨 Pattern 候选 + pitch + why cool + 选 1 拒 2 的理由
- [x] B8 `s26_creativity_gate.py` + `prompts/creativity_4q.md`：4 问 Subtract/Replay/Surprise/Aha，全过才放行，否则回 s25 ≤ 2 次
- [x] B9 `s30_detail.py` + `prompts/detail_{anim,game,exercise,...}.md`：并行为每 idea 写 detail_plan，hands_on_ref / acceptance_ref 透传
- [x] B10 `s40_debate.py` + `prompts/debate_decide.md`：每 idea approve/reject/revise（Pattern X 的 game 必须改写或 reject）
- [x] B11 `s50_implement_anim.py` + `prompts/implement_anim.md`：注入 theme_style 当前 theme 的 5 色 palette + mascot + props + skeleton 模板路径 + animation_runtime API。LLM 输出完整 HTML
- [x] B12 `s50_implement_game.py` + `prompts/implement_game.md`：注入 theme + Game 标准布局模板（sidebar / game-main） + Pattern 库 + 长度无上限提示
- [x] B13 `s50_implement_exercise.py`：从 detail_plan.exercises 调 `factory.make_exercises`
- [x] B14 `s50_implement_image.py`：调 `factory.download_course_image`
- [x] B15 `s50_implement_diagram.py` + `prompts/implement_diagram.md`：HTML/SVG 静态示意图
- [x] B16 `s50_implement_kit.py` + `prompts/implement_kit.md`：套件元器件 / 步骤 / 价格 / 安全
- [x] B17 `s50_implement_story.py`：直接 LLM 生 paragraphs
- [x] B18 `s60_assemble.py`：调 `factory.make_course_content(knode=..., research=..., labxchange_results=..., theories=..., images=..., diagrams=..., hands_on_kits=..., animation_html=..., game_html=..., exercises=...)` 一次性组装+preflight；用 `factory.upsert_lesson` 写入
- [x] B19 `s65_assignment.py`：调 `factory.generate_assignment` + `factory.upsert_assignment`
- [x] B20 `s66_audio.py`：调 `factory.generate_audio_scripts`
- [ ] B21 用 `rocket-design` knode 0 端到端跑一次（无闸门），DB 中能看到 v3 写入的 cf 记录，前端 `/learn/rocket-design?node=0` 能渲染

## 阶段 C — 闸门 + revise

- [x] C1 `gates/base.py`：`@dataclass GateResult(verdict:Literal["pass","fail"], issues:list[str], attempt:int)`，`Gate(ABC).run(context, html, idea) -> GateResult`
- [x] C2 `g_a_code_review.py`：纯正则检测 onclick属性 / setInterval / calc(100vh-N) / window 同名变量 / `Math.min(...,<480)` / position:fixed for lang-btn
- [x] C3 `g_b_browser_verify.py`：`asyncio.create_subprocess_exec("node", "course_factory/validate/verify/animation.mjs", html_path, "--out", tmp)`，捕 exit code + stdout JSON
- [x] C4 `g_c_science.py` + `prompts/gate_science.md`：科学一致性 LLM agent
- [x] C5 `g_d_theory_grader.py` + `prompts/gate_theory_grader.md`：每 theory 一次调用，跨 level 评判
- [x] C6 `g_e_game_aesthetic.py` + `prompts/gate_game_aesthetic.md`：游戏性 + 美观 + Pattern 真实性
- [x] C7 `g_f_text_overlap.py` + `prompts/gate_text_overlap.md`：用 5.5b 截图 + LLM agent 看图判断重叠
- [x] C8 `revise.py`：`async def revise(step_name, original, gate_issues, ctx) -> new_artifact`，按 step 加载对应 `revise_*.md` prompt
- [x] C9 pipeline 接入闸门链：anim 跑 a→b→c→f；game 跑 a→b→c→e→f；theory 跑 d；任一 fail → revise → 再跑（按表中 N），仍 fail → idea status=failed continue
- [ ] C10 单元测试 `tests/test_cf_v3_gates.py` + `tests/test_cf_v3_revise.py`

## 阶段 D — 网关 + 前端切换

- [ ] D1 `src/systemedu/gateway/server.py` 新增 5 个 v3 handler + Route，复用 v2 已有的 `LessonContent` 缓存逻辑、SSE 框架（_generation_tasks dict + queue）
- [ ] D2 v3 调用入口：`from systemedu.course_factory_v3 import generate_course_v3`
- [ ] D3 `web/src/lib/api/index.ts` 5 处 `/course/v2/*` → `/course/v3/*`
- [ ] D4 前端 `web/src/components/learning/` 中如有处理 SSE 事件类型的代码，扩展支持新 event（gate_start/pass/fail, revise_start）
- [ ] D5 `./scripts/restart.sh` 后端 + 前端，UI 触发"生成"按钮，SSE 实时显示

## 阶段 E — 删 v2 死代码

- [ ] E1 删 `src/systemedu/education/lesson_generator.py` 与 `step_generator.py`
- [ ] E2 删 plan.md §8 列出的 `agents/builtin/*.py` 全套（22 个文件 + animation_patterns/ 目录）
- [ ] E3 删 `gateway/server.py` 中 v2 handler + 5 个 Route
- [ ] E4 全仓 grep 确认 0 命中：`lesson_generator | generate_course_v2 | STYLE_KITS | media_art_direction | animation_game_design | course_idea_agent | animation_gen_agent | game_gen_agent`（test fixture 与 SKILL.md 历史档案除外）
- [ ] E5 `python -m pytest tests/ -v` 全绿

## 阶段 F — 与 SKILL.md 逐条对账（用户要求，超细粒度）

不动代码。对照 SKILL.md 全 2431 行**每一行硬规则**做最终对账。每条 PASS/GAP/N/A，GAP 必须当场补 prompt 或加闸门校验。最后一项 F-final 写汇总报告。

> 操作方式：每个对账项都要落地到 v3 的具体文件路径 + 行号 + 验证方式（grep / 单元测试 / 实际生成产物的 JSON 字段断言）。**不允许"我看了一眼觉得 OK"**。

### F.0 启动协议（SKILL §13-43）

- [ ] F.0.1 v3 SSE 首事件 `boot` 是否含 12 步清单 / project_name / knode_global_idx / module_role / user overrides？验证：手测一次 generate，截 SSE 流前 3 个 event
- [ ] F.0.2 每完成一步是否 emit `step_done` 事件（SKILL "每完成一步必须宣布"等价物）？
- [ ] F.0.3 跳步是否抛错？验证：在 pipeline 注入跳过 step 1.5，断言抛 StepSkipError

### F.1 五条铁律（SKILL §45-51）

- [ ] F.1.1 **顺序铁律**：pipeline.py 中步骤顺序严格 0→0.5→0.7→1→1.5→2→2.5→2.6→3→4→5→5.5→6→6.5→6.6，写单元测试用 spy 记录调用序
- [ ] F.1.2 **5.5 闸门铁律**：5.5b browser verify + 6.0 preflight 任一失败禁止 upsert_lesson。验证：mock 5.5b 返回 fail，断言 LessonContent 表无新行
- [ ] F.1.3 **acceptance_ref 原文匹配**：preflight_v41 已校验，再加 prompt 层显式 "必须复制原文含末尾句号"
- [ ] F.1.4 **不预合并 Tavily**：s10_plan.py 生成的 plan_markdown 不允许出现 `## 推荐视频` 或 `## 延伸阅读`（grep 断言）；assemble 阶段由 make_course_content 自动追加
- [ ] F.1.5 **8 类逐条 debate**：s20_ideation.py 输出必须包含 8 个 mode 的 keep/reject 行，断言 `len(decisions) == 8`

### F.2 富媒体 8 类完整产物（SKILL §97-110）

- [ ] F.2.1 **theory**：s15 ≥2 个（capstone/纯方法论除外），每个含 K1+项目等级 level_bodies + 1-3 道 exercises；plan_markdown 含 `[[THEORY:xxx]]` 占位
- [ ] F.2.2 **animation**：implement step 跑通，rendered_sections 含 html
- [ ] F.2.3 **game**：同上
- [ ] F.2.4 **hands_on_kit**：implement_kit.md prompt 含价格指引表 + 独立 `## 实物操作与购买` 模块要求 + 中国产元器件优先 + 价格判断字符串
- [ ] F.2.5 **image**：download_course_image 调通，CC-BY/CC0 来源校验
- [ ] F.2.6 **diagram**：HTML/SVG 静态产物
- [ ] F.2.7 **youtube**：external_resources.youtube_results 至少 1 条（除非 Tavily 真返空）
- [ ] F.2.8 **labxchange**：external_resources.labxchange_results 至少 1 条（除非学科真不匹配）

### F.3 hands_on_kit 价格指引（SKILL §114-126）

- [ ] F.3.1 prompt 列出 5 档区间表（<50/50-200/200-500/500-2000/>2000）
- [ ] F.3.2 ≥500 元的套件必须附"简化替代方案"，prompt 显式要求
- [ ] F.3.3 元器件优先中国产 — prompt 显式
- [ ] F.3.4 `total_cost_cny` 字段非空，单元测试断言

### F.4 hands_on_kit plan_markdown 位置（SKILL §128-138）

- [ ] F.4.1 `[[IDEA:kit_xxx]]` 必须放在独立 `## 实物操作与购买` 段下，位于正文之后、`## 推荐互动资源` 之前 — assemble 后 grep 断言

### F.5 v4.1 字段全消费（SKILL §250-290）

- [ ] F.5.1 `module_id` → plan_markdown 顶部 `> Module: ... · ...` 引用块
- [ ] F.5.2 `module_role` → s20 ideation 数量决策、s10 capstone 分支
- [ ] F.5.3 `core_question` → s10 引入段强制出现，preflight 校验
- [ ] F.5.4 `hands_on_components` → s10 应用段 + s20 至少一个 idea 覆盖
- [ ] F.5.5 `acceptance_artifacts` → s20 exercise 出题方向 + s10 应用段
- [ ] F.5.6 `acceptance_standard` → s10 学习目标段一一对应
- [ ] F.5.7 `outputs_produced` → s10 末尾"学习路径建议"段 handover
- [ ] F.5.8 `sub_project.brief` → plan_markdown 顶部上下文帽子
- [ ] F.5.9 `sub_project.core_problem` → s10 引入段背景锚定
- [ ] F.5.10 `sub_project.task` → 同上
- [ ] F.5.11 `sub_project.deliverables` → s20 exercise 推进目标

### F.6 plan_markdown 格式（SKILL §549-634）

- [ ] F.6.1 7 个标准段齐全：学习目标 / 引入 / 核心概念 / 深入理解 / 应用与拓展 / 推荐互动资源 / 学习路径建议
- [ ] F.6.2 学习目标"能够..."开头，每条对应 acceptance_standard 或 hands_on_components
- [ ] F.6.3 字数 800-1500（grep 字符数断言）
- [ ] F.6.4 数学公式用 LaTeX `\(...\)`
- [ ] F.6.5 module_role=foundation/core/deepening/synthesis/capstone 写作侧重不同 — prompt 分支
- [ ] F.6.6 外部资源全用 `{{KEY}}` shortcode，**禁止硬编码 URL**：grep `https://` 在 plan_markdown 中应为 0
- [ ] F.6.7 EXTERNAL_RESOURCE_URLS 注册表中已存在的 KEY 列表（ai4mars/curiosity_raw/hirise/pds_imaging 等 8 项）prompt 中说明可用

### F.7 capstone 节点特殊分支（SKILL §637-718）

- [ ] F.7.1 s10_plan.py 检测 `module_role == "capstone"`，切换到大作业模板
- [ ] F.7.2 大作业模板含：项目背景 / 交付物清单（表格）/ 制作步骤 / 评分标准（表格）/ 提交说明 / 参考资料
- [ ] F.7.3 capstone 富媒体策略表：theory=0 / exercise=0 / animation=1 引导 / game=1 可选 / youtube=0 / labxchange=0 — pipeline 实现该开关

### F.8 Step 1.5 theory 等级（SKILL §722-949）

- [ ] F.8.1 theory_id 格式 `theory_{学科缩写}_{关键词}`
- [ ] F.8.2 `level_bodies` 至少 2 个等级（K1 必选 + 项目 knowledge_level）
- [ ] F.8.3 K1：零公式零字母，6 岁能读懂 — gate 5.5d 检测
- [ ] F.8.4 K2：简单四则运算，无希腊字母上下标
- [ ] F.8.5 K3：代数公式必带符号说明，无三角函数
- [ ] F.8.6 K4：三角函数 / 向量 / 受力分析 / 概率统计 / 指对数 至少一项
- [ ] F.8.7 K5：微积分 / 线代 / 微分方程 / 学术论述 至少一项
- [ ] F.8.8 每等级先解释概念本身（用 2+ 类比+例子）再关联项目 — prompt + 5.5d 检测
- [ ] F.8.9 `body_markdown` 顶层字段 = K1 版本（向后兼容）
- [ ] F.8.10 `tags` 数组 1-3 条，格式 `一级/二级/三级` kebab-case
- [ ] F.8.11 `theory_tags.json` 归一化（factory 已实现，确认透传 project_name）
- [ ] F.8.12 每 theory 1-3 道选择题，4 选项无"以上都对"，含 explanation
- [ ] F.8.13 数量 2-5 个（纯方法论节点允许 0 但需写理由）
- [ ] F.8.14 `[[THEORY:xxx]]` 插在概念**第一次出现**的段落末尾，不重复
- [ ] F.8.15 Theory Animation 浅色 Cognitive Sanctuary 主题（独立 prompt，不用 animation_runtime.js）
  - 配色：#f8f5ff/#f1efff bg, #6a1cf6 主, #b41340 阻力, #006859 支持力
  - 字体：Plus Jakarta Sans + Inter + Manrope
  - 毛玻璃公式面板右上角
- [ ] F.8.16 适合加 animation 的 theory 类型（力学/坐标/波动/化学反应）— prompt 列出
- [ ] F.8.17 不适合的（纯定义/纯文字/过抽象）— prompt 列出

### F.9 Step 2 ideas 抽取（SKILL §952-1209）

- [ ] F.9.1 exercise 必有 ≥1 个
- [ ] F.9.2 exercise 题目必可追溯到 acceptance_standard 或 hands_on_components
- [ ] F.9.3 至少一个 idea 覆盖 hands_on_components
- [ ] F.9.4 game 的 game_concept 必映射到 acceptance_artifacts 或 hands_on 动作
- [ ] F.9.5 idea_id 格式 `{mode}_{timestamp}_{4位随机字母}`
- [ ] F.9.6 每 idea 含 `hands_on_ref` + `acceptance_ref`，原文匹配（含末尾句号）
- [ ] F.9.7 `mode_reason` 格式 `Pattern {N} ({name}): {why}`（game 强制）
- [ ] F.9.8 game/animation 的 topic 禁止使用项目外题材 — prompt 强调
- [ ] F.9.9 富媒体优先级：game > animation > story（只选 1 个时优先 game）

### F.10 Game 10 Patterns（SKILL §1000-1107）

- [ ] F.10.1 implement_game.md 完整列出 Pattern 1-10（Sandbox/Build&Test/Causal Chain/Resource/Detective/Live Tuning/Strategy Map/Visual Programming/Experimental Design/Role-Play）每条含适合知识点 + 反例
- [ ] F.10.2 Pattern X 降级规则：必须显式说明"本质就是分类"才允许，且加"活化"机制
- [ ] F.10.3 Pattern 选择流程 4 步写到 prompt
- [ ] F.10.4 Debate 强制 game 专项问"是否动态系统操纵"
- [ ] F.10.5 game 不能落入 Pattern X 且非分类本质 → reject 或 revise（s40 实现）

### F.11 Step 2.5 Ideation Divergence（SKILL §1110-1123）

- [ ] F.11.1 每 anim/game 必出 3 个跨不同 Pattern（game）/ 3 种呈现模式（anim）候选
- [ ] F.11.2 每候选 2-3 句 pitch 含：玩家做什么 / 屏幕看到什么 / why this is cool
- [ ] F.11.3 三个方案"真的不同"（prompt 强调，gate 检测 Pattern 是否重复）
- [ ] F.11.4 必写"选这个 reject 另两个的理由"

### F.12 Step 2.6 Creativity Gate（SKILL §1124-1137）

- [ ] F.12.1 Subtract test：核心元素去掉是否还能玩
- [ ] F.12.2 Replay test：玩完是否会"再来一次"
- [ ] F.12.3 Surprise test：是否有超出预期的涌现机制
- [ ] F.12.4 Aha test：能写出"原来如此"那一刻
- [ ] F.12.5 任一失败回 2.5 重新发散（最多 2 次）

### F.13 Image / Diagram 替代或补充（SKILL §1139-1144）

- [ ] F.13.1 image：CC-BY/CC0 来源（NASA/JPL/ESA/USGS/Wikimedia），含 source_url + license
- [ ] F.13.2 diagram：HTML/SVG 静态，深色或浅色主题
- [ ] F.13.3 推荐组合 d=1 概念类：1 image + 1 game + 1 exercise — prompt 列入

### F.14 theme_style 26 主题（替换 SKILL §1146-1160 的 10 个 STYLE_KITS）

- [ ] F.14.1 implement_anim.md / implement_game.md 不再引用 STYLE_KITS / animation_game_design/ — grep 断言 0
- [ ] F.14.2 注入的 theme 来自 theme_style/themes.js 的 26 项之一
- [ ] F.14.3 theme 选择策略：根据 knode.category + subjects-deep.js 映射 → 1 个 theme id
- [ ] F.14.4 prompt 注入 5 色 palette + mascot + props + typeSample
- [ ] F.14.5 选不到时 fallback 到 `space`，emit warning

### F.15 Step 3 detail_plan（SKILL §1214-1353）

- [ ] F.15.1 anim detail_plan 必含：style_key / title / frame_count(4-6) / layout / asset_plan / persuasion / beats / frames / animation_type / user_guide
- [ ] F.15.2 anim.persuasion.learning_claim 必回答 core_question
- [ ] F.15.3 anim.user_guide.takeaway 指向 acceptance_ref
- [ ] F.15.4 game detail_plan 必含：style_key / game_mechanic / mechanic_reason / game_concept / game_title / visual_focus / visual_storyboard / persuasion / interaction_flow / win_condition / difficulty_hint / simulation_params / scene_description / user_guide
- [ ] F.15.5 game.game_concept 把 hands_on_ref 转化为玩法操作
- [ ] F.15.6 exercise 4 道选择题渐进，每题 explanation 50-100 字 + ref 字段绑定 hands_on_ref
- [ ] F.15.7 干扰项有教学意义（反映常见误解）

### F.16 Step 4 Debate（SKILL §1357-1391）

- [ ] F.16.1 每 idea 正反辩论：教学价值 / 可行性
- [ ] F.16.2 game 专项 4 问：是否 Pattern X 变装 / 能否改 Pattern 1-10 / 操纵动态系统还是选答案 / 不知答案能否开始游戏
- [ ] F.16.3 reject 行为：从 ideas 移除 + 删 plan_markdown 中占位符
- [ ] F.16.4 revise 行为：修改 detail_plan
- [ ] F.16.5 教学逻辑错误 / 100vh 内布不下 / 纯文字够 / game 是 exercise 变装 → reject

### F.17 Step 5 通用 HTML 硬约束 19 条（SKILL §1404-1428）

- [ ] F.17.1 单文件自包含 `<!DOCTYPE html>` 到 `</html>` — gate 5.5a grep
- [ ] F.17.2 `body { overflow:hidden; height:100vh; margin:0; padding:0 }` — 5.5a 正则
- [ ] F.17.3 一屏内布局，无垂直滚动 — 5.5b verify 检测
- [ ] F.17.4 深色主题背景（除 theory animation） — 5.5e 视觉检
- [ ] F.17.5 字体 Space Grotesk + Inter/Noto Sans SC — 5.5a grep
- [ ] F.17.6 可用 Google Fonts CDN — prompt 允许
- [ ] F.17.7 0px 圆角全部元素 — 5.5a grep `border-radius:0`
- [ ] F.17.8 禁止纯色平涂，必须渐变 — 5.5e 视觉
- [ ] F.17.9 禁止传统 drop-shadow，用 ambient glow — 5.5a grep
- [ ] F.17.10 玻璃态 backdrop-filter: blur(12px) + rgba — 5.5a 检测
- [ ] F.17.11 **禁止 onclick="fn()" 必须 addEventListener** — 5.5a 正则
- [ ] F.17.12 flex 布局禁止 `calc(100vh-Npx)` — 5.5a 正则
- [ ] F.17.13 Canvas 禁止硬编码尺寸上限：`width="160"` / `Math.min(...,480)` 等 — 5.5a 正则
- [ ] F.17.14 Canvas 延迟重绘兜底（setTimeout + fonts.ready） — 5.5a 检测
- [ ] F.17.15 必须 requestAnimationFrame，禁 setInterval — 5.5a grep
- [ ] F.17.16 必须 i18n 双语 EN/CN，默认中文，lang-btn 在 sidebar — 5.5a + 5.5b 检测
- [ ] F.17.17 所有可见文本通过 `t(key)` 查表，禁硬编码 — 5.5a 检测中文/英文裸字符串
- [ ] F.17.18 anim 帧切换共享元素过渡（getFrameElements + lerp + easeInOut 500ms） — 5.5a 检测
- [ ] F.17.19 **禁止 window 同名变量**（history/location/name/status/origin/parent/top/self/length/event/closed/opener/frames/outerWidth/Height） — 5.5a 正则
  - 替代：flights/rounds/trials/runs 替 history；coord/pos 替 location；playerName 替 name；gameState 替 status

### F.18 Game 标准布局模板（SKILL §1431-1509）

- [ ] F.18.1 implement_game.md 原样附带 HTML 骨架（`.game-wrap > .game-sidebar + .game-main`）
- [ ] F.18.2 附带 CSS 块（200px sidebar + flex:1 main + flex-direction:row）
- [ ] F.18.3 附带 Sidebar JS init IIFE（更新 guide / title / 绑 langBtn）
- [ ] F.18.4 lang-btn 必在 .game-sidebar，与游戏区完全隔离 — 5.5a 检测 lang-btn 父节点 class
- [ ] F.18.5 禁止 lang-btn / guide-panel position:fixed / absolute — 5.5a grep
- [ ] F.18.6 .game-body flex:1，canvas width:100% height:100%
- [ ] F.18.7 I18N 必含 `guide` key

### F.19 物理常识约束（SKILL §1511-1530）

- [ ] F.19.1 重力方向：物体向下落 — 5.5c 视觉检
- [ ] F.19.2 SVG/Canvas y 轴向下递增（y=0 顶 / y=max 底）
- [ ] F.19.3 方向性：箭头指运动方向 / 河流高→低 / 火向上 / 电流正→负
- [ ] F.19.4 比例：远小近大 / 太阳>地球 / 细胞<人 / 原子<分子
- [ ] F.19.5 颜色常识：天空蓝 / 植物绿 / 火橙 / 水蓝 / 土棕

### F.20 Animation 设计原则 7 条（SKILL §1532-1541）

- [ ] F.20.1 一个 animation = 一个概念
- [ ] F.20.2 单一场景连续动作，**不是 PPT**
- [ ] F.20.3 先问"为什么必须动起来"，否则用 diagram
- [ ] F.20.4 每图形画面自解释（颜色/标签/箭头/图例）
- [ ] F.20.5 连续性优先于帧数
- [ ] F.20.6 必须用 skeleton + animation_runtime.js
- [ ] F.20.7 代码长度无上限

### F.21 Animation Runtime API（SKILL §1542-1648）

- [ ] F.21.1 sidebar 布局 `.wrapper(row) > .sidebar(200px) + .anim-main(flex:1)`
- [ ] F.21.2 `<script src="animation_runtime.js">` 引用（factory 会 _inline_runtime 自动内联）
- [ ] F.21.3 CONFIG 含 style/totalFrames/i18n/hudLabels/hudValues/guideTitle/guideItems
- [ ] F.21.4 实现 getFrameElements(f, W, H)，每元素带 id
- [ ] F.21.5 可选 drawBg / customDrawElement
- [ ] F.21.6 调 AnimRuntime.boot() 启动
- [ ] F.21.7 帧间 transitionTo(f) 不直接 drawFrame(f)
- [ ] F.21.8 i18n 全 t(key) 查表
- [ ] F.21.9 animation HTML 写到 `course_factory/tests/anim/test_anim_xxx.html` 才能跑 verify

### F.22 i18n 规范 + refreshI18N（SKILL §1664-1693）

- [ ] F.22.1 LANG 默认 'cn'
- [ ] F.22.2 I18N 对象覆盖所有可见文本
- [ ] F.22.3 t(key) 函数 fallback en
- [ ] F.22.4 game lang-btn click → refreshI18N()
- [ ] F.22.5 refreshI18N 更新所有 DOM + 重绘 canvas + 重渲染动态列表

### F.23 KaTeX 数学公式（SKILL §1722-1735）

- [ ] F.23.1 prompt 提供 KaTeX CDN 模板（0.16.11）
- [ ] F.23.2 行内 `\(...\)`，块级 `$$...$$`
- [ ] F.23.3 禁止 SVG `<text>` 手写公式

### F.24 输出前自检清单（SKILL §1751-1769）

- [ ] F.24.1 g_a_code_review 实现 16 项自检（body overflow / 滚动条 / 重力 / 箭头 / 颜色 / 按钮事件 / 拖拽链 / 通关逻辑 / 操作说明位置 / 渐变 / 圆角 / 字体 / I18N / lang-btn 隔离 / 帧过渡 / theme 参考）

### F.25 Step 5.5 六道闸门（SKILL §1803-2000）

- [ ] F.25.1 5.5a code review：事件绑定 / Canvas 时序 / 布局健壮 / rAF / game 拖拽 / i18n 全过
- [ ] F.25.2 5.5b 子进程：node validate/verify/animation.mjs <html> --out tmp，exit 0
- [ ] F.25.3 5.5b 同样跑 game.mjs（standalone + iframe + 关卡推进）
- [ ] F.25.4 5.5c 科学一致性：物理数值真实性 / 方向因果 / 比例 / 文字视觉一致 / 单位 — LLM agent verdict=pass
- [ ] F.25.5 5.5d theory 等级评审：每 theory 跨 level 一次 agent，verdict=pass，含 per_level + animation_review 字段
- [ ] F.25.6 5.5e 游戏性 + 美观：Pattern 真实性 / 互动深度 / 视觉
- [ ] F.25.7 5.5f 文字重叠：截图（5.5b 副产物） + LLM 看图
- [ ] F.25.8 任一闸门 fail → revise → 重跑（最多 1-3 次按表）
- [ ] F.25.9 失败的 idea result=null status=failed continue，不阻塞 knode 整体
- [ ] F.25.10 闸门通过才允许 upsert_lesson

### F.26 Step 6 自检清单（SKILL §170-217 共 30+ 项）

- [ ] F.26.1 plan_markdown 含 core_question / 学习目标 / hands_on_components 动作
- [ ] F.26.2 plan_markdown 末尾有 `## 推荐互动资源` LabXchange 段
- [ ] F.26.3 plan_markdown 未预合并 Tavily（无"## 推荐视频"或"## 延伸阅读"）— grep
- [ ] F.26.4 theories 非空（除纯方法论），K1 必选 + level_bodies + exercises
- [ ] F.26.5 level_bodies 覆盖项目 knowledge_level
- [ ] F.26.6 每 theory 5.5d verdict=pass
- [ ] F.26.7 `[[THEORY:xxx]]` 占位符插入对应段落
- [ ] F.26.8 ideas 数量符合 difficulty × module_role 表
- [ ] F.26.9 每 anim/game 已做 2.5 三方案 divergence
- [ ] F.26.10 每选定方案已通过 2.6 Creativity Gate
- [ ] F.26.11 anim HTML 通过 5.5b 6 项检查
- [ ] F.26.12 exercises 用 `correct` 字段（非 `answer`）
- [ ] F.26.13 make_course_content 直接传 research / labxchange_results / theories（非重包装）
- [ ] F.26.14 acceptance_ref / hands_on_ref 含末尾句号
- [ ] F.26.15 调用 make_course_content 后 plan_markdown 末尾出现 `## 推荐视频` / `## 延伸阅读`（research 非空时）
- [ ] F.26.16 preflight_v41 返回 []
- [ ] F.26.17 generate_assignment 已调用，project_assignment 非空
- [ ] F.26.18 大作业节点：含考核要点 / 自检清单 / 自评指引
- [ ] F.26.19 普通节点：含 3 选 + 2 问 + 1 动手
- [ ] F.26.20 generate_audio_scripts 已调用，sections 数组非空
- [ ] F.26.21 每段 >30 字 section 都有 audio_script
- [ ] F.26.22 audio_script 不是课文朗读版，是口语化讲解

### F.27 常见遗漏防错（SKILL §218-229）

- [ ] F.27.1 research dict key 用 `web_results`/`youtube_results` 不用 `web`/`youtube`
- [ ] F.27.2 Step 1.5 不能跳
- [ ] F.27.3 theories 写了必须有 [[THEORY:xxx]] 占位
- [ ] F.27.4 不预合并 Tavily（重复硬规）
- [ ] F.27.5 acceptance_ref 末尾句号
- [ ] F.27.6 必传 labxchange_results
- [ ] F.27.7 exercise 用 correct 不用 answer
- [ ] F.27.8 不漏 富媒体类型（8 类逐条 debate）
- [ ] F.27.9 game canvas 无尺寸硬编码上限
- [ ] F.27.10 lang-btn / guide-panel 不用 position:fixed

### F.28 Step 6.5 assignment（SKILL §2162-2244）

- [ ] F.28.1 调用 factory.generate_assignment，传 knode + milestone + plan_markdown
- [ ] F.28.2 capstone 走考核指南 prompt（_ASSIGNMENT_PROMPT_CAPSTONE）
- [ ] F.28.3 普通走选择题+问答+动手 prompt（_ASSIGNMENT_PROMPT_NORMAL）
- [ ] F.28.4 写入 LessonContent.project_assignment

### F.29 Step 6.6 audio_script（SKILL §2246-2309）

- [ ] F.29.1 调用 factory.generate_audio_scripts
- [ ] F.29.2 按 ##/### 分段（_split_by_headings）保留占位符
- [ ] F.29.3 每段 LLM 生成 150-300 字
- [ ] F.29.4 课堂用语 + 设问 + 生活类比 — prompt 已在 factory 中
- [ ] F.29.5 sections 写回 course_content.sections[] 并保存 DB

### F.30 完整执行流程检查清单（SKILL §2345-2369 共 22 项）

- [ ] F.30.1-22 端到端跑通后逐项断言（每项映射到 v3 已实现的 step + DB 字段）

### F-final 写对账报告

- [ ] F.final 在 `specs/016-course-factory-v3/skill-conformance.md` 写汇总：表格列 (条目编号 / SKILL 行号 / v3 实现位置 / 验证方式 / 状态 PASS/GAP/N/A / 备注)。GAP 项必须当场补 prompt 或闸门。报告通过用户审阅后才进入阶段 G

## 阶段 G — 上线

- [ ] G1 commit：`feat(v3): course factory v3 — kimi + 12 steps + 6 gates + theme_style`
- [ ] G2 spec.md 顶部写 `Status: shipped (YYYY-MM-DD)`
- [ ] G3 `docs/prd.md` Phase checklist + API 表更新
- [ ] G4 `docs/todolist.md` 删除已被 v3 覆盖的待办

## 任务依赖

```
A1 → A2 → A3 ┐
        A4 ┴→ A5 → B1
A1 → B (B1..B20 顺序内大体可并行,B21 收尾)
B → C1 → C2..C7 (并行) → C8 → C9 → C10
C → D
D → E
E → F
F → G
```
