import data from "./biomed-mission.json"
import { lessonPath } from "../course-numbering"
import { createMissionOperations, type MissionTask } from "./mission-operations-core"
import type { MissionRoomSkin } from "@/components/mission/mission-room-environment"
export const BIO_STATIONS = data.stations
export const BIO_MODULES = data.modules
export const BIO_STEPS = BIO_STATIONS.flatMap(s=>s.steps)
export const BIO_TASKS: MissionTask[] = data.tasks
export const BIO_HOME = "/mission/biomedicine"
export const BIO_CONTROL = `${BIO_HOME}/control`
export const bioNode = (ref:string) => BIO_MODULES.find(n=>n.ref===ref)
export const bioStation = (id:string) => BIO_STATIONS.find(s=>s.id===id)
export const bioCenterHref = (id:string,view="desk") => `${BIO_CONTROL}?task=${encodeURIComponent(id)}&view=${view}`
export const bioMapHref = (id?:string) => `${BIO_HOME}${id?`?station=${encodeURIComponent(id)}#journey-map`:""}`
export function bioLessonHref(ref:string) {
 if(ref.startsWith("micro:"))return `/explore/biomedicine/${ref.slice(6)}?mission=biomedicine`
 const n=bioNode(ref)
 return !n?BIO_HOME:n.kind==="full"?`${lessonPath(n.project,n.module)}?mission=biomedicine`:`/explore/biomedicine/${n.project}?node=${n.module}&mission=biomedicine`
}
export const bioLibraryHref = (project:string,module:string) => `/library/${project}?mission=biomedicine&node=${module}`
export function bioContext(project:string,module:string,enabled:boolean) {
 if(!enabled)return undefined
 const node=bioNode(`${project}:${module}`);if(!node)return undefined
 const station=bioStation(node.station)!,primary=node.mode==="lesson"?node.ref:node.anchor||station.steps[0],i=BIO_STEPS.indexOf(primary)
 return {node,station,primary,previous:i>0?BIO_STEPS[i-1]:undefined,next:BIO_STEPS[i+1]}
}
export const BIO_ENGINE = createMissionOperations(BIO_TASKS,{library_slug:"biomedicine",module_id:"JOURNEY",activity_id:"mission-operations",kind:"classroom",content_version:"1.0"},"biomed-mission-operations/1",BIO_STEPS)
export const BIO_ROOM_SKIN: MissionRoomSkin = {title:"分子寻药 / 计算发现基地",base:"/mission/biomedicine/stations",fallback:"/mission/biomedicine/stations/observation-v1",rooms:{observation:"MOLECULAR OBSERVATORY",filter:"SCREENING RULES",prediction:"PREDICTION CHECK",systems:"DISCOVERY WORKBENCH",protocol:"RESEARCH PROTOCOL",data:"DATA & BASELINE",evaluation:"MODEL EVALUATION",delivery:"CANDIDATE REVIEW"}}

/** Coordinates align the interactive pins with the generated campus pavilions. */
export const BIO_CAMPUS_POINTS = [
 {x:240,y:310,path:"M240 310 Q405 360 595 205"},
 {x:595,y:205,path:"M595 205 Q770 325 965 260"},
 {x:965,y:260,path:"M965 260 Q1135 320 1310 380"},
 {x:1310,y:380,path:"M1310 380 Q1480 450 1330 615"},
 {x:1330,y:615,path:"M1330 615 Q1280 850 940 725"},
 {x:940,y:725,path:"M940 725 Q735 800 520 665"},
 {x:520,y:665,path:"M520 665 Q305 750 210 555"},
 {x:210,y:555},
]
