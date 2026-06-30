# Spec 041: 独立完整知识图谱构建工具 (kg-builder)

Status: 里程碑1-2 shipped (2026-06-30) — 工具骨架+闸门+种子修复完成; 里程碑3-4 (逐学科扩建~1420) 待另起执行计划
作者: Claude (brainstorming with 用户)
关联探索: `docs/explore/2026-06-29-knowledge-graph-external-mapping.md`

## WHAT — 一句话

建一个**可重复运行的知识图谱构建工具** (`tools/kg-builder/`),按外部知识体系
(Wikidata + CCSS/NGSS) 自顶向下、逐学科地把现有 425 节点的平台树**原地扩建**成
K-12 到本科入门的 ~1420 节点完整知识地图。每个节点带可验证锚点 (Wikidata QID +
教育标准码)。

## WHY — 为什么 (方向校正)

### 旧方向的错误 (已废弃)
此前思路是"映射现有 425 节点 + 用项目点亮反推图谱完整度",本质是**让图谱依附现有
课程项目**。问题:现有只有 6-7 个项目,它们教到的概念是整个知识体系里很小、很随机
的一块;拿项目反推,图谱永远是"我们碰巧教过的东西"的零碎集合,残缺且无结构。

### 正确方向 (用户 2026-06-30 拍板)
**图谱必须独立于课程存在,完整性来自外部真实知识体系本身。** 课程跟着图谱走,不是
图谱跟着课程长:
- 图谱先按外部学科体系铺好完整骨架 (一个学科**本该**有哪些核心概念 → 就建哪些);
- 课程生成时知识点往图上**挂** (挂得上 = 已覆盖,挂不上 = 图该扩展的信号);
- 这样课程无限扩展时,图谱不必"补课",始终是先有的、完整的地图。

### 为什么现在动手 (实测支撑)
探索报告实测:现有 425 节点约占应有完整度的 1/3 (缺 ~995),且各学科缺口均匀
(23-33%) —— 是"主干画了、枝叶没长全"。已对 425 节点跑过 Wikidata QID 映射验证
(见下),命中率印证可行。

## 关键实测数据 (设计输入)

### 425 种子节点 QID 映射 (已完成)
全量映射产物 `projects_data/_review/qid_mapping.csv`,mapping_type 分布:
- exact 319 / broader 58 / composite 47 / none 1 → 423 个成功映射 (~99%)

### 425 种子 QID 真伪体检 (已完成)
用 Wikidata API 回查每个 QID,产物 `projects_data/_review/qid_verify.csv`:
- **OK 123** (机器确认 QID 真实且 label 匹配)
- **SUSPECT 282** (QID 大概率真,但 LLM 未填英文 label → 机器无法自动确认,需人眼扫)
- **NOTFOUND 19** (LLM **编造**了 Wikidata 上不存在的 QID,占 4.5% — 必须修)
- SKIP 1 (mapping_type=none)

**核心结论 (直接定型设计)**: 纯靠 LLM 给 QID 会编造 ~4.5% 假 QID。因此工具的准入
闸门**必须包含 Wikidata API 回查**,不能只信 LLM。`verified` 字段由此而来。

## 设计

### 第 1 部分: 架构与数据模型

#### 系统定位
一个 dev 工具 `tools/kg-builder/` (跟 content-pipeline 同级,不进生产),可重复运行,
逐学科把 425 扩建成 ~1420。复用 `systemedu.core.llm_client`。

#### 数据模型: 给 TreeNode 增量加可选锚点字段
在现有 `platform_tree.json` 的 `TreeNode` 上加可选字段,**不破坏现有结构**,425 节点
保留:

```
TreeNode:
  id / name_zh / name_en / depth_level / prerequisites / description   # 现有, 不动
  + wikidata_qid:  "Q11348"                       # 可选, 节点真实锚点
  + std_codes:     ["CCSS.Math.8.G.B.7"]          # 可选, 教育标准码(家长可读对齐)
  + mapping_type:  exact | broader | composite | none
  + provenance:    "seed" | "kg-builder-v1"       # 节点来源
  + verified:      true | false                   # QID 是否经 Wikidata API 回查确认存在
```

#### 三层结构 (沿用现有, 外部体系填充)
```
学科 (11 个, 不变: math phys chem bio cs elec env astro med eng geo)
  └─ 子领域 subsector (如 math.algebra) — 对照 Wikidata 学科分类 + 标准 domain 校准
       └─ 概念节点 concept — 现有 425 + 新增 ~995, 每个带 QID + 标准码 + depth
```

**最小侵入**: 加字段不改结构 → 现有前端可视化 (KnowledgeTreeView 等)、点亮机制零迁移;
425 节点原地保留并回填刚映射好的 QID。

### 第 2 部分: 逐学科构建管线

工具对每个学科跑这条流水线,产出待审清单,人工审批后合入。以 math 为例:

#### Step 1-2 — LLM 列候选 + 教育阶段筛选/补洞
(路线决策: LLM 列候选 + 闸门兜底,非纯机械抓 Wikidata 子类树。理由: 已验证管线
复用、避开 SPARQL 子类树过深/CCSS 无稳定机读源的坑、闸门兜住完整性下限。)
- LLM 按学科 + 对照 CCSS/NGSS/本科入门教材目录,列该学科应有概念候选;
- 每个候选当场判定 K1-K13 depth,超本科入门的标记剔除 (留给以后研究生层);
- 每个候选必须当场配一个 QID 或标准码 (为闸门做准备)。

#### Step 3 — 准入闸门 (三道, 缺一不入)
1. **Wikidata API 回查**: QID 必须真实存在 (挡掉 NOTFOUND 那 4.5% 编造)。
2. **有锚点**: 至少一个 verified QID 或一个标准码,否则拒 (防 LLM 灌水野概念)。
3. **去重**: 跟现有 425 + 已合入新节点语义比对,已存在的不重复造,只补其缺的锚点字段。

#### Step 4 — 产出待审清单 (CSV)
过闸候选写成该学科待审清单: `提案node_id / name_zh / name_en / depth / qid /
std_codes / mapping_type / 新增或补现有 / confidence / 出处`。
高 confidence 抽审, 低 confidence 或无标准码必审。

#### Step 5 — 人工审批 → 合入 platform_tree.json
人工分桶审清单, 批准的才写进图谱 (新增节点 + 给现有节点回填锚点), 并校验前端正常。
然后下一个学科。

### 第 3 部分: 工具形态、测试、交付

#### 目录结构
```
tools/kg-builder/
├── README.md                  用法 + 管线说明
├── pipeline.py                主入口: python -m kg_builder <subject>
├── sources/
│   ├── wikidata.py            QID 回查 + 子类/标准码 SPARQL
│   └── standards.py           CCSS/NGSS 标准码查表 (本地数据集)
├── steps/
│   ├── candidates.py          Step1-2: LLM 列候选 + 阶段筛选/补洞
│   ├── gate.py                Step3: 三道准入闸
│   └── emit.py                Step4: 产待审清单 CSV
├── merge.py                   Step5: 审批后清单 → 合入 platform_tree.json
└── data/standards/            CCSS/NGSS 本地标准数据集
```

#### 运行模式 (契合"可持续生长")
```
python -m kg_builder math                          # 跑 math, 产待审清单
python -m kg_builder math --merge approved_math.csv  # 审批后合入
python -m kg_builder --status                      # 各学科覆盖进度
```
幂等 + 增量: 重跑某学科只补新的; 以后扩研究生层就是加 depth 参数。

#### 测试 (CLAUDE.md 强制)
- **闸门单测**: 假 QID 被回查挡掉 / 重复节点被去重 / 无锚点候选被拒。mock Wikidata 响应,不打网络。
- **合入单测**: 合入后 platform_tree.json 仍过现有 schema 校验 (Kahn 环检测、prereq 同学科约束)、425 种子不被破坏。
- **一学科真跑**: 用真实 LLM 跑 math (报告纪律: LLM 行为必须真跑), 人工核对清单质量。

#### 交付里程碑
1. 工具骨架 + 闸门/合入 + 测试通过
2. 修复种子: 19 个 NOTFOUND 假 QID + 回填 425 节点 verified 字段 (用已生成数据)
3. 逐学科跑: math 首发 → 审 → 合 → 验证前端 → 其余 10 学科
4. 首版完成: platform_tree.json 达 ~1420 节点, 每个带可验证锚点

## 明确不做 (YAGNI)
- 研究生层 (K15/K17) — 管线预留 depth 参数,首版不实现
- 课程点亮 / 对应率 — 图建好后课程消费图的事,本工具不碰 (旧方向已废)
- 新学科 — 首版只在现有 11 学科内加密

## 验收标准
- platform_tree.json 节点数从 425 扩到 ~1420 (各学科均匀加密,无某科畸高畸低)
- 每个新增节点带 wikidata_qid (verified=true) 或 std_codes 至少其一
- 现有 425 种子节点的 QID 回填且 19 个 NOTFOUND 修正
- platform_tree.json 仍通过现有 schema 全部校验; 前端三种可视化正常渲染
- 工具可对任一学科幂等重跑, --status 正确报覆盖进度
