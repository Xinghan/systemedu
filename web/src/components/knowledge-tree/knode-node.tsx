"use client"

import { memo, useState } from "react"
import { createPortal } from "react-dom"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Clock, Zap, BookOpen } from "lucide-react"
import type { KnodeNodeData } from "@/lib/utils/tree-layout"

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; border: string; bg: string }
> = {
  locked:      { label: "锁定",   dot: "bg-muted-foreground/40", border: "border-muted-foreground/20", bg: "bg-card" },
  available:   { label: "可学",   dot: "bg-blue-500",            border: "border-blue-400/50",         bg: "bg-card" },
  in_progress: { label: "进行中", dot: "bg-amber-500",           border: "border-amber-400/50",        bg: "bg-card" },
  passed:      { label: "完成",   dot: "bg-cyan-500",         border: "border-cyan-400/50",      bg: "bg-card" },
  submitted:   { label: "已提交", dot: "bg-purple-500",          border: "border-purple-400/50",       bg: "bg-card" },
  failed:      { label: "未通过", dot: "bg-destructive",         border: "border-destructive/50",      bg: "bg-card" },
}

function KnodeTooltip({
  data,
  rect,
}: {
  data: KnodeNodeData
  rect: DOMRect
}) {
  const { knode, progress } = data
  const status = progress?.status ?? "locked"
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.locked

  const TOOLTIP_W = 260
  const OFFSET = 10
  const viewW = window.innerWidth

  let left = rect.right + OFFSET
  if (left + TOOLTIP_W > viewW - 8) left = rect.left - TOOLTIP_W - OFFSET

  let top = rect.top
  const APPROX_H = 140
  if (top + APPROX_H > window.innerHeight - 8) top = window.innerHeight - APPROX_H - 8

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left, top, width: TOOLTIP_W }}
    >
      <div className="rounded-xl border border-border/60 bg-popover shadow-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
          <p className="text-sm font-semibold leading-tight">{knode.title}</p>
        </div>
        {knode.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {knode.summary}
          </p>
        )}
        <div className="flex items-center gap-3 pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            难度 {knode.difficulty_level}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {knode.estimated_minutes}m
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {knode.xp_reward} XP
          </span>
          <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cfg.dot.replace("bg-", "text-").replace("/40", "").replace("/50", "")}`}>
            {cfg.label}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function KnodeNodeComponent({ data }: NodeProps<Node<KnodeNodeData>>) {
  const { knode, progress } = data
  const status = progress?.status ?? "locked"
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.locked
  const [hovered, setHovered] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)

  return (
    <div
      className={`px-3 py-2 rounded-lg border ${cfg.border} ${cfg.bg} min-w-[180px] max-w-[220px] shadow-sm cursor-default ${
        status === "locked" ? "opacity-50" : ""
      }`}
      onMouseEnter={(e) => {
        setRect((e.currentTarget as HTMLDivElement).getBoundingClientRect())
        setHovered(true)
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground/50 !w-2 !h-2" />
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
        <span className="text-xs font-medium leading-tight truncate flex-1">{knode.title}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">{knode.xp_reward}XP</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground/50 !w-2 !h-2" />
      {hovered && rect && <KnodeTooltip data={data} rect={rect} />}
    </div>
  )
}

export const KnodeNode = memo(KnodeNodeComponent)
