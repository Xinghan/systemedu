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
  const { sessions, activeSessionId, streaming, streamContent, streamToolCalls, hydrated, hydrateSessions, setActiveSession, addSession } = useChatStore()
  const { connect, sendMessage, disconnect } = useWebSocketChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const connectRef = useRef(connect)
  const disconnectRef = useRef(disconnect)
  connectRef.current = connect
  disconnectRef.current = disconnect

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  // Switch to the session for the current agent (or create one if needed)
  const prevAgentRef = useRef(agent)
  useEffect(() => {
    if (agent && agent !== prevAgentRef.current) {
      prevAgentRef.current = agent
      // Look for existing session with this agent+project combo
      const existing = sessions.find(
        (s) => s.agent === agent && s.project === project
      )
      if (existing) {
        setActiveSession(existing.id)
      } else {
        // Create a new local session for this agent
        const newId = crypto.randomUUID()
        addSession({
          id: newId,
          agent,
          project,
          messages: [],
          createdAt: new Date(),
        })
        setActiveSession(newId)
      }
    }
  }, [agent, project, sessions, setActiveSession, addSession])

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
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-8">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(106,28,246,0.3)]">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <p className="text-base font-bold text-foreground mb-1">Start a conversation</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {agent === "student"
                ? "Discuss and learn together"
                : agent === "teacher"
                  ? "Ask your teacher to explain any concept"
                  : "Ask me anything about this lesson. I'm here to help you understand every concept deeply."}
            </p>
          </div>
        ) : (
          /* Messages */
          <div className="px-6 py-6 space-y-6">
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
