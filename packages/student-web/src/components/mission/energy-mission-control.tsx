"use client"
import { MissionControl } from "./mission-control"
import type { MissionControlConfig } from "./mission-control-config"
import { ENERGY_CAMPUS_POINTS, ENERGY_ENGINE, ENERGY_HOME, ENERGY_CONTROL, ENERGY_STATIONS, ENERGY_STEPS, ENERGY_MODULES, ENERGY_ROOM_SKIN, energyNode, energyLessonHref } from "@/lib/project-lines/energy-mission"
import { readCourseMissionProgress } from "@/lib/project-lines/course-mission-progress"
import { EnergyBriefing } from "./energy-briefing"
import { EnergyMissionDossier } from "./energy-mission-dossier"
export const energyControlConfig:MissionControlConfig={title:"未来能源",identity:"RENEWABLE ENERGY / 能源工程实验室",home:ENERGY_HOME,line:"energy-motion",control:ENERGY_CONTROL,engine:ENERGY_ENGINE,stations:ENERGY_STATIONS,steps:ENERGY_STEPS,skin:ENERGY_ROOM_SKIN,mapImage:"/mission/energy/campus-map-v1.webp",mapPoints:ENERGY_CAMPUS_POINTS,Briefing:EnergyBriefing,mapSubtitle:"风光 → 储能 → 联调 → 测量 → 预报 → 验证",motto:"8 个实验室 · 从第一束光到真实功率预报",scheduleNote:"先约定每周投入，再安排各站目标日期。打印、等待合适天气、采集与失败后的复测另留时间。",sourceNode:t=>energyNode(t.id),classroomHref:t=>energyLessonHref(t.id),initialProgress:()=>Object.fromEntries(ENERGY_MODULES.map(n=>[n.ref,"loading"])),readProgress:(token,owner,update)=>readCourseMissionProgress(ENERGY_MODULES,token,owner,update),Dossier:EnergyMissionDossier}
export function EnergyMissionControl(){return <MissionControl config={energyControlConfig}/>}
