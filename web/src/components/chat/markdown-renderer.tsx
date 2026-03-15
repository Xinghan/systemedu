"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Copy, Check } from "lucide-react"
import { useState, useCallback } from "react"

function CodeBlock({
  children,
  className,
}: {
  children: string
  className?: string
}) {
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
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="bg-muted/30 p-3 rounded-b-md overflow-x-auto text-sm">
        <code>{children}</code>
      </pre>
    </div>
  )
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ children, className, ...props }) {
          const isInline = !className
          if (isInline) {
            return (
              <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            )
          }
          return <CodeBlock className={className}>{String(children).replace(/\n$/, "")}</CodeBlock>
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>
        },
        ul({ children }) {
          return <ul className="list-disc pl-5 mb-2">{children}</ul>
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5 mb-2">{children}</ol>
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground mb-2">
              {children}
            </blockquote>
          )
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto mb-2">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          )
        },
        th({ children }) {
          return <th className="border border-border px-3 py-1 bg-muted font-medium text-left">{children}</th>
        },
        td({ children }) {
          return <td className="border border-border px-3 py-1">{children}</td>
        },
      }}
    />
  )
}
