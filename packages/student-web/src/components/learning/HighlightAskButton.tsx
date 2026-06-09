"use client"

/**
 * 高亮课文 → 浮"深入学习"按钮 (spec 2026-06-08)。
 * 监听 mouseup, 选区合格且落在 containerRef 内时浮按钮 (fixed 定位跟随选区);
 * 点击 → setPendingAsk(组装消息), 常驻 ChatPanel 监听后自动发送。
 */

import { useEffect, useState, useCallback } from "react"
import { Sparkles, BookOpen } from "lucide-react"

import { useChatStore } from "@/lib/stores/chat-store"
import { isValidSelection, buildAskMessage } from "@/lib/highlight-ask"

interface Pos { top: number; left: number; text: string }

export function HighlightAskButton({
  containerRef,
  onDrill,
}: {
  containerRef: React.RefObject<HTMLElement | null>
  onDrill?: (text: string) => void
}) {
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

  const onDrillClick = () => {
    onDrill?.(pos.text)
    setPos(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translateX(-50%)", zIndex: 50, gap: 8 }}
      className="inline-flex items-center"
    >
      <button
        type="button"
        onClick={onAsk}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-[var(--primary-ink)]"
      >
        <Sparkles size={13} /> 深入学习
      </button>
      <button
        type="button"
        onClick={onDrillClick}
        className="inline-flex items-center gap-1 rounded-full border border-[var(--primary)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] shadow-lg hover:bg-[var(--paper-2)]"
      >
        <BookOpen size={13} /> 知识钻取
      </button>
    </div>
  )
}
