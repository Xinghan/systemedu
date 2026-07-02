"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, Lock, Sparkles, Trash2, Network } from "lucide-react"
import { memory, type MemoryFact } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { UserKnowledgeTreeView } from "@/components/learning/UserKnowledgeTreeView"
import { useT } from "@/lib/i18n/use-t"

const CATEGORY_LABEL_KEY: Record<string, string> = {
  interest: "memory.category.interest",
  goal: "memory.category.goal",
  skill_level: "memory.category.skill_level",
  family: "memory.category.family",
  preference: "memory.category.preference",
  misconception: "memory.category.misconception",
  other: "memory.category.other",
}

export default function MemoryPage() {
  const t = useT()
  const router = useRouter()
  const { loggedIn, hydrate } = useAuthStore()
  const [byCategory, setByCategory] = useState<Record<string, MemoryFact[]>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  // spec 036: tab switch
  const [activeTab, setActiveTab] = useState<"memory" | "knowledge">("memory")

  useEffect(() => { hydrate() }, [hydrate])
  useEffect(() => {
    if (loggedIn === false) router.replace("/login?next=/memory")
  }, [loggedIn, router])

  async function reload() {
    setLoading(true)
    try {
      const r = await memory.listFacts()
      setByCategory(r.by_category)
      setTotal(r.total)
    } catch (e) {
      toast.error((e as Error).message || t("session.load_failed"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loggedIn) void reload()
  }, [loggedIn])

  async function handleRetire(id: string) {
    if (!confirm(t("memory.retire_confirm"))) return
    try {
      await memory.retireFact(id)
      toast.success(t("session.deleted"))
      await reload()
    } catch (e) {
      toast.error((e as Error).message || t("session.delete_failed"))
    }
  }

  const cats = Object.keys(byCategory)

  return (
    <main className="page-wide">
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--sub)", fontSize: 12.5 }}>
        <span>SystemEdu</span>
        <ChevronRight size={12} style={{ color: "var(--sub-2)" }} />
        <span style={{ color: "var(--ink-2)" }}>{t("nav.memory")}</span>
      </div>

      <header style={{ marginTop: 18, marginBottom: 20 }}>
        <div className="eyebrow"><span className="dot" /> {activeTab === "memory" ? t("memory.eyebrow.memory") : t("memory.eyebrow.knowledge")}</div>
        <h1 className="h1" style={{ marginTop: 8 }}>{activeTab === "memory" ? t("memory.title") : t("memory.knowledge_title")}</h1>
        <p className="sub" style={{ marginTop: 6 }}>
          {activeTab === "memory"
            ? `${t("memory.subtitle")} · ${t("memory.fact_count", { n: total })}`
            : t("memory.knowledge_subtitle")}
        </p>
      </header>

      {/* spec 036: Tab switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 26, borderBottom: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={() => setActiveTab("memory")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "10px 18px", fontSize: 14, fontWeight: 500,
            color: activeTab === "memory" ? "var(--ink)" : "var(--sub)",
            borderBottom: activeTab === "memory" ? "2px solid var(--primary)" : "2px solid transparent",
            display: "inline-flex", alignItems: "center", gap: 6,
            marginBottom: -1,
          }}
        >
          <Sparkles size={14} strokeWidth={1.7} />
          {t("memory.tab.memory")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("knowledge")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "10px 18px", fontSize: 14, fontWeight: 500,
            color: activeTab === "knowledge" ? "var(--ink)" : "var(--sub)",
            borderBottom: activeTab === "knowledge" ? "2px solid var(--primary)" : "2px solid transparent",
            display: "inline-flex", alignItems: "center", gap: 6,
            marginBottom: -1,
          }}
        >
          <Network size={14} strokeWidth={1.7} />
          {t("memory.tab.knowledge")}
        </button>
      </div>

      {activeTab === "knowledge" ? (
        <UserKnowledgeTreeView />
      ) : loading ? (
        <div className="card-elevated" style={{ padding: 56, textAlign: "center", color: "var(--sub)" }}>
          {t("home.loading")}
        </div>
      ) : cats.length === 0 ? (
        <div className="card-elevated" style={{ padding: 56, textAlign: "center" }}>
          <Sparkles size={36} strokeWidth={1.5} style={{ color: "var(--sub-2)", margin: "0 auto 12px" }} />
          <p className="body" style={{ color: "var(--sub)" }}>{t("memory.empty.title")}</p>
          <p className="sub" style={{ marginTop: 4 }}>
            {t("memory.empty.desc")}
          </p>
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
                      display: "flex", alignItems: "flex-start", gap: 14,
                      padding: "14px 18px",
                      borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                    }}
                    className="fact-row"
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "var(--primary-soft)",
                      display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2,
                    }}>
                      <Sparkles size={14} strokeWidth={1.7} style={{ color: "var(--primary)" }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className="body" style={{ color: "var(--ink)", margin: 0, lineHeight: 1.5 }}>
                        {f.value}
                      </p>
                      <p style={{
                        fontFamily: "var(--mono)", fontSize: 10.5,
                        color: "var(--sub-2)", marginTop: 6, marginBottom: 0,
                        letterSpacing: "0.04em", textTransform: "uppercase",
                      }}>
                        {f.key}
                        <span style={{ margin: "0 8px", opacity: 0.6 }}>·</span>
                        {f.scope}
                        {f.library_slug && (
                          <>
                            <span style={{ margin: "0 8px", opacity: 0.6 }}>·</span>
                            {f.library_slug}
                          </>
                        )}
                        <span style={{ margin: "0 8px", opacity: 0.6 }}>·</span>
                        {new Date(f.created_at).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRetire(f.id)}
                      style={{
                        border: "none", background: "transparent",
                        padding: "6px", borderRadius: 6, color: "var(--sub-2)",
                        cursor: "pointer", transition: "all 220ms cubic-bezier(.2,.7,.3,1)",
                      }}
                      className="fact-del"
                      title={t("session.delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        marginTop: 32, color: "var(--sub-2)", fontSize: 12,
      }}>
        <Lock size={12} style={{ marginTop: 3, flexShrink: 0 }} />
        <span>
          {t("memory.privacy_note_full")}
        </span>
      </div>

      <style jsx>{`
        .fact-row:hover { background: var(--paper-2); }
        .fact-del:hover { color: var(--computing); background: var(--computing-soft); }
      `}</style>
    </main>
  )
}
