"use client"

import { useState } from "react"
import { useInView } from "./shared-animations"
import type { AnatomyData } from "./types"

export function AnatomyTemplate({ data }: { data: AnatomyData }) {
  const { ref, isInView } = useInView()
  const [activePart, setActivePart] = useState<number | null>(null)
  const parts = data.parts ?? []

  if (parts.length === 0) return null

  return (
    <div ref={ref} className="space-y-3">
      <h4 className="text-sm font-medium">{data.title}</h4>

      {/* Interactive diagram area */}
      <div className="relative border rounded-lg bg-muted/20 aspect-[16/9] min-h-[200px] overflow-hidden">
        {parts.map((part, i) => {
          const isActive = activePart === i

          return (
            <button
              key={i}
              className={`absolute transition-all duration-300 group ${isActive ? "z-10" : "z-0"}`}
              style={{
                left: `${Math.max(5, Math.min(85, part.x ?? 50))}%`,
                top: `${Math.max(5, Math.min(85, part.y ?? 50))}%`,
                transform: "translate(-50%, -50%)",
                opacity: isInView ? 1 : 0,
                transitionDelay: `${i * 100}ms`,
              }}
              onClick={() => setActivePart(isActive ? null : i)}
            >
              {/* Dot */}
              <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                isActive
                  ? "bg-primary border-primary scale-125"
                  : "bg-background border-primary/50 group-hover:border-primary group-hover:scale-110"
              }`}>
                {isActive && (
                  <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                )}
              </div>

              {/* Label */}
              <span className={`absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs px-1.5 py-0.5 rounded transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-background/80 text-muted-foreground group-hover:text-foreground"
              }`}>
                {part.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* Description panel */}
      {activePart !== null && parts[activePart] && (
        <div
          key={activePart}
          className="px-3 py-2 bg-primary/5 border border-primary/20 rounded-md"
          style={{ animation: "fadeSlideUp 0.3s ease" }}
        >
          <div className="text-sm font-medium text-primary">{parts[activePart].name}</div>
          <p className="text-sm text-muted-foreground mt-0.5">{parts[activePart].description}</p>
        </div>
      )}

      {/* Parts list fallback for accessibility */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {parts.map((part, i) => (
          <button
            key={i}
            onClick={() => setActivePart(activePart === i ? null : i)}
            className={`text-left text-xs px-2 py-1.5 rounded border transition-colors ${
              activePart === i
                ? "border-primary/50 bg-primary/5 text-primary"
                : "border-transparent hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            {part.name}
          </button>
        ))}
      </div>

      <style jsx>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
