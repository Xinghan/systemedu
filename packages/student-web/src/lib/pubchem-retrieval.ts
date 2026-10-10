import type {RDKitModule} from '@rdkit/rdkit'
import snapshot from './data/m23-pubchem.json'
import {analyzeSmiles} from './smiles-reading'
import {escapeReport} from './molecule-reading'

export const RETRIEVAL_KEY='systemedu:molecule:M07:retrieval:v1'
export const SNAPSHOT_DATE=snapshot.retrievedOn
const aliases:Record<number,{zh:string;names:string[];eligible:boolean}>={2244:{zh:'阿司匹林',names:['aspirin','acetylsalicylic acid','阿司匹林'],eligible:true},2519:{zh:'咖啡因',names:['caffeine','咖啡因'],eligible:true},702:{zh:'乙醇',names:['ethanol','ethyl alcohol','乙醇'],eligible:false},241:{zh:'苯',names:['benzene','苯'],eligible:false},1983:{zh:'对乙酰氨基酚',names:['acetaminophen','paracetamol','对乙酰氨基酚'],eligible:true},3672:{zh:'布洛芬（未指定单一立体构型）',names:['ibuprofen','布洛芬'],eligible:true}}
export const CATALOG=snapshot.records.map(r=>({...r,...aliases[r.CID]}))
export const sourceUrl=(cid:number)=>`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`
export function searchCatalog(query:string){const q=query.trim().toLowerCase();if(!q||q.length>80)return [];const exact=CATALOG.filter(r=>r.names.some(n=>n.toLowerCase()===q)||String(r.CID)===q);return exact.length?exact:CATALOG.filter(r=>r.names.some(n=>n.toLowerCase().startsWith(q)))}
export function verifyRetrieved(rdkit:RDKitModule,cid:number,input:string){const target=CATALOG.find(t=>t.CID===cid);if(!target)throw Error('本节只核对已列出的六个 CID，其他目标请另行核实。');const result=analyzeSmiles(rdkit,input);if(result.canonical!==analyzeSmiles(rdkit,target.SMILES).canonical)throw Error('输入可解析，但与所选 CID 的目标结构不同。请核对记录、盐型与立体信息。');return {...result,target}}
export type SyntaxMark={id:string;kind:'double'|'branch'|'ring';label:string;positions:number[]}
/** Bounded teaching annotations, not a SMILES validator. Bracket contents are skipped. */
export function syntaxMarks(smiles:string):SyntaxMark[]{
 const marks:SyntaxMark[]=[],branches:number[]=[],rings=new Map<string,number[]>();let bracket=false
 for(let i=0;i<smiles.length;i++){const c=smiles[i];if(c==='['){bracket=true;continue}if(c===']'){bracket=false;continue}if(bracket)continue
  if(c==='=')marks.push({id:`double:${i}`,kind:'double',label:`双键符号 · 第 ${i+1} 字符`,positions:[i]})
  if(c==='(')branches.push(i)
  if(c===')'){const start=branches.pop();if(start!==undefined)marks.push({id:`branch:${start}:${i}`,kind:'branch',label:`支链括号 · ${start+1}–${i+1}`,positions:[start,i]})}
  if(/\d/.test(c)||c==='%'&&/^%\d{2}/.test(smiles.slice(i))){const token=c==='%'?smiles.slice(i,i+3):c,positions=Array.from({length:token.length},(_,j)=>i+j),prior=rings.get(token);if(prior){marks.push({id:`ring:${prior[0]}:${i}`,kind:'ring',label:`环标记 ${token} · 成对位置`,positions:[...prior,...positions]});rings.delete(token)}else rings.set(token,positions);i+=token.length-1}
 }
 return marks.sort((a,b)=>a.positions[0]-b.positions[0])
}
export const FIELD_NAMES=['SMILES','Connectivity SMILES','Canonical SMILES (旧字段)'] as const
export type RetrievalCard={schema:'m23-retrieval-v1';cid:number;query:string;smiles:string;canonical:string;sourceMode:'web-copy'|'snapshot-practice';sourceUrl:string;sourceField:string;accessedOn:string;sourceConfirmed:true;annotations:string[];explanation:string;rdkitVersion:string}
type CardInput=Omit<RetrievalCard,'schema'|'canonical'|'rdkitVersion'|'sourceConfirmed'> & {runInput:string;sourceConfirmed:boolean}
export function makeRetrievalCard(rdkit:RDKitModule,d:CardInput):RetrievalCard{
 if(d.runInput!==d.smiles)throw Error('输入已改变，请重新运行当前结构。')
 const result=verifyRetrieved(rdkit,d.cid,d.smiles)
 if(!result.target.eligible)throw Error('乙醇和苯用于检索练习；个人卡请选阿司匹林、咖啡因、对乙酰氨基酚或布洛芬。')
 if(typeof d.query!=='string'||!searchCatalog(d.query).some(r=>r.CID===d.cid))throw Error('检索词与所选 CID 不对应。可使用名称或 CID。')
 if(!['web-copy','snapshot-practice'].includes(d.sourceMode))throw Error('请区分网页复制与离线样例。')
 if(d.sourceUrl!==sourceUrl(d.cid))throw Error('来源链接必须与本页指定的 PubChem CID 对应。')
 if(!FIELD_NAMES.some(f=>f===d.sourceField))throw Error('请记录实际取得的结构字段。')
 const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,date=new Date(d.accessedOn+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(d.accessedOn)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==d.accessedOn||d.accessedOn>today)throw Error('请输入有效的取得日期，不能填未来日期。')
 if(d.sourceMode==='snapshot-practice'&&d.accessedOn!==SNAPSHOT_DATE)throw Error('离线样例请保留原快照日期。')
 if(!d.sourceConfirmed)throw Error('请确认记录的实际来源方式；网页访问是本人声明，不是系统证实。')
 const marks=syntaxMarks(d.smiles);if(!Array.isArray(d.annotations)||new Set(d.annotations).size!==d.annotations.length||d.annotations.some(id=>!marks.some(m=>m.id===id))||new Set(d.annotations.map(id=>marks.find(m=>m.id===id)!.kind)).size<2)throw Error('请在当前字符串中标注至少两类：双键、支链括号、成对环标记。')
 if(typeof d.explanation!=='string'||d.explanation.trim().length<15||d.explanation.length>300)throw Error('请用 15–300 字说明两个标记的意思及来源核对依据。')
 return {schema:'m23-retrieval-v1',cid:d.cid,query:d.query.trim(),smiles:d.smiles,canonical:result.canonical,sourceMode:d.sourceMode,sourceUrl:d.sourceUrl,sourceField:d.sourceField,accessedOn:d.accessedOn,sourceConfirmed:true,annotations:[...d.annotations],explanation:d.explanation.trim(),rdkitVersion:rdkit.version()}
}
export function restoreRetrievalCard(rdkit:RDKitModule,raw:string|null){if(!raw||raw.length>12000)return null;try{const d=JSON.parse(raw);if(d.schema!=='m23-retrieval-v1')return null;const c=makeRetrievalCard(rdkit,{...d,runInput:d.smiles});return c.canonical===d.canonical?c:null}catch{return null}}
export const provenanceLabel=(c:RetrievalCard)=>c.sourceMode==='web-copy'?'本人声明网页取数 · 结构已核验':'离线样例练习 · 非真实取数完成'
export function retrievalHtml(rdkit:RDKitModule,card:RetrievalCard){const c=restoreRetrievalCard(rdkit,JSON.stringify(card));if(!c)throw Error('记录未通过重新核验。');const r=verifyRetrieved(rdkit,c.cid,c.smiles),marks=syntaxMarks(c.smiles).filter(m=>c.annotations.includes(m.id));return `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>M07 取数来源卡</title><style>body{font:16px/1.8 system-ui;color:#292a24;background:#faf8f2;max-width:850px;margin:auto;padding:28px}svg{width:100%;height:270px}article{padding:24px;border:1px solid #dcd7c9;background:white;border-radius:16px}code,p,li{overflow-wrap:anywhere}aside{border-left:4px solid #ae6548;padding:14px}</style><h1>M07 · ${r.target.zh}取数卡</h1><aside>${provenanceLabel(c)}</aside><article><p>检索词：${escapeReport(c.query)}</p><p>来源：<a href="${sourceUrl(c.cid)}">PubChem CID ${c.cid}</a></p><p>记录字段：${escapeReport(c.sourceField)}；取得日期：${c.accessedOn}</p><p>原始输入：<code>${escapeReport(c.smiles)}</code></p><p>RDKit ${escapeReport(c.rdkitVersion)} 规范写法：<code>${escapeReport(c.canonical)}</code></p>${r.svg}<h2>识读标注</h2><ul>${marks.map(m=>`<li>${m.label}：${m.positions.map(p=>`${p+1}=${escapeReport(c.smiles[p])}`).join('，')}</li>`).join('')}</ul><h2>我的说明</h2><p>${escapeReport(c.explanation)}</p></article><p>网页取得方式是本人声明；软件核验结构与指定 CID 是否一致，不能证明访问过网页，也不证明药效或安全性。仅做软件取数，不接触、制备或服用示例物质。</p></html>`}
export function retrievalPython(c:RetrievalCard){return `import json\n\n# Saved provenance record; this script does not fetch PubChem.\nrecord = json.loads(${JSON.stringify(JSON.stringify(c))})\nsmiles = record["smiles"]\nprint("CID:", record["cid"])\nprint("Source:", record["sourceUrl"])\nprint("Mode:", record["sourceMode"])\nprint(smiles)\n`}
