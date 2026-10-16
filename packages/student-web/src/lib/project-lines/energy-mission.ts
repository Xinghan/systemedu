import data from "./energy-mission.json"
import { integratedMission } from "./integrated-mission"
import type { MissionRoomSkin } from "@/components/mission/mission-room-environment"
export const ENERGY_MISSION=integratedMission(data,"energy","energy-motion","energy-motion","energy-mission-operations/1")
export const {stations:ENERGY_STATIONS,modules:ENERGY_MODULES,tasks:ENERGY_TASKS,steps:ENERGY_STEPS,groups:ENERGY_GROUPS,engine:ENERGY_ENGINE,home:ENERGY_HOME,control:ENERGY_CONTROL,node:energyNode,context:energyContext,lessonHref:energyLessonHref,mapHref:energyMapHref,centerHref:energyCenterHref,libraryHref:energyLibraryHref}=ENERGY_MISSION
export const energyStation=(id:string)=>ENERGY_STATIONS.find(s=>s.id===id)
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
