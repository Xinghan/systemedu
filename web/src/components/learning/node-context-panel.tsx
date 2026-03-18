"use client"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { KnodeInfo, NodeProgress } from "@/lib/types/api"

const STATUS_LABELS: Record<string, string> = {
  locked: "锁定",
  available: "可学习",
  in_progress: "进行中",
  passed: "已完成",
  submitted: "已提交",
  failed: "未通过",
}

interface NodeContextPanelProps {
  knode: KnodeInfo | null
  progress: NodeProgress | null
  totalPassed: number
  totalNodes: number
}

export function NodeContextPanel({
  knode,
  progress,
  totalPassed,
  totalNodes,
}: NodeContextPanelProps) {
  const pct = totalNodes > 0 ? Math.round((totalPassed / totalNodes) * 100) : 0

  return (
    <div className="p-4 space-y-4 border-t max-h-[40vh] overflow-y-auto">
      {/* Overall progress */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">总进度</span>
          <span className="font-medium">
            {totalPassed}/{totalNodes} ({pct}%)
          </span>
        </div>
        <Progress value={pct} />
      </div>

      {/* Selected node info */}
      {knode ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-base">{knode.title}</h3>
          <p className="text-sm text-muted-foreground">{knode.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">难度 {knode.difficulty_level}/10</Badge>
            <Badge variant="outline">{knode.estimated_minutes} 分钟</Badge>
            <Badge variant="outline">{knode.xp_reward} XP</Badge>
            <Badge variant="secondary">{STATUS_LABELS[progress?.status ?? "locked"]}</Badge>
          </div>
          {progress?.attempts ? (
            <p className="text-sm text-muted-foreground">
              尝试次数: {progress.attempts}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-base text-muted-foreground">点击知识树节点查看详情</p>
      )}
    </div>
  )
}
