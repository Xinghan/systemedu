import type {RDKitModule} from '@rdkit/rdkit'

export const SMILES_KEY='systemedu:molecule:M05:smiles:v1'
export const TARGETS=[
 {id:'ethanol',name:'乙醇 · 练习',smiles:'CCO',cid:702,deliverable:false},
 {id:'caffeine',name:'咖啡因',smiles:'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',cid:2519,deliverable:true},
 {id:'aspirin',name:'阿司匹林',smiles:'CC(=O)Oc1ccccc1C(=O)O',cid:2244,deliverable:true},
] as const
export type SmilesResult={input:string;canonical:string;atoms:{element:string;hydrogens:number;charge:number}[];heavy:number;hydrogens:number;bonds:number;rings:number;aromaticRings:number;mw:number;svg:string}
export function analyzeSmiles(rdkit:RDKitModule,input:string):SmilesResult{
 if(typeof input!=='string'||!input.trim()||input.length>180||/\s/.test(input))throw Error('请输入不含空白的 SMILES，最多 180 字符。')
 const mol=rdkit.get_mol(input)
 if(!mol)throw Error('RDKit 无法解析该输入；请检查环标记、括号和价态。')
 try{
  if(!mol.is_valid())throw Error('结构未通过 RDKit 验证。')
  const data=JSON.parse(mol.get_json()),m=data.molecules[0],defaults=data.defaults.atom,d=JSON.parse(mol.get_descriptors())
  const symbols:Record<number,string>={1:'H',5:'B',6:'C',7:'N',8:'O',9:'F',14:'Si',15:'P',16:'S',17:'Cl',35:'Br',53:'I'}
  const atoms=m.atoms.map((a:{z?:number;impHs?:number;chg?:number})=>({element:symbols[a.z??defaults.z]||`Z=${a.z??defaults.z}`,hydrogens:a.impHs??defaults.impHs,charge:a.chg??defaults.chg}))
  return {input,canonical:mol.get_smiles(),atoms,heavy:d.NumHeavyAtoms,hydrogens:atoms.reduce((n:number,a:{element:string;hydrogens:number})=>n+a.hydrogens+(a.element==='H'?1:0),0),bonds:m.bonds.length,rings:d.NumRings,aromaticRings:d.NumAromaticRings,mw:d.amw,svg:mol.get_svg_with_highlights(JSON.stringify({width:500,height:260,explicitMethyl:true}))}
 }finally{mol.delete()}
}
/** Teaching tokenizer only. RDKit, not this regular expression, validates molecules. */
export function teachingTokens(input:string){return input.match(/\[[^\]]+\]|Cl|Br|[A-Za-z]|%\d\d|\d|./g)||[]}
export function phenolTrace(step:number){
 if(!Number.isInteger(step)||step<0||step>9)throw RangeError('Trace step outside 0–9')
 const token=step? 'Oc1ccccc1'[step-1]:'—',heavy=step<3?step:Math.min(step-1,7)
 return {token,heavy,bonds:step===9?7:Math.max(0,heavy-1),ringOpen:step>=3&&step<9,rings:step===9?1:0,highlight:Array.from({length:heavy},(_,i)=>i),message:step===0?'尚未读取。':step===3?'遇到第一个 1：记录环端点，不添加原子。':step===9?'第二个 1：把末端碳接回环端点，新增一条键。':`读取 ${token}：添加一个原子${heavy>1?'，并接到前一个原子':''}。`}
}
export type SmilesAttempt={input:string;target:string;parsed:boolean;matched:boolean;canonical?:string}
export type SmilesRecord={schema:'m05-smiles-v1';source:'browser-rdkit';version:string;target:string;input:string;canonical:string;attempts:SmilesAttempt[];observation:string}
export function makeSmilesRecord(rdkit:RDKitModule,targetId:string,input:string,attempts:SmilesAttempt[],observation:string):SmilesRecord{
 const target=TARGETS.find(t=>t.id===targetId)
 if(!target?.deliverable)throw Error('乙醇是练习；请完成咖啡因或阿司匹林目标。')
 const result=analyzeSmiles(rdkit,input),expected=analyzeSmiles(rdkit,target.smiles)
 if(result.canonical!==expected.canonical)throw Error('输入合法，但不是所选目标的结构。')
 if(!Array.isArray(attempts)||attempts.length>12||!attempts.some(a=>a.input===input&&a.target===targetId&&a.parsed&&a.matched))throw Error('请先运行当前输入并通过目标核对。')
 const validAttempts=attempts.map(a=>{if(typeof a?.input!=='string'||a.input.length>180||!TARGETS.some(t=>t.id===a.target))throw Error('尝试记录无效。');let p:SmilesResult;try{p=analyzeSmiles(rdkit,a.input)}catch{if(a.parsed||a.matched)throw Error('解析记录不一致。');return {...a,parsed:false,matched:false,canonical:undefined}}const t=TARGETS.find(t=>t.id===a.target)!;const matched=p.canonical===analyzeSmiles(rdkit,t.smiles).canonical;if(!a.parsed||matched!==a.matched||p.canonical!==a.canonical)throw Error('结构核对记录不一致。');return {...a}})
 if(!validAttempts.some(a=>!a.parsed||!a.matched))throw Error('请保留一次实际失败尝试，并说明如何修正。')
 if(typeof observation!=='string'||observation.trim().length<12||observation.length>280)throw Error('请用 12–280 字写下错误、修正以及核对依据。')
 return {schema:'m05-smiles-v1',source:'browser-rdkit',version:rdkit.version(),target:targetId,input,canonical:result.canonical,attempts:validAttempts,observation:observation.trim()}
}
export function restoreSmilesRecord(rdkit:RDKitModule,raw:string|null){if(!raw||raw.length>15000)return null;try{const r=JSON.parse(raw);if(r.schema!=='m05-smiles-v1'||r.source!=='browser-rdkit')return null;const checked=makeSmilesRecord(rdkit,r.target,r.input,r.attempts,r.observation);return checked.canonical===r.canonical?checked:null}catch{return null}}
export function smilesPython(input:string){return `from rdkit import Chem\nfrom rdkit.Chem import Draw\nimport rdkit\n\nsmiles = ${JSON.stringify(input)}\nmol = Chem.MolFromSmiles(smiles)\nif mol is None:\n    raise ValueError("Invalid SMILES")\nprint("RDKit:", rdkit.__version__)\nprint("Canonical:", Chem.MolToSmiles(mol))\nDraw.MolToFile(mol, "my_molecule.svg")\n`}
