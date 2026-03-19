"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { IconBook } from "./cartoon-icons"
import { Button } from "@/components/ui/button"
import { gateway } from "@/lib/api"
import type { KnodeInfo, LessonContent, NodeProgress } from "@/lib/types/api"
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

/** Compute nodes that become learnable after the given progress list is applied */
function computeNextNodes(
  currentNodeId: number,
  allKnodes: KnodeInfo[],
  progress: NodeProgress[]
): KnodeInfo[] {
  const passedIds = new Set(
    progress.filter((p) => p.status === "passed").map((p) => p.knode_id)
  )
  return allKnodes.filter((knode) => {
    if (knode.id === currentNodeId) return false
    if (passedIds.has(knode.id)) return false
    // all prerequisites must be passed
    return knode.prerequisite_indices.every((idx) => passedIds.has(idx))
  })
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

        // Not ready — trigger async generation (returns immediately)
        setIsGenerating(true)
        setLoading(false)
        await gateway.generateLesson(projectName, currentNodeId)
        // Pipeline view will handle polling and call onComplete when done
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "加载失败")
          setLoading(false)
        }
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
    // Clear old content and show pipeline view
    lessonCacheRef.current.delete(nodeId)
    setLesson(null)
    setRegenerating(true)
    setIsGenerating(true)
    setError(null)
    try {
      // Trigger async generation (returns immediately)
      await gateway.generateLesson(projectName, nodeId, true)
      // Pipeline view will handle polling and call handleGenerationComplete when done
    } catch (e) {
      setError(e instanceof Error ? e.message : "重新生成失败")
      setRegenerating(false)
      setIsGenerating(false)
    }
  }, [nodeId, projectName])

  // Called by GenerationPipelineView when generation completes
  const handleGenerationComplete = useCallback(async () => {
    if (nodeId === null) return
    try {
      const lesson = await gateway.lesson(projectName, nodeId)
      if (lesson.status === "ready") {
        lessonCacheRef.current.set(nodeId, lesson)
        setLesson(lesson)
      } else {
        setError("课程生成失败，请重试")
      }
    } catch {
      setError("加载生成的课程失败")
    } finally {
      setIsGenerating(false)
      setRegenerating(false)
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
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <p className="text-destructive text-base">{error}</p>
        <Button
          variant="outline"
          onClick={() => {
            if (nodeId !== null) {
              lessonCacheRef.current.delete(nodeId)
            }
            setError(null)
            setLesson(null)
            if (nodeId !== null) onNodeChange(nodeId)
          }}
        >
          重试
        </Button>
      </div>
    )
  }

  // Generating state — pipeline view
  if (isGenerating && nodeId !== null) {
    return (
      <GenerationPipelineView
        projectName={projectName}
        nodeId={nodeId}
        nodeTitle={knode?.title ?? "生成中..."}
        onComplete={handleGenerationComplete}
      />
    )
  }

  // Initial loading spinner (before we know if generation is needed)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin" />
      </div>
    )
  }

  // Lesson not ready but not generating — shouldn't happen normally, show nothing
  if (!lesson || lesson.status !== "ready") {
    return null
  }

  // Ready state
  const nextNodes = isCompleted && nodeId !== null
    ? computeNextNodes(nodeId, allKnodes, progress)
    : []

  return (
    <LessonContentView
      knode={knode!}
      lesson={lesson}
      projectName={projectName}
      nodeId={nodeId!}
      onMarkComplete={handleMarkComplete}
      onRegenerate={handleRegenerate}
      onNavigate={handleNavigate}
      onNavigateToNode={onNodeChange}
      onPageChange={onPageChange}
      hasPrev={nodeId > 0}
      hasNext={nodeId < allKnodes.length - 1}
      isCompleted={isCompleted}
      completing={completing}
      regenerating={regenerating}
      nextNodes={nextNodes}
    />
  )
}
