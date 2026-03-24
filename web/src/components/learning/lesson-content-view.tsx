"use client"

import { useCallback, useRef, useState } from "react"
import { RefreshCw, Eye, Pencil, Minus, X, ArrowLeft, ArrowRight, Zap, Clock, Star } from "lucide-react"
import { IconCheck } from "./cartoon-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AnimatedExamplesView } from "./animated-examples"
import { InteractiveLabView } from "./interactive-lab-view"
import { PagedContentView } from "./paged-content-view"
import { PracticeView } from "./practice-view"
import { AssignmentView } from "./assignment-view"
import { ResourceSearchView } from "./resource-search-view"
import { NotePanel, type NotePreviewMode } from "./note-panel"
import { AudioPlayerBar } from "./audio-player-bar"
import type { KnodeInfo, LessonContent } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

const MIN_NOTE_WIDTH = 280
const MAX_NOTE_WIDTH = 640
const DEFAULT_NOTE_WIDTH = 360

interface LessonContentViewProps {
  knode: KnodeInfo
  lesson: LessonContent
  projectName: string
  nodeId: number
  onMarkComplete?: () => void
  onRegenerate: () => void
  onNavigate: (direction: "prev" | "next") => void
  onNavigateToNode: (nodeId: number) => void
  onPageChange?: (tab: string, pageIndex: number, pageContent: string) => void
  hasPrev: boolean
  hasNext: boolean
  prevNodeTitle: string | null
  nextNodeTitle: string | null
  totalNodes: number
  isCompleted: boolean
  completing?: boolean
  regenerating: boolean
  nextNodes: KnodeInfo[]
  noteState: "closed" | "open" | "minimized"
  onNoteStateChange: (state: "closed" | "open" | "minimized") => void
}

export function LessonContentView({
  knode,
  lesson,
  projectName,
  nodeId,
  onMarkComplete,
  onRegenerate,
  onNavigate,
  onNavigateToNode,
  onPageChange,
  hasPrev,
  hasNext,
  prevNodeTitle,
  nextNodeTitle,
  totalNodes,
  isCompleted,
  completing,
  regenerating,
  nextNodes,
  noteState,
  onNoteStateChange: setNoteState,
}: LessonContentViewProps) {
  const t = useT()
  const [activeTab, setActiveTab] = useState(0)
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [notePreviewMode, setNotePreviewMode] = useState<NotePreviewMode>("edit")
  const [noteWidth, setNoteWidth] = useState(DEFAULT_NOTE_WIDTH)
  const dragStartX = useRef<number | null>(null)
  const dragStartWidth = useRef<number>(DEFAULT_NOTE_WIDTH)

  const TAB_CONFIG = [
    { key: "concept", label: t("lesson.concept"), field: "concept" as const, audioField: "concept_audio_url" as const },
    { key: "examples", label: t("lesson.examples"), field: "examples" as const, audioField: null },
    { key: "interactive_lab", label: t("lesson.lab"), field: "interactive_lab" as const, audioField: "lab_audio_url" as const },
    { key: "code_samples", label: t("lesson.code"), field: "code_samples" as const, audioField: null },
    { key: "practice", label: t("lesson.practice"), field: "practice" as const, audioField: "practice_audio_url" as const },
    { key: "key_takeaways", label: t("lesson.summary"), field: "key_takeaways" as const, audioField: "key_takeaways_audio_url" as const },
    { key: "project_assignment", label: t("lesson.assignment"), field: "project_assignment" as const, audioField: null },
  ]

  const availableTabs = TAB_CONFIG.filter((tab) => {
    const content = lesson[tab.field]
    return content && content.trim().length > 0
  })

  const RESOURCE_TAB = { key: "resources", label: t("lesson.resources") }
  const allTabs = [...availableTabs, RESOURCE_TAB]

  const difficultyLabel = knode.difficulty_level <= 3 ? "入门" : knode.difficulty_level <= 6 ? "中级" : "高级"
  const activeKey = allTabs[activeTab]?.key ?? allTabs[0]?.key
  const isWideTab = ["interactive_lab", "examples", "practice", "resources", "project_assignment"].includes(activeKey)

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartWidth.current = noteWidth

    const onMouseMove = (ev: MouseEvent) => {
      if (dragStartX.current === null) return
      const delta = dragStartX.current - ev.clientX
      const newWidth = Math.min(MAX_NOTE_WIDTH, Math.max(MIN_NOTE_WIDTH, dragStartWidth.current + delta))
      setNoteWidth(newWidth)
    }
    const onMouseUp = () => {
      dragStartX.current = null
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }, [noteWidth])

  // Audio
  const currentTab = availableTabs[activeTab] ?? availableTabs[0]
  const tabAudioUrl = currentTab?.audioField ? lesson[currentTab.audioField] : null
  const audioUrl = tabAudioUrl || lesson.teacher_audio_url

  return (
    <div className="flex flex-col h-full relative">

      {/* ── Top bar: meta + regenerate ── */}
      <div className="flex items-center justify-between gap-4 px-16 py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-[var(--font-manrope)]">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-500" />
            {difficultyLabel} {knode.difficulty_level}/10
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {knode.estimated_minutes} min
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-primary" />
            {knode.xp_reward} XP
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
            className="gap-1 text-xs text-muted-foreground h-7"
          >
            <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
            {t("lesson.regenerate")}
          </Button>
          {isCompleted && (
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1 h-7">
              <IconCheck className="h-3 w-3" />
              {t("lesson.mastered")}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0.5 px-16 border-b border-border/40 shrink-0">
        {allTabs.map((tab, index) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(index)}
            className={`px-3 py-2.5 text-xs font-medium transition-colors relative font-[var(--font-manrope)] ${
              activeTab === index
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {activeTab === index && (
              <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Main content area ── */}
      <div className="flex flex-1 min-h-0">

        {/* Content column */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto">
            {availableTabs.length > 0 ? (
              <div className={isWideTab ? "p-5 h-full" : "flex min-h-full"}>
                {isWideTab ? (
                  activeKey === "resources" ? (
                    <ResourceSearchView projectName={projectName} nodeId={nodeId} />
                  ) : activeKey === "examples" ? (
                    <AnimatedExamplesView content={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]} />
                  ) : activeKey === "interactive_lab" ? (
                    <InteractiveLabView html={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]} />
                  ) : activeKey === "project_assignment" ? (
                    <AssignmentView content={lesson.project_assignment} />
                  ) : (
                    <PracticeView
                      content={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]}
                      projectName={projectName}
                      nodeId={nodeId}
                    />
                  )
                ) : (
                  <div className="flex-1 min-w-0 px-16 py-8">
                    <PagedContentView
                      content={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]}
                      projectName={projectName}
                      nodeId={nodeId}
                      tab={availableTabs[activeTab]?.key ?? availableTabs[0]?.key}
                      onPageChange={(pageIndex, pageContent) => {
                        const tabKey = availableTabs[activeTab]?.key ?? availableTabs[0]?.key
                        onPageChange?.(tabKey, pageIndex, pageContent)
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                暂无内容
              </div>
            )}
          </div>
        </div>

        {/* Note panel (side drawer) */}
        {noteState === "open" && (
          <div
            className="shrink-0 border-l flex flex-col min-h-0 bg-background relative"
            style={{ width: noteWidth }}
          >
            <div
              onMouseDown={handleDragMouseDown}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
            />
            <div className="border-b bg-muted/30 shrink-0">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-sm font-medium">笔记</span>
                  {noteStatus === "saving" && <span className="text-xs text-muted-foreground">保存中...</span>}
                  {noteStatus === "saved" && <span className="text-xs text-green-600 dark:text-green-400">已保存</span>}
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setNotePreviewMode("edit")}
                    className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${notePreviewMode === "edit" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    title="编辑"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setNotePreviewMode("preview")}
                    className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${notePreviewMode === "preview" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    title="预览"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button
                    onClick={() => setNoteState("minimized")}
                    className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                    title="最小化"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setNoteState("closed")}
                    className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                    title="关闭"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <NotePanel
                projectName={projectName}
                nodeId={nodeId}
                previewMode={notePreviewMode}
                onStatusChange={setNoteStatus}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Audio player ── */}
      {audioUrl && (
        <AudioPlayerBar
          key={audioUrl}
          audioUrl={audioUrl}
          script={lesson.teacher_script}
          timestamps={lesson.teacher_timestamps}
        />
      )}

      {/* ── Bottom nav: prev / step indicator / next ── */}
      <div className="shrink-0 px-16 pb-5 pt-1">
        <div className="flex items-center justify-between gap-4">

          {/* Previous */}
          <button
            onClick={() => onNavigate("prev")}
            disabled={!hasPrev}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-300 group min-w-0 ${
              hasPrev
                ? "bg-white dark:bg-card border-border/30 hover:border-border hover:shadow-sm cursor-pointer"
                : "opacity-0 pointer-events-none"
            }`}
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:-translate-x-0.5 transition-transform shrink-0" />
            <div className="text-left min-w-0">
              <span className="block text-[10px] uppercase font-[var(--font-manrope)] tracking-widest text-muted-foreground">
                {t("lesson.prev_lesson") || "Previous Lesson"}
              </span>
              <span className="block text-xs font-bold text-foreground truncate max-w-[140px]">
                {prevNodeTitle ?? ""}
              </span>
            </div>
          </button>

          {/* Step indicator */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex gap-1">
              {/* show up to 5 dots around active */}
              {(() => {
                const dots = Math.min(totalNodes, 5)
                return Array.from({ length: dots }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all ${
                      i === 0
                        ? "h-1.5 w-5 bg-primary"
                        : "h-1.5 w-1.5 bg-border"
                    }`}
                  />
                ))
              })()}
            </div>
            <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-tight text-muted-foreground">
              {t("learn.step_of", { n: nodeId + 1, total: totalNodes }) || `Step ${nodeId + 1} of ${totalNodes}`}
            </span>
          </div>

          {/* Next */}
          <button
            onClick={() => onNavigate("next")}
            disabled={!hasNext}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-300 group min-w-0 ${
              hasNext
                ? "bg-gradient-to-r from-primary to-violet-500 text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] cursor-pointer"
                : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="text-right min-w-0">
              <span className="block text-[10px] uppercase font-[var(--font-manrope)] tracking-widest opacity-80">
                {t("lesson.next_lesson") || "Next Lesson"}
              </span>
              <span className="block text-xs font-bold truncate max-w-[140px]">
                {nextNodeTitle ?? ""}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>

        </div>
      </div>

    </div>
  )
}
