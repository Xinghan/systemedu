# 全学科知识星图接进 systeme.xin 前端 — 设计文档

> 日期: 2026-07-11
> 状态: 待用户 review
> 实现仓: `~/Dev/systemedu` (packages/student-web)
> 数据源仓: `~/Dev/systemeduidea` (概念切片流水线, 离线)

---

## 1. 背景与目标

### 已有的两套平行实现

**A. 生产前端现状 (systemedu)** — 已有一套成熟的"知识宇宙":
- 数据源 `course_factory/knowledge_tree/platform_tree.json` — 11 学科 / 742 节点 / 670 锚 Wikidata, 有 prerequisites + 本体论 `related` 边。
- 后端 `/api/library/platform/knowledge-tree` 透传。
- 组件 `KnowledgeTreeView` (2D 分层/树/3D 三视图切换) + `KnowledgeGalaxy3D` (Three.js 3D 星系) + `UserKnowledgeTreeView` (用户级聚合)。
- per-user 点亮 (`userKnowledgeTree.get()` 的 `lit_nodes`) + per-project 点亮 (`getProjectKnowledgeTree`)。
- 入口: `/brain` 页"知识"tab + 库详情页 `KnowledgeTreeModal` 弹窗。

**B. systemeduidea 的概念星图 artifact** — 另一套独立实现:
- 数据 `content-workspace/_review/galaxy_all_8courses.json` — 8 门课合并去重 = 445 唯一概念 / 753 先修边 / 71 跨项目共享枢纽, 96% 锚定 Wikidata (CC0)。
- 一个独立 HTML artifact (2D SVG 星图), 由 `build_galaxy_payload.py` (Python 预算力导向布局) + `assemble_galaxy.py` 组装。
- 交互: 点项目 chip → 点亮该项目覆盖的概念; 学科图例筛选; 点概念 → 卡片 (学科/中英文名/学段/用于哪些项目/课节 M##/Wikidata 链接)。
- **未接生产前端**。

### 目标

把 B (445 概念 2D SVG 星图) 移植进 systemedu 前端, 作为新独立页 `/galaxy`, **替换** A 作为入口。视觉与交互贴合 artifact (也贴合用户参照的 Marble/os-taxonomy curriculum demo — 该 demo 是 **2D**)。核心叙事:"做完一个项目, 你点亮了多少真实学科知识?"

### 关键澄清: 2D 不是 3D

用户参照的 Marble curriculum demo 是 **2D** 的; 用户在 systemeduidea 生成的 artifact 也是 **2D SVG**。两者一致。本设计采用 2D SVG (非 Three.js 3D)。现有的 3D `KnowledgeGalaxy3D` 是 A 那套的一部分, 将被新星图**替换作为入口**。

---

## 2. 架构与数据流

分两层: 静态"地图" + 动态"个人图层"。

```
静态"地图"层 (8 门课定稿才变):
  systemeduidea/content-workspace/_review/galaxy_all_8courses.json
    ── build_galaxy_payload.py (Python 预算布局) ──►
      systemedu/packages/student-web/public/galaxy/concept-galaxy.json  (~147KB)

动态"个人"层 (登录时, 纯前端 join, 零后端改动):
  myProjects.list()                         → 我书架上有哪些项目
  每项目 myKnodes.getCompleteStatus(slug)   → 我完成的 M## (completed_knode_ids)
    ── 交 payload.covers (概念→slug:M##) ──► 我点亮了哪些 concept

页面 src/app/(home)/galaxy/page.tsx:
  fetch 静态 payload
  + (若登录) 拉个人进度 → 算 litByConcept: Set<conceptId>
  → 传给 ConceptGalaxy.tsx (2D SVG 渲染, 移植自 artifact)
```

### 2.1 payload 走静态资源, 不接后端

**决定**: 预算好的 147KB payload 作为 `public/galaxy/concept-galaxy.json` 提交进前端仓, 页面 client-side `fetch`。

**理由**: 概念星图由 systemeduidea 的离线流水线生成 (跟生产后端不在一个仓), 相对静态。静态资源 = 零后端改动、零 DB、零新 API。将来课程变了, 在 systemeduidea 重跑 `build_galaxy_payload.py` 覆盖此文件, commit 即可。

### 2.2 个人点亮 = 前端 join, 零后端改动

**核心机制** (已核实可行):
- 后端 `importer.py` 把 knode 的 `knode_id` 存成 `module_id` (形如 `M01`, 见 `manifest.py:42`)。
- 前端 `myKnodes.getCompleteStatus(slug)` 返回 `completed_knode_ids: string[]` = 裸 `M##`。
- payload 的 `covers` 映射 `conceptId → ["slug:M##", ...]`。
- **两边的 module id 都是裸 `M##`, join key 100% 对得上。**

join 算法:
```
completed = Set()
for p in myProjects.list():
    for mid in getCompleteStatus(p.slug).completed_knode_ids:
        completed.add(`${p.slug}:${mid}`)

litByConcept = Set()
for conceptId, coverEntries in payload.covers:
    for entry in coverEntries:
        # entry 形如 "slug:M##" 或 (stirling 数据) "slug:slug:M##"
        mid = entry.split(':').at(-1)              # 取最后一段 = 模块 id
        slug = entry.slice(0, entry.lastIndexOf(':' + mid))  # 前缀 = slug
        # 规范匹配: 用已知 slug 集合归一 (见下"数据квирк")
        if `${slug}:${mid}` in completed OR entry matches any completed key by (slug, mid):
            litByConcept.add(conceptId); break
```

**数据 quirk (必须处理)**: 大多数 covers 是干净的 `slug:M##` (如 `ai-ant-ethologist:M02`), 但 stirling 的是**双写** `stirling-thermal-controller:stirling-thermal-controller:M02`。健壮解法: `mid = 最后一段`; `slug` 用 payload 已知的 8 个 slug 集合去匹配 (哪个已知 slug 是这条 entry 的前缀/子串), 而非硬 split。因为 `getCompleteStatus` 是按已知 slug 逐项目调的, 我们本就手握准确 slug, 所以最终 join 只需判断"该概念的某条 cover 的 mid ∈ 我在该 slug 下完成的 mid 集合"。

### 2.3 未登录 fallback

未登录时, 个人层为空, 图退化成纯"点项目看覆盖"的探索模式 (artifact 原样), 完全可用。顶部给一句"登录后看你自己点亮了多少"。

---

## 3. 组件设计

### 3.1 `ConceptGalaxy.tsx` (新组件, 2D SVG)

移植自 artifact 的 `assemble_galaxy.py` 的 SHELL + SCRIPT, 改写成 React。

**Props**:
```ts
interface ConceptGalaxyProps {
  payload: GalaxyPayload          // 静态 payload (concepts/edges/proj_concepts/covers/subj_color/layout/projects)
  litByConcept: Set<string>       // 我学过点亮的概念 id (登录时非空; 未登录空集)
  initialProject?: string         // 库详情跳来时预选的项目 slug
  loggedIn: boolean               // 决定是否显示"我学过"层 + 顶部提示
}
```

**渲染** (SVG, viewBox = payload.layout VW×VH):
- 学段带 (bands): 小学底→大学顶的横向虚线 + 学段标签 (`elementary/middle/high/university`)。
- 边 (edges): 默认极淡; 高亮态 (项目选中/我学过) 两端都在集合内的边加亮。
- 节点 (concepts): `circle`, 半径 = `3 + min(5, (被N个项目共享-1)*1.5)` (共享越多越大); 颜色 = 学科色。
- 节点标签: 悬停/高亮时显示中文名 (截断 6 字)。

**三层点亮叠加**:
| 层 | 触发 | 视觉 |
|---|---|---|
| ① 我学过 | 登录时自动 (litByConcept) | 默认发亮 (学科色实心 + 微光晕) |
| ② 项目覆盖 | 点项目 chip (proj_concepts[slug]) | 该项目概念高亮描边、其余压暗 opacity 0.12 |
| ③ 悬停/选中 | raycaster/click 单点 | 弹概念卡片 + 该点标签常显 |

优先级: ② 激活时覆盖 ① 的默认展示 (压暗未覆盖的, 含我学过但不在该项目的); 取消项目选择回到 ① 展示。

### 3.2 概念卡片 (移植 artifact 的 card)

点节点 → 卡片 (SVG overlay 上的绝对定位 div):
- 学科标签 (学科色底)
- 中文名 + 英文名 (斜体)
- 学段 · 概念类型 (小学/初中/高中/大学 · conceptual/procedural/...)
- **用于**: 哪些项目 (chip 列表, 来自 concept.p)
- **课节**: M## chip 列表 (来自 covers[conceptId], 取最后一段, 去重, 最多 12 个)
- "📇 基础知识卡片" 占位 (dashed 框, 说明"将来这里放这个概念的独立讲解")
- **Wikidata ↗ QID** 链接 (有 q 则可点跳 wikidata.org/wiki/<QID>, 无则 disabled)

### 3.3 页面 `src/app/(home)/galaxy/page.tsx`

- `"use client"`, 全屏 stage 布局。
- 左列: 大衬线标题 ("做完一个项目, 你点亮了多少真实知识?") + KPI (445 概念/13 学科/137 大学概念) + 项目 chip 栏 + 学科图例 (点击筛选)。
- 右侧: `ConceptGalaxy` 星图占主区。
- 加载: fetch `/galaxy/concept-galaxy.json`; 若 `loggedIn` 并行拉个人进度算 `litByConcept`。
- 读 `?project=<slug>` query 作为 `initialProject`。
- 主题: artifact 深色星云配色 (深空底 + 金色标题 em), 用现有 CSS 变量兜底 (`--card`/`--border`/`--ink` 等), 深色部分内联 (星图本就是深色场景, 不随站点 light/dark 切换; 与现有 3D 组件同惯例——那个也是写死深空底)。

### 3.4 i18n

artifact 文案目前是中文硬编码。移植时抽到 `src/lib/i18n/locales.ts` 的 `galaxy.*` 命名空间 (已有部分 `galaxy.*` key)。中英文各一份。KPI/标题/chip/卡片字段名/hint 全部走 `useT()`。

---

## 4. 替换旧版 & 入口

### 4.1 新增入口
- 首页 (`(home)/home/page.tsx`) 卡片网格加一张"知识星图"入口卡 (仿现有 `brain-card` 样式), href `/galaxy`。

### 4.2 改指向 (旧入口 → 新星图)
- **`/brain` 页"知识"tab**: 当前渲染 `UserKnowledgeTreeView` (旧 742 树)。改为: 该 tab 内容换成一张引导卡 (显示"你点亮了 X/445 概念"摘要 + "打开全学科知识星图 →"按钮跳 `/galaxy`)。**保留 tab 本身**, 只换内容, 不在 tab 内内嵌整张星图 (星图要全屏铺开, tab 容器太窄)。摘要数字复用 §2.2 的 join 结果。
- **库详情页 `KnowledgeTreeModal`**: 当前弹旧项目级 3D 知识树。改为: "打开知识树"按钮改跳 `/galaxy?project=<slug>` (带项目预选, 进去直接点亮该项目)。

### 4.3 旧组件命运 (用户决定: 保留不删)
- `KnowledgeGalaxy3D` / `KnowledgeTreeView` / `UserKnowledgeTreeView` / `KnowledgeRadialTree` / `knowledge-tree-modal` / 相关 API (`getPlatformKnowledgeTree` / `userKnowledgeTree` / `getProjectKnowledgeTree`) 及后端 742 platform_tree 端点 **全部保留代码, 不删**。只是不再有 UI 入口指向它们。
- 风险最低: 万一新星图有问题, 旧的还在, 可快速改回入口。
- 代价: 仓里残留一段无入口的死代码。将来另开工单清理 (若需要)。

---

## 5. 数据构建脚本

### 5.1 在 systemeduidea 侧
- 复用 `content-workspace/_review/concept_layer_scripts/build_galaxy_payload.py`, 改输入/输出路径:
  - 输入: `content-workspace/_review/galaxy_all_8courses.json`
  - 输出: 直接写到 `~/Dev/systemedu/packages/student-web/public/galaxy/concept-galaxy.json`
- 或做一个薄封装脚本 `scripts/build_concept_galaxy_payload.py` 固化路径 + 校验 (445 概念数、坐标范围、8 项目 proj_concepts 齐全)。

### 5.2 payload schema (前端 TS 类型)
```ts
interface GalaxyConcept {
  id: string; x: number; y: number
  zh: string; en: string
  g: "elementary" | "middle" | "high" | "university"
  subj: string; t: string        // 学科 / 概念类型 (CONCEPTUAL...)
  q: string; ql: string          // Wikidata QID / label
  p: string[]                    // 覆盖此概念的项目 slug[]
}
interface GalaxyPayload {
  projects: { slug: string; zh: string; n_concepts: number }[]
  proj_concepts: Record<string, string[]>   // slug → conceptId[]
  covers: Record<string, string[]>          // conceptId → ["slug:M##"...]
  subj_zh: Record<string, string>
  subj_color: Record<string, string>
  layout: { VW: number; VH: number; bandY: Record<string,number>; band_label: Record<string,string> }
  concepts: GalaxyConcept[]
  edges: [string, string, "hard"|"soft"][]
}
```

---

## 6. 不做 (YAGNI)

- 不为个人点亮建后端端点 (前端 join 足够)。
- 不做"基础知识卡片"的真实内容 (占位保留 — 另一个大工程: 课程按 knode 组织非按概念)。
- 不改概念切片/Wikidata 锚定流水线 (数据已定稿)。
- 不删旧知识树组件 (用户决定保留)。
- 布局横向铺满优化 (已知 artifact x 只用 ~625/1400px) 列为可选; 默认沿用现有预算坐标。若顺手可在 build_galaxy_payload.py 调斥力/gx0 铺得更满, 但不阻塞本次。

---

## 7. 测试与验证

- **数据 join 单测**: 构造假 `completed` + 假 `covers` (含 stirling 双写 quirk), 验证 litByConcept 正确。
- **前端交互验证** (webapp-testing / preview): 
  1. 未登录: 星图默认全暗, 点项目 chip 点亮该项目网络, 点节点弹卡片, Wikidata 链接正确。
  2. 登录 (有完成进度): 我学过的概念默认发亮; 点项目叠加高亮; 数字合理。
  3. `?project=stirling-thermal-controller` 进入 → 直接预选点亮 stirling。
  4. 首页卡片入口 → 跳 /galaxy。
  5. /brain 知识 tab → 跳/嵌新星图。
- **回归**: 旧知识树组件保留但无入口, 确认无其它页面仍引用其入口 (grep)。

---

## 8. 实现顺序 (供 writing-plans 消费)

1. 在 systemeduidea 侧固化 build 脚本, 生成 `concept-galaxy.json` 到前端 public/。
2. 前端: payload TS 类型 + fetch + 个人 join 逻辑 (含 join 单测)。
3. 前端: `ConceptGalaxy.tsx` 2D SVG 渲染 (移植 artifact SHELL+SCRIPT) — 先静态渲染 + 项目 chip + 学科图例。
4. 前端: 三层点亮叠加 + 概念卡片。
5. 前端: `(home)/galaxy/page.tsx` 页面组装 + i18n。
6. 前端: 首页卡片入口 + /brain tab 改指向 + 库详情弹窗改跳。
7. 验证 (未登录/登录/预选/入口) + 回归。
