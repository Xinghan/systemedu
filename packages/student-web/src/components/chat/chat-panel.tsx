"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Sparkles, Plus, Trash2, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { useChatStore } from "@/lib/stores/chat-store"
import { useWebSocketChat } from "@/lib/hooks/use-websocket-chat"
import { chatSessions } from "@/lib/api"
import { randomUUID } from "@/lib/utils/uuid"
import { ChatInput } from "./chat-input"
import { MessageBubble, StreamingBubble, ToolCallIndicator, TypingIndicator } from "./message-bubble"

interface ChatPanelProps {
  librarySlug?: string
  moduleId?: string | null
}

// 学生端默认走苏格拉底问答, 不预设 quick prompt 引导词
const QUICK_PROMPTS = [
  { label: "解释一下这一节的核心概念", prompt: "请用苏格拉底式问答帮我理解这一节的核心概念" },
  { label: "我刚才的回答对不对?", prompt: "我刚才的回答对不对? 帮我分析一下" },
  { label: "出一道练习题", prompt: "针对这一节的内容,出一道适合我现在水平的练习题" },
]

const SKILL_LABELS: Record<string, string> = {
  "socratic-questioning": "苏格拉底",
  "direct-instruction": "直接讲解",
  scaffolding: "脚手架",
  "pbl-driving-question": "PBL 驱动",
  "reflection-prompt": "反思",
  "error-diagnosis": "纠错",
}

export function ChatPanel({ librarySlug, moduleId }: ChatPanelProps) {
  const {
    sessions,
    activeSessionId,
    streaming,
    streamContent,
    streamToolCalls,
    currentSkill,
    hydrated,
    hydrateSessions,
    setActiveSession,
    addSession,
    removeSession,
    setMessagesFor,
    setContext,
    setCurrentSkill,
  } = useChatStore()
  const { connect, sendMessage, disconnect } = useWebSocketChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const connectRef = useRef(connect)
  const disconnectRef = useRef(disconnect)
  connectRef.current = connect
  disconnectRef.current = disconnect

  // 当前 (slug, moduleId) 下的 sessions
  const relevantSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          (!librarySlug || s.library_slug === librarySlug) &&
          (!moduleId || s.module_id === moduleId || s.module_id == null),
      ),
    [sessions, librarySlug, moduleId],
  )
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  // 切换 (slug, moduleId) 时设 context + hydrate sessions
  useEffect(() => {
    setContext({ library_slug: librarySlug, module_id: moduleId ?? null })
  }, [librarySlug, moduleId, setContext])

  // 首次 mount 拉 session list (按当前 context 过滤)
  useEffect(() => {
    if (hydrated) return
    chatSessions
      .list({ library_slug: librarySlug, module_id: moduleId ?? undefined })
      .then((rows) => {
        const mapped = rows.map((s) => ({
          id: s.id,
          library_slug: s.library_slug,
          module_id: s.module_id,
          title: s.title,
          active_skill: s.active_skill,
          messages: [],
          createdAt: new Date(s.created_at),
          updatedAt: new Date(s.updated_at),
        }))
        hydrateSessions(mapped)
      })
      .catch(() => hydrateSessions([]))
  }, [hydrated, librarySlug, moduleId, hydrateSessions])

  // 切换 activeSession 时拉 messages
  useEffect(() => {
    if (!activeSessionId || !activeSession) return
    if (activeSession.messages.length > 0) return
    chatSessions
      .get(activeSessionId)
      .then((body) => {
        const msgs = body.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at),
          skill: m.skill ?? undefined,
        }))
        setMessagesFor(activeSessionId, msgs)
        if (body.session.active_skill) setCurrentSkill(body.session.active_skill)
      })
      .catch(() => {
        // session 可能被服务端删了
      })
  }, [activeSessionId, activeSession, setMessagesFor, setCurrentSkill])

  // 连 WS (要登录才连)
  useEffect(() => {
    connectRef.current()
    return () => disconnectRef.current()
  }, [])

  // 自动滚到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [activeSession?.messages.length, streamContent])

  const handleSend = (message: string) => {
    sendMessage(message, {
      library_slug: librarySlug,
      module_id: moduleId,
    })
  }

  const handleNewSession = async () => {
    try {
      const s = await chatSessions.create({
        library_slug: librarySlug,
        module_id: moduleId ?? undefined,
        title: "新对话",
      })
      addSession({
        id: s.id,
        library_slug: s.library_slug,
        module_id: s.module_id,
        title: s.title,
        messages: [],
        createdAt: new Date(s.created_at),
      })
      setActiveSession(s.id)
      setSessionMenuOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "新建会话失败")
    }
  }

  const handleDeleteSession = async (id: string) => {
    try {
      await chatSessions.delete(id)
      removeSession(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败")
    }
  }

  const hasMessages = (activeSession?.messages.length ?? 0) > 0 || streaming
  const skillLabel = currentSkill ? SKILL_LABELS[currentSkill] ?? currentSkill : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-3">
        <Sparkles size={16} className="text-primary" />
        <h3 className="text-sm font-semibold">AI 助教</h3>
        {skillLabel && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {skillLabel}
          </span>
        )}
        <div className="flex-1" />
        {/* Session 切换 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSessionMenuOpen((v) => !v)}
            className="inline-flex max-w-[200px] items-center gap-1 truncate rounded-md border border-border/60 bg-card px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="truncate">{activeSession?.title || "未选择会话"}</span>
            <ChevronDown size={12} />
          </button>
          {sessionMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg">
              <button
                type="button"
                onClick={handleNewSession}
                className="flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-sm hover:bg-accent"
              >
                <Plus size={14} />
                新建对话
              </button>
              <div className="max-h-64 overflow-y-auto">
                {relevantSessions.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-muted-foreground">还没有对话</div>
                ) : (
                  relevantSessions.map((s) => (
                    <div
                      key={s.id}
                      className={`group flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent ${
                        s.id === activeSessionId ? "bg-primary/5 text-primary" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSession(s.id)
                          setSessionMenuOpen(false)
                        }}
                        className="flex-1 truncate text-left"
                      >
                        {s.title}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm("确定删除这条对话?")) handleDeleteSession(s.id)
                        }}
                        className="opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                        aria-label="删除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message area */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#d9daff transparent" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-6">
          {!hasMessages ? (
            <div className="space-y-6 py-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  我是你的 AI 助教
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  不直接给答案,通过提问帮你思考。试试问我:
                </p>
              </div>
              <div className="space-y-2">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(qp.prompt)}
                    className="block w-full rounded-xl border border-border/60 bg-card px-4 py-3 text-left text-sm transition hover:border-primary/40 hover:bg-accent"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {activeSession?.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {streaming && streamToolCalls.length > 0 && (
                <ToolCallIndicator toolCalls={streamToolCalls} />
              )}
              {streaming && streamContent && <StreamingBubble content={streamContent} />}
              {streaming && !streamContent && streamToolCalls.length === 0 && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/60 bg-background/60 px-4 pb-4 pt-3">
        <div className="mx-auto max-w-3xl">
          <ChatInput onSend={handleSend} disabled={streaming} />
        </div>
      </div>
    </div>
  )
}
