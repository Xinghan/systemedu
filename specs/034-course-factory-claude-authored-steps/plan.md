# 034-course-factory-claude-authored-steps — Plan

**Status**: draft

## 1. 改造范围全景

### 1.1 涉及文件

```
course_factory/factory.py                            ← 删 3 函数, 加 2 finalize 工具
course_factory/workspace_bridge.py                   ← save_knode_to_workspace 签名不变 (已经接 slides=)
.claude/skills/course_factory/SKILL.md (symlink)     ← 改 5 处
~/.claude/projects/-Users-xinghan-Dev-systemedu/
  memory/feedback_course_factory_slide_step.md       ← 更名 + 重写
  memory/MEMORY.md                                   ← 改 link
content-workspace/generated/purpleair-airquality-node/
  knodes/M01-w0-module/slides.json                   ← 删除 (LLM 跑的)
docs/todolist.md                                     ← 加 "30 节 assignment/audio_scripts revisit 时重写" 一条
```

### 1.2 不改的

- v3 pipeline (`packages/core/.../course_factory_v3/s67_slides.py`, prompts/slide_gen.md) — 平行路径, 我们引用 `slide_gen.md` 作 schema 手册
- library-app / student-app / student-web — 创作侧改造跟它们解耦
- 30 节 assignment.md / audio_scripts.json 既有产物 — 标 legacy, 不重跑
- v1/M01 既有 lesson.md / theories.json / sections.json — 完全不动 (跟 step 6.5/6.6/6.7 无关)

---

## 2. factory.py 改动详细

### 2.1 删除 `generate_assignment` (L261-334)

完全删除函数体 + 同删 `_TEACHER_SCRIPT_PROMPT` 字符串 (L384-399, 是 audio_scripts 用的, 后面 2.2 一起删)。

Claude 手写 assignment.md 时, 直接传字符串给 `save_knode_to_workspace(..., assignment=md_text)`, 不需要任何工具调用。

### 2.2 删除 `generate_audio_scripts` (L402-506) + 加 `finalize_audio_scripts`

老函数:
```python
def generate_audio_scripts(project_name, knode_id, knode, milestone) -> list[dict]:
    # 读 DB.LessonContent, 按 ##/### 分段, 调 LLM, 写回 DB
```

替换为:
```python
def finalize_audio_scripts(sections: list[dict]) -> tuple[list[dict], list[str]]:
    """校验 + 规整 Claude 手写的 audio_scripts。

    输入 sections: list[{"heading": str, "body_markdown": str, "audio_script": str}]
                   Claude 按 plan_markdown 的 ##/### 分段后, 为每段手写 audio_script
    校验:
      - 每个非空 section (body_markdown 字数 ≥ 30 去掉占位符后) 必须有 audio_script
      - audio_script 长度 150-300 字 (warn 不 fail)
      - audio_script 不能跟 body_markdown 文本重叠超过 60% (warn: "疑似课文朗读版")
    返回 (sections, errs) — errs 是字符串列表, 软警告, 由 Claude 决定改不改
    """
```

`save_knode_to_workspace(..., audio_scripts=sections)` 不变, 仍写 audio_scripts.json (schema 没变化, 内部就是 sections 列表 wrap 一层 {"scripts": [...]} 或直接 list)。

### 2.3 删除 `generate_slides` (L508-859, 含所有 `_slide_*` helper) + 加 `finalize_slides`

老函数: 加载 prompt + 调 LLM + parse JSON + normalize + enrich + validate。

替换为 (复用现有 normalize / enrich / validate helper, 但拿掉 LLM 部分):
```python
def finalize_slides(slides: list[dict], theories: list[dict], ideas: list[dict],
                    external_resources: dict | None = None,
                    rendered_sections: dict | None = None
                    ) -> tuple[list[dict], list[str]]:
    """校验 + 规整 Claude 手写的 slide 列表。

    输入 slides: Claude 按 slide_gen.md schema 手写的 list[dict]
    操作:
      1. enrich payloads: videos/labxchange/image 用 external_resources 真实 URL 回填
      2. normalize ids: theory_id / idea_id 跟 theories / ideas 对齐 (前缀 / topic 反查)
      3. validate: intro/outro 必含, theory/anim/game 覆盖, 每页 audio_script ≥ 30 字
    返回 (slides_finalized, errs)
    """
```

保留 4 个内部 helper (改名去掉 `_slide_` 前缀, 或保持):
- `_slide_enrich_payloads`
- `_slide_normalize_ids`
- `_slide_validate`

删除 7 个内部 helper (只服务 LLM prompt 拼接):
- `_SLIDE_GEN_PROMPT_PATH`
- `_slide_format_theories`
- `_slide_format_ideas`
- `_slide_format_list`
- `_SLIDE_JSON_ARR_RE`
- `_slide_parse_json`
- `_slide_yt_thumb` (这个其实 enrich 用了, **保留**)

### 2.4 `__init__.py` re-export

`from .factory import *` 自动带新函数。但 SKILL.md API 速查代码块要改成新名:
```python
finalize_audio_scripts,       # sections, errs = finalize_audio_scripts(sections)
finalize_slides,              # slides, errs = finalize_slides(slides, theories, ideas, external_resources=ext, rendered_sections=rs)
```

---

## 3. SKILL.md 改动详细

### 3.1 五个地方同步修改

A. **开工清单** (L299-303):
   ```
   [ ] Step 6.5  Claude 手写 assignment.md
   [ ] Step 6.6  Claude 手写 audio_scripts (每段) + finalize_audio_scripts 校验
   [ ] Step 6.7  Claude 手写 slides (按 slide_gen.md schema) + finalize_slides 校验
   ```

B. **必备 Python API 速查代码块** (L328-332): 替换 `generate_assignment` / `generate_audio_scripts` / `generate_slides` 行

C. **Workspace 模式 API 注释** (L349): `save_knode_to_workspace(..., assignment, audio_scripts, slides)` 不变, 注释保留

D. **"必做" step 表格** (L460-462): 三行重写
   ```
   | 6.5 Claude 手写 assignment | 必做 | knode + plan_markdown + acceptance_standard | assignment.md | Step 6.5 | Claude 按章节模板手写选择题/问答题/动手项目, 不调 LLM |
   | 6.6 Claude 手写 audio_scripts | 必做 | plan_markdown | audio_scripts.json | Step 6.6 | Claude 按 ##/### 分段, 每段手写 150-300 字口语化讲解, 用 finalize_audio_scripts 校验 |
   | 6.7 Claude 手写 slides | 必做 | knode + course_content + slide_gen.md schema | slides.json | Step 6.7 | Claude 按 slide_gen.md 手写 ~10 张 slide 含 inline_svg + audio_script, 用 finalize_slides 校验 |
   ```

E. **三个 ## Step 6.X 章节正文** (L2515 起): 按统一模板重写 (见 plan §4)

### 3.2 产物自检清单 (L495-512)

`Step 6.5 / 6.6 / 6.7 检查` 三块改成:
- Step 6.5: Claude 是否手写 assignment.md, 题型覆盖, 跟 acceptance_standard 对齐
- Step 6.6: 每段 audio_script 是否口语化非朗读版, 长度 150-300, finalize_audio_scripts errs == []
- Step 6.7: 顺序 intro/bullet/theory/anim/game/outro, 每页 inline_svg 真画图非占位, finalize_slides errs == []

### 3.3 完整执行流程检查清单 (L2828-2835)

`[ ] Step 6.5/6.6/6.7` 三行措辞改成"Claude 手写 ... + finalize_xxx 通过"。

---

## 4. SKILL.md Step 6.X 章节统一模板

每个 step 章节按以下结构重写 (跟现有 Step 1 / 1.5 / 2 等格式呼应):

```markdown
## Step 6.X: <name> (Claude 手写)

每个 knode 必做。**这是 Claude 自己创作的步骤**, 不调任何 LLM API。
factory.py 的 finalize_xxx() 只做校验 + 规整, 不生成内容。

### 这一步产物是什么

- 数据落点: <knode_dir>/{assignment.md, audio_scripts.json, slides.json}
- 谁用: 学生学习时 ...
- 跟前后步关系: Step X 提供 ..., 这里生成 ..., Step Y 用 ...

### 输入上下文 (Claude 写之前要读)

- knode 字段: title / core_question / acceptance_standard / hands_on_components
- course_content: plan_markdown / theories / ideas / rendered_sections / external_resources
- (slide 特有) slide_gen.md schema 手册

### 创作要求 (Claude 写时遵守)

- 数量 / 长度 / 风格 / 关键创意点
- 反例 (常见错误)
- 跟整个项目教学节奏的关系

### 写完后跑校验

```python
from course_factory import finalize_xxx
data, errs = finalize_xxx(data, ...)
if errs:
    # 修了再来一遍
```

errs 非空 = 软警告, Claude 决定要不要改, 不阻断写盘。

### 写盘

```python
save_knode_to_workspace(slug, mid, course_content,
                        assignment=md, audio_scripts=sections, slides=slides)
```
```

### 4.1 Step 6.5 具体创作要求

普通节点:
- 选择题 3 题: 覆盖 plan_markdown 主要概念, 4 选 1 + 解析
- 问答题 2 题: 开放问答, 需要学生用自己话解释
- 动手项目 1 个: 跟 hands_on_components 对齐, 给学生具体可操作步骤

大作业节点 (module_role = capstone):
- 考核指南: 验收标准列表
- 自检清单: 学生交付前自检 ≥ 5 项
- 自评写作指引: 怎么写反思报告

### 4.2 Step 6.6 具体创作要求

按 plan_markdown 的 ## 和 ### 标题分段, 每段产出 `{"section_title": str, "audio_script": str}`:
- 长度 150-300 字
- 风格: 口语化, 像老师在课堂讲, 不是朗读课文
- 课堂用语: "同学们", "你们想想看", "大家有没有注意到"
- 每段至少一个设问引导思考
- 生活类比解释抽象概念
- 上下衔接: 第 N 段开头呼应第 N-1 段结尾

### 4.3 Step 6.7 具体创作要求

按 slide_gen.md schema 手册写, 但**记住 Claude 比 LLM 多知道**:
- 这一节是项目第 X 节, 前 N 节学了什么 (slide 引语可以回顾)
- 实际 anim/game 长什么样 (写 short_desc 时可以呼应)
- inline_svg 用心画 (不是 LLM 凑数: `<circle r="10"/>`, 而是真画与概念对应的简洁示意图)
- audio_script 上下衔接 ("我们刚才说...", "你还记得 M02 讲的吗")

顺序硬规则: intro → bullet ×N → theory ×N → animation ×N → game ×N → image (聚合) → videos (聚合) → labxchange (聚合) → outro

每页结构按 slide_gen.md 各 kind 的 payload schema 写。

---

## 5. Memory 改造

老 memory `feedback_course_factory_slide_step.md` 内容部分正确部分误导。**重写为 `feedback_course_factory_claude_authored_steps.md`**:

```markdown
---
name: feedback-course-factory-claude-authored-steps
description: course_factory 所有 step 都是 Claude 手写 + factory.py 提供纯工具 (finalize_xxx); 任何 step 调 LLM 都是反模式
metadata:
  type: feedback
---

course_factory 是一套"Claude Code 按 SKILL.md 手写 + factory.py 提供纯工具"的工厂。
所有创作 step (1, 1.5, 2-5, 6.5, 6.6, 6.7) 都是 Claude 自己写内容, factory.py
只提供加载 (load_knode_context_from_workspace) / 拼装 (make_course_content) /
校验 (finalize_audio_scripts, finalize_slides, preflight_v41) / 写盘
(save_knode_to_workspace) 等纯工具, 绝不调 LLM。

**Why:** 历史上 generate_assignment / generate_audio_scripts / generate_slides
三个 step 在 factory.py 内部偷偷调 LLM, 完全跟"Claude 手写"哲学冲突。LLM 远端
跑丢上下文 (不知道项目整体节奏 / 前面 knode 教过什么 / 实际 anim/game 长啥样),
产出质量没人 review, 直接入库。spec 034 把这三个 step 改回 Claude 手写。

**How to apply:**
- 给 course_factory 加新 step: factory.py 加 `finalize_xxx(data, ...) -> (data, errs)`
  纯校验工具, SKILL.md 加 "Step X.Y (Claude 手写)" 章节, 不调任何 LLM API
- 看到任何 factory.py 函数里 `import requests` + `provider.api_key` + LLM 调用 =
  反模式, 这种函数都该被改成 finalize 工具
- 跟"工具调用 step"区分: Step 0.5 (Tavily) / Step 0.7 (LabXchange) / Step 5.5
  闸门 (Agent code review / 科学验证 / 美学审查) 是真正的外部服务调用, 不属于
  "创作 step", 保留 API 调用
- 短 prompt 调 LLM 的需求 (评判 / JSON 抽取 / 文本规整) 应该想想: 是不是 Claude
  自己看上下文就能写? 如果是, 那不需要 LLM
```

MEMORY.md index 那一行同步换成新 link + 新描述。

---

## 6. 产物清理 + 标注

### 6.1 删除

```bash
rm content-workspace/generated/purpleair-airquality-node/knodes/M01-w0-module/slides.json
```

(此文件是 commit `afacd29` 的 LLM 产物, content-workspace 不入 git, 本地删即可)

### 6.2 不删但标 legacy

不修改既有 30 节的 assignment.md / audio_scripts.json (LLM 跑的)。在 docs/todolist.md 加一条:

```markdown
- [ ] purpleair-airquality-node 30 节 assignment.md / audio_scripts.json 是 spec 034
      改造前 LLM 自动跑出, 质量未人工 review。下次 v0.5.0 升级时由 Claude 按新
      规范手写覆盖。
```

---

## 7. 实施分批

按 spec.md "Done means" 验收, 拆成两个 commit 批次:

### Batch A — 改造 (一次 commit)

1. factory.py: 删 3 函数 + 加 2 finalize 工具
2. SKILL.md: 五处同步修改 + 三个 ## Step 6.X 章节重写
3. Memory: feedback 重命名 + 内容重写 + MEMORY.md index 改
4. 删 M01 slides.json
5. docs/todolist.md 加 legacy 标注
6. 跑现有 course_factory pytest (`tests/test_workspace_bridge.py` 等) 看有没有 broken
7. commit: `refactor(course_factory): step 6.5/6.6/6.7 改回 Claude 手写 + finalize 工具`
8. push

### Batch B — 用新规范手写 slides (后续 commit, 但 spec.md 验收清单包含)

1. Claude 我手写 M02 slides → finalize_slides → save_knode_to_workspace, 跟你 review
2. M03-M30 我串行手写, 4-5 节一 checkpoint 给你 review
3. 跑完一节 commit message `content: M0X slides handwritten` (产物不入 git, commit 主要是 docs/todolist.md 进度更新 / spec.md status)

Batch B 是手工活, 跨多个 session, spec.md 进度通过 `Status: shipped (YYYY-MM-DD)` 和 docs/todolist.md 跟踪。

---

## 8. 风险 / 注意

1. **现有调用方**: factory.py 三个被删的函数是否有其他模块在 import?
   - 已搜索: 只在 SKILL.md / __init__.py re-export / `scripts/v3_run_knode.py` (待查) 用到
   - v3 pipeline 不用这三个 (它走自己的 s67_slides.py 等)
   - 删除前再 grep 一次确认

2. **pytest**: course_factory/tests/ 里有没有给这三个函数的 test?
   - 待 batch A 实施时 `grep -r "generate_assignment\|generate_audio_scripts\|generate_slides" tests/` 看, 有就改成 finalize 测试

3. **content-workspace 数据**: 删 M01 slides.json 不影响任何在线服务 (workspace 是创作侧, library 里也没 import slides), 安全

4. **commit `afacd29` 的 reverse**: 不 git revert, batch A 的 refactor commit 自然把它的内容替换掉

5. **scripts/v3_run_knode.py**: 这是 v3 入口脚本, 待查是否也调三个被删函数. 不调就不动; 调了 (历史 cli mode) 看用法决定要不要也改

---

## 9. 验收 checklist

(从 spec.md "Done means" 转译, batch A 完成时打勾)

- [ ] factory.py 不含 `generate_assignment` / `generate_audio_scripts` / `generate_slides`
- [ ] factory.py 含 `finalize_audio_scripts` / `finalize_slides`
- [ ] `import course_factory; course_factory.finalize_slides` 可调
- [ ] SKILL.md 五处同步修改完成 + 三个 ## Step 6.X 章节重写
- [ ] memory feedback 重命名 + 重写, MEMORY.md index 更新
- [ ] M01 slides.json 物理文件已删
- [ ] docs/todolist.md 加 legacy 标注
- [ ] pytest 跑 `tests/` 没回归 (旧测试如果是测删掉的函数, 改成测 finalize)
- [ ] commit + push
- [ ] (batch B) Claude 手写 M02 slides 跑通, 你认可质量
