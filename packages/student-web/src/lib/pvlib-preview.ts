import type { LearningResource, ResponsePrompt } from "@/lib/project-lines/guided-course"
import type { CourseIdeaSummary } from "@/lib/types/api"

export const PVLIB_SLUG = "pvlib-solar-forecast-station"
export const PVLIB_ARTIFACT_MESSAGE = "systemedu-pvlib-artifact"
export const PVLIB_VIEWS = ["reading", "lab", "slides", "assignment"] as const
export type PvlibView = (typeof PVLIB_VIEWS)[number]
export const PVLIB_LAB_MODES = ["animation", "game", "object"] as const
export type PvlibLabMode = (typeof PVLIB_LAB_MODES)[number]
export type PvlibQuestion = { id: string; question: string; options: string[]; correct: number; explanation: string }
export type PvlibRecordConfig = {
  questions: string[]
  response_prompts?: ResponsePrompt[]
  quiz: PvlibQuestion[]
  exam?: PvlibQuestion[]
  output: string
  resources?: LearningResource[]
  foundations?: { id: string; title: string; body_markdown: string }[]
}
export type PvlibModule = { id: string; title: string; stage: string }
export type PvlibStage = { id: string; title: string }
export type PvlibArtifact = Record<string, unknown>

/** Only return the saved payload for this exact lesson and experiment. */
export function pvlibSavedArtifact(value: unknown, moduleId: string, ideaId: string): PvlibArtifact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const saved = value as Record<string, unknown>
  if (saved.source !== "pvlib-interactive" || saved.module_id !== moduleId || saved.idea_id !== ideaId) return null
  return pvlibArtifactMessage({ type: PVLIB_ARTIFACT_MESSAGE, moduleId, artifact: saved.payload }, moduleId)
}

export function pvlibArtifactReady(value: unknown, moduleId: string, ideaId: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const message = value as Record<string, unknown>
  return Object.keys(message).length === 3 && message.type === "systemedu-pvlib-artifact-ready" && message.module_id === moduleId && message.idea_id === ideaId
}
export function pvlibView(value?: string): PvlibView {
  return PVLIB_VIEWS.includes(value as PvlibView) ? value as PvlibView : "reading"
}

export function pvlibLabMode(value?: string): PvlibLabMode {
  return PVLIB_LAB_MODES.includes(value as PvlibLabMode) ? value as PvlibLabMode : "game"
}

/** Hardware uses the existing diagram contract, never the game save contract. */
export function pvlibIdeaLabMode(idea: CourseIdeaSummary): PvlibLabMode | null {
  if (idea.style_key === "lecture_readonly") return null
  if (idea.mode === "diagram" && idea.style_key === "hardware_object_3d") return "object"
  if (idea.mode === "animation" || idea.mode === "diagram") return "animation"
  return idea.mode === "game" ? "game" : null
}

export function pvlibHref(moduleId: string, view: PvlibView, mode: PvlibLabMode, published = false) {
  return `${published ? `/learn/${PVLIB_SLUG}` : "/preview/pvlib"}/${encodeURIComponent(moduleId)}?${new URLSearchParams({ view, mode })}`
}

/** A srcdoc sandbox has an opaque origin. The caller must also verify event.source. */
export function pvlibArtifactMessage(value: unknown, moduleId: string): PvlibArtifact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const message = value as Record<string, unknown>
  if (Object.keys(message).some(key => !["type", "moduleId", "artifact"].includes(key))) return null
  if (message.type !== PVLIB_ARTIFACT_MESSAGE || message.moduleId !== moduleId) return null
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
  const fields = artifact as PvlibArtifact
  if (fields.kind !== undefined && (typeof fields.kind !== "string" || fields.kind.length > 120)) return null
  if (fields.title !== undefined && (typeof fields.title !== "string" || fields.title.length > 200)) return null
  try {
    return new TextEncoder().encode(JSON.stringify(artifact)).length <= 64 * 1024 ? fields : null
  } catch { return null }
}
