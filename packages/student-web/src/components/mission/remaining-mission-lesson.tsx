"use client"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { remainingMission, type RemainingContext } from "@/lib/project-lines/remaining-missions"
import { remainingControlConfigs } from "./remaining-mission-control"
import { EngineeringWorkStrip, EngineeringLessonBrief, EngineeringLessonOutline, EngineeringLessonFooter } from "./engineering-mission-lesson"
export const RemainingLessonBrief=({context:c}:{context:RemainingContext})=><EngineeringLessonBrief mission={c.mission} context={c.context} Briefing={remainingControlConfigs[c.mission.id as keyof typeof remainingControlConfigs].Briefing}/>
export const RemainingLessonOutline=({context:c}:{context:RemainingContext})=><EngineeringLessonOutline mission={c.mission} context={c.context}/>
export const RemainingLessonFooter=({context:c}:{context:RemainingContext})=><EngineeringLessonFooter mission={c.mission} context={c.context}/>
export function RemainingMicroBridge({project,after=false}:{project:string;after?:boolean}) {
  const m=remainingMission(useSearchParams().get("mission")),task=m?.tasks.find(t=>t.id===`micro:${project}`)
  if(!m||!task)return null
  const config=remainingControlConfigs[m.id as keyof typeof remainingControlConfigs],Briefing=config.Briefing!
  return after ? <p><Link href={m.lessonHref(m.steps[0])}>带着这次发现，领取下一任务 →</Link></p> : <><p><Link href={m.home}>← {config.title} · 任务地图</Link></p><EngineeringWorkStrip mission={m} taskId={task.id}/><Briefing stationId={task.station}/></>
}
