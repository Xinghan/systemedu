"use client"
import { ROBOTICS_MISSION } from "@/lib/project-lines/robotics-mission"
import type { EngineeringContext } from "@/lib/project-lines/integrated-mission"
import { EngineeringWorkStrip, EngineeringLessonBrief, EngineeringLessonOutline, EngineeringLessonFooter } from "./engineering-mission-lesson"
import { RoboticsBriefing } from "./robotics-briefing"
export const RoboticsWorkStrip=({taskId}:{taskId:string})=><EngineeringWorkStrip mission={ROBOTICS_MISSION} taskId={taskId}/>
export const RoboticsLessonBrief=({context}:{context:EngineeringContext})=><EngineeringLessonBrief mission={ROBOTICS_MISSION} context={context} Briefing={RoboticsBriefing}/>
export const RoboticsLessonOutline=({context}:{context:EngineeringContext})=><EngineeringLessonOutline mission={ROBOTICS_MISSION} context={context}/>
export const RoboticsLessonFooter=({context}:{context:EngineeringContext})=><EngineeringLessonFooter mission={ROBOTICS_MISSION} context={context}/>
