"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Highlighter, MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Floating toolbar that appears when user selects text.
 * Supports highlight creation with optional comment.
 */
interface HighlightToolbarProps {
  onHighlight: (text: string, comment: string) => void
  containerRef: React.RefObject<HTMLElement | null>
}

export function HighlightToolbar({ onHighlight, containerRef }: HighlightToolbarProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [selectedText, setSelectedText] = useState("")
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState("")
  const toolbarRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleMouseUp = useCallback(() => {
    // Don't interfere if comment input is open
    if (showComment) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setVisible(false)
      return
    }

    const range = selection.getRangeAt(0)
    const text = selection.toString().trim()
    if (!text || !containerRef.current) {
      setVisible(false)
      return
    }

    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setVisible(false)
      return
    }

    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()

    setPosition({
      x: Math.min(
        Math.max(rect.left + rect.width / 2 - containerRect.left, 60),
        containerRect.width - 60,
      ),
      y: rect.top - containerRect.top - 8,
    })
    setSelectedText(text)
    setVisible(true)
    setShowComment(false)
    setComment("")
  }, [containerRef, showComment])

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp)
    return () => document.removeEventListener("mouseup", handleMouseUp)
  }, [handleMouseUp])

  // Hide when clicking outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setVisible(false)
        setShowComment(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  // Focus comment input when opened
  useEffect(() => {
    if (showComment) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [showComment])

  const doHighlight = useCallback(
    (withComment: string) => {
      onHighlight(selectedText, withComment)
      setVisible(false)
      setShowComment(false)
      setComment("")
      window.getSelection()?.removeAllRanges()
    },
    [onHighlight, selectedText],
  )

  if (!visible) return null

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 -translate-x-1/2 -translate-y-full"
      style={{ left: position.x, top: position.y }}
    >
      <div className="bg-popover border rounded-lg shadow-lg overflow-hidden">
        {/* Main actions */}
        <div className="flex items-center gap-0.5 px-1 py-1">
          <button
            onClick={() => doHighlight("")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
            title="高亮"
          >
            <Highlighter className="h-3.5 w-3.5 text-yellow-500" />
            高亮
          </button>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={() => setShowComment(!showComment)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${
              showComment ? "bg-muted" : "hover:bg-muted"
            }`}
            title="高亮并批注"
          >
            <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
            批注
          </button>
        </div>

        {/* Comment input */}
        {showComment && (
          <div className="border-t px-2 py-2 space-y-2">
            <textarea
              ref={inputRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  doHighlight(comment)
                }
                if (e.key === "Escape") {
                  setShowComment(false)
                }
              }}
              placeholder="写下你的笔记..."
              className="w-56 h-16 text-xs resize-none rounded border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setShowComment(false)}
              >
                取消
              </Button>
              <Button
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => doHighlight(comment)}
              >
                保存
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Renders highlighted text with visual marks.
 * Shows note icon for highlights with comments.
 */
interface HighlightMark {
  id: number
  text: string
  note: string
  color: string
}

interface HighlightPopoverProps {
  highlight: HighlightMark
  onDelete: (id: number) => void
}

export function HighlightPopover({ highlight, onDelete }: HighlightPopoverProps) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline group/hl">
      <mark
        className="bg-yellow-200/80 dark:bg-yellow-500/40 rounded-sm px-0.5 cursor-pointer border-b border-yellow-400/50"
        onClick={() => setOpen(!open)}
        title={highlight.note || "点击查看"}
      >
        {highlight.text}
        {highlight.note && (
          <MessageSquare className="inline h-3 w-3 ml-0.5 text-yellow-600 dark:text-yellow-400" />
        )}
      </mark>
      {open && (
        <span
          className="absolute left-0 top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-2 min-w-[160px] max-w-[280px]"
          onClick={(e) => e.stopPropagation()}
        >
          {highlight.note && (
            <span className="block text-xs text-muted-foreground mb-2 whitespace-pre-wrap">
              {highlight.note}
            </span>
          )}
          <span className="flex items-center justify-between">
            <button
              onClick={() => { onDelete(highlight.id); setOpen(false) }}
              className="text-xs text-destructive hover:underline"
            >
              删除高亮
            </button>
            <button
              onClick={() => setOpen(false)}
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </span>
      )}
    </span>
  )
}
