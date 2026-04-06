"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { useParams, useRouter, useSearchParams } from "next/navigation"
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
  ClipboardList,
  Languages,
  Target,
  Info,
} from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatPanel } from "@/components/chat/chat-panel"
import { NotePanel } from "@/components/learning/note-panel"
import { CourseContentView } from "@/components/learning/course-content-view"
import { AssignmentView } from "@/components/learning/assignment-view"
import { gateway } from "@/lib/api"
import type { KnodeInfo, MilestoneInfo, NodeProgress, ProjectDetail, SubProjectInfo, SpecialNode } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"
import { useAppStore } from "@/lib/stores/app-store"

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
    status === "passed" ? "text-cyan-600" :
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
        {knode.core_question && (
          <p className="text-[11px] text-primary/80 leading-relaxed italic line-clamp-2">{knode.core_question}</p>
        )}
        {knode.hands_on_components && knode.hands_on_components.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {knode.hands_on_components.map((c, i) => (
              <span key={i} className="text-[9px] font-[var(--font-manrope)] px-1.5 py-0.5 rounded bg-secondary/80 text-muted-foreground">
                {c}
              </span>
            ))}
          </div>
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

function SubProjectDetailModal({
  subProject,
  onClose,
}: {
  subProject: SubProjectInfo
  onClose: () => void
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [onClose])

  const sp = subProject

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-border/60 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
              {sp.id} · Level {sp.difficulty} · {sp.estimated_hours}h
            </p>
            <h2 className="text-lg font-bold text-foreground leading-tight">{sp.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-5 text-sm">
            {sp.description && (
              <section>
                <p className="text-foreground leading-relaxed">{sp.description}</p>
              </section>
            )}

            {sp.brief && (
              <section className="px-4 py-3 rounded-lg bg-secondary/40 border-l-2 border-primary/60">
                <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-primary mb-1.5">
                  阶段目标
                </p>
                <p className="italic text-foreground/85 leading-relaxed">{sp.brief}</p>
              </section>
            )}

            {sp.core_problem && (
              <section>
                <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                  核心问题
                </p>
                <p className="text-foreground/85 leading-relaxed">{sp.core_problem}</p>
              </section>
            )}

            {sp.task && (
              <section>
                <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                  任务描述
                </p>
                <p className="text-foreground/85 leading-relaxed">{sp.task}</p>
              </section>
            )}

            {sp.inputs && sp.inputs.length > 0 && (
              <section>
                <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                  输入
                </p>
                <ul className="space-y-1 text-foreground/85">
                  {sp.inputs.map((item, i) => (
                    <li key={i} className="flex gap-2 leading-relaxed">
                      <span className="text-primary/60 shrink-0">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {sp.data_usage && sp.data_usage.length > 0 && (
              <section>
                <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                  数据使用
                </p>
                <ul className="space-y-1 text-foreground/85">
                  {sp.data_usage.map((item, i) => (
                    <li key={i} className="flex gap-2 leading-relaxed">
                      <span className="text-primary/60 shrink-0">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {sp.deliverables && sp.deliverables.length > 0 && (
              <section>
                <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  交付物
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sp.deliverables.map((d, i) => (
                    <span
                      key={i}
                      className="text-xs font-[var(--font-manrope)] px-2.5 py-1 rounded-md bg-secondary text-foreground/85"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {sp.acceptance_criteria && sp.acceptance_criteria.length > 0 && (
              <section>
                <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                  验收标准
                </p>
                <ul className="space-y-1.5 text-foreground/85">
                  {sp.acceptance_criteria.map((item, i) => (
                    <li key={i} className="flex gap-2 leading-relaxed">
                      <CheckCircle className="h-3.5 w-3.5 text-cyan-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {sp.demo_unit && (
              <section>
                <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                  演示单元
                </p>
                <p className="text-foreground/85 leading-relaxed">{sp.demo_unit}</p>
              </section>
            )}

            {sp.handover && (sp.handover.outputs?.length > 0 || sp.handover.method) && (
              <section>
                <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                  交接
                </p>
                {sp.handover.outputs && sp.handover.outputs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {sp.handover.outputs.map((d, i) => (
                      <span
                        key={i}
                        className="text-xs font-[var(--font-manrope)] px-2 py-0.5 rounded-md bg-secondary text-foreground/85"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
                {sp.handover.method && (
                  <p className="text-foreground/80 text-xs leading-relaxed">{sp.handover.method}</p>
                )}
              </section>
            )}

            {sp.why_separate && (
              <section className="px-4 py-3 rounded-lg bg-secondary/30">
                <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                  为什么独立成阶段
                </p>
                <p className="text-foreground/75 text-xs leading-relaxed">{sp.why_separate}</p>
              </section>
            )}
          </div>
        </ScrollArea>

        {/* Footer progress */}
        <div className="px-6 py-4 border-t border-border/60 shrink-0">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700"
                style={{
                  width: `${sp.nodes_total > 0 ? Math.round((sp.nodes_passed / sp.nodes_total) * 100) : 0}%`,
                }}
              />
            </div>
            <span className="font-[var(--font-manrope)] font-semibold text-foreground">
              {sp.nodes_passed}/{sp.nodes_total}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function LearnPage() {
  const params = useParams<{ projectName: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useT()
  const { locale, setLocale } = useAppStore()
  const subProjectId = searchParams.get("sub")

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
  const [tutorOpen, setTutorOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteState, setNoteState] = useState<"closed" | "open" | "minimized">("closed")
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [assignmentText, setAssignmentText] = useState<string | null>(null)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [hoveredNode, setHoveredNode] = useState<NodeTooltipData | null>(null)
  const [spModalOpen, setSpModalOpen] = useState(false)
  const sessionStartRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!params.projectName) return
    gateway
      .project(params.projectName)
      .then(setDetail)
      .catch((e) => setError(e.message ?? t("learn.failed_load")))
      .finally(() => setLoading(false))

  }, [params.projectName])

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

  // Sub-project filtering
  const activeSubProject: SubProjectInfo | null = useMemo(() => {
    if (!subProjectId || !detail?.sub_projects) return null
    return detail.sub_projects.find((sp) => sp.id === subProjectId) ?? null
  }, [subProjectId, detail])

  const visibleMilestones: MilestoneInfo[] = useMemo(() => {
    if (!detail) return []
    if (!activeSubProject) return detail.milestones
    return activeSubProject.milestone_indices
      .filter((idx) => idx < detail.milestones.length)
      .map((idx) => detail.milestones[idx])
  }, [detail, activeSubProject])

  // Collect node IDs belonging to current sub-project for scoped progress
  const scopedNodeIds: Set<number> | null = useMemo(() => {
    if (!activeSubProject || !detail) return null
    const ids = new Set<number>()
    for (const msIdx of activeSubProject.milestone_indices) {
      if (msIdx < detail.milestones.length) {
        const ms = detail.milestones[msIdx]
        for (const knode of ms.knodes) {
          ids.add(knode.id)
        }
      }
    }
    return ids
  }, [activeSubProject, detail])

  const progressList = detail?.progress ?? []
  const scopedProgress = scopedNodeIds
    ? progressList.filter((p) => scopedNodeIds.has(p.knode_id))
    : progressList
  const totalPassed = scopedProgress.filter((p) => p.status === "passed").length
  const totalNodes = scopedProgress.length
  const pct = totalNodes > 0 ? Math.round((totalPassed / totalNodes) * 100) : 0

  const handleNodeClick = useCallback((nodeId: number) => {
    setActiveNodeId(nodeId)
    setAssignmentText(null)
    setAssignmentOpen(false)
  }, [])

  const handleMarkComplete = useCallback(async () => {
    if (activeNodeId === null) return
    try {
      const result = await gateway.updateNodeProgress(params.projectName, activeNodeId, "passed")
      setDetail((prev) => prev ? { ...prev, progress: result.progress } : prev)
    } catch { /* non-fatal */ }
  }, [activeNodeId, params.projectName])

  const activeKnode = activeNodeId !== null ? allKnodes[activeNodeId] ?? null : null
  const activeMs = detail?.milestones.find((ms) => ms.knodes.some((k) => k.id === activeNodeId)) ?? detail?.milestones[0]
  const categoryLabel = CATEGORY_LABELS[detail?.project.category ?? ""] ?? "General"
  const isNodeCompleted = activeNodeId !== null
    ? progressList.find((p) => p.knode_id === activeNodeId)?.status === "passed"
    : false

  // Search filtering for sidebar — uses visibleMilestones (scoped to sub-project)
  const filteredMilestones = useMemo(() => {
    if (!detail) return []
    const base = visibleMilestones
    if (!searchQuery.trim()) return base
    const q = searchQuery.toLowerCase()
    return base
      .map((ms) => ({
        ...ms,
        knodes: ms.knodes.filter((k) => k.title.toLowerCase().includes(q) || k.summary?.toLowerCase().includes(q)),
      }))
      .filter((ms) => ms.knodes.length > 0)
  }, [detail, visibleMilestones, searchQuery])

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

      {/* Sub-project detail modal */}
      {spModalOpen && activeSubProject && (
        <SubProjectDetailModal
          subProject={activeSubProject}
          onClose={() => setSpModalOpen(false)}
        />
      )}

      {/* Top header bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
        <Link href={`/projects/${params.projectName}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <span className="font-[var(--font-manrope)] uppercase tracking-widest">{categoryLabel}</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        {activeSubProject ? (
          <>
            <span className="text-xs font-[var(--font-manrope)] uppercase tracking-widest text-primary font-semibold">
              {activeSubProject.id}: {activeSubProject.title}
            </span>
          </>
        ) : activeMs ? (
          <span className="text-xs font-[var(--font-manrope)] uppercase tracking-widest text-primary font-semibold">
            {t("learn.module")} {(detail.milestones.indexOf(activeMs) + 1).toString().padStart(2, "0")}
          </span>
        ) : null}
        <div className="flex-1" />
        {/* Progress */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-[var(--font-manrope)] font-semibold text-foreground">{pct}%</span>
        </div>
        <button
          onClick={() => setLocale(locale === "en" ? "zh" : "en")}
          className="flex items-center gap-1 h-7 px-2 rounded-lg hover:bg-secondary transition-colors text-xs font-[var(--font-manrope)] font-semibold text-muted-foreground hover:text-foreground"
          title="Toggle language"
        >
          <Languages className="h-3.5 w-3.5" />
          {locale === "en" ? "中" : "EN"}
        </button>
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

            {/* Sub-project overview trigger */}
            {activeSubProject && (
              <div className="px-3 pb-2 shrink-0">
                <button
                  onClick={() => setSpModalOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors text-left group"
                >
                  <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground flex-1 min-w-0 truncate">
                    {activeSubProject.id}: {activeSubProject.title}
                  </span>
                  <Info className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                </button>
              </div>
            )}

            <ScrollArea className="flex-1 min-h-0">
              <div className="px-3 pb-4 space-y-4">
                {filteredMilestones.map((ms) => (
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
                        const globalIdx = allKnodes.findIndex((k) => k.id === knode.id)
                        const displayIdx = globalIdx + 1

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
                                <CheckCircle2 className="h-4 w-4 text-cyan-500" />
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
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700"
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

        {/* Center: course content (v2 pipeline) or assignment */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {assignmentOpen ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Assignment header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 shrink-0">
                <button
                  onClick={() => setAssignmentOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" />
                </button>
                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
                  <ClipboardList className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t("learn.assignment")}</p>
                  <p className="text-[10px] text-muted-foreground font-[var(--font-manrope)]">
                    {activeKnode?.title ?? ""}
                  </p>
                </div>
              </div>
              {/* Assignment body */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="px-6 py-5 max-w-3xl mx-auto">
                  {assignmentLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                      <p className="text-xs">{t("learn.assignment_loading")}</p>
                    </div>
                  ) : (
                    <AssignmentView content={assignmentText ?? ""} />
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : activeNodeId !== null ? (
            <CourseContentView
              projectName={params.projectName}
              nodeId={activeNodeId}
              knode={allKnodes[activeNodeId] ?? null}
              onClose={() => setActiveNodeId(null)}
              onMarkComplete={handleMarkComplete}
            />
          ) : (
            <ScrollArea className="flex-1 min-h-0">
              <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                {/* Project overview card */}
                {detail.special_nodes?.filter((sn) => sn.node_role === "project_overview").map((sn) => (
                  <div key={sn.node_id} className="rounded-2xl border border-border bg-card p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-primary mb-1">
                          {t("learn.project_overview")}
                        </p>
                        <h2 className="text-lg font-bold text-foreground leading-tight">{sn.title}</h2>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/85 leading-relaxed">{sn.summary}</p>
                    {sn.detailed_description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{sn.detailed_description}</p>
                    )}
                    {sn.core_mission && (
                      <div className="px-4 py-3 rounded-lg bg-primary/5 border-l-2 border-primary/40">
                        <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-primary mb-1">
                          {t("learn.core_mission")}
                        </p>
                        <p className="text-sm text-foreground/85 leading-relaxed">{sn.core_mission}</p>
                      </div>
                    )}
                    {sn.knowledge_coverage_domains && sn.knowledge_coverage_domains.length > 0 && (
                      <div>
                        <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          {t("learn.coverage_domains")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {sn.knowledge_coverage_domains.map((d, i) => (
                            <span key={i} className="text-xs font-[var(--font-manrope)] px-2.5 py-1 rounded-md bg-secondary text-foreground/85">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {sn.real_industry_examples && sn.real_industry_examples.length > 0 && (
                      <div>
                        <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          {t("learn.industry_examples")}
                        </p>
                        <div className="space-y-2">
                          {sn.real_industry_examples.map((ex) => (
                            <div key={ex.example_id} className="px-3 py-2 rounded-lg bg-secondary/40">
                              <p className="text-xs font-semibold text-foreground">{ex.name}</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{ex.description}</p>
                              <p className="text-[11px] text-primary/70 leading-relaxed mt-0.5 italic">{ex.relation_to_this_project}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Prompt to select a node */}
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-4">
                  <BookOpen className="h-8 w-8 opacity-20" />
                  <p className="text-sm">{t("learn.select_node")}</p>
                </div>

                {/* Future extension card */}
                {detail.special_nodes?.filter((sn) => sn.node_role === "future_extension").map((sn) => (
                  <div key={sn.node_id} className="rounded-2xl border border-border bg-card p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
                        <Sparkles className="h-5 w-5 text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-violet-600 mb-1">
                          {t("learn.future_extension")}
                        </p>
                        <h2 className="text-lg font-bold text-foreground leading-tight">{sn.title}</h2>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/85 leading-relaxed">{sn.summary}</p>
                    {sn.detailed_description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{sn.detailed_description}</p>
                    )}
                    {sn.future_extension_paths && sn.future_extension_paths.length > 0 && (
                      <div>
                        <p className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          {t("learn.extension_paths")}
                        </p>
                        <div className="space-y-2">
                          {sn.future_extension_paths.map((path) => (
                            <div key={path.path_id} className="px-3 py-2 rounded-lg bg-secondary/40">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-xs font-semibold text-foreground">{path.title}</p>
                                <span className="text-[9px] font-[var(--font-manrope)] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 font-semibold">
                                  {path.direction_type}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{path.description}</p>
                              {path.new_capabilities_needed && path.new_capabilities_needed.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {path.new_capabilities_needed.map((cap, i) => (
                                    <span key={i} className="text-[9px] font-[var(--font-manrope)] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                      {cap}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
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
                      <span className="text-[10px] font-[var(--font-manrope)] text-cyan-600 font-semibold mb-1">
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
                      <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-500/15 flex items-center justify-center">
                        <ExternalLink className="h-4 w-4 text-cyan-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{t("learn.external_resources")}</p>
                        <p className="text-[10px] text-muted-foreground font-[var(--font-manrope)]">Library</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary shrink-0 transition-colors" />
                    </Link>
                    {/* Assignment */}
                    <button
                      onClick={() => {
                        setAssignmentOpen(true)
                        if (assignmentText === null && activeNodeId !== null && !assignmentLoading) {
                          setAssignmentLoading(true)
                          gateway.getCourseV2Assignment(params.projectName, activeNodeId)
                            .then((data) => setAssignmentText(data.assignment || ""))
                            .catch(() => setAssignmentText(""))
                            .finally(() => setAssignmentLoading(false))
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/60 transition-colors group text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0">
                        <ClipboardList className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{t("learn.assignment")}</p>
                        <p className="text-[10px] text-muted-foreground font-[var(--font-manrope)]">{t("learn.assignment_subtitle")}</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary shrink-0 transition-colors" />
                    </button>
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
                      ? "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800"
                      : "bg-card border-border/60"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className={`h-4 w-4 ${isNodeCompleted ? "text-cyan-500" : "text-muted-foreground/40"}`} />
                      <span className={`text-xs font-semibold font-[var(--font-manrope)] ${isNodeCompleted ? "text-cyan-700 dark:text-cyan-400" : "text-foreground"}`}>
                        {isNodeCompleted ? t("lesson.mastered_title") : t("lesson.ready_title")}
                      </span>
                    </div>
                    <p className={`text-[11px] mb-3 leading-relaxed ${isNodeCompleted ? "text-cyan-600/80 dark:text-cyan-400/70" : "text-muted-foreground"}`}>
                      {isNodeCompleted ? t("lesson.mastered_desc") : t("lesson.ready_desc")}
                    </p>
                    {isNodeCompleted ? (
                      <div className="w-full h-8 rounded-lg bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {t("lesson.mastered")}
                      </div>
                    ) : (
                      <button
                        className="w-full h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-all hover:bg-primary/90 active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                        onClick={handleMarkComplete}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {t("lesson.mark_complete")}
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
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
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
