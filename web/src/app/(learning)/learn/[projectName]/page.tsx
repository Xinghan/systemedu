"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
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
} from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LessonView } from "@/components/learning/lesson-view"
import { gateway } from "@/lib/api"
import type { KnodeInfo, LessonStatus, NodeProgress, ProjectDetail } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

function getNodeStatus(nodeId: number, progress: NodeProgress[]): NodeProgress["status"] {
  return progress.find((p) => p.knode_id === nodeId)?.status ?? "locked"
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
    <div className="flex flex-col w-full h-full overflow-hidden bg-background">
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
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Node title header */}
          {activeKnode && (
            <div className="px-8 pt-6 pb-0 shrink-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1 pr-6">
                  <h1 className="text-2xl font-extrabold text-foreground tracking-tight leading-tight mb-1">
                    {activeKnode.title.split(" ").map((word, i) => (
                      <span key={i}>
                        {i > 0 && " "}
                        <span className={i === Math.floor(activeKnode.title.split(" ").length / 2) ? "text-primary" : ""}>
                          {word}
                        </span>
                      </span>
                    ))}
                  </h1>
                  {activeKnode.summary && (
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                      {activeKnode.summary}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Lesson content */}
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
                    {[
                      {
                        icon: <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/15 flex items-center justify-center"><BookOpen className="h-4 w-4 text-red-600" /></div>,
                        label: t("learn.course_notes"),
                        sub: "PDF",
                        href: `/projects/${params.projectName}/notes`,
                      },
                      {
                        icon: <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center"><ExternalLink className="h-4 w-4 text-emerald-600" /></div>,
                        label: t("learn.external_resources"),
                        sub: "Library",
                        href: `/projects/${params.projectName}/resources`,
                      },
                    ].map((item) => (
                      <Link key={item.label} href={item.href} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/60 transition-colors group">
                        {item.icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground font-[var(--font-manrope)]">{item.sub}</p>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary shrink-0 transition-colors" />
                      </Link>
                    ))}
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
                    onClick={() => {}}
                    className="w-full h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    {t("learn.ask_ai")}
                  </button>
                </div>

              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Floating chat */}
    </div>
  )
}
