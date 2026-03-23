"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react"
import {
  IconBook,
  IconTree,
} from "@/components/learning/cartoon-icons"
import { PageLoading } from "@/components/ui/page-loading"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { KnowledgeTreeView } from "@/components/knowledge-tree/knowledge-tree-view"
import { LessonView } from "@/components/learning/lesson-view"
import { FloatingChat } from "@/components/learning/floating-chat"
import { gateway } from "@/lib/api"
import type { KnodeInfo, LessonStatus, NodeProgress, ProjectDetail } from "@/lib/types/api"

export default function LearnPage() {
  const params = useParams<{ projectName: string }>()
  const searchParams = useSearchParams()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialNodeId = searchParams.get("node") !== null ? Number(searchParams.get("node")) : null
  const [activeNodeId, setActiveNodeId] = useState<number | null>(initialNodeId)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileTab, setMobileTab] = useState<"tree" | "content">("tree")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeLessonTab, setActiveLessonTab] = useState<string>("concept")
  const [activePage, setActivePage] = useState<number>(0)
  const [lessonStatuses, setLessonStatuses] = useState<Record<string, LessonStatus>>({})
  const sessionStartRef = useRef<number>(Date.now())

  const handleLessonPageChange = useCallback((tab: string, pageIndex: number, _pageContent: string) => {
    setActiveLessonTab(tab)
    setActivePage(pageIndex)
  }, [])

  useEffect(() => {
    if (!params.projectName) return
    gateway
      .project(params.projectName)
      .then(setDetail)
      .catch((e) => setError(e.message ?? "无法加载项目"))
      .finally(() => setLoading(false))

    gateway
      .getLessonStatuses(params.projectName)
      .then((r) => setLessonStatuses(r.statuses))
      .catch(() => {/* non-fatal */})
  }, [params.projectName])

  // Poll lesson statuses while any node is still generating
  const hasGenerating = Object.values(lessonStatuses).some((s) => s === "generating")
  useEffect(() => {
    if (!hasGenerating || !params.projectName) return
    const interval = setInterval(async () => {
      try {
        const r = await gateway.getLessonStatuses(params.projectName)
        setLessonStatuses(r.statuses)
      } catch {
        // non-fatal
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [hasGenerating, params.projectName])

  // Track learning time: flush on unmount and visibilitychange
  useEffect(() => {
    if (!params.projectName) return

    const flushTime = () => {
      const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000)
      if (elapsed > 0) {
        gateway.updateEnrollment(params.projectName, { add_time_seconds: elapsed }).catch(() => {})
        sessionStartRef.current = Date.now()
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        flushTime()
      } else {
        sessionStartRef.current = Date.now()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      flushTime()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [params.projectName])

  const allKnodes = useMemo(() => {
    if (!detail) return []
    const knodes: KnodeInfo[] = []
    for (const ms of detail.milestones) {
      knodes.push(...ms.knodes)
    }
    return knodes
  }, [detail])

  const progressList = detail?.progress ?? []
  const totalPassed = progressList.filter((p) => p.status === "passed").length
  const totalNodes = progressList.length
  const pct = totalNodes > 0 ? Math.round((totalPassed / totalNodes) * 100) : 0

  const handleNodeClick = useCallback((nodeId: number) => {
    setActiveNodeId(nodeId)
    setMobileTab("content")
  }, [])

  const handleNodeChange = useCallback((nodeId: number) => {
    setActiveNodeId(nodeId)
  }, [])

  const handleProgressUpdate = useCallback((updatedProgress: NodeProgress[]) => {
    setDetail((prev) => {
      if (!prev) return prev
      return { ...prev, progress: updatedProgress }
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <PageLoading />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground gap-2">
        <p>{error ?? "项目未找到"}</p>
        <Link href="/projects">
          <Button variant="link">返回</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden relative">
      {/* Desktop layout */}
      <div className="hidden md:flex flex-1 min-h-0">
        {/* Left sidebar — knowledge tree only */}
        {!sidebarCollapsed && (
          <div className="w-[320px] shrink-0 border-r flex flex-col">
            <div className="flex items-center gap-2 p-3 border-b">
              <Link href={`/projects/${params.projectName}`}>
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h2 className="font-semibold text-sm truncate flex-1">{detail.project.title}</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(true)}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-3 py-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="搜索节点..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3">
                <KnowledgeTreeView
                  milestones={detail.milestones}
                  progress={detail.progress}
                  lessonStatuses={lessonStatuses}
                  activeNodeId={activeNodeId}
                  onNodeClick={handleNodeClick}
                  searchQuery={searchQuery}
                />
              </div>
            </ScrollArea>
            <div className="p-3 border-t">
              <div className="flex items-center gap-3">
                <Progress value={pct} className="flex-1" />
                <span className="text-xs text-muted-foreground shrink-0">
                  {totalPassed}/{totalNodes} ({pct}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Collapse toggle when sidebar is hidden */}
        {sidebarCollapsed && (
          <div className="shrink-0 flex flex-col items-center border-r py-3 px-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(false)}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Right: lesson content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {sidebarCollapsed && (
            <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
              <Link href={`/projects/${params.projectName}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <span className="text-sm font-medium truncate">{detail.project.title}</span>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {totalPassed}/{totalNodes} ({pct}%)
              </span>
            </div>
          )}
          <div className="flex-1 min-h-0 h-full">
            <LessonView
              projectName={params.projectName}
              nodeId={activeNodeId}
              allKnodes={allKnodes}
              progress={progressList}
              onNodeChange={handleNodeChange}
              onProgressUpdate={handleProgressUpdate}
              onPageChange={handleLessonPageChange}
            />
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden flex flex-col flex-1 min-h-0">
        {/* Tab switcher: tree vs content */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setMobileTab("tree")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              mobileTab === "tree"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <IconTree className="h-4 w-4" />
            知识树
          </button>
          <button
            onClick={() => setMobileTab("content")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              mobileTab === "content"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <IconBook className="h-4 w-4" />
            学习
          </button>
        </div>

        {mobileTab === "tree" ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 p-3 border-b shrink-0">
              <Link href={`/projects/${params.projectName}`}>
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h2 className="font-semibold text-sm truncate">{detail.project.title}</h2>
            </div>
            <div className="px-3 py-2 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="搜索节点..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3">
                <KnowledgeTreeView
                  milestones={detail.milestones}
                  progress={detail.progress}
                  lessonStatuses={lessonStatuses}
                  activeNodeId={activeNodeId}
                  onNodeClick={handleNodeClick}
                  searchQuery={searchQuery}
                />
              </div>
            </ScrollArea>
            <div className="p-3 border-t">
              <div className="flex items-center gap-3">
                <Progress value={pct} className="flex-1" />
                <span className="text-xs text-muted-foreground shrink-0">
                  {totalPassed}/{totalNodes} ({pct}%)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <LessonView
              projectName={params.projectName}
              nodeId={activeNodeId}
              allKnodes={allKnodes}
              progress={progressList}
              onNodeChange={handleNodeChange}
              onProgressUpdate={handleProgressUpdate}
              onPageChange={handleLessonPageChange}
            />
          </div>
        )}
      </div>

      {/* Floating chat */}
      <FloatingChat project={params.projectName} nodeId={activeNodeId} activeTab={activeLessonTab} pageIndex={activePage} />
    </div>
  )
}
