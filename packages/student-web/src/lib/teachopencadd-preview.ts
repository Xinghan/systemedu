import type { LearningResource, ResponsePrompt } from "@/lib/project-lines/guided-course"

export const TEACHOPENCADD_SLUG = "teachopencadd-candidate-research"
export const TEACHOPENCADD_ARTIFACT_MESSAGE = "systemedu-teachopencadd-artifact"
export const TEACHOPENCADD_VIEWS = ["reading", "lab", "slides", "assignment"] as const
export type TeachOpenCADDView = (typeof TEACHOPENCADD_VIEWS)[number]
export type TeachOpenCADDLabMode = "game" | "animation"
export type TeachOpenCADDQuestion = { id: string; question: string; options: string[]; correct: number; explanation: string }
export type TeachOpenCADDRecordConfig = {
  questions: string[]
  response_prompts?: ResponsePrompt[]
  quiz: TeachOpenCADDQuestion[]
  exam?: TeachOpenCADDQuestion[]
  output: string
  resources?: LearningResource[]
  foundations?: { id: string; title: string; body_markdown: string }[]
}
export type TeachOpenCADDModule = { id: string; title: string; stage: string }
export type TeachOpenCADDStage = { id: string; title: string }
export type TeachOpenCADDArtifact = Record<string, unknown>
export function teachopencaddView(value?: string): TeachOpenCADDView {
  return TEACHOPENCADD_VIEWS.includes(value as TeachOpenCADDView) ? value as TeachOpenCADDView : "reading"
}

export function teachopencaddHref(moduleId: string, view: TeachOpenCADDView, mode: TeachOpenCADDLabMode) {
  return `/preview/teachopencadd/${encodeURIComponent(moduleId)}?${new URLSearchParams({ view, mode })}`
}

/** A srcdoc sandbox has an opaque origin. The caller must also verify event.source. */
export function teachopencaddArtifactMessage(value: unknown, moduleId: string): TeachOpenCADDArtifact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const message = value as Record<string, unknown>
  if (Object.keys(message).some(key => !["type", "moduleId", "artifact"].includes(key))) return null
  if (message.type !== TEACHOPENCADD_ARTIFACT_MESSAGE || message.moduleId !== moduleId) return null
  const artifact = message.artifact
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return null
  const seen = new Set<object>()
  let nodes = 0
  function safe(item: unknown, depth: number): boolean {
    if (++nodes > 4000 || depth > 8) return false
    if (item === null || typeof item === "boolean") return true
    if (typeof item === "number") return Number.isFinite(item)
    if (typeof item === "string") return item.length <= 16000
    if (typeof item !== "object" || seen.has(item)) return false
    seen.add(item)
    if (Array.isArray(item)) return item.length <= 1000 && item.every(entry => safe(entry, depth + 1))
    if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return false
    const entries = Object.entries(item)
    return entries.length <= 100 && entries.every(([key, entry]) => key.length > 0 && key.length <= 100 && !/[\u0000-\u001f]/.test(key) && !["__proto__", "constructor", "prototype"].includes(key) && safe(entry, depth + 1))
  }
  if (!safe(artifact, 0) || Object.keys(artifact).length === 0) return null
  const fields = artifact as TeachOpenCADDArtifact
  if (fields.kind !== undefined && (typeof fields.kind !== "string" || fields.kind.length > 120)) return null
  if (fields.title !== undefined && (typeof fields.title !== "string" || fields.title.length > 200)) return null
  try {
    return new TextEncoder().encode(JSON.stringify(artifact)).length <= 64 * 1024 ? fields : null
  } catch { return null }
}
