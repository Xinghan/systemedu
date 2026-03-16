"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Highlighter, Trash2 } from "lucide-react"

interface HighlightToolbarProps {
  /** Called when user clicks the highlight button with selected text info */
  onHighlight: (text: string, startOffset: number, endOffset: number) => void
  /** Container element to scope selection detection */
  containerRef: React.RefObject<HTMLElement | null>
}

export function HighlightToolbar({ onHighlight, containerRef }: HighlightToolbarProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [selectedText, setSelectedText] = useState("")
  const [offsets, setOffsets] = useState({ start: 0, end: 0 })
  const toolbarRef = useRef<HTMLDivElement>(null)

  const handleMouseUp = useCallback(() => {
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

    // Check if selection is within our container
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setVisible(false)
      return
    }

    // Calculate text offset within the container's text content
    const containerText = containerRef.current.textContent ?? ""
    const preRange = document.createRange()
    preRange.setStart(containerRef.current, 0)
    preRange.setEnd(range.startContainer, range.startOffset)
    const startOffset = preRange.toString().length
    const endOffset = startOffset + text.length

    // Position toolbar above selection
    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()

    setPosition({
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top - 8,
    })
    setSelectedText(text)
    setOffsets({ start: startOffset, end: endOffset })
    setVisible(true)
  }, [containerRef])

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp)
    return () => document.removeEventListener("mouseup", handleMouseUp)
  }, [handleMouseUp])

  // Hide toolbar when clicking outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  const handleHighlightClick = useCallback(() => {
    onHighlight(selectedText, offsets.start, offsets.end)
    setVisible(false)
    window.getSelection()?.removeAllRanges()
  }, [onHighlight, selectedText, offsets])

  if (!visible) return null

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 flex items-center gap-1 px-2 py-1 bg-popover border rounded-lg shadow-lg -translate-x-1/2 -translate-y-full"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={handleHighlightClick}
        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded hover:bg-muted transition-colors"
        title="高亮标注"
      >
        <Highlighter className="h-3.5 w-3.5 text-yellow-500" />
        高亮
      </button>
    </div>
  )
}

interface HighlightMark {
  id: number
  text: string
  startOffset: number
  endOffset: number
  color: string
}

interface HighlightOverlayProps {
  highlights: HighlightMark[]
  containerRef: React.RefObject<HTMLElement | null>
  onDelete: (id: number) => void
}

/**
 * Renders highlight overlays on top of text content.
 * Uses DOM text node walking to find and wrap highlighted ranges.
 */
export function useHighlightRenderer(
  containerRef: React.RefObject<HTMLElement | null>,
  highlights: HighlightMark[],
  onDelete: (id: number) => void,
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container || highlights.length === 0) return

    // Clean up previous highlights
    container.querySelectorAll("mark[data-highlight-id]").forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent ?? ""), el)
        parent.normalize()
      }
    })

    // Walk text nodes and apply highlights
    const textNodes: { node: Text; offset: number }[] = []
    let totalOffset = 0

    function walkTextNodes(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push({ node: node as Text, offset: totalOffset })
        totalOffset += (node.textContent ?? "").length
      } else {
        for (const child of Array.from(node.childNodes)) {
          walkTextNodes(child)
        }
      }
    }
    walkTextNodes(container)

    // Apply each highlight (sorted by start offset, reversed to avoid position shifts)
    const sorted = [...highlights].sort((a, b) => b.startOffset - a.startOffset)
    for (const hl of sorted) {
      try {
        // Find start and end text nodes
        let startNode: Text | null = null
        let startLocal = 0
        let endNode: Text | null = null
        let endLocal = 0

        for (const { node, offset } of textNodes) {
          const len = (node.textContent ?? "").length
          if (!startNode && offset + len > hl.startOffset) {
            startNode = node
            startLocal = hl.startOffset - offset
          }
          if (offset + len >= hl.endOffset) {
            endNode = node
            endLocal = hl.endOffset - offset
            break
          }
        }

        if (!startNode || !endNode) continue

        // Only handle single-node highlights for simplicity
        if (startNode === endNode) {
          const range = document.createRange()
          range.setStart(startNode, startLocal)
          range.setEnd(endNode, endLocal)

          const mark = document.createElement("mark")
          mark.setAttribute("data-highlight-id", String(hl.id))
          mark.className = `bg-yellow-200/70 dark:bg-yellow-500/30 cursor-pointer rounded-sm px-0.5`
          mark.title = "点击删除高亮"
          mark.addEventListener("click", () => onDelete(hl.id))

          range.surroundContents(mark)
        }
      } catch {
        // Ignore DOM errors from complex node structures
      }
    }

    // Cleanup function
    return () => {
      container.querySelectorAll("mark[data-highlight-id]").forEach((el) => {
        const parent = el.parentNode
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent ?? ""), el)
          parent.normalize()
        }
      })
    }
  }, [containerRef, highlights, onDelete])
}
