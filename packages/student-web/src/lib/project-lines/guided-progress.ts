import { runRules, validRules } from "../../../public/project-lines/space-exploration/_shared/models.mjs"
import type { GuidedCourse } from "./guided-course"

export const COURSE_STORAGE_KEY = "systemedu:guided-course:write-driving-rules:v1"
export type NodeRecord = { answers: string[]; submitted_at?: string }
export type CourseRecord = {
  schema_version: "guided-learning-record/1"
  course_id: string
  course_version: string
  nodes: Record<string, NodeRecord>
  lab_artifact?: Record<string, unknown>
}

export function newCourseRecord(course: GuidedCourse): CourseRecord {
  return { schema_version: "guided-learning-record/1", course_id: course.id, course_version: course.version, nodes: {} }
}

export function parseCourseRecord(raw: string, course: GuidedCourse): CourseRecord {
  const data = JSON.parse(raw)
  if (data?.schema_version !== "guided-learning-record/1" || data.course_id !== course.id || data.course_version !== course.version || !data.nodes || Array.isArray(data.nodes) || typeof data.nodes !== "object") throw new Error("课程记录格式不兼容")
  for (const [id, value] of Object.entries(data.nodes)) {
    const learningNode = course.modules.find(node => node.module_id === id)
    const record = value as NodeRecord | null
    if (!learningNode || !record || !Array.isArray(record.answers) || record.answers.length !== learningNode.questions.length || !record.answers.every(a => typeof a === "string" && a.length <= 5000) || (record.submitted_at != null && (typeof record.submitted_at !== "string" || !Number.isFinite(Date.parse(record.submitted_at)) || !record.answers.every(a => a.trim())))) throw new Error("节点记录损坏")
  }
  if (data.lab_artifact && !verifiedDrivingArtifact(data.lab_artifact)) throw new Error("关联实验记录损坏")
  return data
}

export function verifiedDrivingArtifact(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false
  const record = value as { schema_version?: string; artifact_id?: string; origin?: string; scene_version?: string; controller_version?: string; program?: { rules?: unknown }; evidence?: { runs?: unknown[] } }
  if (record.schema_version !== "write-driving-rules/1" || record.artifact_id !== "driving-rules" || record.origin !== "simulated" || record.scene_version !== "mars-training/1" || record.controller_version !== "terrain-actions/1" || !validRules(record.program?.rules) || !Array.isArray(record.evidence?.runs) || record.evidence.runs.length > 50) return false
  return (["training", "transfer"] as const).every(route => {
    const expected = runRules(record.program!.rules as Parameters<typeof runRules>[0], route)
    return expected.passed && record.evidence!.runs!.some(value => {
      if (!value || typeof value !== "object") return false
      const run = value as ReturnType<typeof runRules>
      return run.route_id === route && run.signature === expected.signature && run.passed === true && run.status === expected.status && JSON.stringify(run.trace) === JSON.stringify(expected.trace) && JSON.stringify(run.steps) === JSON.stringify(expected.steps)
    })
  })
}
