import data from "./robotics-mission.json"
import { integratedMission } from "./integrated-mission"
import type { MissionRoomSkin } from "@/components/mission/mission-room-environment"
export const ROBOTICS_MISSION=integratedMission(data,"robotics","robotics","neuro-bionics","robotics-mission-operations/1")
export const {context:roboticsContext,lessonHref:roboticsLessonHref,mapHref:roboticsMapHref,libraryHref:roboticsLibraryHref}=ROBOTICS_MISSION
export const ROBOTICS_ROOM_SKIN:MissionRoomSkin={title:"机器人觉醒 / 双臂协作实验室",base:"/mission/robotics/stations",version:"v1",fallback:"/mission/robotics/stations/control-v1",rooms:{discovery:"GRASP OBSERVATORY",specification:"INTERFACE CONTRACTS",fabrication:"ADDITIVE FABRICATION",control:"CALIBRATION & CONTROL",demonstration:"DEMONSTRATION DATA",learning:"POLICY LEARNING",validation:"AUTONOMOUS VALIDATION",handover:"ENGINEERING HANDOVER"}}
export const ROBOTICS_CAMPUS_POINTS=[{x:210,y:260,path:"M210 260 Q390 430 590 260"},{x:590,y:260,path:"M590 260 Q780 430 980 260"},{x:980,y:260,path:"M980 260 Q1180 430 1380 260"},{x:1380,y:260,path:"M1380 260 Q1510 500 1380 720"},{x:1380,y:720,path:"M1380 720 Q1170 530 980 720"},{x:980,y:720,path:"M980 720 Q780 530 590 720"},{x:590,y:720,path:"M590 720 Q390 530 210 720"},{x:210,y:720}]
