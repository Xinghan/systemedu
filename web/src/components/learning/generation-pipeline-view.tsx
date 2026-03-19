"use client"

import { useEffect, useRef, useState } from "react"
import type { LessonGenerationStep } from "@/lib/types/api"
import { gateway } from "@/lib/api"

interface GenerationPipelineViewProps {
  projectName: string
  nodeId: number
  nodeTitle: string
  /** Called when generation is complete (lesson ready or failed) */
  onComplete?: () => void
}

/** Animated status icon for each step */
function StepStatusIcon({ status }: { status: LessonGenerationStep["status"] }) {
  switch (status) {
    case "completed":
      return (
        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0 animate-in zoom-in duration-300">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )
    case "in_progress":
      return (
        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]">
          <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
        </div>
      )
    case "failed":
      return (
        <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      )
    default: // pending
      return (
        <div className="w-6 h-6 rounded-full bg-muted border-2 border-muted-foreground/20 shrink-0" />
      )
  }
}

/** Connector line between steps */
function StepConnector({ status }: { status: "done" | "active" | "pending" }) {
  return (
    <div className="w-6 flex justify-center shrink-0">
      <div
        className={`w-0.5 h-5 transition-all duration-500 ${
          status === "done"
            ? "bg-emerald-400"
            : status === "active"
              ? "bg-blue-400 animate-pulse"
              : "bg-muted-foreground/15"
        }`}
      />
    </div>
  )
}

/** Whether a step is a lab sub-step */
function isLabStep(stepName: string) {
  return stepName.startsWith("lab_")
}

/** Animated dots for waiting state */
function WaitingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1s" }}>.</span>
      <span className="animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1s" }}>.</span>
      <span className="animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1s" }}>.</span>
    </span>
  )
}

/** Rotating agent status messages when steps aren't loaded yet */
const WAITING_MESSAGES = [
  "AI 助手们正在集合...",
  "策划师正在制定教学方案...",
  "分析课程结构...",
  "准备生成内容...",
]

export function GenerationPipelineView({
  projectName,
  nodeId,
  nodeTitle,
  onComplete,
}: GenerationPipelineViewProps) {
  const [steps, setSteps] = useState<LessonGenerationStep[]>([])
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [waitingMsgIdx, setWaitingMsgIdx] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Rotate waiting message
  useEffect(() => {
    const timer = setInterval(() => {
      setWaitingMsgIdx((i) => (i + 1) % WAITING_MESSAGES.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  // Poll progress every 2s
  useEffect(() => {
    completedRef.current = false

    const fetchProgress = async () => {
      try {
        const data = await gateway.lessonProgress(projectName, nodeId)
        setSteps(data.steps)

        // Check if lesson is done (ready or failed)
        if ((data.lesson_status === "ready" || data.lesson_status === "failed") && !completedRef.current) {
          completedRef.current = true
          if (pollRef.current) clearInterval(pollRef.current)
          onCompleteRef.current?.()
        }
      } catch {
        // Silently ignore poll errors
      }
    }

    fetchProgress()
    pollRef.current = setInterval(fetchProgress, 2000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [projectName, nodeId])

  // Smooth progress: count completed + half credit for in_progress
  const completedCount = steps.filter((s) => s.status === "completed").length
  const inProgressCount = steps.filter((s) => s.status === "in_progress").length
  const totalCount = steps.length
  const progressPercent = totalCount > 0
    ? Math.round(((completedCount + inProgressCount * 0.5) / totalCount) * 100)
    : 0

  // Find currently active step
  const activeStep = steps.find((s) => s.status === "in_progress")

  // Status message
  const statusMessage = activeStep
    ? `${activeStep.agent_name} 工作中...`
    : steps.length === 0
      ? WAITING_MESSAGES[waitingMsgIdx]
      : "准备中..."

  return (
    <div className="flex flex-col items-center overflow-y-auto h-full px-6 py-8">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Header with pulse animation */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-blue-500 animate-pulse">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
            </div>
          </div>
          <h2 className="text-xl font-bold tracking-wide">
            课程生成中<WaitingDots />
          </h2>
          <p className="text-sm text-muted-foreground truncate max-w-xs mx-auto">
            {nodeTitle}
          </p>
        </div>

        {/* Overall progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[200px]">{statusMessage}</span>
            <span className="tabular-nums">{progressPercent}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            {steps.length > 0 ? (
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(progressPercent, 2)}%` }}
              />
            ) : (
              /* Indeterminate shimmer when no steps loaded yet */
              <div className="h-full w-full relative overflow-hidden">
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"
                  style={{
                    animation: "shimmer 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Step list */}
        {steps.length > 0 ? (
          <div className="bg-card rounded-xl border p-4 shadow-sm">
            {steps.map((step, i) => {
              const isLab = isLabStep(step.step_name)
              const prevStep = i > 0 ? steps[i - 1] : null
              const showLabHeader = isLab && (i === 0 || !isLabStep(prevStep?.step_name ?? ""))

              // Connector status
              let connectorStatus: "done" | "active" | "pending" = "pending"
              if (step.status === "completed" || step.status === "failed") {
                connectorStatus = "done"
              } else if (step.status === "in_progress") {
                connectorStatus = "active"
              }

              return (
                <div key={step.step_name}>
                  {/* Lab pipeline sub-header */}
                  {showLabHeader && (
                    <div className="flex items-center gap-2 mb-1 mt-2">
                      <div className="w-6" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        实验管道
                      </span>
                      <div className="flex-1 h-px bg-muted-foreground/10" />
                    </div>
                  )}

                  {/* Connector */}
                  {i > 0 && (
                    <StepConnector status={connectorStatus} />
                  )}

                  {/* Step row */}
                  <button
                    onClick={() => setExpandedStep(expandedStep === step.step_name ? null : step.step_name)}
                    className={`flex items-center gap-3 w-full py-1.5 text-left rounded-lg transition-colors hover:bg-muted/50 ${
                      isLab ? "pl-4" : ""
                    } ${step.status === "in_progress" ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                  >
                    <StepStatusIcon status={step.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium transition-colors duration-300 ${
                          step.status === "in_progress"
                            ? "text-blue-600 dark:text-blue-400"
                            : step.status === "completed"
                              ? "text-foreground"
                              : step.status === "failed"
                                ? "text-red-500"
                                : "text-muted-foreground"
                        }`}>
                          {step.step_label}
                        </span>
                        <span className="text-xs text-muted-foreground/60">
                          {step.agent_name}
                        </span>
                      </div>
                    </div>
                    {/* Duration or status indicator */}
                    {step.started_at && step.completed_at && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {Math.round(
                          (new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000
                        )}s
                      </span>
                    )}
                    {step.status === "in_progress" && (
                      <span className="text-xs text-blue-500 tabular-nums animate-pulse">
                        ...
                      </span>
                    )}
                  </button>

                  {/* Expanded preview */}
                  {expandedStep === step.step_name && step.output_preview && (
                    <div className={`${isLab ? "ml-10 pl-4" : "ml-9"} mt-1 mb-2`}>
                      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                        {step.output_preview}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* Skeleton while waiting for steps to load */
          <div className="bg-card rounded-xl border p-4 shadow-sm space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 bg-muted rounded animate-pulse" style={{ width: `${50 + i * 8}%`, animationDelay: `${i * 150}ms` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tip */}
        <div className="text-center">
          <span className="text-xs text-muted-foreground">
            多个 AI 助手正在协作生成课程内容，请稍候...
          </span>
        </div>
      </div>

      {/* CSS for shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}
