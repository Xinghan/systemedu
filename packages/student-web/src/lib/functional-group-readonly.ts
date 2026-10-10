/** Fixed, independently checked teaching references; never learner records. */
export const GROUP_REFERENCES = [
  { smiles: 'CC', name: '乙烷', formula: 'C2H6', carbons: 2, group: '无 OH / NH₂', logP: 1.0262, mw: 30.070 },
  { smiles: 'CCO', name: '乙醇', formula: 'C2H6O', carbons: 2, group: '羟基 OH', logP: -0.0014, mw: 46.069 },
  { smiles: 'CCN', name: '乙胺（中性）', formula: 'C2H7N', carbons: 2, group: '氨基 NH₂', logP: -0.03499, mw: 45.08499 },
  { smiles: 'CCCO', name: '1-丙醇', formula: 'C3H8O', carbons: 3, group: '羟基 OH', logP: 0.3887, mw: 60.096 },
] as const
export type GroupValue = { smiles: string; logP: number; mw: number }
export const GROUP_TRACE = [
  { title: '准备两个独立结构', code: 'inputs = ["CC", "CCO"]', result: '先定义基线与比较项；尚未相减。' },
  { title: '计算基线 CC', code: 'before = Crippen.MolLogP(Chem.MolFromSmiles("CC"))', result: '基线 cLogP = 1.0262' },
  { title: '计算比较项 CCO', code: 'after = Crippen.MolLogP(Chem.MolFromSmiles("CCO"))', result: '比较项 cLogP = -0.0014' },
  { title: '计算后值减前值', code: 'delta = after - before', result: 'Δ cLogP = -1.0276（无量纲）' },
] as const
export function groupReferenceMatches(rows: GroupValue[]) {
  return rows.length === GROUP_REFERENCES.length && rows.every((r, i) =>
    r.smiles === GROUP_REFERENCES[i].smiles && Number.isFinite(r.logP) && Number.isFinite(r.mw) &&
    Math.abs(r.logP - GROUP_REFERENCES[i].logP) < 0.0001 && Math.abs(r.mw - GROUP_REFERENCES[i].mw) < 0.0001)
}
