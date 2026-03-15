"use client"

import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatPanel } from "@/components/chat/chat-panel"
import { useChatStore } from "@/lib/stores/chat-store"

export default function ChatPage() {
  const { sessions, activeSessionId, setActiveSession } = useChatStore()

  const newSession = () => {
    setActiveSession(null)
  }

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <div className="w-64 border-r flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="font-semibold">聊天</h2>
          <Button variant="ghost" size="icon" onClick={newSession}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSession(s.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  s.id === activeSessionId
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <div className="truncate">
                  {s.messages[0]?.content.slice(0, 30) || "新会话"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.agent ?? "默认"} · {s.messages.length} 条消息
                </div>
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无会话
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1">
        <ChatPanel />
      </div>
    </div>
  )
}
