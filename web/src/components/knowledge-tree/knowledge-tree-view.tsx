"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  ChevronRight,
  ChevronDown,
  Clock,
  Zap,
  BookOpen,
  CheckCircle,
  Lock,
  Circle,
  ArrowRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { LessonStatus, MilestoneInfo, NodeProgress } from "@/lib/types/api"

interface KnowledgeTreeViewProps {
  milestones: MilestoneInfo[]
  progress: NodeProgress[]
  lessonStatuses?: Record<string, LessonStatus>
  activeNodeId?: number | null
  onNodeClick?: (nodeId: number) => void
  searchQuery?: string
}

const STATUS_CONFIG: Record<string, {
  label: string
  icon: typeof CheckCircle
  color: string
  badgeClass: string
}> = {
  locked: {
    label: "锁定",
    icon: Lock,
    color: "text-muted-foreground/50",
    badgeClass: "bg-muted text-muted-foreground",
  },
  available: {
    label: "可学习",
    icon: Circle,
    color: "text-blue-500",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  in_progress: {
    label: "进行中",
    icon: ArrowRight,
    color: "text-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  passed: {
    label: "已完成",
    icon: CheckCircle,
    color: "text-green-500",
    badgeClass: "bg-green-500/10 text-green-700 dark:text-green-400",
  },
  submitted: {
    label: "已提交",
    icon: Circle,
    color: "text-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  },
  failed: {
    label: "未通过",
    icon: Circle,
    color: "text-destructive",
    badgeClass: "bg-destructive/10 text-destructive",
  },
}

// Portal tooltip that escapes overflow containers
interface TooltipData {
  knode: MilestoneInfo["knodes"][number]
  status: string
  cfg: typeof STATUS_CONFIG[string]
  rect: DOMRect
}

function NodeTooltip({ data }: { data: TooltipData }) {
  const { knode, cfg } = data
  const StatusIcon = cfg.icon

  // Position: try right of element first, fallback to left if too close to edge
  const TOOLTIP_W = 280
  const TOOLTIP_OFFSET = 8
  const viewportW = window.innerWidth

  let left = data.rect.right + TOOLTIP_OFFSET
  if (left + TOOLTIP_W > viewportW - 8) {
    left = data.rect.left - TOOLTIP_W - TOOLTIP_OFFSET
  }

  // Vertical: align with top of element, clamp to viewport
  const TOOLTIP_APPROX_H = 160
  let top = data.rect.top
  if (top + TOOLTIP_APPROX_H > window.innerHeight - 8) {
    top = window.innerHeight - TOOLTIP_APPROX_H - 8
  }

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left, top, width: TOOLTIP_W }}
    >
      <div className="rounded-lg border bg-popover text-popover-foreground shadow-lg p-3 space-y-2">
        <div className="flex items-start gap-2">
          <StatusIcon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.color}`} />
          <p className="text-sm font-semibold leading-tight">{knode.title}</p>
        </div>
        {knode.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {knode.summary}
          </p>
        )}
        <div className="flex items-center gap-3 pt-1 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            难度 {knode.difficulty_level}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {knode.estimated_minutes} 分钟
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {knode.xp_reward} XP
          </span>
        </div>
        <div>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.badgeClass}`}>
            {cfg.label}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function KnowledgeTreeView({
  milestones,
  progress,
  lessonStatuses = {},
  activeNodeId,
  onNodeClick,
  searchQuery = "",
}: KnowledgeTreeViewProps) {
  const progressMap = new Map(progress.map((p) => [p.knode_id, p]))
  const [hoveredTooltip, setHoveredTooltip] = useState<TooltipData | null>(null)

  // Compute which milestone index each globalId belongs to
  const nodeToMsIdx = new Map<number, number>()
  let gIdx = 0
  for (let msIdx = 0; msIdx < milestones.length; msIdx++) {
    for (let i = 0; i < milestones[msIdx].knodes.length; i++) {
      nodeToMsIdx.set(gIdx++, msIdx)
    }
  }

  // Auto-expand the milestone that contains the active node
  const activeMsIdx = activeNodeId != null ? (nodeToMsIdx.get(activeNodeId) ?? 0) : 0
  const [expandedMs, setExpandedMs] = useState<Set<number>>(() => new Set([activeMsIdx]))

  // When activeNodeId changes, expand its milestone and scroll the node into view
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  useEffect(() => {
    if (activeNodeId == null) return
    const msIdx = nodeToMsIdx.get(activeNodeId)
    if (msIdx == null) return
    setExpandedMs((prev) => {
      if (prev.has(msIdx)) return prev
      const next = new Set(prev)
      next.add(msIdx)
      return next
    })
    // Scroll after the next paint so the element is visible
    requestAnimationFrame(() => {
      nodeRefs.current.get(activeNodeId)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodeId])

  const toggleMilestone = useCallback((msIdx: number) => {
    setExpandedMs((prev) => {
      const next = new Set(prev)
      if (next.has(msIdx)) {
        next.delete(msIdx)
      } else {
        next.add(msIdx)
      }
      return next
    })
  }, [])

  const lq = searchQuery.trim().toLowerCase()

  let globalIdx = 0

  return (
    <div className="space-y-2">
      {hoveredTooltip && <NodeTooltip data={hoveredTooltip} />}
      {milestones.map((ms, msIdx) => {
        const startIdx = globalIdx
        const knodeIds = ms.knodes.map((_, i) => startIdx + i)
        globalIdx += ms.knodes.length

        // Filter nodes by search query
        const visibleKnodes = lq
          ? ms.knodes.map((knode, li) => ({ knode, li })).filter(
              ({ knode }) =>
                knode.title.toLowerCase().includes(lq) ||
                (knode.summary ?? "").toLowerCase().includes(lq)
            )
          : ms.knodes.map((knode, li) => ({ knode, li }))

        // Hide milestone entirely if no nodes match
        if (lq && visibleKnodes.length === 0) {
          return null
        }

        const passedCount = knodeIds.filter(
          (id) => progressMap.get(id)?.status === "passed"
        ).length
        const totalCount = ms.knodes.length
        const pct = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0
        const isExpanded = expandedMs.has(msIdx)

        const msStatus =
          passedCount === totalCount && totalCount > 0
            ? "completed"
            : passedCount > 0
            ? "in_progress"
            : "available"

        const msColor =
          msStatus === "completed"
            ? "border-green-500/40 bg-green-500/5"
            : msStatus === "in_progress"
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-border bg-card"

        return (
          <div key={msIdx} className={`rounded-lg border ${msColor} overflow-hidden`}>
            {/* Milestone header */}
            <button
              onClick={() => toggleMilestone(msIdx)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="shrink-0 text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    里程碑 {msIdx + 1}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {passedCount}/{totalCount} 节点
                  </span>
                </div>
                <h3 className="font-semibold text-sm mt-0.5">{ms.title}</h3>
                {ms.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {ms.description}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-3">
                <div className="w-20">
                  <Progress value={pct} className="h-1.5" />
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
              </div>
            </button>

            {/* Expanded knode list */}
            {(isExpanded || lq) && (
              <div className="border-t px-4 pb-3 pt-1">
                <div className="space-y-1">
                  {visibleKnodes.map(({ knode, li }) => {
                    const nodeId = startIdx + li
                    const p = progressMap.get(nodeId)
                    const status = p?.status ?? "locked"
                    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.locked
                    const StatusIcon = cfg.icon
                    const isClickable = status !== "locked" && !!onNodeClick
                    const isActive = activeNodeId === nodeId
                    const lessonStatus = lessonStatuses[String(nodeId)]

                    return (
                      <div
                        key={nodeId}
                        ref={(el) => {
                          if (el) nodeRefs.current.set(nodeId, el)
                          else nodeRefs.current.delete(nodeId)
                        }}
                        onClick={isClickable ? () => onNodeClick!(nodeId) : undefined}
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                          setHoveredTooltip({ knode, status, cfg, rect })
                        }}
                        onMouseLeave={() => setHoveredTooltip(null)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
                          isActive
                            ? "bg-primary/10 ring-1 ring-primary/30"
                            : isClickable
                            ? "cursor-pointer hover:bg-muted/50"
                            : status === "locked"
                            ? "opacity-50"
                            : ""
                        } ${isClickable && !isActive ? "cursor-pointer" : ""}`}
                      >
                        <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {knode.title}
                            </span>
                            {status === "passed" && (
                              <Badge className={`${cfg.badgeClass} text-[10px]`}>
                                已完成
                              </Badge>
                            )}
                            {lessonStatus === "generating" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 shrink-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                生成中
                              </span>
                            )}
                            {lessonStatus === "ready" && status !== "passed" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 shrink-0">
                                已就绪
                              </span>
                            )}
                            {lessonStatus === "failed" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 shrink-0">
                                生成失败
                              </span>
                            )}
                          </div>
                          {knode.summary && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {knode.summary}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Zap className="h-3 w-3" />
                            {knode.difficulty_level}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {knode.estimated_minutes}m
                          </span>
                          <span className="flex items-center gap-0.5">
                            <BookOpen className="h-3 w-3" />
                            {knode.xp_reward}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
