# 全学科知识星图接进前端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 445 概念 2D SVG 知识星图移植进 systemedu 前端 (`/galaxy` 新页), 支持"点项目看覆盖 + 我学过自动点亮 + 概念卡片 + Wikidata 溯源", 替换旧知识树/3D 版作为入口。

**Architecture:** 静态 payload (`public/galaxy/concept-galaxy.json`, systemeduidea 离线生成) + 前端纯 join 个人点亮 (`getCompleteStatus` × `covers`, 零后端改动)。新 `ConceptGalaxy` 组件 2D SVG 渲染 (移植自 artifact `assemble_galaxy.py`)。新 `(home)/galaxy` 页 + 首页卡片入口 + `/brain` tab / 库详情弹窗改指向。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, SVG (无第三方图库), zustand (auth store), 现有 i18n (`useT`)。

**关键前提 (已核实):**
- 前端**无 JS 测试运行器** (无 jest/vitest)。纯逻辑用**独立 Node 脚本**冒烟验证; 集成用 **preview 实跑**验证。
- 静态 JSON 直接 `fetch("/galaxy/concept-galaxy.json")` (同源静态资源, 不走 api client)。
- `completed_knode_ids` = 裸 `M##`; payload `covers` 的模块段也是裸 `M##` — join key 对得上。
- stirling covers 有双写 slug quirk (`stirling-thermal-controller:stirling-thermal-controller:M02`), join 取"最后一段作 module id"。
- 数据源: `~/Dev/systemeduidea/content-workspace/_review/galaxy_all_8courses.json` (445 概念)。
- 布局脚本: `~/Dev/systemeduidea/content-workspace/_review/concept_layer_scripts/build_galaxy_payload.py`。
- 实现仓: `~/Dev/systemedu`, 分支 `feat/concept-galaxy-frontend`。前端包: `packages/student-web`。
- 预览: `.claude/launch.json` 已有 `student-web` (4000) / `student-backend` (18820) / `library-app` (18821)。

---

## File Structure

**新建 (systemedu/packages/student-web):**
- `public/galaxy/concept-galaxy.json` — 静态 payload (~147KB, 由 systemeduidea 脚本生成)
- `src/lib/galaxy/types.ts` — payload TS 类型
- `src/lib/galaxy/lit.ts` — 纯 join 逻辑 `computeLitConcepts(payload, completedBySlug)` + `fetchLitByConcept()`
- `src/components/learning/ConceptGalaxy.tsx` — 2D SVG 星图组件 (移植 artifact)
- `src/app/(home)/galaxy/page.tsx` — 页面
- `src/app/(home)/galaxy/galaxy.module.css` — 星图深色样式 (移植 artifact STYLE)

**新建 (systemeduidea):**
- `content-workspace/_review/concept_layer_scripts/emit_frontend_payload.py` — 固化路径的 payload 生成脚本

**修改 (systemedu/packages/student-web):**
- `src/app/(home)/home/page.tsx` — 加"知识星图"入口卡
- `src/app/(home)/brain/page.tsx` — "知识"tab 换成引导卡跳 /galaxy
- `src/app/(home)/library/[slug]/page.tsx` — "打开知识树"改跳 /galaxy?project=<slug>
- `src/lib/i18n/locales.ts` — 加 `galaxy.page.*` i18n key (zh + en)

---

## Task 1: systemeduidea 侧生成静态 payload 到前端 public/

**Files:**
- Create: `~/Dev/systemeduidea/content-workspace/_review/concept_layer_scripts/emit_frontend_payload.py`
- Output: `~/Dev/systemedu/packages/student-web/public/galaxy/concept-galaxy.json`

- [ ] **Step 1: 写生成脚本 (固化路径 + 校验)**

基于现有 `build_galaxy_payload.py` 的布局算法, 改输入/输出路径并加校验。完整脚本:

```python
#!/usr/bin/env python3
"""生成 445 概念星图静态 payload, 直接写到 systemedu 前端 public/galaxy/。
布局算法照搬 build_galaxy_payload.py (学段纵向重力 + 斥力铺满 + 边弹簧)。"""
import json, math, os

SRC = os.path.expanduser('~/Dev/systemeduidea/content-workspace/_review/galaxy_all_8courses.json')
OUT = os.path.expanduser('~/Dev/systemedu/packages/student-web/public/galaxy/concept-galaxy.json')

d = json.load(open(SRC, encoding='utf-8'))
concepts = d['concepts']; edges = d['edges']

VW, VH = 1400, 1000
bandY = {'university': VH*0.13, 'high': VH*0.40, 'middle': VH*0.68, 'elementary': VH*0.90}
gx0, gx1 = VW*0.30, VW*0.98

def prng(seed):
    s = seed
    def f():
        nonlocal s; s = (s*1103515245+12345) & 0x7fffffff; return s/0x7fffffff
    return f
rnd = prng(42)
NB = {}; N = []
subjs = sorted(set(c['subj'] for c in concepts))
subj_ang = {s: i/len(subjs) for i, s in enumerate(subjs)}
for c in concepts:
    cx = gx0 + (gx1-gx0)*(subj_ang[c['subj']] + (rnd()-0.5)*0.12)
    cx = max(gx0, min(gx1, cx))
    n = {'id': c['id'], 'c': c, 'x': cx, 'y': bandY[c['g']]+(rnd()-0.5)*80,
         'subj': c['subj'], 'r': 3.2+min(4.5, (len(c['projects'])-1)*1.4)}
    NB[c['id']] = n; N.append(n)
adj = [(NB[a], NB[b], s) for a, b, s in edges if a in NB and b in NB]

def step(alpha):
    for a, b, s in adj:
        dx = b['x']-a['x']; dy = b['y']-a['y']; dist = math.hypot(dx, dy) or .01
        k = (dist-46)/dist*0.5*alpha*(1 if s == 'hard' else .55)
        ox, oy = dx*k, dy*k; a['x'] += ox; a['y'] += oy; b['x'] -= ox; b['y'] -= oy
    for i in range(len(N)):
        a = N[i]
        for j in range(i+1, len(N)):
            b = N[j]; dx = b['x']-a['x']; dy = b['y']-a['y']; d2 = dx*dx+dy*dy or 1
            if d2 < 9000:
                dd = math.sqrt(d2); f = min(3.5, 900/d2)*alpha; fx = dx/dd*f; fy = dy/dd*f
                a['x'] -= fx; a['y'] -= fy; b['x'] += fx; b['y'] += fy
    for n in N:
        n['y'] += (bandY[n['c']['g']]-n['y'])*0.14*alpha
        n['x'] = max(gx0, min(gx1, n['x']))
        n['y'] = max(bandY['university']-52, min(bandY['elementary']+52, n['y']))

for it in range(260):
    step(1.0 if it < 180 else 0.35)

subj_zh = {'Physics':'物理','Electronics':'电子','Computing':'编程/计算','Control':'控制论',
 'Optimization':'最优化','AI':'人工智能','Systems':'系统工程','Biology':'生物','Chemistry':'化学',
 'Signal':'信号处理','Statistics':'统计','Geoscience':'地球科学','Robotics':'机器人'}
palette = ['#ff8c42','#ffd24a','#4fd1c5','#6ea8ff','#c084fc','#f472b6','#94e27a',
 '#6ee7f0','#fca5a5','#a3e635','#fbbf24','#818cf8','#f0abfc']
subj_color = {s: palette[i % len(palette)] for i, s in enumerate(subjs)}

out = {
 'projects': d['projects'], 'proj_concepts': d['proj_concepts'],
 'subj_zh': {s: subj_zh.get(s, s) for s in subjs}, 'subj_color': subj_color,
 'layout': {'VW': VW, 'VH': VH, 'bandY': bandY,
   'band_label': {'university':'大学 18+','high':'高中 15-18','middle':'初中 12-15','elementary':'小学 6-12'}},
 'concepts': [{'id': n['id'], 'x': round(n['x'], 1), 'y': round(n['y'], 1),
   'zh': n['c']['zh'], 'en': n['c']['en'], 'g': n['c']['g'], 'subj': n['subj'],
   't': n['c']['t'], 'q': n['c']['q'], 'ql': n['c']['ql'], 'p': n['c']['projects']} for n in N],
 'edges': edges, 'covers': d['covers'],
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# 校验
assert len(out['concepts']) == 445, f"期望 445 概念, 实得 {len(out['concepts'])}"
assert len(out['proj_concepts']) == 8, f"期望 8 项目 proj_concepts, 实得 {len(out['proj_concepts'])}"
assert '</script>' not in json.dumps(out).lower(), "payload 含 </script>!"
xs = [c['x'] for c in out['concepts']]; ys = [c['y'] for c in out['concepts']]
print(f"OK: {len(out['concepts'])} 概念, {len(edges)} 边, {os.path.getsize(OUT)//1024}KB")
print(f"x {min(xs):.0f}-{max(xs):.0f}, y {min(ys):.0f}-{max(ys):.0f}")
```

- [ ] **Step 2: 跑脚本生成 payload**

Run: `python3 ~/Dev/systemeduidea/content-workspace/_review/concept_layer_scripts/emit_frontend_payload.py`
Expected: `OK: 445 概念, 753 边, ~140KB` + 坐标范围行, 无 assert 报错。

- [ ] **Step 3: 确认文件落地前端 public/**

Run: `ls -la ~/Dev/systemedu/packages/student-web/public/galaxy/concept-galaxy.json`
Expected: 文件存在, ~140-150KB。

- [ ] **Step 4: Commit (两个仓分别提交)**

```bash
cd ~/Dev/systemeduidea && git add content-workspace/_review/concept_layer_scripts/emit_frontend_payload.py && git commit -m "concept-galaxy: 生成前端静态 payload 脚本 (固化路径+校验)"
cd ~/Dev/systemedu && git add packages/student-web/public/galaxy/concept-galaxy.json && git commit -m "feat(galaxy): 落 445 概念星图静态 payload"
```

---

## Task 2: payload TS 类型

**Files:**
- Create: `~/Dev/systemedu/packages/student-web/src/lib/galaxy/types.ts`

- [ ] **Step 1: 写类型文件**

```ts
// 全学科知识星图 payload 类型 (对应 public/galaxy/concept-galaxy.json)。
// 由 systemeduidea 的 emit_frontend_payload.py 生成。

export type GradeBand = "elementary" | "middle" | "high" | "university"

export interface GalaxyConcept {
  id: string
  x: number
  y: number
  zh: string
  en: string
  g: GradeBand
  subj: string
  t: string // 概念类型 CONCEPTUAL/PROCEDURAL/...
  q: string // Wikidata QID (可能为空串)
  ql: string // Wikidata label
  p: string[] // 覆盖此概念的项目 slug[]
}

export interface GalaxyProject {
  slug: string
  zh: string
  n_concepts: number
}

export interface GalaxyLayout {
  VW: number
  VH: number
  bandY: Record<GradeBand, number>
  band_label: Record<GradeBand, string>
}

export type GalaxyEdge = [string, string, "hard" | "soft"]

export interface GalaxyPayload {
  projects: GalaxyProject[]
  proj_concepts: Record<string, string[]> // slug → conceptId[]
  covers: Record<string, string[]> // conceptId → ["slug:M##", ...]
  subj_zh: Record<string, string>
  subj_color: Record<string, string>
  layout: GalaxyLayout
  concepts: GalaxyConcept[]
  edges: GalaxyEdge[]
}
```

- [ ] **Step 2: 类型检查通过**

Run: `cd ~/Dev/systemedu/packages/student-web && npx tsc --noEmit 2>&1 | grep galaxy/types || echo "no type errors in galaxy/types"`
Expected: `no type errors in galaxy/types`

- [ ] **Step 3: Commit**

```bash
cd ~/Dev/systemedu && git add packages/student-web/src/lib/galaxy/types.ts && git commit -m "feat(galaxy): payload TS 类型"
```

---

## Task 3: 个人点亮 join 纯逻辑 + Node 冒烟验证

**Files:**
- Create: `~/Dev/systemedu/packages/student-web/src/lib/galaxy/lit.ts`
- Smoke: `/private/tmp/claude-501/-Users-xinghan-Dev-systemeduidea/9e6698e7-9609-48ae-89d9-3a349c2d5f1b/scratchpad/smoke_lit.mjs` (临时, 不入库; 若该 scratchpad 不存在则用当前会话 scratchpad 目录)

- [ ] **Step 1: 写纯 join 逻辑 + fetch 封装**

`computeLitConcepts` 是纯函数 (可 Node 测); `fetchLitByConcept` 拉个人进度 (登录时调)。

```ts
// 个人点亮: 我完成的 knode → 我点亮的概念。
// 纯前端 join, 零后端: completed_knode_ids (裸 M##) × payload.covers (概念→slug:M##)。

import { myProjects, myKnodes } from "@/lib/api"
import type { GalaxyPayload } from "./types"

/**
 * 纯函数: 给定 payload.covers 和"每项目我完成的 module id 集合", 算出我点亮的概念 id 集合。
 * @param covers payload.covers: conceptId → ["slug:M##" 或 "slug:slug:M##"(stirling 双写)]
 * @param completedBySlug slug → Set<module id 裸 M##>
 */
export function computeLitConcepts(
  covers: Record<string, string[]>,
  completedBySlug: Record<string, Set<string>>,
): Set<string> {
  const lit = new Set<string>()
  const knownSlugs = Object.keys(completedBySlug)
  for (const [conceptId, entries] of Object.entries(covers)) {
    for (const entry of entries) {
      // module id = 最后一段 (兼容 stirling 双写前缀)
      const mid = entry.slice(entry.lastIndexOf(":") + 1)
      // slug = entry 里出现的已知 slug (取匹配的第一个)
      const slug = knownSlugs.find((s) => entry.startsWith(s + ":") || entry.includes(":" + s + ":"))
      if (slug && completedBySlug[slug]?.has(mid)) {
        lit.add(conceptId)
        break
      }
    }
  }
  return lit
}

/** 登录时调: 拉我书架项目 + 每项目完成状态 → 算 litByConcept。失败返回空集 (退化成探索模式)。 */
export async function fetchLitByConcept(payload: GalaxyPayload): Promise<Set<string>> {
  try {
    const mine = await myProjects.list()
    const slugs = mine.map((p) => p.slug)
    const completedBySlug: Record<string, Set<string>> = {}
    await Promise.all(
      slugs.map(async (slug) => {
        try {
          const st = await myKnodes.getCompleteStatus(slug)
          completedBySlug[slug] = new Set(st.completed_knode_ids)
        } catch {
          completedBySlug[slug] = new Set()
        }
      }),
    )
    return computeLitConcepts(payload.covers, completedBySlug)
  } catch {
    return new Set()
  }
}
```

- [ ] **Step 2: 写 Node 冒烟脚本 (验证纯函数 + stirling 双写 quirk)**

写到 scratchpad (临时): `smoke_lit.mjs`。内联复制 `computeLitConcepts` (Node 不解析 TS import), 断言几个 case:

```js
// smoke_lit.mjs — 验证 computeLitConcepts 逻辑 (含 stirling 双写)
function computeLitConcepts(covers, completedBySlug) {
  const lit = new Set()
  const knownSlugs = Object.keys(completedBySlug)
  for (const [conceptId, entries] of Object.entries(covers)) {
    for (const entry of entries) {
      const mid = entry.slice(entry.lastIndexOf(":") + 1)
      const slug = knownSlugs.find((s) => entry.startsWith(s + ":") || entry.includes(":" + s + ":"))
      if (slug && completedBySlug[slug]?.has(mid)) { lit.add(conceptId); break }
    }
  }
  return lit
}
const covers = {
  n0: ["stirling-thermal-controller:stirling-thermal-controller:M02"], // 双写
  n1: ["ai-ant-ethologist:M03"],                                        // 干净
  n2: ["emg-prosthetic-hand:M09b"],                                     // 带字母后缀
  n3: ["mars-analog-rover:M40"],                                        // 未完成
}
const completed = {
  "stirling-thermal-controller": new Set(["M02"]),
  "ai-ant-ethologist": new Set(["M03"]),
  "emg-prosthetic-hand": new Set(["M01"]), // 没 M09b
  "mars-analog-rover": new Set(["M01"]),   // 没 M40
}
const lit = computeLitConcepts(covers, completed)
const got = [...lit].sort().join(",")
const want = "n0,n1" // n0(双写命中) n1(干净命中); n2/n3 未完成
console.log("got:", got, "want:", want)
if (got !== want) { console.error("FAIL"); process.exit(1) }
console.log("PASS")
```

- [ ] **Step 3: 跑冒烟脚本, 验证 PASS**

Run: `node /private/tmp/claude-501/-Users-xinghan-Dev-systemeduidea/9e6698e7-9609-48ae-89d9-3a349c2d5f1b/scratchpad/smoke_lit.mjs`
Expected: `got: n0,n1 want: n0,n1` + `PASS`

- [ ] **Step 4: 用真实 payload 冒烟 (validate covers 格式假设)**

Run: 写第二个临时脚本读真实 `public/galaxy/concept-galaxy.json`, 模拟"完成 stirling 全部 M##", 断言点亮的概念数 > 0 且合理 (≈47):

```js
import fs from "fs"
const p = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"))
// 模拟完成 stirling 所有出现过的 module id
const mids = new Set()
for (const entries of Object.values(p.covers))
  for (const e of entries)
    if (e.includes("stirling-thermal-controller")) mids.add(e.slice(e.lastIndexOf(":")+1))
const completed = { "stirling-thermal-controller": mids }
// (复制 computeLitConcepts...)
const lit = computeLitConcepts(p.covers, completed)
console.log("stirling 全完成 → 点亮概念数:", lit.size, "(期望接近 47)")
if (lit.size < 30 || lit.size > 60) { console.error("FAIL 数量异常"); process.exit(1) }
console.log("PASS")
```
Expected: 点亮数 ≈ 40-50, `PASS`。

- [ ] **Step 5: 类型检查 + Commit**

```bash
cd ~/Dev/systemedu/packages/student-web && npx tsc --noEmit 2>&1 | grep "galaxy/lit" || echo "no type errors"
cd ~/Dev/systemedu && git add packages/student-web/src/lib/galaxy/lit.ts && git commit -m "feat(galaxy): 个人点亮 join 纯逻辑 (getCompleteStatus × covers)"
```

---

## Task 4: ConceptGalaxy 组件 — 静态 SVG 渲染 (节点+边+学段带)

**Files:**
- Create: `~/Dev/systemedu/packages/student-web/src/components/learning/ConceptGalaxy.tsx`
- Create: `~/Dev/systemedu/packages/student-web/src/app/(home)/galaxy/galaxy.module.css`

移植自 artifact `assemble_galaxy.py` 的 SHELL/SCRIPT/STYLE, 改写成 React。本 task 只做静态渲染 (无交互), 下 task 加交互。

- [ ] **Step 1: 写 galaxy.module.css (逐字移植 artifact STYLE)**

**源**: `~/Dev/systemeduidea/content-workspace/_review/concept_layer_scripts/assemble_galaxy.py` 第 **8–72 行** 的 `STYLE` 变量 (`STYLE=r'''<style>` 到 `</style>'''` 之间)。

**移植规则** (机械操作, 逐条照搬, 不改数值/配色):
1. 去掉最外层 `<style>` 和 `</style>` 标签, 只保留中间的 CSS 规则。
2. 把 `:root{...}` 里的变量 (`--bg/--ink/--ink-dim/--ink-faint/--gold/--line/--panel/--serif/--sans/--mono`) 原样保留 —— CSS module 的 `:root` 合法, 或改写为在 `.stage` 上定义。**保留这些变量定义**, 因为下面规则引用它们。
3. 每个类 (`.stage/.brand/.leftcol/.lede/.kpis/.kpi/.projwrap/.chips/.chip/.legend/.lg/.galaxy/.bandtick/.bandline/.hint/.card` 及其子选择器如 `.lede h1`/`.card h3`/`.chip .dot`) 原样保留。CSS module 会自动 local 化类名 (`.stage` → 哈希类)。
4. **注意**: `.chip[aria-pressed="true"]`、`.lg[aria-pressed="true"]`、`:focus-visible`、`@media (max-width:820px)` 等属性/伪类/媒体查询原样保留。
5. `.sr-only` 若源里有也保留。

**验证移植完整性**: 确保 galaxy.module.css 里出现的类名 ⊇ Task 5/6/7 page.tsx 和 ConceptGalaxy.tsx 引用的所有 `styles.*`: `stage brand fx leftcol lede desc kpis kpi n l projwrap tag chips chip dot legend cap lgrid lg sw nm ct galaxy bandtick bandline hint card x subj en kv projwrp pchip mods mc stub wd disabled show`。缺哪个补哪个 (从源 STYLE 找)。

(`.fx` = brand 里金色 ✦; 若源 STYLE 未单列 `.fx` 而是 `.brand .fx`, 则 CSS module 里用 `.brand .fx` 写法, page.tsx 引用时 `.fx` 需嵌在 `.brand` 内 —— 实现时确认。)

- [ ] **Step 2: 写 ConceptGalaxy.tsx 静态渲染骨架**

```tsx
"use client"

import { useMemo } from "react"
import type { GalaxyPayload } from "@/lib/galaxy/types"
import styles from "@/app/(home)/galaxy/galaxy.module.css"

interface Props {
  payload: GalaxyPayload
  litByConcept: Set<string>
  initialProject?: string
  loggedIn: boolean
}

const NS = "http://www.w3.org/2000/svg"
const BANDS: Array<GalaxyPayload["concepts"][number]["g"]> = ["university", "high", "middle", "elementary"]

export function ConceptGalaxy({ payload, litByConcept }: Props) {
  const L = payload.layout
  const byId = useMemo(
    () => Object.fromEntries(payload.concepts.map((c) => [c.id, c])),
    [payload.concepts],
  )

  return (
    <svg
      className={styles.galaxy}
      viewBox={`0 0 ${L.VW} ${L.VH}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      xmlns={NS}
    >
      {/* 学段带 */}
      <g>
        {BANDS.map((b) => {
          const y = L.bandY[b]
          return (
            <g key={b}>
              <line className={styles.bandline} x1={L.VW * 0.28} y1={y - 64} x2={L.VW - 6} y2={y - 64} />
              <text className={styles.bandtick} x={L.VW - 10} y={y - 52} textAnchor="end">
                {L.band_label[b]}
              </text>
            </g>
          )
        })}
      </g>
      {/* 边 */}
      <g>
        {payload.edges.map(([a, b], i) => {
          const pa = byId[a], pb = byId[b]
          if (!pa || !pb) return null
          return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#8ea3c8" strokeOpacity={0.05} />
        })}
      </g>
      {/* 节点 */}
      <g>
        {payload.concepts.map((c) => {
          const col = payload.subj_color[c.subj] || "#888"
          const r = 3 + Math.min(5, (c.p.length - 1) * 1.5)
          const lit = litByConcept.has(c.id)
          return (
            <circle
              key={c.id}
              cx={c.x}
              cy={c.y}
              r={r}
              fill={col}
              opacity={lit ? 1 : 0.85}
              style={{ cursor: "pointer" }}
            />
          )
        })}
      </g>
    </svg>
  )
}
```

- [ ] **Step 3: 类型检查通过**

Run: `cd ~/Dev/systemedu/packages/student-web && npx tsc --noEmit 2>&1 | grep ConceptGalaxy || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 4: Commit**

```bash
cd ~/Dev/systemedu && git add packages/student-web/src/components/learning/ConceptGalaxy.tsx "packages/student-web/src/app/(home)/galaxy/galaxy.module.css" && git commit -m "feat(galaxy): ConceptGalaxy 静态 SVG 渲染 (节点/边/学段带)"
```

---

## Task 5: galaxy 页面 + 数据加载 + 首个 preview 验证

**Files:**
- Create: `~/Dev/systemedu/packages/student-web/src/app/(home)/galaxy/page.tsx`
- Modify: `~/Dev/systemedu/packages/student-web/src/lib/i18n/locales.ts`

- [ ] **Step 1: 加 i18n key (locales.ts, zh + en 各一份)**

在 `zh` 对象末尾附近加:
```ts
  // ── 全学科知识星图 (/galaxy) ──
  "galaxy.page.title_a": "做完一个项目，",
  "galaxy.page.title_b": "你点亮了多少",
  "galaxy.page.title_c": "真实知识？",
  "galaxy.page.desc": "8 门项目课拆成 445 个真实学科概念（全锚定 Wikidata），纵向从小学铺到大学。点越大的点被越多项目共享。选一个项目，看它点亮的知识网络。",
  "galaxy.page.kpi_concepts": "真实概念",
  "galaxy.page.kpi_subjects": "学科",
  "galaxy.page.kpi_university": "大学概念",
  "galaxy.page.pick_project": "选择项目 · 点亮它的知识网络",
  "galaxy.page.legend_cap": "学科 · 点击筛选",
  "galaxy.page.hint": "点项目 点亮网络 · 点光点 看概念详情",
  "galaxy.page.login_cta": "登录后看你自己点亮了多少",
  "galaxy.page.loading": "正在绘制知识星图…",
  "galaxy.card.grade": "学段",
  "galaxy.card.used_by": "用于",
  "galaxy.card.modules": "课节",
  "galaxy.card.stub": "📇 基础知识卡片 · 将来这里放这个概念的独立讲解。当前给出锚点与出处。",
  "galaxy.card.wikidata_pending": "（待补锚点）",
  "galaxy.nav": "知识星图",
```
在 `en` 对象对应加英文 (title_a "Finish one project," / title_b "how much real knowledge" / title_c "did you light up?" / desc 英译 / kpi "Real concepts"/"Subjects"/"University-level" / 等)。

- [ ] **Step 2: 写页面**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useT } from "@/lib/i18n/use-t"
import { ConceptGalaxy } from "@/components/learning/ConceptGalaxy"
import { fetchLitByConcept } from "@/lib/galaxy/lit"
import type { GalaxyPayload } from "@/lib/galaxy/types"
import styles from "./galaxy.module.css"

export default function GalaxyPage() {
  const t = useT()
  const { loggedIn, hydrate } = useAuthStore()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("project") || undefined
  const [payload, setPayload] = useState<GalaxyPayload | null>(null)
  const [litByConcept, setLitByConcept] = useState<Set<string>>(new Set())

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    let cancelled = false
    fetch("/galaxy/concept-galaxy.json")
      .then((r) => r.json())
      .then(async (p: GalaxyPayload) => {
        if (cancelled) return
        setPayload(p)
        if (loggedIn) {
          const lit = await fetchLitByConcept(p)
          if (!cancelled) setLitByConcept(lit)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [loggedIn])

  if (!payload) {
    return (
      <main className="page-wide">
        <div style={{ height: 560, display: "grid", placeItems: "center", color: "var(--sub)" }}>
          {t("galaxy.page.loading")}
        </div>
      </main>
    )
  }

  const uniSubjects = new Set(payload.concepts.map((c) => c.subj)).size
  const uniCount = payload.concepts.filter((c) => c.g === "university").length

  return (
    <main className="page-wide">
      <div className={styles.stage}>
        <div className={styles.brand}><span className={styles.fx}>✦</span> SYSTEMEDU · 全学科知识星图</div>
        <ConceptGalaxy payload={payload} litByConcept={litByConcept} initialProject={initialProject} loggedIn={loggedIn} />
        <div className={styles.leftcol}>
          <div className={styles.lede}>
            <h1>{t("galaxy.page.title_a")}<br />{t("galaxy.page.title_b")}<br />{t("galaxy.page.title_c")}</h1>
            <p className={styles.desc}>{t("galaxy.page.desc")}</p>
            <div className={styles.kpis}>
              <div className={styles.kpi}><div className={styles.n}>{payload.concepts.length}</div><div className={styles.l}>{t("galaxy.page.kpi_concepts")}</div></div>
              <div className={styles.kpi}><div className={styles.n}>{uniSubjects}</div><div className={styles.l}>{t("galaxy.page.kpi_subjects")}</div></div>
              <div className={styles.kpi}><div className={styles.n}>{uniCount}</div><div className={styles.l}>{t("galaxy.page.kpi_university")}</div></div>
            </div>
            {!loggedIn && <p className={styles.desc} style={{ marginTop: 10 }}>{t("galaxy.page.login_cta")}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: preview 起前端, 打开 /galaxy 看渲染**

用 preview_start "student-web", 然后 preview_eval 导航到 `/galaxy` (无需登录, 静态数据即可渲染):
```
window.location.href = "/galaxy"
```
preview_screenshot 确认: 深空底 + 445 彩点星云 + 左上标题/KPI + 学段带标签。preview_console_logs 确认无报错。

- [ ] **Step 4: 修 CSS module 类名缺失 (若 STYLE 里的 .fx/.desc/.n/.l 等没 export)**

若 preview 显示无样式 (类名 undefined), 检查 galaxy.module.css 是否包含 page.tsx 引用的所有类 (`.brand`/`.fx`/`.leftcol`/`.lede`/`.desc`/`.kpis`/`.kpi`/`.n`/`.l`)。补齐后重看。

- [ ] **Step 5: Commit**

```bash
cd ~/Dev/systemedu && git add "packages/student-web/src/app/(home)/galaxy/page.tsx" packages/student-web/src/lib/i18n/locales.ts && git commit -m "feat(galaxy): /galaxy 页面 + 数据加载 + i18n"
```

---

## Task 6: 交互 — 项目 chip 点亮 + 学科图例筛选

**Files:**
- Modify: `~/Dev/systemedu/packages/student-web/src/components/learning/ConceptGalaxy.tsx`
- Modify: `~/Dev/systemedu/packages/student-web/src/app/(home)/galaxy/page.tsx` (chip/legend 移入组件或页面)

决定: chip 栏 + 图例 + 卡片都放进 `ConceptGalaxy` 组件内 (它持有高亮状态), 页面只传 payload/lit/initialProject。把 Task 5 页面里的 leftcol chip/legend 挪进组件。

- [ ] **Step 1: 组件内加高亮状态 + 项目 chip**

在 ConceptGalaxy 内加 state 和逻辑 (移植 artifact SCRIPT 的 toggleProj/applyHi/clearHi):
```tsx
const [activeProj, setActiveProj] = useState<string | null>(initialProject ?? null)
const [activeSubj, setActiveSubj] = useState<string | null>(null)

// 当前应高亮的概念集合: 项目选中→该项目概念; 否则→我学过的
const highlightSet = useMemo(() => {
  if (activeSubj) return new Set(payload.concepts.filter((c) => c.subj === activeSubj).map((c) => c.id))
  if (activeProj) return new Set(payload.proj_concepts[activeProj] || [])
  return litByConcept
}, [activeProj, activeSubj, payload, litByConcept])

const dimOthers = !!activeProj || !!activeSubj
```
节点渲染改为按 `highlightSet` + `dimOthers` 调 opacity/r:
```tsx
const on = highlightSet.has(c.id)
const opacity = dimOthers ? (on ? 1 : 0.12) : (litByConcept.has(c.id) ? 1 : 0.85)
const rr = on && dimOthers ? r + 1.4 : r
```
边渲染: 两端都 `on` 时加亮 (`#a9c4ff` opacity 0.4), 否则暗。

- [ ] **Step 2: 渲染项目 chip 栏 (页面 leftcol 内, 从组件暴露回调 或 chip 放组件内)**

把 chip 栏 JSX 放进组件 (紧邻 SVG), 用 payload.projects:
```tsx
<div className={styles.projwrap}>
  <div className={styles.tag}>{t("galaxy.page.pick_project")}</div>
  <div className={styles.chips}>
    {payload.projects.map((p) => (
      <button
        key={p.slug}
        className={styles.chip}
        aria-pressed={activeProj === p.slug}
        onClick={() => { setActiveProj(activeProj === p.slug ? null : p.slug); setActiveSubj(null) }}
      >
        <span className={styles.dot} />{p.zh}
      </button>
    ))}
  </div>
</div>
```
(注: 需把 `useT` 引入组件。leftcol 布局: 组件返回 `<div className={styles.stageInner}>` 包 SVG + leftcol + chips + legend + card, 或页面保留 leftcol 壳、chip/legend 用 render prop。最简: 组件自己渲染完整 stage 内容, 页面只放 `<ConceptGalaxy .../>`。**采用后者**: 把 Task 5 页面 leftcol 整体搬进组件。)

- [ ] **Step 3: 学科图例 (点击筛选)**

```tsx
const subjCounts = useMemo(() => {
  const m: Record<string, number> = {}
  for (const c of payload.concepts) m[c.subj] = (m[c.subj] || 0) + 1
  return m
}, [payload.concepts])
const subjOrder = Object.keys(subjCounts).sort((a, b) => subjCounts[b] - subjCounts[a])
// ...
<div className={styles.legend}>
  <div className={styles.cap}>{t("galaxy.page.legend_cap")}</div>
  <div className={styles.lgrid}>
    {subjOrder.map((s) => (
      <button key={s} className={styles.lg} aria-pressed={activeSubj === s}
        onClick={() => setActiveSubj(activeSubj === s ? null : s)}>
        <span className={styles.sw} style={{ background: payload.subj_color[s], color: payload.subj_color[s] }} />
        <span className={styles.nm}>{payload.subj_zh[s] || s}</span>
        <span className={styles.ct}>{subjCounts[s]}</span>
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 4: preview 验证交互**

preview 打开 /galaxy → preview_click 第一个 `.chip` → screenshot 确认该项目概念高亮、其余压暗。preview_click 一个图例项 → 确认按学科筛选。console 无报错。

- [ ] **Step 5: Commit**

```bash
cd ~/Dev/systemedu && git add packages/student-web/src/components/learning/ConceptGalaxy.tsx "packages/student-web/src/app/(home)/galaxy/page.tsx" && git commit -m "feat(galaxy): 项目 chip 点亮 + 学科图例筛选"
```

---

## Task 7: 交互 — 节点点击 → 概念卡片

**Files:**
- Modify: `~/Dev/systemedu/packages/student-web/src/components/learning/ConceptGalaxy.tsx`

- [ ] **Step 1: 加选中态 + 卡片渲染 (移植 artifact card)**

```tsx
const [selId, setSelId] = useState<string | null>(null)
const sel = selId ? byId[selId] : null
// circle 加 onClick={() => setSelId(c.id)}
```
卡片 JSX (绝对定位 div, 覆盖在 stage 上):
```tsx
{sel && (
  <div className={styles.card + " " + styles.show}>
    <button className={styles.x} onClick={() => setSelId(null)} aria-label="关闭">×</button>
    <span className={styles.subj} style={{ background: (payload.subj_color[sel.subj]||"#888")+"20", color: payload.subj_color[sel.subj], border: `1px solid ${payload.subj_color[sel.subj]}55` }}>
      {payload.subj_zh[sel.subj] || sel.subj}
    </span>
    <h3>{sel.zh}</h3>
    <div className={styles.en}>{sel.en}</div>
    <div className={styles.kv}><b>{t("galaxy.card.grade")}</b><span>{gradeLabel(sel.g)} · {sel.t.toLowerCase()}</span></div>
    <div className={styles.kv}><b>{t("galaxy.card.used_by")}</b>
      <div className={styles.projwrp}>
        {sel.p.map((s) => { const pj = payload.projects.find((x) => x.slug === s); return <span key={s} className={styles.pchip}>{pj ? pj.zh : s}</span> })}
      </div>
    </div>
    {(() => {
      const mods = [...new Set((payload.covers[sel.id] || []).map((m) => m.slice(m.lastIndexOf(":")+1)))].slice(0, 12)
      return mods.length ? (
        <div className={styles.kv}><b>{t("galaxy.card.modules")}</b>
          <div className={styles.mods}>{mods.map((m) => <span key={m} className={styles.mc}>{m}</span>)}</div>
        </div>
      ) : null
    })()}
    <div className={styles.stub}>{t("galaxy.card.stub")}</div>
    {sel.q ? (
      <a className={styles.wd} href={`https://www.wikidata.org/wiki/${sel.q}`} target="_blank" rel="noopener">Wikidata ↗ {sel.q}</a>
    ) : (
      <a className={styles.wd + " " + styles.disabled} href="#" onClick={(e) => e.preventDefault()}>Wikidata ↗ {t("galaxy.card.wikidata_pending")}</a>
    )}
  </div>
)}
```
`gradeLabel` helper:
```tsx
function gradeLabel(g: string) {
  return { elementary: "小学", middle: "初中", high: "高中", university: "大学" }[g] || g
}
```
(注: gradeLabel 也应走 i18n — 加 `galaxy.grade.elementary` 等 4 个 key。为简, 本 task 先内联中文, 若要英文再抽 key。**决定: 抽 4 个 i18n key** `galaxy.grade.*`, gradeLabel 改用 `t()`。)

- [ ] **Step 2: preview 验证卡片**

preview 打开 /galaxy → 用 preview_eval 找最大节点 (data 里 p.length 最大) → preview_click 它 → screenshot 确认卡片显示 (学科/中英文/学段/用于哪些项目/课节/Wikidata QID)。点 × 关闭。点有 QID 的节点确认 Wikidata 链接 href 正确。

- [ ] **Step 3: 类型检查 + Commit**

```bash
cd ~/Dev/systemedu/packages/student-web && npx tsc --noEmit 2>&1 | grep ConceptGalaxy || echo "no type errors"
cd ~/Dev/systemedu && git add packages/student-web/src/components/learning/ConceptGalaxy.tsx packages/student-web/src/lib/i18n/locales.ts && git commit -m "feat(galaxy): 节点点击弹概念卡片 (学段/项目/课节/Wikidata)"
```

---

## Task 8: 首页卡片入口

**Files:**
- Modify: `~/Dev/systemedu/packages/student-web/src/app/(home)/home/page.tsx`

- [ ] **Step 1: 首页卡片网格加"知识星图"入口卡**

现有网格是 `gridTemplateColumns: "repeat(4, 1fr)"` 放了 2 个 StatCard + 2 个 Link 卡 (badges/brain), 共 4 格已满。方案: 网格改 5 列或另起一行。最简: 在 brain 卡后加一张 galaxy 卡, 网格改 `repeat(5, 1fr)` (若太挤则维持 4 列, galaxy 卡换行)。加 import `Sparkles`/`Orbit` icon 和卡片 (仿 brain-card):
```tsx
<Link href="/galaxy" style={{ /* 同 brain 卡 style */ }} className="brain-card">
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--sub)", fontSize: 12.5, marginBottom: 8 }}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <Orbit size={15} strokeWidth={1.5} /> {t("galaxy.nav")}
    </span>
    <ArrowUpRight size={15} strokeWidth={1.6} style={{ color: "var(--sub-2)" }} />
  </div>
  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>445</div>
  <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--sub-2)" }}>{t("galaxy.page.kpi_concepts")}</div>
</Link>
```
(icon `Orbit` 已在 lucide 用过——见 KnowledgeTreeView。确认 import。网格列数: 改成 5 列。)

- [ ] **Step 2: preview 验证首页入口**

preview 打开 `/home` (需登录; 若未登录先走 login 或直接看组件是否渲染)。screenshot 确认多了一张"知识星图 · 445"卡片。preview_click 它 → 确认跳 /galaxy。

- [ ] **Step 3: Commit**

```bash
cd ~/Dev/systemedu && git add "packages/student-web/src/app/(home)/home/page.tsx" && git commit -m "feat(galaxy): 首页知识星图入口卡"
```

---

## Task 9: 改指向 — /brain 知识 tab + 库详情弹窗

**Files:**
- Modify: `~/Dev/systemedu/packages/student-web/src/app/(home)/brain/page.tsx`
- Modify: `~/Dev/systemedu/packages/student-web/src/app/(home)/library/[slug]/page.tsx`

- [ ] **Step 1: /brain 知识 tab 换成引导卡跳 /galaxy**

brain/page.tsx 里 `{activeTab === "knowledge" && <UserKnowledgeTreeView />}` 改为引导卡:
```tsx
{activeTab === "knowledge" && (
  <div className="card-elevated" style={{ padding: 40, textAlign: "center" }}>
    <Network size={36} strokeWidth={1.5} style={{ color: "var(--primary)", margin: "0 auto 14px" }} />
    <p className="body" style={{ color: "var(--ink)", marginBottom: 6 }}>{t("galaxy.nav")}</p>
    <p className="sub" style={{ marginBottom: 18 }}>{t("galaxy.page.desc")}</p>
    <Link href="/galaxy" className="btn btn-primary">{t("galaxy.nav")} →</Link>
  </div>
)}
```
(保留 import `UserKnowledgeTreeView` 与否: 不再使用则删该 import 避免 lint warning; 组件文件本身保留不删。`Network` icon 已在 brain 页 import。)

- [ ] **Step 2: 库详情"打开知识树"改跳 /galaxy?project=slug**

library/[slug]/page.tsx: 找到 `setTreeOpen(true)` 的按钮 (line ~527 附近 `open_knowledge_tree`), 改为 `router.push(\`/galaxy?project=${encodeURIComponent(slug)}\`)`。确认已 import `useRouter` (页面应已有)。删掉 `{treeOpen && <KnowledgeTreeModal .../>}` 块 (line ~671) 及 `treeOpen` state 与 `KnowledgeTreeModal` import (组件文件保留不删)。

- [ ] **Step 3: preview 验证两处改指向**

- preview 打开 `/brain`, 点"知识"tab → 确认显示引导卡, 点按钮跳 /galaxy。
- preview 打开某项目库详情 `/library/stirling-thermal-controller`, 点"打开知识树"→ 确认跳 `/galaxy?project=stirling-thermal-controller` 且进去 stirling 概念**默认高亮** (initialProject 生效)。

- [ ] **Step 4: 类型检查 + lint + Commit**

```bash
cd ~/Dev/systemedu/packages/student-web && npx tsc --noEmit 2>&1 | grep -E "brain|library" || echo "no type errors"
cd ~/Dev/systemedu && git add "packages/student-web/src/app/(home)/brain/page.tsx" "packages/student-web/src/app/(home)/library/[slug]/page.tsx" && git commit -m "feat(galaxy): /brain 知识 tab + 库详情弹窗改指向新星图"
```

---

## Task 10: 端到端验证 + 回归 + 登录态个人点亮

**Files:** (无新文件, 纯验证)

- [ ] **Step 1: 起全栈 preview (前端+两个后端), 造登录态验证个人点亮**

preview_start "library-app" + "student-backend" + "student-web"。登录一个有学习进度的测试账号 (或用 preview 走 register/login + 完成几个 knode)。打开 /galaxy → 确认**我学过的概念默认发亮** (litByConcept 生效, 非空)。若无测试进度, 至少确认登录后 `fetchLitByConcept` 无报错 (console)、网络请求 `/api/my/projects` + `/api/my/knodes/*/complete-status` 有返回 (preview_network)。

- [ ] **Step 2: 未登录态验证 (退化探索模式)**

preview 清 token (preview_eval `localStorage.clear()`) → 打开 /galaxy → 确认星图正常显示 (全暗默认态)、点项目 chip 点亮、点节点弹卡片、顶部显示"登录后看你点亮了多少"。

- [ ] **Step 2b: `?project=` 深链验证**

preview 打开 `/galaxy?project=emg-prosthetic-hand` → 确认进去 emg 概念默认高亮。

- [ ] **Step 3: 回归 — 确认无残留入口引用旧组件**

Run:
```bash
cd ~/Dev/systemedu/packages/student-web && grep -rn "UserKnowledgeTreeView\|KnowledgeTreeModal" src/app 2>/dev/null
```
Expected: 无输出 (brain/library 已不再引用; 组件文件本身保留但无入口)。若有残留引用, 清理。

- [ ] **Step 4: 全量 tsc + build 冒烟**

Run:
```bash
cd ~/Dev/systemedu/packages/student-web && npx tsc --noEmit && echo "tsc OK"
```
Expected: `tsc OK` (无类型错误)。

- [ ] **Step 5: 最终 preview 截图存档 + Commit (若有清理)**

preview_screenshot 三态 (默认/项目高亮/概念卡片) 存档给用户看。若 Step 3 有清理改动则:
```bash
cd ~/Dev/systemedu && git add -A && git commit -m "chore(galaxy): 清理旧组件残留入口引用 + 端到端验证"
```

---

## 完成标准

- [ ] `/galaxy` 页可访问, 445 概念星云 + 学段带 + 左侧标题/KPI/项目 chip/学科图例。
- [ ] 点项目 chip → 该项目概念高亮、其余压暗; 再点取消。
- [ ] 点学科图例 → 按学科筛选。
- [ ] 点节点 → 概念卡片 (学科/中英文/学段/用于哪些项目/课节 M##/Wikidata 链接)。
- [ ] 登录且有进度 → 我学过的概念默认发亮。
- [ ] 未登录 → 退化探索模式, 有登录引导。
- [ ] `/galaxy?project=<slug>` → 预选高亮该项目。
- [ ] 首页有"知识星图"入口卡; /brain 知识 tab 跳新星图; 库详情"打开知识树"跳 /galaxy?project=。
- [ ] 旧组件 (KnowledgeGalaxy3D/KnowledgeTreeView/UserKnowledgeTreeView/KnowledgeTreeModal) 代码保留、无入口引用。
- [ ] tsc 无类型错误。
