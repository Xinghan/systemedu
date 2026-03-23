"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { ArrowLeft, Map, CheckCircle2 } from "lucide-react"
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
        <LoadingSpinner size="sm" label="Loading tree" />
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
      <AppHeader title="Knowledge Map" />
      <PageLoading />
    </>
  )

  if (error || !detail) return (
    <>
      <AppHeader title="Knowledge Map" />
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <p>{error ?? "Project not found"}</p>
        <Button variant="link" onClick={() => router.back()}>Go back</Button>
      </div>
    </>
  )

  const total = detail.progress.length
  const passed = detail.progress.filter((p) => p.status === "passed").length
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0

  const handleNodeClick = (nodeId: number) => {
    router.push(`/learn/${params.name}?node=${nodeId}`)
  }

  return (
    <>
      <AppHeader>
        <Link href={`/projects/${params.name}`}>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to project
          </button>
        </Link>
      </AppHeader>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Progress header */}
        <div className="px-6 py-4 border-b border-border/50 bg-background/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Map className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground leading-tight">
                  {detail.project.title}
                </h1>
                <p className="text-[11px] text-muted-foreground font-[var(--font-manrope)]">
                  {total} knowledge nodes &middot; {passed} mastered
                </p>
              </div>
            </div>

            {/* Completion badge */}
            <div className="flex items-center gap-2">
              {pct === 100 && (
                <span className="flex items-center gap-1 text-[10px] font-[var(--font-manrope)] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Complete
                </span>
              )}
              <span className="text-2xl font-extrabold text-foreground tracking-tight">
                {pct}%
              </span>
            </div>
          </div>

          {/* Full-width progress bar */}
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Full-height tree */}
        <div className="flex-1 relative">
          <D3KnowledgeTree
            milestones={milestones}
            progress={detail.progress}
            onNodeClick={handleNodeClick}
            projectName={params.name}
            onTreeChange={setMilestones}
          />

          {/* Legend card — bottom right */}
          <div className="absolute bottom-5 right-5 card-elevated px-4 py-3 text-[11px] font-[var(--font-manrope)] space-y-2 pointer-events-none">
            <p className="uppercase tracking-widest text-muted-foreground font-semibold text-[10px] mb-2">
              Legend
            </p>
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-foreground">Mastered</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-primary shrink-0" />
              <span className="text-foreground">In Progress</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-secondary border border-border shrink-0" />
              <span className="text-foreground">Not Started</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
