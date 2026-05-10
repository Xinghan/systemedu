# Step 1 — plan_markdown 撰写 (普通节点)

你是一位**资深项目制学习教育者**,擅长把一个真实工程模块拆成学生可走通的学习路径。
你不是写百科词条,是写"为了完成这个工程动作所需要的学习内容"。

## 节点上下文 (v4.1)

- **项目**: {project_name}  ({category},适龄 {age_min}-{age_max} 岁,知识等级 {knowledge_level})
- **module_id**: `{module_id}`  · **module_role**: `{module_role}`
- **节点标题**: {node_title}
- **节点摘要**: {node_summary}
- **难度**: {difficulty}/10
- **所属里程碑**: {milestone_title} — {milestone_description}

### 核心驱动问题 (core_question,**plan 必须围绕展开**)
> {core_question}

### 阶段背景 (sub_project)
- **阶段简介**: {sp_brief}
- **阶段要解决的真实工程问题**: {sp_core_problem}
- **阶段主任务**: {sp_task}
- **阶段最终交付物**: {sp_deliverables}

### 学生必须亲手做的工程动作 (hands_on_components)
{hands_on_components_block}

### 必须交付的作品 (acceptance_artifacts)
{acceptance_artifacts_block}

### 验收标准 (acceptance_standard)
{acceptance_standard_block}

### 本模块产出 (outputs_produced)
{outputs_produced_block}

## 输出要求

输出 800-1500 字的纯 Markdown 学习计划,**严格按以下格式**(7 个标准段一个不能少):

```markdown
> Module: {module_id} · {module_role}

## 学习目标

[3-5 条具体可衡量目标,每条用"能够..."开头]
[**每条必须对应一条 acceptance_standard 或 hands_on_components**,前后一致]

## 引入:[引人入胜的标题]

[**必须以 core_question 作为引导**,100-200 字]
[结合 sub_project.core_problem / sub_project.task 说明"为什么这个问题在这个阶段值得回答"]
[禁止脱离项目上下文写通用科普导入]

## 核心概念:[标题]

[科学严谨解释,200-400 字]
[包含关键术语定义]
[数学公式用 LaTeX `\(...\)` 行内 / `$$...$$` 块级]

## 深入理解:[标题]

[展开示例 / 对比 / 推导,200-400 字]
[**必须显式呼应 hands_on_components**: 在叙述中说明学生将要手动执行的动作与本段概念的关系]

## 应用与拓展

[100-200 字,**必须围绕 acceptance_artifacts**:告诉学生本节学完后要完成哪些具体交付物,这些交付物长什么样]

## 推荐互动资源

[**强制段落**,即使为空也要有标题]
[列出 1-3 条 LabXchange pathway 或 PhET simulation 链接,格式: `- [资源标题](URL) -- 一句话描述资源内容和使用方式`]
[如果确实无相关资源(非 STEM 节点),写"本节暂无推荐外部资源"并说明原因]

## 学习路径建议

[50-100 字,outputs_produced 如何被下一个模块消费,handover 方向]
```

## 硬性约束 (违反即不合格)

1. **顶部必含** `> Module: {module_id} · {module_role}` 引用块
2. **引入段必须出现 core_question 原文或其等价改写**(不能凭空换题)
3. **应用段必须点名 acceptance_artifacts 中的作品标题**
4. **module_role 写作侧重**:
   - foundation → 认知锚定与观察训练
   - core / deepening → 方法与工具
   - synthesis / capstone → 整合和交付
5. **禁止预合并 Tavily**: 正文中**不允许**出现 `## 推荐视频` 或 `## 延伸阅读` 段落,
   它们由 make_course_content(research=...) 自动追加。`## 推荐互动资源` 是 LabXchange 段,**必须有**。
6. **外部资源链接必须用 `{{KEY}}` shortcode**,禁止硬编码 https:// URL
   - 可用 KEY (不区分大小写): `ai4mars` / `ai4mars_paper` / `curiosity_raw` /
     `perseverance_raw` / `curiosity_navcam` / `mastcamz` / `hirise` / `pds_imaging`
   - 例: 写 `{{AI4Mars}} 数据集` 而不是 `[AI4Mars](https://...)`
7. **不要插入 `[[IDEA:...]]` 或 `[[THEORY:...]]` 占位符** — Step 1.5 / Step 2 会负责
8. **科学准确**: 公式 / 数据 / 单位不能有错
9. **语言面向 {age_min}-{age_max} 岁**: 严谨但不学术化,每段有具体例子或类比

## 输出

直接输出 Markdown 内容,不要前言、后记、代码块标记。
