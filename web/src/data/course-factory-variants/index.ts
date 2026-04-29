import type { CourseContent } from "@/lib/types/api"
import rocketDesignNode22 from "./rocket-design-node-22"

export interface CourseFactoryVariant {
  label: string
  courseContent: CourseContent
}

const VARIANTS: Record<string, CourseFactoryVariant> = {
  "rocket-design:22": {
    label: "course_factory 新版 · phys theme",
    courseContent: rocketDesignNode22 as CourseContent,
  },
}

export function getCourseFactoryVariant(
  projectName: string,
  nodeId: number,
): CourseFactoryVariant | null {
  return VARIANTS[`${projectName}:${nodeId}`] ?? null
}
