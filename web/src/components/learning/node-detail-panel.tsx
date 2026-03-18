"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Compass, Clock, Zap, BookOpen, ArrowRight } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { gateway } from "@/lib/api"
import type { KnodeInfo, NodeProgress, NodeContext } from "@/lib/types/api"

const STATUS_LABELS: Record<string, string> = {
  locked: "锁定",
  available: "可学习",
  in_progress: "进行中",
  passed: "已完成",
  submitted: "已提交",
  failed: "未通过",
}

const STATUS_COLORS: Record<string, string> = {
  locked: "bg-muted text-muted-foreground",
  available: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  passed: "bg-green-500/10 text-green-700 dark:text-green-400",
  submitted: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  failed: "bg-destructive/10 text-destructive",
}

interface NodeDetailPanelProps {
  knode: KnodeInfo | null
  progress: NodeProgress | null
  projectName: string
  allKnodes: KnodeInfo[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NodeDetailPanel({
  knode,
  progress,
  projectName,
  allKnodes,
  open,
  onOpenChange,
}: NodeDetailPanelProps) {
  const [context, setContext] = useState<NodeContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)

  const status = progress?.status ?? "locked"

  const handleExplore = useCallback(async () => {
    if (!knode) return
    setContextLoading(true)
    setContextError(null)
    try {
      const data = await gateway.nodeContext(projectName, knode.id)
      setContext(data)
    } catch (e) {
      setContextError(e instanceof Error ? e.message : "加载失败")
    } finally {
      setContextLoading(false)
    }
  }, [knode, projectName])

  // Reset context when a different node is selected
  const nodeId = knode?.id ?? null
  const prevNodeIdRef = useRef<number | null>(null)
  useEffect(() => {
    if (nodeId !== prevNodeIdRef.current) {
      prevNodeIdRef.current = nodeId
      setContext(null)
      setContextError(null)
    }
  }, [nodeId])

  // Get prerequisite node names
  const prereqNames = knode
    ? knode.prerequisite_indices
        .map((idx) => allKnodes[idx]?.title)
        .filter(Boolean)
    : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        {knode ? (
          <>
            <SheetHeader>
              <SheetTitle>{knode.title}</SheetTitle>
              <SheetDescription>{knode.summary}</SheetDescription>
            </SheetHeader>

            <div className="px-4 pb-4 space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                <Badge className={STATUS_COLORS[status]}>
                  {STATUS_LABELS[status]}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Zap className="h-3 w-3" />
                  难度 {knode.difficulty_level}/10
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {knode.estimated_minutes} 分钟
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <BookOpen className="h-3 w-3" />
                  {knode.xp_reward} XP
                </Badge>
              </div>

              {/* Prerequisites */}
              {prereqNames.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-1.5">前置节点</h4>
                  <div className="flex flex-wrap gap-1">
                    {prereqNames.map((name) => (
                      <Badge key={name} variant="secondary" className="text-xs">
                        <ArrowRight className="h-3 w-3 mr-1" />
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Attempts */}
              {progress && progress.attempts > 0 && (
                <p className="text-xs text-muted-foreground">
                  尝试次数: {progress.attempts}
                  {progress.best_score > 0 && ` · 最高分: ${progress.best_score}`}
                </p>
              )}

              {/* AI Context Section */}
              <div className="border-t pt-4">
                {!context && !contextLoading && (
                  <Button
                    onClick={handleExplore}
                    variant="outline"
                    className="w-full gap-2"
                    disabled={contextLoading}
                  >
                    <Compass className="h-4 w-4" />
                    深入探索
                  </Button>
                )}

                {contextLoading && (
                  <div className="flex items-center justify-center py-6">
                    <LoadingSpinner size="sm" label="AI 正在生成知识脉络" />
                  </div>
                )}

                {contextError && (
                  <div className="text-sm text-destructive text-center py-4">
                    {contextError}
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleExplore}
                      className="ml-2"
                    >
                      重试
                    </Button>
                  </div>
                )}

                {context && (
                  <div className="space-y-4">
                    <ContextSection
                      title="前置知识追溯"
                      content={context.prerequisites_trace}
                    />
                    <ContextSection
                      title="学习建议"
                      content={context.learning_suggestions}
                    />
                    <ContextSection
                      title="拓展方向"
                      content={context.related_extensions}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <SheetHeader>
            <SheetTitle>节点详情</SheetTitle>
            <SheetDescription>点击知识树节点查看详情</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ContextSection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="text-sm font-medium mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
        {content}
      </p>
    </div>
  )
}
