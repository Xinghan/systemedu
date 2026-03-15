"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  TreePine,
  BookOpen,
  FileText,
  Lightbulb,
  StickyNote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { KnowledgeTreeView } from "@/components/knowledge-tree/knowledge-tree-view"
import { LessonView } from "@/components/learning/lesson-view"
import { FloatingChat } from "@/components/learning/floating-chat"
import { gateway } from "@/lib/api"
import type { KnodeInfo, NodeProgress, ProjectDetail } from "@/lib/types/api"

const CONTENT_TABS = [
  { id: "lesson", label: "课程", icon: BookOpen },
  { id: "materials", label: "学习资料", icon: FileText },
  { id: "assignments", label: "作业", icon: FileText },
  { id: "suggestions", label: "AI建议", icon: Lightbulb },
  { id: "notes", label: "笔记", icon: StickyNote },
] as const

type ContentTabId = (typeof CONTENT_TABS)[number]["id"]

export default function LearnPage() {
  const params = useParams<{ projectName: string }>()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileTab, setMobileTab] = useState<"tree" | "content">("tree")
  const [contentTab, setContentTab] = useState<ContentTabId>("lesson")
  const sessionStartRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!params.projectName) return
    gateway
      .project(params.projectName)
      .then(setDetail)
      .catch((e) => setError(e.message ?? "无法加载项目"))
      .finally(() => setLoading(false))
  }, [params.projectName])

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
    setContentTab("lesson")
    setMobileTab("content")
  }, [])

  const handleNodeChange = useCallback((nodeId: number) => {
    setActiveNodeId(nodeId)
  }, [])

  const handleProgressUpdate = useCallback((nodeId: number, status: string) => {
    setDetail((prev) => {
      if (!prev) return prev
      const newProgress = prev.progress.map((p) =>
        p.knode_id === nodeId ? { ...p, status: status as NodeProgress["status"] } : p
      )
      return { ...prev, progress: newProgress }
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full text-muted-foreground">
        加载中...
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

  /** Right-side content area with tab bar */
  const contentArea = (
    <div className="flex flex-col h-full">
      {/* Content tab bar */}
      <div className="flex border-b shrink-0 overflow-x-auto px-2">
        {CONTENT_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = contentTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setContentTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {contentTab === "lesson" ? (
          <LessonView
            projectName={params.projectName}
            nodeId={activeNodeId}
            allKnodes={allKnodes}
            progress={progressList}
            onNodeChange={handleNodeChange}
            onProgressUpdate={handleProgressUpdate}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            即将推出
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col w-full h-full overflow-hidden relative">
      {/* Desktop layout */}
      <div className="hidden md:flex flex-1 min-h-0">
        {/* Left sidebar: knowledge tree */}
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
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3">
                <KnowledgeTreeView
                  milestones={detail.milestones}
                  progress={detail.progress}
                  onNodeClick={handleNodeClick}
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

        {/* Right: tabbed content area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Compact top bar (visible when sidebar collapsed) */}
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
            {contentArea}
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
            <TreePine className="h-4 w-4" />
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
            <BookOpen className="h-4 w-4" />
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
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3">
                <KnowledgeTreeView
                  milestones={detail.milestones}
                  progress={detail.progress}
                  onNodeClick={handleNodeClick}
                />
              </div>
            </ScrollArea>
            <div className="p-3 border-t shrink-0">
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
            {contentArea}
          </div>
        )}
      </div>

      {/* Floating chat */}
      <FloatingChat project={params.projectName} />
    </div>
  )
}
