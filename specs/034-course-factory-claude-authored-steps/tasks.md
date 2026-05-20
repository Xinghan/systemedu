# 034-course-factory-claude-authored-steps — Tasks

**Status**: draft

按 plan.md §7 拆分。Batch A 是改造 (一次 commit + push), Batch B 是 Claude 手写 30 节 slides (跨 session 滚动)。

---

## Batch A — 改造

### A0. 准备 / 现有调用方扫描

- [ ] grep `generate_assignment` 用法 (除 factory.py / SKILL.md / __init__.py)
- [ ] grep `generate_audio_scripts` 用法
- [ ] grep `generate_slides` 用法
- [ ] grep course_factory pytest 里是否 import 这三个函数
- [ ] 列出影响清单, 决定是否需要顺手改其他文件

### A1. factory.py 改动

- [ ] 删除 `generate_assignment(knode, milestone, plan_markdown)` (L261-334)
- [ ] 删除 `_TEACHER_SCRIPT_PROMPT` 常量 (L384-399)
- [ ] 删除 `generate_audio_scripts(...)` (L402-506) — 整个函数及内部 DB 读写
- [ ] 加 `finalize_audio_scripts(sections) -> (sections, errs)` 纯校验工具
- [ ] 删除 `_SLIDE_GEN_PROMPT_PATH`, `_slide_format_theories`, `_slide_format_ideas`, `_slide_format_list`, `_SLIDE_JSON_ARR_RE`, `_slide_parse_json` (LLM prompt 拼接 helper)
- [ ] 删除 `generate_slides(knode, course_content, ...)` 函数体 (L735-857)
- [ ] 保留 `_slide_yt_thumb`, `_slide_enrich_payloads`, `_slide_normalize_ids`, `_slide_validate`
- [ ] 加 `finalize_slides(slides, theories, ideas, external_resources=None, rendered_sections=None) -> (slides, errs)` 调上面 3 个 helper

### A2. SKILL.md 改动 (修符号链接目标 .claude/skills/course_factory/SKILL.md)

- [ ] 开工清单 L299-303: 三行 Step 6.5/6.6/6.7 改成 "Claude 手写"
- [ ] API 速查代码块 L328-332: 替换 generate_xxx → finalize_xxx (assignment 那条直接删, 因为 Claude 手写不需要工具)
- [ ] "必做" step 表格 L460-462: 三行重写
- [ ] 产物自检清单 Step 6.5/6.6/6.7 (L495-512): 三块重写
- [ ] 删除现有 ## Step 6.5 章节, 按 plan §4 统一模板重写 (含 §4.1 具体创作要求)
- [ ] 删除现有 ## Step 6.6 章节, 按统一模板重写 (含 §4.2 具体创作要求)
- [ ] 删除现有 ## Step 6.7 章节 (上次加的 LLM 版本), 按统一模板重写 (含 §4.3 创作要求 + slide_gen.md schema 引用)
- [ ] 完整执行流程检查清单 L2828-2835: 三行 Step 6.5/6.6/6.7 改成 "Claude 手写 + finalize_xxx 通过"

### A3. Memory 改造

- [ ] 删除 `~/.claude/projects/.../memory/feedback_course_factory_slide_step.md`
- [ ] 新建 `feedback_course_factory_claude_authored_steps.md` (内容按 plan §5)
- [ ] MEMORY.md index: 改 `[Slide step in factory]` 那一行为 `[Claude-authored steps](feedback_course_factory_claude_authored_steps.md) — course_factory 所有 step 都是 Claude 手写 + factory.py 提供纯工具, 看到 step 调 LLM = 反模式`

### A4. 产物 / docs

- [ ] 删除 `content-workspace/generated/purpleair-airquality-node/knodes/M01-w0-module/slides.json`
- [ ] `docs/todolist.md` 加 "purpleair 30 节 assignment.md / audio_scripts.json 是 spec 034 改造前 LLM 跑的, 待 v0.5.0 升级时由 Claude 手写覆盖"

### A5. 验证 + commit

- [ ] `source .venv/bin/activate && python -m pytest course_factory/tests/ tools/content-pipeline/tests/ -v` (期待无回归; 若有 fail 改测试)
- [ ] `python3 -c "from course_factory import finalize_slides, finalize_audio_scripts, save_knode_to_workspace; print('OK')"`
- [ ] git status 看影响范围
- [ ] commit: `refactor(course_factory): step 6.5/6.6/6.7 改回 Claude 手写 + finalize 工具`
- [ ] git push

### A6. spec 进度

- [ ] spec.md 顶部加 `Status: in-progress (2026-05-20)` — Batch A 完成
- [ ] plan.md §9 验收 checklist 把 batch A 那些勾打掉

---

## Batch B — Claude 手写 M02-M30 slides (后续滚动)

### B1. 工作模板 (每节固定流程)

每个 knode 都按以下 5 步:

1. **加载 ctx**: `ctx = load_knode_context_from_workspace(SLUG, "MXX")`
2. **读上下文**: lesson.md, theories.json, sections.json, ideas, external_resources
3. **手写 slides**: 按 slide_gen.md schema 写 ~10 张 (intro / bullets / theories / anim / game / image / videos / outro), 每页 inline_svg / audio_script / payload
4. **校验**: `slides, errs = finalize_slides(slides, theories, ideas, external_resources, rendered_sections); errs == []`
5. **写盘**: `save_knode_to_workspace(SLUG, "MXX", course_content, slides=slides, update_manifest=False)`
6. **宣布**: "M0X Step 6.7 完成 → N slides, errs=[]"

### B2. 滚动列表

- [x] M02 PM2.5 / PM10 是什么 (11 slides, errs=[], 2026-05-20)
- [x] M03 AQI 怎么算 (11 slides, errs=[], 2026-05-20) ← checkpoint 1: 请 review M02+M03 的 slides 风格再继续
- [ ] M04 PurpleAir / OpenAQ / EPA / CNEMC 数据源
- [ ] M05 实地考察模块 (S1 总结)
- [ ] M06 SSH 远程登录
- [ ] M07 Linux 10 命令 (← checkpoint 2)
- [ ] M08 电与焊接 + 万用表
- [ ] M09 模块 (S2 启动)
- [ ] M10 UART
- [ ] M11 PMS5003 接入 Python (← checkpoint 3)
- [ ] M12 BME280 I2C
- [ ] M13 PMS7003 + MQ-135
- [ ] M14 模块 (S3 启动)
- [ ] M15 CSV 数据存储 (← checkpoint 4)
- [ ] M16 浓度 vs AQI
- [ ] M17 EPA NowCast 算法
- [ ] M18 Python 实现 nowcast.py
- [ ] M19 跨数据源对比 (← checkpoint 5)
- [ ] M20 模块 (S4)
- [ ] M21 7 集 vlog
- [ ] M22 API + JSON
- [ ] M23 PurpleAir + OpenAQ 整合 (← checkpoint 6)
- [ ] M24 AirNow + CNEMC
- [ ] M25 MAE 误差度量
- [ ] M26 V2 迭代
- [ ] M27 GitHub 30 commits (← checkpoint 7)
- [ ] M28 田野报告 5 篇
- [ ] M29 5 分钟 demo
- [ ] M30 Zenodo DOI

### B3. spec 收尾

- [ ] 全 29 节完成后 spec.md 顶部 `Status: shipped (YYYY-MM-DD)`
- [ ] plan.md §9 验收 checklist 全部勾掉
- [ ] docs/todolist.md "purpleair v0.4.0 30 节 slides 由 Claude 手写补完" 标完成

---

## 进度跟踪

| 阶段 | 状态 |
|---|---|
| Spec + Plan + Tasks 三件套 | done |
| Batch A 改造 | pending |
| Batch B 手写 slides | pending (Batch A 完成后开始) |
