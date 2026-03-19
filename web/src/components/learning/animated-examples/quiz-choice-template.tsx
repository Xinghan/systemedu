"use client"

import { useState, useCallback } from "react"
import { Check, X } from "lucide-react"
import { GameComplete, GameProgress, FeedbackBadge } from "./game-shared"
import type { QuizChoiceData } from "./types"

export function QuizChoiceTemplate({ data }: { data: QuizChoiceData }) {
  const questions = data.questions ?? []
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [done, setDone] = useState(false)

  const reset = useCallback(() => {
    setCurrent(0)
    setSelected(null)
    setScore(0)
    setAnswered(false)
    setDone(false)
  }, [])

  if (questions.length === 0) return null

  if (done) {
    return <GameComplete correct={score} total={questions.length} onReset={reset} />
  }

  const q = questions[current]
  const isCorrect = selected === q.correct

  function handleSelect(idx: number) {
    if (answered) return
    setSelected(idx)
    setAnswered(true)
    if (idx === q.correct) {
      setScore((s) => s + 1)
    }
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
      // Add score for last question if correct
      setDone(true)
    } else {
      setCurrent((c) => c + 1)
      setSelected(null)
      setAnswered(false)
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <GameProgress current={current + 1} total={questions.length} />

      <div key={current} style={{ animation: "slideIn 0.3s ease forwards" }}>
        <p className="font-medium mb-3">{q.question}</p>

        <div className="space-y-2">
          {q.options.map((opt, i) => {
            let cls = "border rounded-md px-3 py-2.5 text-sm text-left w-full transition-all duration-200"
            if (!answered) {
              cls += " hover:bg-muted/50 hover:border-primary/30 cursor-pointer"
            } else if (i === q.correct) {
              cls += " bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-400"
            } else if (i === selected) {
              cls += " bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-400"
              cls += " animate-[shake_0.3s_ease]"
            } else {
              cls += " opacity-50"
            }

            return (
              <button key={i} onClick={() => handleSelect(i)} className={cls} disabled={answered}>
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-bold shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt}</span>
                  {answered && i === q.correct && <Check className="h-4 w-4 ml-auto shrink-0 text-green-600" />}
                  {answered && i === selected && i !== q.correct && <X className="h-4 w-4 ml-auto shrink-0 text-red-600" />}
                </span>
              </button>
            )
          })}
        </div>

        {answered && (
          <FeedbackBadge correct={isCorrect}>
            {isCorrect ? q.explanation : (q.hint || q.explanation)}
          </FeedbackBadge>
        )}
      </div>

      {answered && (
        <div className="flex justify-end mt-4">
          <button
            onClick={handleNext}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {current + 1 >= questions.length ? "查看结果" : "下一题"}
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
