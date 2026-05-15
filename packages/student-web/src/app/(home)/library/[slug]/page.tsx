"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, BookOpen, Lock, Download } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { library, myProjects, type LibraryProjectSummary } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useT } from "@/lib/hooks/use-t"

type Stage = { stage_id: string; title: string; stage_goal?: string }
type Module = {
  module_id: string
  title: string
  stage_id?: string
  summary?: string
  sequence_order?: number
  week?: number | null
  core_question?: string
}

type DetailProject = LibraryProjectSummary & {
  knowledge_tree?: {
    stages?: Stage[]
    modules?: Module[]
  } | null
}

export default function LibraryProjectDetail() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = decodeURIComponent(params.slug)
  const { loggedIn, hydrate } = useAuthStore()

  const [project, setProject] = useState<DetailProject | null>(null)
  const [blueprint, setBlueprint] = useState("")
  const [pulled, setPulled] = useState(false)
  const [lastModuleId, setLastModuleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [p, bp] = await Promise.all([
          library.getProject(slug),
          library.getBlueprint(slug, "zh-CN").catch(() => ({ content: "" })),
        ])
        setProject(p as DetailProject)
        setBlueprint(bp.content || "")
        if (loggedIn) {
          try {
            const mine = await myProjects.list()
            const item = mine.find((m) => m.slug === slug)
            if (item) {
              setPulled(true)
              setLastModuleId(item.last_module_id ?? null)
            } else {
              setPulled(false)
              setLastModuleId(null)
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [slug, loggedIn])

  const stages = project?.knowledge_tree?.stages || []
  const modules = project?.knowledge_tree?.modules || []
  const modulesByStage = useMemo(() => {
    const grouped: Record<string, Module[]> = {}
    for (const m of modules) {
      const k = m.stage_id || "_"
      if (!grouped[k]) grouped[k] = []
      grouped[k].push(m)
    }
    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
    }
    return grouped
  }, [modules])

  const firstModuleId = modules[0]?.module_id
  const targetModuleId = lastModuleId || firstModuleId

  async function handlePull() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/library/${slug}`)}`)
      return
    }
    setPulling(true)
    try {
      await myProjects.pull(slug)
      setPulled(true)
      toast.success(t("library.pulled_toast"))
      router.push("/home")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pull 失败")
    } finally {
      setPulling(false)
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">加载中...</div>
  }
  if (!project) {
    return (
      <div className="py-12">
        <p className="mb-3 text-sm text-muted-foreground">项目不存在。</p>
        <Link
          href="/library"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft size={14} />
          返回列表
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/library"
          className="-ml-2 mb-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft size={14} />
          返回列表
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {project.title_zh || project.title}
            </h1>
            <div className="mt-1 font-mono text-sm text-muted-foreground">{project.slug}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.domain && <Tag>{project.domain}</Tag>}
              {project.age_band && <Tag>{project.age_band} 岁</Tag>}
              {project.duration_weeks != null && <Tag>{project.duration_weeks} 周</Tag>}
              {project.difficulty != null && <Tag>难度 {project.difficulty}/10</Tag>}
              <Tag>
                {project.stage_count}S · {project.knode_count}K
              </Tag>
            </div>
          </div>
          <div className="shrink-0">
            {!loggedIn ? (
              <Link
                href={`/login?next=${encodeURIComponent(`/library/${slug}`)}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Lock size={14} />
                {t("library.login_first")}
              </Link>
            ) : !pulled ? (
              <button
                type="button"
                onClick={handlePull}
                disabled={pulling}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                <Download size={14} />
                {pulling ? t("library.pulling") : t("library.pull")}
              </button>
            ) : targetModuleId ? (
              <Link
                href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(targetModuleId)}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <BookOpen size={14} />
                {lastModuleId ? `继续学习 (${lastModuleId})` : "开始学习"}
                <ArrowRight size={14} />
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {blueprint && (
        <section className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="mb-3 text-base font-semibold">项目介绍</h2>
          <article className="prose prose-stone max-w-none text-sm [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_table]:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{blueprint}</ReactMarkdown>
          </article>
        </section>
      )}

      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">知识树</h2>
        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">没有 stage 数据。</p>
        ) : (
          <div className="space-y-6">
            {stages.map((s) => (
              <div key={s.stage_id}>
                <div className="mb-2 font-medium">
                  <span className="mr-2 font-mono text-primary">{s.stage_id}</span>
                  {s.title}
                </div>
                {s.stage_goal && (
                  <p className="mb-3 text-xs text-muted-foreground">{s.stage_goal}</p>
                )}
                <div className="space-y-2">
                  {(modulesByStage[s.stage_id] || []).map((m) => {
                    const locked = !pulled
                    const content = (
                      <div className="flex items-start gap-3 text-sm">
                        {locked ? (
                          <Lock size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <BookOpen size={14} className="mt-0.5 shrink-0 text-primary" />
                        )}
                        <div className="flex-1">
                          <div>
                            <span className="mr-2 font-mono text-xs text-muted-foreground">
                              {m.module_id}
                            </span>
                            <span className={locked ? "text-muted-foreground" : ""}>{m.title}</span>
                          </div>
                          {m.summary && (
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {m.summary}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                    return locked ? (
                      <div
                        key={m.module_id}
                        className="rounded-lg border border-border/60 px-3 py-2.5 opacity-70"
                      >
                        {content}
                      </div>
                    ) : (
                      <Link
                        key={m.module_id}
                        href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(m.module_id)}`}
                        className="block rounded-lg border border-border/60 px-3 py-2.5 transition hover:border-primary/40 hover:bg-muted/30"
                      >
                        {content}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
