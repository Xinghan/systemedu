"use client"
import Link from 'next/link'
import Image from 'next/image'
import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera } from 'lucide-react'
import { BIOMED_DATA } from '@/lib/project-lines/biomed-model'
import { useLearningRecord } from '@/lib/hooks/use-learning-record'
import { BiomedMoleculeView, MoleculeDiagram, INITIAL_POSE, type MoleculePose } from './biomed-molecule-view'
import { LearningRecordStatus } from './learning-record-status'
import styles from './biomed-workspace.module.css'

type MicroState = { schema:'biomed-observation/1'; molecule:string; selected:number; pose:MoleculePose; order:string[]; moved:boolean; marked:boolean; inspected:boolean; attempts:{order:string[];correct:boolean}[] }
const initial:MicroState={schema:'biomed-observation/1',molecule:'caffeine',selected:-1,pose:INITIAL_POSE,order:['caffeine','ethanol','aspirin'],moved:false,marked:false,inspected:false,attempts:[]}
function isMicro(value:unknown):value is MicroState {const a=value as MicroState|undefined;return !!a&&a.schema==='biomed-observation/1'&&BIOMED_DATA.models.some(m=>m.id===a.molecule)&&Number.isInteger(a.selected)&&a.selected>=-1&&a.selected<BIOMED_DATA.models.find(m=>m.id===a.molecule)!.atoms.length&&Array.isArray(a.order)&&a.order.length===3&&new Set(a.order).size===3&&a.order.every(id=>BIOMED_DATA.models.some(m=>m.id===id))&&Array.isArray(a.attempts)&&a.attempts.length<=10&&!!a.pose&&['camera','up','target'].every(key=>Array.isArray(a.pose[key as 'camera'])&&a.pose[key as 'camera'].length===3&&a.pose[key as 'camera'].every(Number.isFinite))}

export function BiomedMicroProject({id}:{id:'turn-a-molecule'|'sort-molecule-cards'}) {
  const turning=id==='turn-a-molecule'
  const title=turning?'转动我的第一个分子':'给分子排个队'
  const record=useLearningRecord({library_slug:id,module_id:'M01',activity_id:'molecular-observation',kind:'classroom',content_version:'1.0'},{answers:[],artifact:initial as unknown as Record<string,unknown>})
  const a=isMicro(record.body.artifact)?record.body.artifact:initial
  const pose=useRef<MoleculePose>(a.pose),[message,setMessage]=useState('')
  const locked=!record.ready||record.pending||record.conflict||record.busy
  const model=BIOMED_DATA.models.find(m=>m.id===a.molecule)!
  const update=(next:MicroState)=>record.session.update({...record.body,artifact:next as unknown as Record<string,unknown>})
  function move(index:number,delta:number){const order=[...a.order];[order[index],order[index+delta]]=[order[index+delta],order[index]];update({...a,order,moved:true})}
  async function save(){
    if(record.pending){await record.session.submit();return}
    if(turning){const element=model.atoms[a.selected]?.element;if(!element)return;const next={...a,pose:pose.current,marked:true};record.session.update({answers:[{question_id:'observation',question:'我的标记',answer:`${model.name}：第 ${a.selected+1} 号原子 ${element}，${pose.current.mode==='3d'?'三维视角':'二维连接图'}`}],artifact:next as unknown as Record<string,unknown>});setMessage('你的分子、视角和原子标记已收进观察卡。可以换个分子再观察。')}
    else{const correct=a.order.every((id,i)=>id===['ethanol','aspirin','caffeine'][i]);const next={...a,inspected:true,attempts:[...a.attempts,{order:[...a.order],correct}].slice(-10)};record.session.update({answers:[{question_id:'order',question:'按分子量从小到大的排序',answer:a.order.map(id=>BIOMED_DATA.models.find(m=>m.id===id)!.name).join(' → ')}],artifact:next as unknown as Record<string,unknown>});setMessage(correct?'顺序与分子量相符。你刚刚完成了一次有依据的比较。':'这次尝试已保留。对照 g/mol 数值移动卡片，再试一次；画得大并不代表分子量大。')}
    await record.session.submit()
  }
  return <main className={styles.page} data-biomed-micro={id}>
    <header className={styles.top}><Link href="/library?view=lines&line=biomedicine"><ArrowLeft size={14} style={{display:'inline',marginRight:8}}/>生命解码局</Link><span>01 发现与操作 · 约 3 分钟目标</span></header>
    <section className={styles.hero}><div><p className={styles.eyebrow}>生命解码局 / 第一份观察</p><h1>{title}</h1><p>{turning?'试着拖动模型。找到一个你感兴趣的原子，点一下，再保存你的观察卡。':'三张卡片谁轻谁重？移动它们，按分子量从小到大排好，再揭开数值核对。'}</p></div><Image src={`/project-lines/biomedicine/${id}/cover-molecular-v5.png`} width={600} height={400} sizes="(max-width:720px) 90vw, 300px" priority alt="分子探索主题插画"/></section>
    <section className={styles.workspace}><fieldset disabled={locked}>
      {turning?<><div className={styles.atoms}>{BIOMED_DATA.models.map(m=><button type="button" key={m.id} aria-pressed={a.molecule===m.id} onClick={()=>{pose.current=INITIAL_POSE;update({...a,molecule:m.id,selected:-1,marked:false,pose:INITIAL_POSE})}}>{m.name}</button>)}</div><div className={styles.twoCols}><div>{record.ready&&<BiomedMoleculeView key={`${record.identity.owner}:${model.id}`} model={model} selected={a.selected} initialPose={a.pose} onPose={value=>{pose.current=value}} onSelect={selected=>{if(!locked)update({...a,selected,marked:false})}}/>}</div><div><p className={styles.eyebrow}>01 转一转 / 02 标一个 / 03 留下来</p><h3>{model.name} <small>{model.formula}</small></h3><p>也可以用下方按钮选择原子。字母表示元素，编号用来定位你标记的位置。</p><div className={styles.atoms}>{model.atoms.map((atom,i)=>atom.element!=='H'&&<button type="button" key={i} aria-label={`标记 ${atom.element} 原子 ${i+1}`} aria-pressed={a.selected===i} onClick={()=>update({...a,selected:i,marked:false})}>{atom.element} {i+1}</button>)}</div><div className={styles.notice}>{a.selected<0?'先选一个原子，看看它连接了谁。':`你标记了 ${model.atoms[a.selected].element} ${a.selected+1}。与它相连的原子：${model.bonds.filter(b=>b.a===a.selected||b.b===a.selected).map(b=>{const j=b.a===a.selected?b.b:b.a;return `${model.atoms[j].element} ${j+1}`}).join('、')}。`}</div><div className={styles.actions}><button className={styles.primary} type="button" disabled={a.selected<0||locked} onClick={save}><Camera size={15} style={{display:'inline',marginRight:7}}/>保存我的观察卡</button></div><p className={styles.muted}>这是根据公开分子结构计算的模型。旋转模型改变的是观察方向，化学连接不会因此改变。</p></div></div></>:<><div className={styles.threeCols}>{a.order.map((id,i)=>{const m=BIOMED_DATA.models.find(m=>m.id===id)!;return <article className={styles.specimen} key={id}><MoleculeDiagram model={m}/><h3>{i+1}. {m.name}</h3><p>{a.inspected?<strong>{m.mw} g/mol</strong>:<span>数值暂未揭开</span>}</p><div className={styles.actions}><button type="button" aria-label={`${m.name}往前移`} disabled={i===0} onClick={()=>move(i,-1)}>往前</button><button type="button" aria-label={`${m.name}往后移`} disabled={i===2} onClick={()=>move(i,1)}>往后</button></div></article>})}</div><div className={styles.actions}><button className={styles.primary} type="button" disabled={!a.moved||locked} onClick={save}>{a.inspected?'核对新排序并保存':'揭开数值，保存这次排序'}</button></div><p>这里比较的是分子量，单位 g/mol；图形为方便观察使用不同缩放比例，不能拿屏幕上的大小当测量。数值由 RDKit 根据分子结构计算。</p></>}
    </fieldset>{message&&<p className={styles.notice} role="status">{message}</p>}<LearningRecordStatus record={record}/>
    {turning&&a.marked&&<details className={styles.snapshot} open><summary>我的观察卡 · {model.name}</summary><MoleculeDiagram model={model} selected={a.selected}/><p>已保留原子 {a.selected+1} 和{a.pose.mode==='3d'?'三维相机视角，重新进入后恢复':'二维连接视图'}。连接图用于清楚展示标记。</p></details>}
    {!turning&&a.attempts.length>0&&<details className={styles.history}><summary>我的比较记录 · {a.attempts.length} 次</summary>{a.attempts.map((attempt,i)=><p key={i}>{i+1}. {attempt.order.map(id=>BIOMED_DATA.models.find(m=>m.id===id)!.name).join(' → ')} · {attempt.correct?'与数值相符':'保留的尝试'}</p>)}</details>}
    </section><div className={styles.microFooter}><a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${model.cid}`} target="_blank" rel="noreferrer">查看 PubChem 分子来源</a><Link href={`/explore/biomedicine/${turning?'sort-molecule-cards':'build-a-candidate-filter'}`}>{turning?'下一件小作品：给分子排个队':'继续：做一个候选筛选器'}<ArrowRight size={15} style={{display:'inline',marginLeft:8}}/></Link></div>
  </main>
}
