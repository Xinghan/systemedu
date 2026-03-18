"use client"

import { memo, useCallback } from "react"
import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react"
import { useViewportStore, type SemanticLayer } from "@/lib/stores/viewport-store"
import type { MilestoneNodeData } from "@/lib/utils/tree-layout"

const STATUS_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  completed: { bg: "bg-green-500/15", border: "border-green-500/50", text: "text-green-700 dark:text-green-400" },
  in_progress: { bg: "bg-amber-500/15", border: "border-amber-500/50", text: "text-amber-700 dark:text-amber-400" },
  available: { bg: "bg-blue-500/15", border: "border-blue-500/50", text: "text-blue-700 dark:text-blue-400" },
  locked: { bg: "bg-muted/50", border: "border-muted-foreground/30", text: "text-muted-foreground" },
}

function getMilestoneStatus(passed: number, total: number): string {
  if (total === 0) return "locked"
  if (passed === total) return "completed"
  if (passed > 0) return "in_progress"
  return "available"
}

function MilestoneNodeComponent({ data }: NodeProps<Node<MilestoneNodeData>>) {
  const layer = useViewportStore((s) => s.layer)
  const reactFlow = useReactFlow()

  const { milestone, passedNodes, totalNodes, totalXp, earnedXp, childNodeIds } = data
  const status = getMilestoneStatus(passedNodes, totalNodes)
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.locked
  const pct = totalNodes > 0 ? Math.round((passedNodes / totalNodes) * 100) : 0

  const handleClick = useCallback(() => {
    if (layer === "overview" && childNodeIds.length > 0) {
      reactFlow.fitView({
        nodes: childNodeIds.map((id) => ({ id })),
        duration: 400,
        padding: 0.2,
      })
    }
  }, [layer, childNodeIds, reactFlow])

  return (
    <>
      {/* Overview: opaque card */}
      {layer === "overview" && (
        <OverviewCard
          title={milestone.title}
          pct={pct}
          passedNodes={passedNodes}
          totalNodes={totalNodes}
          totalXp={totalXp}
          earnedXp={earnedXp}
          color={color}
          onClick={handleClick}
        />
      )}

      {/* Milestone / Detail: transparent container */}
      {layer !== "overview" && (
        <ContainerFrame
          title={milestone.title}
          pct={pct}
          passedNodes={passedNodes}
          totalNodes={totalNodes}
          layer={layer}
        />
      )}

      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </>
  )
}

function OverviewCard({
  title,
  pct,
  passedNodes,
  totalNodes,
  totalXp,
  earnedXp,
  color,
  onClick,
}: {
  title: string
  pct: number
  passedNodes: number
  totalNodes: number
  totalXp: number
  earnedXp: number
  color: { bg: string; border: string; text: string }
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`w-full h-full rounded-xl border-2 ${color.bg} ${color.border} p-5 cursor-pointer hover:shadow-lg transition-shadow flex flex-col justify-between`}
    >
      <div>
        <h3 className={`text-lg font-bold ${color.text} mb-2`}>{title}</h3>
        <div className="w-full bg-muted rounded-full h-2 mb-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {passedNodes}/{totalNodes} 节点 · {pct}%
        </p>
      </div>
      {totalXp > 0 && (
        <div className="text-xs text-muted-foreground mt-2">
          {earnedXp}/{totalXp} XP
        </div>
      )}
    </div>
  )
}

function ContainerFrame({
  title,
  pct,
  passedNodes,
  totalNodes,
  layer,
}: {
  title: string
  pct: number
  passedNodes: number
  totalNodes: number
  layer: SemanticLayer
}) {
  return (
    <div
      className={`w-full h-full rounded-xl border border-dashed border-muted-foreground/20 transition-opacity duration-200 ${
        layer === "detail" ? "opacity-30" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b border-muted-foreground/10">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {passedNodes}/{totalNodes} · {pct}%
        </span>
      </div>
    </div>
  )
}

export const MilestoneNode = memo(MilestoneNodeComponent)
