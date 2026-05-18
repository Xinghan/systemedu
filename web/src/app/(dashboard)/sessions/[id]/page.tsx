"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { chat, type ChatSessionSummary, type ChatMessageRow } from "@/lib/api"
import { toast } from "sonner"

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [session, setSession] = useState<ChatSessionSummary | null>(null)
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const r = await chat.getSession(id)
        setSession(r.session)
        setMessages(r.messages)
      } catch (e) {
        toast.error((e as Error).message || "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  async function handleDelete() {
    if (!confirm("删除这个对话?")) return
    try {
      await chat.deleteSession(id)
      toast.success("已删除")
      router.replace("/sessions")
    } catch (e) {
      toast.error((e as Error).message || "删除失败")
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">加载中...</div>
  }
  if (!session) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        会话不存在 ·{" "}
        <Link href="/sessions" className="text-primary hover:underline">
          返回列表
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href="/sessions"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3 w-3" /> 对话历史
          </Link>
          <h1 className="text-xl font-semibold truncate">{session.title}</h1>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            {session.library_slug && (
              <Badge variant="outline" className="text-[10px]">
                {session.library_slug}
              </Badge>
            )}
            {session.module_id && (
              <Badge variant="outline" className="text-[10px]">
                {session.module_id}
              </Badge>
            )}
            <span>·</span>
            <span>{new Date(session.created_at).toLocaleString("zh-CN")}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">没有消息</p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} m={m} />)
        )}
      </div>
    </div>
  )
}

function MessageBubble({ m }: { m: ChatMessageRow }) {
  const isUser = m.role === "user"
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <Card
        className={`max-w-[80%] ${isUser ? "bg-primary text-primary-foreground" : ""}`}
      >
        <CardContent className="py-3 px-4">
          <p className="text-xs opacity-60 mb-1">
            {isUser ? "你" : m.skill ? `AI · ${m.skill}` : "AI 导师"}
          </p>
          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
        </CardContent>
      </Card>
    </div>
  )
}
