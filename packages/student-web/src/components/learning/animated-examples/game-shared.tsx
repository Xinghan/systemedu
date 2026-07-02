"use client"

import { type ReactNode } from "react"
import { Trophy, PartyPopper, RotateCcw } from "lucide-react"
import { useT } from "@/lib/i18n/use-t"

/**
 * Deterministic shuffle using a string seed (title hash).
 * Same seed always produces the same order.
 */
export function shuffleArray<T>(arr: T[], seed: string): T[] {
  const copy = [...arr]
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  // Fisher-Yates with seeded pseudo-random
  for (let i = copy.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) | 0
    const j = ((h >>> 0) % (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Score display badge.
 */
export function GameScore({ correct, total }: { correct: number; total: number }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0

  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <Trophy className="h-4 w-4 text-amber-500" />
      <span>
        {correct}/{total}
      </span>
      <span className="text-muted-foreground">({pct}%)</span>
    </div>
  )
}

/**
 * Game completion celebration view.
 */
export function GameComplete({
  correct,
  total,
  onReset,
}: {
  correct: number
  total: number
  onReset: () => void
}) {
  const t = useT()
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  const message =
    pct === 100
      ? t("game.encourage.perfect")
      : pct >= 70
      ? t("game.encourage.good")
      : pct >= 40
      ? t("game.encourage.okay")
      : t("game.encourage.keep_trying")

  return (
    <div
      className="flex flex-col items-center gap-3 py-6"
      style={{ animation: "fadeInUp 0.4s ease forwards" }}
    >
      <PartyPopper className="h-8 w-8 text-amber-500" />
      <div className="text-lg font-semibold">{message}</div>
      <GameScore correct={correct} total={total} />
      <button
        onClick={onReset}
        className="mt-2 flex items-center gap-1.5 px-4 py-2 text-sm rounded-md border hover:bg-muted/50 transition-colors"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {t("game.retry")}
      </button>

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/**
 * Progress bar for games.
 */
export function GameProgress({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{current}/{total}</span>
    </div>
  )
}

/**
 * Feedback badge shown after answer.
 */
export function FeedbackBadge({
  correct,
  children,
}: {
  correct: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`mt-2 px-3 py-2 rounded-md text-sm ${
        correct
          ? "bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400"
          : "bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400"
      }`}
      style={{ animation: "slideDown 0.3s ease forwards" }}
    >
      {children}

      <style jsx>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
