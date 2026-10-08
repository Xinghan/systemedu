import pool from "./data/diversity-pool.json"

export const DIVERSITY_POOL = pool
export type DiversityRow = typeof pool.rows[number]
export type DiversityOptions = { count: number; maxSimilarity: number; uniqueScaffold: boolean }
export const DEFAULT_DIVERSITY: DiversityOptions = { count: 10, maxSimilarity: 1, uniqueScaffold: false }
export function tanimoto(a: number[], b: number[]) {
  const x = new Set(a), y = new Set(b)
  const common = [...x].filter(n => y.has(n)).length
  const union = x.size + y.size - common
  return union ? common / union : 1 // explicit empty/empty convention
}
export function similarity(a: string, b: string) {
  const x = pool.rows.find(r => r.id === a), y = pool.rows.find(r => r.id === b)
  if (!x || !y) throw new Error("Unknown structure ID")
  return tanimoto(x.bits, y.bits)
}
export function nextDiversityCandidates(selected: string[], options: DiversityOptions) {
  if (new Set(selected).size !== selected.length || selected.some(id => !pool.rows.some(r => r.id === id))) throw new Error("Invalid selected IDs")
  const families = new Set(selected.map(id => pool.rows.find(r => r.id === id)!.scaffold))
  return pool.rows.filter(r => !selected.includes(r.id)).map(row => {
    const nearest = selected.map(id => ({ id, t: similarity(row.id, id) })).sort((a,b) => b.t-a.t || a.id.localeCompare(b.id))[0]
    const maxT = nearest?.t ?? 0
    const eligible = maxT <= options.maxSimilarity && (!options.uniqueScaffold || !families.has(row.scaffold))
    return { ...row, maxT, minDistance: 1-maxT, nearestId: nearest?.id ?? null, eligible }
  }).sort((a,b) => b.minDistance-a.minDistance || b.score-a.score || a.id.localeCompare(b.id))
}
export function pickDiverse(options: DiversityOptions = DEFAULT_DIVERSITY) {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > pool.rows.length || !Number.isFinite(options.maxSimilarity) || options.maxSimilarity < 0 || options.maxSimilarity > 1) throw new Error("Invalid diversity controls")
  const seed = [...pool.rows].sort((a,b) => b.score-a.score || a.id.localeCompare(b.id))[0]
  const selected = [seed.id]
  const trace: { chosen: string; maxT: number | null; nearestId: string | null; candidates: ReturnType<typeof nextDiversityCandidates> }[] = [{ chosen: seed.id, maxT: null, nearestId: null, candidates: [] }]
  while (selected.length < options.count) {
    const candidates = nextDiversityCandidates(selected, options), next = candidates.find(r => r.eligible)
    if (!next) break
    selected.push(next.id); trace.push({ chosen: next.id, maxT: next.maxT, nearestId: next.nearestId, candidates })
  }
  return { options, selected, trace, complete: selected.length === options.count, requested: options.count }
}
export function diversitySummary(ids: string[]) {
  const rows = ids.map(id => pool.rows.find(r => r.id === id)!)
  if (rows.some(r => !r)) throw new Error("Unknown ID")
  const values = rows.flatMap((a,i) => rows.slice(i+1).map(b => similarity(a.id,b.id)))
  return { count: rows.length, scaffolds: new Set(rows.map(r => r.scaffold)).size, meanScore: rows.length ? rows.reduce((s,r) => s+r.score,0)/rows.length : 0, maxPairT: values.length ? Math.max(...values) : null }
}
export function diversityEvidence(options: DiversityOptions, reason: string) {
  const result = pickDiverse(options), baseline = pool.rows.slice(0, options.count).map(r => r.id)
  return { module: "M45", version: pool.version, provenance: pool.provenance, rdkit: pool.rdkit, fingerprint: pool.fingerprint,
    input: pool.rows.map(r => ({ id:r.id, name:r.name, smiles:r.smiles, scaffold:r.scaffold, bits:r.bits, score:r.score })), baseline, baselineSummary: diversitySummary(baseline),
    ...result, selectedSummary: diversitySummary(result.selected), learnerReason: reason,
    policy: "Highest-score seed; maximize minimum Tanimoto distance; ties score descending then ID. Similarity limit and unique scaffold are explicit additional constraints. Infeasible requests return fewer rows; no global optimum or biological guarantee." }
}
