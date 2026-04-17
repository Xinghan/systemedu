"use client"

import { useState, useMemo, useCallback, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"
import {
  Wrench, CheckCircle2, ListChecks, MessageSquareText,
  ChevronDown, ChevronUp, Target, ClipboardCheck, PenLine,
  AlertTriangle, Lightbulb, Award, XCircle,
} from "lucide-react"

import type { KnodeInfo, NodeProgress } from "@/lib/types/api"
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

interface ParsedBlock {
  type: "heading" | "choices" | "markdown"
  heading?: string
  headingKind?: "choice" | "qa" | "hands_on" | "other"
  choices?: ParsedChoice[]
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

function ChoiceQuestion({ q }: { q: ParsedChoice }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = useCallback(() => {
    if (selected) setSubmitted(true)
  }, [selected])

  const isCorrect = submitted && selected === q.answer

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

function CollapsibleAnswer({ children, label }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  const showLabel = label ?? "参考答案"
  return (
    <span className="block mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? `收起${showLabel}` : `查看${showLabel}`}
      </button>
      {open && (
        <span className="block mt-2 px-3 py-2 rounded-md bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-sm text-blue-900 dark:text-blue-200">
          {children}
        </span>
      )}
    </span>
  )
}

function useNormalComponents(): Components {
  return useMemo<Components>(() => ({
    h2: ({ children }) => <SectionHeading text={String(children ?? "")} />,
    p: ({ children }) => {
      const text = String(children ?? "")
      if (/^(?:\*\*)?参考答案要点[：:]/.test(text)) {
        const answerText = text.replace(/^(?:\*\*)?参考答案要点[：:]\s*(?:\*\*)?/, "")
        return <CollapsibleAnswer>{answerText}</CollapsibleAnswer>
      }
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
    strong: ({ children }) => {
      const text = String(children ?? "")
      const questionMatch = text.match(/^(\d+)\.\s+(.+)/)
      if (questionMatch) {
        return (
          <span className="inline-flex items-start gap-2.5 w-full mt-4 mb-2 pt-3 border-t border-gray-100 dark:border-gray-800 first:border-t-0 first:pt-0">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold shrink-0 mt-0.5">
              {questionMatch[1]}
            </span>
            <span className="text-sm font-semibold leading-relaxed">{questionMatch[2]}</span>
          </span>
        )
      }
      if (/^参考答案要点[：:]/.test(text)) {
        const answerText = text.replace(/^参考答案要点[：:]\s*/, "")
        return <CollapsibleAnswer>{answerText}</CollapsibleAnswer>
      }
      return <strong>{children}</strong>
    },
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
                  <ChoiceQuestion key={qi} q={q} />
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
