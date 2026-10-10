import data from "./energy-mission.json"
import { lessonPath } from "../course-numbering"
import { createMissionOperations, type MissionTask } from "./mission-operations-core"
import type { MissionRoomSkin } from "@/components/mission/mission-room-environment"
export const ENERGY_STATIONS = data.stations
export const ENERGY_MODULES = data.modules
export const ENERGY_STEPS = ENERGY_STATIONS.flatMap(s=>s.steps)
export const ENERGY_TASKS: MissionTask[] = data.tasks
export const ENERGY_HOME = "/mission/energy"
export const ENERGY_CONTROL = `${ENERGY_HOME}/control`
export const energyNode = (ref:string) => ENERGY_MODULES.find(n=>n.ref===ref)
export const energyStation = (id:string) => ENERGY_STATIONS.find(s=>s.id===id)
export const energyCenterHref = (id:string,view="desk") => `${ENERGY_CONTROL}?task=${encodeURIComponent(id)}&view=${view}`
export const energyMapHref = (id?:string) => `${ENERGY_HOME}${id?`?station=${encodeURIComponent(id)}#journey-map`:""}`
export function energyLessonHref(ref:string) {
 if(ref.startsWith("micro:"))return `/explore/energy-motion/${ref.slice(6)}?mission=energy`
 const n=energyNode(ref)
 return !n?ENERGY_HOME:n.kind==="full"?`${lessonPath(n.project,n.module)}?mission=energy`:`/explore/energy-motion/${n.project}?node=${n.module}&mission=energy`
}
export const energyLibraryHref = (project:string,module:string) => `/library/${project}?mission=energy&node=${module}`
export function energyContext(project:string,module:string,enabled:boolean) {
 if(!enabled)return undefined
 const node=energyNode(`${project}:${module}`);if(!node)return undefined
 const station=energyStation(node.station)!,primary=node.mode==="lesson"?node.ref:node.anchor||station.steps[0],i=ENERGY_STEPS.indexOf(primary)
 return {node,station,primary,previous:i>0?ENERGY_STEPS[i-1]:undefined,next:ENERGY_STEPS[i+1]}
}
export const ENERGY_ENGINE = createMissionOperations(ENERGY_TASKS,{library_slug:"energy-motion",module_id:"JOURNEY",activity_id:"mission-operations",kind:"classroom",content_version:"1.0"},"energy-mission-operations/1",ENERGY_STEPS)
export const ENERGY_ROOM_SKIN: MissionRoomSkin = {title:"未来能源 / 能源工程实验室",base:"/mission/energy/stations",version:"v1",fallback:"/mission/energy/stations/discovery-v1",rooms:{discovery:"ENERGY DISCOVERY",harvest:"SOLAR & WIND LAB",storage:"STORAGE & DISPATCH",integration:"SYSTEM INTEGRATION",measurement:"MEASUREMENT LAB",forecast:"FORECAST MODELS",validation:"PROSPECTIVE TEST",handover:"ENGINEERING HANDOVER"}}
export const ENERGY_CAMPUS_POINTS = [
 {x:210,y:255,path:"M210 255 Q390 420 580 255"},
 {x:580,y:255,path:"M580 255 Q765 420 950 255"},
 {x:950,y:255,path:"M950 255 Q1135 420 1320 255"},
 {x:1320,y:255,path:"M1320 255 Q1450 490 1320 745"},
 {x:1320,y:745,path:"M1320 745 Q1135 590 950 745"},
 {x:950,y:745,path:"M950 745 Q765 590 580 745"},
 {x:580,y:745,path:"M580 745 Q395 590 210 745"},
 {x:210,y:745},
]
