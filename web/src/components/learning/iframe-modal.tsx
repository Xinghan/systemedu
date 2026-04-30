// Full-screen iframe modal: 主站 anim/game/diagram 看大图都用它.
// 抽出 course-content-view.tsx 内部的 IframeModal 让其他组件 (slide-content) 复用.
"use client"

import { createPortal } from "react-dom"
import { useEffect } from "react"
import { X } from "lucide-react"

export interface IframeModalProps {
  open: boolean
  onClose: () => void
  html: string
  title: string
  /** Bump to force iframe re-mount (clear running anim state). */
  resetKey?: number
}

export function IframeModal({ open, onClose, html, title, resetKey = 0 }: IframeModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null
  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Modal container */}
      <div className="relative w-[96vw] h-[92vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-[#0a0e14] border border-white/10">
        <div className="flex items-center justify-between px-5 py-3 bg-white/5 border-b border-white/10 shrink-0">
          <span className="text-sm font-semibold text-white/80">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <iframe
          key={resetKey}
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin"
          className="flex-1 w-full block"
          style={{ border: "none" }}
          title={title}
        />
      </div>
    </div>,
    document.body,
  )
}
