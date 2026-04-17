"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"
import {
  Wrench, CheckCircle2, ListChecks, MessageSquareText,
  ChevronDown, ChevronUp, Target, ClipboardCheck, PenLine,
  AlertTriangle, Lightbulb, Award, XCircle, Send, RotateCcw,
} from "lucide-react"

import type { KnodeInfo, NodeProgress, ExerciseAttemptPayload } from "@/lib/types/api"
import { gateway } from "@/lib/api"
import { CapstoneSubmissionPanel } from "./capstone-submission-panel"

interface AssignmentViewProps {
  content: string
  knode?: KnodeInfo | null
  progress?: NodeProgress | null
  projectName?: string
  onStatusChange?: () => void
}

// ---------------------------------------------------------------------------
// Choice question parser — extracts interactive questions from markdown
// ---------------------------------------------------------------------------

interface ParsedChoice {
  number: string
  question: string
  options: { letter: string; content: string }[]
  answer: string          // "A" | "B" | "C" | "D"
  explanation?: string
}

interface ParsedQa {
  number: string
  question: string
  referenceAnswer: string   // markdown of the reference answer (bullet list etc.)
}

interface ParsedBlock {
  type: "heading" | "choices" | "qa_questions" | "markdown"
  heading?: string
  headingKind?: "choice" | "qa" | "hands_on" | "other"
  choices?: ParsedChoice[]
  qaQuestions?: ParsedQa[]
  markdown?: string
}

function parseAssignment(raw: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  const lines = raw.split("\n")
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // h2 heading
    if (/^## /.test(line)) {
      const text = line.replace(/^## /, "").trim()
      let kind: ParsedBlock["headingKind"] = "other"
      if (/选择题/.test(text)) kind = "choice"
      else if (/问答题/.test(text)) kind = "qa"
      else if (/动手/.test(text)) kind = "hands_on"
      blocks.push({ type: "heading", heading: text, headingKind: kind })
      i++

      // If this is a choice section, parse all questions in it
      if (kind === "choice") {
        const choices: ParsedChoice[] = []
        while (i < lines.length && !/^## /.test(lines[i])) {
          // Look for question: **N. question text**
          const qMatch = lines[i].match(/^\*\*(\d+)\.\s*(.+?)\*\*\s*$/)
          if (qMatch) {
            const q: ParsedChoice = {
              number: qMatch[1],
              question: qMatch[2],
              options: [],
              answer: "",
            }
            i++
            // Collect options
            while (i < lines.length) {
              const optMatch = lines[i].match(/^([A-D])\.\s+(.+)/)
              if (optMatch) {
                q.options.push({ letter: optMatch[1], content: optMatch[2].trim() })
                i++
              } else {
                break
              }
            }
            // Skip blank lines
            while (i < lines.length && lines[i].trim() === "") i++
            // Look for answer line: **答案：X** or 答案：X
            if (i < lines.length) {
              const ansLine = lines[i].replace(/^\*\*/g, "").replace(/\*\*$/g, "")
              const ansMatch = ansLine.match(/^答案[：:]([A-D])/)
              if (ansMatch) {
                q.answer = ansMatch[1]
                i++
              }
            }
            // Skip separator ---
            while (i < lines.length && (lines[i].trim() === "" || lines[i].trim() === "---")) i++
            choices.push(q)
          } else {
            i++
          }
        }
        if (choices.length > 0) {
          blocks.push({ type: "choices", choices })
        }
      }
      // Parse QA section: **N. question** followed by **参考答案要点：** + bullet list
      if (kind === "qa") {
        const qaQuestions: ParsedQa[] = []
        while (i < lines.length && !/^## /.test(lines[i])) {
          const qMatch = lines[i].match(/^\*\*(\d+)\.\s*(.+?)\*\*\s*$/)
          if (qMatch) {
            const qa: ParsedQa = { number: qMatch[1], question: qMatch[2], referenceAnswer: "" }
            i++
            // Skip blank lines
            while (i < lines.length && lines[i].trim() === "") i++
            // Collect reference answer block (starts with **参考答案要点：** then bullet list)
            const refLines: string[] = []
            let inRef = false
            if (i < lines.length && /^\*\*参考答案要点[：:]/.test(lines[i])) {
              // Skip the header line itself
              i++
              inRef = true
            }
            if (inRef) {
              while (i < lines.length && !/^## /.test(lines[i]) && !/^\*\*\d+\./.test(lines[i])) {
                if (lines[i].trim() === "---") { i++; break }
                refLines.push(lines[i])
                i++
              }
            }
            qa.referenceAnswer = refLines.join("\n").trim()
            // Skip trailing blank/separator lines
            while (i < lines.length && (lines[i]?.trim() === "" || lines[i]?.trim() === "---")) i++
            qaQuestions.push(qa)
          } else {
            i++
          }
        }
        if (qaQuestions.length > 0) {
          blocks.push({ type: "qa_questions", qaQuestions })
        }
      }
      continue
    }

    // Accumulate non-heading lines as markdown
    const mdStart = i
    while (i < lines.length && !/^## /.test(lines[i])) i++
    const md = lines.slice(mdStart, i).join("\n").trim()
    if (md) {
      blocks.push({ type: "markdown", markdown: md })
    }
  }

  return blocks
}

// ---------------------------------------------------------------------------
// Interactive choice question component
// ---------------------------------------------------------------------------

function buildChoiceErrorAnalysis(q: ParsedChoice, wrongLetter: string): string {
  const wrongOpt = q.options.find(o => o.letter === wrongLetter)
  const correctOpt = q.options.find(o => o.letter === q.answer)
  if (!wrongOpt || !correctOpt) return ""
  return `你选了 ${wrongLetter}（${wrongOpt.content}），但正确答案是 ${q.answer}（${correctOpt.content}）。`
}

function ChoiceQuestion({ q, projectName, knodeId }: {
  q: ParsedChoice
  projectName?: string
  knodeId?: number
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [attemptSeq, setAttemptSeq] = useState(1)
  const [errorAnalysis, setErrorAnalysis] = useState<string | null>(null)
  const shownAt = useRef(Date.now())

  const isCorrect = submitted && selected === q.answer
  const canRetry = submitted && !isCorrect

  const submitToApi = useCallback((answer: string, seq: number, correct: boolean, analysis: string | null) => {
    if (!projectName || knodeId == null) return
    const attempt: ExerciseAttemptPayload = {
      knode_id: knodeId,
      quiz_type: "assignment",
      exercise_id: `assignment_choice_${q.number}`,
      question: q.question,
      user_answer: answer,
      correct_answer: q.answer,
      is_correct: correct,
      attempt_seq: seq,
      time_spent_ms: Date.now() - shownAt.current,
      error_analysis: analysis,
    }
    gateway.submitExerciseAttempts(projectName, [attempt]).catch(() => {})
  }, [projectName, knodeId, q])

  const handleSubmit = useCallback(() => {
    if (!selected) return
    setSubmitted(true)
    const correct = selected === q.answer
    const analysis = correct ? null : buildChoiceErrorAnalysis(q, selected)
    setErrorAnalysis(analysis)
    submitToApi(selected, attemptSeq, correct, analysis)
  }, [selected, q, attemptSeq, submitToApi])

  const handleRetry = useCallback(() => {
    setSubmitted(false)
    setSelected(null)
    setErrorAnalysis(null)
    setAttemptSeq(s => s + 1)
    shownAt.current = Date.now()
  }, [])

  return (
    <div className="mt-4 mb-2 pt-3 border-t border-gray-100 dark:border-gray-800 first:border-t-0 first:pt-0">
      {/* Question */}
      <div className="flex items-start gap-2.5 mb-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold shrink-0 mt-0.5">
          {q.number}
        </span>
        <span className="text-sm font-semibold leading-relaxed">{q.question}</span>
      </div>

      {/* Options */}
      <div className="space-y-2 ml-8">
        {q.options.map((opt) => {
          let borderClass = "border-gray-200 dark:border-gray-700"
          let bgClass = "bg-white dark:bg-gray-900/50"
          let ringClass = ""

          if (submitted) {
            if (opt.letter === q.answer) {
              borderClass = "border-green-400 dark:border-green-600"
              bgClass = "bg-green-50 dark:bg-green-950/30"
            } else if (opt.letter === selected) {
              borderClass = "border-red-400 dark:border-red-600"
              bgClass = "bg-red-50 dark:bg-red-950/30"
            }
          } else if (opt.letter === selected) {
            borderClass = "border-blue-400 dark:border-blue-500"
            bgClass = "bg-blue-50 dark:bg-blue-950/30"
            ringClass = "ring-1 ring-blue-300 dark:ring-blue-600"
          }

          return (
            <button
              key={opt.letter}
              disabled={submitted}
              onClick={() => setSelected(opt.letter)}
              className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${borderClass} ${bgClass} ${ringClass} w-full text-left transition-colors ${
                submitted ? "cursor-default" : "hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer"
              }`}
            >
              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 mt-0.5 ${
                submitted && opt.letter === q.answer
                  ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                  : submitted && opt.letter === selected
                  ? "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
                  : opt.letter === selected
                  ? "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200"
                  : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
              }`}>
                {opt.letter}
              </span>
              <span className="text-sm leading-relaxed">{opt.content}</span>
              {submitted && opt.letter === q.answer && (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5 ml-auto" />
              )}
              {submitted && opt.letter === selected && opt.letter !== q.answer && (
                <XCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5 ml-auto" />
              )}
            </button>
          )
        })}
      </div>

      {/* Submit / Result */}
      <div className="ml-8 mt-3">
        {!submitted ? (
          <button
            disabled={!selected}
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            提交答案
          </button>
        ) : (
          <div className="space-y-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
              isCorrect
                ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
            }`}>
              {isCorrect ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> 回答正确</>
              ) : (
                <><XCircle className="h-3.5 w-3.5" /> 回答错误，正确答案是 {q.answer}</>
              )}
            </div>
            {errorAnalysis && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                {errorAnalysis}
              </div>
            )}
            {canRetry && (
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> 再试一次
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Normal assignment preprocessing & components
// ---------------------------------------------------------------------------

function getSectionType(text: string): "choice" | "qa" | "hands_on" | "other" {
  if (/选择题/.test(text)) return "choice"
  if (/问答题/.test(text)) return "qa"
  if (/动手/.test(text)) return "hands_on"
  return "other"
}

const sectionConfig = {
  choice: {
    icon: ListChecks,
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-300",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  qa: {
    icon: MessageSquareText,
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-800 dark:text-violet-300",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  hands_on: {
    icon: Wrench,
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-300",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  other: {
    icon: ListChecks,
    bg: "bg-gray-50 dark:bg-gray-900/40",
    border: "border-gray-200 dark:border-gray-700",
    text: "text-gray-800 dark:text-gray-300",
    iconColor: "text-gray-600 dark:text-gray-400",
  },
}

function SectionHeading({ text }: { text: string }) {
  const type = getSectionType(text)
  const config = sectionConfig[type]
  const Icon = config.icon
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border ${config.bg} ${config.border} mt-6 mb-4 first:mt-0`}>
      <Icon className={`h-5 w-5 ${config.iconColor} shrink-0`} />
      <h2 className={`text-base font-semibold ${config.text} m-0`}>{text}</h2>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QA question component — textarea for student answer + gated reference answer
// ---------------------------------------------------------------------------

interface QaEvalResult {
  score: number
  maxScore: number
  isCorrect: boolean
  feedback: string
  errorAnalysis: string
}

function ScoreRing({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = Math.round((score / maxScore) * 100)
  const r = 20, stroke = 4, c = 2 * Math.PI * r
  const offset = c - (c * pct) / 100
  const color = pct >= 80 ? "text-emerald-500" : pct >= 60 ? "text-blue-500" : pct >= 40 ? "text-amber-500" : "text-red-400"
  return (
    <div className="relative inline-flex items-center justify-center w-14 h-14 shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-secondary" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth={stroke}
          className={color} strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <span className={`absolute text-sm font-bold ${color}`}>{score}</span>
    </div>
  )
}

function QaQuestion({ qa, projectName, knodeId }: {
  qa: ParsedQa
  projectName?: string
  knodeId?: number
}) {
  const [answer, setAnswer] = useState("")
  const [grading, setGrading] = useState(false)
  const [evalResult, setEvalResult] = useState<QaEvalResult | null>(null)
  const [attemptSeq, setAttemptSeq] = useState(1)
  const [showRef, setShowRef] = useState(false)
  const shownAt = useRef(Date.now())

  const handleSubmit = useCallback(async () => {
    if (!answer.trim()) return
    setGrading(true)
    setEvalResult(null)

    if (projectName && knodeId != null) {
      try {
        const resp = await gateway.evaluateQa(projectName, {
          knode_id: knodeId,
          exercise_id: `assignment_qa_${qa.number}`,
          question: qa.question,
          user_answer: answer.trim(),
          reference_answer: qa.referenceAnswer,
          attempt_seq: attemptSeq,
          time_spent_ms: Date.now() - shownAt.current,
        })
        setEvalResult({
          score: resp.score,
          maxScore: resp.max_score,
          isCorrect: resp.is_correct,
          feedback: resp.feedback,
          errorAnalysis: resp.error_analysis,
        })
      } catch {
        setEvalResult({
          score: 0, maxScore: 10, isCorrect: false,
          feedback: "AI 评价服务暂时不可用，请稍后重试。",
          errorAnalysis: "",
        })
      }
    }
    setGrading(false)
  }, [answer, projectName, knodeId, qa, attemptSeq])

  const handleRetry = useCallback(() => {
    setEvalResult(null)
    setAnswer("")
    setAttemptSeq(s => s + 1)
    shownAt.current = Date.now()
  }, [])

  const submitted = evalResult !== null

  return (
    <div className="mt-4 mb-2 pt-3 border-t border-gray-100 dark:border-gray-800 first:border-t-0 first:pt-0">
      {/* Question */}
      <div className="flex items-start gap-2.5 mb-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-200 dark:bg-violet-700 text-violet-700 dark:text-violet-300 text-xs font-bold shrink-0 mt-0.5">
          {qa.number}
        </span>
        <span className="text-sm font-semibold leading-relaxed">{qa.question}</span>
      </div>

      {/* Answer area */}
      <div className="ml-8 space-y-3">
        {!submitted && !grading ? (
          <>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="在这里写下你的答案..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 resize-y"
            />
            <button
              disabled={!answer.trim()}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-3 w-3" /> 提交答案
            </button>
          </>
        ) : grading ? (
          <div className="flex items-center gap-3 py-6 justify-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">AI 正在批改你的答案...</span>
          </div>
        ) : evalResult && (
          <>
            {/* Student answer */}
            <div className="px-3 py-2 rounded-lg bg-secondary/30 border border-border/40">
              <p className="text-[11px] text-muted-foreground font-medium mb-1">我的回答</p>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>

            {/* AI evaluation card */}
            <div className={`rounded-lg border overflow-hidden ${
              evalResult.isCorrect
                ? "border-emerald-200/60 dark:border-emerald-800/40"
                : "border-amber-200/60 dark:border-amber-800/40"
            }`}>
              {/* Score header */}
              <div className={`flex items-center gap-4 px-4 py-3 ${
                evalResult.isCorrect
                  ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                  : "bg-amber-50/60 dark:bg-amber-950/20"
              }`}>
                <ScoreRing score={evalResult.score} maxScore={evalResult.maxScore} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {evalResult.isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 通过
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" /> 需要改进
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {evalResult.score}/{evalResult.maxScore} 分
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{evalResult.feedback}</p>
                </div>
              </div>

              {/* Error analysis */}
              {evalResult.errorAnalysis && (
                <div className="px-4 py-2.5 border-t border-amber-200/40 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/10">
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 mb-0.5">不足之处</p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{evalResult.errorAnalysis}</p>
                </div>
              )}
            </div>

            {/* Retry button (if not correct) */}
            {!evalResult.isCorrect && (
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> 修改后重新提交
              </button>
            )}

            {/* Reference answer toggle — only available after AI grading */}
            {qa.referenceAnswer && (
              <div>
                <button
                  onClick={() => setShowRef(!showRef)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  {showRef ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showRef ? "收起参考答案" : "查看参考答案"}
                </button>
                {showRef && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed my-1">{children}</p>,
                        ul: ({ children }) => <ul className="ml-4 space-y-0.5 list-disc text-sm text-blue-900 dark:text-blue-200">{children}</ul>,
                        li: ({ children }) => <li className="leading-relaxed text-sm">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      }}
                    >
                      {qa.referenceAnswer}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function useNormalComponents(): Components {
  return useMemo<Components>(() => ({
    h2: ({ children }) => <SectionHeading text={String(children ?? "")} />,
    p: ({ children }) => {
      const text = String(children ?? "")
      if (text.includes("[HANDS_ON]")) {
        const parts = text.split("[HANDS_ON]")
        return (
          <p className="my-2 leading-relaxed text-sm">
            {parts.map((part, i) => (
              <span key={i}>
                {i > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-medium mx-1">
                    <Wrench className="h-3 w-3" />
                    动手操作
                  </span>
                )}
                {part}
              </span>
            ))}
          </p>
        )
      }
      return <p className="my-2 leading-relaxed text-sm">{children}</p>
    },
    strong: ({ children }) => <strong>{children}</strong>,
    ul: ({ children }) => (
      <ul className="my-2 ml-4 space-y-1 list-disc text-sm">{children}</ul>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed text-sm">{children}</li>
    ),
  }), [])
}

// ---------------------------------------------------------------------------
// Capstone: block-based structured rendering
// ---------------------------------------------------------------------------

interface CapstoneBlock {
  type: "criteria" | "checklist" | "guide" | "other"
  title: string
  /** Sub-blocks: for criteria these are per-standard cards; for checklist per-artifact */
  cards: { heading: string; body: string }[]
  /** Freeform body if no cards */
  body: string
}

const capstoneMeta: Record<string, {
  icon: typeof Target
  iconBg: string
  iconColor: string
  cardBorder: string
  cardBg: string
}> = {
  criteria: {
    icon: Target,
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    cardBorder: "border-indigo-200/60 dark:border-indigo-800/40",
    cardBg: "bg-indigo-50/30 dark:bg-indigo-950/10",
  },
  checklist: {
    icon: ClipboardCheck,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    cardBorder: "border-emerald-200/60 dark:border-emerald-800/40",
    cardBg: "bg-emerald-50/30 dark:bg-emerald-950/10",
  },
  guide: {
    icon: PenLine,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-600 dark:text-violet-400",
    cardBorder: "border-violet-200/60 dark:border-violet-800/40",
    cardBg: "bg-violet-50/30 dark:bg-violet-950/10",
  },
  other: {
    icon: ListChecks,
    iconBg: "bg-gray-500/10",
    iconColor: "text-gray-600 dark:text-gray-400",
    cardBorder: "border-border/40",
    cardBg: "bg-secondary/20",
  },
}

function classifySection(title: string): CapstoneBlock["type"] {
  if (/考核要点/.test(title)) return "criteria"
  if (/自检清单/.test(title) || /交付物/.test(title)) return "checklist"
  if (/自评/.test(title) || /写作指引/.test(title)) return "guide"
  return "other"
}

/** Parse capstone assignment markdown into structured blocks */
function parseCapstoneBlocks(md: string): CapstoneBlock[] {
  const blocks: CapstoneBlock[] = []
  // Split by h2 (## xxx)
  const sections = md.split(/^## /m).filter(Boolean)

  for (const section of sections) {
    const firstNewline = section.indexOf("\n")
    const title = firstNewline >= 0 ? section.slice(0, firstNewline).trim() : section.trim()
    const body = firstNewline >= 0 ? section.slice(firstNewline + 1).trim() : ""
    const type = classifySection(title)

    if (type === "criteria") {
      // Split by "**标准 N：xxx**" or "---"
      const cards: { heading: string; body: string }[] = []
      const parts = body.split(/(?=\*\*标准\s*\d+[：:])/)
      for (const part of parts) {
        const trimmed = part.replace(/^---\s*\n?/, "").trim()
        if (!trimmed) continue
        const headMatch = trimmed.match(/^\*\*(.+?)\*\*\s*\n?([\s\S]*)/)
        if (headMatch) {
          cards.push({ heading: headMatch[1], body: headMatch[2].trim() })
        } else {
          cards.push({ heading: "", body: trimmed })
        }
      }
      blocks.push({ type, title, cards, body: "" })
    } else if (type === "checklist") {
      // Split by "**交付物：xxx**" or h3 "### 交付物"
      const cards: { heading: string; body: string }[] = []
      const parts = body.split(/(?=\*\*交付物[：:])|(?=### )/)
      for (const part of parts) {
        const trimmed = part.replace(/^---\s*\n?/, "").trim()
        if (!trimmed) continue
        const headMatch = trimmed.match(/^\*\*(.+?)\*\*\s*\n?([\s\S]*)/)
          || trimmed.match(/^###\s+(.+?)\n([\s\S]*)/)
        if (headMatch) {
          cards.push({ heading: headMatch[1], body: headMatch[2].trim() })
        } else {
          cards.push({ heading: "", body: trimmed })
        }
      }
      blocks.push({ type, title, cards, body: "" })
    } else {
      blocks.push({ type, title, cards: [], body })
    }
  }
  return blocks
}

/** Markdown components for rendering card bodies (inline-safe, no div-in-p issues) */
function useCardComponents(): Components {
  return useMemo<Components>(() => ({
    p: ({ children }) => {
      const text = String(children ?? "")
      if (/^问题诊断[：:]/.test(text)) {
        return (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 my-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <span className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">{children}</span>
          </div>
        )
      }
      if (/^优点分析[：:]/.test(text)) {
        return (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 my-2">
            <Lightbulb className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <span className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">{children}</span>
          </div>
        )
      }
      return <div className="my-1.5 leading-relaxed text-sm text-foreground/90">{children}</div>
    },
    strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
    ul: ({ children }) => (
      <ul className="my-1.5 ml-5 space-y-0.5 text-sm list-disc marker:text-muted-foreground/40">{children}</ul>
    ),
    li: ({ children }) => {
      const text = String(children ?? "")
      if (/^\s*\[ \]/.test(text)) {
        return (
          <li className="flex items-start gap-2.5 list-none -ml-5 py-1 px-3 rounded-lg bg-background border border-border/30 my-1">
            <span className="w-4 h-4 mt-0.5 rounded border-2 border-border/60 bg-background shrink-0" />
            <span className="text-sm leading-relaxed text-foreground/90">
              {text.replace(/^\s*\[ \]\s*/, "")}
            </span>
          </li>
        )
      }
      if (/^评判要点[：:]/.test(text)) {
        return (
          <li className="list-none -ml-5 mt-3 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-[var(--font-manrope)] text-primary tracking-wide">
              <Target className="h-3 w-3" />
              {children}
            </span>
          </li>
        )
      }
      if (/^常见扣分原因[：:]/.test(text)) {
        return (
          <li className="list-none -ml-5 mt-3 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-[var(--font-manrope)] text-amber-600 dark:text-amber-400 tracking-wide">
              <AlertTriangle className="h-3 w-3" />
              {children}
            </span>
          </li>
        )
      }
      if (/^满分示例[：:]/.test(text)) {
        return (
          <li className="list-none -ml-5 mt-3 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-[var(--font-manrope)] text-emerald-600 dark:text-emerald-400 tracking-wide">
              <Award className="h-3 w-3" />
              {children}
            </span>
          </li>
        )
      }
      return <li className="leading-relaxed text-sm text-foreground/90">{children}</li>
    },
    h3: ({ children }) => (
      <h3 className="text-sm font-semibold text-foreground mt-4 mb-2 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-primary/60 shrink-0" />
        {children}
      </h3>
    ),
    hr: () => <div className="my-3" />,
    blockquote: ({ children }) => (
      <blockquote className="my-3 px-4 py-3 rounded-xl bg-secondary/30 border-l-[3px] border-primary/40 text-sm text-foreground/80 leading-relaxed [&>div]:my-1">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-secondary/30 border-b border-border/30">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left text-xs font-semibold font-[var(--font-manrope)] text-foreground">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-sm text-foreground/90 border-t border-border/20">{children}</td>
    ),
  }), [])
}

/** Render a criterion card heading like "标准 1：xxx" */
function CriterionHeading({ heading }: { heading: string }) {
  const m = heading.match(/^标准\s*(\d+)[：:](.+)/)
  if (!m) return <span className="text-sm font-semibold text-foreground">{heading}</span>
  return (
    <div className="flex items-start gap-2.5">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary text-[10px] font-bold font-[var(--font-manrope)] shrink-0 mt-0.5">
        {m[1]}
      </span>
      <span className="text-sm font-semibold text-foreground leading-relaxed">{m[2]}</span>
    </div>
  )
}

function CapstoneAssignmentView({ content }: { content: string }) {
  const blocks = useMemo(() => parseCapstoneBlocks(content), [content])
  const cardComponents = useCardComponents()

  return (
    <div className="space-y-6">
      {blocks.map((block, bi) => {
        const meta = capstoneMeta[block.type] || capstoneMeta.other
        const Icon = meta.icon
        return (
          <div key={bi} className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 bg-secondary/20">
              <div className={`h-9 w-9 rounded-xl ${meta.iconBg} border border-border/30 flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${meta.iconColor}`} />
              </div>
              <h2 className="text-[15px] font-bold font-[var(--font-manrope)] text-foreground m-0">
                {block.title}
              </h2>
            </div>

            {/* Cards (criteria / checklist items) */}
            {block.cards.length > 0 ? (
              <div className="divide-y divide-border/30">
                {block.cards.map((card, ci) => (
                  <div key={ci} className="px-5 py-4">
                    {card.heading && (
                      <div className="mb-3">
                        {block.type === "criteria" ? (
                          <CriterionHeading heading={card.heading} />
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border/30">
                            <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-semibold font-[var(--font-manrope)] text-foreground">
                              {card.heading}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <ReactMarkdown components={cardComponents} remarkPlugins={[remarkGfm]}>
                      {card.body}
                    </ReactMarkdown>
                  </div>
                ))}
              </div>
            ) : (
              /* Freeform body */
              <div className="px-5 py-4">
                <ReactMarkdown components={cardComponents} remarkPlugins={[remarkGfm]}>
                  {block.body}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AssignmentView({
  content, knode, progress, projectName, onStatusChange,
}: AssignmentViewProps) {
  const normalComponents = useNormalComponents()

  const isCapstone = knode?.module_role === "capstone"
  const hasContent = content && content.trim()

  const blocks = useMemo(
    () => (hasContent && !isCapstone ? parseAssignment(content) : []),
    [content, hasContent, isCapstone],
  )

  if (!hasContent && !isCapstone) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        暂无大作业内容
      </div>
    )
  }

  return (
    <div className="max-w-none space-y-1">
      {isCapstone ? (
        hasContent && <CapstoneAssignmentView content={content} />
      ) : (
        blocks.map((block, i) => {
          if (block.type === "heading") {
            return <SectionHeading key={i} text={block.heading ?? ""} />
          }
          if (block.type === "choices" && block.choices) {
            return (
              <div key={i}>
                {block.choices.map((q, qi) => (
                  <ChoiceQuestion key={qi} q={q} projectName={projectName} knodeId={knode?.id} />
                ))}
              </div>
            )
          }
          if (block.type === "qa_questions" && block.qaQuestions) {
            return (
              <div key={i}>
                {block.qaQuestions.map((qa, qi) => (
                  <QaQuestion key={qi} qa={qa} projectName={projectName} knodeId={knode?.id} />
                ))}
              </div>
            )
          }
          if (block.type === "markdown" && block.markdown) {
            return (
              <ReactMarkdown key={i} components={normalComponents} remarkPlugins={[remarkGfm]}>
                {block.markdown}
              </ReactMarkdown>
            )
          }
          return null
        })
      )}
      {isCapstone && knode && projectName && (
        <CapstoneSubmissionPanel
          projectName={projectName}
          nodeId={knode.id}
          knode={knode}
          progress={progress ?? null}
          onStatusChange={onStatusChange}
        />
      )}
    </div>
  )
}
