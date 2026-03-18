"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Bookmark, BookmarkCheck, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { PageLoading } from "@/components/ui/page-loading"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { gateway } from "@/lib/api"
import type { MilestoneInfo, ProjectResourcesResponse, ResourceItem } from "@/lib/types/api"

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v")
    if (u.hostname === "youtu.be") return u.pathname.slice(1)
  } catch { /* ignore */ }
  return null
}

function ResourceRow({
  resource,
  projectName,
  nodeId,
  onToggle,
}: {
  resource: ResourceItem
  projectName: string
  nodeId: number
  onToggle: (r: ResourceItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const videoId = resource.source_type === "youtube" ? extractYouTubeId(resource.url) : null

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="secondary" className="text-xs shrink-0">
              {resource.source_type === "youtube" ? "视频" : "网页"}
            </Badge>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline truncate flex items-center gap-1"
            >
              {resource.title}
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
            </a>
          </div>
          {resource.snippet && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{resource.snippet}</p>
          )}
          {videoId && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 text-xs text-primary hover:underline"
            >
              {expanded ? "收起播放器" : "在此播放"}
            </button>
          )}
        </div>
        <button
          onClick={() => onToggle(resource)}
          className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
          title={resource.saved ? "取消收藏" : "收藏"}
        >
          {resource.saved ? (
            <BookmarkCheck className="h-4 w-4 text-primary" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </button>
      </div>
      {expanded && videoId && (
        <div className="px-3 pb-3">
          <div className="rounded-md overflow-hidden aspect-video w-full">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title={resource.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function NodeSection({
  nodeId,
  nodeTitle,
  resources,
  projectName,
  onToggle,
}: {
  nodeId: number
  nodeTitle: string
  resources: ResourceItem[]
  projectName: string
  onToggle: (nodeId: number, r: ResourceItem) => void
}) {
  const [open, setOpen] = useState(true)
  const savedCount = resources.filter((r) => r.saved).length

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-medium text-sm flex-1">{nodeTitle}</span>
        <span className="text-xs text-muted-foreground">
          {resources.length} 条资料
          {savedCount > 0 && ` · ${savedCount} 已收藏`}
        </span>
      </button>
      {open && (
        <div className="p-3 space-y-2">
          {resources.map((r) => (
            <ResourceRow
              key={r.id}
              resource={r}
              projectName={projectName}
              nodeId={nodeId}
              onToggle={(res) => onToggle(nodeId, res)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProjectResourcesPage() {
  const params = useParams<{ name: string }>()
  const router = useRouter()
  const [milestones, setMilestones] = useState<MilestoneInfo[]>([])
  const [resourceMap, setResourceMap] = useState<ProjectResourcesResponse>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params.name) return
    Promise.all([
      gateway.project(params.name),
      gateway.getAllResources(params.name),
    ])
      .then(([detail, resources]) => {
        setMilestones(detail.milestones)
        setResourceMap(resources)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.name])

  const handleToggle = async (nodeId: number, resource: ResourceItem) => {
    const newSaved = !resource.saved
    // Optimistic update
    setResourceMap((prev) => {
      const key = String(nodeId)
      if (!prev[key]) return prev
      return {
        ...prev,
        [key]: {
          ...prev[key],
          resources: prev[key].resources.map((r) =>
            r.id === resource.id ? { ...r, saved: newSaved } : r
          ),
        },
      }
    })
    try {
      await gateway.toggleResourceSaved(params.name, nodeId, resource.id, newSaved)
    } catch {
      // revert
      setResourceMap((prev) => {
        const key = String(nodeId)
        if (!prev[key]) return prev
        return {
          ...prev,
          [key]: {
            ...prev[key],
            resources: prev[key].resources.map((r) =>
              r.id === resource.id ? { ...r, saved: resource.saved } : r
            ),
          },
        }
      })
    }
  }

  if (loading) return (
    <>
      <AppHeader title="项目资料" />
      <PageLoading />
    </>
  )

  if (error) return (
    <>
      <AppHeader title="项目资料" />
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <p>{error}</p>
        <Button variant="link" onClick={() => router.back()}>返回</Button>
      </div>
    </>
  )

  // Build node title map from milestones
  const nodeTitles: Record<number, string> = {}
  milestones.forEach((ms) => {
    ms.knodes.forEach((kn) => {
      nodeTitles[kn.id] = kn.title
    })
  })

  const totalResources = Object.values(resourceMap).reduce((sum, g) => sum + g.resources.length, 0)
  const totalSaved = Object.values(resourceMap).reduce(
    (sum, g) => sum + g.resources.filter((r) => r.saved).length, 0
  )

  return (
    <>
      <AppHeader title="项目资料" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Link href={`/projects/${params.name}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">项目资料</h1>
              {totalResources > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  共 {totalResources} 条资料 · {totalSaved} 已收藏
                </p>
              )}
            </div>
          </div>

          {/* Empty state */}
          {totalResources === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <p className="text-sm">暂无收集的资料</p>
              <p className="text-xs">在学习页面打开知识点，切换到"资料"标签页收集资料</p>
              <Button variant="outline" size="sm" onClick={() => router.push(`/learn/${params.name}`)}>
                去学习页面
              </Button>
            </div>
          )}

          {/* Milestones */}
          {milestones.map((ms) => {
            // Only show milestones that have at least one node with resources
            const nodesWithResources = ms.knodes.filter(
              (kn) => resourceMap[String(kn.id)]?.resources.length > 0
            )
            if (nodesWithResources.length === 0) return null

            return (
              <div key={ms.order} className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {ms.title}
                </h2>
                {nodesWithResources.map((kn) => {
                  const group = resourceMap[String(kn.id)]
                  return (
                    <NodeSection
                      key={kn.id}
                      nodeId={kn.id}
                      nodeTitle={kn.title}
                      resources={group.resources}
                      projectName={params.name}
                      onToggle={handleToggle}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
