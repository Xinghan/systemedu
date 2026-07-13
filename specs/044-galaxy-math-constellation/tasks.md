# 知识星图数学星系 实现计划 (spec 044)

> **For agentic workers:** 本计划混合两类任务: (A) 内容提炼 (多 agent 提炼数学概念 + 人工审校),
> (B) 脚本改造 (可 TDD)。内容任务无法写单测,验收靠结构校验脚本 + 人工审校 + 前端视觉。

**Goal:** 在 `/galaxy` 知识星图新增一个从 8 门课提炼出的独立 Mathematics 星系 (70-95 概念),
现有 445 节点零改动。

**Architecture:** 在 `~/Dev/systemeduidea` (内容源仓) 新建 `mathematics_concept_slice.json`
(第 9 个"虚拟课"切片),写一个自包含合并脚本 `merge_galaxy_v9.py` 吃仓内 8 切片 + math 切片,
改 `emit_frontend_payload.py` 加 Mathematics 学科,重新生成 systemedu 前端
`public/galaxy/concept-galaxy.json`。前端代码零改动。

**Tech Stack:** Python 3.12 (json/urllib), 多 agent 提炼, Next.js 前端 (仅数据更新),
preview 工具做视觉验证。

**关键路径约定:**
- 内容源仓: `~/Dev/systemeduidea` (下称 IDEA 仓)
- 前端主仓: `~/Dev/systemedu` (下称 EDU 仓)
- 切片目录: `IDEA/content-workspace/_review/`
- 脚本目录: `IDEA/content-workspace/_review/concept_layer_scripts/`
- 原料清单: `EDU/projects_data/_review/_math_candidates.md` (已生成, 179 命中)
- 前端数据: `EDU/packages/student-web/public/galaxy/concept-galaxy.json`

---

## Task 1: 生成分支提炼原料包

给 5 个提炼 agent 各准备一份"原料包": 该分支相关的现有概念 (从 179 命中 + 8 课切片全概念里筛),
含 id/name/desc/所属课/QID,以及可作为"服务边目标"的现有概念 id 清单。

**Files:**
- Create: `EDU/projects_data/_review/_math_branch_inputs.py`
- Output: `EDU/projects_data/_review/branch_inputs/{quantity,algebra,geometry,probstat,calculus}.md`

- [x] **Step 1: 写原料包生成脚本**

```python
# _math_branch_inputs.py
"""为 5 个数学分支各生成原料包 md: 相关现有概念 + 可连服务边的现有概念 id 全表。"""
import json, glob, os
from collections import defaultdict

IDEA = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review')
OUT = os.path.join(os.path.dirname(__file__), 'branch_inputs')
os.makedirs(OUT, exist_ok=True)

# 5 分支的信号词 (决定哪些现有概念作为该分支的提炼原料)
BRANCHES = {
 'quantity': {  # 数与量
   'zh': '数与量', 'kw': ['比例','百分','分数','数量级','单位','计数','换算','科学计数','平均',
     'ratio','proportion','percentage','fraction','order of magnitude','unit','count','average','scale']},
 'algebra': {  # 代数与函数
   'zh': '代数与函数', 'kw': ['方程','函数','斜率','线性','一次','二次','指数','对数','多项式','插值','拟合',
     'equation','function','slope','linear','exponential','logarithm','polynomial','interpolat','regression','fit']},
 'geometry': {  # 几何与空间
   'zh': '几何与空间', 'kw': ['坐标','几何','角','三角','向量','点积','范数','投影','旋转','平移','面积','体积','距离','欧氏','黎曼','维',
     'coordinate','geometr','angle','trigonom','vector','dot product','norm','projection','rotation','area','volume','distance','euclidean','riemann','dimension']},
 'probstat': {  # 概率与统计
   'zh': '概率与统计', 'kw': ['概率','分布','方差','协方差','均值','中位','标准差','统计','相关','回归','采样','贝叶斯','直方图','矩阵','混淆',
     'probability','distribution','variance','covariance','mean','median','deviation','statistic','correlation','regression','sampling','bayes','histogram','matrix','confusion']},
 'calculus': {  # 微积分与变化率
   'zh': '微积分与变化率', 'kw': ['导数','梯度','积分','微分','变化率','卷积','傅里叶','拉普拉斯','频率','幅','相位','变换',
     'derivative','gradient','integral','differential','rate of change','convolution','fourier','laplace','frequency','amplitude','phase','transform']},
}

STIRLING = f'{IDEA}/stirling_concept_slice.json'
slices = sorted(glob.glob(f'{IDEA}/*_concept_slice.json'))

# 全部现有概念 (作为服务边目标全表)
all_concepts = []
for sl in slices:
    slug = os.path.basename(sl).replace('_concept_slice.json','')
    if slug == 'stirling': slug = 'stirling-thermal-controller'
    d = json.load(open(sl, encoding='utf-8'))
    for c in d['concepts']:
        all_concepts.append({**c, '_slug': slug})

def relevant(c, kws):
    txt = ((c.get('name_en') or '')+' '+(c.get('name_zh') or '')+' '+(c.get('description') or '')).lower()
    return any(k in txt for k in kws)

for bkey, b in BRANCHES.items():
    kws = [k.lower() for k in b['kw']]
    hits = [c for c in all_concepts if relevant(c, kws)]
    lines = [f"# 分支提炼原料: {b['zh']} ({bkey})\n",
             f"命中现有概念 {len(hits)} 个。这些是该数学分支在 8 课里的**应用点**,",
             f"你的任务是从它们**反向提炼数学母概念** + 补前置链 + 连服务边回这些点。\n",
             "## 该分支相关的现有概念 (可作为服务边目标, 用其 id)\n"]
    for c in sorted(hits, key=lambda c:(c['_slug'], c.get('grade_band',''))):
        q = c.get('wikidata') or '(无QID)'
        lines.append(f"- id=`{c['id']}` [{c['_slug']}/{c.get('grade_band')}/{c.get('subject')}] "
                     f"**{c.get('name_zh')}** / {c.get('name_en')} — {q}")
        lines.append(f"    - {(c.get('description') or '')[:100]}")
    open(f'{OUT}/{bkey}.md','w',encoding='utf-8').write('\n'.join(lines))
    print(f"{bkey}: {len(hits)} 相关现有概念 -> branch_inputs/{bkey}.md")

# 另存一份全概念 id 全表 (agent 连服务边时查证 id 存在)
idmap = [f"{c['id']}\t{c['_slug']}\t{c.get('name_zh')}\t{c.get('name_en')}" for c in all_concepts]
open(f'{OUT}/_all_concept_ids.tsv','w',encoding='utf-8').write('\n'.join(idmap))
print(f"全概念 id 全表: {len(all_concepts)} -> branch_inputs/_all_concept_ids.tsv")
```

- [x] **Step 2: 跑脚本**

Run: `cd ~/Dev/systemedu && python3 projects_data/_review/_math_branch_inputs.py`
Expected: 打印 5 个分支各自命中数 + 全概念 id 表行数 (应 ~558)。

- [x] **Step 3: 抽查一份原料包**

Run: `head -20 ~/Dev/systemedu/projects_data/_review/branch_inputs/geometry.md`
Expected: 看到 geometry 分支的现有概念 (向量/坐标/旋转类),每个带 id 和 QID。

- [x] **Step 4: Commit**

```bash
cd ~/Dev/systemedu && git add projects_data/_review/_math_branch_inputs.py
git commit -m "chore(spec-044): 生成 5 数学分支提炼原料包脚本"
```

---

## Task 2: 定义 math 切片 schema 与骨架文件

先落一个空骨架 + schema 说明,让 5 个 agent 往里填,保证字段统一。

**Files:**
- Create: `IDEA/content-workspace/_review/mathematics_concept_slice.json` (骨架)
- Create: `EDU/projects_data/_review/_MATH_SLICE_SCHEMA.md` (给 agent 的字段规范)

- [x] **Step 1: 写 schema 规范文档** (供提炼 agent 遵循)

内容要点 (写进 `_MATH_SLICE_SCHEMA.md`):
- 每个 concept 字段: `id` (格式 `m.<snake>`, 全局唯一), `name_zh`, `name_en`,
  `type` (CONCEPTUAL/PROCEDURAL/REPRESENTATIONAL/LANGUAGE/META),
  `grade_band` (elementary/middle/high/university), `subject` (**固定 "Mathematics"**),
  `description` (一句中文, 面向 6-18 岁, 说清"这是什么 + 在项目里干嘛用"),
  `wikidata_search` (英文搜索词, 供锚定), `wikidata`/`wikidata_label` (先留空,Task 5 填)。
- `concept_edges`: `{from, to, strength}`。数学内部前置 = `hard`;
  数学→现有概念服务边 = `soft` (to 用现有概念 id, 见 `_all_concept_ids.tsv`)。
- `covers`: `{module, concept}`, module 格式 `<现有课slug>:M##`, concept=数学点 id。
  表示"这个数学点用在某课的某 module"。可选,能标就标 (决定前端项目筛选点亮)。
- 硬约束: id 前缀 `m.`; subject 恒 "Mathematics"; 服务边 to 必须是真实存在的现有 id。

- [x] **Step 2: 写空骨架 json**

```json
{
  "schema_version": "concept-slice-0.1",
  "note": "数学横切星系: 从 8 门课提炼的数学母概念 + 前置链 + 服务边。spec 044。",
  "virtual_course": true,
  "grade_bands": ["elementary", "middle", "high", "university"],
  "types": {"CONCEPTUAL":"概念/理解","PROCEDURAL":"程序/会做","REPRESENTATIONAL":"表征/图模型","LANGUAGE":"语言/术语符号","META":"元认知"},
  "concepts": [],
  "concept_edges": [],
  "covers": []
}
```

- [x] **Step 3: Commit**

```bash
cd ~/Dev/systemedu && git add projects_data/_review/_MATH_SLICE_SCHEMA.md
git commit -m "docs(spec-044): math 切片 schema 规范"
cd ~/Dev/systemeduidea && git add content-workspace/_review/mathematics_concept_slice.json
git commit -m "chore(spec-044): math 切片空骨架"
```

---

## Task 3: 5 分支并行提炼 (多 agent)

**这是内容核心步骤。** 用 Agent 工具并行派 5 个 general-purpose agent,每个负责一个分支。
每个 agent 读: 该分支原料包 `branch_inputs/<b>.md` + schema 规范 `_MATH_SLICE_SCHEMA.md` +
全概念 id 表 `_all_concept_ids.tsv`,产出该分支的 concepts + concept_edges + covers 的 JSON 片段。

**Agent prompt 必含 (每个分支):**
1. 分支名 + 学段跨度要求 (小学→大学,该分支该有哪些学段的点)。
2. 任务: 从原料包的现有应用点**反向提炼数学母概念**,不是照抄应用点。
   例: 看到"协方差矩阵""特征向量"→ 提炼母概念"矩阵""向量空间""特征值分解"。
3. 前置链: 概念间连 hard 边形成 DAG (向量→矩阵→协方差矩阵)。
4. 服务边: 每个数学点连 soft 边指向它服务的现有概念 id (从 `_all_concept_ids.tsv` 查证 id 真实存在)。
5. covers: 尽量标数学点用在哪课哪 module。
6. 数量约束: 该分支 12-22 个概念 (5 支合计 70-95, 去重前)。
7. 输出格式: 严格 schema, id 前缀 `m.`, subject 恒 "Mathematics", wikidata 留空。
8. **禁止** 新建纯知识悬空点 (与 8 课完全无关的数学),范围由"8课用到+前置链"界定
   (见 [[feedback_no_pure_knowledge_nodes]] 精神: 数学点必须能指向真实项目用途)。

**Files:**
- Output: `EDU/projects_data/_review/branch_out/{quantity,algebra,geometry,probstat,calculus}.json`

- [x] **Step 1: 并行派 5 个 agent** (单条消息 5 个 Agent 调用, general-purpose)

每个 agent 把产出写到 `EDU/projects_data/_review/branch_out/<bkey>.json`,
结构 = `{"concepts":[...], "concept_edges":[...], "covers":[...]}`。

- [x] **Step 2: 校验每份产出结构**

Run: `cd ~/Dev/systemedu && python3 projects_data/_review/_check_branch_out.py`
(该脚本见下, 校验字段完整 + id 前缀 + 服务边 to 存在 + subject 恒 Mathematics)
Expected: 5 分支全绿, 报告各分支概念数/边数/服务边命中率。

`_check_branch_out.py`:

```python
import json, glob, os
IDEA = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review')
BO = os.path.join(os.path.dirname(__file__), 'branch_out')
# 现有全 id 集
valid_ids = set()
for sl in glob.glob(f'{IDEA}/*_concept_slice.json'):
    for c in json.load(open(sl,encoding='utf-8'))['concepts']:
        valid_ids.add(c['id'])
GB={'elementary','middle','high','university'}
TY={'CONCEPTUAL','PROCEDURAL','REPRESENTATIONAL','LANGUAGE','META'}
math_ids=set(); allc=[]
for f in sorted(glob.glob(f'{BO}/*.json')):
    d=json.load(open(f,encoding='utf-8'))
    for c in d['concepts']:
        assert c['id'].startswith('m.'), f"{f}: id 不以 m. 开头 {c['id']}"
        assert c['subject']=='Mathematics', f"{f}: subject 非 Mathematics {c['id']}"
        assert c['grade_band'] in GB, f"{f}: 学段非法 {c['id']}"
        assert c['type'] in TY, f"{f}: type 非法 {c['id']}"
        math_ids.add(c['id']); allc.append(c)
    print(f"{os.path.basename(f)}: {len(d['concepts'])} 概念, {len(d.get('concept_edges',[]))} 边, {len(d.get('covers',[]))} covers")
# 边的 to: 要么是 math 点, 要么是现有点
for f in sorted(glob.glob(f'{BO}/*.json')):
    d=json.load(open(f,encoding='utf-8'))
    for e in d.get('concept_edges',[]):
        ok = (e['to'] in math_ids or e['to'] in valid_ids) and (e['from'] in math_ids or e['from'] in valid_ids)
        if not ok: print(f"  WARN {os.path.basename(f)}: 边端点未知 {e['from']}->{e['to']}")
print(f"\n合计 math 概念: {len(allc)} (去重前)")
```

- [x] **Step 3: Commit 产出**

```bash
cd ~/Dev/systemedu && git add projects_data/_review/branch_out/ projects_data/_review/_check_branch_out.py
git commit -m "content(spec-044): 5 分支数学概念提炼产出 (agent)"
```

---

## Task 4: 审校合并成单一 math 切片

主 agent (我) 审校 5 份产出: 消解跨分支重复 (如"矩阵"可能 geometry 和 probstat 都提),
统一 id, 检查前置链闭合 (被引用的前置点存在), 合并进 `mathematics_concept_slice.json`。

**Files:**
- Modify: `IDEA/content-workspace/_review/mathematics_concept_slice.json` (填充)
- Create: `EDU/projects_data/_review/_merge_branches.py`

- [x] **Step 1: 写合并脚本** (跨分支去重 + 填进骨架)

```python
# _merge_branches.py
"""合并 5 分支产出 -> mathematics_concept_slice.json。跨分支按 (name_en 归一 or id) 去重。"""
import json, glob, os, re
BO = os.path.join(os.path.dirname(__file__), 'branch_out')
SLICE = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review/mathematics_concept_slice.json')

def norm(s): return re.sub(r'[^a-z0-9]+',' ',(s or '').lower()).strip()

skeleton = json.load(open(SLICE, encoding='utf-8'))
seen_key={}     # norm(name_en) -> id (去重)
id_remap={}     # 被去重掉的 id -> 保留的 id
concepts=[]; edges=[]; covers=[]
for f in sorted(glob.glob(f'{BO}/*.json')):
    d=json.load(open(f,encoding='utf-8'))
    for c in d['concepts']:
        k=norm(c['name_en'])
        if k in seen_key:
            id_remap[c['id']]=seen_key[k]   # 记重定向
            continue
        seen_key[k]=c['id']; concepts.append(c)
    edges += d.get('concept_edges',[])
    covers += d.get('covers',[])
# 边/covers 里被去重的 id 重定向 + 去重
def rm(i): return id_remap.get(i,i)
edges2=[]; eseen=set()
for e in edges:
    a,b,s=rm(e['from']),rm(e['to']),e.get('strength','soft')
    if a==b: continue
    key=(a,b)
    if key in eseen: continue
    eseen.add(key); edges2.append({'from':a,'to':b,'strength':s})
cov2=[]; cseen=set()
for cov in covers:
    c=rm(cov['concept']); m=cov['module']; key=(m,c)
    if key in cseen: continue
    cseen.add(key); cov2.append({'module':m,'concept':c})
skeleton['concepts']=concepts; skeleton['concept_edges']=edges2; skeleton['covers']=cov2
json.dump(skeleton, open(SLICE,'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"合并: {len(concepts)} 概念 (去重 {len(id_remap)}), {len(edges2)} 边, {len(cov2)} covers")
from collections import Counter
print("学段:", dict(Counter(c['grade_band'] for c in concepts)))
```

- [x] **Step 2: 跑合并**

Run: `cd ~/Dev/systemedu && python3 projects_data/_review/_merge_branches.py`
Expected: 打印合计概念数 (70-95), 去重数, 学段分布 (4 段都有)。

- [x] **Step 3: 人工审校** (主 agent 读合并结果)

Read `IDEA/content-workspace/_review/mathematics_concept_slice.json`,检查:
- 无重复母概念; 前置链每个 from/to 都存在; description 面向儿童且说清项目用途;
- 学段梯度合理 (小学有基础点,大学有高阶点); 5 分支都有代表。
- 发现问题直接 Edit 修正。

- [x] **Step 4: Commit**

```bash
cd ~/Dev/systemedu && git add projects_data/_review/_merge_branches.py
git commit -m "chore(spec-044): 分支合并脚本"
cd ~/Dev/systemeduidea && git add content-workspace/_review/mathematics_concept_slice.json
git commit -m "content(spec-044): 数学星系单一切片 (审校合并后)"
```

---

## Task 5: Wikidata 锚定数学概念

给数学概念填 QID。复用现有 `anchor_wikidata.py` 逻辑,但输入是 math 切片。

**Files:**
- Create: `IDEA/content-workspace/_review/concept_layer_scripts/anchor_math.py`
- Modify: `IDEA/content-workspace/_review/mathematics_concept_slice.json` (填 wikidata/wikidata_label)

- [x] **Step 1: 写锚定脚本** (照搬 anchor_wikidata.py 的 `_get/search/describe/is_concept/anchor_term`,
  改为直接读写 math 切片; 断点续: 已有 wikidata 的跳过; 限速 2.5s)

关键差异 (相对 anchor_wikidata.py):
- 输入输出都是同一个 `mathematics_concept_slice.json` (原地填充)。
- 搜索词优先 `wikidata_search`,回落 `name_en`。
- 每 5 个 fsync 存盘 (见 [[feedback_llm_batch_mapping_gotchas]] 增量落盘)。

- [x] **Step 2: 跑锚定**

Run: `cd ~/Dev/systemeduidea && python3 content-workspace/_review/concept_layer_scripts/anchor_math.py`
Expected: 逐条打印 `[i/N] 概念名 "搜索词" -> Qxxxx label [ok/WARN/MISS]`,
末尾报告锚定率。数学概念多为标准数学对象,命中率应 >85%。

- [x] **Step 3: 人工复核 WARN/MISS**

Run: `cd ~/Dev/systemedu && python3 -c "import json,os; d=json.load(open(os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review/mathematics_concept_slice.json'),encoding='utf-8')); miss=[c for c in d['concepts'] if not c.get('wikidata')]; [print(c['id'],c['name_zh'],c['name_en']) for c in miss]"`
对 MISS 项手工填 QID (数学概念在 Wikidata 都有标准条目, 如 matrix=Q44337, vector space=Q125977)。

- [x] **Step 4: Commit**

```bash
cd ~/Dev/systemeduidea && git add content-workspace/_review/concept_layer_scripts/anchor_math.py content-workspace/_review/mathematics_concept_slice.json
git commit -m "content(spec-044): 数学概念 Wikidata 锚定"
```

---

## Task 6: 自包含合并脚本 merge_galaxy_v9

写一个不依赖旧 scratchpad 的合并脚本,直接吃**仓内 8 切片 + math 切片**,输出
`galaxy_all_9courses.json`。逻辑照搬 `merge_galaxy.py` 但路径全部指向仓内 + 加第 9 源。

**Files:**
- Create: `IDEA/content-workspace/_review/concept_layer_scripts/merge_galaxy_v9.py`
- Output: `IDEA/content-workspace/_review/galaxy_all_9courses.json`

- [x] **Step 1: 写 merge_v9** (基于 merge_galaxy.py, 关键改动如下)

```python
#!/usr/bin/env python3
"""合并 8 门课 + 数学虚拟课 (第9源) 成大星图数据。自包含, 只吃仓内切片, 不依赖 scratchpad。
数学是虚拟课: 不进 projects 列表, 但概念的 projects[]/covers 照记它服务的真实课。spec 044。"""
import json, os, re
BASE = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review')
OUT = f'{BASE}/galaxy_all_9courses.json'
PROJ_ZH = {
 'stirling-thermal-controller':'火焰AI发电站','emg-prosthetic-hand':'肌电义肢手',
 'eeg-minecraft-bci':'脑波Minecraft','satellite-archaeology':'卫星考古',
 'ai-ant-ethologist':'蚂蚁行为学家','mars-analog-rover':'火星巡视器',
 'purpleair-airquality-node':'空气质量站','molecule-monster-hunter':'分子怪兽猎人'}
ORDER = list(PROJ_ZH)
MATH_SLUG = '__math__'  # 虚拟课内部标识, 不进 projects 输出

# 8 课切片文件名 (仓内)
SLICE_FILE = {s: f'{BASE}/{s}_concept_slice.json' for s in ORDER}
SLICE_FILE['stirling-thermal-controller'] = f'{BASE}/stirling_concept_slice.json'
MATH_FILE = f'{BASE}/mathematics_concept_slice.json'

def norm_key(c):
    q = c.get('wikidata')
    if q and not str(q).startswith('⚠') and re.match(r'^Q\d+$', str(q)): return ('q', q)
    en = (c.get('name_en') or c.get('name_zh') or '').lower().strip()
    return ('n', re.sub(r'[^a-z0-9]+',' ',en).strip())

sources = [(s, SLICE_FILE[s]) for s in ORDER] + [(MATH_SLUG, MATH_FILE)]
merged={}; localid_to_key={}; covers_by_key={}; edge_set={}
GB_RANK={'elementary':0,'middle':1,'high':2,'university':3}
for slug, path in sources:
    d=json.load(open(path,encoding='utf-8'))
    cid_local={}
    for c in d['concepts']:
        k=norm_key(c); cid_local[c['id']]=k; localid_to_key[(slug,c['id'])]=k
        if k not in merged:
            merged[k]={'zh':c.get('name_zh'),'en':c.get('name_en'),'g':c.get('grade_band'),
              'subj':c.get('subject'),'t':c.get('type',''),
              'q':c.get('wikidata') if re.match(r'^Q\d+$',str(c.get('wikidata') or '')) else None,
              'ql':c.get('wikidata_label') if not str(c.get('wikidata_label') or '').startswith('⚠') else None,
              'projects':set()}
            covers_by_key[k]=set()
        merged[k]['projects'].add(slug)
        if GB_RANK.get(c.get('grade_band'),9) < GB_RANK.get(merged[k]['g'],9):
            merged[k]['g']=c.get('grade_band')
    for cov in d.get('covers',[]):
        k=cid_local.get(cov['concept'])
        if k: covers_by_key[k].add(f"{cov['module']}")
    for e in d.get('concept_edges',[]):
        fk=cid_local.get(e['from']); tk=cid_local.get(e['to'])
        # 跨切片服务边: to 可能指向别的切片的概念, 用 localid_to_key 全局查
        if not fk: fk=localid_to_key.get((slug,e['from']))
        if not tk:
            # 服务边 to 是现有概念 id: 在所有已加载源里找
            for s2,_ in sources:
                if (s2,e['to']) in localid_to_key: tk=localid_to_key[(s2,e['to'])]; break
        if not fk or not tk or fk==tk: continue
        key=(fk,tk)
        if key not in edge_set or e.get('strength')=='hard': edge_set[key]=e.get('strength','soft')

keylist=list(merged); kid={k:f'n{i}' for i,k in enumerate(keylist)}
concepts_out=[{'id':kid[k],'zh':merged[k]['zh'],'en':merged[k]['en'],'g':merged[k]['g'],
  'subj':merged[k]['subj'],'t':merged[k]['t'],'q':merged[k]['q'],'ql':merged[k]['ql'],
  'projects':sorted([p for p in merged[k]['projects'] if p!=MATH_SLUG], key=lambda s:ORDER.index(s) if s in ORDER else 99)}
  for k in keylist]
edges_out=[[kid[a],kid[b],s] for (a,b),s in edge_set.items()]
covers_out={kid[k]:sorted(v) for k,v in covers_by_key.items() if v}
proj_concepts={slug:[] for slug in ORDER}  # 只 8 真实课
for k in keylist:
    for slug in merged[k]['projects']:
        if slug in proj_concepts: proj_concepts[slug].append(kid[k])
out={'projects':[{'slug':s,'zh':PROJ_ZH[s],'n_concepts':len(proj_concepts[s])} for s in ORDER],
     'concepts':concepts_out,'edges':edges_out,'covers':covers_out,'proj_concepts':proj_concepts}
json.dump(out,open(OUT,'w'),ensure_ascii=False)
from collections import Counter
print(f'合并: {len(concepts_out)} 概念, {len(edges_out)} 边')
print('学科:', dict(sorted(Counter(c['subj'] for c in concepts_out).items(), key=lambda x:-x[1])))
math_n=sum(1 for c in concepts_out if c['subj']=='Mathematics')
print(f'Mathematics 概念: {math_n}')
```

- [x] **Step 2: 跑合并**

Run: `cd ~/Dev/systemeduidea && python3 content-workspace/_review/concept_layer_scripts/merge_galaxy_v9.py`
Expected: 学科表里出现 `Mathematics: <N>` (>0), 总概念数 = 445 + 数学净增。

- [x] **Step 3: 验证现有 445 未变** (对比 8courses 与 9courses 里非数学概念集)

Run: `cd ~/Dev/systemedu && python3 projects_data/_review/_verify_445_intact.py`

```python
# _verify_445_intact.py — 确认非数学概念的 (zh,en,subj,g) 集合未变
import json, os
B=os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review')
old=json.load(open(f'{B}/galaxy_all_8courses.json',encoding='utf-8'))['concepts']
new=[c for c in json.load(open(f'{B}/galaxy_all_9courses.json',encoding='utf-8'))['concepts'] if c['subj']!='Mathematics']
def sig(cs): return sorted((c['zh'],c['en'],c['subj'],c['g']) for c in cs)
so, sn = sig(old), sig(new)
print(f"旧非数学: {len(so)}, 新非数学: {len(sn)}")
assert so==sn, f"现有概念变了! 差异: {set(map(str,so))^set(map(str,sn))}"
print("OK: 现有 445 概念的 (zh,en,subj,g) 完全一致")
```
Expected: `OK: 现有 445 概念...完全一致`。

- [x] **Step 4: Commit**

```bash
cd ~/Dev/systemeduidea && git add content-workspace/_review/concept_layer_scripts/merge_galaxy_v9.py content-workspace/_review/galaxy_all_9courses.json
git commit -m "feat(spec-044): 自包含 9 源合并脚本 (8课+数学虚拟课)"
```

---

## Task 7: 改 emit 脚本加 Mathematics

改 `emit_frontend_payload.py`: 输入换成 9courses, subj_zh/palette 加 Mathematics,
断言更新。

**Files:**
- Modify: `IDEA/content-workspace/_review/concept_layer_scripts/emit_frontend_payload.py`
- Output: `EDU/packages/student-web/public/galaxy/concept-galaxy.json`

- [x] **Step 1: 改 emit** (4 处改动, 全部保留现有代码, 只加/换少量行)

改动 1 — SRC 换成 9courses (第 6 行, 整行替换):
```python
SRC = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review/galaxy_all_9courses.json')
```

改动 2 — subj_zh dict 末尾加数学项 (第 55 行, 把 `'Robotics':'机器人'}` 结尾改为):
```python
 'Signal':'信号处理','Statistics':'统计','Geoscience':'地球科学','Robotics':'机器人',
 'Mathematics':'数学'}
```

改动 3 — subj_color 显式给数学固定色 (第 58 行 `subj_color = ...` 那行**下面新增一行**;
palette 数组不动, 因为 `sorted(subjs)` 里 Mathematics 会占一个索引拿到某色, 但我们要固定它):
```python
subj_color = {s: palette[i % len(palette)] for i, s in enumerate(subjs)}
subj_color['Mathematics'] = '#e8eaf0'  # 数学: 银白, 象征"贯穿所有学科的底层语言", 与 13 色区分
```

改动 4 — 断言更新 (第 74-75 行, 把原 `assert len(out['concepts']) == 445` 那两行断言替换为):
```python
math_n = sum(1 for c in out['concepts'] if c['subj']=='Mathematics')
assert math_n > 0, "无 Mathematics 概念!"
assert len(out['concepts']) > 445, f"概念数应 >445 (445+数学), 实得 {len(out['concepts'])}"
assert len(out['proj_concepts']) == 8, f"期望 8 真实项目, 实得 {len(out['proj_concepts'])}"
print(f"Mathematics 概念: {math_n}")
```

- [x] **Step 2: 跑 emit**

Run: `cd ~/Dev/systemeduidea && python3 content-workspace/_review/concept_layer_scripts/emit_frontend_payload.py`
Expected: `OK: <N> 概念...` + `Mathematics 概念: <M>`, 前端 JSON 已更新。

- [x] **Step 3: 校验前端 JSON**

Run: `cd ~/Dev/systemedu && python3 -c "import json; d=json.load(open('packages/student-web/public/galaxy/concept-galaxy.json')); print('subj_zh 含数学:', 'Mathematics' in d['subj_zh']); print('数学色:', d['subj_color'].get('Mathematics')); print('数学概念数:', sum(1 for c in d['concepts'] if c['subj']=='Mathematics')); print('总概念:', len(d['concepts']))"`
Expected: 含数学=True, 有色值, 数学概念数>0, 总数>445。

- [x] **Step 4: Commit** (前端数据 + emit 脚本)

```bash
cd ~/Dev/systemeduidea && git add content-workspace/_review/concept_layer_scripts/emit_frontend_payload.py
git commit -m "feat(spec-044): emit 加 Mathematics 学科 (银白色)"
cd ~/Dev/systemedu && git add packages/student-web/public/galaxy/concept-galaxy.json
git commit -m "feat(spec-044): 知识星图前端数据加数学星系"
```

---

## Task 8: 前端视觉验证

起本地 student-web, 打开 `/galaxy`, 验证数学星系正确渲染。

**Files:** 无改动 (纯验证)

- [x] **Step 1: 起前端** (preview_start, 用 launch.json 里的 student-web 配置; 无则先建)

- [x] **Step 2: 打开 /galaxy, 截图**

- [x] **Step 3: 逐项验证** (preview_snapshot / preview_eval 查 DOM)
- 学科图例 (legend) 里出现"数学"+ 银白色板;
- 数学概念节点渲染在星图上 (银白色点);
- 点一个数学点 → 详情卡显示概念名/英文/学段/Wikidata 链接;
- 选一个用到数学的项目 (如"脑波Minecraft") → 它服务的数学点跟着点亮;
- 数学内部前置边可见 (选中时高亮)。

- [x] **Step 4: 有问题回溯**
- 数学点不显示 → 查 concept-galaxy.json 数学概念的 x/y (emit 布局是否覆盖到);
- 颜色不对 → 查 subj_color['Mathematics'];
- 点亮不工作 → 查数学概念的 projects[]/covers 是否记了真实课。

- [x] **Step 5: 截图存证** (preview_screenshot, 给用户看效果)

---

## Task 9: 更新 spec 状态 + 部署

- [x] **Step 1: spec.md 顶部改 Status**

`specs/044-galaxy-math-constellation/spec.md` 第 3 行:
```
Status: shipped (2026-07-13)
```
补验收结果 (数学概念实际数、锚定率)。

- [x] **Step 2: 更新 prd + todolist** (若有 galaxy 相关条目)

- [x] **Step 3: Commit + push 两仓**

```bash
cd ~/Dev/systemeduidea && git push
cd ~/Dev/systemedu && git add specs/044-galaxy-math-constellation/ && git commit -m "docs(spec-044): 数学星系 shipped" && git push
```

- [x] **Step 4: 部署前端** (数学星系数据在 concept-galaxy.json, 需 web 重建)

Run: `cd ~/Dev/systemedu && ./scripts/deploy-student.sh web`
(参考上次 galaxy 上线: pack→code→web→verify)
Expected: 生产 `/galaxy` 出现数学星系。

- [x] **Step 5: 生产验证**

Run: 拉生产 concept-galaxy.json 确认含 Mathematics。

---

## 清理

提炼中间产物 (`branch_inputs/` `branch_out/` `_math_*.py` `_check_*.py` 等) 属临时区,
按 [[project_scripts_debug_keep]] 规则: `_review/` 下的 `_gen_/_fix_` 类保留,
纯 debug 脚本可删。math 切片 + merge_v9 + emit 是正式产物,永久保留。
