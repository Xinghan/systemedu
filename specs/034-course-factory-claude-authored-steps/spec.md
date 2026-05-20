# 034-course-factory-claude-authored-steps

**Status**: draft
**Owner**: Xinghan Cui
**Created**: 2026-05-20

## 背景 / 问题

`course_factory` 的设计哲学是"**Claude Code 是创作者, factory.py 是工具箱**"。SKILL.md (1700+ 行) 是给 Claude 看的执行手册, 每一步 Step 1 / 1.5 / 2-5 都是 Claude **自己读 prompt 后亲手写内容**, factory.py 只提供加载 / 拼装 / 校验 / 写盘等纯工具:

- Step 1 (plan_markdown): Claude 自己读 knode 上下文, 手写 800-1500 字学习计划
- Step 1.5 (theories): Claude 自己选 theory 并手写 body_markdown / level_bodies / exercises
- Step 2-5 (ideas, animation HTML, game HTML, exercises): Claude 自己创作 → save
- Step 5.5 (闸门): Claude 自己用 Agent 跑代码 review / 科学验证 / 美学审查
- Step 6 (make_course_content / preflight / 写盘): **纯工具**, 拼装 + 校验

这套设计的核心好处是: Claude 写的时候**带完整教学上下文**, 知道这个 knode 的目标、这个项目的整体节奏、前面 knode 教过什么、后面 knode 要靠什么前置, 能写出有连贯性、有创意、可解释的内容。

**但 Step 6.5 / 6.6 / 6.7 三步是反例**, 它们在 factory.py 内部**自己调 LLM API**:

### Step 6.5: `generate_assignment(knode, milestone, plan_markdown)` 内部 requests POST fast provider 让 LLM 写 assignment.md
### Step 6.6: `generate_audio_scripts(project_name, knode_id, knode, milestone)` 内部 requests POST 让 LLM 按 ##/### 分段写口播稿
### Step 6.7: `generate_slides(knode, course_content, age_band)` (本周新加的) 内部 requests POST 让 LLM 按 slide_gen.md prompt 生成 slide

### 反例为什么是错的

1. **跟 SKILL.md 整体哲学冲突**。SKILL.md 的所有 Step 1-5.5 都说"Claude 自己写", 但 6.5/6.6/6.7 偷偷 LLM 自动化, 这让 SKILL.md 不再是"完整执行手册"——一半 step 是手册 + Claude 手写, 另一半是黑盒函数。

2. **丢上下文**。LLM 远端跑只拿到当前 knode 的字段 + plan_markdown, 不知道:
   - 整个项目教学节奏 (M01-M30 是哪一节)
   - 学生在这之前学过什么 (M07 学了 Linux, M08 才能讲焊接)
   - 这一节的 anim/game 实际长什么样 (LLM 只能拿到 idea_id, 没看到真实 HTML)
   - 老师讲课的整体语气 (slide 间衔接靠"我们刚才说...""你还记得吗 M02 讲的...")

3. **质量不可控**。LLM 自动化的产物没人 review, 跑 30 个 knode 就 30 个 knode 产出, 直接入库。Claude 手写时每个 knode 都要"宣布完成", 走完闸门, 跑前能 review 风格、跑后能改。

4. **Step 5.5 的闸门 / Step 5 的科学一致性闸门对 6.5/6.6/6.7 不适用**。slide 的 SVG 是不是真有教学意义, audio_script 是不是真的衔接前面那张, assignment 是不是真覆盖 acceptance_standard — 这些 Claude 手写时可以一遍写一遍检查, LLM 自动化只能事后跑校验 (而我们目前没有这套校验)。

5. **本周新加 Step 6.7 时把这个反模式又重复一遍** (commit `afacd29`)。我 (Claude) 写 generate_slides 时, 因为看 generate_assignment / generate_audio_scripts 用的是 LLM 调用, 就以为这是"标准模式", 完全没意识到这俩函数本身就是历史遗留的不规范实现。Memory `feedback-course-factory-slide-step` 已经记下"加 step 必须看上下文一致性"这条反思, 但代码层面还没修。

### 现状清单

```
factory.py (LLM 调用):
  L261-334   generate_assignment      → requests + fast provider
  L402-506   generate_audio_scripts   → requests + fast provider (还附带 DB 读写)
  L508-859   generate_slides          → requests + fast provider (本周新加)

SKILL.md Step 6.5/6.6/6.7 章节:
  "用 generate_assignment() 生成" / "用 generate_audio_scripts() 生成" /
  "用 generate_slides() 生成" — 跟前面 Step 1-5 "Claude 自己写" 完全不同的措辞

产物现状:
  purpleair-airquality-node 30 个 knode 的 assignment.md / audio_scripts.json /
    slides.json (M01) 都是 LLM 自动跑出来的, 质量没人 review 过

memory feedback-course-factory-slide-step:
  已经记下"加 step 必须看 SKILL.md 整体规范, 不能写独立脚本", 但没意识到 LLM 调用本身就违规
```

---

## 目标 (WHAT)

### 1. factory.py 三个 step 函数全部改成"纯工具"

| 旧函数 (LLM 调用) | 新函数 (纯工具) | 职责 |
|---|---|---|
| `generate_assignment(knode, milestone, plan_markdown)` | **删除** (Claude 直接手写 assignment.md, save_knode_to_workspace 接 `assignment=` 字符串) | 不需要工具, Claude 写完直接传字符串 |
| `generate_audio_scripts(project_name, knode_id, knode, milestone)` | `finalize_audio_scripts(sections: list[dict]) -> (sections, errs)` | 校验: 每段有 audio_script, 长度 150-300 字, 非课文朗读 |
| `generate_slides(knode, course_content, age_band)` | `finalize_slides(slides, theories, ideas) -> (slides, errs)` | normalize ID + enrich payloads + validate (intro/outro/theory/anim/game 覆盖) |

### 2. SKILL.md Step 6.5/6.6/6.7 章节重写成 "Claude 手写" 模式

跟 Step 1 / 1.5 / 2-5 同款的措辞和结构:

- **Step 6.5**: Claude 读 knode + plan_markdown + acceptance_standard, 自己写 assignment.md (选择题 3 + 问答题 2 + 动手项目 1, 或大作业节点的考核指南 + 自检清单)。模板放 SKILL.md 章节里, 不是外部 prompt。
- **Step 6.6**: Claude 按 plan_markdown 的 ##/### 分段, 自己为每段写 150-300 字口播稿 (口语化 / 课堂语气 / 设问引导 / 生活类比)。模板放 SKILL.md。
- **Step 6.7**: Claude 读 slide_gen.md schema (这个文件保留作为 schema 手册), 自己为这一 knode 设计 ~10 张 slide (intro / bullet / theory / anim / game / image / videos / outro), 每页含 hand-drawn inline_svg + audio_script + payload。

### 3. SKILL.md 三个章节统一模板格式

```
## Step 6.X: <name>

### 目标
- 这一步产物是什么, 用来干嘛
- 跟前一步 / 后一步的关系

### 输入
- 从 knode 取什么 / 从 course_content 取什么 / 从上下文取什么

### 输出
- 数据结构 (字段表 / JSON schema 引用)

### 创作指南 (Claude 手写时按这个写)
- 数量 / 长度 / 风格 / 关键创意点 / 反例
- 跟 Step X.Y schema 文档对齐 (例如 slide_gen.md 是 slide 的 schema 手册)

### 校验工具 (写完调一次)
- finalize_xxx(...) -> (data, errs); errs 非空就回去改

### 写盘
- save_knode_to_workspace(slug, mid, ..., audio_scripts=..., slides=...)
```

### 4. 30 个老 knode 的现状产物处理

| 文件 | 现状 | 决策 |
|---|---|---|
| `assignment.md` | LLM 自动跑出, 30 节都有 | **保留**, 但标注 "legacy LLM-generated, needs Claude review when revisiting" |
| `audio_scripts.json` | LLM 自动跑出, 30 节都有 | 同上 |
| `slides.json` | M01 LLM 跑出 (本周), M02-M30 无 | 删 M01 的, 等 Claude 重新手写 |

不强制全部重写, 但**新项目 / revisit 时按新规范走**。

### 5. memory feedback 更新

把 `feedback-course-factory-slide-step` 升级成 `feedback-course-factory-claude-authored-steps`, 描述清"所有 step 都是 Claude 手写, factory.py 只是工具箱"的统一哲学。

---

## 非目标 (NOT in scope)

- **不动 Step 0.5 (Tavily research) / Step 0.7 (LabXchange search) / Step 5.5 闸门**: 这些是真的"工具/外部服务调用", 不是创作步骤, 保持调 API
- **不重跑 30 个 knode 的 assignment / audio_scripts**: 太重, 老内容标注 legacy 后等下次 revisit (项目 v0.5.0 升级时) 再手写覆盖
- **不动 v3 pipeline (`packages/core/.../course_factory_v3/`)**: 那是另一条路径 (DB + Emitter + multi-version), 跟 workspace SKILL.md 流程是平行的, 改它会牵涉太多 spec
- **不引入新的 LLM provider / config**: 跟 LLM 完全脱钩
- **不动 student-app / library-app**: 这只是创作侧改造

---

## 验收 (Done means)

- [ ] factory.py 不再有 `generate_assignment` / `generate_audio_scripts` / `generate_slides` 三个函数
- [ ] factory.py 新增 `finalize_audio_scripts` / `finalize_slides` (纯校验工具, 无 LLM 调用)
- [ ] SKILL.md Step 6.5 / 6.6 / 6.7 三个章节全部按"创作指南 + 校验工具"模板重写
- [ ] memory `feedback-course-factory-claude-authored-steps` 更新, 覆盖 6.5/6.6/6.7 三个 step
- [ ] M01 slides.json (LLM 跑的那份) 删除
- [ ] purpleair-airquality-node M02 用新规范, 由我 (Claude) 手写 slides + save_knode_to_workspace 验证流程跑通
- [ ] M03-M30 我手写补 slides (一节一宣布完成, 你 review checkpoint)
- [ ] commit 历史里 `afacd29` (LLM Step 6.7) 不 revert, 用新 commit 修正方向 (避免重写历史)

---

## 风险 / 注意点

1. **assignment / audio_scripts 老产物 review 问题**: 30 节 LLM 跑的内容质量未知, 这次先标 legacy, 但下次哪个项目 revisit 时该全部手写覆盖 — 需要 docs/todolist.md 加一条
2. **Claude 手写工作量**: 每个 knode 手写 slides 大概 10-15 分钟, 29 节 ≈ 5-7 小时, 分批做 (这次会议范围只是改造 + 补 M02-M06 几节做 checkpoint, 剩下 M07-M30 后续会话补)
3. **slide_gen.md prompt 文件**: 这是 v3 pipeline 用的, 但我们把它作为 "schema 手册" 引用, 不动文件本体
4. **历史 feedback memory**: 上一条 `feedback-course-factory-slide-step` 内容部分正确 (factory.py + SKILL.md 五处同步), 部分错误 (LLM 调用模式)。改造时 memory 要更新, 不是补充
