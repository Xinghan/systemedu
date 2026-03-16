"use client"

import { useState, useCallback } from "react"
import { MessageSquare, X, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatPanel } from "@/components/chat/chat-panel"

interface FloatingChatProps {
  project: string
  agent?: string
  nodeId?: number | null
  activeTab?: string
  pageIndex?: number
}

export function FloatingChat({ project, agent = "tutor", nodeId, activeTab, pageIndex }: FloatingChatProps) {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(false)
    setMinimized(false)
  }, [])

  const handleMinimize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setMinimized(true)
  }, [])

  const handleRestore = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setMinimized(false)
  }, [])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    )
  }

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={handleRestore}
          className="flex items-center gap-2 rounded-full bg-secondary text-secondary-foreground px-4 py-2 shadow-lg hover:bg-secondary/80 text-sm font-medium transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          AI 导师
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[500px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-6rem)] rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden">
      {/* Header — high z-index, always clickable */}
      <div className="relative z-10 flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI 导师</span>
        </div>
        <div className="flex items-center">
          <button
            onClick={handleMinimize}
            className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat content */}
      <div className="flex-1 min-h-0">
        <ChatPanel project={project} agent={agent} nodeId={nodeId} activeTab={activeTab} pageIndex={pageIndex} />
      </div>
    </div>
  )
}
