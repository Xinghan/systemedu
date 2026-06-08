"use client"

/**
 * 高亮课文 → 浮"深入学习"按钮 (spec 2026-06-08)。
 * 监听 mouseup, 选区合格且落在 containerRef 内时浮按钮 (fixed 定位跟随选区);
 * 点击 → setPendingAsk(组装消息), 常驻 ChatPanel 监听后自动发送。
 */

import { useEffect, useState, useCallback } from "react"
import { Sparkles } from "lucide-react"

import { useChatStore } from "@/lib/stores/chat-store"
import { isValidSelection, buildAskMessage } from "@/lib/highlight-ask"

interface Pos { top: number; left: number; text: string }

export function HighlightAskButton({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const [pos, setPos] = useState<Pos | null>(null)
  const setPendingAsk = useChatStore((s) => s.setPendingAsk)

  const recompute = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setPos(null); return }
    const raw = sel.toString()
    if (!isValidSelection(raw)) { setPos(null); return }
    const range = sel.getRangeAt(0)
    const container = containerRef.current
    if (!container || !container.contains(range.commonAncestorContainer)) { setPos(null); return }
    const rect = range.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2, text: raw })  // fixed 定位, 不加 scrollY
  }, [containerRef])

  useEffect(() => {
    const onUp = () => setTimeout(recompute, 0)
    const onScroll = () => setPos(null)
    document.addEventListener("mouseup", onUp)
    document.addEventListener("scroll", onScroll, true)
    return () => {
      document.removeEventListener("mouseup", onUp)
      document.removeEventListener("scroll", onScroll, true)
    }
  }, [recompute])

  if (!pos) return null

  const onAsk = () => {
    setPendingAsk(buildAskMessage(pos.text))
    setPos(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAsk}
      style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translateX(-50%)", zIndex: 50 }}
      className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-[var(--primary-ink)]"
    >
      <Sparkles size={13} /> 深入学习
    </button>
  )
}
