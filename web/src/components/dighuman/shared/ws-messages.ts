// Ported from ~/Dev/systemdighuman/packages/shared/src/ws-messages.ts
// Server → client WebSocket frames + viseme types.
import type { VisemeFrame, VisemeId } from "./visemes"
import { VISEME_SET } from "./visemes"

export type Lang = "en" | "zh"

export type ServerFrame =
  | { type: "speech_start"; utterance_id: string; duration_ms: number; lang: Lang }
  | { type: "audio_header"; utterance_id: string; codec: "mp3" | "opus" | "wav"; byte_length: number }
  | { type: "viseme_track"; utterance_id: string; frames: VisemeFrame[] }
  | { type: "speech_end"; utterance_id: string }
  | { type: "speech_interrupt"; utterance_id: string }
  | { type: "error"; code: string; message: string }

// Lightweight runtime check (replaces zod parsing). The dighuman server is trusted
// internal infra so we accept the shape if it has a known `type` and required fields.
export function parseServerFrame(raw: unknown): ServerFrame | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const type = o.type
  if (typeof type !== "string") return null
  switch (type) {
    case "speech_start":
      if (typeof o.utterance_id !== "string") return null
      if (typeof o.duration_ms !== "number") return null
      if (o.lang !== "en" && o.lang !== "zh") return null
      return { type, utterance_id: o.utterance_id, duration_ms: o.duration_ms, lang: o.lang }
    case "audio_header":
      if (typeof o.utterance_id !== "string") return null
      if (o.codec !== "mp3" && o.codec !== "opus" && o.codec !== "wav") return null
      if (typeof o.byte_length !== "number") return null
      return { type, utterance_id: o.utterance_id, codec: o.codec, byte_length: o.byte_length }
    case "viseme_track":
      if (typeof o.utterance_id !== "string") return null
      if (!Array.isArray(o.frames)) return null
      return { type, utterance_id: o.utterance_id, frames: o.frames as VisemeFrame[] }
    case "speech_end":
    case "speech_interrupt":
      if (typeof o.utterance_id !== "string") return null
      return { type, utterance_id: o.utterance_id } as ServerFrame
    case "error":
      if (typeof o.code !== "string" || typeof o.message !== "string") return null
      return { type, code: o.code, message: o.message }
    default:
      return null
  }
}

// Re-export common types for convenience
export type { VisemeFrame, VisemeId }
export { VISEME_SET }
