"use client"
import { MissionControl } from "./mission-control"
import type { MissionControlConfig } from "./mission-control-config"
import { BIO_CAMPUS_POINTS, BIO_ENGINE, BIO_HOME, BIO_CONTROL, BIO_STATIONS, BIO_STEPS, BIO_MODULES, BIO_ROOM_SKIN, bioNode, bioLessonHref } from "@/lib/project-lines/biomed-mission"
import { readCourseMissionProgress } from "@/lib/project-lines/course-mission-progress"
import { BiomedBriefing } from "./biomed-briefing"
import { BiomedMissionDossier } from "./biomed-mission-dossier"
export const biomedControlConfig:MissionControlConfig={title:"分子寻药",identity:"MOLECULAR DISCOVERY / 计算发现基地",home:BIO_HOME,line:"biomedicine",control:BIO_CONTROL,engine:BIO_ENGINE,stations:BIO_STATIONS,steps:BIO_STEPS,skin:BIO_ROOM_SKIN,mapImage:"/mission/biomedicine/campus-map-v1.webp",mapPoints:BIO_CAMPUS_POINTS,Briefing:BiomedBriefing,mapSubtitle:"观察 → 筛选 → 检验 → 系统 → 真实数据研究",motto:"8 个任务站 · 一条可复核的证据链",scheduleNote:"先约定每周投入，再安排各站目标日期。数据核查、代码复跑与失败后的修订都需要时间；不用赶着交出漂亮结果。",sourceNode:t=>bioNode(t.id),classroomHref:t=>bioLessonHref(t.id),initialProgress:()=>Object.fromEntries(BIO_MODULES.map(n=>[n.ref,"loading"])),readProgress:(token,owner,update)=>readCourseMissionProgress(BIO_MODULES,token,owner,update),Dossier:BiomedMissionDossier}
export function BiomedMissionControl(){return <MissionControl config={biomedControlConfig}/>}
