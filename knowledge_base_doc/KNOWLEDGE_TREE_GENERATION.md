# 知识树生成流程手册（Claude Code 人工生成）

> 本手册面向 **Claude Code 本人**。用户会给一个项目主题（PDF / 文字 brief / 规则文档），由 Claude Code 亲手按照本手册步骤，生成一份符合 `knowledge_tree_template_commented_v5.jsonc` 结构的 **单项目超细版知识树 JSON**。
>
> 生成过程**不是 LLM API 调用**，也**不是脚本自动化**，而是 Claude Code 在对话中按清单执行的受控创作流程。

---

## 0. 适用范围

- **目的**：为一个从约 10 岁儿童起步、经过数月到数年持续学习，最终完成真实、完整、前沿、工业级项目的学习者，构建一棵可落地、可验收、可扩展的单项目知识树。
- **产物**：`projects/<project-name>/knowledge_tree.json`（纯 JSON，无注释）。
- **配套**：`projects/<project-name>/project.yaml`（项目元信息）、可选 `project_brief.json`（结构化 brief）。
- **参考权威文件**（以下文件变更时本手册也要同步更新）：
  1. `knowledge_base_doc/batch_project_knowledge_tree_prompt_v8.md` —— 主 prompt 规则
  2. `knowledge_base_doc/knowledge_tree_template_commented_v5.jsonc` —— JSON 字段结构
  3. `projects/mars-risk-map/knowledge_tree.json` —— 已完成的标准样例

---

## 1. 输入要求

用户在启动一次知识树生成时，应提供以下其中之一：
1. **一个主题 + 已有文件**（例：本项目主题 "火箭制造"，参考 `projects/rocket_design.pdf`）
2. **一个 project.yaml + 已有 brief**（Claude 需要从中提炼 mother topic）
3. **一段文字描述**（项目名称 + 目的 + 期望终局 + 年龄区间）

若信息不足以填写 `project_identity` / `target_learner` / `project_positioning` 三个顶层字段中的关键项，Claude Code 必须在生成前向用户追问，不得凭空编造关键事实（如比赛规则、设备限制、数据源）。

---

## 2. 生成流程（必须严格按顺序执行）

### Step 1. 理解项目本体（Industrial Identity）

> 先问清楚"这个项目到底是什么"。不能停留在儿童视角。

1. 阅读用户提供的 PDF / brief / 规则原文；如是 PDF，先用 `pypdf` 抽取纯文本。
2. 在心里回答三个问题：
   - **工业本体（industrial kernel）**：行业里真正在做的那件事是什么？（不是"造个小火箭玩玩"，而是"固体火箭推进、气动外形、结构、回收系统的完整工程设计 + 制造 + 发射验证"。）
   - **真实终局（final deliverable）**：最终要交付的真实物件/系统是什么？允许有比赛、验收或发射事件作为锚点。
   - **工业对标（industry analogue）**：现实工业界有谁在做同样性质的事？（JPL、SpaceX、NASA、长征系列、Estes Rockets、学生航天赛等。）
3. 列出 2-5 条 `real_industry_examples` 候选 —— 每一条必须是真名真事。
4. 列出 2-5 条 `real_data_and_resource_sources` 候选 —— 真实数据集、真实平台、真实软件、真实硬件、真实比赛规程等。

### Step 2. 列出从零到终局的"概念台阶"

> 这是整个流程中**最关键**的一步。不要先决定阶段数量，而是先完整列出所有台阶。

步骤：
1. 从**终局**向**入口**倒推：最终系统要用到哪些子系统 / 知识 / 工具？
2. 每个子系统再倒推它的前置概念。
3. 一直倒推到"10 岁儿童的日常生活经验"为止。
4. 把所有台阶**展平成一个线性列表**，每条一到两句话（"学完这个之后能做 X"）。
5. 检查三层完整性：
   - **L1 基础科学素养**：物理、化学、生物、数学、地球科学中，本项目依赖的最基础概念是否都有？
   - **L2 桥梁概念**：数据层（分辨率、泄漏、类别不平衡）、模型层（过拟合、误差传播、阈值）、工程层（接口、同步、噪声、材料疲劳、气动稳定）是否有？
   - **L3 领域隐含知识**：业内人视为常识但儿童完全不知道的概念（例：推力曲线、总冲 = 推力积分、压心 vs 质心、空气动力稳定性）是否有？
6. 如果任何一层缺失概念，**先补齐台阶列表再继续**。

### Step 3. 按四段式节奏聚类

> 把 Step 2 产出的台阶列表聚成阶段，而不是相反。

v8 prompt 规定整棵树节奏为四段式（比例可微调）：

| 段 | 占比 | 典型等级 | 核心任务 |
|---|---|---|---|
| A. 好奇心与直觉 | 15-25% | K0-K1 | 生活经验类比、可视化、动手体验 |
| B. 工具与方法入门 | 20-30% | K1-K2 | 数据/规则/基础编程/简单测量 |
| C. 核心技术深入 | 25-35% | K2-K4 | 子系统设计与验证 |
| D. 系统集成与工业级验证 | 15-25% | K3-K5 | 端到端、真实约束、复盘 |

- 聚类时**允许**一个段跨多个 stage。物理项目的段 C 通常要拆成多个 stage（如"推进"、"结构"、"气动"、"回收"分别一 stage）。
- **禁止**把段 A 压缩到 1 个 stage，基础铺垫要铺开。
- **禁止**让各段模块数量相等；按概念密度自然变化。

### Step 4. 决定 stage 数量和每个 stage 的边界

- 典型单项目树 **12-17 个 stages**（小项目可 8-10，复杂跨学科可 15-20）。
- 给每个 stage 写清楚：
  - `stage_goal`（这一阶段学完能做什么）
  - `why_this_stage_exists`（为什么不能省）
  - `concept_density_class`（low / low_medium / medium / medium_high / high）
  - `new_concept_count_estimate`（估计引入多少新概念）
  - `module_count_reason`（为什么拆成 N 个模块）
  - `closing_capstone_module_id`（阶段末 capstone 模块的 id 占位）
  - `capstone_reuses_outputs_from_stages`（要复用哪些前序阶段产物）
- 阶段编号从 `S0` 或 `S1` 开始均可；入门段建议用 `S0` 以强调"前置起点"。

### Step 5. 生成顶层三个特殊节点（Special Nodes）

v8 prompt 强制要求，绝不能合并到 stages 里：

1. **project_overview**（`display_order_hint: "first"`）
   - 必填：`project_background`、`core_mission`、`knowledge_coverage_domains`、`real_industry_examples`(2-5 条)、`real_data_and_resource_sources`、`why_this_node_exists`、`connection_to_main_tree`、`related_stage_ids`（列出全部 stages）。
   - 综合集成字段全部留空数组或 null：`integration_reuses_stage_outputs`、`system_integration_scope`、`comprehensive_experiment_description`、`final_validation_artifacts`、`final_validation_standard`、`future_extension_paths`。

2. **project_integration_and_final_validation**（`display_order_hint: "after_all_stages_before_future_extension"`）
   - 必填：`system_integration_scope`（说明接起来的子系统）、`comprehensive_experiment_description`（描述一次端到端综合实验）、`final_validation_artifacts`（系统级交付物）、`final_validation_standard`（至少 4 条）、`integration_reuses_stage_outputs`（列出前序阶段产物名称）。
   - `real_industry_examples` 留空数组；`real_data_and_resource_sources` 写"综合实验包"等。

3. **future_extension**（`display_order_hint: "last"`）
   - 必填：`future_extension_paths`（3-5 条，每条含 `path_id`、`title`、`direction_type`、`description`、`reuses_existing_assets`、`new_capabilities_needed`、`real_world_value`、`open_problems_or_unsolved_challenges`）。
   - `project_background` 可填 null；综合集成字段全部空。

三个节点必须放在 `special_nodes` 数组里，顺序即 overview → integration → future_extension。

### Step 6. 展开 modules（细粒度节点）

对每个 stage，按照 `module_count_reason` 里声明的数量展开 module。每个 module 需填写：

**必填字段**：
- `module_id`（格式建议 `<PROJECT_ID>-M<三位数字>`，全项目全局递增）
- `title`（入门段禁止行业术语，越白话越好）
- `stage_id`
- `sequence_order`（全项目递增）
- `module_role`（`foundation` / `skill` / `core` / `integration` / `validation` / `capstone` / `platform`）
- `is_acceptance_unit: true`
- `summary`（必须以"能够..."开头，写**能力**而不是"介绍概念"）
- `detailed_description`（比 summary 更展开，说明它在整个项目链条中干什么）
- `mission_role`（它在项目使命里的位置）
- `core_question`（这一节最关键要回答的那个问题）
- `why_non_skippable`（为什么不能跳过）
- `rough_learning_topics`（3-6 个粗粒度学习点）
- `what_it_inherits`（继承了哪些前序能力/产物，第一个模块写"无前序依赖，从零开始"）
- `outputs_produced`（可交付对象，不是抽象收获）
- `what_it_passes_forward`
- `real_world_anchor`（真机/台架/现场/数据集/工作流）
- `capstone_scope`（非 capstone 填 null；capstone 填 `"current_stage_plus_required_previous_stages"`）
- `integrates_previous_stage_outputs`（非 capstone 填 `[]`；capstone 必须列出前序阶段产物名称）
- `hands_on_components`（2-4 条，必须是动手动作，不能是"讨论 / 汇报 / 讲解"）
- `engineering_practice_evidence`（什么证据能证明它不是纸上谈兵）
- `acceptance_artifacts`（1-2 项，每项含 `artifact_id`、`title`、`description`、`format`；format 取 `doc / sheet / code / demo / hardware / dashboard / report / video / drawing / model`）
- `acceptance_standard`（至少 3 条；capstone 至少 5 条且必须覆盖"整合前序 / 动手实践 / 可运行可测"三件事）
- `depends_on`（只写直接前置，不写传递前置；第一个模块填 `[]`）
- `dependency_reason`
- `estimated_duration_months`（字符串，如 `"0.5"`、`"1-2"`、`"2-3"`）
- `knowledge_level`（使用 `knowledge_levels` 里定义的 id，如 `K0`/`K1`/`K2`/`K3`/`K4`/`K5`）
- `expansion_priority`（`low` / `medium` / `high` / `very_high`）

**入门段额外约束**（前 10% 的模块 = 全部 K0 或 K1；前 20% 的模块 = 无 K3 及以上）：
- `hands_on_components` 禁止出现"编程"、"训练模型"、"ROS2"、"系统集成"等。
- `acceptance_artifacts` 用 `drawing / sheet / model / video / demo`，避免 `code`。
- `title` 必须是 10 岁儿童一眼能读懂的句子。
- `summary` 用"能够描述 / 能够区分 / 能够画出 / 能够动手做出"。

**capstone 模块额外约束**：
- 每个 stage 的最后一个 module 必须是 `module_role: "capstone"`。
- `integrates_previous_stage_outputs` 非空。
- `acceptance_standard` 至少 5 条，其中至少一条验证"综合整合"、一条验证"动手实践"、一条验证"可运行 / 可测试 / 可复现"。

### Step 7. 编写 edges（显式关系）

- `edges` 数组用于表达模块之间的**非线性依赖** / **跨阶段数据流** / **反馈闭环** / **评测回流**。
- 不要把所有 `depends_on` 都再抄一遍到 edges；那是冗余。
- 只保留三类边：
  1. **data_flow**：某个模块的输出被远处模块消费（如 S5 分割模型 → S12 集成节点）
  2. **interface_flow**：接口级传承（传感器接口、代价地图格式）
  3. **evaluation_feedback / replanning_feedback**：闭环反馈（测试结果回流到设计模块）
- 每条边必须写 `what_is_transferred`（能力/数据/接口/约束等具体对象）和 `reason`（为什么这条边重要）。
- 典型数量：**20-40 条**。少于 10 条说明树缺少闭环；多于 60 条说明写得太细。

### Step 8. 自检清单（必须全部通过再输出）

以下条目来自 v8 prompt §六，全部 `✓` 后才能写 JSON：

- [ ] 第一个模块的标题，一个 10 岁小学生能读懂吗？
- [ ] 前 10% 的模块是否全部 K0 或 K1？
- [ ] 前 20% 的模块中是否没有 K3 或以上？
- [ ] 项目依赖的基础科学概念（力、运动、燃烧、压强、材料等），是否已在入门段有对应模块？
- [ ] 是否存在"概念跳跃"（某模块要求了前面没教过的前置知识）？
- [ ] 每个阶段的模块数量是否随概念密度自然变化？
- [ ] 入门阶段的验收作品是否适合儿童（不要求编程或系统）？
- [ ] 所有 summary 是否都是"能够..."能力句？
- [ ] 三个特殊节点（overview / integration / future_extension）是否完整？
- [ ] 难度曲线是否呈现"平缓起步、逐步攀升"？
- [ ] 是否存在任何与项目知识无关的节点（学习方法、软技能、品德教育、家长责任等）？
- [ ] 每个 stage 是否有 capstone，且 capstone 的 `integrates_previous_stage_outputs` 非空？
- [ ] `special_nodes[1]`（integration 节点）是否同时填写了 `system_integration_scope` / `comprehensive_experiment_description` / `final_validation_artifacts` / `final_validation_standard`？
- [ ] `edges` 是否至少涵盖一条从感知 / 数据产出阶段到 integration 节点 / 最终 stage 的 data_flow 边？

### Step 9. 输出 JSON

- 用 `Write` 工具写入 `projects/<project-name>/knowledge_tree.json`。
- 写完**立刻**用 Python 验证合法性：
  ```bash
  python3 -c "import json; d=json.load(open('projects/<name>/knowledge_tree.json')); \
    print('stages:', len(d['stages']), 'modules:', len(d['modules']), \
    'special_nodes:', len(d['special_nodes']), 'edges:', len(d['edges']))"
  ```
- 同步写 / 更新 `projects/<name>/project.yaml`：必须包含 `name / title / description / age_range / category / tags / knowledge_level / knowledge_tree: ./knowledge_tree.json`。

### Step 10. 写回项目目录

```
projects/<project-name>/
├── project.yaml            # 元信息
├── project_brief.json      # 可选：结构化 brief（one_liner, real_problem, ...）
└── knowledge_tree.json     # 本次产出
```

---

## 3. 禁止清单（v8 prompt §五 汇总）

- 禁止带注释或 markdown 代码块 —— 输出文件必须是纯 JSON。
- 禁止生成教学管理类节点（能力评估、学习合同、路径分流、打卡、汇报答辩）。
- 禁止生成软技能 / 品德 / 家长责任 / 笔记技巧等节点。
- 禁止跳过基础科学铺垫。
- 禁止让入门段的 capstone 要求写代码或做系统。
- 禁止在入门段标题出现行业术语。
- 禁止把 `project_integration_and_final_validation` 写成最后一个 stage 的内部 capstone —— 它必须是顶层 `special_nodes` 里的独立节点。
- 禁止使用 emoji（项目全局约束）。

---

## 4. 火箭项目（参考示例）的应用备忘

当项目是固体燃料火箭设计 / 制造 / 发射（如 `projects/rocket_design.pdf`）时，Claude Code 应注意：

- **工业本体**：固体火箭推进 + 气动外形 + 结构强度 + 回收系统 + 发射操作 + 飞行性能测量。
- **真实终局**：按比赛规则造出总冲 ≤30/50 N·s、总质量 ≤500 g、非金属主体、直径 ≥45/60 cm 降落伞的可发射单级或多级火箭，并完成真实发射和高度数据采集。
- **安全边界**：固体燃料发动机和点火头属于 4 级危化品，**只能由安全员 / 指导教师 / 组委会保管和安装**；学生只负责箭体设计、制造、组装（除发动机外）和回收 —— `safety_boundaries.restricted_or_supervised_only` 必须明确这一条。
- **必补的基础科学模块**：力与反作用力、质量与质心、推力与总冲、空气阻力、压心、气动稳定性、抛物轨迹、降落伞空气动力、材料强度、燃烧与推进剂。
- **必补的桥梁概念**：CG 与 CP 的相对位置（稳定性裕度）、质心前移 / 稳定性判据、推重比、开伞时机、测高模块气压原理、高度换算、坐标系与轨迹。
- **入门段典型 capstone**：画出完整的火箭解剖图 + 解释每个部件作用 + 用纸板 / 橡皮筋做一个可动模型火箭。
- **全项目最终综合实验**：按比赛规则完成一次完整发射 —— 现场组装、安装测高模块和发动机（由安全员 / 教师操作发动机安装）、发射、回收、读取高度数据、完成技术问辩答辩。

---

## 5. 变更与版本

- **v1.0** — 2026-04-10 初版，基于 v8 prompt + v5 template + mars-risk-map 样例编写。
- 每次 v6/v7 → v8 → v9 prompt 或 template 有重大变化时，必须同步刷新本手册 §2 和 §3。
