"use client"

import { useCallback, useEffect, useState } from "react"
import { X, ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from "lucide-react"
import { gateway } from "@/lib/api"
import type { CourseData, CourseStep, KnodeInfo } from "@/lib/types/api"
import { CourseStepRenderer } from "./course-step-renderer"

interface CourseViewProps {
  projectName: string
  nodeId: number
  knode: KnodeInfo | null
  onClose: () => void
  onMarkComplete?: () => void
}

const POLL_INTERVAL_MS = 4000

export function CourseView({
  projectName,
  nodeId,
  knode,
  onClose,
  onMarkComplete,
}: CourseViewProps) {
  const [courseData, setCourseData] = useState<CourseData | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)

  const totalSteps = courseData?.manifest?.total_steps ?? 0
  const steps = courseData?.steps ?? []
  const isGenerating = courseData?.status === "generating" || (!courseData && !error)

  // Fetch course data (for polling)
  const fetchCourse = useCallback(async () => {
    try {
      const data = await gateway.getCourse(projectName, nodeId)
      setCourseData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败")
    }
  }, [projectName, nodeId])

  // Initial trigger: generate or load
  useEffect(() => {
    setCurrentStep(0)
    setIsCompleted(false)
    setError(null)
    setCourseData(null)

    gateway.generateCourse(projectName, nodeId).then((data) => {
      setCourseData(data)
    }).catch((e) => {
      setError(e instanceof Error ? e.message : "生成失败")
    })
  }, [projectName, nodeId])

  // Poll while generating
  useEffect(() => {
    if (!courseData) return
    const allReady = steps.length === totalSteps && totalSteps > 0 &&
      steps.every((s) => s.status !== "pending")
    const isFailed = courseData.status === "failed"

    if (allReady || isFailed) return

    const timer = setInterval(fetchCourse, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [courseData, steps, totalSteps, fetchCourse])

  const activeStep: CourseStep | null = steps[currentStep] ?? null
  const isStepReady = activeStep?.status === "ready"
  const isLastStep = currentStep === totalSteps - 1
  const canGoNext = isStepReady && !isLastStep
  const canGoPrev = currentStep > 0

  const handleNext = () => {
    if (isLastStep) {
      setIsCompleted(true)
    } else {
      setCurrentStep((s) => Math.min(s + 1, totalSteps - 1))
    }
  }

  const handlePrev = () => {
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  const handleFinish = () => {
    onMarkComplete?.()
    onClose()
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">{knode?.title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setCourseData(null)
              gateway.generateCourse(projectName, nodeId, true).then(setCourseData).catch((e) => setError(e.message))
            }}
            className="text-xs text-primary hover:underline"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">{knode?.title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-xl font-extrabold text-foreground">恭喜完成！</h3>
            <p className="text-sm text-muted-foreground">
              {courseData?.manifest?.learning_goal || `你已完成《${knode?.title}》的全部学习步骤`}
            </p>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              返回
            </button>
            <button
              onClick={handleFinish}
              className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
            >
              标记完成
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">
            {knode?.title}
          </p>
          {activeStep && (
            <h2 className="text-sm font-semibold text-foreground truncate">{activeStep.title}</h2>
          )}
          {isGenerating && !activeStep && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>课程规划中...</span>
            </div>
          )}
        </div>
        <button onClick={onClose} className="ml-3 p-1 rounded-lg hover:bg-secondary transition-colors shrink-0">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Progress bar */}
      {totalSteps > 0 && (
        <div className="px-6 py-2.5 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-[var(--font-manrope)] font-semibold text-muted-foreground shrink-0">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>
          {/* Step dots */}
          <div className="flex gap-1.5 mt-2">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const s = steps[i]
              const isDone = i < currentStep
              const isCurrent = i === currentStep
              const isLoading = !s || s.status === "pending"
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (steps[i] && steps[i].status === "ready") {
                      setCurrentStep(i)
                    }
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isCurrent
                      ? "bg-primary flex-1"
                      : isDone
                      ? "w-4 bg-primary/40"
                      : isLoading
                      ? "w-4 bg-secondary animate-pulse"
                      : "w-4 bg-secondary hover:bg-primary/30"
                  }`}
                  disabled={!s || s.status !== "ready"}
                  title={s?.title || `步骤 ${i + 1}`}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Step content area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        <CourseStepRenderer
          step={activeStep}
          loading={!activeStep || activeStep.status === "pending"}
          projectName={projectName}
          nodeId={nodeId}
          onStepComplete={isLastStep ? () => setIsCompleted(true) : handleNext}
        />
      </div>

      {/* Footer navigation */}
      <div className="px-6 py-4 border-t border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrev}
            disabled={!canGoPrev}
            className="flex items-center gap-1.5 px-4 h-10 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            上一步
          </button>
          <div className="flex-1" />
          {isLastStep ? (
            <button
              onClick={() => setIsCompleted(true)}
              disabled={!isStepReady}
              className="flex items-center gap-1.5 px-6 h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              完成课程
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className="flex items-center gap-1.5 px-6 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一步
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
