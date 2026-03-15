"use client"

import { useEffect } from "react"
import { useParams } from "next/navigation"
import { useChatStore } from "@/lib/stores/chat-store"
import { ChatPanel } from "@/components/chat/chat-panel"

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>()
  const { setActiveSession } = useChatStore()

  useEffect(() => {
    if (params.sessionId) {
      setActiveSession(params.sessionId)
    }
  }, [params.sessionId, setActiveSession])

  return <ChatPanel />
}
