"use client"

import { useEffect, useRef } from "react"
import { useChatStore } from "@/lib/stores/chat-store"
import { useWebSocketChat } from "@/lib/hooks/use-websocket-chat"
import { gateway } from "@/lib/api"
import { useT } from "@/lib/hooks/use-t"
import { randomUUID } from "@/lib/utils/uuid"
import { ChatInput } from "./chat-input"
import { MessageBubble, StreamingBubble, ToolCallIndicator, TypingIndicator } from "./message-bubble"

interface ChatPanelProps {
  project?: string
  agent?: string
  nodeId?: number | null
  activeTab?: string
  pageIndex?: number
}

// Quick prompt cards shown in the welcome state
const QUICK_PROMPTS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    titleKey: "chat.quick_progress_title",
    descKey: "chat.quick_progress_desc",
    titleFallback: "总结我的进度",
    descFallback: "获取近期学习里程碑的简洁报告。",
    prompt: "帮我总结一下最近的学习进度",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    titleKey: "chat.quick_explain_title",
    descKey: "chat.quick_explain_desc",
    titleFallback: "解释一个概念",
    descFallback: "将复杂理论分解为简单易懂的模块。",
    prompt: "请帮我解释一个学习概念",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    titleKey: "chat.quick_build_title",
    descKey: "chat.quick_build_desc",
    titleFallback: "帮我搭建项目",
    descFallback: "起草带有技术规范的项目计划。",
    prompt: "帮我规划一个学习项目的大纲",
  },
]

export function ChatPanel({ project, agent, nodeId, activeTab, pageIndex }: ChatPanelProps) {
  const t = useT()
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
      const existing = sessions.find((s) => s.agent === agent && s.project === project)
      if (existing) {
        setActiveSession(existing.id)
      } else {
        const newId = randomUUID()
        addSession({ id: newId, agent, project, messages: [], createdAt: new Date() })
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
            id: randomUUID(),
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.timestamp),
          })),
        createdAt: new Date(s.created_at),
      }))
      hydrateSessions(mapped)
    }).catch(() => {
      hydrateSessions([])
    })
  }, [hydrated, hydrateSessions])

  // Connect WebSocket once on mount
  useEffect(() => {
    connectRef.current()
    return () => disconnectRef.current()
  }, [])

  // Auto-scroll to bottom
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

      {/* ── Message area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#d9daff transparent" }}>
        <div className="max-w-3xl mx-auto px-6 py-8">

          {!hasMessages ? (
            /* Welcome state */
            <div>
              {/* Title */}
              <div className="text-center py-12 space-y-4">
                <h2 className="text-4xl font-extrabold tracking-tight text-foreground font-[var(--font-manrope)]">
                  {t("chat.welcome_title") || "SystemEdu AI 导师"}
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto text-base leading-relaxed">
                  {t("chat.welcome_subtitle") || "欢迎来到你的认知圣所。今天想探索什么知识领域？"}
                </p>
              </div>

              {/* Quick prompt cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(qp.prompt)}
                    className="p-6 rounded-2xl bg-white dark:bg-card shadow-[0_2px_16px_0_oklch(0.488_0.258_302_/_0.06)] hover:shadow-[0_4px_28px_0_oklch(0.488_0.258_302_/_0.12)] hover:bg-white dark:hover:bg-card/80 transition-all duration-300 text-left group border border-transparent hover:border-primary/10"
                  >
                    <div className="text-primary mb-4 opacity-80 group-hover:opacity-100 transition-opacity">
                      {qp.icon}
                    </div>
                    <h4 className="font-bold text-sm mb-1.5 text-foreground font-[var(--font-manrope)]">
                      {t(qp.titleKey as never) || qp.titleFallback}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t(qp.descKey as never) || qp.descFallback}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="space-y-8">
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
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 px-6 pb-6 pt-2">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSend} disabled={streaming} />
        </div>
      </div>

    </div>
  )
}
