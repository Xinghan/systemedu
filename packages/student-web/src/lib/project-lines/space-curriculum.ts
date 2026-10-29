import data from "./space-curriculum.json"
import { lessonPath } from "../course-numbering"
import type { SpaceStage } from "./space-stage-films"

export type MissionModule = typeof data.modules[number]
export type MissionStation = Omit<typeof data.stations[number], "level" | "film"> & { level: SpaceStage; film: SpaceStage | null }
export const MISSION_STATIONS = data.stations as MissionStation[]
export const MISSION_MODULES = data.modules
export const MISSION_STEPS = MISSION_STATIONS.flatMap(s => s.steps)
export type SpaceRoute = "rover" | "transit"
export const missionRoute = (refOrStation: string): SpaceRoute => refOrStation.startsWith("lightkurve-transit-detective:") || refOrStation.startsWith("transit-") ? "transit" : "rover"
export const routeStations = (route: SpaceRoute) => MISSION_STATIONS.filter(s => missionRoute(s.id) === route)
export const routeSteps = (route: SpaceRoute) => routeStations(route).flatMap(s => s.steps)
export const routeMapHref = (route: SpaceRoute) => `/mission/space?route=${route}#journey-map`
export const MISSION_MICRO = data.micro
export const MISSION_BRIDGES = data.bridges
export const MISSION_QUERY = "mission=space"
export const missionModule = (ref: string) => MISSION_MODULES.find(m => m.ref === ref)
export const missionStation = (id: string) => MISSION_STATIONS.find(s => s.id === id)
export const missionMapHref = (id?: string) => `/mission/space${id ? `?station=${encodeURIComponent(id)}#journey-map` : ""}`
export function missionLessonHref(ref: string) {
  const node = missionModule(ref)
  if (!node) return missionMapHref()
  return node.kind === "full" ? `${lessonPath(node.project, node.module)}?${MISSION_QUERY}` : `/explore/space-exploration/${node.project}?node=${node.module}&${MISSION_QUERY}`
}
export function missionContext(project: string, module: string, enabled: boolean) {
  if (!enabled) return undefined
  const node = missionModule(`${project}:${module}`)
  if (!node) return undefined
  const station = missionStation(node.station)!
  const primary = node.mode === "lesson" ? node.ref : node.anchor && missionModule(node.anchor)?.mode === "lesson" ? node.anchor : station.steps[0]
  const route = missionRoute(node.ref), steps = routeSteps(route)
  const index = steps.indexOf(primary)
  return { node, station, primary, route, previous: index > 0 ? steps[index - 1] : undefined, next: index >= 0 ? steps[index + 1] : steps[0] }
}
export function stationStartHref(id: string) {
  const station = missionStation(id)
  return station?.steps[0] ? missionLessonHref(station.steps[0]) : "/explore/space-exploration/spot-a-world?mission=space"
}
export function missionLibraryHref(module: string, project = "mars-analog-rover") {
  return `/library/${encodeURIComponent(project)}?${MISSION_QUERY}&node=${encodeURIComponent(module)}`
}
export const sourceLessonHref = (node: MissionModule) => node.kind === "full" ? lessonPath(node.project, node.module) : `/explore/space-exploration/${node.project}?node=${node.module}`
export const missionSupport = (ref: string) => MISSION_MODULES.filter(m => m.anchor === ref)
