// Ported from ~/Dev/systemdighuman/packages/shared/src/visemes.ts
// Closed canonical viseme set used by both server and client.
export const VISEMES = [
  "SIL",
  "PP",
  "FF",
  "TH",
  "DD",
  "KK",
  "CH",
  "SS",
  "NN",
  "RR",
  "AA",
  "E",
  "IH",
  "OH",
  "UH",
  "UEH",
] as const

export type VisemeId = (typeof VISEMES)[number]
export const VISEME_SET: ReadonlySet<VisemeId> = new Set(VISEMES)

export function isVisemeId(v: string): v is VisemeId {
  return VISEME_SET.has(v as VisemeId)
}

export interface VisemeFrame {
  t_ms: number
  viseme: VisemeId
  weight: number
}
