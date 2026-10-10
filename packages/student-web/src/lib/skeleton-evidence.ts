import { MOLECULES, moleculeCounts } from './molecule-skeleton'
import { parseRuntimeOutput, type RuntimeEvidence } from './rdkit-runtime'

export const OBSERVATION_KEY='systemedu:molecule:M03:observations:v2'
export const SKELETON_RUN_KEY='systemedu:molecule:M03:python-run:v2'
export type CountAnswers={heavy:string;atoms:string;bonds:string;rings:string}
export type Observation={id:string;answers:CountAnswers;note:string;source:'learner-structure-inspection';geometrySha256:string}
export type Observations=Record<string,Observation>
type Result<T>={row:T|null;problem:string}
export function checkObservation(id:string,answers:CountAnswers,note:string):Result<Observation>{
 const m=MOLECULES.find(r=>r.id===id)
 if(!m)return {row:null,problem:'请选择本节的分子。'}
 const counts=moleculeCounts(m)
 for(const key of ['heavy','atoms','bonds','rings'] as const){
  if(typeof answers?.[key]!=='string'||!/^\d+$/.test(answers[key])||Number(answers[key])!==counts[key])return {row:null,problem:'计数尚不一致。完整分子要包含氢；两原子之间的双键仍是一条连接。请逐项核对。'}
 }
 if(typeof note!=='string'||note.trim().length<8||note.trim().length>240)return {row:null,problem:'请用 8–240 字写下一条自己的读图发现，例如区分显示数和总数，不只写“完成”。'}
 return {row:{id,answers:{...answers},note:note.trim(),source:'learner-structure-inspection',geometrySha256:m.sdfSha256},problem:''}
}
export function observationEnvelope(rows:Observations){return {schema:'m03-observations-v2',rows}}
export function restoreObservations(raw:string|null):Observations{
 if(!raw||raw.length>16000)return {}
 try{const data=JSON.parse(raw);if(data?.schema!=='m03-observations-v2'||!data.rows||Array.isArray(data.rows))return {};const out:Observations={};for(const m of MOLECULES){const r=data.rows[m.id];if(!r||r.id!==m.id||r.source!=='learner-structure-inspection'||r.geometrySha256!==m.sdfSha256)continue;const checked=checkObservation(r.id,r.answers,r.note);if(checked.row)out[m.id]=checked.row}return out}catch{return {}}
}
type SkeletonRow={id:string;smiles:string;atoms:number;bonds:number;hydrogens:number;heavy:number;rings:number;aromaticRings:number;massDa:number}
export type SkeletonRun={schema:'m03-python-run-v2';source:'learner-reported-python';independentlyVerified:false;python:string;executable:string;rdkit:string;rows:SkeletonRow[]}
export function parseSkeletonOutput(raw:string,confirmed:boolean):{evidence:SkeletonRun|null;problem:string}{
 const fail=(problem:string)=>({evidence:null,problem})
 if(!raw.trim())return fail('先运行模板，再粘贴你实际得到的 JSON。')
 if(raw.length>16000)return fail('仅粘贴四个分子的 JSON 输出，不要粘贴完整终端历史。')
 let o:Record<string,unknown>;try{o=JSON.parse(raw);if(!o||typeof o!=='object'||Array.isArray(o))throw Error()}catch{return fail('不是有效 JSON，请复制脚本的完整输出。')}
 const runtime=parseRuntimeOutput(JSON.stringify({python:o.python,executable:o.executable,rdkit:o.rdkit}),confirmed)
 if(!runtime.evidence)return fail(runtime.problem)
 if(!Array.isArray(o.rows)||o.rows.length!==4)return fail('输出需要包含水、甲烷、乙醇、苯四条记录。')
 const rows:SkeletonRow[]=[]
 for(const m of MOLECULES){
  const matches=o.rows.filter((r:SkeletonRow)=>r?.id===m.id)
  if(matches.length!==1)return fail(`${m.name} 记录缺失或重复。请使用完整模板。`)
  const row=matches[0],counts=moleculeCounts(m)
  if(row.smiles!==m.smiles)return fail(`${m.name} 的 SMILES 与本节固定输入不一致。`)
  for(const [key,value] of Object.entries(counts))if(!Number.isInteger(row[key])||row[key]!==value)return fail(`${m.name} 的 ${key} 不一致。检查是否对完整分子显式加氢，并按模板字段输出。`)
  if(typeof row.massDa!=='number'||!Number.isFinite(row.massDa)||Math.abs(row.massDa-m.mw)>.002)return fail(`${m.name} 的质量与平均分子质量口径不一致。请检查 MolWt，而不是精确同位素质量。`)
  rows.push({id:m.id,smiles:m.smiles,...counts,massDa:row.massDa})
 }
 const r=runtime.evidence
 return {evidence:{schema:'m03-python-run-v2',source:'learner-reported-python',independentlyVerified:false,python:r.python,executable:r.executable,rdkit:r.rdkit,rows},problem:''}
}
export function restoreSkeletonRun(raw:string|null){if(!raw)return null;try{const o=JSON.parse(raw);if(o?.schema!=='m03-python-run-v2'||o.source!=='learner-reported-python'||o.independentlyVerified!==false)return null;return parseSkeletonOutput(raw,true).evidence}catch{return null}}
export function compareRuntime(previous:Pick<RuntimeEvidence,'python'|'rdkit'|'executable'>|null,current:Pick<SkeletonRun,'python'|'rdkit'|'executable'>|null){
 if(!previous||!current)return 'missing'
 return ['python','rdkit','executable'].every(key=>previous[key as keyof typeof previous]===current[key as keyof typeof current])?'same':'different'
}
export const SKELETON_SCRIPT=`import sys
import json
import rdkit
from rdkit import Chem
from rdkit.Chem import Descriptors, rdMolDescriptors

inputs = [
${MOLECULES.map(m=>`    (${JSON.stringify(m.id)}, ${JSON.stringify(m.smiles)}),`).join('\n')}
]
rows = []
for molecule_id, smiles in inputs:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError("Cannot parse: " + smiles)
    with_h = Chem.AddHs(mol)
    rows.append({
        "id": molecule_id,
        "smiles": smiles,
        "heavy": mol.GetNumHeavyAtoms(),
        "atoms": with_h.GetNumAtoms(),
        "hydrogens": sum(a.GetAtomicNum() == 1 for a in with_h.GetAtoms()),
        "bonds": with_h.GetNumBonds(),
        "rings": rdMolDescriptors.CalcNumRings(mol),
        "aromaticRings": rdMolDescriptors.CalcNumAromaticRings(mol),
        "massDa": round(Descriptors.MolWt(mol), 3),
    })
print(json.dumps({
    "python": sys.version.split()[0],
    "executable": sys.executable,
    "rdkit": rdkit.__version__,
    "rows": rows,
}, ensure_ascii=False, indent=2))
`
