"use client"

import { useState, useMemo, useCallback } from "react"
import { shuffleArray, GameComplete, FeedbackBadge } from "./game-shared"
import type { FillBlanksData } from "./types"

export function FillBlanksTemplate({ data }: { data: FillBlanksData }) {
  const segments = data.segments ?? []

  // Collect correct answers from blank segments
  const blanks = useMemo(
    () => segments.filter((s) => s.type === "blank").map((s) => s.content),
    [segments]
  )

  // Build word bank: correct answers + distractors, shuffled
  const wordBank = useMemo(() => {
    const words = [...blanks, ...(data.distractors ?? [])]
    return shuffleArray(words, data.instruction || "fill")
  }, [blanks, data.distractors, data.instruction])

  // Track which blank has which word filled
  const [filled, setFilled] = useState<(string | null)[]>(() => blanks.map(() => null))
  // Track which words from bank have been used
  const [usedWords, setUsedWords] = useState<Set<number>>(new Set())
  const [checked, setChecked] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)

  const reset = useCallback(() => {
    setFilled(blanks.map(() => null))
    setUsedWords(new Set())
    setChecked(false)
    setCorrectCount(0)
  }, [blanks])

  if (segments.length === 0 || blanks.length === 0) return null

  const allCorrect = checked && correctCount === blanks.length

  if (allCorrect) {
    return <GameComplete correct={blanks.length} total={blanks.length} onReset={reset} />
  }

  // Currently selected blank slot to fill
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  function handleSlotClick(blankIdx: number) {
    if (checked) return

    // If slot already has a word, remove it back to bank
    if (filled[blankIdx] !== null) {
      const word = filled[blankIdx]
      const bankIdx = wordBank.findIndex((w, i) => w === word && usedWords.has(i))
      const newFilled = [...filled]
      newFilled[blankIdx] = null
      setFilled(newFilled)
      if (bankIdx !== -1) {
        const newUsed = new Set(usedWords)
        newUsed.delete(bankIdx)
        setUsedWords(newUsed)
      }
      setSelectedSlot(null)
      setChecked(false)
      return
    }

    setSelectedSlot(blankIdx)
  }

  function handleWordClick(bankIdx: number) {
    if (checked || usedWords.has(bankIdx)) return

    const targetSlot = selectedSlot ?? filled.findIndex((f) => f === null)
    if (targetSlot === -1) return

    const newFilled = [...filled]
    newFilled[targetSlot] = wordBank[bankIdx]
    setFilled(newFilled)

    const newUsed = new Set(usedWords)
    newUsed.add(bankIdx)
    setUsedWords(newUsed)

    setSelectedSlot(null)
    setChecked(false)
  }

  function handleCheck() {
    let count = 0
    filled.forEach((word, i) => {
      if (word === blanks[i]) count++
    })
    setCorrectCount(count)
    setChecked(true)

    // If wrong answers, bounce them back after delay
    if (count < blanks.length) {
      setTimeout(() => {
        const newFilled = [...filled]
        const newUsed = new Set(usedWords)

        filled.forEach((word, i) => {
          if (word !== null && word !== blanks[i]) {
            newFilled[i] = null
            // Find and free the bank word
            const bankIdx = wordBank.findIndex((w, bi) => w === word && newUsed.has(bi))
            if (bankIdx !== -1) newUsed.delete(bankIdx)
          }
        })

        setFilled(newFilled)
        setUsedWords(newUsed)
        setChecked(false)
      }, 1200)
    }
  }

  const allFilled = filled.every((f) => f !== null)

  // Build blank index counter for rendering
  let blankCounter = 0

  return (
    <div className="border rounded-lg p-4">
      {data.instruction && (
        <p className="text-sm text-muted-foreground mb-4">{data.instruction}</p>
      )}

      {/* Text with blanks */}
      <div className="leading-relaxed mb-4 flex flex-wrap items-center gap-y-2">
        {segments.map((seg, i) => {
          if (seg.type === "text") {
            return (
              <span key={i} className="text-sm">
                {seg.content}
              </span>
            )
          }

          const bIdx = blankCounter++
          const word = filled[bIdx]
          const isSelected = selectedSlot === bIdx
          const isCorrectSlot = checked && word === blanks[bIdx]
          const isWrongSlot = checked && word !== null && word !== blanks[bIdx]

          return (
            <button
              key={i}
              onClick={() => handleSlotClick(bIdx)}
              className={`inline-flex items-center justify-center min-w-[60px] px-2 py-1 mx-1 rounded border-2 border-dashed text-sm transition-all duration-200 ${
                isCorrectSlot
                  ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 border-solid"
                  : isWrongSlot
                  ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400 border-solid animate-[shake_0.3s_ease]"
                  : isSelected
                  ? "border-primary bg-primary/5"
                  : word
                  ? "border-primary/40 bg-primary/5"
                  : "border-muted-foreground/30 hover:border-primary/50 cursor-pointer"
              }`}
            >
              {word || "\u00A0\u00A0\u00A0"}
            </button>
          )
        })}
      </div>

      {/* Word bank */}
      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-md mb-4">
        {wordBank.map((word, i) => (
          <button
            key={i}
            onClick={() => handleWordClick(i)}
            disabled={usedWords.has(i) || checked}
            className={`px-3 py-1.5 rounded-md border text-sm transition-all duration-200 ${
              usedWords.has(i)
                ? "opacity-30 cursor-default"
                : "hover:bg-primary/10 hover:border-primary/30 cursor-pointer"
            }`}
          >
            {word}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleCheck}
          disabled={!allFilled}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          检查答案
        </button>
      </div>

      {checked && correctCount < blanks.length && (
        <FeedbackBadge correct={false}>
          答对了 {correctCount}/{blanks.length} 个，错误的已退回词库，再试一次！
        </FeedbackBadge>
      )}

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
