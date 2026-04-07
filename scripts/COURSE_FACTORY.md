# COURSE_FACTORY.md -- Claude Code 课程生成操作手册

> 当用户说"调用 course_factory"时，Claude Code 按照本手册逐步执行。
> 本手册替代 6 个 Agent 的 LLM API 链式调用，由 Claude Code 自己完成所有内容创作和代码编写。

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

在动笔写 plan_markdown 之前，**先判断这个 knode 是否值得联网抓取外部资料**。工程、科学、数据、算法、仪器类节点应该联网研究；方法论/项目说明/答辩展示类节点直接跳过。

### 判断标准

`scripts/course_factory.py` 提供 `should_research_knode(knode, milestone)` 工具函数，按下面启发式规则返回 True/False：

1. **显式跳过**：`title` / `summary` 命中"介绍/导入/概述/前置/展示/答辩/学习方法"等方法论关键词 → 跳过
2. **显式研究**：`title` / `summary` / `hands_on_components` 命中工程科学关键词（`algorithm`/`sensor`/`HiRISE`/`DNA`/`神经元`/`算法`/`地形数据`/`绘制地图`/`火星`/`工程`…） → 研究
3. **难度托底**：`difficulty_level >= 5` 且（有 `hands_on_components` 或 `module_role in {engineering, application, investigation, implementation, analysis}`）→ 研究
4. **默认跳过**

Claude Code 在执行时**不要盲目信任启发式**，对判断结果有把握才走启发式；有疑问就读一遍 knode 上下文自己决定。

### 调用方式

```python
from scripts.course_factory import load_knode_context, should_research_knode, research_knode

ctx = load_knode_context("mars-risk-map", knode_global_idx=3)
knode = ctx["knode"]
milestone = ctx["milestone"]
sub_project = ctx["sub_project"]

if should_research_knode(knode, milestone):
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
else:
    research = None  # 跳过联网
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

`make_course_content(..., research=research)` 在 Step 6a 会**自动**：

1. 调用 `merge_resources_into_plan(plan_markdown, research)` 把资料以纯 markdown 形式插入 `plan_markdown`：
   - **YouTube 视频**：插入到"## 深入理解"段之后的"## 推荐视频"小节，使用 `[![标题](缩略图 URL)](视频 URL)` 语法——ReactMarkdown 会渲染成可点击的缩略图（点击跳转 YouTube）
   - **网页资料**：追加到文末的"## 延伸阅读"小节，使用 `- [标题](url) — 摘要` 列表
2. 在 `course_content["external_resources"]` 顶层字段中保留结构化数据，便于前端未来升级为 iframe 嵌入

不需要任何额外步骤——只要把 `research` 对象透传给 `make_course_content` 即可。

### 质量要求

- **web_query** 要精准：带上项目领域 + milestone + knode 标题关键词（例如 `Mars HiRISE DEM stereo reconstruction`），避免只写 knode 标题
- **youtube_query** 必须用**英文**：Tavily YouTube 通道对中文查询命中率极低
- 不要把 research 结果直接贴进 plan_markdown 的叙述段落，让 `merge_resources_into_plan` 自动处理
- 如果 research 返回的 web_results / youtube_results 都是空的（例如查询词质量差），考虑换一个更通用的查询再跑一次
- 敏感话题不要联网（例如涉及个人隐私、政治等）

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

## Step 2: 抽取 Ideas + 插入占位符

**你是**：一位教育媒体策划师，判断哪些知识点最适合用富媒体呈现。

**从 Step 1 的 plan_markdown 中识别适合做富媒体（animation/game）的知识点，加上 exercise。**

不要为凑数量而强加富媒体。exercise 必须有，animation/game 按难度与 `module_role` 决定。

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

### 数量决策依据（按 difficulty × module_role 分级）

难度采用 10 分制（`difficulty_level` 范围 1-10），区间有重叠以便灵活判断。

| difficulty_level | 档位 | module_role 典型值 | animation 上限 | game 上限 | exercise | 说明 |
|-----------------|------|-------------------|---------------|----------|----------|------|
| 1-2 | 入门型 | foundation / overview | **0** | **0-1** | 1+ | foundation 角色可以用 1 个轻量 game 锚定观察习惯；overview 保持 0 |
| 3-5 | 核心概念型 | foundation / core / skill | **1** | **1** | 1+ | 有足够内容支撑富媒体交互，各不超过 1 个 |
| 5-8 | 深入应用型 | core / skill / integration | **1-2** | **1-2** | 1+ | integration 角色优先 game（互动整合）；不要每个节点都机械地 1+1，应根据内容适配数量和类型 |
| 8-9 | 综合设计型 | integration / capstone | **2** | **2** | 1+ | capstone 必须有 1 个 game 模拟最终交付场景；鼓励 2 animation + 1 game 或 1 animation + 2 game 等非对称组合 |

**核心原则：animation/game 是昂贵资源，只在教学增益明显大于纯文字时才使用。上限不代表必须用满，但也不要机械地每个节点都只生成 1 animation + 1 game。应根据内容特点决定：有的节点适合 2 个 animation（多个可视化流程），有的适合 2 个 game（多种互动维度），有的只需要 1 个 game + exercise 就够了。**

### Mode 选择规则

| Mode | 适合场景 | 约束 |
|------|---------|------|
| `animation` | 动态过程、物理/化学变化、算法步骤、时序流程 | 按上表上限，**不是必须有** |
| `game` | 互动操作、参数调节、因果探索、分类排序 | 按上表上限，**不是必须有** |
| `exercise` | 检测理解、巩固记忆 | **必须有** 1 个 |
| `story` | 抽象概念引入、历史背景、类比解释 | 可选 |

**优先级**：game > animation > story。如果只选 1 个富媒体，优先选 game（互动性最强）。

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
    "topic": "火星路况三分类",
    "context_summary": "学生拖拽 12 张真实火星样本图片到可通行/危险/未知三个桶，系统给出得分与专家注释",
    "mode_reason": "drag_sort 直接对应 hands_on_components 中的人工风险分类动作，并产出接近 acceptance_artifacts 的分类结果",
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

**Mechanic 选择**（必须从以下 5 种中选 1 种）：

| mechanic | 适合场景 | 交互方式 |
|----------|---------|---------|
| `simulation` | 参数 -> 结果因果规律 | 2-4 个滑块控制变量 |
| `drag_sort` | 多概念/事物归类 | 拖拽到目标区域 |
| `match_pairs` | 配对记忆（概念 <-> 定义） | 点击两个匹配项 |
| `timeline_order` | 先后顺序或步骤流程 | 拖拽排序 |
| `boss_quiz` | 综合选择题测验 | 点击选项 |

```json
{
  "style_key": "选定主题",
  "game_mechanic": "simulation",
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

**裁决标准**：
- 如果教学逻辑有错误 -> 直接 **reject**
- 如果技术不可行（100vh 内无法布局、交互过于复杂）-> **reject**
- 如果纯文字就能讲清楚，富媒体增益不大 -> **reject**
- **如果 game 的本质就是选择题（如 boss_quiz 只有点选项），和 exercise 重复 -> reject game，保留 exercise 即可**
- 其他情况 -> **approve** 或 **revise**（简化后通过）

**操作**：
1. 列出每个 idea 的裁决结果
2. 被 reject 的 idea：从 ideas 列表移除，从 plan_markdown 中删除其占位符
3. 需要 revise 的 idea：修改其 detail_plan（通常是简化交互）
4. 向用户报告裁决结果，询问是否同意

---

## Step 5: 实现具体代码

**你是**：一位高级前端开发者 + 教育游戏设计师。

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
13. Canvas 必须有延迟重绘兜底（setTimeout + fonts.ready）
14. 动画播放必须用 requestAnimationFrame，禁止 setInterval
15. 必须包含 i18n 双语支持（EN/CN），默认中文，左上角放语言切换按钮
16. 所有用户可见文本必须通过 I18N 对象 + t(key) 函数查表，禁止硬编码中文或英文字符串
17. Animation 帧切换必须使用共享元素过渡（getFrameElements + lerp + easeInOut，500ms）
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

### Animation HTML 实现

**结构**：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=Inter:wght@400;500&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
<style>
  /* 全局重置 + 深色主题 + 玻璃态 */
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100vh; overflow: hidden; background: #0f0a1e; }
  /* ... 根据 style_key 的 palette 定制配色 ... */
</style>
</head>
<body>
  <!-- 观看指南面板（可折叠） -->
  <div class="guide-panel">...</div>

  <!-- 主动画区域（Canvas 或 SVG） -->
  <canvas id="c"></canvas>

  <!-- 控制栏（播放/暂停/上一帧/下一帧） -->
  <div class="controls">...</div>

  <!-- HUD 数据栏 -->
  <div class="hud">...</div>

<script>
  // 动画逻辑
</script>
</body>
</html>
```

**Canvas 动画规范**：
- 使用 `scripts/course_factory.py` 中的 `make_canvas_html()` 格式作为参考
- 底色：深夜蓝黑渐变 `#0f0a1e -> #1a1035`，带微弱网格（3% 透明白）
- 主发光色根据学科选择（见下方色板）
- 渐变质感：`createLinearGradient` 或 `createRadialGradient`，3 层色
- 发光效果：`ctx.shadowColor = color; ctx.shadowBlur = 12-20`
- HUD 底栏：`rgba(0,0,0,0.55)` 半透明条，高 52px，显示 4 列数据
- DPR 感知：`Math.min(window.devicePixelRatio||1, 2)` 缩放
- 动画运动必须由数学/物理公式驱动，禁止关键帧插值

**学科色板**：

| 学科 | 主发光色 | 辅色 |
|------|---------|------|
| 物理/力学 | `#818cf8` 幽蓝紫 | `#6366f1` |
| 数学/几何 | `#34d399` 翡翠绿 | `#10b981` |
| 化学/生物 | `#f472b6` 荧光粉 | `#ec4899` |
| 地球/天文 | `#fb923c` 橙焰 | `#f97316` |
| 通用/综合 | `#38bdf8` 天蓝 | `#0ea5e9` |

### Game HTML 实现

**结构**同 Animation，但增加交互逻辑：

```html
<!-- 额外需要的元素 -->
<div class="game-area">
  <!-- simulation: 滑块 + 实时模拟画面 -->
  <!-- drag_sort: 可拖拽元素 + 目标区域 -->
  <!-- match_pairs: 卡片网格 -->
  <!-- timeline_order: 可排序列表 -->
  <!-- boss_quiz: 选项卡片 -->
</div>

<div class="feedback-panel">
  <!-- 得分/进度/通关提示 -->
</div>
```

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

#### 元素模型

每帧返回一个元素数组，每个元素有统一结构：

```js
// 常用元素类型
{id:'photo', type:'photo', x:..., y:..., w:..., h:..., alpha:1}
{id:'title', type:'label', text:'...', x:..., y:..., color:'...', size:14, align:'center', alpha:1}
{id:'arrow01', type:'arrow', x1:..., y1:..., x2:..., y2:..., color:'...', alpha:1}
{id:'dict', type:'dict', x:..., y:..., w:..., h:..., highlight:1, alpha:1}
{id:'decision', type:'decision', x:..., y:..., w:..., h:..., active:true, alpha:1}
{id:'features', type:'features', x:..., y:..., w:..., h:..., alpha:1}
{id:'custom1', type:'custom', draw:function(alpha){...}, alpha:1}
```

`getFrameElements(f)` 根据帧号和当前 W/H 计算并返回元素列表。

#### drawElement(el) 分发绘制

```js
function drawElement(el) {
  if (!el || el.alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = el.alpha;
  switch(el.type) {
    case 'photo':    drawPhotoBoxPrimitive(el.x, el.y, el.w, el.h); break;
    case 'label':    drawLabelPrimitive(el.text, el.x, el.y, el.color, el.size, el.align); break;
    case 'text':     drawTextPrimitive(el.text, el.x, el.y, el.color, el.size, el.align); break;
    case 'arrow':    drawArrowPrimitive(el.x1, el.y1, el.x2, el.y2, el.color); break;
    case 'dict':     drawDictBoxPrimitive(el.x, el.y, el.w, el.h, el.highlight); break;
    case 'decision': drawDecisionBoxPrimitive(el.x, el.y, el.w, el.h, el.active); break;
    case 'box':      drawBox(el.x, el.y, el.w, el.h, el.borderColor, el.fillColor); break;
    case 'custom':   el.draw(el.alpha); break;
  }
  ctx.restore();
}
```

#### 工具函数

```js
function lerp(a, b, p) { return a + (b - a) * p; }
function easeInOut(x) { return x < 0.5 ? 2*x*x : 1 - Math.pow(-2*x+2, 2)/2; }
function merge(base, overrides) {
  var r = {};
  for (var k in base) r[k] = base[k];
  for (var k2 in overrides) r[k2] = overrides[k2];
  return r;
}
```

#### 过渡动画核心

```js
var transitioning = false;

function transitionTo(newFrame) {
  if (newFrame < 0) newFrame = 0;
  if (newFrame >= totalFrames) newFrame = totalFrames - 1;
  if (newFrame === currentFrame && !transitioning) { drawFrame(currentFrame); updateHUD(currentFrame); return; }
  if (transitioning) return;

  var oldElems = getFrameElements(currentFrame);
  var newElems = getFrameElements(newFrame);
  var oldMap = {}; oldElems.forEach(function(e){ oldMap[e.id] = e; });
  var newMap = {}; newElems.forEach(function(e){ newMap[e.id] = e; });

  currentFrame = newFrame;
  updateHUD(newFrame);
  transitioning = true;

  var startTime = null;
  var duration = 500; // ms

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var raw = Math.min((timestamp - startTime) / duration, 1);
    var p = easeInOut(raw);

    drawBg();

    // 旧帧独有元素：淡出
    oldElems.forEach(function(oe) {
      if (!newMap[oe.id]) drawElement(merge(oe, {alpha: 1 - p}));
    });

    // 新帧元素
    newElems.forEach(function(ne) {
      var oe = oldMap[ne.id];
      if (oe) {
        // 共享元素：lerp 位置/大小
        var merged = merge(ne, {
          x: lerp(oe.x||0, ne.x||0, p),
          y: lerp(oe.y||0, ne.y||0, p),
          w: lerp(oe.w||0, ne.w||0, p),
          h: lerp(oe.h||0, ne.h||0, p),
          alpha: 1
        });
        // 箭头类型额外 lerp 端点
        if (ne.type === 'arrow' && oe.type === 'arrow') {
          merged.x1 = lerp(oe.x1, ne.x1, p);
          merged.y1 = lerp(oe.y1, ne.y1, p);
          merged.x2 = lerp(oe.x2, ne.x2, p);
          merged.y2 = lerp(oe.y2, ne.y2, p);
        }
        // 文本不同时做交叉渐变
        if ((ne.type==='label'||ne.type==='text') && oe.text !== ne.text) {
          drawElement(merge(oe, {alpha: 1 - p}));
          drawElement(merge(ne, {alpha: p}));
        } else {
          drawElement(merged);
        }
      } else {
        // 新帧独有元素：淡入
        drawElement(merge(ne, {alpha: p}));
      }
    });

    if (raw < 1) {
      requestAnimationFrame(step);
    } else {
      transitioning = false;
    }
  }
  requestAnimationFrame(step);
}
```

#### drawFrame 保留为即时绘制

`drawFrame(f)` 仍然存在，用于 resize / 语言切换等需要立即重绘的场景：

```js
function drawFrame(f) {
  drawBg();
  var elems = getFrameElements(f);
  elems.forEach(function(el) { drawElement(el); });
}
```

#### 共享元素 ID 约定

animation 作者需要为每帧中相同的物体使用相同的 `id`，这样过渡引擎会自动做平滑插值。例如：

| 元素 ID | Frame 0 | Frame 1 | Frame 2 | Frame 3 |
|---------|---------|---------|---------|---------|
| `photo` | 居中大照片 | 左侧缩小 | 更小照片 | (淡出) |
| `title` | 步骤标题 | 步骤标题(文本变) | 步骤标题(文本变) | 步骤标题(文本变) |
| `desc`  | 底部说明 | 底部说明(文本变) | 底部说明(文本变) | - |

文本变化的共享元素（同 ID 但 text 不同）会自动做交叉渐变（旧文本淡出 + 新文本淡入）。

**使用规则**：
- PREV/NEXT 按钮调用 `transitionTo(f)` 而非直接 `drawFrame(f)`
- PLAY 自动播放时也使用 `transitionTo()`
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
[ ] Animation 帧切换使用共享元素过渡（getFrameElements + transitionTo + lerp）?（animation 适用）
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

**帧间过渡（animation 特有）**
```
[ ] 定义了 getFrameElements(f) 返回每帧的元素列表（声明式）
[ ] 每个元素有 id 字段，同 ID 元素在帧间自动 lerp 插值
[ ] transitionTo() 函数实现共享元素动画（lerp 位置/大小 + 淡入淡出）
[ ] PREV/NEXT/PLAY 按钮均调用 transitionTo() 而非直接 drawFrame()
[ ] drawFrame(f) 保留用于 resize / 语言切换等即时重绘
[ ] 包含 lerp(), easeInOut(), merge() 工具函数
[ ] 过渡时长 500ms，easeInOut 缓动
```

### 5.5b. Playwright 自动化浏览器验证

Step 5 中已将 HTML 写入 `scripts/_test_anim_xxx.html` 或 `scripts/_test_game_xxx.html`。
使用 Playwright headless Chromium 自动验证，无需手动打开浏览器。

**单文件验证**（快速检查单个 HTML）：
```bash
node scripts/html_validate.mjs scripts/_test_anim_xxx.html --mode animation
node scripts/html_validate.mjs scripts/_test_game_xxx.html --mode game
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

`html_validate_test.mjs` 自动发现 `scripts/_test_anim_*.html` 和 `scripts/_test_game_*.html`，
对每个文件生成通用测试套件（JS 错误、Canvas 渲染、滚动条），animation 额外测试
NEXT/PREV/PLAY/语言切换，game 额外测试交互元素存在性。

**手动浏览器验证**（可选补充）：
```bash
open scripts/_test_anim_xxx.html
open scripts/_test_game_xxx.html
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
    _upsert_lesson,
    _ensure_db_tables,
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
)
# 如果 preflight 检出违规，此处会直接 raise ValueError，回到 Step 1/2 修正。

# -- 写入 DB --
_ensure_db_tables()
_upsert_lesson(
    project_name="项目名",
    knode_id=0,  # global knode id
    content_type="interactive",
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

### 6b. 如果有 game（make_course_content 不够用时手动组装）

当有 game 类型的 idea 时，`make_course_content()` 只支持 animation + exercise + story，
需要手动构造 CourseContent。这条路径走的是手动 ideas 字典，所以**必须手动调用 `preflight_v41`** 保持与 6a 同等的校验强度：

```python
python3 << 'PYEOF'
import sys, json, time, random, string
sys.path.insert(0, "src")
sys.path.insert(0, ".")
from scripts.course_factory import _upsert_lesson, _ensure_db_tables, load_knode_context, preflight_v41

knode = load_knode_context("项目名", knode_global_idx=0)["knode"]

def _id(prefix):
    ts = int(time.time() * 1000)
    rand = "".join(random.choices(string.ascii_lowercase, k=4))
    return f"{prefix}_{ts}_{rand}"

plan_markdown = """..."""

# 构造 ideas 和 rendered_sections
game_id = _id("game")
anim_id = _id("anim")
ex_id = _id("ex")

ideas = [
    {
        "idea_id": game_id,
        "mode": "game",
        "topic": "...",
        "context_summary": "...",
        "generation_backend": "claude_code",
        "style_key": "...",
        "mode_reason": "...",
        # v4.1 对齐字段（必填）
        "hands_on_ref": "在样例图上手工圈出危险区域并写理由",
        "acceptance_ref": "20 张样例图的人工风险说明",
    },
    {
        "idea_id": anim_id,
        "mode": "animation",
        "topic": "...",
        "context_summary": "...",
        "generation_backend": "claude_code",
        "style_key": "...",
        "mode_reason": "...",
        "hands_on_ref": "浏览并筛选真实火星图像样本",
        "acceptance_ref": "火星图像风险观察笔记",
    },
    {
        "idea_id": ex_id,
        "mode": "exercise",
        "topic": "...",
        "context_summary": "...",
        "generation_backend": "",
        "style_key": "",
        "mode_reason": "直接检验 acceptance_standard 中的「能够现场说明本模块动手动作」",
        "hands_on_ref": "在样例图上手工圈出危险区域并写理由",
        "acceptance_ref": "学生能够现场说明并演示本模块中的至少两项动手动作",
    },
]

rendered_sections = {
    game_id: {
        "mode": "game",
        "status": "ready",
        "html": """...game HTML...""",
        "story_paragraphs": None,
        "exercises": None,
        "generation_backend": "claude_code",
        "user_guide": "...",
    },
    anim_id: {
        "mode": "animation",
        "status": "ready",
        "html": """...animation HTML...""",
        "story_paragraphs": None,
        "exercises": None,
        "generation_backend": "claude_code",
        "user_guide": "...",
    },
    ex_id: {
        "mode": "exercise",
        "status": "ready",
        "html": None,
        "story_paragraphs": None,
        "exercises": [
            {"type": "choice", "question": "...", "options": [...], "correct": 0, "explanation": "..."},
        ],
        "generation_backend": "",
    },
}

course_content = {
    "plan_markdown": plan_markdown,
    "ideas": ideas,
    "rendered_sections": rendered_sections,
}

# -- 手动 v4.1 自检（6b 没有 make_course_content 的自动兜底）--
errors = preflight_v41(knode, course_content)
if errors:
    for e in errors:
        print(f"  - {e}")
    raise SystemExit("v4.1 预写入自检失败，禁止写入")

_ensure_db_tables()
_upsert_lesson("项目名", 0, "interactive", course_content)
print("写入成功!")
PYEOF
```

### 6c. 验证写入结果

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
[ ] Step 0.5: 用 `should_research_knode(knode)` 判断是否需要外部资料；工程/科学/算法/数据类节点必须联网，前置说明/答辩类节点跳过
[ ] Step 0.5: 需要研究时，`research_knode()` 返回的 web_results / youtube_results 至少有一个非空（否则换查询词重试）
[ ] Step 1: plan_markdown 800-1500 字，顶部含 "> Module: {module_id} · {module_role}"，core_question 出现在引入段
[ ] Step 1: 外部资源链接全部使用 `{{KEY}}` shortcode，不含硬编码 URL（grep `https://` 结果应为 0）
[ ] Step 1: 每条学习目标可追溯到 acceptance_standard 或 hands_on_components 中的原文
[ ] Step 2: 3-4 个 ideas，mode/style_key 选择合理，占位符已插入
[ ] Step 2: 每个 idea 含 hands_on_ref / acceptance_ref，且至少一条 hands_on_components 被覆盖
[ ] Step 3: 每个 idea 的 detail_plan 完整（含 user_guide），exercise 每道题带 ref 字段
[ ] Step 4: debate 完成，reject 的已移除，向用户确认
[ ] Step 5: HTML 通过自检清单，exercises 有 4 题且有解析
[ ] Step 5.5a: Code Review 通过（事件绑定、Canvas 时序、flex 布局、rAF）
[ ] Step 5.5b: Playwright 验证通过: node scripts/html_validate.mjs <file> 返回 exit 0
[ ] Step 5.5b: 批量验证通过: cd scripts && npx playwright test --config=playwright.config.mjs
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
| `make_course_content(..., knode, *_hands_on_ref, *_acceptance_ref, research)` | 已就绪 | 传入 knode 时默认 `preflight=True` 自动校验；传入 research 时自动融入 plan_markdown + external_resources |
| `should_research_knode(knode, milestone) -> bool` | 已就绪 | 启发式判断节点是否需要联网搜索外部资料 |
| `research_knode(knode, ..., web_query, youtube_query) -> dict` | 已就绪 | 调用 Tavily Search 抓取网页 + YouTube 资料，返回结构化结果 |
| `merge_resources_into_plan(plan, research) -> str` | 已就绪 | 把资料以纯 markdown 形式注入 plan_markdown（推荐视频 + 延伸阅读） |
| Gateway API `api_project_detail` 返回 v4.1 字段 | 已就绪 | 前端 / LLM 可以直接读取 `knode.module_id` / `core_question` 等 |
| 单元测试 `tests/test_course_factory_v41.py` | 已就绪 | 21 个 case 覆盖 preflight 所有分支、make_course_content 注入、load_knode_context 边界 |
| 单元测试 `tests/test_course_factory_research.py` | 已就绪 | 31 个 case 覆盖 should_research 启发式、YouTube URL 解析、merge_resources 融入、research_knode 的 mocked Tavily 调用 |

**使用约定**：
- 有 animation + exercise + story 的常规组合，直接走 Step 6a（`make_course_content(knode=..., research=...)` 一次完成研究/组装/自检）
- 有 game 的组合，走 Step 6b（手动构造 ideas/rendered_sections），在写入前**手动调用** `preflight_v41(knode, course_content)` 并检查返回列表为空；如需外部资料，手动在写入前调用 `merge_resources_into_plan(plan, research)` 并把 `research` 结构存到 `course_content["external_resources"]`
- 临时关闭自检（比如 story-only、或 knode 是旧版但你确定要写入）：`make_course_content(..., preflight=False)`
- 跳过外部资料研究：不传 `research` 参数即可（或显式 `research=None`）
