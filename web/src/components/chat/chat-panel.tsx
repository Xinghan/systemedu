"use client"

import { useEffect, useRef } from "react"
import { Bot } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChatStore } from "@/lib/stores/chat-store"
import { useWebSocketChat } from "@/lib/hooks/use-websocket-chat"
import { gateway } from "@/lib/api"
import { ChatInput } from "./chat-input"
import { MessageBubble, StreamingBubble, ToolCallIndicator, TypingIndicator } from "./message-bubble"

interface ChatPanelProps {
  project?: string
  agent?: string
  nodeId?: number | null
  activeTab?: string
  pageIndex?: number
}

export function ChatPanel({ project, agent, nodeId, activeTab, pageIndex }: ChatPanelProps) {
  const { sessions, activeSessionId, streaming, streamContent, streamToolCalls, hydrated, hydrateSessions } = useChatStore()
  const { connect, sendMessage, disconnect } = useWebSocketChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const connectRef = useRef(connect)
  const disconnectRef = useRef(disconnect)
  connectRef.current = connect
  disconnectRef.current = disconnect

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  // Hydrate sessions from backend on first mount
  useEffect(() => {
    if (hydrated) return
    gateway.sessionsFull().then((fullSessions) => {
      const mapped = fullSessions.map((s) => ({
        id: s.id,
        agent: s.agent || undefined,
        project: s.project || undefined,
        messages: s.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: crypto.randomUUID(),
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.timestamp),
          })),
        createdAt: new Date(s.created_at),
      }))
      hydrateSessions(mapped)
    }).catch(() => {
      // Gateway not available — continue with empty state
      hydrateSessions([])
    })
  }, [hydrated, hydrateSessions])

  // Connect WebSocket once on mount, disconnect on unmount
  useEffect(() => {
    connectRef.current()
    return () => disconnectRef.current()
  }, [])

  // Auto-scroll within the container only (not the page)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [activeSession?.messages.length, streamContent])

  const handleSend = (message: string) => {
    sendMessage(message, {
      project,
      agent,
      node_id: nodeId ?? undefined,
      active_tab: activeTab,
      page_index: pageIndex,
    })
  }

  const hasMessages = (activeSession?.messages.length ?? 0) > 0 || streaming

  return (
    <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 min-h-0">
        {!hasMessages ? (
          /* Empty state — centered like ChatGPT */
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <Bot className="h-6 w-6" />
            </div>
            <p className="text-lg font-medium">开始对话</p>
            <p className="text-sm mt-1">输入你的问题，AI 助手会为你解答</p>
          </div>
        ) : (
          /* Messages — centered with max-width */
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
            {activeSession?.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {streaming && streamToolCalls.length > 0 && (
              <ToolCallIndicator toolCalls={streamToolCalls} />
            )}
            {streaming && streamContent && (
              <StreamingBubble content={streamContent} />
            )}
            {streaming && !streamContent && streamToolCalls.length === 0 && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input — centered at bottom, never hidden */}
      <div className="max-w-3xl mx-auto w-full shrink-0">
        <ChatInput onSend={handleSend} disabled={streaming} />
      </div>
    </div>
  )
}
