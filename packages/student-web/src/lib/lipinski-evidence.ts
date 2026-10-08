export type DescriptorKey = "mw" | "logp" | "hbd" | "hba"
export type LipinskiRow = { id: string; name: string; mw: number; logp: number; hbd: number; hba: number; smiles?: string; source_url?: string }
export type LipinskiLimits = Record<DescriptorKey, number>
export const DESCRIPTOR_KEYS: DescriptorKey[] = ["mw", "logp", "hbd", "hba"]
export const DEFAULT_LIMITS: LipinskiLimits = { mw: 500, logp: 5, hbd: 5, hba: 10 }

export function screenMolecule(row: LipinskiRow, limits: LipinskiLimits, allowed: number) {
  if (!Number.isInteger(allowed) || allowed < 0 || allowed > 4 || DESCRIPTOR_KEYS.some(k => !Number.isFinite(row[k]) || !Number.isFinite(limits[k])) || row.mw <= 0 || !Number.isInteger(row.hbd) || !Number.isInteger(row.hba) || row.hbd < 0 || row.hba < 0) throw new Error("Missing or invalid screening inputs.")
  const failures = DESCRIPTOR_KEYS.filter(k => row[k] > limits[k])
  return { ...row, failures, violations: failures.length, pass: failures.length <= allowed }
}

export function screenLibrary(rows: LipinskiRow[], limits: LipinskiLimits, allowed: number) {
  if (!rows.length || new Set(rows.map(r => r.id)).size !== rows.length) throw new Error("A nonempty, uniquely identified library is required.")
  const results = rows.map(row => screenMolecule(row, limits, allowed))
  const passed = results.filter(r => r.pass).length
  const singleCounts = Object.fromEntries(DESCRIPTOR_KEYS.map(k => [k, results.filter(r => !r.failures.includes(k)).length])) as Record<DescriptorKey, number>
  return { results, passed, total: rows.length, rate: passed / rows.length, singleCounts }
}
