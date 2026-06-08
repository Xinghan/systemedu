"use client"

import { create } from "zustand"

export interface ToolCallInfo {
  name: string
  args?: Record<string, unknown>
  result?: string
  status: "calling" | "done"
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  toolCalls?: ToolCallInfo[]
  skill?: string
}

// spec 028: 字段对齐 student-app /api/chat/sessions schema
export interface ChatSession {
  id: string
  library_slug?: string
  module_id?: string | null
  title: string
  active_skill?: string | null
  messages: ChatMessage[]
  createdAt: Date
  updatedAt?: Date
}

interface ChatContext {
  library_slug?: string
  module_id?: string | null
}

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  context: ChatContext
  streaming: boolean
  streamContent: string
  streamToolCalls: ToolCallInfo[]
  currentSkill: string | null
  hydrated: boolean
  // selectors / actions
  setActiveSession: (id: string | null) => void
  setContext: (ctx: ChatContext) => void
  pendingAsk: string | null
  setPendingAsk: (text: string | null) => void
  addSession: (session: ChatSession) => void
  replaceSession: (oldId: string, session: ChatSession) => void
  removeSession: (id: string) => void
  addMessage: (sessionId: string, message: ChatMessage) => void
  setStreaming: (streaming: boolean) => void
  appendStreamContent: (chunk: string) => void
  resetStreamContent: () => void
  addStreamToolCall: (tc: ToolCallInfo) => void
  updateStreamToolResult: (name: string, result: string) => void
  setCurrentSkill: (skill: string | null) => void
  hydrateSessions: (sessions: ChatSession[]) => void
  setMessagesFor: (sessionId: string, messages: ChatMessage[]) => void
  activeSession: () => ChatSession | undefined
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  context: {},
  streaming: false,
  streamContent: "",
  streamToolCalls: [],
  currentSkill: null,
  hydrated: false,
  pendingAsk: null,
  setActiveSession: (id) => set({ activeSessionId: id }),
  setContext: (ctx) => set({ context: ctx }),
  setPendingAsk: (text) => set({ pendingAsk: text }),
  addSession: (session) =>
    set((s) => ({ sessions: [session, ...s.sessions] })),
  replaceSession: (oldId, session) =>
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === oldId ? session : x)),
      activeSessionId: s.activeSessionId === oldId ? session.id : s.activeSessionId,
    })),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((x) => x.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    })),
  addMessage: (sessionId, message) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? { ...sess, messages: [...sess.messages, message], updatedAt: new Date() }
          : sess,
      ),
    })),
  setMessagesFor: (sessionId, messages) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, messages } : sess,
      ),
    })),
  setStreaming: (streaming) => set({ streaming }),
  appendStreamContent: (chunk) =>
    set((s) => ({ streamContent: s.streamContent + chunk })),
  resetStreamContent: () => set({ streamContent: "", streamToolCalls: [] }),
  addStreamToolCall: (tc) =>
    set((s) => ({ streamToolCalls: [...s.streamToolCalls, tc] })),
  updateStreamToolResult: (name, result) =>
    set((s) => ({
      streamToolCalls: s.streamToolCalls.map((tc) =>
        tc.name === name && tc.status === "calling"
          ? { ...tc, result, status: "done" as const }
          : tc,
      ),
    })),
  setCurrentSkill: (skill) => set({ currentSkill: skill }),
  hydrateSessions: (sessions) =>
    set((s) => {
      const existingIds = new Set(s.sessions.map((sess) => sess.id))
      const newSessions = sessions.filter((sess) => !existingIds.has(sess.id))
      return {
        sessions: [...newSessions, ...s.sessions].sort(
          (a, b) =>
            (b.updatedAt?.getTime() ?? b.createdAt.getTime()) -
            (a.updatedAt?.getTime() ?? a.createdAt.getTime()),
        ),
        hydrated: true,
      }
    }),
  activeSession: () => {
    const state = get()
    return state.sessions.find((s) => s.id === state.activeSessionId)
  },
}))
