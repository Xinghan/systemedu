"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import type { MilestoneNodeData } from "@/lib/utils/tree-layout"

function getMilestoneStatus(passed: number, total: number): string {
  if (total === 0) return "locked"
  if (passed === total) return "completed"
  if (passed > 0) return "in_progress"
  return "available"
}

function MilestoneNodeComponent({ data }: NodeProps<Node<MilestoneNodeData>>) {
  const { milestone, passedNodes, totalNodes } = data
  const status = getMilestoneStatus(passedNodes, totalNodes)
  const pct = totalNodes > 0 ? Math.round((passedNodes / totalNodes) * 100) : 0

  const headerColor =
    status === "completed"
      ? "text-emerald-600 dark:text-emerald-400"
      : status === "in_progress"
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground"

  return (
    <>
      <div className="w-full h-full rounded-xl border border-dashed border-muted-foreground/25 opacity-70">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-muted-foreground/15">
          <h3 className={`text-[11px] font-semibold truncate flex-1 ${headerColor}`}>
            {milestone.title}
          </h3>
          <span className="text-[10px] text-muted-foreground shrink-0 font-[var(--font-manrope)]">
            {passedNodes}/{totalNodes} · {pct}%
          </span>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </>
  )
}

export const MilestoneNode = memo(MilestoneNodeComponent)
