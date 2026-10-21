"use client"
import { MissionControl } from "./mission-control"
import type { MissionControlConfig } from "./mission-control-config"
import { ROBOTICS_MISSION as m,ROBOTICS_ROOM_SKIN,ROBOTICS_CAMPUS_POINTS } from "@/lib/project-lines/robotics-mission"
import { readCourseMissionProgress } from "@/lib/project-lines/course-mission-progress"
import { RoboticsBriefing } from "./robotics-briefing"
import { EngineeringTaskContext } from "./engineering-task-context"
import { EngineeringHandoffArchive } from "./engineering-handoff"
const TaskContext=({task}:{task:{id:string}})=><EngineeringTaskContext mission={m} task={task} dark/>
const Dossier=()=> <EngineeringHandoffArchive mission={m}/>
export const roboticsControlConfig:MissionControlConfig={title:"机器人觉醒",identity:"BIMANUAL ROBOTICS / 双臂协作实验室",home:m.home,line:m.line,control:m.control,engine:m.engine,stations:m.stations,steps:m.steps,skin:ROBOTICS_ROOM_SKIN,mapImage:"/mission/robotics/campus-map-v1.webp",mapPoints:ROBOTICS_CAMPUS_POINTS,Briefing:RoboticsBriefing,mapSubtitle:"任务 → 打印 → 标定 → 示范 → 训练 → 自主验证",motto:"8 个实验室 · 一次可复现的双臂协作任务",scheduleNote:"先安排每周投入；打印、器材准备、训练和失败后的复测另留时间。按本人进度调整，不把预计用时当完成要求。",sourceNode:t=>m.node(t.id),classroomHref:t=>m.lessonHref(t.id),initialProgress:()=>Object.fromEntries(m.modules.map(n=>[n.ref,"loading"])),readProgress:(token,owner,update)=>readCourseMissionProgress(m.modules,token,owner,update),taskGroups:m.groups,nextTask:m.nextTask,nextRef:m.nextRef,TaskContext,Dossier}
export function RoboticsMissionControl(){return <MissionControl config={roboticsControlConfig}/>}
