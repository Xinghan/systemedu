export const GROUP_CHOICES=[{smiles:'CCO',name:'乙醇',change:'H → OH，保留两碳骨架'},{smiles:'CCN',name:'乙胺（中性写法）',change:'H → NH₂，保留两碳骨架'},{smiles:'CCCO',name:'1-丙醇',change:'羟基与碳链长度同时改变'}] as const
export const COMPARISON_KEY='systemedu:molecule:M04:comparison:v1'
export type ComputedRow={smiles:string;logP:number;mw:number}
export type ComparisonRecord={schema:'m04-comparison-v1';source:'browser-rdkit-computation';measured:false;version:string;rows:ComputedRow[];delta:number;conclusion:string;boundaryConfirmed:true}
export function comparisonScope(smiles:string){if(!GROUP_CHOICES.some(r=>r.smiles===smiles))throw Error('Unknown comparison');return {matched:smiles!=='CCCO',reason:smiles==='CCCO'?'多了一个碳，也多了 OH；不能把差异单独归给 OH。':'保留 C–C 连接；使用相同算法比较指定的局部替换。'}}
export function traceResults(step:number,rows:ComputedRow[]){if(!Number.isInteger(step)||step<0||step>3)throw RangeError('Unknown trace step');return rows.slice(0,Math.min(step,2))}
export function makeComparisonRecord(rows:ComputedRow[],version:string,conclusion:string,confirmed:boolean):{record:ComparisonRecord|null;problem:string}{
 const fail=(problem:string)=>({record:null,problem})
 if(!confirmed)return fail('请先确认：这是计算比较，不是实测溶解度或药效。')
 if(typeof conclusion!=='string'||conclusion.trim().length<12||conclusion.trim().length>240)return fail('请用 12–240 字写出自己的结论及尚不能证明的内容。')
 if(!/^\d{4}\.\d{1,2}\.\d+/.test(version))return fail('等待实际 RDKit 版本加载。')
 if(!Array.isArray(rows)||rows.length!==2)return fail('请先计算固定的乙烷 / 乙醇对照。')
 const expected=[{smiles:'CC',logP:1.0262,mw:30.07},{smiles:'CCO',logP:-.0014,mw:46.069}]
 if(rows.some((r,i)=>!r||r.smiles!==expected[i].smiles||!Number.isFinite(r.logP)||!Number.isFinite(r.mw)||Math.abs(r.logP-expected[i].logP)>.0002||Math.abs(r.mw-expected[i].mw)>.003))return fail('固定输入的计算值不一致；请核对库与描述符口径。')
 return {record:{schema:'m04-comparison-v1',source:'browser-rdkit-computation',measured:false,version,rows:rows.map(r=>({...r})),delta:rows[1].logP-rows[0].logP,conclusion:conclusion.trim(),boundaryConfirmed:true},problem:''}
}
export function restoreComparison(raw:string|null):ComparisonRecord|null{if(!raw||raw.length>8000)return null;try{const o=JSON.parse(raw);if(o?.schema!=='m04-comparison-v1'||o.source!=='browser-rdkit-computation'||o.measured!==false||o.boundaryConfirmed!==true)return null;const r=makeComparisonRecord(o.rows,o.version,o.conclusion,true).record;return r&&typeof o.delta==='number'&&Math.abs(r.delta-o.delta)<1e-8?r:null}catch{return null}}
export const GROUP_SCRIPT=`import json
import rdkit
from rdkit import Chem
from rdkit.Chem import Crippen

rows = []
for smiles in ["CC", "CCO"]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(smiles)
    rows.append({"smiles": smiles, "cLogP": Crippen.MolLogP(mol)})
print(json.dumps({"rdkit": rdkit.__version__, "rows": rows,
    "delta": rows[1]["cLogP"] - rows[0]["cLogP"],
    "measured": False}, indent=2))
`
