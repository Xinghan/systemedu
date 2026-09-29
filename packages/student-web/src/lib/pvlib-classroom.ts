import type { CourseContent } from "@/lib/types/api"
import { pvlibIdeaLabMode, type PvlibLabMode } from "./pvlib-preview"

/** Presentation-only repair: keep raw files unchanged for saved record versions. */
export function pvlibClassroomContent(content: CourseContent): CourseContent {
  const repair = (value: string) => value.replace(/\/preview\/pvlib\/media\?path=downloads(?:%2[fF]|\/)pvlib-practice-kit\.zip/g, "#course-downloads")
  return { ...content, plan_markdown: repair(content.plan_markdown), sections: content.sections?.map(section => ({ ...section, body_markdown: repair(section.body_markdown) })) }
}

/** Old review URLs point into the classroom instead of creating parallel views. */
export function pvlibClassroomTarget(content: CourseContent, view: string | null, mode: PvlibLabMode) {
  if (view === "assignment") return "course-assignment"
  if (view === "slides") return "lesson-player"
  if (view !== "lab") return null
  const idea = content.ideas.find(item => pvlibIdeaLabMode(item) === mode && content.rendered_sections[item.idea_id]?.html)
  return idea ? `idea-${idea.idea_id}` : "course-assignment"
}
