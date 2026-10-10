import catalog from "./space-mission-tasks.json"
import { missionLessonHref, missionModule, MISSION_STEPS } from "./space-curriculum"
import { createMissionOperations, type MissionTask } from "./mission-operations-core"
import type { LearningScope } from "../api/learning-records"
export * from "./mission-operations-core"
export const OPERATIONS_SCOPE: LearningScope = {library_slug:"space-exploration",module_id:"JOURNEY",activity_id:"mission-operations",kind:"classroom",content_version:"1.0"}
export const SPACE_ENGINE = createMissionOperations(catalog, OPERATIONS_SCOPE, "space-mission-operations/1", MISSION_STEPS)
export const {TASKS, taskById, INITIAL_OPERATIONS, operationsFrom, changeTask, recordWork, mainProgress} = SPACE_ENGINE
export const CONTROL_HREF = "/mission/space/control"
export const taskCenterHref = (id:string) => `${CONTROL_HREF}?task=${encodeURIComponent(id)}`
export const taskClassroomHref = (task:MissionTask) => task.role==="micro"?`/explore/space-exploration/${task.id.slice(6)}?mission=space`:missionLessonHref(task.id)
export const sourceNode = (task:MissionTask) => missionModule(task.id)
