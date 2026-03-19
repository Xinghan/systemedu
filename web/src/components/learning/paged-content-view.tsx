"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { HighlightedMarkdown } from "./highlighted-markdown"
import { splitByHeadings } from "@/lib/utils/split-pages"
import { HighlightToolbar } from "./highlight-toolbar"
import { gateway } from "@/lib/api"
import type { HighlightInfo } from "@/lib/types/api"

interface PagedContentViewProps {
  content: string
  onPageChange?: (pageIndex: number, pageContent: string) => void
  projectName?: string
  nodeId?: number | null
  tab?: string
}

export function PagedContentView({ content, onPageChange, projectName, nodeId, tab }: PagedContentViewProps) {
  const pages = useMemo(() => splitByHeadings(content), [content])
  const [currentPage, setCurrentPage] = useState(0)
  const [highlights, setHighlights] = useState<HighlightInfo[]>([])
  const contentRef = useRef<HTMLDivElement>(null)
  const highlightsEnabled = !!projectName && nodeId != null && !!tab

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
    if (!highlightsEnabled) return
    gateway.getHighlights(projectName!, nodeId!).then(setHighlights).catch(() => {})
  }, [projectName, nodeId, highlightsEnabled])

  // Filter highlights for current page and tab
  const pageHighlights = useMemo(
    () =>
      highlights
        .filter((h) => h.tab === tab && h.page_index === currentPage)
        .map((h) => ({
          id: h.id,
          text: h.text,
          note: h.note || "",
          color: h.color,
        })),
    [highlights, tab, currentPage],
  )

  const handleDeleteHighlight = useCallback(
    (id: number) => {
      if (!highlightsEnabled) return
      gateway.deleteHighlight(projectName!, nodeId!, id).then(() => {
        setHighlights((prev) => prev.filter((h) => h.id !== id))
      }).catch(() => {})
    },
    [projectName, nodeId, highlightsEnabled],
  )

  const handleHighlight = useCallback(
    (text: string, comment: string) => {
      if (!highlightsEnabled) return
      gateway
        .createHighlight(projectName!, nodeId!, {
          tab: tab!,
          page_index: currentPage,
          text,
          start_offset: 0,
          end_offset: text.length,
          note: comment || undefined,
        })
        .then((h) => {
          setHighlights((prev) => [...prev, h])
          toast.success("已添加高亮")
        })
        .catch((e) => {
          toast.error(`高亮失败: ${e instanceof Error ? e.message : "未知错误"}`)
        })
    },
    [projectName, nodeId, tab, currentPage, highlightsEnabled],
  )

  const goTo = useCallback(
    (page: number) => {
      if (page >= 0 && page < pages.length) {
        setCurrentPage(page)
      }
    },
    [pages.length],
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowLeft") goTo(currentPage - 1)
      else if (e.key === "ArrowRight") goTo(currentPage + 1)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentPage, goTo])

  const renderContent = (md: string) => (
    <HighlightedMarkdown
      content={md}
      highlights={pageHighlights}
      onDeleteHighlight={handleDeleteHighlight}
    />
  )

  // Single page — no pagination controls
  if (pages.length <= 1) {
    return (
      <div className="relative" ref={contentRef}>
        {renderContent(content)}
        {highlightsEnabled && (
          <HighlightToolbar onHighlight={handleHighlight} containerRef={contentRef} />
        )}
      </div>
    )
  }

  return (
    <div className="relative flex flex-col min-h-full" ref={contentRef}>
      {/* Page content — grows to fill */}
      <div className="flex-1 pb-4">
        {renderContent(pages[currentPage] ?? "")}
        {highlightsEnabled && (
          <HighlightToolbar onHighlight={handleHighlight} containerRef={contentRef} />
        )}
      </div>

      {/* Pagination controls */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 py-2 mt-6 border-t bg-background/95 backdrop-blur-sm">
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

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all ${
                  i === currentPage
                    ? "h-2 w-5 bg-primary"
                    : "h-2 w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {currentPage + 1} / {pages.length}
          </span>
        </div>

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
