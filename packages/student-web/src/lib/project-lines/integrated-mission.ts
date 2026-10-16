import { lessonPath } from "../course-numbering"
import { createMissionOperations, taskState, type MissionOperations, type MissionTask } from "./mission-operations-core"
export type EngineeringGroup={id:string;station:string;title:string;steps:string[];input:string;output:string;transfer:string;path:string}
export type EngineeringNode={ref:string;project:string;module:string;title:string;station:string;mode:string;kind:string;version:string;anchor:string|null;sourceLine:string;group:string;path:string}
export type EngineeringStation={id:string;code:string;place:string;message:string;input:string;handoff:string;gate:string;dependsOn:string[];steps:string[]}
export type Foundation={id:string;project:string;title:string;path:string;uses:string[]}
export type EngineeringData={stations:EngineeringStation[];modules:EngineeringNode[];tasks:MissionTask[];groups:EngineeringGroup[];foundations:Foundation[]}
export function integratedMission(data:EngineeringData,id:string,line:string,sourceLine:string,schema:string){
 const home=`/mission/${id}`,control=`${home}/control`,steps=data.stations.flatMap(s=>s.steps)
 const node=(ref:string)=>data.modules.find(n=>n.ref===ref),groupFor=(ref:string)=>data.groups.find(g=>g.steps.includes(ref))
 const sequence=(ref:string)=>{const path=node(ref)?.path;return path&&path!=="main"?data.groups.filter(g=>g.path===path).flatMap(g=>g.steps):steps}
 const sourceHref=(ref:string)=>{const n=node(ref);return n?n.kind==="full"?lessonPath(n.project,n.module):`/explore/${n.sourceLine}/${n.project}?node=${n.module}`:ref.startsWith("micro:")?`/explore/${sourceLine}/${ref.slice(6)}`:home}
 const lessonHref=(ref:string)=>{const url=sourceHref(ref);return `${url}${url.includes("?")?"&":"?"}mission=${id}`}
 const context=(project:string,module:string,enabled:boolean)=>{if(!enabled)return;const n=node(`${project}:${module}`);if(!n)return;const seq=sequence(n.ref),index=seq.indexOf(n.ref);return {node:n,station:data.stations.find(s=>s.id===n.station)!,group:groupFor(n.ref)!,primary:n.ref,previous:seq[index-1],next:seq[index+1]}}
 const nextTask=(ops:MissionOperations|null)=>{if(!ops)return data.tasks[0];const active=data.tasks.find(t=>taskState(ops,t.id).status==="active");if(active)return active;return data.tasks.some(t=>taskState(ops,t.id).status==="done")?data.tasks.find(t=>t.role==="lesson"&&taskState(ops,t.id).status!=="done")||data.tasks.find(t=>t.id===steps.at(-1))!:data.tasks[0]}
 return {id,line,home,control,...data,steps,node,groupFor,sequence,sourceHref,lessonHref,context,nextTask,
  nextRef:(ref:string)=>ref.startsWith("micro:")?steps[0]:sequence(ref)[sequence(ref).indexOf(ref)+1],
  centerHref:(ref:string,view="desk")=>`${control}?task=${encodeURIComponent(ref)}&view=${view}`,
  mapHref:(station?:string)=>`${home}${station?`?station=${encodeURIComponent(station)}#journey-map`:""}`,
  libraryHref:(project:string,module:string)=>`/library/${project}?mission=${id}&node=${module}`,
  engine:createMissionOperations(data.tasks,{library_slug:line,module_id:"JOURNEY",activity_id:"mission-operations",kind:"classroom",content_version:"1.0"},schema,steps)}
}
export type IntegratedMission=ReturnType<typeof integratedMission>
export type EngineeringContext=NonNullable<ReturnType<IntegratedMission["context"]>>
