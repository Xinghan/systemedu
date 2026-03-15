"use client"

import { useCallback, useRef } from "react"
import { GATEWAY_URL } from "@/lib/api/client"
import { useChatStore } from "@/lib/stores/chat-store"
import type { WSMessage } from "@/lib/types/api"

export function useWebSocketChat() {
  const wsRef = useRef<WebSocket | null>(null)
  const {
    activeSessionId,
    addSession,
    addMessage,
    setStreaming,
    appendStreamContent,
    resetStreamContent,
    setActiveSession,
  } = useChatStore()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = GATEWAY_URL.replace(/^http/, "ws") + "/api/chat/stream"
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const data: WSMessage = JSON.parse(event.data)
      if (data.type === "chunk" && data.content) {
        appendStreamContent(data.content)
      } else if (data.type === "done" && data.session_id) {
        const content = useChatStore.getState().streamContent
        addMessage(data.session_id, {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
          timestamp: new Date(),
        })
        resetStreamContent()
        setStreaming(false)
        if (!activeSessionId) {
          setActiveSession(data.session_id)
        }
      } else if (data.type === "error") {
        setStreaming(false)
        resetStreamContent()
      }
    }

    ws.onclose = () => {
      wsRef.current = null
    }
  }, [activeSessionId, addMessage, appendStreamContent, resetStreamContent, setActiveSession, setStreaming])

  const sendMessage = useCallback(
    (message: string, options?: { project?: string; agent?: string }) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect()
        // Wait for connection, then retry
        setTimeout(() => sendMessage(message, options), 500)
        return
      }

      const sessionId = activeSessionId
      if (!sessionId) {
        // Create local session first
        const newId = crypto.randomUUID()
        addSession({
          id: newId,
          agent: options?.agent,
          project: options?.project,
          messages: [],
          createdAt: new Date(),
        })
        setActiveSession(newId)
      }

      const currentSessionId = useChatStore.getState().activeSessionId

      // Add user message locally
      if (currentSessionId) {
        addMessage(currentSessionId, {
          id: crypto.randomUUID(),
          role: "user",
          content: message,
          timestamp: new Date(),
        })
      }

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
    [activeSessionId, addMessage, addSession, connect, resetStreamContent, setActiveSession, setStreaming]
  )

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  return { connect, sendMessage, disconnect }
}
