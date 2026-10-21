"use client"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { IntegratedMission } from "@/lib/project-lines/integrated-mission"
import { EngineeringHandoff } from "./engineering-handoff"
import { EngineeringFoundationDownload } from "./engineering-foundation-download"
import s from "./biomed-task-context.module.css"
export function EngineeringTaskContext({mission,task,dark=false}:{mission:IntegratedMission;task:{id:string};dark?:boolean}){
 const search=useSearchParams(),group=mission.groupFor(task.id)
 if(!group)return null
 const node=mission.node(task.id)
 const peers=mission.groups.filter(g=>g.path===group.path),previous=peers[peers.indexOf(group)-1],foundations=mission.foundations.filter(f=>f.uses.includes(task.id))
 return <section data-engineering-task-context={group.id}><div className={s.panel} data-tone={dark?"dark":"light"}><p className={s.eyebrow}>{group.path==="main"?"同一次工程任务":"独立进阶支线"} / 本段第 {group.steps.indexOf(task.id)+1} / {group.steps.length} 步</p><h3>{group.title}</h3><div className={s.pair}><div><small>沿用什么输入</small><p>{group.input}</p></div><div><small>这一段交付什么</small><p>{group.output}</p></div></div><p className={s.boundary}>{group.transfer}</p><details><summary>原课程节点与记录 · {group.steps.length} 步</summary><ol className={s.list}>{group.steps.map(ref=>{const n=mission.node(ref)!;return <li key={ref}><Link href={mission.lessonHref(ref)} aria-current={ref===task.id?"step":undefined}>{n.title}<small>{n.project} / {n.module} · 正文、媒体、作业及记录保留</small></Link></li>})}</ol></details>{foundations.length>0&&<details><summary>本节点的原课基础桥 · {foundations.length} 份</summary>{foundations.map(f=><p key={f.project+f.id}>{f.title}<br/><EngineeringFoundationDownload foundation={f} returnHref={mission.lessonHref(task.id)}/></p>)}</details>}<div className={s.links}>{previous&&<Link href={`${mission.centerHref(previous.steps.at(-1)!)}&handoff=1#handoff-${previous.id}`}>核对上一段交接</Link>}<Link href={mission.sourceHref(task.id)}>原课程顺序与历史记录</Link>{process.env.NODE_ENV==="development"&&node?.project==="aloha-bimanual-apprentice"&&<Link href={`/preview/aloha/${node.module}?mission=robotics`}>本地查看原课教材</Link>}</div></div><details open={search.get("handoff")==="1"}><summary>记录本段作品版本与交接</summary><EngineeringHandoff mission={mission} groupId={group.id} dark={dark}/></details></section>
}
