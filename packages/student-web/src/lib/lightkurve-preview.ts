import type { LearningResource, ResponsePrompt } from "@/lib/project-lines/guided-course"

export const LIGHTKURVE_SLUG = "lightkurve-transit-detective"
export const LIGHTKURVE_ARTIFACT_MESSAGE = "systemedu-lightkurve-artifact"
export const LIGHTKURVE_VIEWS = ["reading", "lab", "slides", "assignment"] as const
export type LightkurveView = (typeof LIGHTKURVE_VIEWS)[number]
export type LightkurveLabMode = "game" | "animation"
export type LightkurveQuestion = { id: string; question: string; options: string[]; correct: number; explanation: string }
export type LightkurveRecordConfig = {
  questions: string[]
  response_prompts?: ResponsePrompt[]
  quiz: LightkurveQuestion[]
  exam?: LightkurveQuestion[]
  output: string
  resources?: LearningResource[]
  foundations?: { id: string; title: string; body_markdown: string }[]
}
export type LightkurveModule = { id: string; title: string; stage: string }
export type LightkurveStage = { id: string; title: string }
export type LightkurveArtifact = Record<string, unknown>
export type LightkurveFreeze = {
  period: number; epoch: number; duration: number; tolerance: number
  trend_window_day: number; quality_bitmask: number; min_support: number; frozen_at: string
}
export type LightkurveValidationState = { freeze: LightkurveFreeze | null; firstResult: LightkurveArtifact | null }
export type LightkurveValidationMessage =
  | { type: "systemedu-lightkurve-request-state" | "systemedu-lightkurve-request-holdout"; moduleId: string }
  | { type: "systemedu-lightkurve-checkpoint"; moduleId: string; artifact: LightkurveArtifact; state: LightkurveValidationState }

export function lightkurveView(value?: string): LightkurveView {
  return LIGHTKURVE_VIEWS.includes(value as LightkurveView) ? value as LightkurveView : "reading"
}

export function lightkurveHref(moduleId: string, view: LightkurveView, mode: LightkurveLabMode) {
  return `/preview/lightkurve/${encodeURIComponent(moduleId)}?${new URLSearchParams({ view, mode })}`
}

/** A srcdoc sandbox has an opaque origin. The caller must also verify event.source. */
export function lightkurveArtifactMessage(value: unknown, moduleId: string): LightkurveArtifact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const message = value as Record<string, unknown>
  if (Object.keys(message).some(key => !["type", "moduleId", "artifact"].includes(key))) return null
  if (message.type !== LIGHTKURVE_ARTIFACT_MESSAGE || message.moduleId !== moduleId) return null
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
  const fields = artifact as LightkurveArtifact
  if (fields.kind !== undefined && (typeof fields.kind !== "string" || fields.kind.length > 120)) return null
  if (fields.title !== undefined && (typeof fields.title !== "string" || fields.title.length > 200)) return null
  try {
    return new TextEncoder().encode(JSON.stringify(artifact)).length <= 64 * 1024 ? fields : null
  } catch { return null }
}

export function lightkurveValidationState(value: unknown): LightkurveValidationState | null {
  const safe = lightkurveArtifactMessage({ type: LIGHTKURVE_ARTIFACT_MESSAGE, moduleId: "M24", artifact: value }, "M24")
  if (!safe || Object.keys(safe).some(key => !["freeze", "firstResult"].includes(key))) return null
  if (safe.freeze === null && safe.firstResult === null) return { freeze: null, firstResult: null }
  if (!safe.freeze || typeof safe.freeze !== "object" || Array.isArray(safe.freeze)) return null
  const freeze = safe.freeze as Record<string, unknown>
  if (Object.keys(freeze).some(key => !["period", "epoch", "duration", "tolerance", "trend_window_day", "quality_bitmask", "min_support", "frozen_at"].includes(key))) return null
  const number = (key: string) => typeof freeze[key] === "number" && Number.isFinite(freeze[key])
  if (!["period", "epoch", "duration", "tolerance", "trend_window_day", "quality_bitmask", "min_support"].every(number)) return null
  const parsed = freeze as LightkurveFreeze
  if (parsed.period <= 0 || parsed.period > 10000 || parsed.duration <= 0 || parsed.duration >= parsed.period || parsed.tolerance <= 0 || parsed.tolerance > parsed.period || parsed.trend_window_day <= 0 || parsed.trend_window_day > 10000 || !Number.isSafeInteger(parsed.quality_bitmask) || !Number.isSafeInteger(parsed.min_support) || parsed.min_support < 3 || parsed.min_support > 1000 || parsed.quality_bitmask < 0 || parsed.quality_bitmask > 2147483647 || typeof parsed.frozen_at !== "string" || parsed.frozen_at.length > 64 || !Number.isFinite(Date.parse(parsed.frozen_at))) return null
  if (safe.firstResult !== null && (!safe.firstResult || typeof safe.firstResult !== "object" || Array.isArray(safe.firstResult))) return null
  return { freeze: { period: parsed.period, epoch: parsed.epoch, duration: parsed.duration, tolerance: parsed.tolerance, trend_window_day: parsed.trend_window_day, quality_bitmask: parsed.quality_bitmask, min_support: parsed.min_support, frozen_at: parsed.frozen_at }, firstResult: safe.firstResult as LightkurveArtifact | null }
}

/** Source-window equality is checked by ArtifactFrame before this shape validator. */
export function lightkurveValidationMessage(value: unknown, moduleId: string): LightkurveValidationMessage | null {
  if (!["M24", "M25"].includes(moduleId) || !value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (raw.moduleId !== moduleId) return null
  if (raw.type === "systemedu-lightkurve-request-state" || raw.type === "systemedu-lightkurve-request-holdout") {
    if (Object.keys(raw).some(key => !["type", "moduleId"].includes(key))) return null
    return { type: raw.type, moduleId }
  }
  if (raw.type !== "systemedu-lightkurve-checkpoint" || Object.keys(raw).some(key => !["type", "moduleId", "artifact"].includes(key))) return null
  const artifact = lightkurveArtifactMessage({ type: LIGHTKURVE_ARTIFACT_MESSAGE, moduleId, artifact: raw.artifact }, moduleId)
  if (!artifact || artifact.kind !== "validation" || typeof artifact.title !== "string" || Object.keys(artifact).some(key => !["kind", "title", "data"].includes(key))) return null
  const state = lightkurveValidationState(artifact.data)
  if (!state?.freeze) return null
  return { type: "systemedu-lightkurve-checkpoint", moduleId, artifact, state }
}

export const lightkurveValidationKey = (owner: string) => `systemedu:lightkurve-validation:v1:${encodeURIComponent(owner)}`
