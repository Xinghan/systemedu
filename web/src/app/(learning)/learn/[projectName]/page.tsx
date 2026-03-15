"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TreeFlow } from "@/components/knowledge-tree/tree-flow"
import { ChatPanel } from "@/components/chat/chat-panel"
import { NodeContextPanel } from "@/components/learning/node-context-panel"
import { gateway } from "@/lib/api"
import type { KnodeInfo, ProjectDetail, NodeProgress } from "@/lib/types/api"

export default function LearnPage() {
  const params = useParams<{ projectName: string }>()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null)

  useEffect(() => {
    if (!params.projectName) return
    gateway
      .project(params.projectName)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.projectName])

  const allKnodes = useMemo(() => {
    if (!detail) return []
    const knodes: KnodeInfo[] = []
    for (const ms of detail.milestones) {
      knodes.push(...ms.knodes)
    }
    return knodes
  }, [detail])

  const activeKnode = activeNodeId !== null ? allKnodes[activeNodeId] ?? null : null
  const activeProgress = activeNodeId !== null
    ? detail?.progress.find((p) => p.knode_id === activeNodeId) ?? null
    : null

  const totalPassed = detail?.progress.filter((p) => p.status === "passed").length ?? 0

  const handleNodeClick = useCallback((nodeId: number) => {
    setActiveNodeId(nodeId)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载中...
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>项目未找到</p>
        <Link href="/projects">
          <Button variant="link">返回</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left: DAG + node context */}
      <div className="w-1/2 border-r flex flex-col">
        <div className="flex items-center gap-2 p-3 border-b">
          <Link href={`/projects/${params.projectName}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="font-semibold text-sm truncate">{detail.project.title}</h2>
        </div>
        <div className="flex-1">
          <TreeFlow
            milestones={detail.milestones}
            progress={detail.progress}
            onNodeClick={handleNodeClick}
          />
        </div>
        <NodeContextPanel
          knode={activeKnode}
          progress={activeProgress}
          totalPassed={totalPassed}
          totalNodes={detail.progress.length}
        />
      </div>

      {/* Right: tutor chat */}
      <div className="w-1/2 flex flex-col">
        <div className="p-3 border-b">
          <h2 className="font-semibold text-sm">AI 导师</h2>
          <p className="text-xs text-muted-foreground">
            {activeKnode ? `当前: ${activeKnode.title}` : "选择节点开始学习"}
          </p>
        </div>
        <div className="flex-1">
          <ChatPanel project={params.projectName} agent="tutor" />
        </div>
      </div>
    </div>
  )
}
