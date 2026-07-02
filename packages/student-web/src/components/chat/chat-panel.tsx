"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Sparkles, Plus, Trash2, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { useChatStore } from "@/lib/stores/chat-store"
import { useWebSocketChat } from "@/lib/hooks/use-websocket-chat"
import { usePageKind } from "@/lib/hooks/use-page-kind"
import { chatSessions } from "@/lib/api"
import { randomUUID } from "@/lib/utils/uuid"
import { ChatInput } from "./chat-input"
import { MessageBubble, StreamingBubble, ToolCallIndicator, TypingIndicator } from "./message-bubble"
import { useT } from "@/lib/i18n/use-t"

interface ChatPanelProps {
  librarySlug?: string
  moduleId?: string | null
}

// 学生端默认走苏格拉底问答, 不预设 quick prompt 引导词
// 注: prompt 字段是发给 AI 导师的实际问题内容 (业务数据), 保持中文; labelKey 才是 UI 展示文案
const QUICK_PROMPTS = [
  { labelKey: "chat.quick.explain_concept", prompt: "请用苏格拉底式问答帮我理解这一节的核心概念" },
  { labelKey: "chat.quick.check_answer", prompt: "我刚才的回答对不对? 帮我分析一下" },
  { labelKey: "chat.quick.give_exercise", prompt: "针对这一节的内容,出一道适合我现在水平的练习题" },
]

const SKILL_LABEL_KEYS: Record<string, string> = {
  "socratic-questioning": "chat.skill.socratic",
  "direct-instruction": "chat.skill.direct",
  scaffolding: "chat.skill.scaffolding",
  "pbl-driving-question": "chat.skill.pbl",
  "reflection-prompt": "chat.skill.reflection",
  "error-diagnosis": "chat.skill.error_diagnosis",
}

export function ChatPanel({ librarySlug, moduleId }: ChatPanelProps) {
  const t = useT()
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
    pendingAsk,
    setPendingAsk,
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

  const pageCtx = usePageKind()

  const handleSend = (message: string, source = "chat") => {
    // spec 031: page_kind 由 usePageKind 按 pathname 推;
    // librarySlug/moduleId 优先用 props (ChatPanel 调用方传的精确值),
    // 否则用 hook 推出来的 (站在哪一页就是哪一页).
    sendMessage(message, {
      library_slug: librarySlug ?? pageCtx.library_slug,
      module_id: moduleId ?? pageCtx.module_id,
      page_kind: pageCtx.page_kind,
      source,
    })
  }

  // 高亮"深入学习"触发: pendingAsk 有值时自动发送 (source=highlight_ask) 并清空
  useEffect(() => {
    if (!pendingAsk) return
    handleSend(pendingAsk, "highlight_ask")
    setPendingAsk(null)
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk])

  const handleNewSession = async () => {
    try {
      const s = await chatSessions.create({
        library_slug: librarySlug,
        module_id: moduleId ?? undefined,
        title: t("chat.new_conversation"),
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
      toast.error(e instanceof Error ? e.message : t("chat.new_session_failed"))
    }
  }

  const handleDeleteSession = async (id: string) => {
    try {
      await chatSessions.delete(id)
      removeSession(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("session.delete_failed"))
    }
  }

  const hasMessages = (activeSession?.messages.length ?? 0) > 0 || streaming
  const skillLabelKey = currentSkill ? SKILL_LABEL_KEYS[currentSkill] : null
  const skillLabel = currentSkill ? (skillLabelKey ? t(skillLabelKey) : currentSkill) : null

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, flexDirection: "column" }}>
      {/* Scope chips + session 切换 */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {moduleId && <span className="tag violet">{moduleId} context</span>}
        {skillLabel && <span className="tag">{skillLabel}</span>}
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setSessionMenuOpen((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              maxWidth: 160,
              padding: "4px 8px",
              border: "1px solid var(--border-2)",
              borderRadius: 6,
              background: "var(--card)",
              fontSize: 11,
              color: "var(--sub)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {activeSession?.title || t("chat.no_selection")}
            </span>
            <ChevronDown size={11} strokeWidth={1.5} />
          </button>
          {sessionMenuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 4,
                width: 260,
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                boxShadow: "var(--shadow-md)",
                zIndex: 50,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={handleNewSession}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 8,
                  border: 0,
                  borderBottom: "1px solid var(--border)",
                  padding: "10px 12px",
                  background: "transparent",
                  fontSize: 13,
                  color: "var(--ink-2)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Plus size={13} strokeWidth={1.5} />
                {t("chat.new_conversation")}
              </button>
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {relevantSessions.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: "var(--sub)" }}>
                    {t("chat.no_conversations")}
                  </div>
                ) : (
                  relevantSessions.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 12px",
                        fontSize: 12.5,
                        background:
                          s.id === activeSessionId ? "var(--violet-soft)" : "transparent",
                        color:
                          s.id === activeSessionId ? "var(--violet-ink)" : "var(--ink-2)",
                      }}
                      className="chat-session-row"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSession(s.id)
                          setSessionMenuOpen(false)
                        }}
                        style={{
                          flex: 1,
                          border: 0,
                          background: "transparent",
                          color: "inherit",
                          textAlign: "left",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                        }}
                      >
                        {s.title}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(t("session.delete_confirm")))
                            handleDeleteSession(s.id)
                        }}
                        aria-label={t("session.delete")}
                        style={{
                          border: 0,
                          background: "transparent",
                          cursor: "pointer",
                          color: "var(--sub-2)",
                          padding: 2,
                        }}
                      >
                        <Trash2 size={12} strokeWidth={1.5} />
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
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          scrollbarWidth: "thin",
          padding: "16px",
        }}
      >
        {!hasMessages ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 0" }}>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>
                {t("chat.intro")}
              </p>
              <p style={{ marginTop: 4, fontSize: 11, color: "var(--sub)", fontFamily: "var(--mono)" }}>
                {t("chat.try_asking")}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(qp.prompt)}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    background: "var(--paper)",
                    border: "1px dashed var(--border-2)",
                    borderRadius: 7,
                    fontSize: 12.5,
                    color: "var(--sub)",
                    cursor: "pointer",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <Sparkles
                    size={11}
                    strokeWidth={1.5}
                    style={{ color: "var(--violet)", flexShrink: 0 }}
                  />
                  {t(qp.labelKey)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {activeSession?.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {streaming && streamToolCalls.length > 0 && (
              <ToolCallIndicator toolCalls={streamToolCalls} />
            )}
            {streaming && streamContent && <StreamingBubble content={streamContent} />}
            {streaming && !streamContent && streamToolCalls.length === 0 && (
              <TypingIndicator />
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border)",
          padding: "12px 14px",
        }}
      >
        <ChatInput onSend={handleSend} disabled={streaming} />
      </div>
    </div>
  )
}
