/** Neutral dilute solute, two phases at equilibrium; not a kinetic solver. */
export function partitionState(logP: number, organicMl = 10, waterMl = 10, totalUmol = 10) {
  if (![logP, organicMl, waterMl, totalUmol].every(Number.isFinite) || Math.abs(logP) > 8 || organicMl <= 0 || waterMl <= 0 || totalUmol <= 0) throw new RangeError('Invalid partition inputs')
  const p = 10 ** logP
  const waterUmol = totalUmol / (1 + p * organicMl / waterMl)
  const organicUmol = totalUmol - waterUmol
  return { logP, p, organicMl, waterMl, totalUmol, waterUmol, organicUmol,
    waterMm: waterUmol / waterMl, organicMm: organicUmol / organicMl,
    organicFraction: organicUmol / totalUmol }
}
export const LOGP_SAMPLES = [
  { id: 'octane', name: '正辛烷', smiles: 'CCCCCCCC', formula: 'C8H18', mw: 114.232, logP: 3.3668 },
  { id: 'ethanol', name: '乙醇', smiles: 'CCO', formula: 'C2H6O', mw: 46.069, logP: -0.0014 },
  { id: 'glucose', name: '葡萄糖（环式连接示例）', smiles: 'OCC1OC(O)C(O)C(O)C1O', formula: 'C6H12O6', mw: 180.156, logP: -3.2214 },
] as const
export const LOGP_DATA_NOTE = '三个课文示例的 RDKit Crippen cLogP 计算值，不是实测值或课程全库；葡萄糖示例未指定立体化学，仅用于连接与描述符比较。'
export function logpHistogram(values: readonly number[]) {
  return [-4, -2, 0, 2].map((min, i) => ({ min, max: min + 2, count: values.filter(v => v >= min && (i === 3 ? v <= min + 2 : v < min + 2)).length }))
}
export function logpEvidence() {
  return { project: 'molecule-monster-hunter', module: 'M18', source: 'RDKit.js 2025.3.4-1.0.0 CrippenClogP', measured: false, sampleCount: LOGP_SAMPLES.length, note: LOGP_DATA_NOTE, rows: LOGP_SAMPLES, histogram: logpHistogram(LOGP_SAMPLES.map(x => x.logP)) }
}
