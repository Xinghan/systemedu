"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, Lock, Sparkles, Trash2 } from "lucide-react"
import { memory, type MemoryFact } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"

const CATEGORY_LABEL: Record<string, string> = {
  interest: "兴趣",
  goal: "目标",
  skill_level: "技能水平",
  family: "家庭背景",
  preference: "学习偏好",
  misconception: "错误概念",
  other: "其他",
}

export default function MemoryPage() {
  const router = useRouter()
  const { loggedIn, hydrate } = useAuthStore()
  const [byCategory, setByCategory] = useState<Record<string, MemoryFact[]>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

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
      toast.error((e as Error).message || "加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loggedIn) void reload()
  }, [loggedIn])

  async function handleRetire(id: string) {
    if (!confirm("删除这条记忆? AI 将不再用它来回答你.")) return
    try {
      await memory.retireFact(id)
      toast.success("已删除")
      await reload()
    } catch (e) {
      toast.error((e as Error).message || "删除失败")
    }
  }

  const cats = Object.keys(byCategory)

  return (
    <main className="page-wide">
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--sub)", fontSize: 12.5 }}>
        <span>SystemEdu</span>
        <ChevronRight size={12} style={{ color: "var(--sub-2)" }} />
        <span style={{ color: "var(--ink-2)" }}>Memory</span>
      </div>

      <header style={{ marginTop: 18, marginBottom: 28 }}>
        <div className="eyebrow"><span className="dot" /> what AI remembers about you</div>
        <h1 className="h1" style={{ marginTop: 8 }}>我的记忆</h1>
        <p className="sub" style={{ marginTop: 6 }}>
          AI 导师记住了关于你的 {total} 条事实, 用于个性化回答 · 仅你可见 · 可随时删除
        </p>
      </header>

      {loading ? (
        <div className="card-elevated" style={{ padding: 56, textAlign: "center", color: "var(--sub)" }}>
          加载中...
        </div>
      ) : cats.length === 0 ? (
        <div className="card-elevated" style={{ padding: 56, textAlign: "center" }}>
          <Sparkles size={36} strokeWidth={1.5} style={{ color: "var(--sub-2)", margin: "0 auto 12px" }} />
          <p className="body" style={{ color: "var(--sub)" }}>还没有记忆</p>
          <p className="sub" style={{ marginTop: 4 }}>
            跟 AI 导师聊一段时间后, 它会自动记住关于你的画像
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {cats.map((cat) => (
            <section key={cat}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                <span className="dot" />
                {CATEGORY_LABEL[cat] || cat}
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
                      title="删除"
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
          这些记忆只供 AI 导师在跟你对话时使用, 不会分享给其他用户.
          删除后立即从 AI 上下文中移除.
        </span>
      </div>

      <style jsx>{`
        .fact-row:hover { background: var(--paper-2); }
        .fact-del:hover { color: var(--computing); background: var(--computing-soft); }
      `}</style>
    </main>
  )
}
