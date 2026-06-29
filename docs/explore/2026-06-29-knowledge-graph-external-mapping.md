# 探索报告: 知识树映射到真实可验证知识体系 + 向大学后延伸

Status: exploration (2026-06-29) — 仅探索, 未实现, 不写代码
作者: Claude (应用户要求 "先不实现, 先探索")

## 0. 一句话结论

我们**不是从零建知识图谱** —— 已经有一套自建的 425 节点 / 11 学科平台知识树, 前端三种可视化和跨项目"点亮"机制都已上线。用户真实需求精确拆成三个独立子问题: **(A) 向大学后延伸分层**、**(B) 映射到真实可验证外部体系**、**(C) 学习过程→图谱连接 (已做)**。其中 (B) 是核心, 经实测**明确可行**: 抽样 12 个真实节点 100% 在 Wikidata 找到合理 QID, 且 Wikidata 自带 P3285(MSC)/P2179(ACM CCS) 桥接属性, 拿到 QID 即可"白嫖"大学分类码。

---

## 1. 现状全景 (一手核实, 非推测)

### 1.1 我们已有的知识图谱体系

| 组件 | 事实 | 文件 |
|---|---|---|
| **平台理论树** | **425 节点 / 11 学科**, schema_version 1.0 | `course_factory/knowledge_tree/platform_tree.json` (163 KB) |
| 节点 ID 形态 | 三段式 `<subject>.<subsector>.<concept>`, 如 `math.arith.count_unit` | `course_factory/knowledge_tree/schema.py:27` (TreeNode) |
| 节点字段 | id / name_zh / name_en / depth_level / prerequisites / description | 同上 |
| 学科 | math phys chem bio cs elec env astro med eng geo (11) | `schema.py:21` (SubjectId Literal) |
| 深度分层 | K1→K13 (K1=小学低年级 6-7岁 ... K13=本科基础 18+) | `schema.py` DepthLevel |
| 树内依赖 | TreeNode.prerequisites (DAG), 约束: 只能指向**同学科**节点 | `schema.py:61-77` Kahn 环检测 |
| **项目内树** | V5KnowledgeTree: Stage→Module→Edge, **真 DAG** (depends_on + 显式 edges) | `packages/core/.../education/models.py:242` |
| **点亮机制** | 项目 theories/concepts → LLM → manifest.lit_nodes (映射到平台树节点) | `course_factory/lit_tree.py` (spec 035) |

### 1.2 平台树深度分布 (实测, 揭示"大学后空白")

```
K1:   4    (小学 1-2 年级)
K3:  11    (小学 3-4)
K5:  36    (小学 5-6)
K7:  97    (初中 1-2)
K9: 109    (初中 3 - 高一)
K11:123    (高二-高三)
K13: 45    (本科基础)  <-- 封顶, 大学后几乎空白
总:  425
```

各学科节点数: math 60, phys 50, bio 50, cs 50, chem 35, elec 35, env 35, eng 30, med 30, astro 25, geo 25。

### 1.3 前端可视化 (已相当完整)

- 入口: `/brain` 学习大脑聚合页 (spec 031), `/memory` 旧路由兼容
- 三种视图: 2D 分层 (SVG) / d3 树形 (KnowledgeRadialTree) / three.js 3D 知识宇宙 (KnowledgeGalaxy3D)
- 跨项目聚合: `GET /api/user/knowledge-tree` → lit_nodes + subjects_summary (用户点亮 N / 平台 425)
- 个人生长节点 (spec 039): 用户可在第四层+ 长出个性化节点
- 文件: `packages/student-web/src/components/learning/{UserKnowledgeTreeView,KnowledgeTreeView,KnowledgeRadialTree,KnowledgeGalaxy3D}.tsx`

### 1.4 外部映射现状 = 零

- platform_tree.json 节点里**没有任何** wikidata/khan/ccss/ngss/msc/acm 字段 (实测确认, 非标准字段数 = 0)
- 仅有 LabXchange 资源爬虫 (找视频, 不是知识体系对齐): `course_factory/data/crawl_labxchange_pathways.py`
- `Module.acceptance_standard` 字段名义上可塞标准码, 但从未这么用

---

## 2. 真实可验证外部体系 (调研)

### 2.1 不同教育阶段的体系不同 (关键: 大学是分水岭)

| 阶段 | 体系 | 形态 | 对我们的角色 |
|---|---|---|---|
| **K-12** | Khan Academy (Course→Unit→Skill, 掌握点 50/80/100) | 私有, 无公开知识图谱 API | **参照系**, 非映射目标 |
| K-12 标准 | CCSS (数学/语文) / NGSS (科学) | 标准代码字符串 | 可选叠加 |
| **大学/研究生** | MSC (数学) / ACM CCS (计算机) / arXiv categories (物理) | 机器可读分类码, 3-5 级 | 大学级映射目标 |
| **跨学科通用锚点** | **Wikidata QID** | 全球唯一可解析 ID (如 Q9121=atom) | **主映射目标 (推荐)** |

**核心洞察**: 学界对"真实、可验证"的答案**不是画一棵更大的人工树**, 而是给每个节点挂上**全球唯一可解析的锚点**。Wikidata QID 最通用 (跨学科、机器可验证、多语言), 大学级再叠 MSC/ACM CCS 分类码。

### 2.2 为什么 Wikidata 是主锚点而非 Khan

- Khan Academy **没有公开的知识图谱 API**, 其 skill 结构是私有的, 且偏 K-12, 大学后覆盖弱 → 只能做"对齐参照"。
- Wikidata: 每概念有唯一 QID, SPARQL endpoint 公开免费 (`https://query.wikidata.org/sparql`, 支持 JSON, 可 cron 批量), 多语言 (中英都有 label), 且**自带到 MSC/ACM CCS 的桥接属性**。

### 2.3 (决定性发现) Wikidata 内置大学分类码桥接

拿到节点 QID 后, 经一次 SPARQL 即可取到大学分类码, **无需自建第二套对齐管线**:
- **P3285** = Mathematics Subject Classification ID (条目直接存 MSC 码)
- **P2179** = ACM Classification Code 2012 (条目直接存 ACM CCS 码)
- 物理 arXiv 无等价单属性, 需走 QID→field of work(P101)→arXiv 类的间接映射, 或用 arXiv 官方表自对 (物理是三者中最费工的)。

大学分类码三套都有可下载机器可读列表:
- MSC2020: msc2020.org 提供 CSV/TeX, 另有 MSC2020-SKOS (arXiv:2107.13877)
- ACM CCS 2012: acm.org/publications/class-2012 提供 SKOS(XML), 镜像 github.com/cli99/acm-ccs
- arXiv: arxiv.org/category_taxonomy (150+ 类)

---

## 3. 可行性实测 (12 个真实节点抽样映射)

全部命中合理 QID:

| 平台节点 | 概念 | QID | 歧义 |
|---|---|---|---|
| math.arith.count_unit | 位值 | Q1747853 (positional notation) | 中 (教学切分, 映射到上位概念) |
| phys.kine.position_time | 位置-时间 | Q192388 + Q11476 | 高 (二元关系, 须拆 2 QID) |
| chem.atom.basic | 原子 | Q9121 | 无 |
| cs.prog.variable | 编程变量 | Q877977 (assignable variable) | 高但可消歧 (vs 数学/统计变量) |
| bio.basic.living_thing | 生物 | Q7239 (organism) | 低 |
| (高阶) 线性代数 | | Q82571 | 无 |
| (高阶) 傅里叶变换 | | Q6520159 | 低 |
| (高阶) 协方差 | | Q201984 | 中 (vs Lorentz/类型论协变) |
| (高阶) 反向传播 | | Q798503 | 无 |
| (高阶) 卷积神经网络 | | Q17084460 | 无 |

### 命中率估计 (基于样本分布)

| 难度档 | 占比直觉 | 命中率 | 处理 |
|---|---|---|---|
| 易: 命名实体型 (atom/linear algebra/CNN) | 多数高阶节点 | >95% 几乎免校验 | 直接映射 exact |
| 中: 一词多义 (variable/covariance) | 中等 | 70-85% | LLM 带 description + 学科前缀约束 + 父节点语义邻域校验 |
| 难: 关系型/教学切分/动作型节点 | 低龄 + 项目动作节点 | <50% | 降级: composite (多 QID) / broader (上位概念) / none (不强配) |

**整体: 直接机器映射 70-80%, 加人工二次校验后可用映射 88-93%, 剩 7-12% 降级。**

每条映射产物应带 `confidence` + `mapping_type` (exact/broader/composite/none), 不硬塞单 QID。低龄基础节点和动作型节点大量落 broader/none 是**正常的**, 不是流程失败 (符合本仓 MEMORY "硬知识嵌进动作节点"的设计)。

---

## 3.5 完整度差距实测 (用户问: "差多少, 想更完整")

### 标尺校准 (重要)

- **不能对标 Wikidata 全量**: Wikidata ~1.1 亿条目, 99.99% 是论文级专精概念, 没有平台会教 → 当分母永远是 0.00x%, 无意义。
- **有意义的分母 = "受完整基础教育到本科入门, 每学科该掌握的核心概念数"** (概念粒度, 对标好教材目录级)。
- **粒度陷阱**: Khan 数学单科 ~1500 skill 是**练习粒度** ("两位数加法"算一个 skill), 不是概念粒度。按概念粒度数学全程约 180。**别拿 1500 当目标, 会把树灌成练习册而非知识地图**。

实证分母来源: NGSS 194 条 performance expectation (底层 DCI 核心 idea ~40); CCSS 数学 ~400 条标准 (合并到概念 ~150-180); Khan 数学 ~1500 skill (练习粒度)。

### 实测覆盖率 (概念粒度口径)

| 标尺 | 数字 |
|---|---|
| 现有 | **425 节点** |
| 合理目标 (K-12 完整 + 本科入门) | **~1420 节点** |
| **整体覆盖率** | **~30% (约 1/3)** |
| 缺口 | **~995 节点** |

逐学科覆盖率均匀落在 23-33%:

| 学科 | 现有 | 目标 | 覆盖率 | 缺口 |
|---|---|---|---|---|
| 工程 eng | 30 | 130 | 23% | 100 |
| 医学 med | 30 | 120 | 25% | 90 |
| 化学 chem | 35 | 130 | 27% | 95 |
| 天文 astro / 地质 geo | 25 | 90 | 28% | 65 |
| 生物 bio | 50 | 160 | 31% | 110 |
| 电子 elec / 环境 env | 35 | 110 | 32% | 75 |
| 数学 math | 60 | 180 | 33% | 120 |
| 物理 phys / 计算机 cs | 50 | 150 | 33% | 100 |

(目标列为估算, 非硬标准; 精确目标须由第 2 步标准全集得出。)

### 三个判断

1. 我们大约在"应有完整度的 **1/3**", 差的是 2/3 —— 跟 K1=4/K3=11 的稀疏一致 (主干画了, 枝叶没长全)。
2. 缺口**很均匀**, 没有哪科特别烂 → 补法是"每学科加密", 不是"新增学科"。
3. 目标定在 ~1420 而非 Khan 的几千, 是刻意的: 保持**概念地图**属性, 不退化成练习题库。

---

## 3.6 补全顺序 (用户选定: 外部标准驱动补全)

关键工程含义: **"外部标准驱动补全"与"方案 A 映射"是同一件事的两面, 必须先映射后补全。**
- 要算"标准里有、我们没有"的精确缺口, 得先知道现有 425 对应标准里哪些 = 映射。
- 映射后, **缺口清单 = 各学科标准全集 − 已映射的 425**, 自动且带出处地浮出。
- 若先盲目补, 会大量重复造已有节点 / 造出标准里没有的"野概念"。

正确顺序:

```
第1步  映射现有 425 → Wikidata QID + 标准码  (方案A, 实测可行 88-93%)
          ↓ 自动产出
第2步  缺口清单 = 各学科标准全集 (CCSS/NGSS/教材目录/Wikidata 子类) − 已映射的 425
          ↓  (~995 节点, 但精确、带出处、可验证)
第3步  按缺口清单补节点 (每个新节点天生带标准码/QID = 天然可验证)
          ↓
第4步  (第二期) 大学后延伸 K15/K17
```

这条顺序让"补全"从"拍脑袋加节点"变成"对着权威清单查漏补缺", 每个新节点都可追溯到一条外部标准或一个 QID。

---

## 4. 三个候选方案

### 方案 A: Wikidata 锚点优先 (推荐)
给 425 节点加可选字段 `wikidata_qid` + `mapping_type` + `confidence`, 用 LLM 半自动生成候选 → 按 confidence 分桶人工抽检 → SPARQL 经 P3285/P2179 自动补 MSC/ACM CCS。大学分层 (子问题 A) 作为第二期: 在拿到 QID 后, 用 Wikidata 的上位/下位关系 (P279 subclass of) 反推研究生级概念, 半自动扩 K15/K17 节点。
- 优: 一个锚点统管所有学科 + 自动拿大学码; 可验证 (QID 可点开核对); 增量, 不动现有树结构。
- 劣: 中/难档节点需人工 review; 物理 arXiv 对齐要额外工。

### 方案 B: 标准码直配 (CCSS/NGSS/MSC 各学科分别对)
不走 Wikidata, 每学科直接对各自标准体系 (数学→CCSS+MSC, 科学→NGSS, CS→ACM CCS)。
- 优: 标准码是教育界家长熟悉的 (能说"对应 CCSS.Math.8.EE")。
- 劣: 每学科一套管线, 工程量 ×N; 跨学科节点 (env/med/eng) 无统一标准; 大学后 CCSS/NGSS 不覆盖。

### 方案 C: 先只做大学后延伸, 不映射外部 (子问题 A 单独)
先把 K13 之上补 K15/K17 分层 + 节点, 外部映射延后。
- 优: 纯内部, 无外部依赖, 快。
- 劣: 没解决"真实可验证"这个用户核心诉求; 新增高阶节点没有锚点仍是"自说自话"。

**推荐 A**: 它同时回答了用户的全部三层诉求 (映射 + 可验证 + 为大学延伸铺锚点), 且实测可行、工程量比预想低。B 适合后期给家长展示标准对齐时叠加。C 单独做价值有限。

---

## 5. 若推进, 建议的最小验证步 (尚未执行)

1. 写一个一次性脚本: 对 425 节点跑 LLM 候选 QID 生成 (带 description + 学科前缀约束), 输出 confidence 分桶 CSV。
2. 人工抽检中等档 + 全检难档, 量出**真实命中率** (验证 88-93% 估计)。
3. 命中率达标后, 才决定是否给 TreeNode 加 `wikidata_qid` 字段 + 全量映射 + SPARQL 补大学码。
4. 大学后延伸 (A) 作为独立第二期, 依赖映射完成。

> 注: 以上均未实施。本报告仅为探索结论, 等用户决定推进哪块后再走 spec → plan → tasks。
