"use client"

import ReactMarkdown from "react-markdown"
import { Wrench } from "lucide-react"

interface AssignmentViewProps {
  content: string
}

function preprocessContent(content: string): string {
  // Replace [HANDS_ON] markers with a special HTML comment we can detect
  return content.replace(/\[HANDS_ON\]/g, "\n\n<!--HANDS_ON_MARKER-->\n\n")
}

export function AssignmentView({ content }: AssignmentViewProps) {
  if (!content || !content.trim()) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        暂无大作业内容
      </div>
    )
  }

  // Split content on [HANDS_ON] marker to render inline wrench badges
  const segments = content.split(/\[HANDS_ON\]/)

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {segments.map((segment, index) => (
        <span key={index}>
          {index > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-medium mr-1 mb-1">
              <Wrench className="h-3 w-3" />
              动手操作
            </span>
          )}
          <ReactMarkdown>{segment}</ReactMarkdown>
        </span>
      ))}
    </div>
  )
}
