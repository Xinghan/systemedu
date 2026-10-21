"use client"
import { REMAINING_MISSIONS, type RemainingMissionId } from "@/lib/project-lines/remaining-missions"
import copy from "@/lib/project-lines/remaining-mission-copy.json"
import { remainingControlConfigs } from "./remaining-mission-control"
import { IntegratedJourney } from "./integrated-journey"
export function RemainingJourney({id}:{id:RemainingMissionId}) { return <IntegratedJourney mission={REMAINING_MISSIONS[id]} config={remainingControlConfigs[id]} copy={copy[id]}/> }
