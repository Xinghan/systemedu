"use client"

import { useState, useMemo, useCallback } from "react"
import { ChevronUp, ChevronDown, Check } from "lucide-react"
import { shuffleArray, GameComplete } from "./game-shared"
import type { SortOrderData } from "./types"

export function SortOrderTemplate({ data }: { data: SortOrderData }) {
  const correctOrder = data.items ?? []

  const initialOrder = useMemo(
    () => shuffleArray(correctOrder, data.instruction || "sort"),
    [correctOrder, data.instruction]
  )

  const [items, setItems] = useState<string[]>(initialOrder)
  const [checked, setChecked] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  const reset = useCallback(() => {
    setItems(shuffleArray(correctOrder, data.instruction + "_retry" || "sort_retry"))
    setChecked(false)
    setIsCorrect(false)
  }, [correctOrder, data.instruction])

  if (correctOrder.length === 0) return null

  if (checked && isCorrect) {
    return <GameComplete correct={correctOrder.length} total={correctOrder.length} onReset={reset} />
  }

  function moveItem(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= items.length) return
    const newItems = [...items]
    ;[newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]]
    setItems(newItems)
    setChecked(false)
  }

  function handleCheck() {
    const allCorrect = items.every((item, i) => item === correctOrder[i])
    setIsCorrect(allCorrect)
    setChecked(true)
  }

  // Check which items are in correct position
  function isItemCorrect(index: number): boolean | null {
    if (!checked) return null
    return items[index] === correctOrder[index]
  }

  return (
    <div className="border rounded-lg p-4">
      {data.instruction && (
        <p className="text-sm text-muted-foreground mb-4">{data.instruction}</p>
      )}

      <div className="space-y-2">
        {items.map((item, i) => {
          const correct = isItemCorrect(i)
          const label = data.ordered_labels?.[i]

          return (
            <div
              key={`${item}-${i}`}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm transition-all duration-200 ${
                correct === true
                  ? "bg-green-500/10 border-green-500/30"
                  : correct === false
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-background"
              }`}
            >
              {/* Position indicator */}
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[10px] font-bold shrink-0">
                {label || i + 1}
              </span>

              {/* Item text */}
              <span className="flex-1">{item}</span>

              {/* Correctness indicator */}
              {correct === true && <Check className="h-4 w-4 text-green-600 shrink-0" />}

              {/* Move buttons */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => moveItem(i, -1)}
                  disabled={i === 0}
                  className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                  aria-label="上移"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => moveItem(i, 1)}
                  disabled={i === items.length - 1}
                  className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                  aria-label="下移"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={handleCheck}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          检查顺序
        </button>
      </div>

      {checked && !isCorrect && (
        <div
          className="mt-2 px-3 py-2 rounded-md text-sm bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400"
          style={{ animation: "slideDown 0.3s ease forwards" }}
        >
          还有一些位置不对，绿色的已经正确，红色的需要调整。
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
