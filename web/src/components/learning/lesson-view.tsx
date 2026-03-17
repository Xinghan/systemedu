"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { IconBook } from "./cartoon-icons"
import { gateway } from "@/lib/api"
import type { KnodeInfo, LessonContent, NodeProgress } from "@/lib/types/api"
import { LessonGenerating } from "./lesson-generating"
import { LessonContentView } from "./lesson-content-view"
import { GenerationPipelineView } from "./generation-pipeline-view"

interface LessonViewProps {
  projectName: string
  nodeId: number | null
  allKnodes: KnodeInfo[]
  progress: NodeProgress[]
  onNodeChange: (nodeId: number) => void
  onProgressUpdate: (updatedProgress: NodeProgress[]) => void
  onPageChange?: (tab: string, pageIndex: number, pageContent: string) => void
}

export function LessonView({
  projectName,
  nodeId,
  allKnodes,
  progress,
  onNodeChange,
  onProgressUpdate,
  onPageChange,
}: LessonViewProps) {
  const [lesson, setLesson] = useState<LessonContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  // Cache lessons that have been fetched/generated to avoid redundant requests
  const lessonCacheRef = useRef<Map<number, LessonContent>>(new Map())
  const fetchControllerRef = useRef<AbortController | null>(null)

  const knode = nodeId !== null ? allKnodes[nodeId] ?? null : null
  const nodeProgress = nodeId !== null
    ? progress.find((p) => p.knode_id === nodeId)
    : null
  const isCompleted = nodeProgress?.status === "passed"

  // Refs to avoid re-triggering effect when progress/callback changes
  const progressRef = useRef(progress)
  progressRef.current = progress
  const onProgressUpdateRef = useRef(onProgressUpdate)
  onProgressUpdateRef.current = onProgressUpdate

  // Fetch lesson when nodeId changes
  useEffect(() => {
    if (nodeId === null) {
      setLesson(null)
      return
    }

    // Check client-side cache first
    const cached = lessonCacheRef.current.get(nodeId)
    if (cached && cached.status === "ready") {
      setLesson(cached)
      setLoading(false)
      setError(null)
      return
    }

    // Abort any in-flight request for previous node
    fetchControllerRef.current?.abort()
    const controller = new AbortController()
    fetchControllerRef.current = controller

    const currentNodeId = nodeId

    async function fetchAndGenerate() {
      setLoading(true)
      setError(null)
      setLesson(null)

      // Mark node as in_progress if it's locked or available
      const currentProgress = progressRef.current.find((p) => p.knode_id === currentNodeId)
      if (currentProgress && (currentProgress.status === "locked" || currentProgress.status === "available")) {
        gateway.updateNodeProgress(projectName, currentNodeId, "in_progress")
          .then((result) => { if (!controller.signal.aborted) onProgressUpdateRef.current(result.progress) })
          .catch(() => {})
      }

      try {
        // First check if lesson exists on server
        const existing = await gateway.lesson(projectName, currentNodeId)

        if (controller.signal.aborted) return

        if (existing.status === "ready") {
          lessonCacheRef.current.set(currentNodeId, existing)
          setLesson(existing)
          setLoading(false)
          return
        }

        // Not ready, trigger generation — show pipeline view
        setIsGenerating(true)
        const generated = await gateway.generateLesson(projectName, currentNodeId)
        if (controller.signal.aborted) return
        lessonCacheRef.current.set(currentNodeId, generated)
        setLesson(generated)
        setIsGenerating(false)
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "加载失败")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchAndGenerate()
    return () => { controller.abort() }
  }, [nodeId, projectName])

  const handleMarkComplete = useCallback(async () => {
    if (nodeId === null) return
    setCompleting(true)
    try {
      const result = await gateway.updateNodeProgress(projectName, nodeId, "passed")
      onProgressUpdate(result.progress)
    } catch {
      // silently fail
    } finally {
      setCompleting(false)
    }
  }, [nodeId, projectName, onProgressUpdate])

  const handleRegenerate = useCallback(async () => {
    if (nodeId === null) return
    // Clear old content and show loading
    lessonCacheRef.current.delete(nodeId)
    setLesson(null)
    setRegenerating(true)
    setIsGenerating(true)
    setError(null)
    try {
      const generated = await gateway.generateLesson(projectName, nodeId, true)
      lessonCacheRef.current.set(nodeId, generated)
      setLesson(generated)
    } catch (e) {
      setError(e instanceof Error ? e.message : "重新生成失败")
    } finally {
      setRegenerating(false)
      setIsGenerating(false)
    }
  }, [nodeId, projectName])

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (nodeId === null) return
      const newId = direction === "prev" ? nodeId - 1 : nodeId + 1
      if (newId >= 0 && newId < allKnodes.length) {
        onNodeChange(newId)
      }
    },
    [nodeId, allKnodes.length, onNodeChange]
  )

  // Empty state
  if (nodeId === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <IconBook className="h-12 w-12 opacity-30" />
        <div className="text-center">
          <p className="text-lg font-medium">选择知识节点开始学习</p>
          <p className="text-sm">点击左侧知识树中的节点</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <p className="text-destructive">{error}</p>
        <button
          onClick={() => {
            // Clear cache for this node and re-trigger fetch
            if (nodeId !== null) {
              lessonCacheRef.current.delete(nodeId)
            }
            setError(null)
            setLesson(null)
            // Force re-fetch by toggling nodeId through parent
            if (nodeId !== null) onNodeChange(nodeId)
          }}
          className="text-sm underline"
        >
          重试
        </button>
      </div>
    )
  }

  // Loading / generating / regenerating state
  if (loading || regenerating || !lesson || lesson.status !== "ready") {
    // Show pipeline view during actual generation, fallback to old animation for initial load
    if (isGenerating && nodeId !== null) {
      return (
        <GenerationPipelineView
          projectName={projectName}
          nodeId={nodeId}
          nodeTitle={knode?.title ?? "生成中..."}
        />
      )
    }
    return (
      <LessonGenerating
        nodeTitle={knode?.title ?? "加载中..."}
        isRegenerate={regenerating}
      />
    )
  }

  // Ready state
  return (
    <LessonContentView
      knode={knode!}
      lesson={lesson}
      projectName={projectName}
      nodeId={nodeId!}
      onMarkComplete={handleMarkComplete}
      onRegenerate={handleRegenerate}
      onNavigate={handleNavigate}
      onPageChange={onPageChange}
      hasPrev={nodeId > 0}
      hasNext={nodeId < allKnodes.length - 1}
      isCompleted={isCompleted}
      completing={completing}
      regenerating={regenerating}
    />
  )
}
