"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquare, X, Send, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { GATEWAY_URL } from "@/lib/api/client"
import { getToken } from "@/lib/auth"
import { usePageKind } from "@/lib/hooks/use-page-kind"
import { toast } from "sonner"

interface Msg {
  role: "user" | "assistant"
  content: string
  skill?: string
}

/**
 * spec 032 P6: 全局 floating chat panel (Claude.ai 风右侧 drawer).
 * - 右下角圆形按钮触发
 * - 内部走 WS /api/chat/stream (student-app)
 * - 自动透传 page_kind / library_slug / module_id (按当前路由)
 * - 不持久化, 每次打开新 session (复用后端 _ensure_session 自动创建)
 */
export function FloatingChatPanel() {
  const ctx = usePageKind()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [activeSkill, setActiveSkill] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const streamBufRef = useRef<string>("")

  // 路由变化 → 重置 session (不同 page_kind 不混上下文)
  useEffect(() => {
    sessionIdRef.current = null
    setMsgs([])
    setActiveSkill(null)
  }, [ctx.page_kind, ctx.library_slug, ctx.module_id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [msgs, streaming])

  function ensureWs(): WebSocket | null {
    if (wsRef.current?.readyState === WebSocket.OPEN) return wsRef.current
    const token = getToken()
    if (!token) {
      toast.error("请先登录")
      return null
    }
    const wsBase = GATEWAY_URL.replace(/^http/, "ws") + "/api/chat/stream"
    const url = `${wsBase}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.type === "session") {
          sessionIdRef.current = data.session_id
        } else if (data.type === "chunk" && data.content) {
          streamBufRef.current += data.content
          setMsgs((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === "assistant") {
              last.content = streamBufRef.current
            } else {
              next.push({ role: "assistant", content: streamBufRef.current })
            }
            return next
          })
        } else if (data.type === "skill") {
          setActiveSkill(data.target_skill || null)
        } else if (data.type === "done") {
          setStreaming(false)
          streamBufRef.current = ""
        } else if (data.type === "error") {
          setStreaming(false)
          streamBufRef.current = ""
          toast.error(data.message || "AI 响应出错")
        }
      } catch {
        // ignore
      }
    }
    ws.onclose = () => {
      wsRef.current = null
      setStreaming(false)
    }
    ws.onerror = () => {
      setStreaming(false)
    }
    return ws
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    const ws = ensureWs()
    if (!ws) return

    setMsgs((prev) => [...prev, { role: "user", content: text }])
    setInput("")
    setStreaming(true)
    streamBufRef.current = ""

    const payload: Record<string, unknown> = {
      message: text,
      page_kind: ctx.page_kind,
    }
    if (ctx.library_slug) payload.library_slug = ctx.library_slug
    if (ctx.module_id) payload.module_id = ctx.module_id
    if (sessionIdRef.current) payload.session_id = sessionIdRef.current

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload))
    } else {
      // 等连接
      const sendLater = () => {
        ws.send(JSON.stringify(payload))
        ws.removeEventListener("open", sendLater)
      }
      ws.addEventListener("open", sendLater)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  // 路由提示
  const pageLabel = ({
    global: "全局",
    home: "首页",
    library_detail: "项目",
    learn: "学习中",
  } as const)[ctx.page_kind]

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 h-12 w-12 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-[0_4px_20px_0_oklch(0.488_0.258_302_/_0.4)] hover:shadow-[0_6px_28px_0_oklch(0.488_0.258_302_/_0.5)] transition-all flex items-center justify-center"
        title="跟 AI 导师聊聊"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] p-0 flex flex-col h-full"
        >
          <SheetHeader className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <SheetTitle className="text-sm">AI 导师</SheetTitle>
                <Badge variant="outline" className="text-[10px] font-mono">{pageLabel}</Badge>
                {ctx.library_slug && (
                  <Badge variant="outline" className="text-[10px]">{ctx.library_slug}</Badge>
                )}
                {ctx.module_id && (
                  <Badge variant="outline" className="text-[10px]">{ctx.module_id}</Badge>
                )}
              </div>
            </div>
            <SheetDescription className="text-xs">
              {activeSkill ? `当前: ${activeSkill}` : "问我任何关于学习的问题"}
            </SheetDescription>
          </SheetHeader>

          {/* 消息区 */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          >
            {msgs.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">
                <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p>{ctx.page_kind === "learn" ? "需要解释什么概念吗?" :
                     ctx.page_kind === "library_detail" ? "想了解这个项目?" :
                     "你想做什么项目?"}</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {streaming && msgs[msgs.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3.5 py-2 bg-muted text-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="px-3 py-3 border-t border-border">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                placeholder="问 AI 导师..."
                disabled={streaming}
                className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-32"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={streaming || !input.trim()}
                className="shrink-0"
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
