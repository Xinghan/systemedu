"use client"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Copy, Check } from "lucide-react"
import { useState, useCallback, useRef } from "react"
import type { HighlightInfo } from "@/lib/types/api"

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const language = className?.replace("language-", "") ?? ""
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [children])

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-1 rounded-t-md text-xs text-muted-foreground">
        <span>{language}</span>
        <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="bg-muted/30 p-3 rounded-b-md overflow-x-auto text-sm">
        <code>{children}</code>
      </pre>
    </div>
  )
}

interface HighlightMark {
  id: number
  text: string
  note: string
  color: string
}

interface HighlightedMarkdownProps {
  content: string
  highlights: HighlightMark[]
  onDeleteHighlight: (id: number) => void
}

/**
 * Renders markdown with text highlights applied.
 * Uses React-based text node wrapping inside markdown components.
 */
export function HighlightedMarkdown({ content, highlights, onDeleteHighlight }: HighlightedMarkdownProps) {
  if (!content) return null

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ children, className, ...props }) {
          const isInline = !className
          if (isInline) {
            return <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>{children}</code>
          }
          return <CodeBlock className={className}>{String(children).replace(/\n$/, "")}</CodeBlock>
        },
        h1({ children }) {
          return <h1 className="text-2xl font-bold mb-3"><HighlightTextChildren highlights={highlights} onDelete={onDeleteHighlight}>{children}</HighlightTextChildren></h1>
        },
        h2({ children }) {
          return <h2 className="text-xl font-bold mb-2"><HighlightTextChildren highlights={highlights} onDelete={onDeleteHighlight}>{children}</HighlightTextChildren></h2>
        },
        h3({ children }) {
          return <h3 className="text-lg font-semibold mb-2"><HighlightTextChildren highlights={highlights} onDelete={onDeleteHighlight}>{children}</HighlightTextChildren></h3>
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0"><HighlightTextChildren highlights={highlights} onDelete={onDeleteHighlight}>{children}</HighlightTextChildren></p>
        },
        li({ children }) {
          return <li><HighlightTextChildren highlights={highlights} onDelete={onDeleteHighlight}>{children}</HighlightTextChildren></li>
        },
        strong({ children }) {
          return <strong><HighlightTextChildren highlights={highlights} onDelete={onDeleteHighlight}>{children}</HighlightTextChildren></strong>
        },
        em({ children }) {
          return <em><HighlightTextChildren highlights={highlights} onDelete={onDeleteHighlight}>{children}</HighlightTextChildren></em>
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 mb-2">{children}</ul>
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 mb-2">{children}</ol>
        },
        blockquote({ children }) {
          return <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground mb-2">{children}</blockquote>
        },
        table({ children }) {
          return <div className="overflow-x-auto mb-2"><table className="w-full border-collapse text-sm">{children}</table></div>
        },
        th({ children }) {
          return <th className="border border-border px-3 py-1 bg-muted font-medium text-left">{children}</th>
        },
        td({ children }) {
          return <td className="border border-border px-3 py-1">{children}</td>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

/**
 * Processes children of a React node, finding text strings that match
 * highlight text and wrapping them with <mark> elements.
 */
function HighlightTextChildren({
  children,
  highlights,
  onDelete,
}: {
  children: React.ReactNode
  highlights: HighlightMark[]
  onDelete: (id: number) => void
}) {
  if (!highlights.length) return <>{children}</>

  return (
    <>
      {processChildren(children, highlights, onDelete)}
    </>
  )
}

function processChildren(
  children: React.ReactNode,
  highlights: HighlightMark[],
  onDelete: (id: number) => void,
): React.ReactNode {
  if (!children) return children

  // Handle arrays of children
  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <span key={i}>{processChildren(child, highlights, onDelete)}</span>
    ))
  }

  // Only process string children
  if (typeof children !== "string") return children

  return highlightText(children, highlights, onDelete)
}

/**
 * Given a text string and highlight marks, returns JSX with
 * matching substrings wrapped in <mark> elements.
 */
function highlightText(
  text: string,
  highlights: HighlightMark[],
  onDelete: (id: number) => void,
): React.ReactNode {
  if (!text || !highlights.length) return text

  // Build a list of match ranges
  interface Match {
    start: number
    end: number
    highlight: HighlightMark
  }

  const matches: Match[] = []
  for (const hl of highlights) {
    if (!hl.text) continue
    let searchFrom = 0
    // Find all occurrences of the highlight text
    while (searchFrom < text.length) {
      const idx = text.indexOf(hl.text, searchFrom)
      if (idx === -1) break
      matches.push({ start: idx, end: idx + hl.text.length, highlight: hl })
      searchFrom = idx + hl.text.length
    }
  }

  if (matches.length === 0) return text

  // Sort by position, deduplicate overlaps (first match wins)
  matches.sort((a, b) => a.start - b.start)
  const merged: Match[] = []
  for (const m of matches) {
    if (merged.length > 0 && m.start < merged[merged.length - 1].end) continue
    merged.push(m)
  }

  // Build result fragments
  const result: React.ReactNode[] = []
  let cursor = 0
  for (const m of merged) {
    if (m.start > cursor) {
      result.push(text.slice(cursor, m.start))
    }
    result.push(
      <HighlightSpan key={`hl-${m.highlight.id}-${m.start}`} highlight={m.highlight} onDelete={onDelete} />
    )
    cursor = m.end
  }
  if (cursor < text.length) {
    result.push(text.slice(cursor))
  }

  return <>{result}</>
}

/** A single highlighted span with click-to-manage popover */
function HighlightSpan({
  highlight,
  onDelete,
}: {
  highlight: HighlightMark
  onDelete: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const markRef = useRef<HTMLElement>(null)
  const [openUp, setOpenUp] = useState(false)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && markRef.current) {
      const rect = markRef.current.getBoundingClientRect()
      // Open upward if less than 200px from viewport bottom
      setOpenUp(window.innerHeight - rect.bottom < 200)
    }
    setOpen(!open)
  }, [open])

  return (
    <span className="relative inline">
      <mark
        ref={markRef}
        className="bg-yellow-200/80 dark:bg-yellow-500/40 rounded-sm cursor-pointer border-b border-yellow-400/50 transition-colors hover:bg-yellow-300/80 dark:hover:bg-yellow-500/60"
        onClick={handleClick}
        title={highlight.note || "点击管理高亮"}
      >
        {highlight.text}
      </mark>
      {highlight.note && !open && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 ml-0.5 align-super" title="有批注" />
      )}
      {open && (
        <span
          className={`absolute left-0 z-[100] bg-popover border rounded-lg shadow-lg p-2.5 min-w-[180px] max-w-[300px] ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {highlight.note && (
            <span className="block text-xs text-foreground mb-2 whitespace-pre-wrap leading-relaxed bg-muted/50 rounded p-1.5">
              {highlight.note}
            </span>
          )}
          <span className="flex items-center justify-between gap-2">
            <button
              onClick={() => { onDelete(highlight.id); setOpen(false) }}
              className="text-xs text-destructive hover:underline"
            >
              删除高亮
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:underline"
            >
              关闭
            </button>
          </span>
        </span>
      )}
    </span>
  )
}
