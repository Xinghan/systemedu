"use client"

import Link from "next/link"
import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, ChevronRight, Trash2 } from "lucide-react"
import { chatSessions, type ChatSessionDTO, type ChatMessageDTO } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { loggedIn, hydrate } = useAuthStore()
  const [session, setSession] = useState<ChatSessionDTO | null>(null)
  const [messages, setMessages] = useState<ChatMessageDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { hydrate() }, [hydrate])
  useEffect(() => {
    if (loggedIn === false) router.replace(`/login?next=/sessions/${id}`)
  }, [loggedIn, router, id])

  useEffect(() => {
    if (!loggedIn) return
    void (async () => {
      setLoading(true)
      try {
        const r = await chatSessions.get(id)
        setSession(r.session)
        setMessages(r.messages)
      } catch (e) {
        toast.error((e as Error).message || "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [id, loggedIn])

  async function handleDelete() {
    if (!confirm("删除这个对话?")) return
    try {
      await chatSessions.delete(id)
      toast.success("已删除")
      router.replace("/sessions")
    } catch (e) {
      toast.error((e as Error).message || "删除失败")
    }
  }

  if (loading) {
    return <main className="page-wide"><p className="sub">加载中...</p></main>
  }
  if (!session) {
    return (
      <main className="page-wide">
        <p className="sub">
          会话不存在 · <Link href="/sessions" style={{ color: "var(--primary)" }}>返回</Link>
        </p>
      </main>
    )
  }

  return (
    <main className="page-wide">
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--sub)", fontSize: 12.5, marginBottom: 8 }}>
        <span>SystemEdu</span>
        <ChevronRight size={12} style={{ color: "var(--sub-2)" }} />
        <Link href="/sessions" style={{ color: "var(--sub)" }}>Sessions</Link>
        <ChevronRight size={12} style={{ color: "var(--sub-2)" }} />
        <span style={{ color: "var(--ink-2)" }}>{session.title.slice(0, 30)}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginTop: 14, marginBottom: 28 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            href="/sessions"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--sub)", fontSize: 12, marginBottom: 6 }}
          >
            <ArrowLeft size={12} /> 对话列表
          </Link>
          <h1 className="h1">{session.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {session.library_slug && (
              <span className="tag violet">{session.library_slug}</span>
            )}
            {session.module_id && (
              <span className="tag">{session.module_id}</span>
            )}
            <span className="sub" style={{ fontSize: 12 }}>
              · {new Date(session.created_at).toLocaleString("zh-CN")}
            </span>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleDelete}
          style={{ color: "var(--computing)" }}
        >
          <Trash2 size={14} /> 删除
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.length === 0 ? (
          <p className="sub" style={{ textAlign: "center", padding: 40 }}>没有消息</p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} m={m} />)
        )}
      </div>
    </main>
  )
}

function MessageBubble({ m }: { m: ChatMessageDTO }) {
  const isUser = m.role === "user"
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        className={isUser ? "" : "card-elevated"}
        style={{
          maxWidth: "78%",
          padding: "12px 16px",
          borderRadius: 12,
          background: isUser ? "var(--ink)" : undefined,
          color: isUser ? "#fff" : "var(--ink-2)",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {isUser ? "you" : m.skill ? `ai · ${m.skill}` : "ai tutor"}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{m.content}</div>
      </div>
    </div>
  )
}
