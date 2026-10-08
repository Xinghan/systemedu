import { FUNNEL_SEED, makeCandidates, runFunnel } from "./funnel-evidence"

export type FourScores = [number, number, number, number]
export type RankingRow = { id: string; risk: number; activity: number; solubility: number; lip: number }
export type Range = { min: number; max: number }
export const SCORE_LABELS = ["低风险偏好", "活性指标", "溶解指标", "性质初筛"] as const
export const DEFAULT_WEIGHTS: FourScores = [5, 2, 2, 1]
export const ACTIVITY_WEIGHTS: FourScores = [2, 6, 1, 1]
export const RANKING_DATA_NOTE = `接续 M43：seed ${FUNNEL_SEED} 的 5000 行合成数据，经原四道硬规则筛选。风险与 logS 沿用原行；活性指标由 ID 的固定散列生成；性质初筛均为 1。全部为教学构造值，非真实分子、RDKit 活性或实验结果。`

export function scaleValue(value: number, range: Range, lowerIsBetter: boolean) {
  if (![value, range.min, range.max].every(Number.isFinite) || range.max < range.min) throw new Error("Invalid normalization data")
  // An equal-valued numeric column has no discriminatory information. This is
  // an explicit course convention, not the library's implicit constant policy.
  if (range.max === range.min) {
    if (value !== range.min) throw new Error("Value outside constant reference range")
    return 0
  }
  const z = (value - range.min) / (range.max - range.min)
  return lowerIsBetter ? 1 - z : z
}

export function normalizeWeights(raw: number[]): FourScores {
  if (raw.length !== 4 || raw.some(x => !Number.isFinite(x) || x < 0)) throw new Error("权重必须是四个有限的非负数")
  const sum = raw.reduce((a, b) => a + b, 0)
  if (!Number.isFinite(sum) || sum <= 0) throw new Error("至少一个权重必须大于 0")
  return raw.map(x => x / sum) as FourScores
}

export function weightedScore(values: FourScores, weights: FourScores) {
  if (values.some(x => !Number.isFinite(x))) throw new Error("Invalid normalized score")
  const w = normalizeWeights(weights)
  return values.reduce((sum, value, i) => sum + value * w[i], 0)
}

export function makeRankingRows(): RankingRow[] {
  return runFunnel(makeCandidates()).survivors.map(row => {
    const idNumber = Number(row.id.slice(1))
    const hash = Math.imul(idNumber ^ 8701, 2654435761) >>> 0
    return { id: row.id, risk: row.toxScore, activity: Math.round(hash / 4294967296 * 1000) / 1000, solubility: row.logS, lip: 1 }
  })
}

export function rankCandidates(rows: RankingRow[], rawWeights: number[]) {
  const weights = normalizeWeights(rawWeights)
  if (new Set(rows.map(r => r.id)).size !== rows.length || rows.some(r => !r.id || [r.risk, r.activity, r.solubility, r.lip].some(x => !Number.isFinite(x)) || ![0, 1].includes(r.lip))) throw new Error("候选字段缺失、无效或 ID 重复")
  const range = (key: "risk" | "activity" | "solubility"): Range => rows.length
    ? { min: Math.min(...rows.map(r => r[key])), max: Math.max(...rows.map(r => r[key])) } : { min: 0, max: 0 }
  const ranges = { risk: range("risk"), activity: range("activity"), solubility: range("solubility") }
  const scored = rows.map(row => {
    const normalized: FourScores = [scaleValue(row.risk, ranges.risk, true), scaleValue(row.activity, ranges.activity, false), scaleValue(row.solubility, ranges.solubility, false), row.lip]
    const contributions = normalized.map((v, i) => v * weights[i]) as FourScores
    return { ...row, normalized, contributions, total: contributions.reduce((a, b) => a + b, 0) }
  })
  const ranked = [...scored].sort((a, b) => b.total - a.total || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((r, i) => ({ ...r, rank: i + 1 }))
  return { weights, ranges, ranked, scored }
}
export type RankingResult = ReturnType<typeof rankCandidates>
export type RankedRow = RankingResult["ranked"][number]

export function unitComparison(multiplier: number) {
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error("Invalid unit multiplier")
  // Independent illustrative example, not the M86 survivor dataset.
  const rows: RankingRow[] = [
    { id: "A", risk: .1, activity: .9, solubility: 10 * multiplier, lip: 1 },
    { id: "B", risk: .5, activity: .6, solubility: 30 * multiplier, lip: 1 },
    { id: "C", risk: .9, activity: .2, solubility: 50 * multiplier, lip: 1 },
  ]
  const weights = normalizeWeights(DEFAULT_WEIGHTS)
  const naive = rows.map(row => ({ id: row.id, total: (1 - row.risk) * weights[0] + row.activity * weights[1] + row.solubility * weights[2] + row.lip * weights[3] })).sort((a, b) => b.total - a.total)
  return { rows, naive, correct: rankCandidates(rows, DEFAULT_WEIGHTS) }
}

export function rankingEvidence(rawWeights: FourScores) {
  const rows = makeRankingRows(), result = rankCandidates(rows, rawWeights)
  return { module: "M44", version: "ranking-v1", dataset: RANKING_DATA_NOTE, inputRows: rows,
    rawWeights, normalizedWeights: result.weights, ranges: result.ranges,
    policies: { numericConstantColumn: "zero contribution; no discrimination", binaryLip: "preserved as 0/1, not min-max", ties: "unrounded total descending, then ID ascending", missingValues: "reject, never silently replace", hardFilters: "M43 defaults; rejected IDs cannot return" },
    fullRanking: result.ranked, top10: result.ranked.slice(0, 10),
    handoff: "M45 still needs real validated structures/fingerprints; synthetic IDs cannot establish molecular diversity.",
    limitation: "A priority under chosen teaching rules, not a probability, measured safety or efficacy." }
}
