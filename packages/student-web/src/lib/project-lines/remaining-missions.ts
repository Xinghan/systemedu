import earth from "./earth-mission.json"
import computing from "./computing-mission.json"
import brain from "./brain-mission.json"
import { integratedMission } from "./integrated-mission"
export const REMAINING_MISSIONS = {
  earth: integratedMission(earth, "earth", "earth-discovery", "earth-discovery", "earth-mission-operations/1"),
  computing: integratedMission(computing, "computing", "computing-ai", "earth-discovery", "computing-mission-operations/1"),
  brain: integratedMission(brain, "brain", "neuro-bionics", "neuro-bionics", "brain-mission-operations/1"),
}
export type RemainingMissionId = keyof typeof REMAINING_MISSIONS
export function remainingMission(id: string | null) {
  return id && Object.hasOwn(REMAINING_MISSIONS, id) ? REMAINING_MISSIONS[id as RemainingMissionId] : undefined
}
export function remainingContext(project: string, module: string, id: string | null) {
  const mission = remainingMission(id), context = mission?.context(project, module, true)
  return mission && context ? { mission, context } : undefined
}
export type RemainingContext = NonNullable<ReturnType<typeof remainingContext>>
