"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Pencil, Eye } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { PageLoading } from "@/components/ui/page-loading"
import { Button } from "@/components/ui/button"
import { NotePanel, type NotePreviewMode } from "@/components/learning/note-panel"
import { gateway } from "@/lib/api"
import type { MilestoneInfo, NoteInfo, ProjectNotesResponse } from "@/lib/types/api"

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

interface NoteEntry {
  globalIdx: number
  title: string
  milestoneTitle: string
  note: NoteInfo
}

export default function ProjectNotesPage() {
  const params = useParams<{ name: string }>()
  const router = useRouter()
  const [milestones, setMilestones] = useState<MilestoneInfo[]>([])
  const [noteMap, setNoteMap] = useState<ProjectNotesResponse>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [previewMode, setPreviewMode] = useState<NotePreviewMode>("preview")

  useEffect(() => {
    if (!params.name) return
    Promise.all([
      gateway.project(params.name),
      gateway.getAllNotes(params.name),
    ])
      .then(([detail, notes]) => {
        setMilestones(detail.milestones)
        setNoteMap(notes)
        // Auto-select first note
        const firstKey = Object.keys(notes)[0]
        if (firstKey != null) setSelectedIdx(Number(firstKey))
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

  // Build ordered list of notes
  const noteEntries: NoteEntry[] = []
  let globalIdx = 0
  milestones.forEach((ms) => {
    ms.knodes.forEach((kn) => {
      const idx = globalIdx++
      const note = noteMap[String(idx)]
      if (note) {
        noteEntries.push({ globalIdx: idx, title: kn.title, milestoneTitle: ms.title, note })
      }
    })
  })

  const totalNotes = noteEntries.length
  const selectedEntry = noteEntries.find((e) => e.globalIdx === selectedIdx) ?? null

  return (
    <>
      <AppHeader title="学习笔记" />
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — note list */}
        <div className="w-72 shrink-0 border-r flex flex-col min-h-0">
          {/* Sidebar header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
            <Link href={`/projects/${params.name}`}>
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">学习笔记</p>
              <p className="text-xs text-muted-foreground">{totalNotes} 个知识点</p>
            </div>
          </div>

          {/* Note list */}
          <div className="flex-1 overflow-y-auto">
            {totalNotes === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground gap-2">
                <p className="text-sm">暂无笔记</p>
                <p className="text-xs">在学习页面切换到笔记面板记录笔记</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => router.push(`/learn/${params.name}`)}>
                  去学习
                </Button>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {noteEntries.map((entry) => {
                  const preview = stripMarkdown(entry.note.content).slice(0, 80)
                  const isSelected = entry.globalIdx === selectedIdx
                  return (
                    <button
                      key={entry.globalIdx}
                      onClick={() => {
                        setSelectedIdx(entry.globalIdx)
                        setNoteStatus("idle")
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-xs font-medium text-muted-foreground truncate mb-0.5">
                        {entry.milestoneTitle}
                      </p>
                      <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : ""}`}>
                        {entry.title}
                      </p>
                      {preview && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {preview}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — note detail */}
        {selectedEntry ? (
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Detail header */}
            <div className="border-b bg-muted/30 shrink-0">
              <div className="flex items-center justify-between px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground truncate">{selectedEntry.milestoneTitle}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{selectedEntry.title}</p>
                    {noteStatus === "saving" && (
                      <span className="text-xs text-muted-foreground shrink-0">保存中...</span>
                    )}
                    {noteStatus === "saved" && (
                      <span className="text-xs text-green-600 dark:text-green-400 shrink-0">已保存</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 ml-3">
                  <button
                    onClick={() => setPreviewMode("edit")}
                    className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${
                      previewMode === "edit"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    title="编辑"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewMode("preview")}
                    className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${
                      previewMode === "preview"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    title="预览"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Note editor/preview */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <NotePanel
                key={selectedEntry.globalIdx}
                projectName={params.name}
                nodeId={selectedEntry.globalIdx}
                previewMode={previewMode}
                onStatusChange={setNoteStatus}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            选择左侧笔记查看详情
          </div>
        )}
      </div>
    </>
  )
}
