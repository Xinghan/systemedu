"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Badge } from "@/components/ui/badge"
import type { KnodeNodeData } from "@/lib/utils/tree-layout"

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; border: string }
> = {
  locked: { label: "锁定", dot: "bg-muted-foreground/50", border: "border-muted-foreground/30" },
  available: { label: "可学", dot: "bg-blue-500", border: "border-blue-500/50" },
  in_progress: { label: "进行中", dot: "bg-amber-500", border: "border-amber-500/50" },
  passed: { label: "完成", dot: "bg-green-500", border: "border-green-500/50" },
  submitted: { label: "已提交", dot: "bg-purple-500", border: "border-purple-500/50" },
  failed: { label: "未通过", dot: "bg-destructive", border: "border-destructive/50" },
}

function KnodeNodeComponent({ data }: NodeProps<Node<KnodeNodeData>>) {
  const { knode, progress } = data
  const status = progress?.status ?? "locked"
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.locked

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-card text-card-foreground ${cfg.border} min-w-[200px] max-w-[240px] shadow-sm`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
          <span className="text-sm font-medium leading-tight">{knode.title}</span>
        </div>
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
