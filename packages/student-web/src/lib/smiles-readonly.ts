import type { RDKitModule } from '@rdkit/rdkit'
import { analyzeSmiles, phenolTrace, type SmilesResult } from './smiles-reading'
import reference from './data/m05-readonly-reference.json'

export type ReadonlySmilesRow = ({ parsed: true } & Omit<SmilesResult, 'svg'>) | { parsed: false; input: string }
export type SmilesEvidence = Record<string, ReadonlySmilesRow>
export const SMILES_REFERENCE = reference.examples as SmilesEvidence
export const SMILES_REFERENCE_VERSION = reference.rdkit_version
export const SMILES_TRACE = Array.from({length:10},(_,i)=>({step:i,...phenolTrace(i)}))
export const SYNTAX_PAIRS = [
  { label:'双键 =', before:'CC', after:'C=C', claim:'碳数不变；键级提高，氢数从 6 变 4。' },
  { label:'分支 ( )', before:'CCCC', after:'CC(C)C', claim:'碳数和分子式相同，支链改变邻接关系。' },
  { label:'环标记 1', before:'CCCCCC', after:'C1CCCCC1', claim:'两个 1 配对闭合一条键，不增加碳。' },
  { label:'芳香小写 c', before:'C1CCCCC1', after:'c1ccccc1', claim:'苯与环己烷不同；H 从 12 变 6，芳香环从 0 变 1。' },
] as const
export function computeSmilesEvidence(rdkit:RDKitModule):SmilesEvidence {
  return Object.fromEntries(Object.keys(SMILES_REFERENCE).map(input=>{
    try { const r=analyzeSmiles(rdkit,input); return [input,{parsed:true,input:r.input,canonical:r.canonical,atoms:r.atoms,heavy:r.heavy,hydrogens:r.hydrogens,bonds:r.bonds,rings:r.rings,aromaticRings:r.aromaticRings,mw:r.mw}] }
    catch { return [input,{parsed:false,input}] }
  }))
}
export function sameSmilesEvidence(actual:SmilesEvidence) {
  const keys=Object.keys(SMILES_REFERENCE)
  return Object.keys(actual).length===keys.length && keys.every(k=>{
    const a=actual[k],b=SMILES_REFERENCE[k]
    if(!a||a.parsed!==b.parsed||a.input!==b.input)return false
    if(!a.parsed||!b.parsed)return true
    return a.canonical===b.canonical && (['heavy','hydrogens','bonds','rings','aromaticRings','mw'] as const).every(key=>{
      const x=a[key],y=b[key];return Number.isFinite(x)&&Math.abs(x-y)<1e-4
    }) && JSON.stringify(a.atoms)===JSON.stringify(b.atoms)
  })
}
export function validSmilesRow(rows:SmilesEvidence,input:string){const r=rows[input];if(!r?.parsed)throw Error('Expected registered valid teaching input');return r}
