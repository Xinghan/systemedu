"use client"

import { Wrench, Check, Loader2 } from "lucide-react"
import { MarkdownRenderer } from "./markdown-renderer"
import type { ChatMessage, ToolCallInfo } from "@/lib/stores/chat-store"

// AI avatar — Industrial Atelier coral (var(--primary) #D97757)
function AIAvatar() {
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: "linear-gradient(135deg, var(--primary), var(--primary-ink))",
        color: "#fff",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M17.5 3C16.12 3 15 4.12 15 5.5v1H9v-1C9 4.12 7.88 3 6.5 3S4 4.12 4 5.5 5.12 8 6.5 8H7v1c0 1.66 1.34 3 3 3h1v2.09c-2.83.48-5 2.94-5 5.91h2c0-2.21 1.79-4 4-4s4 1.79 4 4h2c0-2.97-2.17-5.43-5-5.91V12h1c1.66 0 3-1.34 3-3V8h.5c1.38 0 2.5-1.12 2.5-2.5S18.88 3 17.5 3zM6.5 6C5.67 6 5 5.33 5 4.5S5.67 3 6.5 3 8 3.67 8 4.5 7.33 6 6.5 6zm11 0c-.83 0-1.5-.67-1.5-1.5S16.67 3 17.5 3 19 3.67 19 4.5 18.33 6 17.5 6z" />
      </svg>
    </div>
  )
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-2">
        {/* Purple bubble, right-aligned, no top-right radius */}
        <div className="bg-primary text-white px-6 py-4 rounded-2xl rounded-tr-none max-w-[85%] shadow-lg shadow-primary/10">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-2 font-[var(--font-manrope)]">
          你 · {formatTime(message.timestamp)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {/* AI label row */}
      <div className="flex items-center gap-3">
        <AIAvatar />
        <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest font-[var(--font-manrope)]">
          AI 导师
        </span>
      </div>

      {/* Tool calls badges */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="ml-11">
          <ToolCallBadges toolCalls={message.toolCalls} />
        </div>
      )}

      {/* AI response bubble: warm cream paper-2, no top-left radius */}
      <div
        className="ml-11 px-8 py-6 rounded-3xl rounded-tl-none max-w-[95%] shadow-sm dark:bg-primary/10"
        style={{ background: "var(--paper-2)" }}
      >
        <div className="text-[15px] text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none
          prose-p:my-2 prose-p:leading-relaxed
          prose-headings:text-primary prose-headings:font-bold prose-headings:font-[var(--font-manrope)]
          prose-strong:text-foreground prose-strong:font-bold
          prose-code:bg-primary/10 prose-code:text-primary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-[#0a051a] prose-pre:rounded-xl prose-pre:p-4 prose-pre:overflow-x-auto
          prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground prose-blockquote:not-italic
          prose-li:my-1
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
          <MarkdownRenderer content={message.content} />
        </div>
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
          <Check className="h-3 w-3 text-cyan-500" />
        </span>
      ))}
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-3">
        <AIAvatar />
        <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest font-[var(--font-manrope)]">
          AI 导师
        </span>
      </div>
      <div
        className="ml-11 px-6 py-4 rounded-3xl rounded-tl-none shadow-sm dark:bg-primary/10"
        style={{ background: "var(--paper-2)" }}
      >
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
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-3">
        <AIAvatar />
        <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest font-[var(--font-manrope)]">
          AI 导师
        </span>
      </div>
      <div className="ml-11 flex flex-wrap gap-2">
        {toolCalls.map((tc, i) => (
          <div
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-[var(--font-manrope)] font-semibold"
          >
            <Wrench className="h-3 w-3" />
            <span>{tc.name}</span>
            {tc.status === "calling" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3 text-cyan-500" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-3">
        <AIAvatar />
        <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest font-[var(--font-manrope)]">
          AI 导师
        </span>
      </div>
      <div
        className="ml-11 px-8 py-6 rounded-3xl rounded-tl-none max-w-[95%] shadow-sm dark:bg-primary/10"
        style={{ background: "var(--paper-2)" }}
      >
        <div className="text-[15px] text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none
          prose-p:my-2 prose-headings:text-primary prose-headings:font-bold
          prose-code:bg-primary/10 prose-code:text-primary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-[#0a051a] prose-pre:rounded-xl prose-pre:p-4">
          <MarkdownRenderer content={content} />
        </div>
      </div>
    </div>
  )
}
