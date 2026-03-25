"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ChevronRight,
  Lock,
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
  Bot,
  BookOpen,
  ExternalLink,
  Search,
  CheckCircle,
  FileText,
  Bold,
  Italic,
  List,
  Quote,
  Link2,
  Image,
  Sparkles,
  History,
  FileDown,
  Save,
  MoreVertical,
  Zap,
  Clock,
} from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LessonView } from "@/components/learning/lesson-view"
import { ChatPanel } from "@/components/chat/chat-panel"
import { NotePanel } from "@/components/learning/note-panel"
import { CourseView } from "@/components/learning/course-view"
import { gateway } from "@/lib/api"
import type { KnodeInfo, LessonStatus, NodeProgress, ProjectDetail } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

function getNodeStatus(nodeId: number, progress: NodeProgress[]): NodeProgress["status"] {
  return progress.find((p) => p.knode_id === nodeId)?.status ?? "locked"
}

interface NodeTooltipData {
  knode: KnodeInfo
  status: NodeProgress["status"]
  rect: DOMRect
}

function NodeTooltip({ data }: { data: NodeTooltipData }) {
  const { knode, status } = data
  const TOOLTIP_W = 260
  const TOOLTIP_OFFSET = 8
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200

  let left = data.rect.right + TOOLTIP_OFFSET
  if (left + TOOLTIP_W > viewportW - 8) {
    left = data.rect.left - TOOLTIP_W - TOOLTIP_OFFSET
  }
  const TOOLTIP_APPROX_H = 140
  let top = data.rect.top
  if (top + TOOLTIP_APPROX_H > (typeof window !== "undefined" ? window.innerHeight : 800) - 8) {
    top = (typeof window !== "undefined" ? window.innerHeight : 800) - TOOLTIP_APPROX_H - 8
  }

  const statusColor =
    status === "passed" ? "text-emerald-600" :
    status === "in_progress" ? "text-primary" :
    "text-muted-foreground"
  const statusLabel =
    status === "passed" ? "已完成" :
    status === "in_progress" ? "进行中" :
    status === "available" ? "可学习" :
    "未解锁"

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left, top, width: TOOLTIP_W }}
    >
      <div className="rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-3.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight text-foreground">{knode.title}</p>
          <span className={`text-[10px] font-semibold shrink-0 mt-0.5 ${statusColor}`}>{statusLabel}</span>
        </div>
        {knode.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{knode.summary}</p>
        )}
        <div className="flex items-center gap-3 pt-1.5 border-t border-border/60 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            难度 {knode.difficulty_level}/10
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {knode.estimated_minutes} min
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {knode.xp_reward} XP
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function LearnPage() {
  const params = useParams<{ projectName: string }>()
  const searchParams = useSearchParams()
  const t = useT()

  const CATEGORY_LABELS: Record<string, string> = {
    ai: t("cat.ai"),
    biotech: t("cat.biotech"),
    aerospace: t("cat.aerospace"),
    music: t("cat.music"),
    climate: t("cat.climate"),
    robotics: t("cat.robotics"),
    chemistry: t("cat.chemistry"),
    math: t("cat.math"),
    cs: t("cat.cs"),
    other: t("cat.other"),
  }
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialNodeId = searchParams.get("node") !== null ? Number(searchParams.get("node")) : null
  const [activeNodeId, setActiveNodeId] = useState<number | null>(initialNodeId)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeLessonTab, setActiveLessonTab] = useState<string>("concept")
  const [activePage, setActivePage] = useState<number>(0)
  const [lessonStatuses, setLessonStatuses] = useState<Record<string, LessonStatus>>({})
  const [completing, setCompleting] = useState(false)
  const [courseNodeId, setCourseNodeId] = useState<number | null>(null)
  const [tutorOpen, setTutorOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteState, setNoteState] = useState<"closed" | "open" | "minimized">("closed")
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [hoveredNode, setHoveredNode] = useState<NodeTooltipData | null>(null)
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
      .catch((e) => setError(e.message ?? t("learn.failed_load")))
      .finally(() => setLoading(false))

    gateway
      .getLessonStatuses(params.projectName)
      .then((r) => setLessonStatuses(r.statuses))
      .catch(() => {})
  }, [params.projectName])

  // Poll lesson statuses while any node is still generating
  const hasGenerating = Object.values(lessonStatuses).some((s) => s === "generating")
  useEffect(() => {
    if (!hasGenerating || !params.projectName) return
    const interval = setInterval(async () => {
      try {
        const r = await gateway.getLessonStatuses(params.projectName)
        setLessonStatuses(r.statuses)
      } catch { /* non-fatal */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [hasGenerating, params.projectName])

  // Track learning time
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
      if (document.hidden) flushTime()
      else sessionStartRef.current = Date.now()
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
    setCourseNodeId(nodeId)
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

  const activeKnode = activeNodeId !== null ? allKnodes[activeNodeId] ?? null : null
  const activeMs = detail?.milestones.find((ms) => ms.knodes.some((k) => k.id === activeNodeId)) ?? detail?.milestones[0]
  const categoryLabel = CATEGORY_LABELS[detail?.project.category ?? ""] ?? "General"
  const isNodeCompleted = activeNodeId !== null
    ? progressList.find((p) => p.knode_id === activeNodeId)?.status === "passed"
    : false

  // Search filtering for sidebar
  const filteredMilestones = useMemo(() => {
    if (!detail || !searchQuery.trim()) return detail?.milestones ?? []
    const q = searchQuery.toLowerCase()
    return detail.milestones
      .map((ms) => ({
        ...ms,
        knodes: ms.knodes.filter((k) => k.title.toLowerCase().includes(q) || k.summary?.toLowerCase().includes(q)),
      }))
      .filter((ms) => ms.knodes.length > 0)
  }, [detail, searchQuery])

  if (loading) return (
    <div className="flex items-center justify-center w-full h-full">
      <PageLoading />
    </div>
  )

  if (error || !detail) return (
    <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground gap-2">
      <p>{error ?? t("learn.failed_load")}</p>
      <Link href="/projects" className="text-primary text-sm hover:underline">{t("learn.back")}</Link>
    </div>
  )

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-background relative">
      {/* Node hover tooltip */}
      {hoveredNode && <NodeTooltip data={hoveredNode} />}

      {/* Top header bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
        <Link href={`/projects/${params.projectName}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <span className="font-[var(--font-manrope)] uppercase tracking-widest">{categoryLabel}</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        {activeMs && (
          <span className="text-xs font-[var(--font-manrope)] uppercase tracking-widest text-primary font-semibold">
            {t("learn.module")} {(detail.milestones.indexOf(activeMs) + 1).toString().padStart(2, "0")}
          </span>
        )}
        <div className="flex-1" />
        {/* Progress */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-[var(--font-manrope)] font-semibold text-foreground">{pct}%</span>
        </div>
        <button
          onClick={() => setRightPanelOpen((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
        >
          {rightPanelOpen ? t("learn.hide_panel") : t("learn.show_panel")}
        </button>
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 min-h-0">

        {/* Left: Module Curriculum sidebar */}
        {sidebarOpen && (
          <div className="w-[280px] shrink-0 border-r border-border/50 flex flex-col bg-background">
            <div className="px-4 pt-4 pb-3 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground font-semibold">
                  {t("learn.module_curriculum")}
                </h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder={t("learn.search_nodes")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-secondary/60 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="px-3 pb-4 space-y-4">
                {filteredMilestones.map((ms, msIdx) => (
                  <div key={ms.title}>
                    <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground/70 font-semibold px-2 mb-2">
                      {ms.title}
                    </p>
                    <div className="space-y-0.5">
                      {ms.knodes.map((knode, knodeIdx) => {
                        const status = getNodeStatus(knode.id, progressList)
                        const isActive = knode.id === activeNodeId
                        const isPassed = status === "passed"
                        const isLocked = status === "locked"
                        const isInProgress = status === "in_progress"
                        const lessonStatus = lessonStatuses[String(knode.id)]
                        const globalIdx = allKnodes.findIndex((k) => k.id === knode.id)
                        const displayIdx = msIdx * 100 + knodeIdx + 1

                        return (
                          <button
                            key={knode.id}
                            onClick={() => !isLocked && handleNodeClick(knode.id)}
                            disabled={isLocked}
                            onMouseEnter={(e) => {
                              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                              setHoveredNode({ knode, status, rect })
                            }}
                            onMouseLeave={() => setHoveredNode(null)}
                            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-[250ms] group ${
                              isActive
                                ? "bg-primary/10 text-foreground"
                                : isLocked
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:bg-secondary/60 text-foreground cursor-pointer"
                            }`}
                          >
                            {/* Status icon */}
                            <div className="shrink-0 mt-0.5">
                              {isPassed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : isActive || isInProgress ? (
                                <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
                                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                </div>
                              ) : isLocked ? (
                                <Lock className="h-4 w-4 text-muted-foreground/40" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground/60" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-[var(--font-manrope)] font-semibold text-muted-foreground/60">
                                  {String(displayIdx).padStart(2, "0")}
                                </span>
                                {isActive && (
                                  <span className="text-[9px] font-[var(--font-manrope)] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                                    {t("learn.current")}
                                  </span>
                                )}
                                {lessonStatus === "generating" && (
                                  <span className="text-[9px] font-[var(--font-manrope)] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    {t("learn.generating")}
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs font-medium leading-tight ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                                {knode.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 font-[var(--font-manrope)]">
                                {knode.estimated_minutes} min
                              </p>
                            </div>

                            {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Bottom progress bar */}
            <div className="px-4 py-3 border-t border-border/50 shrink-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span className="font-[var(--font-manrope)]">{t("learn.mastered_count", { n: totalPassed, total: totalNodes })}</span>
                <span className="font-[var(--font-manrope)] font-semibold text-foreground">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Collapsed sidebar toggle */}
        {!sidebarOpen && (
          <div className="shrink-0 flex flex-col items-center border-r border-border/50 py-4 px-1.5 gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Center: lesson content */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col relative">
          {/* Lesson content (title is rendered inside LessonContentView for scrolling) */}
          <div className="flex-1 min-h-0">
            <LessonView
              projectName={params.projectName}
              nodeId={activeNodeId}
              allKnodes={allKnodes}
              progress={progressList}
              onNodeChange={handleNodeChange}
              onProgressUpdate={handleProgressUpdate}
              onPageChange={handleLessonPageChange}
              onCompletingChange={setCompleting}
              noteState={noteState}
              onNoteStateChange={setNoteState}
            />
          </div>

          {/* CourseView overlay — slides in when a node is clicked */}
          {courseNodeId !== null && (
            <div className="absolute inset-0 z-20 bg-background flex flex-col">
              <CourseView
                projectName={params.projectName}
                nodeId={courseNodeId}
                knode={allKnodes[courseNodeId] ?? null}
                onClose={() => setCourseNodeId(null)}
                onMarkComplete={() => {
                  window.dispatchEvent(new CustomEvent("lesson:markComplete"))
                }}
              />
            </div>
          )}
        </div>

        {/* Right panel: Mastery + Resources + AI Tutor */}
        {rightPanelOpen && (
          <div className="w-[280px] shrink-0 border-l border-border/50 flex flex-col bg-background overflow-hidden">
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-4">

                {/* Mastery Progress card */}
                <div className="card-elevated p-4">
                  <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                    {t("learn.mastery_progress")}
                  </p>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-3xl font-extrabold text-foreground tracking-tight">{pct}%</span>
                    {pct > 0 && (
                      <span className="text-[10px] font-[var(--font-manrope)] text-emerald-600 font-semibold mb-1">
                        {t("learn.today", { n: Math.max(1, Math.round(pct * 0.12)) })}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-[var(--font-manrope)]">
                    {t("learn.nodes_completed", { n: totalPassed, total: totalNodes })}
                  </p>
                </div>

                {/* View Full Syllabus */}
                <Link href={`/projects/${params.projectName}/tree`} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors group">
                  <span className="text-xs font-medium text-foreground">{t("learn.view_syllabus")}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </Link>

                {/* Materials & Resources */}
                <div>
                  <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">
                    {t("learn.materials")}
                  </p>
                  <div className="space-y-1">
                    {/* Course Notes — opens in-page note panel */}
                    <button
                      onClick={() => setNoteOpen(true)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/60 transition-colors group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{t("learn.course_notes")}</p>
                        <p className="text-[10px] text-muted-foreground font-[var(--font-manrope)]">
                          {noteStatus === "saving" ? t("new_project.saving") : noteStatus === "saved" ? t("project.saved") : t("learn.markdown")}
                        </p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary shrink-0 transition-colors" />
                    </button>
                    <Link
                      href={`/projects/${params.projectName}/resources`}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/60 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                        <ExternalLink className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{t("learn.external_resources")}</p>
                        <p className="text-[10px] text-muted-foreground font-[var(--font-manrope)]">Library</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary shrink-0 transition-colors" />
                    </Link>
                  </div>
                </div>

                {/* AI Tutor card */}
                <div className="rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 p-4 text-white shadow-[0_4px_20px_0_oklch(0.488_0.258_302_/_0.25)]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest opacity-80 font-semibold">
                      {t("learn.ai_tutor_active")}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold mb-1 leading-snug">
                    {t("learn.ai_tutor_hint")}
                  </h3>
                  <p className="text-[11px] opacity-75 mb-3 leading-relaxed">
                    {t("learn.ai_tutor_ask", { topic: activeKnode?.title ?? "this topic" })}
                  </p>
                  <button
                    onClick={() => setTutorOpen(true)}
                    className="w-full h-8 rounded-lg bg-white text-violet-700 text-xs font-bold transition-all hover:bg-white/90 flex items-center justify-center gap-1.5"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    {t("learn.ask_ai")}
                  </button>
                </div>

                {/* Mark as Finished card */}
                {activeNodeId !== null && (
                  <div className={`rounded-xl p-4 border transition-all duration-300 ${
                    isNodeCompleted
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                      : "bg-card border-border/60"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className={`h-4 w-4 ${isNodeCompleted ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                      <span className={`text-xs font-semibold font-[var(--font-manrope)] ${isNodeCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                        {isNodeCompleted ? t("lesson.mastered_title") : t("lesson.ready_title")}
                      </span>
                    </div>
                    <p className={`text-[11px] mb-3 leading-relaxed ${isNodeCompleted ? "text-emerald-600/80 dark:text-emerald-400/70" : "text-muted-foreground"}`}>
                      {isNodeCompleted ? t("lesson.mastered_desc") : t("lesson.ready_desc")}
                    </p>
                    {isNodeCompleted ? (
                      <div className="w-full h-8 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {t("lesson.mastered")}
                      </div>
                    ) : (
                      <button
                        disabled={completing}
                        className="w-full h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 shadow-sm"
                        onClick={() => {
                          // Trigger via LessonView's internal handleMarkComplete
                          // We use a custom event to communicate cross-component
                          window.dispatchEvent(new CustomEvent("lesson:markComplete"))
                        }}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {completing ? t("lesson.completing") : t("lesson.mark_complete")}
                      </button>
                    )}
                  </div>
                )}

              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* AI Tutor side panel (right slide-in) */}
      {/* Backdrop */}
      {tutorOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
          onClick={() => setTutorOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          tutorOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "min(450px, 100vw)" }}
      >
        {/* Glass background */}
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-l border-primary/10 shadow-[−8px_0_40px_rgba(106,28,246,0.08)]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">

          {/* Header */}
          <div className="px-6 py-5 border-b border-primary/10 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground leading-tight">
                  {t("learn.ai_tutor_thread")} <span className="text-primary italic">{t("learn.ai_tutor_italic")}</span>
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-[var(--font-manrope)] font-bold text-muted-foreground uppercase tracking-widest">
                    {t("learn.neural_active")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setTutorOpen(false)}
                className="w-10 h-10 rounded-full hover:bg-primary/10 flex items-center justify-center text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Chat via ChatPanel — fills remaining space */}
          <div className="flex-1 min-h-0">
            <ChatPanel
              project={params.projectName}
              agent="tutor"
              nodeId={activeNodeId}
              activeTab={activeLessonTab}
              pageIndex={activePage}
            />
          </div>

        </div>
      </div>

      {/* Note panel (right slide-in) */}
      {noteOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
          onClick={() => setNoteOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          noteOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "min(450px, 100vw)" }}
      >
        {/* Glass background */}
        <div className="absolute inset-0 bg-[#f1efff]/90 dark:bg-slate-900/90 backdrop-blur-2xl border-l border-primary/10 shadow-[-8px_0_40px_rgba(106,28,246,0.08)]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">

          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-primary/10 bg-white/40 shrink-0">
            <h2 className="font-extrabold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t("learn.notes_title")}
            </h2>
            <div className="flex items-center gap-1">
              <button
                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground transition-colors"
                title="保存"
              >
                <Save className="h-4 w-4" />
              </button>
              <button
                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground transition-colors"
                title="更多"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              <button
                onClick={() => setNoteOpen(false)}
                className="w-9 h-9 rounded-full hover:bg-primary/10 flex items-center justify-center text-foreground transition-colors ml-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Note editor — toolbar is built into NotePanel */}
          <div className="flex-1 min-h-0 overflow-hidden bg-white/5">
            {activeNodeId !== null ? (
              <NotePanel
                projectName={params.projectName}
                nodeId={activeNodeId}
                onStatusChange={setNoteStatus}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                {t("learn.select_node_note")}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-primary/10 bg-white/40 flex gap-3 shrink-0">
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl text-muted-foreground text-xs font-[var(--font-manrope)] font-bold hover:bg-primary/5 transition-colors">
              <History className="h-3.5 w-3.5" />
              {t("learn.history")}
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-foreground text-background rounded-xl text-xs font-[var(--font-manrope)] font-bold hover:opacity-90 transition-colors shadow-sm">
              <FileDown className="h-3.5 w-3.5" />
              {t("learn.export_pdf")}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
