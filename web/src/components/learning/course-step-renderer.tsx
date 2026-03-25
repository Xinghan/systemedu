"use client"

import { Loader2 } from "lucide-react"
import type { CourseStep } from "@/lib/types/api"
import { PagedContentView } from "./paged-content-view"
import { IframeStepView } from "./iframe-step-view"

interface CourseStepRendererProps {
  step: CourseStep | null
  loading?: boolean
  projectName?: string
  nodeId?: number | null
  onStepComplete?: () => void
}

function PracticeStepView({
  practiceData,
  onComplete,
}: {
  practiceData: string
  onComplete?: () => void
}) {
  // Parse practice JSON and render inline (simplified version for course steps)
  let data: { exercises?: Array<{
    type: string
    question: string
    options?: string[]
    correct?: number
    answer?: string
    explanation?: string
    difficulty?: string
    points?: number
  }>; pass_score?: number; total_points?: number } | null = null
  try {
    const text = practiceData.trim().replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "")
    data = JSON.parse(text)
  } catch {
    // fallback to markdown
  }

  if (!data || !data.exercises || data.exercises.length === 0) {
    return (
      <PagedContentView content={practiceData || "暂无练习内容"} />
    )
  }

  return (
    <div className="space-y-4 p-1">
      {data.exercises.map((ex, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xs font-[var(--font-manrope)] font-bold text-muted-foreground shrink-0 mt-0.5">
              Q{i + 1}
            </span>
            <p className="text-sm text-foreground">{ex.question}</p>
          </div>
          {ex.type === "choice" && ex.options && (
            <div className="space-y-1.5 pl-5">
              {ex.options.map((opt, j) => (
                <div key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-5 h-5 rounded-full border border-border flex items-center justify-center text-[10px] font-bold shrink-0">
                    {String.fromCharCode(65 + j)}
                  </span>
                  {opt}
                </div>
              ))}
            </div>
          )}
          {ex.explanation && (
            <p className="text-xs text-muted-foreground pl-5 italic">{ex.explanation}</p>
          )}
        </div>
      ))}
      {onComplete && (
        <button
          onClick={onComplete}
          className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          完成练习
        </button>
      )}
    </div>
  )
}

export function CourseStepRenderer({
  step,
  loading,
  projectName,
  nodeId,
  onStepComplete,
}: CourseStepRendererProps) {
  if (loading || !step) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">正在生成内容...</p>
      </div>
    )
  }

  if (step.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
        <p className="text-sm">内容生成失败，请重试</p>
      </div>
    )
  }

  const { type } = step

  // game/animation with HTML: iframe
  if ((type === "game" || type === "animation") && step.html) {
    return <IframeStepView html={step.html} onComplete={onStepComplete} />
  }

  // practice: dedicated view
  if (type === "practice") {
    return (
      <PracticeStepView
        practiceData={step.practice_data}
        onComplete={onStepComplete}
      />
    )
  }

  // concept/story/animation(fallback)/code/summary: paged markdown
  if (step.content) {
    return (
      <PagedContentView
        content={step.content}
        projectName={projectName}
        nodeId={nodeId}
        tab={`course_step_${step.step_index}`}
      />
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <p className="text-sm">暂无内容</p>
    </div>
  )
}
