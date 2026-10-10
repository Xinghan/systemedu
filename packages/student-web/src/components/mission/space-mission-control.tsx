"use client"
import { MissionControl } from "./mission-control"
import type { MissionControlConfig } from "./mission-control-config"
import { SPACE_ENGINE, CONTROL_HREF, taskClassroomHref, sourceNode } from "@/lib/project-lines/space-mission-operations"
import { MISSION_STATIONS, MISSION_STEPS } from "@/lib/project-lines/space-curriculum"
import { initialMissionProgress, readMissionProgress } from "@/lib/project-lines/space-mission-progress"
import { SPACE_ROOM_SKIN } from "./mission-room-environment"
import { SpaceMissionDossier } from "./space-mission-dossier"
const config:MissionControlConfig={title:"星际远航",identity:"MARS ANALOG RESEARCH / 星际远航研究基地",home:"/mission/space",line:"space-exploration",control:CONTROL_HREF,engine:SPACE_ENGINE,stations:MISSION_STATIONS,steps:MISSION_STEPS,skin:SPACE_ROOM_SKIN,mapSubtitle:"观察 → 设计 → 制造 → 视觉与控制 → 远征交付",motto:"8 个任务站 · 同一辆车持续升级",scheduleNote:"先约定每周投入，再决定各站的目标日期。制作、打印等待和失败后的调整都需要留出余量。",sourceNode,classroomHref:taskClassroomHref,initialProgress:initialMissionProgress,readProgress:readMissionProgress,Dossier:SpaceMissionDossier}
export function SpaceMissionControl(){return <MissionControl config={config}/>}
