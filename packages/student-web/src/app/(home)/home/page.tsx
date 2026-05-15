"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowRight, BookOpen, Search, Trash2 } from "lucide-react"
import { myProjects, type MyProjectItem } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useT } from "@/lib/hooks/use-t"

export default function HomePage() {
  const t = useT()
  const router = useRouter()
  const { loggedIn, username, hydrate } = useAuthStore()
  const [items, setItems] = useState<MyProjectItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (loggedIn === false) {
      router.replace("/login?next=/home")
    }
  }, [loggedIn, router])

  useEffect(() => {
    if (!loggedIn) return
    void (async () => {
      setLoading(true)
      try {
        const list = await myProjects.list()
        setItems(list)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [loggedIn])

  async function handleRemove(slug: string) {
    try {
      await myProjects.remove(slug)
      setItems((prev) => prev.filter((x) => x.slug !== slug))
      toast.success("已从书架移除")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移除失败")
    }
  }

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">{t("home.welcome_back")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {username ?? "学生"}
        </h1>
      </header>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("home.my_projects")}</h2>
          <Link
            href="/library"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Search size={14} />
            Library
          </Link>
        </div>

        {loading && (
          <div className="py-16 text-center text-sm text-muted-foreground">加载中...</div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
            <h3 className="text-base font-medium">{t("home.empty.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("home.empty.desc")}</p>
            <Link
              href="/library"
              className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("home.empty.cta")}
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <MyProjectCard
                key={p.slug}
                project={p}
                onRemove={() => handleRemove(p.slug)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function MyProjectCard({
  project,
  onRemove,
}: {
  project: MyProjectItem
  onRemove: () => void
}) {
  const t = useT()
  const target = project.last_module_id || "M01"
  const href = `/learn/${encodeURIComponent(project.slug)}/${encodeURIComponent(target)}`
  const cta = project.last_module_id ? `${t("home.continue")} (${project.last_module_id})` : t("home.start")

  return (
    <div className="group flex flex-col rounded-2xl border border-border/60 bg-card p-5 transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight">
          {project.title_zh || project.title}
        </h3>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            onRemove()
          }}
          aria-label="移除"
          className="rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-accent hover:text-foreground"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{project.slug}</p>
      {project.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
      )}
      <div className="mt-4 text-xs text-muted-foreground">
        {project.knode_count != null && t("home.knode_count", { n: project.knode_count })}
        {project.last_module_id && (
          <>
            {" · "}
            <span>{t("home.last_module", { m: project.last_module_id })}</span>
          </>
        )}
      </div>
      {project.unavailable && (
        <p className="mt-2 text-xs text-amber-600">{t("home.unavailable")}</p>
      )}
      <div className="mt-auto pt-5">
        {project.unavailable ? (
          <button
            type="button"
            disabled
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border/60 bg-muted px-4 py-2 text-sm font-medium text-muted-foreground"
          >
            {t("home.unavailable")}
          </button>
        ) : (
          <Link
            href={href}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <BookOpen size={14} />
            {cta}
          </Link>
        )}
      </div>
    </div>
  )
}
