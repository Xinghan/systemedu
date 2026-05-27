# 035 Plan — Learner 质检员 + 全平台学科理论知识树

## 总体架构

```
                       (1) 全平台学科知识树
                       course_factory/knowledge_tree/platform_tree.json (Claude 手写, ~500 节点 / 11 学科)
                                  ↓ (静态资源)
┌───────────────────────────────────────────────────────────────────┐
│ Author 内容生成完, 跑 2 个工具:                                   │
│                                                                   │
│ (A) python -m course_factory.learner_qc <slug>                    │
│     → dispatch learner-simulator agent (按 age_band persona)      │
│     → 顺序读 M01..MN lesson.md/theories/assignment                 │
│     → 输出 _review/<slug>_learner_report.md                       │
│     → 作者人工 audit 报告, 决定补节/修内容                        │
│                                                                   │
│ (B) python -m course_factory.lit_tree <slug>                      │
│     → dispatch lit-mapper agent                                   │
│     → 读所有 theories.json + knode.key_concepts + plan_md          │
│     → 对比 platform_tree.json, 输出"点亮节点 ID + 理由"           │
│     → 写入 manifest.json.lit_nodes                                 │
│     → 重新打包 publish library v0.X.Y                             │
└───────────────────────────────────────────────────────────────────┘
                                  ↓
┌───────────────────────────────────────────────────────────────────┐
│ library API 多 2 个端点:                                          │
│ GET /v1/projects/{slug}/knowledge-tree → 项目 lit_nodes + tree slice│
│ GET /v1/platform/knowledge-tree → 全平台 11 学科树 (静态服务)     │
└───────────────────────────────────────────────────────────────────┘
                                  ↓
┌───────────────────────────────────────────────────────────────────┐
│ student-web 项目详情页加 "知识树" tab:                            │
│ SVG 树渲染 (该项目涉及学科), 点亮节点 coral, 未点亮灰              │
│ hover 节点显示"本项目第 M_X 节教了这个"                            │
└───────────────────────────────────────────────────────────────────┘
```

两个功能**完全解耦**: 知识树点亮 (B) 跑出的 lit_nodes 是数据, learner_qc (A) 不依赖它. 可以独立开发、独立 ship.

**点亮的两层语义 (本 spec 边界)**:

| 层 | 存哪 | 谁写 | 本 spec? |
|---|---|---|---|
| 项目级 (本项目教了哪些) | manifest.json.lit_nodes (library) | author 跑 lit_tree CLI 一次 | ✅ 是 |
| 用户级 (这个学生学过哪些) | student-app DB `user_lit_nodes` (per-user) | 用户 mark knode complete 时增量 | ❌ spec 036 |

035 只动 library 静态数据 + 项目页"本项目教了哪些"展示, **不动 student-app**, 用户系统 0 改动.

## 技术方案

### 1. 平台知识树 JSON schema

**文件**: `course_factory/knowledge_tree/platform_tree.json`

```json
{
  "schema_version": "1.0",
  "subjects": [
    {
      "id": "math",
      "name_zh": "数学",
      "name_en": "Mathematics",
      "color": "#527B95",
      "nodes": [
        {
          "id": "math.arith.add_sub",
          "name_zh": "加减法",
          "name_en": "Addition & Subtraction",
          "depth_level": "K1",
          "prerequisites": [],
          "description": "正整数加减法, 进位/借位"
        },
        {
          "id": "math.algebra.linear_func",
          "name_zh": "一次函数",
          "name_en": "Linear Function",
          "depth_level": "K7",
          "prerequisites": ["math.arith.fraction", "math.algebra.variable"],
          "description": "y = kx + b 形式, 斜率与截距"
        },
        {
          "id": "math.algebra.piecewise_func",
          "name_zh": "分段函数",
          "name_en": "Piecewise Function",
          "depth_level": "K9",
          "prerequisites": ["math.algebra.linear_func"],
          "description": "不同 x 区间对应不同表达式, AQI/税率常用"
        }
      ]
    },
    {
      "id": "phys", "name_zh": "物理", "color": "...",
      "nodes": [...]
    }
  ]
}
```

**depth_level 6 档** (覆盖小学 → 大学本科基础):
- K1 (小1-2) / K3 (小3-4) / K5 (小5-6) / K7 (初1-2) / K9 (初3-高1) / K11 (高2-高3) / K13 (本科基础)

**11 学科 baseline node 数** (11 棵独立子树, 共置 1 个 JSON, 学科间**不**互相 prerequisites):
math 60 / phys 50 / chem 35 / bio 50 / cs 50 / elec 35 / env 35 / astro 25 / med 30 / eng 30 / geo 25 = **~425 节点** (留 75 余量).

**学科间独立**: `prerequisites` 字段只能指向**同一学科**内的节点 ID. Pydantic validator 强制这条规则. 跨学科前置 (例 "velocity 依赖 linear function") 不在树里表达 — 简化第一版.

**Pydantic schema**: `course_factory/knowledge_tree/schema.py`:

```python
class TreeNode(BaseModel):
    id: str  # subject.<category>.<name>, kebab/snake_case
    name_zh: str
    name_en: str
    depth_level: Literal["K1", "K3", "K5", "K7", "K9", "K11", "K13"]
    prerequisites: list[str] = []  # 节点 ID
    description: str

class Subject(BaseModel):
    id: Literal["math","phys","chem","bio","cs","elec","env","astro","med","eng","geo"]
    name_zh: str
    name_en: str
    color: str  # hex
    nodes: list[TreeNode]

class PlatformTree(BaseModel):
    schema_version: Literal["1.0"]
    subjects: list[Subject]
```

加 validator: 所有 prerequisites 必须指向已存在的节点 ID; 不能成环.

### 2. 知识树点亮工具

**入口**: `python -m course_factory.lit_tree <slug>`

**实现**: `course_factory/lit_tree.py`

```python
def lit_project(slug: str) -> dict:
    """
    1. load workspace project + 所有 knode 的 theories.json + key_concepts + plan_md
    2. load platform_tree.json
    3. dispatch lit-mapper agent (一次性, 不 per-knode)
    4. agent 输出: [{node_id, lit_by_knodes: ["M05", "M11"], reason: "..."}]
    5. 写入 manifest.json["lit_nodes"]
    """
```

**agent prompt 模板** (在 `course_factory/prompts/lit_mapper.md`):
```
你是知识图谱映射员. 给你 1) 平台知识树 (~500 节点) 2) 一个项目的所有 theory + key_concepts + plan 文本.

任务: 找出项目教过的知识点, 对应平台树哪些节点被点亮.

强制规则:
- 不允许 fuzzy match — 必须 trace 到具体某节的 plan/theory 文本
- 每个点亮节点必须有 reason: "M_X plan 提到 '___', 命中 platform_tree.math.algebra.piecewise_func"
- 一个 platform node 可被多个 knode 点亮
- 项目可能涉及 树里没有 的概念 — 列入 "missing_concepts" 字段, 给作者下版迭代用

输出 JSON:
{
  "lit_nodes": [
    {"node_id": "math.algebra.piecewise_func", "lit_by": ["M05"], "reason": "M05 plan 提到 EPA AQI 分段插值公式"},
    ...
  ],
  "missing_concepts": [
    {"concept": "PMS5003 颗粒计数 ASIC", "first_seen": "M17", "suggested_subject": "elec"}
  ]
}
```

### 3. Learner 质检员

**入口**: `python -m course_factory.learner_qc <slug>`

**实现**: `course_factory/learner_qc.py`

```python
def run_qc(slug: str, persona_override: str | None = None) -> str:
    """
    1. load workspace project, 取 frontmatter.age_band 选 persona
    2. 顺序枚举 M01..MN, 把每节 lesson.md + theories.json + assignment.md 串成 corpus
    3. dispatch learner-simulator agent (一次性, 不 per-knode)
    4. agent 按 persona 模拟从 M01 读到 MN, 每节输出反思
    5. 输出 _review/<slug>_learner_report.md
    """
```

**persona 推导** (`course_factory/personas/`):
- age_band="10-12" → persona_10_12.md (中文母语 5 年级小学生, 没学过编程, 数学到分数四则, 物理零基础, 注意力 25 分钟)
- age_band="13-15" → persona_13_15.md
- age_band="16-18" → persona_16_18.md

**agent prompt 模板** (`course_factory/prompts/learner_simulator.md`):
```
你扮演 {persona_description}. 项目 = {project_title}, 你完全零基础.
我会按顺序给你 M01..MN 每节的完整内容. 你要诚实地按你的年龄水平反应.

强制输出 (每节都要):
## M_X reflection
- 我看懂了吗: ✓ / ⚠️ / ❌
- 卡在哪 (具体引用原文): "..."
- 前置缺什么: "我不知道什么是 ___" (列举具体术语)
- 信息密度 (1-5): 5 = 灌爆, 1 = 太简单

读完全部后:
## 累计断崖
按严重程度排序 ❌ > ⚠️
## 补节点建议
"应在 M_X 和 M_Y 之间插入 M_X.5 '___' 节点, 教 ___"
## 信息密度曲线
M01: 2, M02: 3, M03: 5 (灌爆 — 三个新概念同节), ...
## 给作者的话
3-5 条具体修改建议
```

报告输出: `content-workspace/_review/<slug>_learner_report.md`

### 4. library API 扩展

新增 2 个端点 (`packages/library-app/src/library/routes/public.py`):

```python
@router.get("/projects/{slug}/knowledge-tree")
def get_project_knowledge_tree(slug: str) -> dict:
    """
    返回 {
      "lit_nodes": [...],  # 从 manifest.json.lit_nodes
      "subjects_used": ["math", "phys", "cs", "elec", "env"],  # 涉及学科
      "missing_concepts": [...]
    }
    """

@router.get("/platform/knowledge-tree")
def get_platform_knowledge_tree() -> dict:
    """返回全平台 platform_tree.json (静态, 缓存 1h)"""
```

manifest.json schema 加字段 (`packages/library-app/src/library/manifest.py`):
```python
class Manifest(BaseModel):
    ...
    lit_nodes: list[dict] = []  # spec 035 新增
    missing_concepts: list[dict] = []
```

不破坏 backwards compat (老 manifest 没这字段, 默认空).

### 5. student-web 前端

**项目详情页加 "知识树" tab** (`packages/student-web/src/app/(home)/library/[slug]/page.tsx`):

- 在现有 sections (项目封面/学习路线/Curriculum/What you'll ship) 之后加新 section
- Tab bar: "学习路线" | "知识树" (默认选学习路线)
- 知识树 tab 内容 (**一次只看 1 棵子树**):
  - 上方: subjects_used 横排 chip (该项目涉及的学科, click 切换). chip 显示 "math (12/60)" 即点亮数/总数. 默认选**点亮最多**的学科.
  - 下方: 选定学科的 **1 棵 SVG 子树** (25-60 节点, 渲染流畅, 不卡)
    - **布局**: 按 depth_level (K1-K13) 横向分层, 同 level 节点纵向排, prerequisites 用箭头连线 (只在本学科内)
    - **配色**: 点亮节点 coral `#D97757` 实色填充, 未点亮节点 hairline border 灰填充
    - **hover**: 显示 tooltip "本项目第 M_X 节教了这个" (lit_by 字段)
    - **node click**: 跳到对应 knode 学习页 (lit_by[0])

新增组件 `packages/student-web/src/components/KnowledgeTreeView.tsx`:
```tsx
type Props = {
  platformTree: PlatformTree
  litNodes: LitNode[]
  onNodeClick?: (knodeId: string) => void
}
```

## 文件清单 (新增 + 修改)

### 新增
- `course_factory/knowledge_tree/platform_tree.json` (大数据, ~30KB)
- `course_factory/knowledge_tree/__init__.py`
- `course_factory/knowledge_tree/schema.py` (Pydantic + validator)
- `course_factory/lit_tree.py` (CLI 入口)
- `course_factory/learner_qc.py` (CLI 入口)
- `course_factory/prompts/lit_mapper.md` (agent prompt)
- `course_factory/prompts/learner_simulator.md` (agent prompt)
- `course_factory/personas/persona_10_12.md`
- `course_factory/personas/persona_13_15.md`
- `course_factory/personas/persona_16_18.md`
- `packages/student-web/src/components/KnowledgeTreeView.tsx`
- `tests/test_platform_tree.py` (schema 校验)
- `tests/test_lit_tree.py` (集成测试, mock agent)
- `tests/test_learner_qc.py` (集成测试, mock agent)

### 修改
- `packages/library-app/src/library/routes/public.py` (+2 端点)
- `packages/library-app/src/library/manifest.py` (+ lit_nodes / missing_concepts 字段)
- `packages/student-web/src/app/(home)/library/[slug]/page.tsx` (+ 知识树 tab)
- `course_factory/SKILL.md` (顶部加 Step 7 "项目级 QC + 点亮" 短章节)
- `docs/prd.md` (Phase checklist + API 表格)

## 影响面

- **course_factory**: 加 2 个 CLI 工具, 不破坏现有 single-knode 流程
- **library-app**: manifest 加可选字段, 加 2 个公开 API 端点. 老 manifest 兼容
- **student-web**: 项目页加 tab. 知识树 tab 默认隐藏 (老项目没 lit_nodes 时显示"本项目未跑知识树映射")
- **生产**: cloud-app/老 web 不影响 (deprecated)

## 验收

复用 spec.md "验收" 段; 加测试:

```bash
# 1. 平台树 schema 通过
python -m pytest tests/test_platform_tree.py -v

# 2. purpleair 跑点亮
python -m course_factory.lit_tree purpleair-airquality-node
python -c "import json; m=json.load(open('content-workspace/generated/purpleair-airquality-node/manifest.json')); print(len(m['lit_nodes']))"  # ≥ 30

# 3. purpleair 跑 learner QC
python -m course_factory.learner_qc purpleair-airquality-node
test -f content-workspace/_review/purpleair-airquality-node_learner_report.md

# 4. publish v0.13.0
systemedu-content publish purpleair-airquality-node --version 0.13.0

# 5. 前端打开 /library/purpleair-airquality-node, 切换到 "知识树" tab, 看 coral 高亮节点
```

## 风险 + 缓解 (除 spec.md 列的)

- **R4: 平台树 JSON 太大前端加载慢** — 30KB JSON 不大. 渲染**一次只 1 棵子树** (25-60 节点), 完全不会卡. chip 切换时只重渲该子树.
- **R5: lit_mapper agent 输出反复横跳** — 同样 prompt 跑两次给不同 node_id. 缓解: prompt 强制 "对每个候选节点必须有具体文本引用", 不允许猜. 跑 2 次取交集.
- **R6: learner agent 太"挑剔"或太"宽容"** — 缓解: persona prompt 含示例 ("看到 K11 概念但前面没铺 → ❌; 看到 K7 概念有铺 → ✓"), 用 1-2 个已知有断崖的 purpleair 节点做 calibration test.

## 时间预算

- 平台树 JSON (Claude 手写 11 学科): 4-6 小时
- schema + validator + 测试: 1 小时
- lit_tree.py + prompt: 2 小时
- learner_qc.py + 3 persona + prompt: 3 小时
- library API + manifest 改: 1 小时
- student-web 知识树 tab + SVG: 4 小时
- 集成测试 + 调通: 2 小时

**总计 ~17-19 小时**, 分 4-5 个 session.

## 实现顺序 (tasks.md 草拟)

1. 平台知识树 JSON + schema + 测试 (基础数据)
2. lit_tree.py CLI + agent prompt + 测试 (B 功能后端)
3. learner_qc.py CLI + persona + agent prompt + 测试 (A 功能)
4. library API + manifest 改 + 测试 (B 后端接前端)
5. student-web 知识树 tab + SVG 渲染 (B 功能前端)
6. purpleair 跑 lit_tree + learner_qc 实测, 收集 missing_concepts 迭代
7. publish v0.13.0 + 文档同步 (prd.md / SKILL.md)
