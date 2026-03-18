"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bookmark, BookmarkCheck, ExternalLink, Loader2, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { gateway } from "@/lib/api"
import type { ResourceItem, ResourceSearchStatus } from "@/lib/types/api"

interface ResourceSearchViewProps {
  projectName: string
  nodeId: number
}

type FilterKey = "all" | "web" | "youtube" | "saved"

export function ResourceSearchView({ projectName, nodeId }: ResourceSearchViewProps) {
  const [status, setStatus] = useState<ResourceSearchStatus>("idle")
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<FilterKey>("all")
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const fetchResources = useCallback(async () => {
    try {
      const data = await gateway.getResources(projectName, nodeId)
      setStatus(data.status)
      setResources(data.resources)
      setError(data.error ?? "")
      if (data.status !== "searching") {
        stopPolling()
      }
    } catch {
      stopPolling()
    }
  }, [projectName, nodeId, stopPolling])

  const startPolling = useCallback(() => {
    stopPolling()
    pollingRef.current = setInterval(fetchResources, 2000)
  }, [fetchResources, stopPolling])

  useEffect(() => {
    fetchResources()
    return () => stopPolling()
  }, [fetchResources, stopPolling])

  const handleSearch = async () => {
    try {
      setStatus("searching")
      await gateway.triggerResourceSearch(projectName, nodeId)
      startPolling()
    } catch {
      setStatus("failed")
    }
  }

  const handleToggleSaved = async (resource: ResourceItem) => {
    const newSaved = !resource.saved
    // Optimistic update
    setResources((prev) =>
      prev.map((r) => (r.id === resource.id ? { ...r, saved: newSaved } : r))
    )
    try {
      await gateway.toggleResourceSaved(projectName, nodeId, resource.id, newSaved)
    } catch {
      // Revert on failure
      setResources((prev) =>
        prev.map((r) => (r.id === resource.id ? { ...r, saved: resource.saved } : r))
      )
    }
  }

  const webCount = resources.filter((r) => r.source_type === "web").length
  const ytCount = resources.filter((r) => r.source_type === "youtube").length
  const savedCount = resources.filter((r) => r.saved).length

  const filtered = resources.filter((r) => {
    if (filter === "web") return r.source_type === "web"
    if (filter === "youtube") return r.source_type === "youtube"
    if (filter === "saved") return r.saved
    return true
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button
          onClick={handleSearch}
          disabled={status === "searching"}
          size="sm"
          className="gap-1.5"
        >
          {status === "searching" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          {status === "searching" ? "搜索中..." : "收集资料"}
        </Button>

        {resources.length > 0 && (
          <div className="flex gap-1">
            {(
              [
                { key: "all" as FilterKey, label: "全部" },
                { key: "web" as FilterKey, label: `网页 (${webCount})` },
                { key: "youtube" as FilterKey, label: `视频 (${ytCount})` },
                { key: "saved" as FilterKey, label: `已收藏 (${savedCount})` },
              ] as { key: FilterKey; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  filter === key
                    ? "bg-muted text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {status === "failed" && error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Empty state */}
      {status !== "searching" && resources.length === 0 && (
        <p className="text-sm text-muted-foreground">
          点击"收集资料"搜索与本知识点相关的网页和视频资源。
        </p>
      )}

      {/* Searching placeholder */}
      {status === "searching" && resources.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在搜索相关资料...
        </div>
      )}

      {/* Resource list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((resource) => (
            <div
              key={resource.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="secondary"
                    className="text-xs shrink-0"
                  >
                    {resource.source_type === "youtube" ? "视频" : "网页"}
                  </Badge>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium leading-snug hover:underline truncate flex items-center gap-1"
                  >
                    {resource.title}
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                </div>
                {resource.snippet && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{resource.snippet}</p>
                )}
              </div>
              <button
                onClick={() => handleToggleSaved(resource)}
                className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                title={resource.saved ? "取消收藏" : "收藏"}
              >
                {resource.saved ? (
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
