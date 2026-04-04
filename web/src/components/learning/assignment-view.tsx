"use client"

import { useState, useMemo, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import { Wrench, CheckCircle2, ListChecks, MessageSquareText, ChevronDown, ChevronUp } from "lucide-react"

interface AssignmentViewProps {
  content: string
}

/**
 * Preprocess LLM-generated assignment markdown:
 * 1. Split inline options (A. xxx B. xxx C. xxx D. xxx) into separate lines
 * 2. Ensure answer lines have preceding blank line
 * 3. Preserve [HANDS_ON] markers
 */
function preprocessContent(raw: string): string {
  let text = raw

  // Split inline options: "A. xxx B. xxx C. xxx D. xxx" -> each on its own line
  // Match lines that contain multiple options on a single line
  text = text.replace(
    /^([^\n]*?)([A-D])\.\s+(.+?)\s+([A-D])\.\s+(.+?)\s+([A-D])\.\s+(.+?)\s+([A-D])\.\s+(.+?)$/gm,
    (_match, prefix, a1, t1, a2, t2, a3, t3, a4, t4) => {
      const lines = [
        prefix.trim() ? prefix.trim() : null,
        `${a1}. ${t1.trim()}`,
        `${a2}. ${t2.trim()}`,
        `${a3}. ${t3.trim()}`,
        `${a4}. ${t4.trim()}`,
      ].filter(Boolean)
      return lines.join("\n")
    }
  )

  // Also handle partial inline (e.g., only 2-3 options on one line)
  // Pattern: line starts with A. and contains B. on the same line
  text = text.replace(
    /^(\s*)([A-D])\.\s+(.+?)\s{2,}([A-D])\.\s+(.+?)$/gm,
    (_match, indent, a1, t1, a2, t2) => {
      return `${indent}${a1}. ${t1.trim()}\n${indent}${a2}. ${t2.trim()}`
    }
  )

  // Ensure "**答案：X**" or "答案：X" has a blank line before it
  text = text.replace(/\n(?!\n)((?:\*\*)?答案[：:].+)/g, "\n\n$1")

  // Ensure "参考答案要点：" has a blank line before it
  text = text.replace(/\n(?!\n)((?:\*\*)?参考答案要点[：:].+)/g, "\n\n$1")

  return text
}

/** Detect section type from h2 text */
function getSectionType(text: string): "choice" | "qa" | "hands_on" | "other" {
  if (/选择题/.test(text)) return "choice"
  if (/问答题/.test(text)) return "qa"
  if (/动手/.test(text)) return "hands_on"
  return "other"
}

/** Section header config */
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

/** Collapsible answer block for QA reference answers */
function CollapsibleAnswer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? "收起参考答案" : "展开参考答案"}
      </button>
      {open && (
        <div className="mt-2 px-3 py-2 rounded-md bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-sm text-blue-900 dark:text-blue-200">
          {children}
        </div>
      )}
    </div>
  )
}

/** Check if text is an option line like "A. xxx" */
function parseOptionLine(text: string): { letter: string; content: string } | null {
  const m = text.match(/^([A-D])\.\s+(.+)/)
  if (m) return { letter: m[1], content: m[2] }
  return null
}

/** Render a single option as a card */
function OptionCard({ letter, content }: { letter: string; content: string }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0 mt-0.5">
        {letter}
      </span>
      <span className="text-sm leading-relaxed">{content}</span>
    </div>
  )
}

/** Build custom ReactMarkdown components */
function useMarkdownComponents(): Components {
  return useMemo<Components>(() => ({
    h2: ({ children }) => {
      const text = String(children ?? "")
      const type = getSectionType(text)
      const config = sectionConfig[type]
      const Icon = config.icon

      return (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border ${config.bg} ${config.border} mt-6 mb-4 first:mt-0`}>
          <Icon className={`h-5 w-5 ${config.iconColor} shrink-0`} />
          <h2 className={`text-base font-semibold ${config.text} m-0`}>
            {children}
          </h2>
        </div>
      )
    },

    p: ({ children }) => {
      const text = String(children ?? "")

      // Answer line: "答案：X" or "**答案：X**"
      const answerMatch = text.match(/^(?:\*\*)?答案[：:](.+?)(?:\*\*)?$/)
      if (answerMatch) {
        return (
          <div className="flex items-center gap-2 my-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              答案：{answerMatch[1].trim()}
            </span>
          </div>
        )
      }

      // Reference answer: "参考答案要点：xxx"
      if (/^(?:\*\*)?参考答案要点[：:]/.test(text)) {
        const answerText = text.replace(/^(?:\*\*)?参考答案要点[：:]\s*(?:\*\*)?/, "")
        return (
          <CollapsibleAnswer>
            {answerText}
          </CollapsibleAnswer>
        )
      }

      // Option line: "A. xxx"
      const option = parseOptionLine(text)
      if (option) {
        return <OptionCard letter={option.letter} content={option.content} />
      }

      // [HANDS_ON] marker
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

      // Question number: "1. 题目内容"
      const questionMatch = text.match(/^(\d+)\.\s+(.+)/)
      if (questionMatch) {
        return (
          <div className="flex items-start gap-2.5 mt-4 mb-2 pt-3 border-t border-gray-100 dark:border-gray-800 first:border-t-0 first:pt-0">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold shrink-0 mt-0.5">
              {questionMatch[1]}
            </span>
            <span className="text-sm font-semibold leading-relaxed">{questionMatch[2]}</span>
          </div>
        )
      }

      // Answer in bold: "答案：X"
      const answerMatch = text.match(/^答案[：:](.+)/)
      if (answerMatch) {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            答案：{answerMatch[1].trim()}
          </span>
        )
      }

      // Reference answer in bold
      if (/^参考答案要点[：:]/.test(text)) {
        const answerText = text.replace(/^参考答案要点[：:]\s*/, "")
        return (
          <CollapsibleAnswer>
            {answerText}
          </CollapsibleAnswer>
        )
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

export function AssignmentView({ content }: AssignmentViewProps) {
  const components = useMarkdownComponents()

  if (!content || !content.trim()) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        暂无大作业内容
      </div>
    )
  }

  const processed = preprocessContent(content)

  return (
    <div className="max-w-none space-y-1">
      <ReactMarkdown components={components}>
        {processed}
      </ReactMarkdown>
    </div>
  )
}
