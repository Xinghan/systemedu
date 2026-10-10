"use client"
import Link from "next/link"
import { Play, Pause, Timer, ArrowUpRight } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { useMissionOperations, useMissionWork, type MissionRecord } from "@/lib/hooks/use-mission-operations"
import { duration, taskById, taskCenterHref } from "@/lib/project-lines/space-mission-operations"
import { LearningRecordStatus } from "@/components/learning/learning-record-status"
import s from "./space-mission-control.module.css"

export function WorkClock({model,taskId}:{model:MissionRecord;taskId:string}) {
  const work=useMissionWork(model,taskId)
  return <div className={s.clock} data-mission-clock>
    <div><Timer size={16}/><span>本次工作</span><output aria-label="本次工作用时" data-running={work.running}>{duration(work.elapsed)}</output></div>
    <button type="button" disabled={!model.record.ready||model.record.conflict||model.record.attention||!model.ops} onClick={()=>work.running?work.pause():void work.start()}>{work.running?<Pause size={14}/>:<Play size={14}/>} {work.running?"暂停计时":"开始本次工作"}</button>
    <small>{work.message||"主动开始才计时；切到后台或离开即暂停，每段最多 20 分钟。"}</small>
  </div>
}
export function MissionWorkStrip({taskId}:{taskId:string}) {
  const {owner}=useLearningIdentity()
  if(!taskById(taskId))return null
  return <Strip key={owner+taskId} taskId={taskId}/>
}
function Strip({taskId}:{taskId:string}) {
  const model=useMissionOperations()
  return <section className={s.workStrip} data-mission-work-strip>
    <Link href={taskCenterHref(taskId)}>任务中心 · {taskById(taskId)!.code}<ArrowUpRight size={14}/></Link>
    <WorkClock model={model} taskId={taskId}/>
    <details><summary>子任务累计 {duration(model.ops?.time.totals[taskId]||0)} · 保存状态</summary><LearningRecordStatus record={model.record}/>{model.message&&<p role="alert">{model.message}</p>}</details>
  </section>
}
