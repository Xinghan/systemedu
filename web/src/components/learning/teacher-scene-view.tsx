// "老师讲课" mode for course-content-view: full-screen LizardScene with the
// dighuman 2D speaking lizard. Slide content + per-section playback hookup
// is intentionally left as a placeholder — to be filled in once the
// re-designed lecture-script + multimedia-slide format is finalised.
"use client"

import { useState } from "react"
import { LizardScene } from "@/components/dighuman/LizardScene"
import { useDighumanSession } from "@/components/dighuman/use-dighuman-session"
import type { KnodeInfo } from "@/lib/types/api"

export interface TeacherSceneViewProps {
  knode: KnodeInfo | null
  /** Demo line shown on the test button. Defaults to a per-knode greeting. */
  greetingText?: string
}

export function TeacherSceneView({ knode, greetingText }: TeacherSceneViewProps) {
  const { connected, speak, stop } = useDighumanSession()
  const [text, setText] = useState<string>(
    greetingText ??
      (knode?.title
        ? `你好，我是蜥蜴老师。今天我们一起来学习「${knode.title}」。`
        : "你好，我是蜥蜴老师。"),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSpeak = async () => {
    setError(null)
    setBusy(true)
    try {
      await speak(text, "zh")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white">
      {/* Status strip */}
      <div className="flex items-center gap-3 px-6 py-2 text-xs text-white/60 border-b border-white/5">
        <span
          className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
        />
        <span>{connected ? "蜥蜴老师已就位 / Lizard ready" : "正在连接 / connecting..."}</span>
        <span className="ml-auto text-[10px] opacity-50">
          幻灯片功能待重新设计 / slide system coming soon
        </span>
      </div>

      {/* Main scene — flex 1 */}
      <div className="relative flex-1 min-h-0">
        <LizardScene />
      </div>

      {/* Test controls (temporary — will be replaced by per-section playback) */}
      <div className="border-t border-white/5 bg-slate-900/60 px-6 py-3 flex flex-col gap-2 shrink-0">
        <div className="text-[10px] uppercase tracking-widest opacity-50">
          测试用 — Test playback (per-section playback coming when scripts are redesigned)
        </div>
        <div className="flex gap-2 items-stretch">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="flex-1 bg-slate-950 border border-white/10 rounded px-3 py-2 text-sm resize-none"
            placeholder="输入要让蜥蜴老师讲的内容..."
          />
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleSpeak}
              disabled={!connected || busy || !text.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded text-sm font-medium"
            >
              {busy ? "讲话中..." : "▶ 讲"}
            </button>
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium"
            >
              停止
            </button>
          </div>
        </div>
        {error && <div className="text-xs text-red-300">{error}</div>}
      </div>
    </div>
  )
}
