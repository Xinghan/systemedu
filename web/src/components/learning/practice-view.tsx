"use client"

import { useState, useCallback, useEffect } from "react"
import { Check, X, Send, History, ChevronDown, ChevronUp, Lightbulb, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { PagedContentView } from "./paged-content-view"
import { gateway } from "@/lib/api"
import type { PracticeData, PracticeExercise, PracticeFeedbackItem, PracticeSubmissionResult, PracticeSubmissionSummary } from "@/lib/types/api"

interface PracticeViewProps {
  content: string
  projectName: string
  nodeId: number
}

function parsePracticeData(content: string): PracticeData | null {
  let text = content.trim()
  if (text.startsWith("```")) {
    const lines = text.split("\n")
    text = lines.slice(1, lines[lines.length - 1]?.trim() === "```" ? -1 : undefined).join("\n").trim()
  }
  try {
    const data = JSON.parse(text)
    if (data?.exercises && Array.isArray(data.exercises)) {
      return data as PracticeData
    }
  } catch {
    // not JSON
  }
  return null
}

const difficultyConfig = {
  easy: { label: "简单", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "中等", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  hard: { label: "困难", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

function ExerciseCard({
  exercise,
  index,
  answer,
  onAnswerChange,
  feedback,
  submitted,
}: {
  exercise: PracticeExercise
  index: number
  answer: string
  onAnswerChange: (value: string) => void
  feedback?: PracticeFeedbackItem
  submitted: boolean
}) {
  const [showHint, setShowHint] = useState(false)
  const diff = difficultyConfig[exercise.difficulty] ?? difficultyConfig.easy

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold">
            {index + 1}
          </span>
          <Badge variant="outline" className="text-xs">
            {exercise.type === "choice" ? "选择题" : exercise.type === "fill_blank" ? "填空题" : "简答题"}
          </Badge>
          <Badge className={`text-xs ${diff.color} border-0`}>{diff.label}</Badge>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{exercise.points} 分</span>
      </div>

      <p className="text-sm font-medium">{exercise.question}</p>

      {/* Input based on type */}
      {exercise.type === "choice" && exercise.options && (
        <div className="space-y-2">
          {exercise.options.map((opt, optIdx) => {
            const isSelected = answer === String(optIdx)
            const isCorrectOption = submitted && feedback && String(feedback.correct_answer ?? exercise.correct) === String(optIdx)
            const isWrong = submitted && isSelected && !feedback?.correct

            return (
              <button
                key={optIdx}
                onClick={() => !submitted && onAnswerChange(String(optIdx))}
                disabled={submitted}
                className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-all ${
                  submitted
                    ? isCorrectOption
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : isWrong
                        ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                        : isSelected
                          ? "border-primary bg-primary/5"
                          : "border-muted"
                    : isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-muted hover:border-primary/50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs shrink-0">
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {submitted && isCorrectOption && <Check className="h-4 w-4 text-green-600 shrink-0" />}
                  {submitted && isWrong && <X className="h-4 w-4 text-red-500 shrink-0" />}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {exercise.type === "fill_blank" && (
        <Input
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="请输入答案..."
          disabled={submitted}
          className={submitted && feedback ? (feedback.correct ? "border-green-500" : "border-red-500") : ""}
        />
      )}

      {exercise.type === "short_answer" && (
        <Textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="请输入你的回答..."
          rows={3}
          disabled={submitted}
          className={submitted && feedback ? (feedback.correct ? "border-green-500" : "border-red-500") : ""}
        />
      )}

      {/* Hint */}
      {!submitted && exercise.hint && (
        <button
          onClick={() => setShowHint(!showHint)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Lightbulb className="h-3 w-3" />
          {showHint ? "隐藏提示" : "查看提示"}
          {showHint ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      )}
      {showHint && !submitted && (
        <p className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-900/10 px-3 py-2 rounded">
          {exercise.hint}
        </p>
      )}

      {/* Feedback after submission */}
      {submitted && feedback && (
        <div className={`rounded-md px-3 py-2 text-sm ${
          feedback.correct
            ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
            : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
        }`}>
          <div className="flex items-center gap-1.5 mb-1">
            {feedback.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            <span className="font-medium">
              {feedback.correct ? "正确" : "错误"} — 得 {feedback.points_earned}/{exercise.points} 分
            </span>
          </div>
          {feedback.feedback && <p className="text-xs mt-1">{feedback.feedback}</p>}
          {feedback.correct_answer && !feedback.correct && (
            <p className="text-xs mt-1 opacity-80">参考答案：{feedback.correct_answer}</p>
          )}
          {exercise.explanation && (
            <p className="text-xs mt-1 opacity-80">解析：{exercise.explanation}</p>
          )}
        </div>
      )}
    </div>
  )
}

export function PracticeView({ content, projectName, nodeId }: PracticeViewProps) {
  const practiceData = parsePracticeData(content)

  // Fallback to markdown for old/unparseable data
  if (!practiceData) {
    return <PagedContentView content={content} projectName={projectName} nodeId={nodeId} tab="practice" />
  }

  return <PracticeExerciseView data={practiceData} projectName={projectName} nodeId={nodeId} />
}

function PracticeExerciseView({
  data,
  projectName,
  nodeId,
}: {
  data: PracticeData
  projectName: string
  nodeId: number
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<PracticeSubmissionResult | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<PracticeSubmissionSummary[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const submitted = result !== null

  const handleAnswerChange = useCallback((idx: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [idx]: value }))
  }, [])

  const handleSubmit = async () => {
    const answerList = data.exercises.map((_, idx) => ({
      exercise_idx: idx,
      user_answer: answers[idx] ?? "",
    }))

    setSubmitting(true)
    try {
      const res = await gateway.submitPractice(projectName, nodeId, answerList)
      setResult(res)
    } catch (e) {
      console.error("Submit practice failed:", e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setAnswers({})
    setResult(null)
  }

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await gateway.practiceSubmissions(projectName, nodeId)
      setHistory(res)
      setShowHistory(true)
    } catch (e) {
      console.error("Load history failed:", e)
    } finally {
      setLoadingHistory(false)
    }
  }

  const answeredCount = Object.keys(answers).filter((k) => answers[Number(k)]?.trim()).length
  const progress = (answeredCount / data.exercises.length) * 100

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">练习作业</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            共 {data.exercises.length} 题，满分 {data.total_points} 分，及格 {data.pass_score} 分
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadHistory}
          disabled={loadingHistory}
          className="gap-1 text-xs"
        >
          {loadingHistory ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />}
          历史记录
        </Button>
      </div>

      {/* Progress (before submission) */}
      {!submitted && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>答题进度</span>
            <span>{answeredCount}/{data.exercises.length}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* Result summary (after submission) */}
      {submitted && result && (
        <div className={`rounded-lg p-4 ${
          result.passed
            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            : "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">
                {result.passed ? "恭喜通过！" : "继续努力！"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                第 {result.attempt} 次提交
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{result.score}/{result.total_points}</p>
              <p className="text-xs text-muted-foreground">
                {result.passed ? "已通过" : `需要 ${data.pass_score} 分`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Exercise list */}
      <div className="space-y-3">
        {data.exercises.map((ex, idx) => (
          <ExerciseCard
            key={idx}
            exercise={ex}
            index={idx}
            answer={answers[idx] ?? ""}
            onAnswerChange={(v) => handleAnswerChange(idx, v)}
            feedback={result?.feedback.find((f) => f.exercise_idx === idx)}
            submitted={submitted}
          />
        ))}
      </div>

      {/* Submit / Reset button */}
      <div className="flex items-center gap-2 pt-2">
        {!submitted ? (
          <Button
            onClick={handleSubmit}
            disabled={submitting || answeredCount === 0}
            className="gap-1.5"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            提交作业
          </Button>
        ) : (
          <Button onClick={handleReset} variant="outline" className="gap-1.5">
            重新做题
          </Button>
        )}
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">提交历史</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="text-xs">
              关闭
            </Button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无提交记录</p>
          ) : (
            <div className="space-y-2">
              {history.map((s) => (
                <div key={s.submission_id} className="flex items-center justify-between text-xs border rounded px-3 py-2">
                  <span>第 {s.attempt} 次</span>
                  <span className="font-medium">{s.score}/{s.total_points} 分</span>
                  <span className="text-muted-foreground">
                    {s.submitted_at ? new Date(s.submitted_at).toLocaleString("zh-CN") : "-"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
