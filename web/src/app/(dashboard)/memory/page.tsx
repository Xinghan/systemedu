"use client"

import { useEffect, useState } from "react"
import { Sparkles, Trash2, Lock } from "lucide-react"
import { memory, type MemoryFact } from "@/lib/api"
import { toast } from "sonner"

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
  const [byCategory, setByCategory] = useState<Record<string, MemoryFact[]>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

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
    void reload()
  }, [])

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
    <div className="p-8 space-y-8 animate-[loading-fade-in_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          我的记忆
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          AI 导师记住了关于你的 {total} 条事实, 用于个性化回答 · 仅你可见
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : cats.length === 0 ? (
        <div className="card-elevated p-14 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">还没有记忆</p>
          <p className="text-xs text-muted-foreground mt-1">
            跟 AI 导师聊一段时间后, 它会自动记住关于你的画像
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {cats.map((cat) => (
            <section key={cat} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground">
                  {CATEGORY_LABEL[cat] || cat}
                </span>
                <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {byCategory[cat].length}
                </span>
              </div>
              <div className="card-elevated overflow-hidden">
                <div className="divide-y divide-border/60">
                  {byCategory[cat].map((f) => (
                    <div
                      key={f.id}
                      className="flex items-start gap-4 px-5 py-4 hover:bg-secondary/40 transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] group"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/30">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {f.value}
                        </p>
                        <p className="text-[10px] text-muted-foreground/80 mt-1.5 font-[var(--font-manrope)] uppercase tracking-wider">
                          {f.key}
                          <span className="mx-2 opacity-50">·</span>
                          {f.scope}
                          {f.library_slug && (
                            <>
                              <span className="mx-2 opacity-50">·</span>
                              {f.library_slug}
                            </>
                          )}
                          <span className="mx-2 opacity-50">·</span>
                          {new Date(f.created_at).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRetire(f.id)}
                        className="h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/8 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground/80 flex items-start gap-2 pt-4">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          这些记忆只供 AI 导师在跟你对话时使用, 不会分享给其他用户.
          删除后立即从 AI 上下文中移除.
        </span>
      </div>
    </div>
  )
}
