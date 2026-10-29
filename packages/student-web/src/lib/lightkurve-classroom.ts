import type { CourseContent } from "@/lib/types/api"
import type { LightkurveLabMode } from "./lightkurve-preview"

export function lightkurveClassroomTarget(content: CourseContent, view: string | null, mode: LightkurveLabMode) {
  if (view === "assignment") return "course-assignment"
  if (view === "slides") return "lesson-player"
  if (view !== "lab") return null
  const idea = content.ideas.find(item => item.mode === mode && content.rendered_sections[item.idea_id]?.html)
  return idea ? `idea-${idea.idea_id}` : "course-assignment"
}
