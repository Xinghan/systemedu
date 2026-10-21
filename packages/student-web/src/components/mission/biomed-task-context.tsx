"use client"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BIO_GROUPS, BIO_FOUNDATIONS, bioGroupFor, bioNode, bioLessonHref, bioCenterHref, bioSourceHref } from "@/lib/project-lines/biomed-mission"
import type { MissionTask } from "@/lib/project-lines/mission-operations-core"
import { BiomedFoundationDownload } from "./biomed-foundation-download"
import { BiomedResearchHandoff } from "./biomed-research-handoff"
import s from "./biomed-task-context.module.css"
export function BiomedTaskContext({task,dark=false,compact=false}:{task:{id:string};dark?:boolean;compact?:boolean}) {
 const search=useSearchParams(),group=bioGroupFor(task.id)
 if(!group)return null
 const index=BIO_GROUPS.indexOf(group),previous=BIO_GROUPS[index-1],foundation=BIO_FOUNDATIONS.filter(f=>f.uses.includes(task.id))
 return <div data-biomed-task-context={group.id}>
 <section className={s.panel} data-tone={dark?"dark":"light"}>
 <p className={s.eyebrow}>同一份研究 / 任务段 {String(index+1).padStart(2,"0")} · 第 {group.steps.indexOf(task.id)+1}/{group.steps.length} 步</p><h3>{group.title}</h3>
 <details open={!compact}><summary>{compact?"本段输入、交付与原课程对应":"查看本段交接要求"}</summary><div className={s.pair}><div><small>沿用前面的输入</small><p>{group.input}</p></div><div><small>这几步共同完成</small><p>{group.output}</p></div></div>
 <p className={s.boundary}>{group.transfer}</p>
 <details><summary>本任务如何调用原有课程 · {group.steps.length} 个节点</summary><ol className={s.list}>{group.steps.map(ref=>{const n=bioNode(ref)!;return <li key={ref}><Link href={bioLessonHref(ref)} aria-current={ref===task.id?"step":undefined}>{n.title}<small>{n.project} / {n.module} · 原正文、媒体、作业与记录均保留</small></Link></li>})}</ol></details>
 {foundation.length>0&&<details className={s.foundation}><summary>这一步可调用的基础桥 · {foundation.length} 份</summary>{foundation.map(f=><p key={f.id}>{f.title}<br/><code>{f.path}</code><br/><BiomedFoundationDownload id={f.id}/></p>)}<p>以上是原课的基础桥原文，沿用原课程登录与加入权限。资料尚未上线时会提示，路径保持可查；学习后回到当前节点。</p></details>}
 <div className={s.links}>{previous&&<Link href={`${bioCenterHref(previous.steps.at(-1)!)}&handoff=1#handoff-${previous.id}`}>核对上一任务的交接</Link>}<Link href={bioSourceHref(task.id)}>查看原课程顺序与历史记录</Link></div>
 </details></section>
 <details open={search.get("handoff")==="1"}><summary>记录本任务的作品版本与交接</summary><BiomedResearchHandoff groupId={group.id} dark={dark}/></details>
 </div>
}
export function BiomedControlTaskContext({task}:{task:MissionTask}){return <BiomedTaskContext task={task} dark/>}
