import catalog from "./space-mission-tasks.json"
import { missionLessonHref, missionModule, MISSION_STEPS, missionRoute, routeSteps, type SpaceRoute } from "./space-curriculum"
import { createMissionOperations, taskState, type MissionOperations, type MissionTask } from "./mission-operations-core"
import type { LearningScope } from "../api/learning-records"
export * from "./mission-operations-core"
export const OPERATIONS_SCOPE: LearningScope = {library_slug:"space-exploration",module_id:"JOURNEY",activity_id:"mission-operations",kind:"classroom",content_version:"1.0"}
export const SPACE_ENGINE = createMissionOperations(catalog, OPERATIONS_SCOPE, "space-mission-operations/1", MISSION_STEPS)
export const {TASKS, taskById, INITIAL_OPERATIONS, operationsFrom, changeTask, recordWork, mainProgress} = SPACE_ENGINE
export const CONTROL_HREF = "/mission/space/control"
export const taskCenterHref = (id:string) => `${CONTROL_HREF}?task=${encodeURIComponent(id)}`
export const taskClassroomHref = (task:MissionTask) => task.role==="micro"?`/explore/space-exploration/${task.id.slice(6)}?mission=space`:missionLessonHref(task.id)
export const sourceNode = (task:MissionTask) => missionModule(task.id)

/** Keep the shared parser/scope: changing route must never discard the other route's records. */
export function spaceRouteEngine(route: SpaceRoute) {
 const tasks = TASKS.filter(t => missionRoute(t.station) === route), steps = routeSteps(route)
 return {...SPACE_ENGINE, TASKS: tasks, taskById: (id: string) => tasks.find(t => t.id === id), mainProgress: (ops: MissionOperations) => ({done: steps.filter(id => taskState(ops, id).status === "done").length, total: steps.length})}
}
export function nextSpaceTask(route: SpaceRoute, ops: MissionOperations | null) {
 const engine = spaceRouteEngine(route), steps = routeSteps(route)
 if (!ops) return engine.TASKS[0]
 return (ops && engine.TASKS.find(t => taskState(ops, t.id).status === "active")) ||
   (ops && engine.TASKS.find(t => t.role === "micro" && taskState(ops, t.id).status !== "done")) ||
   engine.taskById(steps.find(id => !ops || taskState(ops, id).status !== "done") || steps.at(-1)!)!
}
export function nextSpaceRef(ref: string) {
 const node = missionModule(ref), steps = routeSteps(missionRoute(ref))
 if (ref.startsWith("micro:")) return steps[0]
 if (node?.anchor && steps.includes(node.anchor)) return node.anchor
 const i = steps.indexOf(ref)
 return i < 0 ? undefined : steps[i + 1]
}
