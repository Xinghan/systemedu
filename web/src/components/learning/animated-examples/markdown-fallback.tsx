"use client"

import { AnimateIn } from "./shared-animations"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"

/**
 * Fallback renderer for non-JSON (legacy markdown) examples.
 * Splits content into paragraphs and fades each in sequentially.
 */
export function MarkdownFallback({ content }: { content: string }) {
  if (!content) return null

  // Split by double newlines to get logical blocks
  const blocks = content.split(/\n{2,}/).filter((b) => b.trim())

  if (blocks.length <= 1) {
    return (
      <AnimateIn>
        <MarkdownRenderer content={content} />
      </AnimateIn>
    )
  }

  return (
    <div className="space-y-1">
      {blocks.map((block, i) => (
        <AnimateIn key={i} delay={i * 120}>
          <MarkdownRenderer content={block} />
        </AnimateIn>
      ))}
    </div>
  )
}
