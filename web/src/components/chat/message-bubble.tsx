"use client"

import { Wrench, Check, Loader2 } from "lucide-react"
import { MarkdownRenderer } from "./markdown-renderer"
import type { ChatMessage, ToolCallInfo } from "@/lib/stores/chat-store"

function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-[0_0_12px_rgba(106,28,246,0.35)] shrink-0">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="currentColor">
        <path d="M12 2L9.09 8.26L2 9.27L7 14.14L5.82 21.02L12 17.77L18.18 21.02L17 14.14L22 9.27L14.91 8.26L12 2Z" />
      </svg>
    </div>
  )
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="max-w-[85%] bg-primary text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-md">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <span className="text-[10px] font-[var(--font-manrope)] text-muted-foreground mr-1">
          Sent {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <AIAvatar />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallBadges toolCalls={message.toolCalls} />
        )}
        <div className="max-w-[95%] bg-primary/5 border border-primary/10 px-4 py-3 rounded-2xl rounded-tl-sm">
          <div className="text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none
            prose-p:my-1 prose-headings:text-foreground prose-code:bg-primary/10 prose-code:text-primary prose-code:px-1 prose-code:rounded">
            <MarkdownRenderer content={message.content} />
          </div>
        </div>
        <span className="text-[10px] font-[var(--font-manrope)] text-muted-foreground ml-1">
          Sanctuary AI · Just now
        </span>
      </div>
    </div>
  )
}

function ToolCallBadges({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-1">
      {toolCalls.map((tc, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[10px] font-[var(--font-manrope)] font-semibold"
        >
          <Wrench className="h-3 w-3" />
          {tc.name}
          <Check className="h-3 w-3 text-emerald-500" />
        </span>
      ))}
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <AIAvatar />
      <div className="bg-primary/5 border border-primary/10 px-4 py-3 rounded-2xl rounded-tl-sm">
        <div className="flex gap-1.5 items-center">
          <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce" />
        </div>
      </div>
    </div>
  )
}

export function ToolCallIndicator({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
  return (
    <div className="flex gap-3">
      <AIAvatar />
      <div className="flex-1 min-w-0">
        <div className="space-y-1">
          {toolCalls.map((tc, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-[var(--font-manrope)] mr-2"
            >
              <Wrench className="h-3 w-3" />
              <span>{tc.name}</span>
              {tc.status === "calling" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3 text-emerald-500" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-3">
      <AIAvatar />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="max-w-[95%] bg-primary/5 border border-primary/10 px-4 py-3 rounded-2xl rounded-tl-sm">
          <div className="text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none
            prose-p:my-1 prose-headings:text-foreground prose-code:bg-primary/10 prose-code:text-primary prose-code:px-1 prose-code:rounded">
            <MarkdownRenderer content={content} />
          </div>
        </div>
        <span className="text-[10px] font-[var(--font-manrope)] text-muted-foreground ml-1">
          Sanctuary AI · Just now
        </span>
      </div>
    </div>
  )
}
