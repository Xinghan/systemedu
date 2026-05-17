"use client"

import { useCallback, useRef } from "react"
import { toast } from "sonner"
import { STUDENT_API_URL } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { useChatStore } from "@/lib/stores/chat-store"
import { randomUUID } from "@/lib/utils/uuid"
import type { WSMessage } from "@/lib/types/api"

const MAX_RETRIES = 10
const INITIAL_DELAY = 1000
const MAX_DELAY = 30000

interface SendOptions {
  library_slug?: string
  module_id?: string | null
  confirm_response?: Record<string, unknown>
}

export function useWebSocketChat() {
  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intentionalCloseRef = useRef(false)

  const {
    addSession,
    replaceSession,
    addMessage,
    setStreaming,
    appendStreamContent,
    resetStreamContent,
    setActiveSession,
    addStreamToolCall,
    updateStreamToolResult,
    setCurrentSkill,
  } = useChatStore()

  const scheduleReconnect = useCallback((connectFn: () => void) => {
    if (retryCountRef.current >= MAX_RETRIES) {
      toast.error("AI 助教连接失败，请刷新页面")
      return
    }
    const delay = Math.min(INITIAL_DELAY * Math.pow(2, retryCountRef.current), MAX_DELAY)
    retryCountRef.current++
    toast.info(`AI 助教重连中... (${retryCountRef.current}/${MAX_RETRIES})`)
    retryTimerRef.current = setTimeout(() => {
      connectFn()
    }, delay)
  }, [])

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return
    }
    intentionalCloseRef.current = false
    const token = getToken()
    if (!token) {
      return // 未登录, 不建连接
    }
    const wsBase = STUDENT_API_URL.replace(/^http/, "ws") + "/api/chat/stream"
    const wsUrl = `${wsBase}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (retryCountRef.current > 0) {
        toast.success("AI 助教已重新连接")
      }
      retryCountRef.current = 0
    }

    ws.onmessage = (event) => {
      let data: WSMessage
      try {
        data = JSON.parse(event.data)
      } catch {
        return
      }
      if (data.type === "chunk" && data.content) {
        appendStreamContent(data.content)
      } else if (data.type === "tool_call" && data.name) {
        addStreamToolCall({
          name: data.name,
          args: data.args,
          status: "calling",
        })
      } else if (data.type === "tool_result" && data.name) {
        updateStreamToolResult(data.name, data.result ?? "")
      } else if (data.type === "session" && data.session_id) {
        // server 回告: 我们前端发的临时 id 可能被换成了真实 session_id
        const state = useChatStore.getState()
        const local = state.activeSessionId
        if (local && local !== data.session_id) {
          const existing = state.sessions.find((s) => s.id === local)
          if (existing) {
            replaceSession(local, { ...existing, id: data.session_id })
          }
        }
      } else if (data.type === "skill" && data.target_skill) {
        setCurrentSkill(data.target_skill)
      } else if (data.type === "escalation") {
        toast.warning(
          `[安全提示] 请联系: ${data.contact_info ?? "12355 青少年心理热线"}`,
          { duration: 10000 },
        )
      } else if (data.type === "done" && data.session_id) {
        const state = useChatStore.getState()
        const targetSessionId = state.activeSessionId || data.session_id
        if (state.streamContent || state.streamToolCalls.length > 0) {
          addMessage(targetSessionId, {
            id: randomUUID(),
            role: "assistant",
            content: state.streamContent,
            timestamp: new Date(),
            skill: state.currentSkill ?? undefined,
            toolCalls:
              state.streamToolCalls.length > 0
                ? state.streamToolCalls.map((tc) => ({ ...tc, status: "done" as const }))
                : undefined,
          })
        }
        resetStreamContent()
        setStreaming(false)
        if (!state.activeSessionId) {
          setActiveSession(data.session_id)
        }
      } else if (data.type === "error") {
        setStreaming(false)
        resetStreamContent()
        toast.error(`AI 响应错误: ${data.content ?? data.message ?? "未知错误"}`)
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      if (!intentionalCloseRef.current) {
        scheduleReconnect(connect)
      }
    }

    ws.onerror = () => {
      // onclose 会接着触发, 重连逻辑在那
    }
  }, [
    addMessage,
    appendStreamContent,
    resetStreamContent,
    replaceSession,
    setActiveSession,
    setStreaming,
    setCurrentSkill,
    scheduleReconnect,
    addStreamToolCall,
    updateStreamToolResult,
  ])

  const sendMessage = useCallback(
    (message: string, options?: SendOptions) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect()
        // 等连上再 retry
        setTimeout(() => sendMessage(message, options), 500)
        return
      }

      const state = useChatStore.getState()
      let currentSessionId = state.activeSessionId

      // 没有 active session 时, 先建临时本地 session, server 会回 session_id 然后替换
      if (!currentSessionId) {
        const newId = randomUUID()
        addSession({
          id: newId,
          library_slug: options?.library_slug,
          module_id: options?.module_id,
          title: message.slice(0, 40),
          messages: [],
          createdAt: new Date(),
        })
        setActiveSession(newId)
        currentSessionId = newId
      }

      addMessage(currentSessionId, {
        id: randomUUID(),
        role: "user",
        content: message,
        timestamp: new Date(),
      })

      setStreaming(true)
      resetStreamContent()
      setCurrentSkill(null)

      wsRef.current.send(
        JSON.stringify({
          message,
          session_id: currentSessionId,
          library_slug: options?.library_slug,
          module_id: options?.module_id,
          confirm_response: options?.confirm_response,
        }),
      )
    },
    [
      addMessage,
      addSession,
      connect,
      resetStreamContent,
      setActiveSession,
      setStreaming,
      setCurrentSkill,
    ],
  )

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    retryCountRef.current = 0
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  return { connect, sendMessage, disconnect }
}
