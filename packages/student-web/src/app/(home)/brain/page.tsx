"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, Lock, Sparkles, Trash2, Network, MessageSquare } from "lucide-react"
import { memory, type MemoryFact, chatSessions, type ChatSessionDTO } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { UserKnowledgeTreeView } from "@/components/learning/UserKnowledgeTreeView"
import { useT } from "@/lib/i18n/use-t"

// 学习大脑 — 聚合页: 记忆 / 知识图谱 / 学习记录 三 tab。
// 替代散落的 /memory + /sessions, 统一入口 (home 卡片进入)。/memory /sessions 路由保留兼容。

type Tab = "memory" | "knowledge" | "sessions"

const CATEGORY_LABEL_KEY: Record<string, string> = {
  interest: "memory.category.interest",
  goal: "memory.category.goal",
  skill_level: "memory.category.skill_level",
  family: "memory.category.family",
  preference: "memory.category.preference",
  misconception: "memory.category.misconception",
  other: "memory.category.other",
}

export default function BrainPage() {
  const t = useT()
  const router = useRouter()
  const { loggedIn, hydrate } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>("memory")

  // memory
  const [byCategory, setByCategory] = useState<Record<string, MemoryFact[]>>({})
  const [total, setTotal] = useState(0)
  const [memLoading, setMemLoading] = useState(true)

  // sessions
  const [sessions, setSessions] = useState<ChatSessionDTO[]>([])
  const [sessLoading, setSessLoading] = useState(true)

  useEffect(() => { hydrate() }, [hydrate])
  useEffect(() => {
    if (loggedIn === false) router.replace("/login?next=/brain")
  }, [loggedIn, router])

  async function reloadMemory() {
    setMemLoading(true)
    try {
      const r = await memory.listFacts()
      setByCategory(r.by_category)
      setTotal(r.total)
    } catch (e) {
      toast.error((e as Error).message || t("session.load_failed"))
    } finally {
      setMemLoading(false)
    }
  }

  useEffect(() => {
    if (!loggedIn) return
    void reloadMemory()
    void (async () => {
      setSessLoading(true)
      try {
        setSessions(await chatSessions.list())
      } catch (e) {
        toast.error((e as Error).message || t("session.load_failed"))
      } finally {
        setSessLoading(false)
      }
    })()
  }, [loggedIn])

  async function handleRetire(id: string) {
    if (!confirm(t("memory.retire_confirm"))) return
    try {
      await memory.retireFact(id)
      toast.success(t("session.deleted"))
      await reloadMemory()
    } catch (e) {
      toast.error((e as Error).message || t("session.delete_failed"))
    }
  }

  const cats = Object.keys(byCategory)

  // sessions 按项目分组
  const grouped: Record<string, ChatSessionDTO[]> = {}
  for (const s of sessions) {
    const k = s.library_slug || "(no project)"
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(s)
  }

  const TABS: { id: Tab; labelKey: string; icon: React.ReactNode }[] = [
    { id: "memory", labelKey: "brain.tab.memory", icon: <Sparkles size={14} strokeWidth={1.7} /> },
    { id: "knowledge", labelKey: "brain.tab.knowledge", icon: <Network size={14} strokeWidth={1.7} /> },
    { id: "sessions", labelKey: "brain.tab.sessions", icon: <MessageSquare size={14} strokeWidth={1.7} /> },
  ]

  return (
    <main className="page-wide">
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--sub)", fontSize: 12.5 }}>
        <span>{t("nav.home")}</span>
        <ChevronRight size={12} style={{ color: "var(--sub-2)" }} />
        <span style={{ color: "var(--ink-2)" }}>{t("brain.title")}</span>
      </div>

      <header style={{ marginTop: 18, marginBottom: 20 }}>
        <div className="eyebrow"><span className="dot" /> your learning brain</div>
        <h1 className="h1" style={{ marginTop: 8 }}>{t("brain.title")}</h1>
        <p className="sub" style={{ marginTop: 6 }}>{t("brain.subtitle")}</p>
      </header>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 26, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "10px 18px", fontSize: 14, fontWeight: 500,
              color: activeTab === tab.id ? "var(--ink)" : "var(--sub)",
              borderBottom: activeTab === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
              display: "inline-flex", alignItems: "center", gap: 6,
              marginBottom: -1,
            }}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* ── 知识图谱 ── */}
      {activeTab === "knowledge" && <UserKnowledgeTreeView />}

      {/* ── 记忆 ── */}
      {activeTab === "memory" && (
        memLoading ? (
          <div className="card-elevated" style={{ padding: 56, textAlign: "center", color: "var(--sub)" }}>{t("home.loading")}</div>
        ) : cats.length === 0 ? (
          <div className="card-elevated" style={{ padding: 56, textAlign: "center" }}>
            <Sparkles size={36} strokeWidth={1.5} style={{ color: "var(--sub-2)", margin: "0 auto 12px" }} />
            <p className="body" style={{ color: "var(--sub)" }}>{t("memory.empty.title")}</p>
            <p className="sub" style={{ marginTop: 4 }}>{t("memory.empty.desc")}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {cats.map((cat) => (
              <section key={cat}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>
                  <span className="dot" />
                  {CATEGORY_LABEL_KEY[cat] ? t(CATEGORY_LABEL_KEY[cat]) : cat}
                  <span className="tag" style={{ marginLeft: 6 }}>{byCategory[cat].length}</span>
                </div>
                <div className="card-elevated" style={{ overflow: "hidden" }}>
                  {byCategory[cat].map((f, i) => (
                    <div
                      key={f.id}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px",
                        borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                      }}
                      className="fact-row"
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--primary-soft)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2 }}>
                        <Sparkles size={14} strokeWidth={1.7} style={{ color: "var(--primary)" }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p className="body" style={{ color: "var(--ink)", margin: 0, lineHeight: 1.5 }}>{f.value}</p>
                        <p style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--sub-2)", marginTop: 6, marginBottom: 0, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          {f.key}<span style={{ margin: "0 8px", opacity: 0.6 }}>·</span>{f.scope}
                          {f.library_slug && (<><span style={{ margin: "0 8px", opacity: 0.6 }}>·</span>{f.library_slug}</>)}
                          <span style={{ margin: "0 8px", opacity: 0.6 }}>·</span>{new Date(f.created_at).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                      <button onClick={() => handleRetire(f.id)} style={{ border: "none", background: "transparent", padding: "6px", borderRadius: 6, color: "var(--sub-2)", cursor: "pointer" }} className="fact-del" title={t("session.delete")}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      )}

      {/* ── 学习记录 ── */}
      {activeTab === "sessions" && (
        sessLoading ? (
          <div className="card-elevated" style={{ padding: 56, textAlign: "center", color: "var(--sub)" }}>{t("home.loading")}</div>
        ) : sessions.length === 0 ? (
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
                        display: "flex", alignItems: "center", gap: 16, padding: "14px 20px",
                        borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                      }}
                      className="session-row"
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--primary-soft)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <MessageSquare size={16} strokeWidth={1.7} style={{ color: "var(--primary)" }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="h3" style={{ marginBottom: 4 }}>{s.title}</div>
                        <div className="sub" style={{ fontSize: 12 }}>
                          {s.module_id && (<span style={{ fontFamily: "var(--mono)", marginRight: 8 }}>{s.module_id}</span>)}
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
        )
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 32, color: "var(--sub-2)", fontSize: 12 }}>
        <Lock size={12} style={{ marginTop: 3, flexShrink: 0 }} />
        <span>{t("memory.privacy_note")}</span>
      </div>

      <style jsx>{`
        .fact-row:hover { background: var(--paper-2); }
        .fact-del:hover { color: var(--computing); background: var(--computing-soft); }
        .session-row:hover { background: var(--paper-2); }
      `}</style>
    </main>
  )
}
