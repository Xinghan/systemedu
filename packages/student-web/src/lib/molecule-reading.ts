import type {RDKitModule} from '@rdkit/rdkit'
import {analyzeSmiles} from './smiles-reading'

export const REPORT_KEY='systemedu:molecule:M06:report:v1'
export const READING_TARGETS=[
 {id:'aspirin',name:'阿司匹林',cid:2244,smiles:'CC(=O)Oc1ccccc1C(=O)O',formula:'C9H8O4'},
 {id:'acetaminophen',name:'对乙酰氨基酚',cid:1983,smiles:'CC(=O)NC1=CC=C(C=C1)O',formula:'C8H9NO2'},
] as const
export const GROUPS=[
 {id:'acid',name:'羧基',smarts:'[CX3](=O)[OX2H1]',formula:'R-C(=O)-OH',clue:'同一个羰基碳连着 O–H。'},
 {id:'ester',name:'酯基',smarts:'[CX3](=O)[OX2][#6]',formula:'R-C(=O)-O-R',clue:'羰基碳经氧连到另一个碳；不是 O–H。'},
 {id:'amide',name:'酰胺基',smarts:'[CX3](=O)[NX3]',formula:'R-C(=O)-NH-R',clue:'羰基碳直接连氮；不能把它当作普通胺。'},
 {id:'phenol',name:'酚羟基',smarts:'[OX2H1][c]',formula:'Ar-OH',clue:'O–H 直接连到芳香环碳。'},
] as const
export type ReadingResult=ReturnType<typeof readMolecule>
export function readMolecule(rdkit:RDKitModule,input:string){
 const result=analyzeSmiles(rdkit,input),mol=rdkit.get_mol(input)
 if(!mol)throw Error('无法解析结构。')
 try{
  const groups=GROUPS.map(g=>{const q=rdkit.get_qmol(g.smarts);if(!q)throw Error('匹配规则加载失败。');try{const raw=JSON.parse(mol.get_substruct_matches(q));return {...g,matches:(Array.isArray(raw)?raw:[]) as {atoms:number[];bonds:number[]}[]}}finally{q.delete()}})
  const counts={C:result.atoms.filter(a=>a.element==='C').length,N:result.atoms.filter(a=>a.element==='N').length,O:result.atoms.filter(a=>a.element==='O').length,bonds:result.bonds,rings:result.rings}
  return {...result,counts,groups}
 }finally{mol.delete()}
}
export function groupSvg(rdkit:RDKitModule,input:string,groupId:string){
 const result=readMolecule(rdkit,input),group=result.groups.find(g=>g.id===groupId),mol=rdkit.get_mol(input)
 if(!mol)throw Error('无法解析结构。')
 try{return mol.get_svg_with_highlights(JSON.stringify({width:540,height:270,addAtomIndices:true,atoms:[...new Set(group?.matches.flatMap(m=>m.atoms)||[])],bonds:[...new Set(group?.matches.flatMap(m=>m.bonds)||[])]}))}finally{mol.delete()}
}
export type ReadingCard={schema:'m06-card-v1';source:'browser-rdkit';version:string;target:string;cid:number;input:string;canonical:string;counts:{C:number;N:number;O:number;bonds:number;rings:number};groups:string[];sourceConfirmed:true;scopeConfirmed:true;explanation:string}
export function makeReadingCard(rdkit:RDKitModule,data:{target:string;input:string;runInput:string;counts:ReadingCard['counts'];groups:string[];sourceConfirmed:boolean;scopeConfirmed:boolean;explanation:string}):ReadingCard{
 const target=READING_TARGETS.find(t=>t.id===data.target)
 if(!target)throw Error('请选择本节两个目标之一。')
 if(data.runInput!==data.input)throw Error('输入改变后必须重新运行。')
 const r=readMolecule(rdkit,data.input)
 if(r.canonical!==analyzeSmiles(rdkit,target.smiles).canonical)throw Error('输入合法，但不是当前目标的结构。')
 for(const k of ['C','N','O','bonds','rings'] as const)if(data.counts?.[k]!==r.counts[k])throw Error(`${{C:'碳数',N:'氮数',O:'氧数',bonds:'重原子间键数',rings:'环数'}[k]}不一致：请对照结构与计数提示重新填写。`)
 const expected=r.groups.filter(g=>g.matches.length).map(g=>g.id).sort()
 if(!Array.isArray(data.groups)||JSON.stringify([...data.groups].sort())!==JSON.stringify(expected))throw Error('官能团选择不一致；按连接方式识别，不要全选。')
 if(!data.sourceConfirmed||!data.scopeConfirmed)throw Error('请确认公开记录来源与结论边界。')
 if(typeof data.explanation!=='string'||data.explanation.trim().length<15||data.explanation.length>300)throw Error('请用 15–300 字写下识读依据与不能推出的结论。')
 return {schema:'m06-card-v1',source:'browser-rdkit',version:rdkit.version(),target:target.id,cid:target.cid,input:data.input,canonical:r.canonical,counts:r.counts,groups:expected,sourceConfirmed:true,scopeConfirmed:true,explanation:data.explanation.trim()}
}
export function restoreReadingCards(rdkit:RDKitModule,raw:string|null):ReadingCard[]{
 if(!raw||raw.length>15000)return []
 try{const list=JSON.parse(raw);if(!Array.isArray(list)||list.length>2)return [];const seen=new Set<string>();return list.map(c=>{if(c.schema!=='m06-card-v1'||c.source!=='browser-rdkit'||seen.has(c.target))throw Error('Invalid record');seen.add(c.target);const checked=makeReadingCard(rdkit,{...c,runInput:c.input});if(checked.canonical!==c.canonical||checked.cid!==c.cid)throw Error('Source mismatch');return checked})}catch{return []}
}
export const escapeReport=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
export function reportHtml(rdkit:RDKitModule,cards:ReadingCard[]){
 const checked=restoreReadingCards(rdkit,JSON.stringify(cards)),complete=checked.length===2
 return `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>M06 双分子识读报告</title><style>body{font:16px/1.7 system-ui;background:#faf8f2;color:#252923;max-width:960px;margin:auto;padding:28px}article{background:white;border:1px solid #ddd6c6;border-radius:16px;padding:24px;margin:20px 0}svg{width:100%;max-height:270px}code,p{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #ddd}aside{border-left:4px solid #ae6548;padding:16px}</style><h1>M06 · 双分子识读报告</h1><p>${complete?'两张结构记录已核验；学习解释仍需老师复核。':'草稿：尚未完成两张目标记录。'}</p><p>浏览器 RDKit ${escapeReport(rdkit.version())} 重新计算。没有声明运行过 Python。</p>${checked.map(c=>{const t=READING_TARGETS.find(t=>t.id===c.target)!,r=readMolecule(rdkit,c.input);return `<article><h2>${t.name} · ${t.formula}</h2><p>来源：<a href="https://pubchem.ncbi.nlm.nih.gov/compound/${t.cid}">PubChem CID ${t.cid}</a></p><p>输入：<code>${escapeReport(c.input)}</code></p><p>规范写法：<code>${escapeReport(c.canonical)}</code></p>${r.svg}<table><tr><th>碳</th><th>氮</th><th>氧</th><th>氢</th><th>重原子间键</th><th>环</th></tr><tr>${[c.counts.C,c.counts.N,c.counts.O,r.hydrogens,c.counts.bonds,c.counts.rings].map(n=>`<td>${n}</td>`).join('')}</tr></table><p>匹配：${c.groups.map(id=>GROUPS.find(g=>g.id===id)!.name).join('、')}</p><h3>我的说明</h3><p>${escapeReport(c.explanation)}</p></article>`}).join('')}<aside>仅依据指定公开结构进行表达和连接识别。不能由此推断药效、安全性或实测溶解度。只做软件，不制备、接触或服用示例物质。保存的解释是本人文字，不代表系统已验证其科学含义。</aside></html>`
}
export const READING_PYTHON=`from rdkit import Chem\nfrom rdkit.Chem import Draw\nimport rdkit\nimport json\n\ntargets = ${JSON.stringify(READING_TARGETS.map(t=>({name:t.name,cid:t.cid,smiles:t.smiles})))}\npatterns = ${JSON.stringify(Object.fromEntries(GROUPS.map(g=>[g.name,g.smarts])))}\nrows = []\nfor item in targets:\n    mol = Chem.MolFromSmiles(item['smiles'])\n    if mol is None:\n        raise ValueError('Invalid SMILES')\n    counts = {s: sum(a.GetSymbol() == s for a in mol.GetAtoms()) for s in ['C', 'N', 'O']}\n    groups = {name: len(mol.GetSubstructMatches(Chem.MolFromSmarts(smarts))) for name, smarts in patterns.items()}\n    row = dict(item, canonical=Chem.MolToSmiles(mol), counts=counts, bonds=mol.GetNumBonds(), rings=mol.GetRingInfo().NumRings(), groups=groups, rdkit=rdkit.__version__)\n    rows.append(row)\n    Draw.MolToFile(mol, str(item['cid']) + '.svg')\nprint(json.dumps(rows, ensure_ascii=False, indent=2))\n`
