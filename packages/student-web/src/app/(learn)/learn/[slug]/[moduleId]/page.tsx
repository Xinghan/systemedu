"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { library, myProjects, type LibraryKnodeContent } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { useAuthStore } from "@/lib/stores/auth-store"

interface ProjectTreeModule {
  module_id: string
  title: string
  stage_id?: string
  sequence_order?: number
  summary?: string
}

interface RenderedSection {
  mode: "animation" | "game" | "exercise" | "story" | "theory" | string
  status?: string
  html?: string | null
  html_path?: string | null
  story_paragraphs?: string[] | null
  exercises?: Array<{
    type?: string
    question?: string
    options?: string[]
    correct_option_index?: number
    explanation?: string
  }> | null
}

type SectionsData = {
  ideas?: Array<{ idea_id: string; mode: string; topic?: string }>
  rendered_sections?: Record<string, RenderedSection>
}

export default function LearnPage() {
  const params = useParams<{ slug: string; moduleId: string }>()
  const slug = decodeURIComponent(params.slug)
  const moduleId = decodeURIComponent(params.moduleId)
  const router = useRouter()
  const { loggedIn, hydrate } = useAuthStore()

  const [knode, setKnode] = useState<LibraryKnodeContent | null>(null)
  const [modules, setModules] = useState<ProjectTreeModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (loggedIn === false) {
      router.replace(`/login?next=${encodeURIComponent(`/learn/${slug}/${moduleId}`)}`)
    }
  }, [loggedIn, slug, moduleId, router])

  useEffect(() => {
    if (!loggedIn) return
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [k, tree] = await Promise.all([
          library.getKnode(slug, moduleId),
          library.getTree(slug).catch(() => null),
        ])
        setKnode(k)
        if (tree && Array.isArray((tree as { modules?: ProjectTreeModule[] }).modules)) {
          setModules((tree as { modules: ProjectTreeModule[] }).modules)
        }
        // 标记进度
        myProjects.setProgress(slug, moduleId).catch(() => {})
      } catch (err) {
        const msg = err instanceof Error ? err.message : "加载失败"
        setError(msg)
        if (msg.includes("pull_required") || msg === "Unauthorized") {
          toast.error("请先 Pull 该项目")
          router.replace(`/library/${encodeURIComponent(slug)}`)
        } else {
          toast.error(msg)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [loggedIn, slug, moduleId, router])

  const orderedModules = useMemo(() => {
    return [...modules].sort(
      (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0),
    )
  }, [modules])

  const currentIdx = orderedModules.findIndex((m) => m.module_id === moduleId)
  const prev = currentIdx > 0 ? orderedModules[currentIdx - 1] : null
  const next =
    currentIdx >= 0 && currentIdx < orderedModules.length - 1
      ? orderedModules[currentIdx + 1]
      : null

  if (loading) {
    return <div className="px-6 py-16 text-center text-sm text-muted-foreground">加载中...</div>
  }
  if (error || !knode) {
    return (
      <div className="px-6 py-12">
        <p className="mb-3 text-sm text-muted-foreground">{error || "无法加载"}</p>
        <Link
          href={`/library/${encodeURIComponent(slug)}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft size={14} />
          返回项目页
        </Link>
      </div>
    )
  }

  const sections = (knode.rendered_sections || {}) as SectionsData
  const renderedById: Record<string, RenderedSection> = sections.rendered_sections || {}

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border/60 bg-card p-4">
          <Link
            href={`/library/${encodeURIComponent(slug)}`}
            className="-ml-2 mb-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft size={12} />
            项目首页
          </Link>
          <h3 className="mb-2 text-sm font-semibold">章节</h3>
          <ul className="space-y-0.5">
            {orderedModules.map((m) => (
              <li key={m.module_id}>
                <Link
                  href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(m.module_id)}`}
                  className={`block rounded-md px-2 py-1.5 text-sm transition ${
                    m.module_id === moduleId
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span className="mr-2 font-mono text-[11px]">{m.module_id}</span>
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <article className="min-w-0 flex-1 space-y-8">
        <header>
          <p className="font-mono text-xs text-muted-foreground">{moduleId}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{knode.title}</h1>
          {knode.summary && (
            <p className="mt-2 text-sm text-muted-foreground">{knode.summary}</p>
          )}
        </header>

        <PlanRenderer
          planMarkdown={knode.plan_markdown || ""}
          renderedById={renderedById}
          slug={slug}
          knodeDir={knode.knode_dir || ""}
        />

        {knode.assignment_md && (
          <section className="rounded-2xl border border-border/60 bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">作业</h2>
            <article className="prose prose-stone max-w-none text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {knode.assignment_md}
              </ReactMarkdown>
            </article>
          </section>
        )}

        <nav className="flex items-center justify-between gap-4 pt-6">
          {prev ? (
            <Link
              href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(prev.module_id)}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-4 py-2 text-sm hover:bg-accent"
            >
              <ChevronLeft size={14} />
              {prev.module_id} · {prev.title}
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(next.module_id)}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {next.module_id} · {next.title}
              <ChevronRight size={14} />
            </Link>
          ) : (
            <Link
              href={`/library/${encodeURIComponent(slug)}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <BookOpen size={14} />
              返回项目首页
            </Link>
          )}
        </nav>
      </article>
    </div>
  )
}

function PlanRenderer({
  planMarkdown,
  renderedById,
  slug,
  knodeDir,
}: {
  planMarkdown: string
  renderedById: Record<string, RenderedSection>
  slug: string
  knodeDir: string
}) {
  // 切 plan_markdown 按 [[IDEA:xxx]] 占位
  const parts = useMemo(() => {
    if (!planMarkdown) return []
    const re = /\[\[IDEA:([^\]]+)\]\]/g
    const result: Array<{ type: "md"; content: string } | { type: "idea"; id: string }> = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(planMarkdown)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: "md", content: planMarkdown.slice(lastIndex, match.index) })
      }
      result.push({ type: "idea", id: match[1] })
      lastIndex = re.lastIndex
    }
    if (lastIndex < planMarkdown.length) {
      result.push({ type: "md", content: planMarkdown.slice(lastIndex) })
    }
    return result
  }, [planMarkdown])

  if (parts.length === 0) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        本章节没有内容。
      </section>
    )
  }

  return (
    <section className="space-y-6">
      {parts.map((part, i) => {
        if (part.type === "md") {
          return (
            <div
              key={i}
              className="prose prose-stone max-w-none text-sm [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>
            </div>
          )
        }
        const section = renderedById[part.id]
        if (!section) {
          return (
            <div
              key={i}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
            >
              缺少 idea: {part.id}
            </div>
          )
        }
        return (
          <IdeaRenderer
            key={i}
            section={section}
            slug={slug}
            knodeDir={knodeDir}
            ideaId={part.id}
          />
        )
      })}
    </section>
  )
}

function IdeaRenderer({
  section,
  slug,
  knodeDir,
  ideaId,
}: {
  section: RenderedSection
  slug: string
  knodeDir: string
  ideaId: string
}) {
  if (section.mode === "animation" || section.mode === "game") {
    const label = section.mode === "animation" ? "动画" : "互动游戏"
    let src: string | undefined
    if (section.html_path) {
      const rel = section.html_path
      const path = knodeDir ? `${knodeDir}/${rel}` : rel
      const token = typeof window !== "undefined" ? getToken() : null
      src =
        library.fileUrl(slug, path) +
        (token ? `?token=${encodeURIComponent(token)}` : "")
    }
    return (
      <figure className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <figcaption className="border-b border-border/60 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label} · {ideaId}
        </figcaption>
        {src ? (
          <iframe
            src={src}
            className="h-[640px] w-full"
            sandbox="allow-scripts allow-same-origin"
            title={ideaId}
          />
        ) : section.html ? (
          <iframe
            srcDoc={section.html}
            className="h-[640px] w-full"
            sandbox="allow-scripts"
            title={ideaId}
          />
        ) : (
          <div className="p-6 text-sm text-muted-foreground">资源缺失</div>
        )}
      </figure>
    )
  }
  if (section.mode === "exercise" && section.exercises) {
    return <ExerciseBlock exercises={section.exercises} ideaId={ideaId} />
  }
  if (section.mode === "story" && section.story_paragraphs) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <h3 className="mb-3 text-base font-semibold uppercase tracking-wider text-muted-foreground">
          故事
        </h3>
        <div className="space-y-3 text-sm">
          {section.story_paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 text-xs text-muted-foreground">
      {section.mode} · {ideaId}
    </section>
  )
}

function ExerciseBlock({
  exercises,
  ideaId,
}: {
  exercises: NonNullable<RenderedSection["exercises"]>
  ideaId: string
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({})

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6">
      <h3 className="mb-4 text-base font-semibold">练习 · {ideaId}</h3>
      <ol className="space-y-6 text-sm">
        {exercises.map((ex, idx) => {
          const picked = answers[idx]
          const correct = ex.correct_option_index ?? -1
          const answered = picked !== undefined
          return (
            <li key={idx} className="space-y-2">
              <p className="font-medium">
                <span className="mr-2 text-muted-foreground">Q{idx + 1}.</span>
                {ex.question}
              </p>
              {ex.options && (
                <div className="space-y-1.5">
                  {ex.options.map((opt, oi) => {
                    const isPicked = picked === oi
                    const isCorrect = oi === correct
                    let cls = "border-border/70"
                    if (answered) {
                      if (isCorrect) cls = "border-green-500 bg-green-50"
                      else if (isPicked) cls = "border-red-400 bg-red-50"
                    } else if (isPicked) cls = "border-primary"
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [idx]: oi }))
                        }
                        disabled={answered}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${cls}`}
                      >
                        <span className="mr-2 font-mono text-xs text-muted-foreground">
                          {String.fromCharCode(65 + oi)}.
                        </span>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              )}
              {answered && ex.explanation && (
                <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  {ex.explanation}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
