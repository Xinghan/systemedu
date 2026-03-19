"use client"

import { Bot, User, Wrench, Check, Loader2 } from "lucide-react"
import { MarkdownRenderer } from "./markdown-renderer"
import type { ChatMessage, ToolCallInfo } from "@/lib/stores/chat-store"

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className="flex gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs font-medium text-muted-foreground mb-1">
          {isUser ? "你" : "AI 助手"}
        </p>
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallBadges toolCalls={message.toolCalls} />
        )}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose-sm dark:prose-invert">
            <MarkdownRenderer content={message.content} />
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallBadges({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {toolCalls.map((tc, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
        >
          <Wrench className="h-3 w-3" />
          {tc.name}
          <Check className="h-3 w-3 text-green-500" />
        </span>
      ))}
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4" />
      </div>
      <div className="pt-0.5">
        <p className="text-xs font-medium text-muted-foreground mb-1">AI 助手</p>
        <div className="flex gap-1 py-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" />
        </div>
      </div>
    </div>
  )
}

export function ToolCallIndicator({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs font-medium text-muted-foreground mb-1">AI 助手</p>
        <div className="space-y-1">
          {toolCalls.map((tc, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground mr-2"
            >
              <Wrench className="h-3 w-3" />
              <span>正在调用 {tc.name}</span>
              {tc.status === "calling" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3 text-green-500" />
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs font-medium text-muted-foreground mb-1">AI 助手</p>
        <div className="text-sm prose-sm dark:prose-invert">
          <MarkdownRenderer content={content} />
        </div>
      </div>
    </div>
  )
}
