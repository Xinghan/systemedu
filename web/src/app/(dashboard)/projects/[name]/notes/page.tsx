"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { PageLoading } from "@/components/ui/page-loading"
import { Button } from "@/components/ui/button"
import { gateway } from "@/lib/api"
import type { MilestoneInfo, ProjectNotesResponse } from "@/lib/types/api"

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\[.*?\]\(.+?\)/g, "")
    .replace(/^\s*[-*>]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim()
}

export default function ProjectNotesPage() {
  const params = useParams<{ name: string }>()
  const router = useRouter()
  const [milestones, setMilestones] = useState<MilestoneInfo[]>([])
  const [noteMap, setNoteMap] = useState<ProjectNotesResponse>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params.name) return
    Promise.all([
      gateway.project(params.name),
      gateway.getAllNotes(params.name),
    ])
      .then(([detail, notes]) => {
        setMilestones(detail.milestones)
        setNoteMap(notes)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.name])

  if (loading) return (
    <>
      <AppHeader title="学习笔记" />
      <PageLoading />
    </>
  )

  if (error) return (
    <>
      <AppHeader title="学习笔记" />
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <p>{error}</p>
        <Button variant="link" onClick={() => router.back()}>返回</Button>
      </div>
    </>
  )

  const totalNotes = Object.keys(noteMap).length

  return (
    <>
      <AppHeader title="学习笔记" />
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
              <h1 className="text-xl font-bold">学习笔记</h1>
              {totalNotes > 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  共 {totalNotes} 个知识点有笔记
                </p>
              )}
            </div>
          </div>

          {/* Empty state */}
          {totalNotes === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <p className="text-sm">暂无笔记</p>
              <p className="text-xs">在学习页面打开知识点，切换到"笔记"标签页记录笔记</p>
              <Button variant="outline" size="sm" onClick={() => router.push(`/learn/${params.name}`)}>
                去学习页面
              </Button>
            </div>
          )}

          {/* Milestones — use global node index to match knode_id in noteMap */}
          {(() => {
            let globalIdx = 0
            return milestones.map((ms) => {
              const nodesWithNotes: { globalIdx: number; title: string; preview: string }[] = []
              ms.knodes.forEach((kn) => {
                const idx = globalIdx++
                const note = noteMap[String(idx)]
                if (note) {
                  const preview = stripMarkdown(note.content).slice(0, 150)
                  nodesWithNotes.push({ globalIdx: idx, title: kn.title, preview })
                }
              })
              if (nodesWithNotes.length === 0) return null
              return (
                <div key={ms.order} className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {ms.title}
                  </h2>
                  {nodesWithNotes.map(({ globalIdx: idx, title, preview }) => (
                    <button
                      key={idx}
                      onClick={() => router.push(`/learn/${params.name}?node=${idx}`)}
                      className="w-full text-left border rounded-xl p-4 bg-card hover:shadow-md hover:border-primary/30 transition-all"
                    >
                      <p className="font-medium text-sm">{title}</p>
                      {preview && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">
                          {preview}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )
            })
          })()}
        </div>
      </div>
    </>
  )
}
