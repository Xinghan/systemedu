"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChatStore } from "@/lib/stores/chat-store"
import { useWebSocketChat } from "@/lib/hooks/use-websocket-chat"
import { ChatInput } from "./chat-input"
import { MessageBubble, StreamingBubble, TypingIndicator } from "./message-bubble"

interface ChatPanelProps {
  project?: string
  agent?: string
}

export function ChatPanel({ project, agent }: ChatPanelProps) {
  const { sessions, activeSessionId, streaming, streamContent } = useChatStore()
  const { connect, sendMessage, disconnect } = useWebSocketChat()
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeSession?.messages.length, streamContent])

  const handleSend = (message: string) => {
    sendMessage(message, { project, agent })
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {!activeSession?.messages.length && !streaming && (
            <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">开始对话</p>
                <p className="text-sm">输入你的问题，AI 助手会为你解答</p>
              </div>
            </div>
          )}
          {activeSession?.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {streaming && streamContent && (
            <StreamingBubble content={streamContent} />
          )}
          {streaming && !streamContent && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <ChatInput onSend={handleSend} disabled={streaming} />
    </div>
  )
}
