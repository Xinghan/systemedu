export type RocRow = { id: string; label: number; score: number }
export type RocPoint = { threshold: number; tp: number; fp: number; tn: number; fn: number; tpr: number; fpr: number }

function validate(rows: RocRow[]) {
  if (!rows.length || new Set(rows.map(r => r.id)).size !== rows.length) throw new Error("ROC needs nonempty, uniquely identified rows.")
  if (rows.some(r => !r.id || !Number.isFinite(r.score) || ![0, 1].includes(r.label))) throw new Error("ROC needs finite scores and binary labels.")
  if (new Set(rows.map(r => r.label)).size !== 2) throw new Error("ROC is undefined without both classes.")
}

/** score >= threshold; Infinity intentionally represents the all-negative endpoint. */
export function atThreshold(rows: RocRow[], threshold: number): RocPoint {
  validate(rows)
  if (Number.isNaN(threshold)) throw new Error("Invalid threshold.")
  let tp = 0, fp = 0, tn = 0, fn = 0
  rows.forEach(r => { if (r.score >= threshold) { if (r.label === 1) tp++; else fp++ } else if (r.label === 1) fn++; else tn++ })
  return { threshold, tp, fp, tn, fn, tpr: tp / (tp + fn), fpr: fp / (fp + tn) }
}

export function rocPoints(rows: RocRow[]): RocPoint[] {
  validate(rows)
  return [Infinity, ...[...new Set(rows.map(r => r.score))].sort((a, b) => b - a)].map(t => atThreshold(rows, t))
}

export function rocArea(points: Array<{ fpr: number; tpr: number }>) {
  if (points.length < 2 || points.some(p => !Number.isFinite(p.fpr) || !Number.isFinite(p.tpr) || p.fpr < 0 || p.fpr > 1 || p.tpr < 0 || p.tpr > 1)) throw new Error("Invalid ROC coordinates.")
  return points.slice(1).reduce((sum, p, i) => {
    const q = points[i]
    if (p.fpr < q.fpr || p.tpr < q.tpr) throw new Error("ROC coordinates must be nondecreasing.")
    return sum + (p.fpr - q.fpr) * (p.tpr + q.tpr) / 2
  }, 0)
}

/** Independent check: proportion of correctly ordered positive-negative pairs, ties = 1/2. */
export function rankingAuc(rows: RocRow[]) {
  validate(rows)
  const positive = rows.filter(r => r.label === 1), negative = rows.filter(r => r.label === 0)
  return positive.reduce((sum, p) => sum + negative.reduce((s, n) => s + (p.score > n.score ? 1 : p.score === n.score ? .5 : 0), 0), 0) / (positive.length * negative.length)
}
