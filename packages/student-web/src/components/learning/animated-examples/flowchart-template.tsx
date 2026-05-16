"use client"

import { useState, useEffect } from "react"
import { useInView } from "./shared-animations"
import type { FlowchartData } from "./types"

export function FlowchartTemplate({ data }: { data: FlowchartData }) {
  const { ref, isInView } = useInView()
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const nodes = data.nodes ?? []
  const edges = data.edges ?? []

  // Auto-highlight nodes sequentially when in view
  useEffect(() => {
    if (!isInView || nodes.length === 0) return
    let i = 0
    const interval = setInterval(() => {
      setHighlightedIndex(i)
      i++
      if (i >= nodes.length) clearInterval(interval)
    }, 600)
    return () => clearInterval(interval)
  }, [isInView, nodes.length])

  if (nodes.length === 0) return null

  // Build adjacency for layout: show linear chain
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div ref={ref} className="overflow-x-auto py-2">
      <div className="flex flex-col items-center gap-1 min-w-fit">
        {nodes.map((node, i) => {
          const isHighlighted = i <= highlightedIndex
          const edge = edges.find((e) => e.from === node.id)

          return (
            <div key={node.id} className="flex flex-col items-center">
              {/* Node */}
              <div
                className={`px-4 py-2.5 rounded-lg border-2 text-center transition-all duration-500 min-w-[140px] max-w-[260px] ${
                  isHighlighted
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-muted bg-muted/30"
                }`}
                style={{
                  opacity: isInView ? 1 : 0,
                  transform: isInView ? "scale(1)" : "scale(0.9)",
                  transition: `all 0.4s ease ${i * 200}ms`,
                }}
              >
                <div className={`text-sm font-medium ${isHighlighted ? "text-primary" : "text-muted-foreground"}`}>
                  {node.label}
                </div>
                {node.description && (
                  <div className="text-xs text-muted-foreground mt-1">{node.description}</div>
                )}
              </div>

              {/* Arrow to next node */}
              {i < nodes.length - 1 && (
                <div className="flex flex-col items-center my-0.5">
                  <div
                    className={`w-0.5 h-4 transition-colors duration-500 ${
                      i < highlightedIndex ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                    style={{
                      animation: i < highlightedIndex ? "pulse 1.5s ease-in-out infinite" : "none",
                    }}
                  />
                  <svg width="12" height="8" viewBox="0 0 12 8" className={`transition-colors duration-500 ${
                    i < highlightedIndex ? "text-primary" : "text-muted-foreground/30"
                  }`}>
                    <path d="M6 8L0 0h12z" fill="currentColor" />
                  </svg>
                  {edge?.label && (
                    <span className="text-[10px] text-muted-foreground mt-0.5">{edge.label}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
