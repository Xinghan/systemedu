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
