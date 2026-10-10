"use client"
import Link from "next/link"
import { useLearningIdentity, useLearningRecord } from "@/lib/hooks/use-learning-record"
import { LearningRecordStatus } from "@/components/learning/learning-record-status"
import type { LearningBody, LearningScope } from "@/lib/api/learning-records"
import { BIO_STATIONS, bioLessonHref } from "@/lib/project-lines/biomed-mission"
import s from "./space-mission-control.module.css"
const FIELDS=[
 ["question","我要研究什么？","示例：针对原课选定靶点，在同一活性端点下比较候选；先写清对象和范围。"],
 ["sources","数据和版本从哪里来？","填写原始快照名、获取日期、端点、环境或配置版本。教学 ESOL 与正式靶点数据分别记录。"],
 ["first","第一次结果与修订如何区分？","例如：first-test.csv 保留首次评价；探索修改另存 exploratory-v2.csv，不覆盖首次记录。"],
 ["reproduce","别人怎样复跑？","填写原课提交位置或本人文件夹、入口命令与所需环境。这是索引，不是文件上传。"],
 ["limits","证据支持什么，还不知道什么？","例如：仅支持在当前数据与划分下比较候选；不能据此判断药效、安全性或治疗价值。"],
] as const
const SCOPE:LearningScope={library_slug:"biomedicine",module_id:"JOURNEY",activity_id:"research-dossier",kind:"assignment",content_version:"1.0"}
const INITIAL:LearningBody={answers:FIELDS.map(([id,question])=>({question_id:id,question,answer:""}))}
export function BiomedMissionDossier(){const {owner}=useLearningIdentity();return <Dossier key={owner}/>}
function Dossier(){
 const record=useLearningRecord(SCOPE,INITIAL)
 const valid=record.body.answers.length===FIELDS.length&&FIELDS.every(([id])=>record.body.answers.some(a=>a.question_id===id&&typeof a.answer==="string"))
 const locked=!record.ready||record.attention||record.conflict||record.pending||!valid
 return <section className={s.panel} data-biomed-dossier><h3>我的候选分子研究档案</h3><p className={s.note}>研究问题、证据版本、复现位置与限制。保存档案不等于研究通过；完整作业、数据和实验成果仍在原课堂提交。</p>
 {!valid&&<p role="alert">档案格式暂时无法读取，原数据保留。请先通过保存与恢复导出核对。</p>}
 {FIELDS.map(([id,title,hint])=><label className={s.field} key={id}>{title}<textarea rows={2} maxLength={1500} disabled={locked} placeholder={hint} value={record.body.answers.find(a=>a.question_id===id)?.answer||""} onChange={e=>record.session.update({...record.body,answers:record.body.answers.map(a=>a.question_id===id?{...a,answer:e.target.value}:a)})}/><small>{hint}</small></label>)}
 <button className={s.primary} disabled={locked||record.busy||record.body.answers.some(a=>!a.answer.trim())} onClick={()=>void record.session.submit()}>保存这版研究档案</button><LearningRecordStatus record={record}/>
 <div className={s.resourceList}><h3>回到各阶段的正式交付</h3>{BIO_STATIONS.filter(s=>s.steps.length).map(st=><Link key={st.id} href={bioLessonHref(st.steps.at(-1)!)}><div><strong>{st.code} · {st.place}</strong><small>{st.handoff}</small></div><span>核对原作品 →</span></Link>)}</div></section>
}
