"use client"

import { create } from "zustand"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
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
  setActiveSession: (id: string | null) => void
  addSession: (session: ChatSession) => void
  addMessage: (sessionId: string, message: ChatMessage) => void
  setStreaming: (streaming: boolean) => void
  appendStreamContent: (chunk: string) => void
  resetStreamContent: () => void
  activeSession: () => ChatSession | undefined
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  streaming: false,
  streamContent: "",
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
  resetStreamContent: () => set({ streamContent: "" }),
  activeSession: () => {
    const state = get()
    return state.sessions.find((s) => s.id === state.activeSessionId)
  },
}))
