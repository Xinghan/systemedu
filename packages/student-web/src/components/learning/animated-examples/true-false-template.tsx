"use client"

import { useState, useCallback } from "react"
import { Check, X } from "lucide-react"
import { GameComplete, GameProgress, FeedbackBadge } from "./game-shared"
import type { TrueFalseData } from "./types"
import { useT } from "@/lib/i18n/use-t"

export function TrueFalseTemplate({ data }: { data: TrueFalseData }) {
  const t = useT()
  const statements = data.statements ?? []
  const [current, setCurrent] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [userAnswer, setUserAnswer] = useState<boolean | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const reset = useCallback(() => {
    setCurrent(0)
    setAnswered(false)
    setUserAnswer(null)
    setScore(0)
    setDone(false)
  }, [])

  if (statements.length === 0) return null

  if (done) {
    return <GameComplete correct={score} total={statements.length} onReset={reset} />
  }

  const stmt = statements[current]
  const isCorrect = userAnswer === stmt.correct

  function handleAnswer(answer: boolean) {
    if (answered) return
    setUserAnswer(answer)
    setAnswered(true)
    if (answer === stmt.correct) {
      setScore((s) => s + 1)
    }
  }

  function handleNext() {
    if (current + 1 >= statements.length) {
      setDone(true)
    } else {
      setCurrent((c) => c + 1)
      setAnswered(false)
      setUserAnswer(null)
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <GameProgress current={current + 1} total={statements.length} />

      <div key={current} style={{ animation: "flipIn 0.4s ease forwards" }}>
        <div className="border rounded-lg p-4 bg-muted/20 mb-4">
          <p className="text-sm leading-relaxed">{stmt.text}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleAnswer(true)}
            disabled={answered}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md border text-sm font-medium transition-all duration-200 ${
              answered && stmt.correct === true
                ? "bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-400"
                : answered && userAnswer === true && !isCorrect
                ? "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-400"
                : answered
                ? "opacity-50"
                : "hover:bg-green-500/5 hover:border-green-500/30 cursor-pointer"
            }`}
          >
            <Check className="h-4 w-4" />
            {t("game.true")}
          </button>
          <button
            onClick={() => handleAnswer(false)}
            disabled={answered}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md border text-sm font-medium transition-all duration-200 ${
              answered && stmt.correct === false
                ? "bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-400"
                : answered && userAnswer === false && !isCorrect
                ? "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-400"
                : answered
                ? "opacity-50"
                : "hover:bg-red-500/5 hover:border-red-500/30 cursor-pointer"
            }`}
          >
            <X className="h-4 w-4" />
            {t("game.false")}
          </button>
        </div>

        {answered && (
          <FeedbackBadge correct={isCorrect}>
            {stmt.explanation}
          </FeedbackBadge>
        )}
      </div>

      {answered && (
        <div className="flex justify-end mt-4">
          <button
            onClick={handleNext}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {current + 1 >= statements.length ? t("game.see_results") : t("game.next_question")}
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes flipIn {
          from { opacity: 0; transform: rotateX(-10deg) translateY(8px); }
          to { opacity: 1; transform: rotateX(0) translateY(0); }
        }
      `}</style>
    </div>
  )
}
