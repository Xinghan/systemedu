"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { HighlightedMarkdown } from "./highlighted-markdown"
import { splitByHeadings } from "@/lib/utils/split-pages"
import { HighlightToolbar } from "./highlight-toolbar"
import { gateway } from "@/lib/api"
import type { HighlightInfo } from "@/lib/types/api"

interface PagedContentViewProps {
  content: string
  onPageChange?: (pageIndex: number, pageContent: string) => void
  onPaginationState?: (state: { currentPage: number; totalPages: number; goTo: (i: number) => void }) => void
  projectName?: string
  nodeId?: number | null
  tab?: string
}

export function PagedContentView({ content, onPageChange, onPaginationState, projectName, nodeId, tab }: PagedContentViewProps) {
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

  // Expose pagination state to parent (for external pagination bar)
  useEffect(() => {
    onPaginationState?.({ currentPage, totalPages: pages.length, goTo })
  }, [currentPage, pages.length, goTo, onPaginationState])

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
    <div className="relative" ref={contentRef}>
      {renderContent(content)}
      {highlightsEnabled && (
        <HighlightToolbar onHighlight={handleHighlight} containerRef={contentRef} />
      )}
    </div>
  )
}
