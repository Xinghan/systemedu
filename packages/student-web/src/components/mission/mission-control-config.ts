import type { ComponentType } from "react"
import type { MissionEngine, MissionTask } from "@/lib/project-lines/mission-operations-core"
import type { MissionRoomSkin } from "./mission-room-environment"
import type { MissionNodeState } from "@/lib/project-lines/space-mission-progress"
export type ControlStation = {id:string;code:string;place:string;message:string;input:string;handoff:string;gate:string;dependsOn:string[];steps:string[]}
export type MissionControlConfig = {
 title:string; identity:string; home:string; line:string; control:string; engine:MissionEngine; stations:ControlStation[]; steps:string[];
 skin:MissionRoomSkin; mapImage?:string; mapPoints?:{x:number;y:number;path?:string}[]; Briefing?:ComponentType<{stationId:string;auto?:boolean}>; mapSubtitle:string; motto:string; scheduleNote:string;
 sourceNode:(task:MissionTask)=>{anchor?:string|null}|undefined;
 classroomHref:(task:MissionTask)=>string;
 initialProgress:()=>Record<string,MissionNodeState>;
 readProgress:(token:string|null,owner:string,update:(ref:string,state:MissionNodeState)=>void)=>Promise<void>;
 Dossier:ComponentType
}
