"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Badge } from "@/components/ui/badge"
import type { KnodeNodeData } from "@/lib/utils/tree-layout"

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; border: string }
> = {
  locked: { label: "锁定", bg: "bg-gray-500/10", border: "border-gray-500/30" },
  available: { label: "可学", bg: "bg-blue-500/10", border: "border-blue-500/50" },
  in_progress: { label: "进行中", bg: "bg-amber-500/10", border: "border-amber-500/50" },
  passed: { label: "完成", bg: "bg-green-500/10", border: "border-green-500/50" },
  submitted: { label: "已提交", bg: "bg-purple-500/10", border: "border-purple-500/50" },
  failed: { label: "未通过", bg: "bg-red-500/10", border: "border-red-500/50" },
}

function KnodeNodeComponent({ data }: NodeProps<Node<KnodeNodeData>>) {
  const { knode, progress } = data
  const status = progress?.status ?? "locked"
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.locked

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 ${cfg.bg} ${cfg.border} min-w-[200px] max-w-[240px]`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-medium leading-tight">{knode.title}</span>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {cfg.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
        {knode.summary}
      </p>
      <div className="flex gap-2 text-[10px] text-muted-foreground">
        <span>难度 {knode.difficulty_level}</span>
        <span>·</span>
        <span>{knode.estimated_minutes}min</span>
        <span>·</span>
        <span>{knode.xp_reward}XP</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  )
}

export const KnodeNode = memo(KnodeNodeComponent)
