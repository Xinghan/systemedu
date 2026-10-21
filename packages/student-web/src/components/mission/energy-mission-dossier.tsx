"use client"
import Link from "next/link"
import { useLearningIdentity, useLearningRecord } from "@/lib/hooks/use-learning-record"
import { LearningRecordStatus } from "@/components/learning/learning-record-status"
import type { LearningBody, LearningScope } from "@/lib/api/learning-records"
import { ENERGY_STATIONS, energyLessonHref } from "@/lib/project-lines/energy-mission"
import s from "./space-mission-control.module.css"
const FIELDS=[
 ["question","观测站要完成什么任务？","示例：保持关键传感器工作，并预报明天约定时刻的小板直流功率。写自己的任务和测量边界。"],
 ["hardware","我的结构与器材版本","填写本人 CAD/打印版本、板和负载身份、固定姿态、校准文件位置；尚未制作的部分明确写未完成。"],
 ["first","首次预报与实测如何对应？","例如：forecast-first.csv 在采集前封存；observed.csv 保存实际时刻和原始读数，修订另存。"],
 ["reproduce","别人怎样复跑？","填写原课正式作业或本地作品包位置、入口命令、依赖与数据版本。这是索引，不是附件上传。"],
 ["limits","证实了什么，还有什么没验证？","例如：只验证约定时刻的功率，稀疏点测不能声称全天电量；公开数据演练不等于本人实物完成。"],
] as const
const SCOPE:LearningScope={library_slug:"energy-motion",module_id:"JOURNEY",activity_id:"engineering-dossier",kind:"assignment",content_version:"1.0"}
const INITIAL:LearningBody={answers:FIELDS.map(([id,question])=>({question_id:id,question,answer:""}))}
export function EnergyMissionDossier(){const {owner}=useLearningIdentity();return <Dossier key={owner}/>}
function Dossier(){
 const record=useLearningRecord(SCOPE,INITIAL)
 const valid=record.body.answers.length===FIELDS.length&&FIELDS.every(([id])=>record.body.answers.some(a=>a.question_id===id&&typeof a.answer==="string"))
 const locked=!record.ready||record.attention||record.conflict||record.pending||!valid
 return <section className={s.panel} data-energy-dossier><h3>我的能源工程交付档案</h3><p className={s.note}>任务口径、器材版本、首次结果与复现位置。保存档案不等于实物验收通过；完整作业、数据和实验成果仍在原课堂提交。</p>
 {!valid&&<p role="alert">档案格式暂时无法读取，原数据保留。请先通过保存与恢复导出核对。</p>}
 {FIELDS.map(([id,title,hint])=><label className={s.field} key={id}>{title}<textarea rows={2} maxLength={1500} disabled={locked} placeholder={hint} value={record.body.answers.find(a=>a.question_id===id)?.answer||""} onChange={e=>record.session.update({...record.body,answers:record.body.answers.map(a=>a.question_id===id?{...a,answer:e.target.value}:a)})}/><small>{hint}</small></label>)}
 <button className={s.primary} disabled={locked||record.busy||record.body.answers.some(a=>!a.answer.trim())} onClick={()=>void record.session.submit()}>保存这版工程档案</button><LearningRecordStatus record={record}/>
 <div className={s.resourceList}><h3>回到各阶段的正式交付</h3>{ENERGY_STATIONS.filter(s=>s.steps.length).map(st=><Link key={st.id} href={energyLessonHref(st.steps.at(-1)!)}><div><strong>{st.code} · {st.place}</strong><small>{st.handoff}</small></div><span>核对原作品 →</span></Link>)}</div></section>
}
