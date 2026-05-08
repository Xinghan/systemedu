"use client"

import { useCallback, useRef } from "react"
import { toast } from "sonner"
import { GATEWAY_URL } from "@/lib/api/client"
import { getToken } from "@/lib/auth"
import { useChatStore } from "@/lib/stores/chat-store"
import { randomUUID } from "@/lib/utils/uuid"
import type { WSMessage } from "@/lib/types/api"

const MAX_RETRIES = 10
const INITIAL_DELAY = 1000
const MAX_DELAY = 30000

export function useWebSocketChat() {
  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intentionalCloseRef = useRef(false)

  // Use store actions directly — they are stable references.
  // Read state via useChatStore.getState() inside callbacks to avoid stale closures.
  const {
    addSession,
    addMessage,
    setStreaming,
    appendStreamContent,
    resetStreamContent,
    setActiveSession,
    addStreamToolCall,
    updateStreamToolResult,
  } = useChatStore()

  const scheduleReconnect = useCallback((connectFn: () => void) => {
    if (retryCountRef.current >= MAX_RETRIES) {
      toast.error("连接失败，请刷新页面")
      return
    }

    const delay = Math.min(INITIAL_DELAY * Math.pow(2, retryCountRef.current), MAX_DELAY)
    retryCountRef.current++

    toast.info(`正在重连... (${retryCountRef.current}/${MAX_RETRIES})`)

    retryTimerRef.current = setTimeout(() => {
      connectFn()
    }, delay)
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return

    intentionalCloseRef.current = false
    const token = getToken()
    const wsBase = GATEWAY_URL.replace(/^http/, "ws") + "/api/chat/stream"
    const wsUrl = token ? `${wsBase}?token=${encodeURIComponent(token)}` : wsBase
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (retryCountRef.current > 0) {
        toast.success("已重新连接")
      }
      retryCountRef.current = 0
    }

    ws.onmessage = (event) => {
      const data: WSMessage = JSON.parse(event.data)
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
      } else if (data.type === "done" && data.session_id) {
        const state = useChatStore.getState()
        // Use active session if available; the server may return a different
        // session_id because it creates its own session when the frontend-
        // generated UUID is not found in its SessionManager.
        const targetSessionId = state.activeSessionId || data.session_id
        addMessage(targetSessionId, {
          id: randomUUID(),
          role: "assistant",
          content: state.streamContent,
          timestamp: new Date(),
          toolCalls: state.streamToolCalls.length > 0
            ? state.streamToolCalls.map((tc) => ({ ...tc, status: "done" as const }))
            : undefined,
        })
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
      // onclose will fire after onerror, reconnection handled there
    }
  }, [addMessage, appendStreamContent, resetStreamContent, setActiveSession, setStreaming, scheduleReconnect, addStreamToolCall, updateStreamToolResult])

  const sendMessage = useCallback(
    (message: string, options?: { project?: string; agent?: string; node_id?: number; active_tab?: string; page_index?: number }) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect()
        // Wait for connection, then retry
        setTimeout(() => sendMessage(message, options), 500)
        return
      }

      const state = useChatStore.getState()
      let currentSessionId = state.activeSessionId

      if (!currentSessionId) {
        // Create local session first
        const newId = randomUUID()
        addSession({
          id: newId,
          agent: options?.agent,
          project: options?.project,
          messages: [],
          createdAt: new Date(),
        })
        setActiveSession(newId)
        currentSessionId = newId
      }

      // Add user message locally
      addMessage(currentSessionId, {
        id: randomUUID(),
        role: "user",
        content: message,
        timestamp: new Date(),
      })

      setStreaming(true)
      resetStreamContent()

      wsRef.current.send(
        JSON.stringify({
          message,
          session_id: currentSessionId,
          ...options,
        })
      )
    },
    [addMessage, addSession, connect, resetStreamContent, setActiveSession, setStreaming]
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
