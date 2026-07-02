"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, MessageSquare } from "lucide-react"
import { chatSessions, type ChatSessionDTO } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useT } from "@/lib/i18n/use-t"

export default function SessionsPage() {
  const router = useRouter()
  const { loggedIn, hydrate } = useAuthStore()
  const t = useT()
  const [items, setItems] = useState<ChatSessionDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { hydrate() }, [hydrate])
  useEffect(() => {
    if (loggedIn === false) router.replace("/login?next=/sessions")
  }, [loggedIn, router])

  useEffect(() => {
    if (!loggedIn) return
    void (async () => {
      setLoading(true)
      try {
        const list = await chatSessions.list()
        setItems(list)
      } catch (e) {
        toast.error((e as Error).message || t("session.load_failed"))
      } finally {
        setLoading(false)
      }
    })()
  }, [loggedIn])

  // 按 library_slug 分组
  const grouped: Record<string, ChatSessionDTO[]> = {}
  for (const s of items) {
    const k = s.library_slug || "(no project)"
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(s)
  }

  return (
    <main className="page-wide">
      <Crumbs items={[{ label: "SystemEdu" }, { label: t("nav.sessions") }]} />

      <header style={{ marginTop: 18, marginBottom: 28 }}>
        <div className="eyebrow"><span className="dot" /> dialog history</div>
        <h1 className="h1" style={{ marginTop: 8 }}>{t("sessions.title")}</h1>
        <p className="sub" style={{ marginTop: 6 }}>
          {t("sessions.subtitle")}
        </p>
      </header>

      {loading ? (
        <div className="card-elevated" style={{ padding: 56, textAlign: "center", color: "var(--sub)" }}>
          {t("home.loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="card-elevated" style={{ padding: 56, textAlign: "center" }}>
          <MessageSquare size={36} strokeWidth={1.5} style={{ color: "var(--sub-2)", margin: "0 auto 12px" }} />
          <p className="body" style={{ color: "var(--sub)" }}>{t("sessions.empty.title")}</p>
          <p className="sub" style={{ marginTop: 4 }}>{t("sessions.empty.desc")}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {Object.entries(grouped).map(([slug, list]) => (
            <section key={slug}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                <span className="dot" /> {slug}
                <span className="tag" style={{ marginLeft: 6 }}>{list.length}</span>
              </div>
              <div className="card-elevated" style={{ overflow: "hidden" }}>
                {list.map((s, i) => (
                  <Link
                    key={s.id}
                    href={`/sessions/${s.id}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 16,
                      padding: "14px 20px",
                      borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                      transition: "background 220ms cubic-bezier(.2,.7,.3,1)",
                    }}
                    className="session-row"
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 8,
                      background: "var(--primary-soft)",
                      display: "grid", placeItems: "center", flexShrink: 0,
                    }}>
                      <MessageSquare size={16} strokeWidth={1.7} style={{ color: "var(--primary)" }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="h3" style={{ marginBottom: 4 }}>{s.title}</div>
                      <div className="sub" style={{ fontSize: 12 }}>
                        {s.module_id && (
                          <span style={{ fontFamily: "var(--mono)", marginRight: 8 }}>{s.module_id}</span>
                        )}
                        {new Date(s.updated_at).toLocaleString("zh-CN")}
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: "var(--sub-2)" }} />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <style jsx>{`
        .session-row:hover { background: var(--paper-2); }
      `}</style>
    </main>
  )
}

function Crumbs({ items }: { items: { label: string; mono?: boolean }[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--sub)", fontSize: 12.5 }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {i > 0 && <ChevronRight size={12} strokeWidth={1.5} style={{ color: "var(--sub-2)" }} />}
          <span style={{
            color: i === items.length - 1 ? "var(--ink-2)" : "var(--sub)",
            fontFamily: it.mono ? "var(--mono)" : "inherit",
          }}>{it.label}</span>
        </span>
      ))}
    </div>
  )
}
