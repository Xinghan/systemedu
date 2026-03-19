"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { AnimateIn } from "./shared-animations"
import type { StepByStepData } from "./types"

export function StepByStepTemplate({ data }: { data: StepByStepData }) {
  const [activeStep, setActiveStep] = useState(0)
  const steps = data.steps ?? []

  if (steps.length === 0) return null

  const step = steps[activeStep]

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Step indicator bar */}
      <div className="flex bg-muted/30 border-b">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
              i === activeStep
                ? "text-primary bg-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1 justify-center">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                i < activeStep
                  ? "bg-green-500/20 text-green-600"
                  : i === activeStep
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {i + 1}
              </span>
              <span className="hidden sm:inline truncate">{s.title}</span>
            </span>
            {i === activeStep && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Step content with slide animation */}
      <div className="p-4 min-h-[120px]">
        <div
          key={activeStep}
          style={{
            animation: "slideIn 0.3s ease forwards",
          }}
        >
          <h4 className="font-medium mb-2">{step.title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{step.content}</p>
          {step.highlight && (
            <AnimateIn delay={200}>
              <div className="mt-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-md text-sm text-amber-700 dark:text-amber-400">
                {step.highlight}
              </div>
            </AnimateIn>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
        <button
          onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
          disabled={activeStep === 0}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          上一步
        </button>
        <span className="text-xs text-muted-foreground">{activeStep + 1} / {steps.length}</span>
        <button
          onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
          disabled={activeStep === steps.length - 1}
          className="text-xs text-primary hover:text-primary/80 disabled:opacity-30 transition-colors flex items-center gap-0.5"
        >
          下一步
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
