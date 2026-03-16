"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"
import { splitByHeadings } from "@/lib/utils/split-pages"
import { HighlightToolbar, useHighlightRenderer } from "./highlight-toolbar"
import { gateway } from "@/lib/api"
import type { HighlightInfo } from "@/lib/types/api"

interface PagedContentViewProps {
  content: string
  onPageChange?: (pageIndex: number, pageContent: string) => void
  /** Required for highlight persistence */
  projectName?: string
  nodeId?: number | null
  tab?: string
}

export function PagedContentView({ content, onPageChange, projectName, nodeId, tab }: PagedContentViewProps) {
  const pages = useMemo(() => splitByHeadings(content), [content])
  const [currentPage, setCurrentPage] = useState(0)
  const [highlights, setHighlights] = useState<HighlightInfo[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

  // Reset to page 0 when content changes
  useEffect(() => {
    setCurrentPage(0)
  }, [content])

  // Notify parent of page changes
  useEffect(() => {
    onPageChange?.(currentPage, pages[currentPage] ?? "")
  }, [currentPage, pages, onPageChange])

  // Fetch highlights from server
  useEffect(() => {
    if (!projectName || nodeId == null) return
    gateway.getHighlights(projectName, nodeId).then(setHighlights).catch(() => {})
  }, [projectName, nodeId])

  // Filter highlights for current page and tab
  const pageHighlights = useMemo(
    () =>
      highlights
        .filter((h) => h.tab === tab && h.page_index === currentPage)
        .map((h) => ({
          id: h.id,
          text: h.text,
          startOffset: h.start_offset,
          endOffset: h.end_offset,
          color: h.color,
        })),
    [highlights, tab, currentPage]
  )

  const handleDeleteHighlight = useCallback(
    (id: number) => {
      if (!projectName || nodeId == null) return
      gateway.deleteHighlight(projectName, nodeId, id).then(() => {
        setHighlights((prev) => prev.filter((h) => h.id !== id))
      }).catch(() => {})
    },
    [projectName, nodeId]
  )

  // Apply highlight rendering after markdown renders
  useHighlightRenderer(contentRef, pageHighlights, handleDeleteHighlight)

  const handleHighlight = useCallback(
    (text: string, startOffset: number, endOffset: number) => {
      if (!projectName || nodeId == null || !tab) return
      gateway
        .createHighlight(projectName, nodeId, {
          tab,
          page_index: currentPage,
          text,
          start_offset: startOffset,
          end_offset: endOffset,
        })
        .then((h) => {
          setHighlights((prev) => [...prev, h])
        })
        .catch(() => {})
    },
    [projectName, nodeId, tab, currentPage]
  )

  const goTo = useCallback(
    (page: number) => {
      if (page >= 0 && page < pages.length) {
        setCurrentPage(page)
      }
    },
    [pages.length]
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }
      if (e.key === "ArrowLeft") {
        goTo(currentPage - 1)
      } else if (e.key === "ArrowRight") {
        goTo(currentPage + 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentPage, goTo])

  // Single page — no pagination controls
  if (pages.length <= 1) {
    return (
      <div className="relative" ref={contentRef}>
        <MarkdownRenderer content={content} />
        {projectName && nodeId != null && tab && (
          <HighlightToolbar onHighlight={handleHighlight} containerRef={contentRef} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-y-auto relative" ref={contentRef}>
        <MarkdownRenderer content={pages[currentPage] ?? ""} />
        {projectName && nodeId != null && tab && (
          <HighlightToolbar onHighlight={handleHighlight} containerRef={contentRef} />
        )}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-center gap-3 py-3 border-t mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          上一页
        </Button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === currentPage
                  ? "bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>

        <span className="text-xs text-muted-foreground tabular-nums">
          {currentPage + 1}/{pages.length}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === pages.length - 1}
          className="gap-1"
        >
          下一页
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
