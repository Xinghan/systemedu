# 数学切片字段规范 (spec 044, 给提炼 agent 遵循)

你要产出一个 JSON 片段, 结构为:

```json
{
  "concepts":      [ ...数学母概念... ],
  "concept_edges": [ ...前置链(hard) + 服务边(soft)... ],
  "covers":        [ ...数学点用在某课某 module(可选)... ]
}
```

写到 `projects_data/_review/branch_out/<你的分支>.json`。

---

## 1. concept 对象 (每个数学母概念一条)

| 字段 | 必填 | 取值 | 说明 |
|---|---|---|---|
| `id` | 是 | `m.<snake_case>` | 全局唯一, **必须以 `m.` 开头** (与现有课的 `c.` 前缀区分)。如 `m.matrix`、`m.dot_product`。 |
| `name_zh` | 是 | 中文名 | 数学母概念的标准中文名, 如"矩阵""点积""标准差"。 |
| `name_en` | 是 | 英文名 | 标准英文名 (首字母大写), 如 "Matrix" "Dot product" "Standard deviation"。用于跨分支去重 + Wikidata 锚定。 |
| `type` | 是 | 5 选 1 | `CONCEPTUAL`(概念/理解) / `PROCEDURAL`(程序/会算) / `REPRESENTATIONAL`(表征/图模型) / `LANGUAGE`(语言/术语符号) / `META`(元认知)。数学点多为 CONCEPTUAL 或 PROCEDURAL。 |
| `grade_band` | 是 | 4 选 1 | `elementary`(小学 6-12) / `middle`(初中 12-15) / `high`(高中 15-18) / `university`(大学 18+)。按该概念**首次能被理解**的学段填。 |
| `subject` | 是 | **恒 `"Mathematics"`** | 所有数学点固定这个值, 不可改。 |
| `description` | 是 | 一句中文 | 面向 6-18 岁, 说清 **"这是什么 + 在项目里干嘛用"**。禁止只写定义不写用途。示例见下。 |
| `wikidata_search` | 是 | 英文搜索词 | 供 Task 5 锚定用。多为标准数学对象名 (matrix / vector space / standard deviation)。 |
| `wikidata` | 否 | 留空 `""` | Task 5 填, 你不用管。 |
| `wikidata_label` | 否 | 留空 `""` | Task 5 填, 你不用管。 |

### description 示范 (说清项目用途)

- 好: "把一堆数排成方格表, 每个电极和其他电极怎么一起抖动全记在里面 —— 脑波项目用它找出最能区分'想左手/想右手'的方向。"
- 差: "矩阵是一个矩形数组。" (只有定义, 无项目用途, 不合格)

---

## 2. concept_edges (边)

`{ "from": "<id>", "to": "<id>", "strength": "hard"|"soft" }`

两类边:

### (a) 数学内部前置链 — `strength: "hard"`
数学母概念之间的"学它之前得先会什么"。`from` 是前置, `to` 是后继。两端都是本切片的 `m.` 点。
形成有梯度的 DAG。例:
- `{"from":"m.vector", "to":"m.matrix", "strength":"hard"}`
- `{"from":"m.matrix", "to":"m.covariance_matrix", "strength":"hard"}`
- `{"from":"m.slope", "to":"m.derivative", "strength":"hard"}`

### (b) 数学 → 现有概念服务边 — `strength: "soft"`
数学点服务于哪个真实项目概念。`from` 是你的 `m.` 数学点, `to` 是**现有概念的 id**
(以 `c.` 开头, 从 `branch_inputs/_all_concept_ids.tsv` 或原料包里查到, 必须真实存在)。例:
- `{"from":"m.covariance_matrix", "to":"c.csp", "strength":"soft"}`
  (协方差矩阵服务于脑波项目的"共空间模式 CSP")
- `{"from":"m.derivative", "to":"c.integral_control_i", "strength":"soft"}`

**硬约束**: 服务边的 `to` 必须是 `_all_concept_ids.tsv` 里真实存在的现有 id。
不确定就去查那个表, 不要瞎编 id。

---

## 3. covers (可选, 尽量标)

`{ "module": "<现有课slug>:M##", "concept": "<你的 m. 数学点 id>" }`

表示"这个数学点用在某课的某 module"。`module` 格式如 `eeg-minecraft-bci:M12`。
能标就标 —— 它决定前端选中某项目时该数学点会不会点亮。不确定 module 号可省略该条 (服务边已能表达服务关系)。

8 门课的 slug:
`stirling-thermal-controller`, `emg-prosthetic-hand`, `eeg-minecraft-bci`,
`satellite-archaeology`, `ai-ant-ethologist`, `mars-analog-rover`,
`purpleair-airquality-node`, `molecule-monster-hunter`

---

## 4. 铁律 (违反即返工)

1. `id` 一律 `m.` 前缀; `subject` 一律 `"Mathematics"`。
2. **反向提炼母概念**, 不是照抄应用点。看到"协方差矩阵""特征向量" → 提炼出"矩阵""向量空间""特征值分解"这些母概念, 把应用点作为服务边的 `to`。
3. **禁止新建纯知识悬空点**: 每个数学点都要能连出至少一条服务边 (指向某现有 `c.` 概念) 或前置到一个能连服务边的点。范围严格由"8 课用到 + 其前置链"界定。不要加与 8 课完全无关的数学 (如"群论""拓扑同胚"这种没被任何课用到的)。
4. 服务边 `to` 必须是真实现有 id。
5. `description` 必须含项目用途, 不能只有定义。
6. 学段要有梯度: 该分支应覆盖从小学基础点到大学高阶点 (若该分支小学确实没有对应点, 可从初中起, 但要说明)。
