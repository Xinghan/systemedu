"use client"
import { MissionControl } from "./mission-control"
import type { MissionControlConfig } from "./mission-control-config"
import { SPACE_ENGINE, CONTROL_HREF, taskClassroomHref, sourceNode } from "@/lib/project-lines/space-mission-operations"
import { MISSION_STATIONS, MISSION_STEPS } from "@/lib/project-lines/space-curriculum"
import { initialMissionProgress, readMissionProgress } from "@/lib/project-lines/space-mission-progress"
import { SPACE_ROOM_SKIN } from "./mission-room-environment"
import { SpaceMissionDossier } from "./space-mission-dossier"
import { useSearchParams } from "next/navigation"
import { missionRoute, routeStations, routeSteps, type SpaceRoute } from "@/lib/project-lines/space-curriculum"
import { spaceRouteEngine, nextSpaceTask, nextSpaceRef } from "@/lib/project-lines/space-mission-operations"
import { SpaceRouteNavigation } from "./space-route-navigation"
import { SpaceTransitDossier } from "./space-transit-journey"
import { TransitStageBriefing } from "./space-transit-briefing"
import { TRANSIT_CAMPUS_IMAGE, TRANSIT_MAP_POINTS, TRANSIT_ROOM_SCENES } from "@/lib/project-lines/space-transit-presentation"
const config:MissionControlConfig={title:"星际远航",identity:"MARS ANALOG RESEARCH / 星际远航研究基地",home:"/mission/space",line:"space-exploration",control:CONTROL_HREF,engine:SPACE_ENGINE,stations:MISSION_STATIONS,steps:MISSION_STEPS,skin:SPACE_ROOM_SKIN,mapSubtitle:"观察 → 设计 → 制造 → 视觉与控制 → 远征交付",motto:"8 个任务站 · 同一辆车持续升级",scheduleNote:"先约定每周投入，再决定各站的目标日期。制作、打印等待和失败后的调整都需要留出余量。",sourceNode,classroomHref:taskClassroomHref,initialProgress:initialMissionProgress,readProgress:readMissionProgress,Dossier:SpaceMissionDossier}
const routeConfig = (route: SpaceRoute): MissionControlConfig => ({...config,
 stations: routeStations(route), steps: routeSteps(route), engine: spaceRouteEngine(route),
 nextTask: ops => nextSpaceTask(route, ops), nextRef: nextSpaceRef,
 home: `/mission/space?route=${route}`,
 ...(route === "transit" ? {title:"星际远航 · 凌星调查", identity:"LIGHTKURVE / 可复跑的真实观测研究", mapSubtitle:"猜想 → 数据 → 周期 → 反例 → 独立验证 → 复现", motto:"6 个任务站 · 同一份证据册", scheduleNote:"先安排每周调查时间；为下载数据、检查首次失败和从空环境复跑留出余量。", mapPoints:TRANSIT_MAP_POINTS, mapImage:TRANSIT_CAMPUS_IMAGE, Briefing:TransitStageBriefing, skin:{...SPACE_ROOM_SKIN, title:"星际远航 / 凌星调查基地", scenes:TRANSIT_ROOM_SCENES, rooms:{"transit-p1":"OBSERVATION", "transit-p2":"DATA PREPARATION", "transit-p3":"PERIOD SEARCH", "transit-p4":"COUNTEREVIDENCE", "transit-p5":"INDEPENDENT VALIDATION", "transit-p6":"REPRODUCTION"}}, Dossier:SpaceTransitDossier} : {}),
})
const configs = {rover: routeConfig("rover"), transit: routeConfig("transit")}
export function SpaceMissionControl(){
 const search = useSearchParams()
 const route = search.get("task") ? missionRoute(search.get("task")!) : search.get("route") === "transit" ? "transit" : "rover"
 return <><SpaceRouteNavigation route={route} control/><MissionControl key={route} config={configs[route]}/></>
}
