# COURSE_FACTORY.md -- Claude Code 课程生成操作手册

> 当用户说"调用 course_factory"时，Claude Code 按照本手册逐步执行。
> 本手册替代 6 个 Agent 的 LLM API 链式调用，由 Claude Code 自己完成所有内容创作和代码编写。

---

## 强制执行清单 (Execution Checklist)

**每次生成任何 knode 课程前，必须按此清单逐项对齐。不允许跳步，不允许凭记忆省略。**

本手册有 1700+ 行，很容易漏读中间章节。这份清单是权威摘要，每个 knode 生成前先回头核对一遍，再去翻对应章节的细节。

### 富媒体全集（每个 knode 都要检查这 8 类是否已考虑）

一个完整的 knode 课程会呈现多种"富媒体"给学生，前端右侧富媒体栏对应地列出这 8 类。**每次生成前都要逐条确认**——不一定每类都要有，但任何一类被"遗漏 / 忘记考虑"都算不合格：

| # | 类型 | 产物位置 | 哪一步生成 | 允许为 0？ |
|---|------|---------|-----------|:-----:|
| 1 | **theory（基础知识）** | `course_content.theories[]` + `[[THEORY:xxx]]` | Step 1.5 | 只有"纯方法论节点"允许 0 个，否则 2-5 个 |
| 2 | **animation（动画）** | `ideas[mode='animation']` + `rendered_sections` | Step 2-5 | 按 difficulty × module_role 决定，通常 ≥ 1 |
| 3 | **game（小游戏）** | `ideas[mode='game']` + `rendered_sections` | Step 2-5 | 同上。概念节点至少 1 个 |
| 4 | **hands_on_kit（实物操作与购买）** | `ideas[mode='hands_on_kit']` + `rendered_sections.components/steps` | Step 2-5 | 允许 0，仅适用于有实体元器件的工程节点（传感器/电机/面包板等）。**独立模块**：`[[IDEA:kit_xxx]]` 必须放在独立的 `## 实物操作与购买` 段落下，不得嵌入"动手实践"等其他段落。元器件优先中国产，价格不设上限但需标注价格判断（见下方价格指引） |
| 5 | **image（真实照片）** | `ideas[mode='image']` + `rendered_sections.src` | Step 2-5 | 允许 0，低难度节点鼓励 1 张 |
| 6 | **diagram（静态示意图）** | `ideas[mode='diagram']` + `rendered_sections.html` | Step 2-5 | 允许 0 |
| 7 | **youtube（外部视频）** | `external_resources.youtube_results[]` | Step 0.5 Tavily | 非 0（除非搜索无命中） |
| 8 | **labxchange（外部互动路径）** | `external_resources.labxchange_results[]` | Step 0.7 本地匹配 | 非 0（除非学科不匹配） |

> exercise 也是必做产物（每个 knode ≥ 1 个），但它是"评测/练习"而非"呈现媒介"，不计入富媒体栏。

#### hands_on_kit 价格指引

实物操作与购买的价格**不设上限**，但必须在每个套件中标注 `total_cost_cny` 并附带价格判断：

| 总价区间 | 判断 | 说明 |
|---------|------|------|
| < 50 元 | 推荐 | 几乎所有家庭都能承受 |
| 50-200 元 | 正常 | 主流教育套件价位 |
| 200-500 元 | 较贵 | 需在套件描述中说明为什么值得购买 |
| 500-2000 元 | 贵 | 需提供"简化替代方案"（更便宜的替代元器件组合） |
| > 2000 元 | 很贵 | 仍然可以列出，但必须同时提供一个 < 500 元的替代套件 |

价格判断写入 `rendered_section` 的描述中即可，前端不做特殊处理。

#### hands_on_kit 在 plan_markdown 中的位置

kit 是**独立模块**，`[[IDEA:kit_xxx]]` 必须放在独立的 `## 实物操作与购买` 段落下：

```markdown
## 实物操作与购买

[[IDEA:kit_xxx]]
```

不得将 kit 标记嵌入"动手实践"、"深入理解"等其他段落。在 plan_markdown 中，`## 实物操作与购买` 应出现在正文之后、`## 推荐互动资源` 之前。

**在 Step 2 的 Ideas 枚举和 Step 4 的 Debate 过程中必须逐行走完上面这张表**。不允许"我感觉这个节点只要 animation + exercise 就够了"——至少要显式说出 theory / image / diagram / game / hands_on_kit 各自被考虑过（哪怕最终决定 reject）。

### 硬规则（违反即不合格）

1. **顺序执行**：Step 0.5 → 0.7 → 1 → 1.5 → 2 → 3 → 4 → 5 → 5.5 → 6 → 6.5 → 6.6。不得乱序。
2. **不得跳步**：每一步都必须完成（除非"可跳过"列明允许）。
3. **对齐清单**：生成前在大脑里跑一遍这张表，确认每一步都有明确产物。
4. **禁止预合并外部资源**：`plan_markdown` 原文中只写"## 推荐互动资源"（LabXchange），`## 推荐视频` 和 `## 延伸阅读` 由 `make_course_content(research=...)` 自动合并。不要在外部调 `merge_resources_into_plan`。
5. **acceptance_ref / hands_on_ref 必须原文匹配**：包括末尾句号。差一个字就 preflight 失败。

### 步骤清单

| Step | 必做? | 输入 | 产物 | 章节位置 | 关键规则 |
|------|:-----:|------|------|---------|---------|
| **0** 加载上下文 | 必做 | project_name, knode_global_idx | `ctx = {knode, milestone, sub_project}` | 前置信息收集 | 用 `load_knode_context()`，v4.1 字段不得忽略 |
| **0.5** Tavily 搜索 | 必做 | knode + milestone + 英文 web_query / youtube_query | `research = {web_results, youtube_results}` | Step 0.5 | 每个 knode 都必须调用，不做筛选。youtube_query 必须英文 |
| **0.7** LabXchange 匹配 | 必做 | keywords 英文列表 + subject_filter | `lx_results = [{title, url, score, ...}]` | Step 0.7 | 本地搜 1467 pathway，top_k=2~4，URL 形如 `/library/pathway/lx-pathway:{uuid}` |
| **1** 撰写 plan_markdown | 必做 | ctx + core_question + hands_on + acceptance | 800-1500 字 markdown 正文 | Step 1 | 正文必须围绕 core_question；末尾写"## 推荐互动资源"段落列 LabXchange |
| **1.5** 标注基础理论 theories | 必做 | plan_markdown | `theories = [{theory_id, title, subject, level_bodies, ...}]` + `[[THEORY:xxx]]` 占位符 | Step 1.5 | **每个 knode 2-5 个 theory**（纯方法论节点允许 0 个但需说明理由）。每个 theory 必须带 `level_bodies`，K1 必选 |
| **2** 抽取 Ideas | 必做 | plan_markdown + difficulty × module_role 表 | ideas 列表（animation / game / exercise） | Step 2 | 按 difficulty × module_role 决定动画/游戏数量，不凭直觉 |
| **2.5** Ideation Divergence | 必做 | ideas | 每个 animation/game 的 3 个候选方案 + 挑选理由 | Step 2.5 | 3 个跨不同 Pattern 的 pitch，写明 why cool；选 1 个 reject 另外 2 个 |
| **2.6** Creativity Gate | 必做 | 选定方案 | 通过 Subtract / Replay / Surprise / Aha 四问 | Step 2.6 | 4 问任一不过回到 2.5 重新发散 |
| **3** Ideas 详细描述 | 必做 | ideas | 每个 idea 的 detailed_description | Step 3 | 每个 idea 说明交互流程、数据结构、视觉要素 |
| **4** Debate | 必做 | ideas + 详述 | 保留 / 拒绝决策 | Step 4 | 自我质疑：是否重复、是否对应 hands_on、是否过于抽象 |
| **5** 实现代码 | 必做 | 保留的 ideas | animation HTML / game HTML / exercise JSON | Step 5 | 动画遵守深色主题、100vh、i18n 双语、`animation_runtime.js` |
| **5.5** Code Review & Verify | 必做 | 动画 HTML + theories | `html_validate.mjs` 全绿 + 科学验证 + **Theory 等级评审 Agent** 全通过 | Step 5.5 | 用通用脚本：`scripts/verify/animation.mjs`、`scripts/verify/game.mjs`、`scripts/verify/learn_page.mjs`。theory 评审是独立 Agent 调用，对每个 theory 的 level_bodies 判断等级匹配/材料完整性/推导严谨性 |
| **6** 组装 & 写入 DB | 必做 | plan + animation + exercises + research + labxchange + theories | `course_content` dict + DB 行 | Step 6 | 用 `make_course_content(..., research=..., labxchange_results=..., theories=...)`。preflight 必须通过 |
| **6.5** 生成作业练习 | 必做 | knode + milestone + plan_markdown | `project_assignment` Markdown 文本 | Step 6.5 | 普通节点：选择题+问答题+动手项目。大作业节点：考核指南+自检清单+自评指引。用 `generate_assignment()` 生成，`upsert_lesson(project_assignment=...)` 或 `upsert_assignment()` 写入 |
| **6.6** 生成讲课稿 | 必做 | plan_markdown + knode | `course_content.sections[].audio_script` | Step 6.6 | 按 ##/### 分段，每段 LLM 生成 150-300 字口语化讲解。用 `generate_audio_scripts()` 生成并自动写入 DB |

### 产物自检清单（Step 6 写入前）

**写入 DB 前必须逐项打勾。任何一条未过都要回头修。**

输入参数检查：
- [ ] plan_markdown 含 core_question、学习目标、hands_on_components 动作
- [ ] plan_markdown 末尾有"## 推荐互动资源"LabXchange 段
- [ ] plan_markdown 未预合并 Tavily 视频/延伸阅读（手写版本里不能出现"## 推荐视频"或"## 延伸阅读"）
- [ ] theories 列表非空（除非纯方法论节点），每个 theory 有 level_bodies（K1 必选）
- [ ] level_bodies 覆盖项目 `knowledge_level` 对应等级（K4 项目必须有 K4 版本）
- [ ] **每个 theory 已通过 Step 5.5 Theory 等级评审 Agent（verdict=pass）**
- [ ] `[[THEORY:xxx]]` 占位符已插入对应段落
- [ ] ideas 数量符合 difficulty × module_role 表
- [ ] 每个 animation/game 已做 Step 2.5 三方案 divergence
- [ ] 每个选定方案已通过 Step 2.6 Creativity Gate 四问
- [ ] animation HTML 通过 html_validate.mjs 全 6 项
- [ ] exercises 用 `correct` 字段（不是 `answer`）
- [ ] `make_course_content` 直接传入 **未经重包装的** `research=research_knode() 返回值`、`labxchange_results=lx`、`theories=theories`
- [ ] acceptance_ref / hands_on_ref 完全匹配 knode 原文（含句号）

富媒体全集检查（8 类）——每类都要显式确认"考虑过"：
- [ ] **theory**：`len(theories) ≥ 2`（纯方法论节点除外），且 `[[THEORY:xxx]]` 占位符对应完整
- [ ] **animation**：至少 1 个 animation idea 或已在 Debate 中写明 reject 理由
- [ ] **game**：至少 1 个 game idea 或已在 Debate 中写明 reject 理由
- [ ] **hands_on_kit**：节点涉及实体元器件（传感器/电机/面包板等）时，是否需要实物操作与购买？如果 reject 需写明理由。元器件优先中国产，价格不设上限但需标注价格判断。`[[IDEA:kit_xxx]]` 必须放在独立的 `## 实物操作与购买` 段落下，不得嵌入"动手实践"等其他段落
- [ ] **image**：是否有必要用一张真实 CC-BY/CC0 照片？如果 reject 需写明理由
- [ ] **diagram**：是否有必要用一张静态示意图（SVG/HTML）？如果 reject 需写明理由
- [ ] **youtube**：`research_knode(youtube_query=...)` 已调用，`external_resources.youtube_results` 有值（除非 Tavily 命中为 0）
- [ ] **labxchange**：`search_labxchange(keywords=...)` 已调用，`labxchange_results=lx` 已传入 `make_course_content`

作业练习检查（Step 6.5）：
- [ ] `generate_assignment()` 已调用并返回非空文本
- [ ] 作业内容已通过 `project_assignment=` 参数写入 DB
- [ ] 大作业节点：包含考核要点、交付物自检清单、自评写作指引
- [ ] 普通节点：包含选择题(3)+问答题(2)+动手项目(1)

讲课稿检查（Step 6.6）：
- [ ] `generate_audio_scripts()` 已调用
- [ ] `course_content.sections` 数组非空
- [ ] 每段有实质正文（>30字）的 section 都有 `audio_script`
- [ ] 讲课稿不是课文朗读版，是口语化讲解

调用 `make_course_content` 后的**输出检查**（不只是看 preflight）：
- [ ] **检查 `course_content["plan_markdown"]` 末尾是否多了 "## 推荐视频" 段**（当 research 有 youtube_results 时）
- [ ] **检查 `course_content["plan_markdown"]` 末尾是否多了 "## 延伸阅读" 段**（当 research 有 web_results 时）
- [ ] 如果上面两项没出现，说明传入的 research dict 结构错误（常见：用了 `web`/`youtube` 而不是 `web_results`/`youtube_results`）
- [ ] preflight 返回空列表

### 常见遗漏（历史踩坑）

- **research dict 结构错误** (2026-04-09)：`research_knode()` 返回 `{"web_results": ..., "youtube_results": ...}`（带 `_results` 后缀）。不要用 `{"web": ..., "youtube": ...}` 这种 key 名手动包装——`make_course_content` 会读不到内容，结果是 plan_markdown 里没有"## 推荐视频"段落但又不报错。**正确做法：直接把 `research_knode()` 的返回整个传给 `make_course_content` 的 `research=` 参数**。
- 遗漏 Step 1.5：手册中 Step 1.5 夹在 Step 1 和 Step 2 之间，容易跳过。**每次生成前先对齐清单，确认 theories 已写**。
- `theories` 写了但 `[[THEORY:xxx]]` 占位符没插进 plan_markdown：前端不会渲染基础知识块，右侧富媒体栏 theory 计数为 0。修复方法：在 plan_markdown 的相关段落前/后插入占位符（参考 mars-risk-map knode 0/1 的修正案例：在"地面有三个关键特性"等 h3 之前插）。
- 外部预合并 Tavily：见硬规则 4。
- acceptance_ref 少句号：见硬规则 5。
- 忘传 `labxchange_results` 参数：导致 LabXchange 资源不进 DB 的 node_resources 表。
- exercise 字段用 `answer` 而不是 `correct`：`make_exercises` 会报错。
- **"漏考虑富媒体类型"**：例如整个 knode 只生成了 animation + exercise，没有 theory / image / diagram / game 的 Debate 记录。正确做法：在 Step 2 的 Ideas 枚举里逐条走完 7 类富媒体（theory/animation/game/image/diagram/youtube/labxchange），哪怕最终 reject 也要显式写明理由。
- **Game canvas 写死像素尺寸或硬编码上限** (2026-04-12, 反复发生)：Game HTML 中 `<canvas width="160">` 或 `Math.min(..., 480)` / `Math.min(..., 200)` 导致在大屏 iframe 中 canvas 只占很小一块。根因：LLM 生成代码时习惯加"安全上限"，但 game 在 iframe 中运行，iframe 本身就是容器边界，不需要额外上限。修法：`sz = Math.min(availW, availH)`（只用容器尺寸互相约束），`sz = Math.max(sz, 80)` 设下限即可。`make_course_content()` 现已加入自动检测。见通用约束第 13 条。

---

## 前置信息收集

在开始之前，确认以下输入参数（向用户询问缺失项）：

### 基础参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `project_idea` | 项目主题（一句话） | "NASA 火星车风险地图" |
| `project_name` | 英文 slug | "mars-risk-map" |
| `node_title` | 当前知识节点标题 | "在火星图像里看见路况而不是风景" |
| `node_summary` | 节点摘要（1-2 句或多段描述） | "能够用任务目标、可通行区、危险区和未知区四类语言描述一张火星场景图…" |
| `difficulty` | 难度 1-10（来自 `difficulty_level`） | 1 |
| `milestone_title` | 所属里程碑 | "看懂火星任务、图像和风险语言" |
| `category` | 学科分类 | science / physics / biology / aerospace / cs |
| `age_range` | 目标年龄 | [12, 15] |

### v4.1 知识树扩展字段（**必须读取，不能忽略**）

v4.1 知识树为每个 knode 和 sub_project 提供了项目级工程锚点，course_factory 必须将它们消费进入 Step 1 和 Step 2，否则生成的课程会脱离真实工程任务而退化成"科普作文"。

**knode 级扩展字段**（`knowledge_tree.json > milestones[].knodes[]`）：

| 字段 | 说明 | 消费位置 |
|------|------|---------|
| `module_id` | 模块全局 ID（如 `P-MARS-01-M01`） | 作为 plan_markdown 标题角标，便于追溯 |
| `module_role` | 模块角色（`foundation` / `core` / `deepening` / `synthesis` / `capstone`） | Step 2 影响 mode 选择策略（见 Step 2）|
| `core_question` | 本节的核心驱动问题 | **Step 1 plan_markdown 必须围绕该问题展开**，放在"引入"段落 |
| `hands_on_components` | 学生必须亲手做的工程动作列表 | **Step 1 的"深入理解/应用与拓展"段必须出现这些动作**；**Step 2 的 exercise/game 必须至少覆盖一项** |
| `acceptance_artifacts` | 本模块必须交付的作品（报告/代码/数据/演示）| Step 2 的 exercise 出题方向要对标这些产物 |
| `acceptance_standard` | 验收标准（可运行/可演示/可追溯）| Step 1 的"学习目标"段必须与这些标准一一对应 |
| `outputs_produced` | 本模块产生的输出物名称 | 作为 Step 1 末尾"学习路径建议"的 handover 说明 |

**sub_project 级扩展字段**（`knowledge_tree.json > sub_projects[]`）：

| 字段 | 说明 | 消费位置 |
|------|------|---------|
| `brief` | 阶段目标一句话 | 作为 plan_markdown 顶部上下文帽子（为什么这个 knode 属于这个阶段）|
| `core_problem` | 阶段要解决的工程真实问题 | Step 1 引入段落的背景锚定 |
| `task` | 阶段主任务 | 同上 |
| `deliverables` | 阶段最终交付物 | 确保 knode 的 exercise 能推进这些交付 |

### 如何从 knowledge_tree.json 读取

如果用户提供的是已有项目，优先从 `projects/{name}/knowledge_tree.json` 读取，构造完整 knode 上下文对象。`scripts/course_factory.py` 已内置 `load_knode_context()` 工具函数，直接调用即可：

```python
from scripts.course_factory import load_knode_context

ctx = load_knode_context("mars-risk-map", knode_global_idx=0)
knode = ctx["knode"]              # v4.1 knode dict（含 module_id/core_question/hands_on_components 等）
milestone = ctx["milestone"]      # {"title": ..., "description": ...}
sub_project = ctx["sub_project"]  # v4.1 sub_project（含 brief/core_problem/task/deliverables）
```

内部实现会根据 global index 展开 milestones 下的 knodes，并通过 `sub_projects[].milestone_indices` 反查所属阶段。未找到时抛 `ValueError`。

**禁止跳过 v4.1 字段**：如果字段为空/缺失，按旧版流程退化；只要存在就必须消费进入 plan_markdown 与 ideas。

---

## Step 0.5: 外部资料研究（Tavily Search）

在动笔写 plan_markdown 之前，**每个 knode 都必须调用 Tavily 搜索补充外部资料**。搜索结果会自动写入右侧"外部资源"面板。

### 调用方式

```python
from scripts.course_factory import load_knode_context, research_knode

ctx = load_knode_context("mars-risk-map", knode_global_idx=3)
knode = ctx["knode"]
milestone = ctx["milestone"]
sub_project = ctx["sub_project"]

research = research_knode(
    knode,
    milestone=milestone,
    sub_project=sub_project,
    # 建议显式传入高质量的英文查询词（YouTube 中文查询常常没结果）
    web_query="Mars HiRISE DEM stereo reconstruction",
    youtube_query="Mars HiRISE digital elevation model",
    max_web=4,
    max_youtube=2,
)
```

返回结构：

```json
{
  "web_query": "Mars HiRISE DEM stereo reconstruction",
  "youtube_query": "Mars HiRISE digital elevation model",
  "web_results": [
    {"title": "...", "url": "https://...", "snippet": "一段摘要", "score": 0.91},
    ...
  ],
  "youtube_results": [
    {"title": "...", "url": "https://www.youtube.com/watch?v=XXX",
     "video_id": "XXX", "snippet": "...", "score": 0.84},
    ...
  ],
  "researched_at": "2026-04-05T16:00:00"
}
```

### 资料如何融入课程

`make_course_content(..., research=research, labxchange_results=lx_results)` 在 Step 6a 会**自动**：

> **重要**：传给 `make_course_content` 的 `plan_markdown` **必须是原始未合并版**——不要在外部预先调用 `merge_resources_into_plan`，否则视频/延伸阅读会被插入两次（重复显示）。

1. 调用 `merge_resources_into_plan(plan_markdown, research)` 把 Tavily 资料以纯 markdown 形式插入 `plan_markdown`：
   - **YouTube 视频**：插入到"## 深入理解"段之后的"## 推荐视频"小节，使用 `[![标题](缩略图 URL)](视频 URL)` 语法——ReactMarkdown 会渲染成可点击的缩略图（点击跳转 YouTube）
   - **网页资料**：追加到文末的"## 延伸阅读"小节，使用 `- [标题](url) — 摘要` 列表
2. 在 `course_content["external_resources"]` 顶层字段中保留结构化数据（含 `web_results`、`youtube_results`、`labxchange_results`）
3. **自动写入 DB**：`upsert_lesson()` 调用时，自动将 `external_resources` 中的所有资源同步到 `node_resources` 表，在前端右侧"外部资源"面板中展示

完整调用示例：

```python
from scripts.course_factory import search_labxchange_for_knode, research_knode

# Step 0.5: Tavily 搜索（每个节点都执行）
research = research_knode(knode, milestone, sub_project,
                          web_query="Mars terrain traversability analysis",
                          youtube_query="Mars rover terrain classification tutorial")

# Step 0.7: LabXchange 匹配（推荐用 for_knode 自动提取关键词）
lx_results = search_labxchange_for_knode(knode, top_k=3)

# Step 6a: 组装（research + labxchange 自动写入 DB 外部资源）
course_content = make_course_content(
    ...,
    research=research,
    labxchange_results=lx_results,
)
```

不需要任何额外步骤——`research` 和 `labxchange_results` 透传给 `make_course_content`，写入 DB 时自动同步到右侧外部资源面板。

### 质量要求

- **web_query** 要精准：带上项目领域 + milestone + knode 标题关键词（例如 `Mars HiRISE DEM stereo reconstruction`），避免只写 knode 标题
- **youtube_query** 必须用**英文**：Tavily YouTube 通道对中文查询命中率极低
- 不要把 research 结果直接贴进 plan_markdown 的叙述段落，让 `merge_resources_into_plan` 自动处理
- 如果 research 返回的 web_results / youtube_results 都是空的（例如查询词质量差），考虑换一个更通用的查询再跑一次
- 敏感话题不要联网（例如涉及个人隐私、政治等）

---

## Step 0.7: 外部资源发现（强制步骤）

**本步骤为强制步骤，每次生成课文都必须执行。**

LabXchange (哈佛大学) 拥有 22000+ 高质量教育资源，涵盖几乎所有 STEM 学科。在写 plan_markdown 之前，**必须**在 LabXchange 和 PhET 搜索与当前 knode 相关的资源，将优质资源作为外链或参考纳入课文。

### LabXchange Pathway 学科索引

以下是 LabXchange 的 pathway 主要学科领域及资源数量（截至 2026-04）：

| 学科 | 资源数 | 搜索 URL 模板 |
|------|--------|--------------|
| Biological Sciences | 856 | `https://www.labxchange.org/library?t=Subject%3ABiological+Sciences&t=ItemType%3Apathway` |
| Physics | 250 | `https://www.labxchange.org/library?t=Subject%3APhysics&t=ItemType%3Apathway` |
| Health Science | 235 | `https://www.labxchange.org/library?t=Subject%3AHealth+Science&t=ItemType%3Apathway` |
| Earth & Space Science | 228 | `https://www.labxchange.org/library?t=Subject%3AEarth+%26+Space+Science&t=ItemType%3Apathway` |
| Scientific Process | 213 | `https://www.labxchange.org/library?t=Subject%3AScientific+Process&t=ItemType%3Apathway` |
| Chemistry | 198 | `https://www.labxchange.org/library?t=Subject%3AChemistry&t=ItemType%3Apathway` |
| Environmental Science | 173 | `https://www.labxchange.org/library?t=Subject%3AEnvironmental+Science&t=ItemType%3Apathway` |
| Prepare For Careers | 171 | `https://www.labxchange.org/library?t=Subject%3APrepare+For+Careers&t=ItemType%3Apathway` |
| Science & Society | 156 | `https://www.labxchange.org/library?t=Subject%3AScience+%26+Society&t=ItemType%3Apathway` |
| Educator Skills | 132 | `https://www.labxchange.org/library?t=Subject%3AEducator+Skills&t=ItemType%3Apathway` |
| Data Science | 120 | `https://www.labxchange.org/library?t=Subject%3AData+Science&t=ItemType%3Apathway` |
| Global Health | 109 | `https://www.labxchange.org/library?t=Subject%3AGlobal+Health&t=ItemType%3Apathway` |
| Economics | 65 | `https://www.labxchange.org/library?t=Subject%3AEconomics&t=ItemType%3Apathway` |
| Learner Support | 40 | `https://www.labxchange.org/library?t=Subject%3ALearner+Support&t=ItemType%3Apathway` |
| Mathematics | 28 | `https://www.labxchange.org/library?t=Subject%3AMathematics&t=ItemType%3Apathway` |

### LabXchange 本地索引与搜索

已预先爬取全部 1467 个 LabXchange pathway 元数据到 `knowledge_base_doc/labxchange_pathways.json`，
`course_factory.py` 提供 `search_labxchange()` 函数用于本地匹配：

```python
from scripts.course_factory import search_labxchange, search_labxchange_for_knode

# 方式 1: 手动指定关键词（精准但容易选词不当导致 0 命中）
results = search_labxchange(
    keywords=["friction", "force", "motion"],
    subject_filter="Physics",   # 可选：按学科过滤
    top_k=5                     # 返回前 N 条
)

# 方式 2（推荐）: 从 knode 自动提取关键词搜索（不依赖人工选词）
results = search_labxchange_for_knode(knode, top_k=5)

for r in results:
    print(f"[{r['score']}] {r['title']}")
    print(f"  {r['url']}")
    print(f"  {r['description'][:100]}")
```

每条结果包含：`title`, `description`, `url`, `subject_tags`, `learning_objectives`, `score`

**兜底机制**：即使 Step 0.7 忘记调用或关键词不当导致 0 命中，`make_course_content()` 在 `labxchange_results` 为空且 `knode` 非空时会自动调用 `search_labxchange_for_knode(knode)` 补全，确保不会遗漏。

### 操作流程

1. 从 knode 的 `core_question`、`node_title`、`hands_on_components` 中提取 3-5 个英文关键词
2. 调用 `search_labxchange_for_knode(knode, top_k=5)` 获取匹配 pathway（或手动 `search_labxchange(keywords, ...)`）
3. 人工审查结果，选择 1-3 条最相关的 pathway
4. 在 plan_markdown 的"推荐互动资源"段落中插入外链：
   `- [LabXchange: {title}]({url}) -- {一句话说明与本课的关联}`
5. 如果 PhET 有对应的可嵌入 simulation，优先嵌入

### 可用的开放 Simulation 来源

| 来源 | 资源数量 | 许可证 | 嵌入方式 | 资源索引 |
|------|----------|--------|----------|----------|
| **PhET** (科罗拉多大学) | 160+ | CC-BY | iframe 直接嵌入 | https://phet.colorado.edu/en/simulations/filter |
| **Concord Consortium** | 数十个 | 开放 | iframe 直接嵌入 | https://concord.org/our-work/research-projects/ |
| **LabXchange** (哈佛) | 22000+ 混合资源 | 非统一许可 | 仅外链跳转 | https://www.labxchange.org/library |

### 使用策略

**策略 1: 直接嵌入 PhET/Concord simulation**

PhET 和 Concord 的 simulation 可以作为 `external_simulation` 类型的 idea 直接 iframe 嵌入课程：

```json
{
  "idea_id": "ext_sim_xxxx",
  "mode": "external_simulation",
  "topic": "摩擦力模拟器",
  "source": "phet",
  "embed_url": "https://phet.colorado.edu/sims/html/friction/latest/friction_all.html",
  "source_page": "https://phet.colorado.edu/en/simulations/friction",
  "license": "CC-BY-4.0",
  "context_summary": "PhET 摩擦力交互式模拟，学生可拖动物体观察不同表面的摩擦效果",
  "user_guide": "拖动上方的书本，观察原子间的摩擦力变化。尝试不同的材质组合。"
}
```

rendered_sections 中对应：

```json
{
  "ext_sim_xxxx": {
    "mode": "external_simulation",
    "status": "ready",
    "embed_url": "https://phet.colorado.edu/sims/html/friction/latest/friction_all.html",
    "html": null,
    "source": "phet",
    "license": "CC-BY-4.0",
    "user_guide": "拖动上方的书本..."
  }
}
```

PhET simulation URL 格式：
- 完整嵌入：`https://phet.colorado.edu/sims/html/{sim-name}/latest/{sim-name}_all.html`
- 中文版本（如有）：`https://phet.colorado.edu/sims/html/{sim-name}/latest/{sim-name}_zh_CN.html`

常用 PhET simulation 速查（与本项目相关）：

| Simulation | URL slug | 适用 knode |
|------------|----------|-----------|
| Friction | `friction` | 摩擦力、通行性 |
| Forces and Motion | `forces-and-motion-basics` | 力与运动 |
| Gravity Force Lab | `gravity-force-lab` | 重力 |
| Proportion Playground | `proportion-playground` | 比例尺 |
| Wave on a String | `wave-on-a-string` | 传感器信号 |
| Energy Skate Park | `energy-skate-park-basics` | 坡度与能量 |

**策略 2: 外链跳转（LabXchange 等封闭平台）**

LabXchange 不支持 iframe 嵌入，但其资源质量极高，可以作为**推荐外部资源**链接到 plan_markdown 中：

```markdown
## 推荐互动资源

如果想要更深入地体验摩擦力模拟实验，可以访问以下资源：
- [LabXchange: 摩擦力虚拟实验](https://www.labxchange.org/library/items/lb:LabXchange:xxx)
```

使用 `{{LABXCHANGE_xxx}}` shortcode 格式（需先在 `EXTERNAL_RESOURCE_URLS` 中注册）。

**策略 3: 参考设计，自研实现**

LabXchange 和 PhET 的 simulation 设计可以作为**参考蓝本**，用我们自己的 HTML canvas 重新实现：

1. 访问 LabXchange/PhET 的对应 simulation，观察交互模式和视觉设计
2. 提取核心交互逻辑（可调节的参数、可视化方式、反馈机制）
3. 用 animation_runtime.js（主课程）或自包含 HTML（theory）重新实现
4. 保留原始资源作为 `reference_url`，在代码注释中注明参考来源

### 操作步骤

1. 根据 knode 的 core_question 和学科领域，在 PhET 和 LabXchange 搜索相关 simulation
2. 评估找到的资源：
   - **完全匹配**（概念和难度都对）：直接嵌入（PhET）或外链（LabXchange）
   - **部分匹配**（概念对但难度/场景不对）：参考其设计自研
   - **无匹配**：跳过，继续用自研 animation/game
3. 在 plan_markdown 的适当位置插入 `[[IDEA:ext_sim_xxx]]`（嵌入）或推荐链接（外链）

### 质量标准

- PhET 嵌入时必须确认 simulation 存在且 URL 可访问
- 每个 knode 最多嵌入 1 个外部 simulation（避免喧宾夺主）
- 外部 simulation 不替代自研 animation/game，而是**补充**
- 必须提供 `user_guide` 告诉学生如何操作这个 simulation
- 注明许可证（PhET 是 CC-BY-4.0）

---

## Step 1: 撰写学习计划 (plan_markdown)

**你是**：一位资深项目制学习教育者，擅长把一个真实工程模块拆成学生可走通的学习路径。你不是写百科词条，是写"为了完成这个工程动作所需要的学习内容"。

**输入**（**v4.1 必须全部读取**）：
- `node_title`, `node_summary`, `difficulty_level`, `milestone.title`, `milestone.description`
- `knode.core_question`（核心驱动问题）
- `knode.hands_on_components`（学生必须亲手做的动作列表）
- `knode.acceptance_artifacts`（必须交付的作品）
- `knode.acceptance_standard`（验收标准）
- `knode.outputs_produced`（本模块产出物名称）
- `sub_project.brief`, `sub_project.core_problem`, `sub_project.task`（阶段目标与工程背景）

**输出**：800-1500 字的 Markdown 学习计划

**格式要求**：

```markdown
## 学习目标

[3-5 条具体可衡量的学习目标，用"能够..."开头]
[**每条目标必须对应一条 acceptance_standard 或 hands_on_components**]
[示例对应关系：
 - 目标 "能够圈出至少 20 张样例图中的危险区域并写出理由" → 对应 hands_on_components "在样例图上手工圈出危险区域并写理由"
 - 目标 "能够将观察笔记整理成报告并被教师打开检查" → 对应 acceptance_standard "提交的笔记能够被教师或同伴直接打开、检查或运行"]

## 引入：[引人入胜的标题]

[**必须以 knode.core_question 作为引导问题**，100-200 字]
[结合 sub_project.core_problem / sub_project.task 说明"为什么这个问题在这个阶段里值得被回答"]
[禁止脱离项目上下文写通用科普导入]

## 核心概念：[标题]

[知识点的科学严谨解释，200-400 字]
[包含关键术语的定义]
[如果涉及数学公式，用 LaTeX 标注：\(F = ma\)]

## 深入理解：[标题]

[进一步展开，包含示例、对比、或推导过程，200-400 字]
[**必须显式呼应 hands_on_components**：在叙述中说明学生将要手动执行的工程动作与本段概念的关系]

## 应用与拓展

[**必须围绕 acceptance_artifacts 展开**：告诉学生本节学完之后要完成哪些具体交付物，以及这些交付物长什么样，100-200 字]

## 推荐互动资源

[**强制段落**：列出 Step 0.7 中找到的 LabXchange/PhET 相关资源链接]
[格式：`- [资源标题](URL) -- 一句话描述资源内容和使用方式`]
[至少列出 1 条 LabXchange pathway 或 PhET simulation 链接]
[如果确实没有相关资源（非 STEM 类 knode），标注"本节暂无推荐外部资源"并说明原因]

## 学习路径建议

[本节产出物（outputs_produced）如何被下一个模块消费，50-100 字]
[如果 knode 有下游依赖，说明 handover 方向]
```

**质量标准**：
- 科学内容必须准确，公式、数据不能有错
- 语言面向 age_range 年龄段学生，不要过于学术化
- 每段都要有具体例子或类比
- 渐进式难度，从直觉到严谨
- **工程性约束（v4.1 新增）**：
  - 每条学习目标必须可回溯到一条 `acceptance_standard` 或 `hands_on_components`
  - 引入段必须出现 `core_question` 或其等价改写，不能凭空换题
  - 应用段必须点名 `acceptance_artifacts` 中的作品标题
  - 如果 knode 的 `module_role` 是 `foundation`，plan_markdown 侧重认知锚定与观察训练；如果是 `core` / `deepening`，侧重方法与工具；如果是 `synthesis` / `capstone`，侧重整合和交付
- **禁止脱项**：在 plan_markdown 顶部必须出现 `> Module: {module_id} · {module_role}` 一行引用块，让人能一眼看出这节课挂在项目的哪个工程模块上
- **外部资源链接必须使用 shortcode**：plan_markdown 中引用项目级外部数据集/工具/论文时，**禁止硬编码完整 URL**，必须使用 `{{KEY}}` shortcode。`make_course_content()` 入口会自动将 shortcode 替换为 `[title](url)` 格式的 Markdown 链接。
  - 可用 shortcode 列表定义在 `course_factory.py` 的 `EXTERNAL_RESOURCE_URLS` 常量中
  - 示例：写 `{{AI4Mars}} 数据集` 而不是 `[AI4Mars](https://data.nasa.gov/...)`
  - 示例：写 `从 {{curiosity_raw}} 下载` 而不是 `[Curiosity 原始图像库](https://mars.nasa.gov/...)`
  - 如果需要引用注册表中没有的 URL，先在 `EXTERNAL_RESOURCE_URLS` 中注册，再使用 shortcode
  - 当前注册表包含（KEY 不区分大小写）：
    - `ai4mars` — AI4Mars 数据集
    - `ai4mars_paper` — AI4Mars 论文 (CVPR 2021)
    - `curiosity_raw` — Curiosity 原始图像库
    - `perseverance_raw` — Perseverance 原始图像库
    - `curiosity_navcam` — Curiosity Navcam
    - `mastcamz` — Perseverance Mastcam-Z
    - `hirise` — HiRISE
    - `pds_imaging` — NASA PDS Imaging Node

---

### Step 1 特殊分支：大作业节点 (module_role = capstone)

当 `knode.module_role == "capstone"` 时，plan_markdown **不采用**上面的课程教学模板，而是改写为**作业说明书**格式。大作业节点的核心定位是"交付物驱动"，不是"知识传授驱动"——学生在此前的若干节点中已学会所有必要知识，这里的任务是整合运用并产出一份可提交的作品。

#### 大作业 plan_markdown 模板

```markdown
> Module: {module_id} · capstone

# {knode.title}

> {knode.core_question}

---

## 项目背景

[简述本大作业的背景和意义，50-100 字。说明学生到目前为止已经学到了什么，为什么需要这个大作业来整合所学。]

## 交付物清单

你需要提交以下作品（可打包为 ZIP 文件上传）：

| # | 交付物 | 格式要求 | 数量/规格要求 | 对应验收标准 |
|---|--------|---------|-------------|-------------|
[从 acceptance_artifacts 和 acceptance_standard 逐条填写。每行一个交付物，格式要求从 artifact.format 推断，数量/规格从 acceptance_standard 提取具体数字]

## 制作步骤

[按 hands_on_components 的逻辑顺序，给出 3-6 个操作步骤，每步 50-150 字。每步必须：]
[1. 说清楚"做什么"和"用什么工具/材料"]
[2. 给出可量化的完成标志（如"至少 6 张""至少 4 种"）]
[3. 提供一个小提示或参考示例]

### 步骤 1: [动作名称]
[描述...]

### 步骤 2: [动作名称]
[描述...]

[... 按需继续]

## 评分标准

你的作品将按以下标准评价：

| 维度 | 优秀 | 合格 | 需改进 |
|------|------|------|--------|
[从 acceptance_standard 每条拆解为一个评分维度，给出三档描述]

## 提交说明

- 将所有文件放入一个文件夹，打包为 ZIP 上传
- 文件命名建议：`{artifact_title}_{你的名字}.zip`
- 提交后可获得 AI 导师的自动反馈

## 参考资料与灵感

[推荐资源 shortcode / 前面节点中学到的关键知识回顾 / 优秀范例描述]
```

#### 大作业节点的富媒体策略

大作业节点的富媒体类型与普通教学节点不同：

| 类型 | 策略 |
|------|------|
| animation | **1 个引导动画**，展示完成作品的整体流程或范例效果，帮助学生建立"最终成果长什么样"的心理图像 |
| game | **1 个分类/排序小游戏**（可选），作为"热身复习"帮学生回忆前面学过的关键知识 |
| theory | **0 个**，大作业不引入新理论 |
| exercise | **0 个**，大作业不做即时检测，考核通过提交面板完成 |
| hands_on_kit | 不适用 |
| image/diagram | 可选，用于展示参考范例 |
| youtube | **0 个**，大作业节点不搜索外部视频 |
| labxchange | **0 个**，大作业节点不关联外部互动路径 |

#### 大作业不适用的规则

- Step 1 的"渐进式知识讲解"结构不适用（大作业不教新知识）
- 强制的 theory 数量下限不适用
- difficulty × module_role 的 animation/game 数量矩阵不适用，改用上表固定策略

---

## Step 1.5: 标注基础理论 (Theory Tags)

**你是**：一位跨学科教育设计师，能从工程项目内容中识别出底层的数学、物理、化学、生物等基础学科原理，并将它们标注出来供学生按需展开学习。

### 什么是基础理论标注

工程项目的课程内容以"做事"为主线，但做事背后往往依赖基础学科知识。例如：
- 讲"通行性分析"时，背后是**摩擦力**和**坡度角**（物理）
- 讲"坐标定位"时，背后是**笛卡尔坐标系**（数学）
- 讲"地形扫描"时，背后是**光的反射与散射**（物理/光学）
- 讲"风险评级"时，背后是**概率与统计**（数学）

这些基础理论不应打断工程叙事的主线，而是作为**可展开的旁注**嵌入 plan_markdown 中。学生在阅读工程内容时，看到"基础理论"图标，可以选择展开学习底层原理，也可以跳过继续工程主线。

### 操作步骤

1. **识别理论点**：通读 Step 1 生成的 plan_markdown，找出 2-5 个可以追溯到基础学科的知识点
2. **撰写理论内容**：为每个理论点写一段 100-300 字的 Markdown 解释，包含：
   - 理论名称和所属学科（如"摩擦力 -- 物理"）
   - 核心原理的简明解释（面向 age_range 年龄段）
   - 与当前工程内容的关联（"这就是为什么..."）
   - 可选：一个简单的公式或示意图描述
3. **插入占位符**：在 plan_markdown 中相关段落的末尾插入 `[[THEORY:theory_id]]` 占位符
4. **构建 theories 列表**

### Theories 列表格式

```json
[
  {
    "theory_id": "theory_friction_basics",
    "title": "摩擦力",
    "subject": "physics",
    "body_markdown": "(K1 版本，最浅显的默认内容)",
    "level_bodies": [
      {"level": "K1", "body_markdown": "摩擦力就是你走路时脚底和地面之间的阻力...（纯生活类比，无公式）"},
      {"level": "K3", "body_markdown": "## 摩擦力\n\n公式：$f = \\mu N$...（可含字母公式）"},
      {"level": "K5", "body_markdown": "## 摩擦力\n\n库仑摩擦模型 + 动静摩擦分析...（大学级）"}
    ],
    "animation_html": "<!DOCTYPE html>...(可选，自包含 HTML 动画)...",
    "related_paragraph": "在 plan_markdown 中对应的段落标题或关键句"
  }
]
```

**字段说明**：

| 字段 | 说明 |
|------|------|
| `theory_id` | 唯一 ID，格式：`theory_{学科缩写}_{关键词}`，如 `theory_phys_friction` |
| `title` | 理论名称，5 字以内，如"摩擦力""坐标系""概率" |
| `subject` | 所属学科：`math` / `physics` / `chemistry` / `biology` / `cs` / `geography` / `other` |
| `body_markdown` | 默认内容（= K1 版本），100-300 字，向后兼容 |
| `level_bodies` | **必填**。按知识等级提供多个版本的 body_markdown（见下方"知识等级"） |
| `animation_html` | 可选。自包含浅色主题 HTML 动画，用于可视化展示理论概念。前端以 iframe 嵌入在毛玻璃弹窗左侧（7/12 列宽） |
| `related_paragraph` | 对应 plan_markdown 中的段落标题或关键句，便于定位 |

### 知识等级 (Knowledge Level)

每个 theory 必须提供**至少两个等级**的 body_markdown（K1 必选，另选 1-2 个更高等级）。
前端根据项目设置中的 `knowledge_level` 自动选择对应等级显示，回退到最近的低等级。

**不同等级的区别在于"表达方式与公式深度"，不是字数**。低等级零公式全类比，高等级可引入严谨的数学工具。但每个等级都必须是"完整学习材料"——把概念本身讲透，而不是一句话定义。

| 等级 | 名称 | 表达方式与公式深度 |
|------|------|-------------------|
| `K1` | 小学低年级 (1-3年级) | **必选**。**零公式、零字母符号**。只能用生活类比、具体事物和画面描述。可说"两边一样大，飞机就不会歪"，不可写 $F_{left}=F_{right}$。结构：(1) 生活场景引入 (2) 用多个类比与例子完整讲清"是什么 / 为什么 / 有什么表现 / 和什么不同" (3) 关联项目场景。自检：6 岁小朋友读完能向别人解释这个概念吗？ |
| `K2` | 小学高年级 (4-6年级) | 允许简单四则运算（加减乘除、分数、百分比）。可以出现简单变量名（"速度 = 距离 ÷ 时间"），但不使用上下标、希腊字母、代数符号。可加入简单分类/对比表格。 |
| `K3` | 初中 | 允许代数公式（$f = \mu N$、$v = v_0 + at$），必须解释每个符号含义。可用一次函数、简单几何、比例式。加入严格定义、分类体系、典型例题。**不**使用三角函数推导、向量分解、微积分。 |
| `K4` | 高中 | 允许三角函数（$\sin\theta$、$\cos\theta$）、向量分解、受力分析、动量/能量守恒、概率统计、指数对数。可做严谨的代数/几何推导，用图示解释机理。**不**使用微积分符号（∫、$\mathrm{d}x$）或线性代数矩阵运算。 |
| `K5` | 大学 | 允许微积分（$\int$、$\frac{\mathrm{d}}{\mathrm{d}t}$）、线性代数（矩阵/特征值）、概率论（期望/方差/分布）、微分方程、学术级论述。可给出完整推导、适用条件、反例、与相邻概念的关系。 |

**核心判别**：判断一段文字是否达到某个等级，**看它用的数学工具和表达方式**，不看它多长。一段 300 字讲透"两边一样重、飞机不会歪"的 K1 解释是合格的；一段 1500 字但全是一句话定义堆出来的 K4 是不合格的。

**匹配项目的 knowledge_level**：项目 `knowledge_level` 设为什么等级，就**必须**提供那个等级的 `body_markdown`。K1 始终必选。规则：K1 + 项目等级（若 > K1）；若项目等级 ≥ K4 且跨度太大，补一个中间等级让低年级用户也能看到合适版本。

**核心原则**：

- **这是学习材料，不是名词解释**：每个 theory 的 body_markdown 是学生学习这个概念的**完整教材**，不是词典里的一行定义。写完后自检：学生只读这一段 body_markdown，能否真正理解这个概念？如果不能，继续补充。篇幅不设上限。
- **先解释概念本身，再关联项目**：每个等级的 body_markdown 必须先**完整、充分地解释概念本身**（用多个生活类比、具体例子、对比说明），然后才关联项目场景。错误示例：K1 里"风化是岩石在原地被破碎的过程。**火星上没有流水但有强风...**"——一句话定义后就跳到项目了，读者对"风化"本身还没理解。正确做法：先用生活类比把概念讲透（你家墙壁被雨水泡、石头被风吹日晒、冰冻融化把石缝撑裂...），讲清楚风化和侵蚀的区别，再关联项目。
- `body_markdown`（顶层字段）的内容必须与 K1 版本一致，确保向后兼容
- K1 版本**绝对不能**出现：$g=9.8$、$W=mg$、$f=\mu N$、$\sin$、积分号等任何数学符号
- 每个等级版本独立完整，不依赖其他等级的内容
- 同一个概念在不同等级的解释角度可以不同（K1 用类比，K3 用公式，K5 用推导）

### Theory Animation 视觉规范（Cognitive Sanctuary 浅色主题）

Theory animation **不使用** `animation_runtime.js`（那是主课程深色主题），而是纯自包含 HTML，采用与主站一致的 **Cognitive Sanctuary 浅色主题**。

**参考实现**：`scripts/test_theory_friction.html`

#### 配色

| 角色 | 色值 | 用途 |
|------|------|------|
| 背景 | `#f8f5ff` → `#f1efff` 渐变 | Canvas 背景，与主站 surface 一致 |
| 网格线 | `rgba(158,166,255,0.12)` | 30px 间距的辅助网格 |
| 主体物 | `#6a1cf6` → `#5000c8` 渐变 | primary 色，用于方块/焦点物体 |
| 力/向量箭头 | `#6a1cf6`（施加力）/ `#b41340`（摩擦力/阻力）/ `#006859`（法向力/支持力）| 分别对应 primary / error / secondary |
| 标注文字 | `#19227d`（标题）/ `#4953ac`（副文字）/ `#9ea6ff`（辅助线标注）| 对应 on-surface / on-surface-variant / outline-variant |

#### 布局与字体

```
- 字体：Plus Jakarta Sans（标题/数据，800/700）+ Inter（正文，400/500）+ Manrope（标签/HUD，500/600/700）
- Canvas 100vh flex 列布局：canvas(flex:1) + controls + hud
- 控件栏背景：#f1efff（surface-container-low）
- 主按钮：linear-gradient(135deg, #6a1cf6, #ac8eff) + 白色文字 + shadow-primary/25
- 次按钮：bg #e6e6ff，color #4953ac（ghost 风格）
- HUD 标签：Manrope 9px uppercase tracking-0.12em，color #4953ac
- HUD 数值：Plus Jakarta Sans 14px 700，color #6a1cf6
```

#### 毛玻璃公式面板

在 Canvas 内部右上角绘制一个半透明公式面板：

```
- 背景：rgba(255,255,255,0.6)，圆角 8px
- 标题：Manrope 9px 700 uppercase，color #6a1cf6，文案"MATHEMATICAL FORMULA"
- 公式：Times New Roman italic 20px，color #19227d
- 当前参数高亮：Plus Jakarta Sans 12px 700，color #b41340
```

#### 与主课程 animation 的区别

| | 主课程 animation | Theory animation |
|--|-----------------|-----------------|
| 主题 | 深色（animation_runtime.js 10 种 palette） | 浅色 Cognitive Sanctuary |
| 运行时 | 依赖 animation_runtime.js | 纯自包含，不依赖外部 JS |
| 帧数 | 4-6 帧 | 2-4 帧，聚焦单一概念 |
| 内容 | 项目场景（火星地形、传感器数据等） | 纯理论图形（力学图、坐标系、示意图等） |
| 交互 | 帧控制 + HUD + 观看指南面板 | 帧控制 + HUD（简化，不需要观看指南） |
| 嵌入方式 | rendered_sections + [[IDEA:...]] | theories[].animation_html + [[THEORY:...]] |

#### 适用判断

不是每个 theory 都需要 animation。适合加 animation 的：

- 力学/运动/向量（箭头、方块滑动、力的对比）
- 坐标系/几何（网格、点的定位、距离计算）
- 波动/振动/周期（正弦波、频率对比）
- 化学反应/分子结构（粒子运动、键的断裂）

不需要 animation 的：
- 纯定义类（如"什么是标度"）
- 纯文字/表格能讲清楚的概念
- 过于抽象无法可视化的（如"科学方法论"）

### 质量标准

- **不打断主线**：理论标注是旁注，plan_markdown 的工程叙事即使删掉所有 `[[THEORY:...]]` 也必须完整通顺
- **精准定位**：`[[THEORY:...]]` 必须插在**第一次出现相关概念**的段落末尾，不要在后续重复插入
- **多等级适配**：每个 theory 必须提供 `level_bodies` 数组，K1 必选；`body_markdown` 顶层字段等于 K1 版本
- **数量适度**：每个 knode 一般 2-5 个理论标注，不超过 5 个（避免喧宾夺主）
- **禁止凑数**：如果某个 knode 的内容确实没有可追溯的基础理论（纯方法论/项目说明节点），可以 0 个

### 占位符示例

```markdown
## 核心概念：通行性分析

通行性就是回答一个问题：这个地方，走得过去吗？...
地面的硬度和粗糙度直接影响你能不能安全通过。

[[THEORY:theory_phys_friction]]

## 深入理解：用眼睛给场景"涂色"

做通行性标注时，你需要判断坡度...
```

---

## Step 2: 抽取 Ideas + 插入占位符

**你是**：一位教育媒体策划师，判断哪些知识点最适合用富媒体呈现。

**从 Step 1 的 plan_markdown 中识别适合做富媒体（animation/game）的知识点，加上 exercise。**

exercise 必须有。animation 和 game 的数量不设上限，即使是简单的入门节点，也可以为儿童提供有趣的动画和互动游戏来增强学习体验。根据内容特点自由决定数量和类型。

### v4.1 强制约束：对齐验收 & 动手动作

在数量/模式决策之前，先做两个验收对齐：

1. **exercise 必须可追溯到 acceptance_standard 或 hands_on_components**
   - 选择题/填空题/简答题的题干必须直接检验一条验收标准，例如：
     - acceptance_standard = "学生能够现场说明本模块至少两项动手动作" → exercise 出一道多选题列出候选动作让学生选本模块真正做过的
     - hands_on_components = "在样例图上手工圈出危险区域" → exercise 给出 1 张图片问"如果是你，你会把红框画在以下哪个区域？"
   - **禁止出通用科普题**（例如"下面哪个行星最大"这种与本节工程动作无关的题）
2. **至少一个 idea（exercise 或 game）必须覆盖 hands_on_components 中的一项动作**
   - 如果 hands_on_components 有 3 条，理想情况下 ideas 整体覆盖 ≥ 1 条（难度 1-2）、≥ 2 条（难度 3-4）、全部（难度 5）
3. **game 的 game_concept 必须映射到 acceptance_artifacts 里的一个产物或一项 hands_on 动作**
   - 反例：acceptance_artifacts = "火星图像风险观察笔记" 时，不应做一个"炼金术合成反应"的 game
   - 正例：做一个 drag_sort game 让学生把 20 张图分类到"可通行/危险/未知"三个桶里，直接对应交付物

### 数量决策

animation 和 game 的数量**不设硬性上限**。任何难度和角色的节点都可以自由创建 animation 和 game，只要它们对学习有帮助。即使是 difficulty=1 的入门节点，也鼓励为儿童提供生动的动画演示和互动游戏。

**animation 和 game 的 HTML 代码行数同样不设上限。** 只要能把概念表达清楚、有吸引力，animation 可以和 game 一样长（几百甚至上千行）。不要因为"会写很长"而缩减设计。复杂的多帧、多层动画、丰富的交互元素、详细的 HUD 数据面板都是被鼓励的。浅薄比冗长更糟糕。

**核心原则：根据内容特点自由决定数量和类型。有的节点适合多个 animation（多个可视化流程），有的适合多个 game（多种互动维度），有的一个 game + exercise 就够了。exercise 至少 1 个。**

### Mode 选择规则

| Mode | 适合场景 | 约束 |
|------|---------|------|
| `animation` | 动态过程、物理/化学变化、算法步骤、时序流程 | 数量不限，按需创建 |
| `game` | 互动操作、参数调节、因果探索、分类排序 | 数量不限，按需创建 |
| `exercise` | 检测理解、巩固记忆 | **必须有** 1 个 |
| `story` | 抽象概念引入、历史背景、类比解释 | 可选 |
| `image` | 真实照片（NASA/Wikimedia/USGS CC-BY/CC0） | 可选，成本低 |
| `diagram` | 静态示意图（HTML/SVG）—— 坐标系、流程图、对比图 | 可选，成本低 |

**注意：theory（基础知识）不是 Step 2 的 `ideas[]` 产物**，它由 Step 1.5 产出写入 `course_content.theories[]`。但在本步的 Debate 里仍要把 theory 作为富媒体的一员一起评审，确保"这节课涉及哪些基础物理/数学/化学"被明确记下来——否则前端右侧富媒体栏就会缺"基础知识"这一项。

**富媒体完整清单（与前端右侧栏一致）**：`theory` · `animation` · `game` · `image` · `diagram` · `youtube` · `labxchange`。exercise 是评测而非呈现媒介，不计入富媒体栏。

**优先级**：game > animation > story。如果只选 1 个富媒体，优先选 game（互动性最强）。

### Game Ideation Patterns（game 创意模式库）

**硬规则：Step 2 抽取 game idea 时必须先从本库中选一个主模式。** 如果必须退回到 Pattern X（判断类），Debate 阶段要显式说明"为什么这个知识点只能用判断类玩法",并给出无法用 simulation/sandbox 实现的具体理由。

下面 10 个模式按"可玩性与认知深度"排序（越前越优先）。它们的共同特征是**玩家通过操纵一个动态系统来内化知识**，而不是"判断对错再点一下"。

#### Pattern 1 — Sandbox Simulation（沙盒仿真）

玩家调节 2-5 个参数，系统按真实物理/规则实时运行，玩家必须理解参数对结果的影响才能达成目标。
- **认知动作**：形成/验证关于"参数 → 结果"的心智模型
- **交互结构**：滑块/输入 → 实时运行的可视化引擎 → 结果反馈（成功/失败/距离目标）
- **适合知识点**：物理定律、控制系统、生态平衡、经济机制、化学反应条件
- **示例**：火箭发射模拟器（调推力/倾角/燃料，观察轨道）；细胞渗透压仿真（调离子浓度，观察细胞膨胀/收缩）
- **反例**：把"选对参数"做成选择题 → 已经退化成 Pattern X

#### Pattern 2 — Build & Test（建造与测试）

玩家从零件库中拼接一个方案（机械/电路/代码/流程），然后按"运行"让它在真实规则下执行，观察是否达成目标。
- **认知动作**：拆解目标 → 组合原件 → 根据失败反馈迭代
- **交互结构**：零件 palette → 拖拽拼接区 → Run 按钮 → 仿真执行
- **适合知识点**：电路、机械传动、数据管线、算法流程、有机化学合成路径
- **示例**：用齿轮/杠杆搭一个能把重物举起的装置；用积木拼一个图像处理管线把火星图切成 8x8 网格
- **反例**：提供"正确答案"模板让玩家拖到对应位置 → Pattern X

#### Pattern 3 — Causal Chain Discovery（因果链发现）

系统有隐藏规则，玩家通过反复实验推断规则是什么。每次实验给出数据，玩家逐步收窄假设空间。
- **认知动作**：假设 → 实验 → 观察 → 修正假设
- **交互结构**：多变量面板 + 实验日志 + "我猜规则是 X"提交框
- **适合知识点**：科学方法、隐藏变量分析、机器学习特征选择、化学反应条件
- **示例**：玩家调整 3 个火星样本特征（颜色/反光/形状），仿真告知"可通行概率"，要求推出哪个特征决定结果
- **反例**：把规则写在说明里让玩家执行 → 毫无探索

#### Pattern 4 — Resource Management（资源管理 / 决策权衡）

有限预算 + 多个冲突目标 + 时间压力。玩家每一步决策都要权衡"牺牲什么换什么"。
- **认知动作**：量化权衡、优化多目标、规划顺序
- **交互结构**：资源条（电量/时间/存储）+ 行动菜单 + 目标列表 + 回合推进
- **适合知识点**：项目管理、工程约束、生态承载力、经济学取舍
- **示例**：火星车每日任务调度——电量只够 3 个动作，拍照/行驶/采样/通信如何分配
- **反例**：给一份"最优方案"让玩家复刻

#### Pattern 5 — Detective / Diagnosis（侦查与诊断）

呈现一组线索（传感器读数、样本数据、错误日志），玩家通过排查、对比、排除诊断根因。
- **认知动作**：差异分析、排除法、证据链推理
- **交互结构**：线索面板（可切换/放大/标注）+ 假设列表 + "提交诊断"按钮，错误诊断消耗尝试次数
- **适合知识点**：故障排查、医学诊断、代码 debug、科学异常分析
- **示例**：火星车无法前进——查四路传感器读数、电机电流、温度，找出是轮胎卡石头还是电池故障
- **反例**：把候选项列出来让玩家选对的那个

#### Pattern 6 — Live Tuning / Real-Time Control（实时调参 / 实时控制）

玩家控制一个正在运行的动态系统，必须实时调整才能维持目标（倒立摆、追踪目标、保持温度）。
- **认知动作**：感知 → 响应 → 校正的闭环
- **交互结构**：实时画面 + 控制按钮/滑块 + 瞬时反馈
- **适合知识点**：反馈控制、PID、机器人控制、生理稳态
- **示例**：实时调整方向盘让火星车沿预定路径走，地面起伏会造成偏航；手动调加热功率让培养箱维持 37°C
- **反例**：让玩家"选择合适的参数值"（这是 Pattern X）

#### Pattern 7 — Strategy Map / Path Planning（策略地图 / 路径规划）

在一张地图（或图结构）上规划路径或资源布局，每一步都有代价/收益，最终评估方案质量。
- **认知动作**：搜索空间、权衡路径、预见后果
- **交互结构**：地图 + 可选节点/道路 + 累计代价显示 + 提交方案按钮
- **适合知识点**：图算法、地理决策、运筹学、基础生态学
- **示例**：给火星车规划从着陆点到目标点的路径，地形有斜坡/沙丘/岩石，每种地形消耗不同能量，要求在能量限制内找可行路径
- **反例**：把最优路径高亮让玩家拖节点过去

#### Pattern 8 — Construction Language / Visual Programming（构造型语言 / 可视化编程）

玩家用"积木块"或可视化指令拼出一段程序，让角色/机器人/系统执行任务。本质上是微型编程环境。
- **认知动作**：把目标分解成可执行指令，理解指令的顺序与组合
- **交互结构**：积木库（指令）+ 拼装区 + 运行按钮 + 角色执行动画
- **适合知识点**：算法思维、顺序/分支/循环、机器人指令、任务分解
- **示例**：用"前进/转弯/拍照"积木让火星车访问 5 个采样点；用"筛选/排序/分组"积木处理一批样本数据
- **反例**：提供已拼好的积木序列让玩家复制

#### Pattern 9 — Experimental Design（实验设计）

给定一个待验证的科学问题和一组可用工具，玩家设计实验（选变量、设对照、定样本量），系统按科学规则反馈结果有效性。
- **认知动作**：控制变量、对照组、可重复性、样本量
- **交互结构**：问题陈述 + 变量面板（选哪些作为自变量）+ 对照设置 + 执行 + 统计结果
- **适合知识点**：科学方法论、统计学基础、药物试验设计
- **示例**：证明"阳光强度影响火星苔藓生长"——玩家要选择变量、对照组和测量指标，错误设计会得到无效结果
- **反例**：直接告诉玩家实验步骤让他点"开始"

#### Pattern 10 — Role-Play Simulation（角色扮演仿真）

玩家扮演一个真实角色（任务调度官、医生、航天工程师），在多轮决策中推进故事，每个决策有后果并解锁新事件。
- **认知动作**：在有限信息下做职业化决策
- **交互结构**：情境文本 + 多选项决策 + 状态条（声望/资源/时间）+ 后续情节分支
- **适合知识点**：工程决策、医学伦理、项目管理、历史还原
- **示例**：扮演火星车任务官，每天选择任务，天气/能量/故障会动态影响选项
- **反例**：把剧情做成线性选择题

#### Pattern X — Classification / Matching（分类与匹配）【降级使用】

玩家把对象拖到正确的桶里、匹配正确的标签。**除非知识点本质上就是"学会识别 N 个类别"（例如"认识 5 种火星地貌"），否则不允许选用 Pattern X**。在 Debate 阶段必须写明"这个知识点的本质要求就是分类"。即使采用 Pattern X，也要加入至少一个以下"活化"机制：
- 数据来自真实源（NASA 图像），而不是卡通化的手绘
- 分类后要对被分类的对象写一句理由，系统记录
- 分类完后进入 Pattern 4/5 的后续阶段（例如：把火星样本分类后，再用"诊断"模式找出错误分类的原因）

### Pattern 选择流程（Step 2 强制）

1. 读 knode 的 `core_question`、`hands_on_components`、`acceptance_artifacts`
2. 依次检查 Pattern 1-10：哪一个最贴合这个知识点？给出 1-2 行理由
3. 如果 Pattern 1-10 全都不合适，才允许降级到 Pattern X，且 Debate 必须解释为什么
4. 写到 `mode_reason` 字段里，格式：`Pattern {N} ({name}): {why this fits}`

### Step 2.5: Ideation Divergence（创意发散，强制）

**为什么存在这一步**：第一个想到的创意通常是最平庸的。只选一个 Pattern 就动手会写出"能交差但没人想再玩一次"的作业。这一步强制产生候选方案池后再挑。

**规则**：

1. 每个 animation / game 产出前，必须先列 **3 个不同 Pattern 的候选方案**（game 必须跨 3 个 Pattern；animation 必须跨 3 种呈现模式：剖面图 / 时间序列 / 参数扫描 / 尺度对比 / 因果反演 / ...）
2. 每个候选方案用 2-3 句写清 pitch，必须覆盖：
   - 玩家/观众做什么
   - 在屏幕上看到什么
   - **why this is cool（为什么比平庸版本好）**
3. 三个方案应该**真的不同**（不是"同一个玩法换皮"），如果三个方案本质相同，说明思考不够
4. 从 3 个里挑 1 个，写明**"选这个 reject 另外两个的理由"**

### Step 2.6: Creativity Gate（创意闸门）

在选定方案之后、动手实现之前，方案必须通过以下 4 问：

1. **Subtract test（减法测试）**：去掉任意一个核心元素还能玩吗？如果能，则该元素多余；如果完全不能玩，说明设计紧致
2. **Replay test（重玩测试）**：玩完的那一刻，孩子会说"再来一次"还是"下一页"？如果是后者，加入变量/随机性/排行榜
3. **Surprise test（惊喜测试）**：有没有一刻是"结果超出玩家预期"？（系统做了玩家没要求的事、规则涌现出玩家没被告知的行为）如果全程可预测，加一个涌现机制
4. **Aha test（顿悟测试）**：玩完后，孩子会永远记住的"原来如此"时刻是什么？写一句话。如果写不出，重新设计

**4 问任意一项写不出合格答案时，不许进入 Step 5，回到 Step 2.5 重新发散。**

### Debate 强化（game 专项）

Step 4 Debate 时对每个 game idea 问一次："**这个 game 要求玩家操纵一个动态系统吗？还是只是判断题的变装？**" 如果是后者，必须重做或写明不可避免的理由。

**何时用 image / diagram 替代或补充 animation**：

- **image（真实照片）**：当知识点需要看到"真实的样子"而非"动态过程"时——例如火星车长什么样、NASA 某张标志性火星地貌图、真实的实验装置。可以用 `make_course_content(..., images=[...])` 下载后内联展示。来源必须是 CC-BY/CC0（NASA/JPL、ESA、USGS、Wikimedia Commons），每张图必须提供 `source_url` 和 `license`。
- **diagram（HTML/SVG 示意图）**：当知识点是静态的概念对比、结构分层、流程图或几何关系时，一张不动的示意图比一段动画更清晰。写成本地 HTML 文件（遵循动画的深色主题或浅色主题皆可），通过 `make_course_content(..., diagrams=[{"html_path": ..., "topic": ...}])` 嵌入。diagram 比 animation 成本低（不需要 totalFrames / 帧间过渡），适合作为 animation 的补充。
- **image/diagram 不计入 hands_on_components 覆盖**：它们不参与 v4.1 preflight 的 hands_on/acceptance 校验——只是辅助呈现，真正满足验收的仍然是 game/animation/exercise。
- **推荐组合**：对于低难度节点（d=1 概念类），可以考虑 `1 image + 1 game + 1 exercise`，比传统的 `1 animation + 1 exercise` 更高效且互动性更强。

### Style Key 选择（10 个可用主题）

| style_key | 适合领域 |
|-----------|---------|
| `aether_clinic` | 医学、神经科学、人体解剖、生理学、健康科学 |
| `ares_mission` | 航天、火箭、天文、物理、行星科学、地质 |
| `celestial_observatory` | 天文、宇宙、恒星、黑洞、引力、光学 |
| `helix_lab` | 基因、DNA、细胞、微生物、生物化学、遗传学 |
| `neural_circuit` | 计算机科学、AI、机器人、电路、编程、数据结构 |
| `subatomic_matrix` | 量子物理、粒子物理、原子结构、波动力学、化学键 |
| `rocketry_control` | 火箭工程、推进系统、轨道力学、工程力学 |
| `aqua_flow` | 海洋科学、水文、流体力学、化学溶液、环境科学 |
| `ember_forge` | 地质学、火山、地球内部结构、冶金、热力学、化学反应 |
| `flora_pulse` | 植物学、光合作用、生态系统、农业、食物链、进化论 |

### 操作

1. 为每个 idea 生成唯一 ID（格式：`{mode}_{timestamp}_{4位随机字母}`）
2. 在 plan_markdown 中找到对应知识点的段落，在段落末尾插入 `[[IDEA:{idea_id}]]` 占位符
3. 输出 ideas 列表

### Ideas 列表格式

每条 idea **必须附带 `hands_on_ref` 和 `acceptance_ref` 字段**（v4.1 新增），用于说明这条 idea 对应哪个动手动作和哪条验收标准，不能凭空创作。

```json
[
  {
    "idea_id": "game_1712000000_abcd",
    "mode": "game",
    "style_key": "ares_mission",
    "topic": "火星车越野仿真",
    "context_summary": "学生在一张真实火星地形图上规划火星车路线，系统用能耗/坡度/岩石密度三个变量实时仿真，学生必须调整路线和速度让车辆在电量耗尽前到达目标；失败会看到火星车在哪一步抛锚",
    "mode_reason": "Pattern 1 Sandbox Simulation: hands_on_components 要求学生理解地形对通行性的影响，simulation 让学生通过反复试错建立『地形特征 → 通行风险』的因果模型，比拖拽分类更接近真实工程决策",
    "hands_on_ref": "在样例图上手工圈出危险区域并写理由",
    "acceptance_ref": "20 张样例图的人工风险说明"
  },
  {
    "idea_id": "anim_1712000001_efgh",
    "mode": "animation",
    "style_key": "ares_mission",
    "topic": "从风景到路况的视角切换",
    "context_summary": "同一张火星图叠加四色图层（目标/可通行/危险/未知），展示专家如何读图",
    "mode_reason": "视角切换是静态文字无法说清的视觉过程",
    "hands_on_ref": "浏览并筛选真实火星图像样本",
    "acceptance_ref": "火星图像风险观察笔记"
  },
  {
    "idea_id": "ex_1712000002_ijkl",
    "mode": "exercise",
    "style_key": "",
    "topic": "火星路况观察练习",
    "context_summary": "3 道多选 + 1 道简答：给出火星图样张，检验学生能否说出危险区域和理由",
    "mode_reason": "直接检验 acceptance_standard 中的「能够现场说明本模块动手动作」",
    "hands_on_ref": "在样例图上手工圈出危险区域并写理由",
    "acceptance_ref": "学生能够现场说明并演示本模块中的至少两项动手动作"
  }
]
```

**校验清单**（输出 ideas 之前逐条检查）：
- [ ] 每个 idea 都有 `hands_on_ref` 和 `acceptance_ref`，且二者的值必须能在 knode 对应字段列表里找到原文匹配
- [ ] `hands_on_components` 中至少一条被 ideas 覆盖（出现在某个 idea 的 `hands_on_ref`）
- [ ] 所有 exercise 的 `context_summary` 都提及具体 knode 内容，禁止"通过选择题巩固知识点"这种空话
- [ ] game/animation 的 `topic` 禁止使用项目外的题材（例如在 mars-risk-map 项目里出现"牛顿第二定律"即为违规）

---

## Step 3: 为每个 Idea 撰写详细实现描述

**你是**：一位教育互动设计师，需要为内容实现者（也就是你自己在 Step 5 中）提供详尽的执行蓝图。

### v4.1 透传约束

Step 3 的详细描述必须显式引用 Step 2 得到的 `hands_on_ref` 和 `acceptance_ref`，保证 Step 5 实现时不会"脱项"：
- Animation 的 `persuasion.learning_claim` 必须回答 `core_question`；`user_guide.takeaway` 必须指向 `acceptance_ref`
- Game 的 `game_concept` 必须把 `hands_on_ref` 描述的动作转化为具体的玩法操作（拖拽/滑动/选择/排序等）
- Exercise 的每一道题都必须绑定一个 `hands_on_ref` 或 `acceptance_ref`（在题目 JSON 里用 `ref` 字段记录，用于后续自检）

### Animation 详细描述

```json
{
  "style_key": "选定主题",
  "title": "10 字以内",
  "frame_count": 4-6,
  "layout": {
    "focal_object": "主焦点物体",
    "secondary_object": "次焦点物体",
    "safe_area_fill": 0.62
  },
  "asset_plan": ["需要绘制的视觉元素列表"],
  "persuasion": {
    "learning_claim": "20-40 字核心结论",
    "evidence": "20-40 字视觉证据",
    "takeaway": "15-30 字学生能复述什么"
  },
  "beats": [
    {"t": 0.0, "action": "enter", "focus": "主体出现"},
    {"t": 0.2, "action": "anticipation", "focus": "准备动作"},
    {"t": 0.5, "action": "main_action", "focus": "核心演示"},
    {"t": 0.8, "action": "settle", "focus": "回弹/收敛"}
  ],
  "frames": [
    {
      "frame_index": 0,
      "description": "20-40 字场景描述",
      "visual_elements": ["元素1", "元素2"],
      "narration": "可选，20 字以内"
    }
  ],
  "animation_type": "流程演示|对比展示|数据变化|物理过程|概念图解",
  "user_guide": {
    "what_it_shows": "20-30 字一句话描述",
    "observe_points": ["观察重点1", "观察重点2"],
    "controls": "播放控制说明",
    "takeaway": "15-25 字能回答什么"
  }
}
```

### Game 详细描述

Game 的交互方式不设固定模板，可以自由设计适合教学内容的玩法（拖拽、滑块、点击、绘制、排序等任意组合）。

```json
{
  "style_key": "选定主题",
  "game_mechanic": "自由设计的交互方式描述",
  "mechanic_reason": "15-25 字解释",
  "game_concept": "20-40 字核心概念",
  "game_title": "10 字以内",
  "visual_focus": "主焦点",
  "visual_storyboard": [
    "初始状态描述",
    "核心交互过程描述",
    "完成/反馈状态描述"
  ],
  "persuasion": {
    "learning_claim": "20-40 字",
    "evidence": "20-40 字",
    "takeaway": "15-30 字"
  },
  "interaction_flow": [
    "步骤1：学生做什么操作",
    "步骤2：看到什么变化",
    "步骤3：得出什么结论"
  ],
  "win_condition": "20 字以内",
  "difficulty_hint": "easy|medium|hard",
  "simulation_params": [
    {
      "param_name": "force",
      "label": "施加力",
      "min": 0,
      "max": 100,
      "default": 50,
      "unit": "N"
    }
  ],
  "scene_description": "60-100 字视觉描述",
  "user_guide": {
    "goal": "15-25 字",
    "controls": [
      {"element": "力大小滑块", "action": "调节施加的力"},
      {"element": "质量选择", "action": "切换物体质量"}
    ],
    "steps": ["第1步", "第2步", "第3步"],
    "win_condition": "15-20 字",
    "tips": "15-25 字操作提示"
  }
}
```

### Exercise 详细描述

```json
{
  "exercises": [
    {
      "question": "题目文本",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correct": 0,
      "explanation": "详细解析"
    }
  ]
}
```

**练习题要求**：
- 4 道选择题，每题 4 个选项
- 难度渐进：第 1 题概念题 -> 第 2-3 题应用题 -> 第 4 题综合题
- 每题必须有详细解析（50-100 字）
- 干扰项要有教学意义（反映常见错误认知）

### Story 详细描述

```json
{
  "title": "10 字以内",
  "paragraphs": [
    {
      "text": "故事段落，100-150 字",
      "image_url": ""
    }
  ]
}
```

---

## Step 4: 自我质疑 (Debate)

**你是**：一位严格的教育内容评审官，对每个 idea 进行正反辩论。

### 对每个 idea 逐一质疑

**正方（教学价值）**：
- 这个富媒体比纯文字描述有多大增益？
- 学生能从交互中得到什么纯阅读得不到的？

**反方（可行性质疑）**：
- HTML 实现难度是否超出单文件 100vh 的限制？
- 视觉效果能否真正做到好看（而不是简陋到影响学习体验）？
- 交互逻辑是否过于复杂导致 bug 风险高？
- 有没有更简单的方式达到同样的教学效果？

**Game 专项质疑（必问）**：
- 这个 game 是不是又一个"分类/匹配/放置到正确位置"的判断类玩法（Pattern X）？
- 如果是，它能否改写成 Step 2 Game Ideation Patterns 库里的 Pattern 1-10 之一（sandbox / build&test / causal chain / resource / detective / live tuning / strategy map / visual programming / experimental design / role-play）？
- 玩家在这个 game 里是"操纵一个动态系统"还是"挑选正确答案"？只有前者才算合格 game。
- 如果玩家不知道答案就无法开始游戏，说明 game 只是 exercise 的变装，应直接 reject。

**裁决标准**：
- 如果教学逻辑有错误 -> 直接 **reject**
- 如果技术不可行（100vh 内无法布局、交互过于复杂）-> **reject**
- 如果纯文字就能讲清楚，富媒体增益不大 -> **reject**
- **如果 game 的本质就是选择题（如 boss_quiz 只有点选项），和 exercise 重复 -> reject game，保留 exercise 即可**
- **如果 game 落入 Pattern X（分类/匹配）且不属于"本质就是分类"的知识点 -> reject 或 revise 成 Pattern 1-10 之一**
- 其他情况 -> **approve** 或 **revise**（简化后通过）

**操作**：
1. 列出每个 idea 的裁决结果
2. 被 reject 的 idea：从 ideas 列表移除，从 plan_markdown 中删除其占位符
3. 需要 revise 的 idea：修改其 detail_plan（通常是简化交互）
4. 向用户报告裁决结果，询问是否同意

---

## Step 5: 实现具体代码

**你是**：一位高级前端开发者 + 教育游戏设计师。

**重要：animation 和 game 的 HTML 代码长度没有上限。** 不要因为"代码太长"而简化设计。如果一个 animation 需要 800 行来充分表达概念，就写 800 行。如果一个 game 需要 2000 行来实现丰富的交互，就写 2000 行。唯一的标准是：概念是否表达清楚、交互是否有吸引力。浅薄比冗长更糟糕。

### 通用 HTML 硬性约束（animation 和 game 共用）

```
1. 单文件自包含 HTML（<!DOCTYPE html> 到 </html>）
2. body { overflow: hidden; height: 100vh; margin: 0; padding: 0; }
3. 所有内容必须在一屏内布局完成，禁止垂直滚动条
4. 深色主题背景
5. 字体：Space Grotesk（标题/数据） + Inter/Noto Sans SC（正文）
6. 可使用 Google Fonts CDN
7. 0px 圆角（所有元素 border-radius: 0）
8. 禁止纯色平涂，必须用渐变
9. 禁止传统 drop-shadow，用 ambient glow 代替
10. 玻璃态效果：backdrop-filter: blur(12px); background: rgba(...)
11. 禁止 onclick="fn()" 属性 -- 必须用 addEventListener 绑定事件
12. 布局必须用 flex 列布局（wrapper flex-column + canvas flex:1），禁止 calc(100vh-Npx)
13. Canvas / 交互区域尺寸必须自适应容器，**禁止任何形式的尺寸硬编码上限**。具体禁止：
    - `<canvas width="160">` 等 HTML 属性写死像素尺寸
    - `Math.min(..., 480)` / `Math.min(..., 200)` 等 JS 中用固定数值限制 canvas/card 最大尺寸
    - `var CANVAS_SIZE = 320` 等固定初始值不被 resize 覆盖
    正确做法：`resizeCanvas()` 中用 `getBoundingClientRect()` 读取父容器实际尺寸，`sz = Math.min(availW, availH)`（只用容器尺寸互相约束，不加固定上限），`sz = Math.max(sz, 80)` 设置合理下限即可。监听 `window resize` 事件重绘。`make_course_content()` 会自动检测并警告 game HTML 中的硬编码上限。Animation 已由 runtime 自动处理；Game 必须自己实现 resize 逻辑
14. Canvas 必须有延迟重绘兜底（setTimeout + fonts.ready）
15. 动画播放必须用 requestAnimationFrame，禁止 setInterval
16. 必须包含 i18n 双语支持（EN/CN），默认中文，左上角放语言切换按钮
17. 所有用户可见文本必须通过 I18N 对象 + t(key) 函数查表，禁止硬编码中文或英文字符串
18. Animation 帧切换必须使用共享元素过渡（getFrameElements + lerp + easeInOut，500ms）
```

### 物理常识约束（必须遵守）

```
1. 重力方向：物体自然下落，向画面下方。
   陨石坑、水面、地面在画面下方或底部。
   天空、太阳、星空在画面上方。树木从地面向上生长。
   雨和雪从上往下落。

2. SVG/Canvas 坐标系：y 轴向下递增。
   y=0 是顶部（天空），y=max 是底部（地面）。

3. 方向性：箭头指向运动方向。河流从高处流向低处。
   火焰和烟雾向上飘。电流从正极到负极。光从光源向外发散。

4. 比例关系：远处物体小，近处物体大。
   太阳比地球大。细胞比人小。原子比分子小。

5. 颜色常识：天空蓝色系，植物绿色系，岩浆/火红橙色系，
   水蓝色透明系，土壤棕色系。不要用反直觉的颜色。
```

### Animation 设计原则

1. **一个 animation = 一个概念**。多帧用来展开同一概念的不同面/阶段（递进关系），不要把多个独立概念塞进同一个动画。如果一个节点有 3 个核心概念需要可视化，就创建 3 个 animation ideas。
2. **必须使用 skeleton + runtime**。不要手写独立 HTML。skeleton 提供 Play/Pause 按钮、Prev/Next 导航、语言切换、HUD、resize 等标准功能。
3. **代码长度不设上限**。复杂概念可以需要丰富的 canvas 绘制逻辑、多层动画、详细的数据面板。

### Animation Runtime (推荐方式)

**所有新 animation 必须使用 `animation_runtime.js` 共享运行时。** 禁止手写独立 animation HTML。

运行时提供：i18n 双语切换、Canvas DPR 缩放、帧间共享元素过渡动画、HUD 数据栏、观看指南面板、播放/暂停控制。

内容脚本只需提供：
1. `CONFIG` 对象（style、totalFrames、i18n、hudLabels/hudValues、guideItems）
2. `getFrameElements(f, W, H)` 函数（返回当前帧的元素数组）
3. 可选：`drawBg(ctx, W, H)`、`customDrawElement(ctx, el)`

**参考坐标系（Safe Area）**：runtime 自动将所有绘制内容缩放到实际屏幕尺寸，并**自动排除被 guide-panel 和 lang-btn 遮挡的区域**。`getFrameElements(f, W, H)` 收到的 H 固定为 400，W 是**安全宽度**（已扣除右侧 guide-panel 和左侧 lang-btn 的遮挡像素），最小 700。坐标原点 (0,0) 自动偏移到安全区域的左上角。所有坐标都基于此安全虚拟尺寸设计——内容作者无需手动避开 UI 覆盖区域。用 `cx = W/2` 做水平居中，用固定 y 值做垂直定位（0-400 范围）。`drawBg(ctx, W, H)` 例外——它收到的是整个 canvas 的实际像素尺寸，用于绘制全屏背景。

**HTML 结构**：使用 `scripts/animation_skeleton.html` 作为模板，复制全部 HTML 结构，`<script src="animation_runtime.js">` 后接内容脚本。

**CONFIG 格式**：

```javascript
var CONFIG = {
  style: 'ares_mission',   // 10 个主题之一，见下方
  totalFrames: 5,
  i18n: {
    title:    {en: 'TITLE', cn: '标题'},
    subtitle: {en: 'SUBTITLE', cn: '副标题'},
    // ... 所有 UI 文案
  },
  hudLabels: ['hudL1', 'hudL2', 'hudL3', 'hudL4'],  // i18n key
  hudValues: [
    ['val_key_or_literal', ...],  // 每帧 4 个值（i18n key 或直接字符串）
  ],
  guideTitle: 'guideTitle',       // i18n key
  guideItems: ['g1', 'g2', 'g3'], // i18n keys
};
```

所有元素必须有 `id`（用于帧间共享元素过渡），相同 id 的元素会自动 lerp 位置/尺寸。元素类型和绘制方式参考 `animation_game_design/` 目录下对应 style_key 的 `code.html` 实现。

**公开 API**：

| 函数 | 说明 |
|------|------|
| `AnimRuntime.lerp(a, b, p)` | 线性插值：`a + (b-a) * p` |
| `AnimRuntime.interpolate(value, inputRange, outputRange, opts?)` | 多段帧插值（Remotion 风格），支持自动 clamp 和 easing |
| `AnimRuntime.easeInOut(x)` | 缓入缓出曲线 |
| `AnimRuntime.t(key)` | i18n 翻译 |
| `AnimRuntime.merge(base, override)` | 浅合并对象 |

**`interpolate` 用法**：

```javascript
// 淡入淡出（0-30帧淡入，30-60帧淡出）
var opacity = AnimRuntime.interpolate(frame, [0, 30, 60], [0, 1, 0]);

// 位移 + 缓动
var x = AnimRuntime.interpolate(frame, [0, 60], [100, 500], { easing: AnimRuntime.easeInOut });

// 超出范围自动 clamp（默认）；传 extrapolate:'extend' 可线性延伸
var y = AnimRuntime.interpolate(frame, [10, 50], [0, 400], { extrapolate: 'extend' });
```

**公共 API**（通过 `AnimRuntime` 访问）：
- `AnimRuntime.t(key)` -- i18n 翻译
- `AnimRuntime.PAL` -- 当前 palette 对象（`.primary`, `.muted`, `.bg` 等）
- `AnimRuntime.W` / `AnimRuntime.H` -- 安全区域虚拟坐标尺寸（H=400，W=安全宽度，已自动扣除 guide-panel/lang-btn 遮挡）
- `AnimRuntime.safeInset` -- 安全区域内边距（{top, right, bottom, left}，单位为实际像素），通常不需要直接使用
- `AnimRuntime.ctx` -- Canvas 2D context
- `AnimRuntime.lerp(a, b, p)` / `AnimRuntime.easeInOut(x)` / `AnimRuntime.merge(base, ov)`
- `AnimRuntime.boot()` -- 启动（在内容脚本末尾调用）

**10 个视觉主题**（`CONFIG.style`）：

| style key | 适用场景 | 主色 |
|-----------|---------|------|
| `helix_lab` | 生物/遗传/实验室 | `#50ffb0` 荧光绿 |
| `aether_clinic` | 医疗/诊断 | `#98cbff` 柔蓝 |
| `ares_mission` | 火星/航天/探测 | `#ffb59c` 暖橙 |
| `celestial_observatory` | 天文/星空 | `#c9bfff` 薰衣紫 |
| `neural_circuit` | AI/神经网络 | `#dbfcff` 冰蓝 |
| `subatomic_matrix` | 量子/粒子物理 | `#ff7cf5` 霓虹粉 |
| `rocketry_control` | 火箭/飞控 | `#ffb000` 琥珀 |
| `aqua_flow` | 海洋/水文 | `#22d3ee` 青蓝 |
| `ember_forge` | 冶金/热力学 | `#f59e0b` 炉火橙 |
| `flora_pulse` | 植物/生态 | `#4ade80` 叶绿 |

每个 palette 包含：bg, bg2, surface, primary, primaryDim, secondary, secondaryDim, tertiary, tertiaryDim, text, muted, error, outline, glow, glowStrong, glass, glassBlur, radius。runtime 启动时自动将 palette 注入 CSS custom properties。

**参考示例**：`scripts/test_anim_runtime_demo.html`（capability boundary 动画的 runtime 版本）

---

### Animation 和 Game 的视觉设计参考

**实现 animation 和 game HTML 时，必须先阅读 `animation_game_design/` 目录下对应 style_key 的 `DESIGN.md` 和 `code.html`**，参考其真实的 CSS 和 JS 实现，了解该主题的视觉风格、色彩搭配和交互模式。

**Game 特有要求**：
- 每个按钮/滑块必须绑定事件处理函数
- 拖拽功能必须实现 mousedown/mousemove/mouseup + touch 事件链
- 得分和通关判定逻辑必须能正确触发
- 通关后展示学习总结面板
- user_guide 的操作步骤必须与实际可执行的操作完全一致

### i18n 双语规范

**所有 animation 和 game HTML 都必须包含 i18n 双语支持。**

**语言切换按钮**（固定左上角，玻璃态样式）：

```html
<button class="lang-btn" id="langBtn">CN</button>
```

```css
.lang-btn {
  position: fixed; top: 8px; left: 8px; z-index: 100;
  font-family: 'Space Grotesk', sans-serif; font-size: 11px; font-weight: 700;
  padding: 4px 10px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(20,20,35,0.85); backdrop-filter: blur(12px);
  color: #ffb59c; letter-spacing: 1px;
}
```

**I18N 对象 + t() 函数**（JS 中定义）：

```js
var LANG = 'cn'; // 默认中文
var I18N = {
  title:    {en:'ANIMATION TITLE', cn:'\u52a8\u753b\u6807\u9898'},
  subtitle: {en:'SUBTITLE TEXT',   cn:'\u526f\u6807\u9898\u6587\u5b57'},
  btnPlay:  {en:'PLAY',            cn:'\u64ad\u653e'},
  btnPause: {en:'PAUSE',           cn:'\u6682\u505c'},
  btnPrev:  {en:'PREV',            cn:'\u4e0a\u4e00\u5e27'},
  btnNext:  {en:'NEXT',            cn:'\u4e0b\u4e00\u5e27'},
  // ... 所有可见文本，包括 Canvas 绘制的标注、HUD、guide 面板内容
};
function t(key) { return (I18N[key] && I18N[key][LANG]) || (I18N[key] && I18N[key]['en']) || key; }
```

**使用方式**：
- **Animation (Canvas)**：所有 `drawLabel()`/`drawText()` 调用使用 `t('key')` 取文本，切换语言后 redraw
- **Game (DOM)**：DOM 元素的 textContent 通过 `t('key')` 设置，切换时调用 `refreshI18N()` 重新设置

**语言切换事件绑定**：

```js
document.getElementById('langBtn').addEventListener('click', function(){
  LANG = LANG === 'en' ? 'cn' : 'en';
  document.getElementById('langBtn').textContent = LANG.toUpperCase();
  refreshI18N(); // 重新设置所有文本 + 重绘 Canvas
});
```

**refreshI18N() 函数**必须更新：
1. 所有 DOM 文本元素（标题、按钮、HUD 标签、guide 面板）
2. 调用 `drawFrame(currentFrame)` 重绘 Canvas（animation 场景）
3. 重新渲染动态生成的 DOM 列表（game 场景的卡片、区域内容等）

### 帧间过渡规范（Animation 专用）

**Animation 帧切换必须使用共享元素过渡（Shared Element Transition），类似 Keynote Magic Move。**

核心思路：每帧定义一组元素列表（`getFrameElements(f)`），过渡时对两帧中同 ID 的元素做 lerp 位置/大小插值，非共享元素做 alpha 淡入/淡出。

元素类型、绘制函数和过渡动画的具体实现参考 `animation_game_design/` 目录下对应 style_key 的 `code.html`，以及 `scripts/test_anim_runtime_demo.html` 示例。

**使用规则**：
- 每个元素必须有 `id`，同 ID 元素在帧间自动 lerp 插值
- PREV/NEXT/PLAY 按钮调用 `transitionTo(f)` 而非直接 `drawFrame(f)`
- 过渡时长 500ms，easeInOut 缓动
- `drawFrame(f)` 仅用于 resize / 语言切换等即时重绘场景

### 内嵌操作指南面板规范

**所有 animation 和 game 都必须包含此面板。**

```css
.guide-panel {
  position: fixed;
  top: 8px;
  right: 8px;
  width: 260px;
  max-height: 40vh;
  overflow-y: auto;
  background: rgba(20, 20, 35, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 12px;
  z-index: 100;
  font-family: 'Noto Sans SC', sans-serif;
  font-size: 13px;
  color: rgba(255,255,255,0.85);
}
.guide-panel h3 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
.guide-panel .guide-content { /* 可折叠区域 */ }
.guide-panel ul { padding-left: 16px; line-height: 1.6; }
```

内容来自 detail_plan 的 user_guide 字段：
- Animation：what_it_shows + observe_points + controls + takeaway
- Game：goal + controls + steps + win_condition + tips

### 数学公式渲染

如果 HTML 中需要数学公式：
- 在 `<head>` 中加载 KaTeX CDN（0.16.11 版本）
- 行内公式：`\(E = mc^2\)`
- 块级公式：`$$\int_0^\infty e^{-x}\,dx = 1$$`
- 禁止用 SVG `<text>` 元素手写公式

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"
  onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}]})"></script>
```

### STYLE_KITS 配色速查

从 `media_art_direction.py` 的 STYLE_KITS 中读取对应 style_key 的 palette：

```python
from systemedu.agents.builtin.media_art_direction import STYLE_KITS
kit = STYLE_KITS["你选的style_key"]
palette = kit["palette"]  # bg, surface, primary, secondary, text, muted 等
```

然后将 palette 的颜色值直接写入 HTML 的 CSS 中。

### 输出前自检清单

在完成每个 HTML 后，逐条检查：

```
[ ] body 设置了 overflow: hidden; height: 100vh?
[ ] 没有垂直滚动条?
[ ] 重力方向正确?（物体向下落，地面在底部）
[ ] 所有箭头方向符合物理规律?
[ ] 颜色符合常识?
[ ] 所有按钮/控件都绑定了事件并能正常工作?
[ ] 拖拽功能实现了完整的事件链?（如适用）
[ ] 得分和通关逻辑能正确触发?（如适用）
[ ] 操作指南面板存在且内容与实际操作一致?
[ ] 使用了渐变而非纯色平涂?
[ ] border-radius 全部为 0px?
[ ] 字体使用了 Space Grotesk + Noto Sans SC?
[ ] 包含 I18N 对象和 t() 函数，所有可见文本通过 t(key) 查表?
[ ] 左上角有语言切换按钮（CN/EN），点击可切换所有文本?
[ ] Animation 帧切换使用共享元素过渡（transitionTo + lerp）?（animation 适用）
[ ] 视觉风格参考了 animation_game_design/ 对应 style_key 的 DESIGN.md 和 code.html?
```

### Exercise 实现

直接构造 JSON 列表，不需要写 HTML：

```python
exercises = [
    {
        "type": "choice",
        "question": "题目文本",
        "options": ["A", "B", "C", "D"],
        "correct": 0,  # 正确选项索引 0-3
        "explanation": "详细解析"
    },
    # ... 共 4 题
]
```

### Story 实现

构造段落列表：

```python
story_paragraphs = [
    {"text": "第一段故事文本...", "image_url": ""},
    {"text": "第二段故事文本...", "image_url": ""},
    {"text": "第三段故事文本...", "image_url": ""},
]
```

---

## Step 5.5: Code Review & Browser Verify

**在写入 DB 之前，必须对每个 HTML 文件进行代码审查和浏览器验证。**

这一步的目的是捕获"脑中自检"无法发现的运行时问题。

### 5.5a. 代码审查清单

对每个 animation/game HTML 文件逐条检查：

**事件绑定（高频 bug 源）**
```
[ ] 禁止使用 onclick="fn()" 属性绑定 -- 必须用 addEventListener
    原因：IIFE 内定义的函数不在全局作用域，onclick 属性引用全局作用域会找不到函数
[ ] 所有按钮、滑块、拖拽元素都通过 addEventListener 绑定事件
[ ] 拖拽功能同时绑定了 mouse 和 touch 事件链
```

**Canvas 初始化时序（iframe 嵌入场景）**
```
[ ] Canvas 尺寸获取使用父容器 getBoundingClientRect()，而非 canvas 自身
    原因：iframe 嵌入时 canvas 可能尚未获得正确尺寸
[ ] resize() 末尾有 width/height 为 0 的安全检查：if(rect.width < 1 || rect.height < 1) return;
[ ] 有延迟重绘兜底：setTimeout(resize, 200) 和 setTimeout(resize, 600)
[ ] 有字体加载完成后重绘：document.fonts.ready.then(function(){ resize(); })
```

**布局健壮性**
```
[ ] 使用 flex 布局（而非 calc）分配 header/canvas/controls/hud 的高度
    推荐：wrapper 用 display:flex; flex-direction:column; height:100vh;
    canvas 容器用 flex:1; min-height:0; 自动占满剩余空间
[ ] 没有使用 calc(100vh - Npx) 计算 canvas 高度
    原因：iframe 嵌入时 100vh 的含义可能不同，组件高度也可能因字体加载而变化
```

**动画播放逻辑**
```
[ ] 使用 requestAnimationFrame 而非 setInterval
    原因：setInterval 不随页面隐藏暂停，rAF 更流畅且省电
[ ] 播放结束时正确 cancelAnimationFrame 并重置状态
[ ] 播放按钮文本在 PLAY/PAUSE 之间正确切换
[ ] 从最后一帧点击 PLAY 时自动回到第一帧重新播放
```

**交互功能（game 特有）**
```
[ ] 拖拽的 touchmove 事件调用了 e.preventDefault() 防止页面滚动
[ ] 拖拽的 ghost 元素在 touchend 时被正确移除
[ ] 得分/通关判定逻辑在边界条件下不会重复触发
```

**i18n 双语支持（animation + game 共用）**
```
[ ] 定义了 I18N 对象，包含所有可见文本的 en/cn 键值对
[ ] 定义了 t(key) 函数，默认返回当前 LANG 对应文本
[ ] 默认语言为 cn（中文），LANG 变量初始值为 'cn'
[ ] 左上角有语言切换按钮 (.lang-btn)，通过 addEventListener 绑定
[ ] 点击切换按钮后调用 refreshI18N()，更新所有 DOM 文本和 Canvas 重绘
[ ] 没有硬编码的中文或英文字符串（所有文本通过 t() 函数查表）
```

**科学一致性验证（animation + game 共用，必做）**

此步骤使用一个独立 Agent 专门验证内容的科学准确性。生成 animation/game HTML 后、写入 DB 前，必须用 Agent 工具启动一个验证 agent，传入 HTML 代码，让它检查以下清单：

```
[ ] 物理数值真实性：所有出现的重量、长度、速度、温度等数值是否符合现实？
    反例：直径 3cm 铁球标注 31 克（实际约 110 克）
    检查方法：对每个数值问"这个物体在现实中大约是这个数值吗？"
[ ] 方向/因果一致性：
    - 天平/比较类：重的物体所在的一侧 y 坐标是否更大（canvas y 向下递增 = 下沉）？
    - 力/运动类：力的方向是否与描述一致（推力向右 = x 增大）？
    - 温度/能量类：高温用暖色、低温用冷色？
[ ] 比例合理性：物体之间的视觉大小比例是否大致合理？
    反例：气球画得比铁球小（应该气球视觉大、铁球视觉小，才能体现"大不一定重"）
[ ] 文字描述与视觉一致：标注的文字（如"铁球更重"）是否与画面中的视觉效果匹配？
    反例：文字说"铁球更重"但天平上铁球那侧翘起来了
[ ] 单位正确性：克/千克/米/厘米等单位使用正确，不混用
```

验证 agent 发现错误时必须在写入 DB 前修复。这一步是硬阻断——不通过不写入。

**Theory 等级评审（必做，独立 Agent）**

`preflight_v41` 只能用正则做粗筛（K1 禁止公式、K4 要有三角/向量、一句话定义检测）。正则抓得到"有没有用公式"，但抓不到"用得恰不恰当、解释得够不够透、升到 K4 是不是真升级了而不是在 K1 里硬塞一句 $F=ma$"。这个判断必须由一个专门的评审 agent 完成。

**在 Step 6 写入 DB 之前**，对每个 theory 的每个 `level_bodies` 条目，调用 Agent 工具（`subagent_type=general-purpose`），传入：

- theory 的 `title`、`subject`
- 被评审的 `level` 和 `body_markdown` 全文
- 项目的 `knowledge_level`（告诉它"目标受众的年级"）

让 agent 按下列清单打分并给出修改意见：

```
[ ] 等级匹配：表达方式、例子复杂度、数学工具深度，是否真的匹配该 level？
    - K1：全程生活类比，零公式零字母，6 岁能读懂
    - K2：简单四则运算/百分比/简单表格，不用希腊字母或上下标
    - K3：代数公式（如 f=μN）需配符号说明，不用三角函数推导
    - K4：三角函数/向量/受力分析/概率统计/指对数 至少一项，且推导自然不是硬塞
    - K5：微积分/线代/微分方程/学术论述 至少一项
    反例：K4 全文只有 F=ma 一个初中公式 → 其实是 K3
    反例：K1 出现"左右机翼升力相等" → 超纲
[ ] 学习材料完整性：先解释概念本身，还是上来就跳项目？
    必须覆盖：是什么 / 为什么 / 有什么表现 / 和什么不同 / 再关联项目
    反例：K1 "风化是岩石破碎" 然后直接跳到火星项目 → 概念本身没讲透
[ ] 推导严谨性（K3+）：公式出现时符号是否全部解释？推导是否跳步？
    反例：写 L=½ρv²SC_L 但没说 ρ/v/S/C_L 分别代表什么
[ ] 例子与类比：至少 2 个具体例子或类比，且与项目场景有呼应
[ ] 不鼓励的做法：
    - 一句话定义 + 直接关联项目（未解释概念）
    - 公式贴堆 + 没有文字解释
    - 超出 level 的公式被硬塞进低 level
    - 低于 level 的表达方式占满了高 level（说明没真正升级）
[ ] animation_html 适配性（仅当该 theory 带 animation_html 时）：
    - 动画是否可视化了"该 theory 的核心机制"而不仅是装饰？
    - 标注的公式/箭头/数值是否与 body_markdown 一致？
    - 浅色主题、2-4 帧、无 animation_runtime.js 依赖
```

agent 返回结构化结果：

```json
{
  "verdict": "pass" | "revise",
  "per_level": {
    "K1": {"level_match": "ok|too_simple|too_complex", "issues": [...], "suggestions": [...]},
    "K4": {...}
  },
  "animation_review": {"verdict": "pass|revise|n/a", "issues": [...]}
}
```

**verdict = revise 是硬阻断**：必须根据 issues/suggestions 重写对应 level 的 body_markdown（或 animation_html），再跑一次 agent，直到 pass。不允许"verdict=revise 但改动很小就先提交"——theory 质量是这个项目反复出问题的地方，不允许 bypass。

**什么时候可以跳过**：只有当 theory 完全没有 `level_bodies`（纯方法论节点允许 0 个 theory）时跳过。只要有 theory、有 level_bodies，就必须跑完评审。

**实践建议**：每个 theory 一个 Agent 调用即可（并行跑多个 theory 以节省时间，但同一个 theory 的多个 level 要在一个 agent 里一起评，因为 agent 要判断"K1 → K4 是否真的升级了"，需要跨 level 对比）。

**帧间过渡（animation 特有）**
```
[ ] 定义了 getFrameElements(f, W, H) 返回每帧的元素列表（声明式），W/H 为安全区域虚拟尺寸（runtime 自动排除 guide-panel 遮挡）
[ ] 每个元素有 id 字段，同 ID 元素在帧间自动 lerp 插值
[ ] PREV/NEXT/PLAY 按钮均调用 transitionTo() 而非直接 drawFrame()
[ ] 过渡时长 500ms，easeInOut 缓动
[ ] 视觉风格参考了 animation_game_design/ 对应 style_key 的实现
```

### 5.5b. Playwright 自动化浏览器验证

Step 5 中已将 HTML 写入 `scripts/test_anim_xxx.html` 或 `scripts/test_game_xxx.html`。
使用 Playwright headless Chromium 自动验证，无需手动打开浏览器。

**单文件验证**（快速检查单个 HTML）：
```bash
node scripts/html_validate.mjs scripts/test_anim_xxx.html --mode animation
node scripts/html_validate.mjs scripts/test_game_xxx.html --mode game
# mode 可省略，会根据文件名自动检测（_anim_ -> animation, _game_ -> game）
```

输出 JSON 报告，exit 0 = pass, 1 = fail。检查项：
- 页面加载无 JS 错误
- 无 console.error
- Canvas/SVG 非全黑（5 点采样）
- 无垂直滚动条
- Animation: #btnNext 可点击且帧号变化，#langBtn 存在
- Game: 交互元素存在且可见

**批量验证**（验证所有现有 HTML 文件）：
```bash
cd scripts && npx playwright test --config=playwright.config.mjs
```

`html_validate_test.mjs` 自动发现 `scripts/test_anim_*.html` 和 `scripts/test_game_*.html`，
对每个文件生成通用测试套件（JS 错误、Canvas 渲染、滚动条），animation 额外测试
NEXT/PREV/PLAY/语言切换，game 额外测试交互元素存在性。

**手动浏览器验证**（可选补充）：
```bash
open scripts/test_anim_xxx.html
open scripts/test_game_xxx.html
```

肉眼检查：动画播放流畅度、视觉效果、拖拽交互手感等 Playwright 难以量化的项目。

### 5.5c. 常见问题修复模式

| 症状 | 根因 | 修复 |
|------|------|------|
| 点击按钮无反应 | onclick 属性 + IIFE 作用域冲突 | 改用 addEventListener |
| Canvas 黑屏/空白 | getBoundingClientRect 返回 0 | 加 setTimeout 兜底 + 检查 rect.width |
| 动画卡顿/不流畅 | 使用 setInterval | 改用 requestAnimationFrame |
| 页面有滚动条 | calc(100vh - Npx) 计算不准 | 改用 flex 布局 |
| 字体显示为默认体 | 首次渲染时 Google Fonts 未加载 | fonts.ready 后重绘 |
| 拖拽时页面跟着滚动 | touch 事件未 preventDefault | touchmove 中加 e.preventDefault() |

**如果浏览器验证发现问题，修复后必须重新执行 5.5a 和 5.5b，直到全部通过。**

---

## Step 6: 组装 CourseContent 并写入 DB

### 6.0. v4.1 预写入自检（必须通过才允许 upsert）

`scripts/course_factory.py` 已内置 `preflight_v41(knode, course_content) -> list[str]` 工具函数，并且在 `make_course_content(..., knode=knode)` 传入 knode 时会**自动调用**一次（默认 `preflight=True`）。违规时直接抛 `ValueError`，Step 6a 的组装调用就会失败，不需要再手动写一遍校验逻辑。

规则覆盖：

1. 每个 `mode in {animation, game, exercise}` 的 idea 必须有 `hands_on_ref` / `acceptance_ref`，且二者必须能在 `knode.hands_on_components` / `acceptance_artifacts.title` / `acceptance_standard` 里找到原文匹配
2. `knode.hands_on_components` 中至少一条被 ideas 覆盖（某个 idea 的 `hands_on_ref` 命中）
3. `knode.core_question` 必须在 `course_content.plan_markdown` 中出现

如果 knode 是旧版（缺 `hands_on_components` 等 v4.1 字段），`preflight_v41` 会静默跳过，不影响老项目的运行。

如果自检失败（抛 `ValueError`），回到 Step 1/2 修正（补上 `core_question` 到 plan、修正 ideas 的 `hands_on_ref`），不要"强行写入然后下次再说"。如果确实需要临时绕过（比如 story-only 内容、没有 ideas），在 `make_course_content(..., preflight=False)` 显式关闭。

需要手动调用时：

```python
from scripts.course_factory import preflight_v41

errors = preflight_v41(knode, course_content)
if errors:
    for e in errors:
        print(f"  - {e}")
    raise SystemExit(1)
```

### 6a. 组装 CourseContent

使用 `scripts/course_factory.py` 中的 `make_course_content()` 函数（v4.1 已支持 `knode` + `*_hands_on_ref` / `*_acceptance_ref` 参数；同时支持 `research` 参数注入 Step 0.5 抓取的外部资料）：

```python
python3 << 'PYEOF'
import sys
sys.path.insert(0, "src")
sys.path.insert(0, ".")
from scripts.course_factory import (
    load_knode_context,
    should_research_knode,
    research_knode,
    make_course_content,
    make_exercises,
    upsert_lesson,
    ensure_db_tables,
)

# -- 载入 knode v4.1 上下文（自动拼齐 knode + milestone + sub_project）--
ctx = load_knode_context("项目名", knode_global_idx=0)
knode = ctx["knode"]
milestone = ctx["milestone"]
sub_project = ctx["sub_project"]

# -- Step 0.5: 外部资料研究（只在启发式判定需要时调用）--
research = None
if should_research_knode(knode, milestone):
    research = research_knode(
        knode,
        milestone=milestone,
        sub_project=sub_project,
        web_query="Mars HiRISE DEM stereo reconstruction",      # 精准项目领域查询
        youtube_query="Mars HiRISE digital elevation model",    # 英文 YouTube 查询
    )

# -- plan_markdown (从 Step 1 粘贴，必须含 core_question & module_id 角标) --
plan_markdown = """
> Module: P-MARS-01-M01 · foundation

...Step 1 的完整 Markdown...
"""

# -- animation HTML (从 Step 5 粘贴) --
animation_html = """
...完整 HTML...
"""

# -- exercises (从 Step 5 粘贴，每道题带 ref 字段，make_exercises 会保留) --
exercises = make_exercises([
    {"question": "...", "options": ["A","B","C","D"], "correct": 0, "explanation": "...",
     "ref": "在样例图上手工圈出危险区域并写理由"},
    # ...
])

# -- theories (从 Step 1.5 生成，必须包含 level_bodies) --
theories = [
    {"theory_id": "theory_phys_friction", "title": "摩擦力", "subject": "physics",
     "body_markdown": "摩擦力就是走路时脚底的阻力...(K1 内容，无公式)",
     "level_bodies": [
         {"level": "K1", "body_markdown": "摩擦力就是走路时脚底的阻力...(纯生活类比)"},
         {"level": "K3", "body_markdown": "## 摩擦力\n\n$f = \\mu N$...(含公式)"},
     ],
     "related_paragraph": "核心概念段"},
]

# -- 组装：传入 knode 后 preflight 自动生效；传入 research 后自动融入 plan_markdown --
course_content = make_course_content(
    plan_markdown=plan_markdown,
    animation_html=animation_html,
    animation_topic="动画主题",
    exercises=exercises,
    exercise_topic="练习主题",
    story_paragraphs=None,  # 或 [{"text": "...", "image_url": ""}]
    knode=knode,  # v4.1：传入后自动 preflight
    animation_hands_on_ref="浏览并筛选真实火星图像样本",
    animation_acceptance_ref="火星图像风险观察笔记",
    exercise_hands_on_ref="在样例图上手工圈出危险区域并写理由",
    exercise_acceptance_ref="学生能够现场说明并演示本模块中的至少两项动手动作",
    research=research,  # 0.5：外部资料自动融入 plan_markdown + external_resources
    theories=theories,  # Step 1.5：基础理论标注
)
# 如果 preflight 检出违规，此处会直接 raise ValueError，回到 Step 1/2 修正。

# -- 写入 DB --
ensure_db_tables()
upsert_lesson(
    project_name="项目名",
    knode_id=0,  # global knode id
    content_type="cf",
    course_content=course_content,
)

print("写入成功!")
print(f"ideas 数量: {len(course_content['ideas'])}")
for idea in course_content["ideas"]:
    print(f"  [{idea['mode']}] {idea['topic']}  <- {idea.get('hands_on_ref','')}")
if "external_resources" in course_content:
    ext = course_content["external_resources"]
    print(f"外部资料: {len(ext['web_results'])} 网页 / {len(ext['youtube_results'])} 视频")
PYEOF
```

### 6b. 验证写入结果

```python
python3 << 'PYEOF'
import sys, json
sys.path.insert(0, "src")
from systemedu.storage.db import LessonContent, get_session

db = get_session()
lesson = db.query(LessonContent).filter_by(
    project_name="项目名", knode_id=0
).first()
if lesson:
    cc = json.loads(lesson.course_content)
    print(f"Status: {lesson.status}")
    print(f"Ideas: {len(cc.get('ideas', []))}")
    for idea in cc.get("ideas", []):
        section = cc["rendered_sections"].get(idea["idea_id"], {})
        has_html = bool(section.get("html"))
        has_ex = bool(section.get("exercises"))
        print(f"  [{idea['mode']}] {idea['topic']} | html={has_html} exercises={has_ex}")
else:
    print("未找到课程记录!")
db.close()
PYEOF
```

## Step 6.5: 生成作业练习 (project_assignment)

**每个 knode 必须执行此步骤**，生成的内容写入 `LessonContent.project_assignment` 字段，前端通过"作业练习"面板展示。

### 普通节点 vs 大作业节点

| 节点类型 | 生成内容 | 用途 |
|---------|---------|------|
| 普通节点 | 选择题(3) + 问答题(2) + 动手项目(1) | 右侧"作业练习"面板，学生自测 |
| 大作业节点 (module_role=capstone) | 考核要点 + 交付物自检清单 + 自评写作指引 | 右侧"作业练习"面板，指导学生提交前自检 |

### 方式 A：随 Step 6 一起写入（推荐）

在 `upsert_lesson()` 调用时传入 `project_assignment` 参数：

```python
from scripts.course_factory import (
    upsert_lesson, ensure_db_tables, load_knode_context,
    generate_assignment,
)

ctx = load_knode_context("项目名", knode_global_idx=0)
knode = ctx["knode"]
milestone = ctx["milestone"]

# 生成作业（LLM 调用）
assignment = generate_assignment(knode, milestone, plan_markdown=plan_markdown)
print(f"Assignment length: {len(assignment)} chars")

# 写入 DB（与 course_content 一起）
ensure_db_tables()
upsert_lesson(
    project_name="项目名",
    knode_id=0,
    content_type="cf",
    course_content=course_content,
    project_assignment=assignment,  # <-- 新增
)
```

### 方式 B：单独补写（已有 course_content 但缺 assignment）

```python
from scripts.course_factory import (
    load_knode_context, generate_assignment, upsert_assignment,
)

ctx = load_knode_context("项目名", knode_global_idx=0)
assignment = generate_assignment(ctx["knode"], ctx["milestone"])
upsert_assignment("项目名", 0, assignment)
print("Assignment updated!")
```

### 批量补写所有缺失 assignment

```python
python3 << 'PYEOF'
import sys, json
sys.path.insert(0, "src")
sys.path.insert(0, ".")
from scripts.course_factory import (
    load_knode_context, generate_assignment, upsert_assignment,
)
from systemedu.storage.db import LessonContent, get_session

project = "项目名"
db = get_session()
lessons = db.query(LessonContent).filter_by(project_name=project).all()
missing = [l for l in lessons if not l.project_assignment]
print(f"需要补写 assignment 的节点: {len(missing)} / {len(lessons)}")

for lesson in missing:
    ctx = load_knode_context(project, knode_global_idx=lesson.knode_id)
    cc = json.loads(lesson.course_content) if lesson.course_content else {}
    plan = cc.get("plan_markdown", "")
    assignment = generate_assignment(ctx["knode"], ctx["milestone"], plan_markdown=plan)
    upsert_assignment(project, lesson.knode_id, assignment)
    print(f"  knode {lesson.knode_id}: {len(assignment)} chars")

db.close()
print("全部完成!")
PYEOF
```

## Step 6.6: 生成讲课稿 (audio_script)

**每个 knode 必须执行此步骤**，生成的讲课稿存入 `course_content.sections[].audio_script` 字段，后续统一调用 TTS 转为语音。

### 讲课稿 vs 课文正文

| 维度 | 课文正文 (plan_markdown) | 讲课稿 (audio_script) |
|------|------------------------|---------------------|
| 用途 | 学生阅读的文字教材 | 老师口头讲解的音频脚本 |
| 风格 | 书面语、结构化、带标题和列表 | 口语化、亲切、像课堂对话 |
| 内容 | 完整知识点覆盖 | 提炼要点、补充背景、举生活例子 |
| 长度 | 800-1500 字/knode | 150-300 字/段落 |

### 生成流程

1. 从 DB 读取 `course_content.plan_markdown`
2. 用纯 Python 按 `##`/`###` 标题分段（复用 `_split_by_headings()`）
3. 对每段调用 LLM 生成口语化讲解稿
4. 将 `sections` 数组写回 `course_content` 并保存 DB

### 方式 A：随 Step 6 一起写入（推荐）

在 `upsert_lesson()` 之后立即调用：

```python
from scripts.course_factory import generate_audio_scripts

sections = generate_audio_scripts("项目名", knode_id, knode, milestone)
print(f"  {len(sections)} 段，讲课稿: {sum(1 for s in sections if s.get('audio_script'))} 段")
```

### 方式 B：批量补写所有缺失讲课稿

```python
python3 << 'PYEOF'
import sys, json
sys.path.insert(0, "src")
sys.path.insert(0, ".")
from scripts.course_factory import load_knode_context, generate_audio_scripts
from systemedu.storage.db import LessonContent, get_session

project = "项目名"
db = get_session()
lessons = db.query(LessonContent).filter_by(project_name=project).order_by(LessonContent.knode_id).all()
db.close()

for lesson in lessons:
    kid = lesson.knode_id
    ctx = load_knode_context(project, knode_global_idx=kid)
    sections = generate_audio_scripts(project, kid, ctx["knode"], ctx["milestone"])
    scripts = sum(1 for s in sections if s.get("audio_script"))
    print(f"  knode {kid}: {len(sections)} 段, {scripts} 段有讲课稿")

print("全部完成!")
PYEOF
```

### 讲课稿质量要求

- **不是课文的朗读版**：讲课稿要重新组织语言，不能照搬 plan_markdown 的文字
- **课堂语气**：用"同学们"、"大家想想看"、"你们有没有注意到"等课堂用语
- **设问引导**：每段至少一个设问，引导学生思考
- **生活类比**：用学生熟悉的事物解释抽象概念
- **长度控制**：每段 150-300 字，太短缺乏深度，太长学生走神

---

## 设计规范参考文档

### animation_game_design/ 目录

6 个完整设计系统参考：

| 目录 | 设计系统 | 参考文件 |
|------|---------|---------|
| `animation_game_design/aether_clinic/` | 医疗诊断 HUD | `DESIGN.md` + `code.html` |
| `animation_game_design/ares_mission_control/` | 火星任务控制 | `DESIGN.md` + `code.html` |
| `animation_game_design/celestial_observatory/` | 星空天文台 | `DESIGN.md` + `code.html` |
| `animation_game_design/helix_lab_hud/` | 遗传合成实验室 | `DESIGN.md` + `code.html` |
| `animation_game_design/neural_circuit/` | 神经电路实验室 | `DESIGN.md` + `code.html` |
| `animation_game_design/subatomic_matrix/` | 亚原子量子场 | `DESIGN.md` + `code.html` |

**跨设计系统的共享原则**：

1. **无边框规则**：禁止 1px solid 边框划分区域，用背景色调层级划分
2. **色调分层**：surface -> surface_container_low -> surface_container_high -> surface_bright
3. **渐变必需**：禁止纯色平涂，所有主体用 3 层色渐变
4. **玻璃态**：浮动元素用 backdrop-filter: blur(12-20px) + 40-60% 透明度
5. **0px 圆角**：所有角必须 90 度直角
6. **双字体**：Space Grotesk（技术标题）+ Inter/Noto Sans SC（正文）
7. **环境光晕**：主色 5-20% 透明度 + 32-60px 模糊
8. **幽灵边框**：如需辅助边界，用 outline_variant 15-20% 透明度

**实现 HTML 时，先读取对应 style_key 目录下的 `code.html`，参考其真实的 CSS 和 JS 实现。**

---

## 完整执行流程检查清单

```
[ ] 前置：已从 knowledge_tree.json 读取 knode 的 v4.1 字段（core_question/hands_on_components/acceptance_*）
[ ] Step 0.5: 对每个 knode 调用 `research_knode()` 搜索外部资料（不再跳过任何节点）
[ ] Step 0.5: `research_knode()` 返回的 web_results / youtube_results 至少有一个非空（否则换查询词重试）
[ ] Step 0.7: 已在 LabXchange/PhET 搜索相关资源，plan_markdown 含"推荐互动资源"段落（至少 1 条链接，或注明无相关资源的原因）
[ ] Step 1: plan_markdown 800-1500 字，顶部含 "> Module: {module_id} · {module_role}"，core_question 出现在引入段
[ ] Step 1: 外部资源链接全部使用 `{{KEY}}` shortcode，不含硬编码 URL（grep `https://` 结果应为 0）
[ ] Step 1: 每条学习目标可追溯到 acceptance_standard 或 hands_on_components 中的原文
[ ] Step 1.5: theories 列表非空（≥ 2 个，或显式说明"纯方法论节点"理由），每个 theory 带 level_bodies 且 K1 必选
[ ] Step 1.5: `[[THEORY:xxx]]` 占位符已插入 plan_markdown 的相关段落（否则前端不渲染基础知识）
[ ] Step 2: 3-4 个 ideas，mode/style_key 选择合理，占位符已插入
[ ] Step 2: 每个 idea 含 hands_on_ref / acceptance_ref，且至少一条 hands_on_components 被覆盖
[ ] Step 2: 富媒体全集 7 类逐条对齐（theory/animation/game/image/diagram/youtube/labxchange），被 reject 的类型要写明理由
[ ] Step 3: 每个 idea 的 detail_plan 完整（含 user_guide），exercise 每道题带 ref 字段
[ ] Step 4: debate 完成，reject 的已移除，向用户确认
[ ] Step 5: HTML 通过自检清单，exercises 有 4 题且有解析
[ ] Step 5.5a: Code Review 通过（事件绑定、Canvas 时序、flex 布局、rAF）
[ ] Step 5.5b: Playwright 验证通过: node scripts/html_validate.mjs <file> 返回 exit 0
[ ] Step 5.5b: 批量验证通过: cd scripts && npx playwright test --config=playwright.config.mjs
[ ] Step 5.5c: 科学一致性验证 Agent 通过（animation/game 数值/方向/比例/单位）
[ ] Step 5.5d: **Theory 等级评审 Agent 通过**（每个 theory 的每个 level 与目标等级匹配，verdict=pass）
[ ] Step 6.0: v4.1 预写入自检（`preflight_v41` 或 `make_course_content(knode=...)` 自动调用）通过，无任何违规
[ ] Step 6: 成功写入 DB，验证查询通过
[ ] 启动前端确认：./scripts/restart.sh 后访问对应页面查看效果
```

---

## 快速参考：CourseContent 数据结构

```json
{
  "plan_markdown": "完整学习计划 Markdown（含 [[IDEA:xxx]] 占位符 + 顶部 Module 引用块）",
  "ideas": [
    {
      "idea_id": "唯一ID",
      "mode": "animation|game|exercise|story",
      "topic": "简短描述",
      "context_summary": "30-50字摘要",
      "generation_backend": "claude_code",
      "style_key": "STYLE_KITS中的key",
      "mode_reason": "选择原因",
      "hands_on_ref": "v4.1: 对应 knode.hands_on_components 中的某一条原文",
      "acceptance_ref": "v4.1: 对应 knode.acceptance_standard 或 acceptance_artifacts.title"
    }
  ],
  "rendered_sections": {
    "idea_id": {
      "mode": "animation|game|exercise|story",
      "status": "ready",
      "html": "完整HTML字符串 或 null",
      "story_paragraphs": "[{text,image_url}] 或 null",
      "exercises": "[{type,question,options,correct,explanation,ref}] 或 null",
      "generation_backend": "claude_code",
      "user_guide": "操作说明文本"
    }
  }
}
```

---

## v4.1 工具就绪状态

`scripts/course_factory.py` 已完成 v4.1 升级，手册 6a 路径直接走工具函数即可，不再需要手动绕开：

| 工具 | 状态 | 说明 |
|------|------|------|
| `load_knode_context(project_name, knode_global_idx) -> dict` | 已就绪 | 一次性加载 `{knode, milestone, sub_project}`，按 global index 展开，未找到抛 `ValueError` |
| `preflight_v41(knode, course_content) -> list[str]` | 已就绪 | 实现 Step 6.0 的 3 条硬性规则；旧版 knode（无 v4.1 字段）自动跳过 |
| `make_exercises(items)` 保留 `ref` 字段 | 已就绪 | 题目 item 里写 `"ref": "..."`，会被一一透传到 rendered_sections 的 questions |
| `make_course_content(..., knode, *_hands_on_ref, *_acceptance_ref, research, labxchange_results)` | 已就绪 | 传入 knode 时默认 `preflight=True` 自动校验；research + labxchange_results 自动融入 plan_markdown + external_resources + DB node_resources |
| `should_research_knode(knode, milestone) -> bool` | 已就绪 | 始终返回 True（每个节点都搜索外部资料） |
| `search_labxchange(keywords, subject_filter, top_k) -> list[dict]` | 已就绪 | 本地搜索 1467 个 LabXchange pathway，返回匹配结果（title/description/url/score） |
| `search_labxchange_for_knode(knode, top_k) -> list[dict]` | 已就绪 | 从 knode 自动提取英文关键词搜索 LabXchange；`make_course_content` 在 labxchange_results 为空时自动调用此函数兜底 |
| `research_knode(knode, ..., web_query, youtube_query) -> dict` | 已就绪 | 调用 Tavily Search 抓取网页 + YouTube 资料，返回结构化结果 |
| `merge_resources_into_plan(plan, research) -> str` | 已就绪 | 把资料以纯 markdown 形式注入 plan_markdown（推荐视频 + 延伸阅读） |
| Gateway API `api_project_detail` 返回 v4.1 字段 | 已就绪 | 前端 / LLM 可以直接读取 `knode.module_id` / `core_question` 等 |
| 单元测试 `tests/test_course_factory_v41.py` | 已就绪 | 21 个 case 覆盖 preflight 所有分支、make_course_content 注入、load_knode_context 边界 |
| 单元测试 `tests/test_course_factory_research.py` | 已就绪 | 31 个 case 覆盖 should_research 启发式、YouTube URL 解析、merge_resources 融入、research_knode 的 mocked Tavily 调用 |

**使用约定**：
- 所有组合（animation/game/exercise/story/image/diagram/hands_on_kit）统一走 Step 6a：`make_course_content(knode=..., research=..., game_html=..., ...)` 一次完成组装+自检
- 高层 API：`load_context()` + `save_knode()` 简化上下文加载和 DB 写入（content_type 固定为 "cf"）
- `MediaItem` / `KnodeContext` dataclass 可用于类型化参数传递
- 临时关闭自检（比如 story-only、或 knode 是旧版但你确定要写入）：`make_course_content(..., preflight=False)`
- 跳过外部资料研究：不传 `research` 参数即可（或显式 `research=None`）
