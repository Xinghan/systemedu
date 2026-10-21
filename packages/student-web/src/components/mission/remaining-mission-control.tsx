"use client"
import { MissionControl } from "./mission-control"
import type { MissionControlConfig } from "./mission-control-config"
import { REMAINING_MISSIONS, type RemainingMissionId } from "@/lib/project-lines/remaining-missions"
import copy from "@/lib/project-lines/remaining-mission-copy.json"
import { readCourseMissionProgress } from "@/lib/project-lines/course-mission-progress"
import { RemainingBriefing } from "./remaining-briefing"
import { EngineeringTaskContext } from "./engineering-task-context"
import { EngineeringHandoffArchive } from "./engineering-handoff"
const points = [{x:260,y:260},{x:620,y:260},{x:990,y:260},{x:1360,y:260},{x:1360,y:710},{x:990,y:710},{x:620,y:710},{x:260,y:710}].map((p,i,a)=>({...p,path:i<7?`M${p.x} ${p.y} L${a[i+1].x} ${a[i+1].y}`:undefined}))
function config(id: RemainingMissionId): MissionControlConfig {
  const m = REMAINING_MISSIONS[id], text = copy[id]
  const TaskContext = ({task}:{task:{id:string}}) => <EngineeringTaskContext mission={m} task={task} dark/>
  const Dossier = () => <EngineeringHandoffArchive mission={m}/>
  const Briefing = ({stationId,auto}:{stationId:string;auto?:boolean}) => <RemainingBriefing missionId={id} stationId={stationId} auto={auto}/>
  return {title:text.title,identity:text.identity,home:m.home,line:m.line,control:m.control,engine:m.engine,stations:m.stations,steps:m.steps,
    skin:{title:text.title,base:`/mission/${id}/stations`,version:"v1",fallback:`/mission/${id}/stations/discovery-v1`,rooms:Object.fromEntries(m.stations.map(s=>[s.id,s.place]))},
    mapImage:`/mission/${id}/campus-map-v1.webp`,mapPoints:points,Briefing,mapSubtitle:text.handover,motto:"8 个研究站 · 带着自己的证据继续",
    scheduleNote:"按本人投入安排任务；设备准备、打印、采集与训练等待另计。保留未完成项，不用预计用时替代验收。",
    sourceNode:t=>m.node(t.id),classroomHref:t=>m.lessonHref(t.id),initialProgress:()=>Object.fromEntries(m.modules.map(n=>[n.ref,"loading"])),readProgress:(token,owner,update)=>readCourseMissionProgress(m.modules,token,owner,update),taskGroups:m.groups,nextTask:m.nextTask,nextRef:m.nextRef,TaskContext,Dossier}
}
export const remainingControlConfigs = {earth:config("earth"),computing:config("computing"),brain:config("brain")}
export function RemainingMissionControl({id}:{id:RemainingMissionId}) { return <MissionControl config={remainingControlConfigs[id]}/> }
