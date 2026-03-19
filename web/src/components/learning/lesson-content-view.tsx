"use client"

import { useCallback, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, NotebookPen, X, Minus, Eye, Pencil, ArrowRight, BookOpen, Clock, Zap, Star } from "lucide-react"
import { IconCheck } from "./cartoon-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AnimatedExamplesView } from "./animated-examples"
import { InteractiveLabView } from "./interactive-lab-view"
import { PagedContentView } from "./paged-content-view"
import { PracticeView } from "./practice-view"
import { ResourceSearchView } from "./resource-search-view"
import { NotePanel, type NotePreviewMode } from "./note-panel"
import { AudioPlayerBar } from "./audio-player-bar"
import type { KnodeInfo, LessonContent } from "@/lib/types/api"

const MIN_NOTE_WIDTH = 280
const MAX_NOTE_WIDTH = 640
const DEFAULT_NOTE_WIDTH = 360

interface LessonContentViewProps {
  knode: KnodeInfo
  lesson: LessonContent
  projectName: string
  nodeId: number
  onMarkComplete: () => void
  onRegenerate: () => void
  onNavigate: (direction: "prev" | "next") => void
  onNavigateToNode: (nodeId: number) => void
  onPageChange?: (tab: string, pageIndex: number, pageContent: string) => void
  hasPrev: boolean
  hasNext: boolean
  isCompleted: boolean
  completing: boolean
  regenerating: boolean
  nextNodes: KnodeInfo[]
}

const TAB_CONFIG = [
  { key: "concept", label: "概念", field: "concept" as const, audioField: "concept_audio_url" as const },
  { key: "examples", label: "示例", field: "examples" as const, audioField: null },
  { key: "interactive_lab", label: "实验", field: "interactive_lab" as const, audioField: "lab_audio_url" as const },
  { key: "code_samples", label: "代码", field: "code_samples" as const, audioField: null },
  { key: "practice", label: "练习", field: "practice" as const, audioField: "practice_audio_url" as const },
  { key: "key_takeaways", label: "总结", field: "key_takeaways" as const, audioField: "key_takeaways_audio_url" as const },
]

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
  isCompleted,
  completing,
  regenerating,
  nextNodes,
}: LessonContentViewProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [noteState, setNoteState] = useState<"closed" | "open" | "minimized">("closed")
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [notePreviewMode, setNotePreviewMode] = useState<NotePreviewMode>("edit")
  const [noteWidth, setNoteWidth] = useState(DEFAULT_NOTE_WIDTH)
  const dragStartX = useRef<number | null>(null)
  const dragStartWidth = useRef<number>(DEFAULT_NOTE_WIDTH)

  const availableTabs = TAB_CONFIG.filter((tab) => {
    const content = lesson[tab.field]
    return content && content.trim().length > 0
  })

  const RESOURCE_TAB = { key: "resources", label: "资料" }
  const allTabs = [...availableTabs, RESOURCE_TAB]

  const difficultyLabel = knode.difficulty_level <= 3 ? "入门" : knode.difficulty_level <= 6 ? "中级" : "高级"
  const activeKey = allTabs[activeTab]?.key ?? allTabs[0]?.key

  // Wide-layout tabs: full-width content (no sidebar)
  const isWideTab = ["interactive_lab", "examples", "practice", "resources"].includes(activeKey)

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

  // Audio bar
  const currentTab = availableTabs[activeTab] ?? availableTabs[0]
  const tabAudioUrl = currentTab?.audioField ? lesson[currentTab.audioField] : null
  const audioUrl = tabAudioUrl || lesson.teacher_audio_url

  return (
    <div className="flex flex-col h-full relative">

      {/* ── Top bar: title + actions ── */}
      <div className="flex items-center justify-between gap-4 px-5 py-2.5 border-b shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-snug truncate">{knode.title}</h2>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {difficultyLabel} {knode.difficulty_level}/10
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {knode.estimated_minutes} 分钟
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {knode.xp_reward} XP
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
            className="gap-1 text-xs text-muted-foreground"
          >
            <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
            重新生成
          </Button>
          {isCompleted ? (
            <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 gap-1">
              <IconCheck className="h-3 w-3" />
              已完成
            </Badge>
          ) : (
            <Button size="sm" onClick={onMarkComplete} disabled={completing} className="gap-1">
              <IconCheck className="h-3.5 w-3.5" />
              标记完成
            </Button>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0.5 px-5 border-b shrink-0">
        {allTabs.map((tab, index) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(index)}
            className={`px-3 py-2 text-sm font-medium transition-colors relative ${
              activeTab === index
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {activeTab === index && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
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
                  // Wide: full-width content
                  activeKey === "resources" ? (
                    <ResourceSearchView projectName={projectName} nodeId={nodeId} />
                  ) : activeKey === "examples" ? (
                    <AnimatedExamplesView content={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]} />
                  ) : activeKey === "interactive_lab" ? (
                    <InteractiveLabView html={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]} />
                  ) : (
                    <PracticeView
                      content={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]}
                      projectName={projectName}
                      nodeId={nodeId}
                    />
                  )
                ) : (
                  // Two-column: prose left, sidebar right
                  <>
                    {/* Prose content */}
                    <div className="flex-1 min-w-0 px-5 py-5">
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

                    {/* Right sidebar — node info + next steps */}
                    <div className="w-64 shrink-0 border-l px-4 py-5 flex flex-col gap-5 bg-muted/20">
                      {/* Node summary card */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">本节概览</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{knode.summary}</p>
                      </div>

                      {/* Completion action */}
                      {!isCompleted && (
                        <div>
                          <Button
                            size="sm"
                            className="w-full gap-1"
                            onClick={onMarkComplete}
                            disabled={completing}
                          >
                            <IconCheck className="h-3.5 w-3.5" />
                            标记完成
                          </Button>
                        </div>
                      )}

                      {/* Next learnable nodes */}
                      {isCompleted && nextNodes.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">下一步</p>
                          <div className="flex flex-col gap-1.5">
                            {nextNodes.map((node) => (
                              <button
                                key={node.id}
                                onClick={() => onNavigateToNode(node.id)}
                                className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent hover:border-primary/40 transition-colors text-left w-full"
                              >
                                <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate flex-1">{node.title}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
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

      {/* Audio player bar */}
      {audioUrl && (
        <AudioPlayerBar
          key={audioUrl}
          audioUrl={audioUrl}
          script={lesson.teacher_script}
          timestamps={lesson.teacher_timestamps}
        />
      )}

      {/* ── Bottom nav: prev/next lesson ── */}
      <div className="flex items-center justify-between px-5 py-2 border-t shrink-0">
        <Button variant="ghost" size="sm" onClick={() => onNavigate("prev")} disabled={!hasPrev} className="gap-1 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />
          上一节
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onNavigate("next")} disabled={!hasNext} className="gap-1 text-muted-foreground">
          下一节
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Note FAB */}
      {noteState === "closed" && (
        <button
          onClick={() => setNoteState("open")}
          className="fixed bottom-[88px] right-6 z-50 h-14 w-14 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-500/90 transition-colors flex items-center justify-center"
          title="笔记"
        >
          <NotebookPen className="h-6 w-6" />
        </button>
      )}

      {/* Minimized note pill */}
      {noteState === "minimized" && (
        <div className="fixed bottom-[88px] right-6 z-50 flex items-center gap-2">
          <button
            onClick={() => setNoteState("open")}
            className="flex items-center gap-2 rounded-full bg-secondary text-secondary-foreground px-4 py-2 shadow-lg hover:bg-secondary/80 text-sm font-medium transition-colors"
          >
            <NotebookPen className="h-4 w-4" />
            笔记
          </button>
          <button
            onClick={() => setNoteState("closed")}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
