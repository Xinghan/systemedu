"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import { library, myProjects, type LibraryProjectSummary } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useT } from "@/lib/hooks/use-t"

export default function LibraryListPage() {
  const t = useT()
  const { loggedIn, hydrate } = useAuthStore()
  const [projects, setProjects] = useState<LibraryProjectSummary[]>([])
  const [pulled, setPulled] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const all = await library.listProjects()
        setProjects(all)
        if (loggedIn) {
          try {
            const mine = await myProjects.list()
            setPulled(new Set(mine.map((m) => m.slug)))
          } catch {
            // 401 全局已处理
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [loggedIn])

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("library.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("library.subtitle")}</p>
      </header>

      {loading && (
        <div className="py-16 text-center text-sm text-muted-foreground">加载中...</div>
      )}

      {!loading && projects.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-12 text-center text-sm text-muted-foreground">
          暂无项目，等管理员上架。
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.slug}
              href={`/library/${encodeURIComponent(p.slug)}`}
              className="group block rounded-2xl border border-border/60 bg-card p-5 transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold leading-tight">
                  {p.title_zh || p.title}
                </h3>
                {pulled.has(p.slug) && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Sparkles size={12} />
                    在我的书架
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.slug}</p>
              {p.description && (
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {p.description}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.domain && <Tag>{p.domain}</Tag>}
                {p.age_band && <Tag>{p.age_band} 岁</Tag>}
                {p.duration_weeks != null && <Tag>{p.duration_weeks} 周</Tag>}
                {p.difficulty != null && <Tag>难度 {p.difficulty}/10</Tag>}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {p.stage_count}S · {p.knode_count}K
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  )
}
