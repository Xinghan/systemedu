"use client"
import { ENERGY_MISSION } from "@/lib/project-lines/energy-mission"
import type { EngineeringContext } from "@/lib/project-lines/integrated-mission"
import { EngineeringWorkStrip, EngineeringLessonBrief, EngineeringLessonOutline, EngineeringLessonFooter } from "./engineering-mission-lesson"
import { EnergyBriefing } from "./energy-briefing"
export const EnergyWorkStrip=({taskId}:{taskId:string})=><EngineeringWorkStrip mission={ENERGY_MISSION} taskId={taskId}/>
export const EnergyLessonBrief=({context}:{context:EngineeringContext})=><EngineeringLessonBrief mission={ENERGY_MISSION} context={context} Briefing={EnergyBriefing}/>
export const EnergyLessonOutline=({context}:{context:EngineeringContext})=><EngineeringLessonOutline mission={ENERGY_MISSION} context={context}/>
export const EnergyLessonFooter=({context}:{context:EngineeringContext})=><EngineeringLessonFooter mission={ENERGY_MISSION} context={context}/>
