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
}

export interface ChatSession {
  id: string
  agent?: string
  project?: string
  messages: ChatMessage[]
  createdAt: Date
}

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  streaming: boolean
  streamContent: string
  streamToolCalls: ToolCallInfo[]
  hydrated: boolean
  setActiveSession: (id: string | null) => void
  addSession: (session: ChatSession) => void
  addMessage: (sessionId: string, message: ChatMessage) => void
  setStreaming: (streaming: boolean) => void
  appendStreamContent: (chunk: string) => void
  resetStreamContent: () => void
  addStreamToolCall: (tc: ToolCallInfo) => void
  updateStreamToolResult: (name: string, result: string) => void
  hydrateSessions: (sessions: ChatSession[]) => void
  activeSession: () => ChatSession | undefined
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  streaming: false,
  streamContent: "",
  streamToolCalls: [],
  hydrated: false,
  setActiveSession: (id) => set({ activeSessionId: id }),
  addSession: (session) =>
    set((s) => ({ sessions: [...s.sessions, session] })),
  addMessage: (sessionId, message) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? { ...sess, messages: [...sess.messages, message] }
          : sess
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
          : tc
      ),
    })),
  hydrateSessions: (sessions) =>
    set((s) => {
      // Merge: keep existing sessions (from this page session), add DB sessions that aren't already loaded
      const existingIds = new Set(s.sessions.map((sess) => sess.id))
      const newSessions = sessions.filter((sess) => !existingIds.has(sess.id))
      return { sessions: [...s.sessions, ...newSessions], hydrated: true }
    }),
  activeSession: () => {
    const state = get()
    return state.sessions.find((s) => s.id === state.activeSessionId)
  },
}))
