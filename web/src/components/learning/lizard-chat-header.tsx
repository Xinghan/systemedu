// AI Tutor 面板顶部的 2D 蜥蜴老师, 监听 chat store, 收到 assistant 新消息后
// 自动让蜥蜴说出来. 复用 dighuman LizardScene + useDighumanSession hook.
"use client"

import { useEffect, useRef } from "react"
import { LizardScene } from "@/components/dighuman/LizardScene"
import { useDighumanSession } from "@/components/dighuman/use-dighuman-session"
import { useChatStore } from "@/lib/stores/chat-store"

interface LizardChatHeaderProps {
  /** Height of the lizard area in px. */
  height?: number
  /** Mute auto-speak (e.g. user explicitly disabled). */
  muted?: boolean
}

/** Heuristic Chinese / English detector — pick TTS lang automatically. */
function detectLang(text: string): "zh" | "en" {
  const cn = (text.match(/[一-龥]/g) ?? []).length
  const en = (text.match(/[A-Za-z]/g) ?? []).length
  return cn > en ? "zh" : "en"
}

/** Strip markdown / code fences / urls so TTS doesn't read raw syntax aloud. */
function cleanForTts(raw: string): string {
  let s = raw
  // Code blocks
  s = s.replace(/```[\s\S]*?```/g, " ")
  // Inline code
  s = s.replace(/`[^`]*`/g, "")
  // Markdown links [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  // Bare URLs
  s = s.replace(/https?:\/\/\S+/g, " ")
  // Markdown headings / list bullets / emphasis
  s = s.replace(/^[#>\-*+]\s+/gm, "")
  s = s.replace(/[*_~]+/g, "")
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim()
  // Trim length: 4000-char hard limit on dighuman speak; 600 chars is plenty for tutor reply
  if (s.length > 600) s = `${s.slice(0, 600)}...`
  return s
}

export function LizardChatHeader({ height = 280, muted = false }: LizardChatHeaderProps) {
  const { connected, speak, stop } = useDighumanSession()
  const { sessions, activeSessionId } = useChatStore()
  const lastSpokenIdRef = useRef<string | null>(null)

  // Watch the active session's last message; when a new assistant message lands,
  // tell the lizard to say it. Only speaks once per assistant message.
  useEffect(() => {
    if (muted || !connected) return
    const sess = sessions.find((s) => s.id === activeSessionId)
    if (!sess || sess.messages.length === 0) return
    const last = sess.messages[sess.messages.length - 1]
    if (!last) return
    if (last.role !== "assistant") return
    const id = `${sess.id}:${sess.messages.length - 1}`
    if (lastSpokenIdRef.current === id) return
    lastSpokenIdRef.current = id
    const cleaned = cleanForTts(last.content ?? "")
    if (!cleaned) return
    const lang = detectLang(cleaned)
    speak(cleaned, lang).catch((e) => console.warn("[lizard-chat] speak failed:", e))
  }, [sessions, activeSessionId, connected, muted, speak])

  return (
    <div className="relative w-full overflow-hidden border-b border-primary/10" style={{ height }}>
      <LizardScene showSubtitle slide={null} />
      {/* Stop button (top-left, only visible when speaking — small icon). */}
      <button
        type="button"
        onClick={() => stop()}
        className="absolute top-2 left-2 z-20 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-white/70 bg-black/40 hover:bg-black/60 backdrop-blur rounded"
        title="停止讲话"
      >
        Stop
      </button>
    </div>
  )
}
