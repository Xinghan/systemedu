"use client"

import { useState, useCallback } from "react"
import { MessageSquare, X, Minus } from "lucide-react"
import { ChatPanel } from "@/components/chat/chat-panel"

interface FloatingChatProps {
  project: string
  agent?: string
  nodeId?: number | null
  activeTab?: string
  pageIndex?: number
}

const AGENTS = [
  { name: "tutor", label: "小龟老师", desc: "AI 导师", color: "bg-emerald-500" },
  { name: "teacher", label: "星星老师", desc: "课堂老师", color: "bg-blue-500" },
  { name: "student", label: "小豆同学", desc: "学习伙伴", color: "bg-amber-500" },
] as const

export function FloatingChat({ project, agent: defaultAgent = "tutor", nodeId, activeTab, pageIndex }: FloatingChatProps) {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [activeAgent, setActiveAgent] = useState(defaultAgent)

  const currentAgent = AGENTS.find((a) => a.name === activeAgent) ?? AGENTS[0]

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
        className="fixed bottom-[52px] right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    )
  }

  if (minimized) {
    return (
      <div className="fixed bottom-[52px] right-6 z-50 flex items-center gap-2">
        <button
          onClick={handleRestore}
          className="flex items-center gap-2 rounded-full bg-secondary text-secondary-foreground px-4 py-2 shadow-lg hover:bg-secondary/80 text-sm font-medium transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          {currentAgent.label}
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
    <div className="fixed bottom-[52px] right-6 z-50 w-[400px] h-[500px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-6rem)] rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden">
      {/* Header with agent selector */}
      <div className="relative z-10 border-b bg-muted/30 shrink-0">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${currentAgent.color}`} />
            <span className="text-sm font-medium">{currentAgent.label}</span>
            <span className="text-xs text-muted-foreground">{currentAgent.desc}</span>
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

        {/* Agent tabs */}
        <div className="flex px-2 pb-1.5 gap-1">
          {AGENTS.map((a) => (
            <button
              key={a.name}
              onClick={() => setActiveAgent(a.name)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeAgent === a.name
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${a.color}`} />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat content */}
      <div className="flex-1 min-h-0">
        <ChatPanel
          project={project}
          agent={activeAgent}
          nodeId={nodeId}
          activeTab={activeTab}
          pageIndex={pageIndex}
        />
      </div>
    </div>
  )
}
