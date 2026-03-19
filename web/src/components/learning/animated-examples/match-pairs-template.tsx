"use client"

import { useState, useMemo, useCallback } from "react"
import { Link2 } from "lucide-react"
import { shuffleArray, GameComplete } from "./game-shared"
import type { MatchPairsData } from "./types"

export function MatchPairsTemplate({ data }: { data: MatchPairsData }) {
  const pairs = data.pairs ?? []

  // Shuffle right column deterministically
  const shuffledRight = useMemo(
    () => shuffleArray(pairs.map((p) => p.right), data.instruction || "match"),
    [pairs, data.instruction]
  )

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null)
  const [selectedRight, setSelectedRight] = useState<number | null>(null)
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [wrongPair, setWrongPair] = useState<{ left: number; right: number } | null>(null)

  const reset = useCallback(() => {
    setSelectedLeft(null)
    setSelectedRight(null)
    setMatched(new Set())
    setWrongPair(null)
  }, [])

  if (pairs.length === 0) return null

  const allMatched = matched.size === pairs.length

  if (allMatched) {
    return <GameComplete correct={pairs.length} total={pairs.length} onReset={reset} />
  }

  // Map shuffled right items back to their original pair index
  function getRightOriginalIndex(shuffledIdx: number): number {
    const rightText = shuffledRight[shuffledIdx]
    return pairs.findIndex((p) => p.right === rightText)
  }

  function handleLeftClick(idx: number) {
    if (matched.has(idx)) return
    setWrongPair(null)
    setSelectedLeft(idx)

    // If right is already selected, try match
    if (selectedRight !== null) {
      tryMatch(idx, selectedRight)
    }
  }

  function handleRightClick(shuffledIdx: number) {
    const origIdx = getRightOriginalIndex(shuffledIdx)
    if (matched.has(origIdx)) return
    setWrongPair(null)
    setSelectedRight(shuffledIdx)

    // If left is already selected, try match
    if (selectedLeft !== null) {
      tryMatch(selectedLeft, shuffledIdx)
    }
  }

  function tryMatch(leftIdx: number, rightShuffledIdx: number) {
    const rightOrigIdx = getRightOriginalIndex(rightShuffledIdx)

    if (leftIdx === rightOrigIdx) {
      // Correct match
      setMatched((prev) => new Set([...prev, leftIdx]))
      setSelectedLeft(null)
      setSelectedRight(null)
    } else {
      // Wrong match
      setWrongPair({ left: leftIdx, right: rightShuffledIdx })
      setTimeout(() => {
        setWrongPair(null)
        setSelectedLeft(null)
        setSelectedRight(null)
      }, 800)
    }
  }

  return (
    <div className="border rounded-lg p-4">
      {data.instruction && (
        <p className="text-sm text-muted-foreground mb-4">{data.instruction}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Left column */}
        <div className="space-y-2">
          {pairs.map((p, i) => {
            const isMatched = matched.has(i)
            const isSelected = selectedLeft === i
            const isWrong = wrongPair?.left === i

            return (
              <button
                key={i}
                onClick={() => handleLeftClick(i)}
                disabled={isMatched}
                className={`w-full px-3 py-2.5 rounded-md border text-sm text-left transition-all duration-200 ${
                  isMatched
                    ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                    : isWrong
                    ? "bg-red-500/10 border-red-500/30 animate-[shake_0.3s_ease]"
                    : isSelected
                    ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                    : "hover:bg-muted/50 cursor-pointer"
                }`}
              >
                <span className="flex items-center gap-2">
                  {isMatched && <Link2 className="h-3.5 w-3.5 shrink-0 text-green-600" />}
                  {p.left}
                </span>
              </button>
            )
          })}
        </div>

        {/* Right column (shuffled) */}
        <div className="space-y-2">
          {shuffledRight.map((text, si) => {
            const origIdx = getRightOriginalIndex(si)
            const isMatched = matched.has(origIdx)
            const isSelected = selectedRight === si
            const isWrong = wrongPair?.right === si

            return (
              <button
                key={si}
                onClick={() => handleRightClick(si)}
                disabled={isMatched}
                className={`w-full px-3 py-2.5 rounded-md border text-sm text-left transition-all duration-200 ${
                  isMatched
                    ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                    : isWrong
                    ? "bg-red-500/10 border-red-500/30 animate-[shake_0.3s_ease]"
                    : isSelected
                    ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                    : "hover:bg-muted/50 cursor-pointer"
                }`}
              >
                <span className="flex items-center gap-2">
                  {isMatched && <Link2 className="h-3.5 w-3.5 shrink-0 text-green-600" />}
                  {text}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 text-center text-xs text-muted-foreground">
        已配对 {matched.size}/{pairs.length}
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
