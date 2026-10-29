import type { LearningScope } from "../api/learning-records"
import { readCourseMissionProgress } from "./course-mission-progress"
import { MISSION_MODULES, MISSION_MICRO, routeStations, routeSteps, type SpaceRoute } from "./space-curriculum"
import { readJourneyProject, hasJourneyEvidence, type JourneyProgressMap } from "./space-journey-progress"
import { JOURNEY_IDS } from "./space-journey"

export type MissionNodeState = "loading" | "new" | "recorded" | "draft" | "marked" | "guest" | "unknown"
export type MissionProgress = Record<string, MissionNodeState>
export const initialMissionProgress = (): MissionProgress => Object.fromEntries(MISSION_MODULES.map(m => [m.ref, "loading"]))
export function reflectionScope(project: string, module: string, version: string): LearningScope {
  return { library_slug: project, module_id: module, activity_id: "reflection", kind: "classroom", content_version: version }
}
export const nodeHasRecord = (state?: MissionNodeState) => state === "recorded" || state === "marked"
export const nodeProgressLabel = (state?: MissionNodeState) => ({ loading: "读取记录", new: "待学习", recorded: "已提交记录", draft: "有草稿", marked: "原课已标记", guest: "登录后读取", unknown: "读取失败 · 可重试" }[state || "loading"])
export async function readMissionProgress(token: string | null, owner: string, update: (ref: string, state: MissionNodeState) => void) {
  await readCourseMissionProgress(MISSION_MODULES, token, owner, update)
}
export async function readMissionProjects(token: string | null, owner: string, update: (id: string, value: JourneyProgressMap[string]) => void) {
  await Promise.all(JOURNEY_IDS.map(async id => update(id, await readJourneyProject(id, token, owner))))
}
export function recommendMission(nodes: MissionProgress, projects: JourneyProgressMap, route: SpaceRoute = "rover") {
  const MISSION_STEPS = routeSteps(route), MISSION_STATIONS = routeStations(route)
  const draft = MISSION_STEPS.find(ref => nodes[ref] === "draft")
  if (draft) return { ref: draft, station: MISSION_MODULES.find(m => m.ref === draft)!.station }
  const begun = route === "transit" || MISSION_MICRO.some(id => hasJourneyEvidence(projects[id])) || MISSION_STEPS.some(ref => nodeHasRecord(nodes[ref])) || Object.entries(projects).some(([id, value]) => id !== "lightkurve-transit-detective" && hasJourneyEvidence(value))
  if (!begun) return { ref: null, station: MISSION_STATIONS[0].id }
  const ref = MISSION_STEPS.find(id => !nodeHasRecord(nodes[id]))
  return { ref: ref || null, station: ref ? MISSION_MODULES.find(m => m.ref === ref)!.station : MISSION_STATIONS.at(-1)!.id }
}
