"use client"

import { AnimateIn } from "./shared-animations"
import type { CauseEffectData } from "./types"

export function CauseEffectTemplate({ data }: { data: CauseEffectData }) {
  const chains = data.chains ?? []

  if (chains.length === 0) return null

  return (
    <div className="space-y-3">
      {chains.map((chain, i) => (
        <AnimateIn key={i} delay={i * 250}>
          <div className="flex flex-col sm:flex-row items-stretch gap-0">
            {/* Cause */}
            <div className="flex-1 border rounded-l-lg sm:rounded-l-lg sm:rounded-r-none rounded-t-lg sm:rounded-t-none p-3 bg-orange-500/5 border-orange-500/20">
              <div className="text-[10px] uppercase tracking-wider text-orange-600 dark:text-orange-400 font-medium mb-1">
                原因
              </div>
              <div className="text-sm">{chain.cause}</div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center py-1 sm:py-0 sm:px-1">
              {/* Horizontal arrow (desktop) */}
              <svg
                className="hidden sm:block text-muted-foreground/50"
                width="24" height="24" viewBox="0 0 24 24"
                style={{
                  animation: `arrowPulse 1.5s ease-in-out infinite`,
                  animationDelay: `${i * 250}ms`,
                }}
              >
                <path d="M4 12h14m-4-4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {/* Vertical arrow (mobile) */}
              <svg
                className="block sm:hidden text-muted-foreground/50"
                width="24" height="24" viewBox="0 0 24 24"
                style={{
                  animation: `arrowPulse 1.5s ease-in-out infinite`,
                  animationDelay: `${i * 250}ms`,
                }}
              >
                <path d="M12 4v14m-4-4l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Effect */}
            <div className="flex-1 border rounded-r-lg sm:rounded-r-lg sm:rounded-l-none rounded-b-lg sm:rounded-b-none p-3 bg-green-500/5 border-green-500/20">
              <div className="text-[10px] uppercase tracking-wider text-green-600 dark:text-green-400 font-medium mb-1">
                结果
              </div>
              <div className="text-sm">{chain.effect}</div>
            </div>
          </div>

          {/* Explanation */}
          {chain.explanation && (
            <div className="mt-1.5 px-3 py-1.5 text-xs text-muted-foreground bg-muted/30 rounded-md">
              {chain.explanation}
            </div>
          )}
        </AnimateIn>
      ))}

      <style jsx>{`
        @keyframes arrowPulse {
          0%, 100% { opacity: 0.5; transform: translateX(0); }
          50% { opacity: 1; transform: translateX(3px); }
        }
      `}</style>
    </div>
  )
}
