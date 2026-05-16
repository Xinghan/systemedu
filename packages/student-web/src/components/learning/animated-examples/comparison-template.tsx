"use client"

import { AnimateIn } from "./shared-animations"
import type { ComparisonData } from "./types"

export function ComparisonTemplate({ data }: { data: ComparisonData }) {
  const left = data.left
  const right = data.right

  if (!left || !right) return null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Left card */}
        <AnimateIn delay={0}>
          <div className="border rounded-lg p-4 bg-blue-500/5 border-blue-500/20">
            <h4 className="font-medium text-sm mb-2 text-blue-700 dark:text-blue-400">
              {left.label}
            </h4>
            <ul className="space-y-1.5">
              {left.points.map((point, i) => (
                <AnimateIn key={i} delay={100 + i * 80}>
                  <li className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500/50 mt-1.5 shrink-0" />
                    {point}
                  </li>
                </AnimateIn>
              ))}
            </ul>
          </div>
        </AnimateIn>

        {/* Right card */}
        <AnimateIn delay={200}>
          <div className="border rounded-lg p-4 bg-purple-500/5 border-purple-500/20">
            <h4 className="font-medium text-sm mb-2 text-purple-700 dark:text-purple-400">
              {right.label}
            </h4>
            <ul className="space-y-1.5">
              {right.points.map((point, i) => (
                <AnimateIn key={i} delay={300 + i * 80}>
                  <li className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500/50 mt-1.5 shrink-0" />
                    {point}
                  </li>
                </AnimateIn>
              ))}
            </ul>
          </div>
        </AnimateIn>
      </div>

      {data.conclusion && (
        <AnimateIn delay={500}>
          <div className="px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground text-center">
            {data.conclusion}
          </div>
        </AnimateIn>
      )}
    </div>
  )
}
