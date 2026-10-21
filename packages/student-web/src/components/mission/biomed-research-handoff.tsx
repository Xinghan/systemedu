"use client"
import { useState } from "react"
import Link from "next/link"
import { useLearningIdentity, useLearningRecord } from "@/lib/hooks/use-learning-record"
import { LearningRecordStatus } from "@/components/learning/learning-record-status"
import { BIO_GROUPS, bioCenterHref, bioGroup, bioLessonHref } from "@/lib/project-lines/biomed-mission"
import { HANDOFF_FIELDS, initialHandoff, handoffFrom, handoffScope, sealHandoff } from "@/lib/project-lines/biomed-handoff"
import s from "./biomed-task-context.module.css"
export function BiomedResearchHandoff({groupId,dark=false}:{groupId:string;dark?:boolean}) {
 const {owner}=useLearningIdentity()
 return <Handoff key={owner+groupId} groupId={groupId} dark={dark}/>
}
function Handoff({groupId,dark}:{groupId:string;dark:boolean}) {
 const group=bioGroup(groupId)!,record=useLearningRecord(handoffScope(groupId),initialHandoff()),saved=handoffFrom(record.body)
 const [message,setMessage]=useState("")
 const locked=!record.ready||record.attention||record.conflict||record.pending||record.busy||!saved
 const next=BIO_GROUPS[BIO_GROUPS.indexOf(group)+1]
 async function submit(){
  if(record.pending){await record.session.submit();return}
  try{record.session.update(sealHandoff(record.body,crypto.randomUUID(),new Date().toISOString()));await record.session.submit();setMessage("这一版交接已加入版本记录。同步结果以下方保存状态为准；正式作品仍在原课堂。")}
  catch(e){setMessage(e instanceof Error?e.message:"保存失败，已保留草稿。")}
 }
 return <section className={s.panel} data-tone={dark?"dark":"light"} data-biomed-handoff={groupId} id={`handoff-${groupId}`}>
  <p className={s.eyebrow}>ONE RESEARCH · VERSIONED HANDOVER</p><h3>把这份作品带到下一步</h3>
  <p>{group.output}</p><p className={s.note}>这是研究交接索引。文件、原作业与课堂记录留在原位置；填写索引不会上传文件、自动完成其他节点或判定研究通过。</p>
  {saved===null&&<p role="alert">记录格式暂时无法读取，原数据已保留。请在保存与恢复中导出核对。</p>}
  <div className={s.fields}>{HANDOFF_FIELDS.map(([id,title,hint])=><label key={id}>{title}{id==="evidence"||id==="transfer"?<textarea rows={2} maxLength={800} disabled={locked} placeholder={hint} value={record.body.answers.find(a=>a.question_id===id)?.answer||""} onChange={e=>record.session.update({...record.body,answers:record.body.answers.map(a=>a.question_id===id?{...a,answer:e.target.value}:a)})}/>:<input maxLength={800} disabled={locked} placeholder={hint} value={record.body.answers.find(a=>a.question_id===id)?.answer||""} onChange={e=>record.session.update({...record.body,answers:record.body.answers.map(a=>a.question_id===id?{...a,answer:e.target.value}:a)})}/>}<small>{hint}</small></label>)}</div>
  <button type="button" disabled={record.busy||record.conflict||(!record.pending&&(locked||record.body.answers.some(a=>!a.answer.trim())||(saved?.length||0)>=50))} onClick={()=>void submit()}>{record.pending?"重试保存这版交接":"保存这版研究交接"}</button>
  {message&&<p role="status">{message}</p>}<LearningRecordStatus record={record}/>
  {!!saved?.length&&<details className={s.history}><summary>已保留的交接版本 · {saved.length} 份</summary>{saved.map((v,i)=><article key={v.id} data-handoff-version={v.id}><p><strong>{i===0?"首次交接":"后续修订"} · {v.values.version}</strong><br/>{v.values.output}</p><p className={s.note}>{v.values.evidence}<br/>{v.values.transfer}</p></article>)}</details>}
  <div className={s.links}><Link href={bioLessonHref(group.steps.at(-1)!)}>核对本任务的原课堂作品</Link>{next&&<Link href={bioCenterHref(next.steps[0])}>下一任务：{next.title}</Link>}</div>
 </section>
}
export function BiomedHandoffArchive(){
 const [id,setId]=useState(BIO_GROUPS[0].id)
 return <div data-biomed-handoff-archive><div className={s.panel} data-tone="dark"><h3>同一份研究，逐段交接</h3><label>选择研究任务段<select value={id} onChange={e=>setId(e.target.value)}>{BIO_GROUPS.map((g,i)=><option key={g.id} value={g.id}>{String(i+1).padStart(2,"0")} · {g.title}</option>)}</select></label><p className={s.note}>22 个任务段共用这一入口；各段单独保存原始版本与修订，不把练习数据合并成正式研究结果。</p></div><BiomedResearchHandoff groupId={id} dark/></div>
}
