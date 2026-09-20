"use client"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"
import {
  Wrench, ListChecks, MessageSquareText,
  Target, ClipboardCheck, PenLine,
  AlertTriangle, Lightbulb, Award, PackageCheck, ArrowRight,
} from "lucide-react"

import type { KnodeInfo, NodeProgress } from "@/lib/types/api"
import { PersistentQuestion } from "./persistent-question"
import { CapstoneSubmissionPanel } from "./capstone-submission-panel"
import { parseCapstoneBlocks } from "./capstone-assignment.mjs"
import { useT } from "@/lib/i18n/use-t"

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
// Assignment section rendering
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

function childrenToText(children: React.ReactNode): string {
  if (children == null) return ""
  if (typeof children === "string") return children
  if (typeof children === "number") return String(children)
  if (Array.isArray(children)) return children.map(childrenToText).join("")
  if (typeof children === "object" && "props" in children) {
    return childrenToText((children as React.ReactElement<{ children?: React.ReactNode }>).props.children)
  }
  return ""
}

function useNormalComponents(): Components {
  return useMemo<Components>(() => ({
    h2: ({ children }) => <SectionHeading text={childrenToText(children)} />,
    p: ({ children }) => <p className="my-2 leading-relaxed text-sm">{children}</p>,
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
  stage_product: {
    icon: PackageCheck,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-700 dark:text-amber-300",
    cardBorder: "border-amber-200/60 dark:border-amber-800/40",
    cardBg: "bg-amber-50/30 dark:bg-amber-950/10",
  },
  artifacts: {
    icon: PackageCheck,
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-700 dark:text-sky-300",
    cardBorder: "border-sky-200/60 dark:border-sky-800/40",
    cardBg: "bg-sky-50/30 dark:bg-sky-950/10",
  },
  self_check: {
    icon: ClipboardCheck,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    cardBorder: "border-emerald-200/60 dark:border-emerald-800/40",
    cardBg: "bg-emerald-50/30 dark:bg-emerald-950/10",
  },
  handoff: {
    icon: ArrowRight,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-700 dark:text-blue-300",
    cardBorder: "border-blue-200/60 dark:border-blue-800/40",
    cardBg: "bg-blue-50/30 dark:bg-blue-950/10",
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
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${meta.cardBg} ${meta.cardBorder}`}>
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
  const t = useT()
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
        {t("assignment.no_content")}
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
                  <PersistentQuestion key={qi} projectName={projectName || ""} moduleId={knode?.module_id} activityId={`assignment_choice_${q.number}`} question={q.question} options={q.options.map(o => ({ value: o.letter, label: `${o.letter}. ${o.content}` }))} correctAnswer={q.answer} explanation={q.explanation} />
                ))}
              </div>
            )
          }
          if (block.type === "qa_questions" && block.qaQuestions) {
            return (
              <div key={i}>
                {block.qaQuestions.map((qa, qi) => (
                  <PersistentQuestion key={qi} projectName={projectName || ""} moduleId={knode?.module_id} activityId={`assignment_qa_${qa.number}`} question={qa.question} referenceAnswer={qa.referenceAnswer} />
                ))}
              </div>
            )
          }
          if (block.type === "markdown" && block.markdown) {
            return (
              <ReactMarkdown key={i} components={normalComponents} remarkPlugins={[remarkGfm]}>
                {block.markdown.replace(/\[HANDS_ON\]\s*/g, "")}
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
