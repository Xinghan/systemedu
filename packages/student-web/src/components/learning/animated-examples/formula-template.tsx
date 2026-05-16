"use client"

import { useState } from "react"
import { AnimateIn } from "./shared-animations"
import type { FormulaData } from "./types"

export function FormulaTemplate({ data }: { data: FormulaData }) {
  const [activePart, setActivePart] = useState<number | null>(null)
  const parts = data.parts ?? []

  return (
    <div className="space-y-4">
      {/* Formula display */}
      <div className="bg-muted/30 border rounded-lg p-4 text-center">
        <div className="text-lg font-mono font-medium tracking-wide">
          {data.expression}
        </div>
        {data.description && (
          <p className="text-xs text-muted-foreground mt-2">{data.description}</p>
        )}
      </div>

      {/* Parts breakdown */}
      {parts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">
            点击各部分查看解释：
          </p>
          <div className="flex flex-wrap gap-2">
            {parts.map((part, i) => (
              <AnimateIn key={i} delay={i * 100}>
                <button
                  onClick={() => setActivePart(activePart === i ? null : i)}
                  className={`px-3 py-1.5 rounded-md text-sm font-mono transition-all border ${
                    activePart === i
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted/30 border-muted hover:border-primary/50"
                  }`}
                >
                  {part.text}
                </button>
              </AnimateIn>
            ))}
          </div>

          {/* Explanation panel */}
          {activePart !== null && parts[activePart] && (
            <div
              key={activePart}
              className="mt-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-md text-sm"
              style={{ animation: "fadeIn 0.3s ease" }}
            >
              <span className="font-mono font-medium text-primary mr-2">
                {parts[activePart].text}
              </span>
              <span className="text-muted-foreground">
                {parts[activePart].explanation}
              </span>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
