"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { ArrowLeft } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { PageLoading } from "@/components/ui/page-loading"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { gateway } from "@/lib/api"
import type { MilestoneInfo, ProjectDetail } from "@/lib/types/api"

const D3KnowledgeTree = dynamic(
  () => import("@/components/knowledge-tree/d3-knowledge-tree").then((m) => m.D3KnowledgeTree),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="sm" label="加载知识树" />
      </div>
    ),
  }
)

export default function ProjectTreePage() {
  const params = useParams<{ name: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [milestones, setMilestones] = useState<MilestoneInfo[]>([])

  useEffect(() => {
    if (!params.name) return
    gateway
      .project(params.name)
      .then((d) => {
        setDetail(d)
        setMilestones(d.milestones)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.name])

  if (loading) return (
    <>
      <AppHeader title="知识树" />
      <PageLoading />
    </>
  )

  if (error || !detail) return (
    <>
      <AppHeader title="知识树" />
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <p>{error ?? "项目未找到"}</p>
        <Button variant="link" onClick={() => router.back()}>返回</Button>
      </div>
    </>
  )

  const total = detail.progress.length
  const passed = detail.progress.filter((p) => p.status === "passed").length

  const handleNodeClick = (nodeId: number) => {
    router.push(`/learn/${params.name}?node=${nodeId}`)
  }

  return (
    <>
      <AppHeader title="知识树" />
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3 border-b">
          <Link href={`/projects/${params.name}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-semibold">{detail.project.title}</h1>
            <p className="text-xs text-muted-foreground">
              {total} 个知识节点 · {passed} 已完成 · 可缩放拖拽
            </p>
          </div>
        </div>

        {/* Full-height tree */}
        <div className="flex-1">
          <D3KnowledgeTree
            milestones={milestones}
            progress={detail.progress}
            onNodeClick={handleNodeClick}
            projectName={params.name}
            onTreeChange={setMilestones}
          />
        </div>
      </div>
    </>
  )
}
