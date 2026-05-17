"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  MessageSquare,
  X,
} from "lucide-react"
import { library, myProjects, setCurrentModuleId } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { CourseContentView } from "@/components/learning/course-content-view"
import { ChatPanel } from "@/components/chat/chat-panel"
import type { KnodeInfo } from "@/lib/types/api"

interface ProjectTreeModule {
  module_id: string
  title: string
  stage_id?: string
  sequence_order?: number
  summary?: string
}

interface ProjectTreeStage {
  stage_id: string
  title: string
}

// 从 moduleId 字符串生成稳定 int (CourseContentView 内部缓存 key 用)
function moduleIdToInt(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export default function LearnPage() {
  const params = useParams<{ slug: string; moduleId: string }>()
  const slug = decodeURIComponent(params.slug)
  const moduleId = decodeURIComponent(params.moduleId)
  const router = useRouter()
  const { loggedIn, hydrate } = useAuthStore()

  const [knodeMeta, setKnodeMeta] = useState<{ title: string; summary: string } | null>(null)
  const [modules, setModules] = useState<ProjectTreeModule[]>([])
  const [stages, setStages] = useState<ProjectTreeStage[]>([])
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

  // gateway shim 需要知道当前 moduleId — 因为 CourseContentView 把字符串 moduleId
  // 透传成 nodeId int, 我们的 shim 用 _currentModuleId 反查
  useEffect(() => {
    setCurrentModuleId(moduleId)
    return () => setCurrentModuleId(null)
  }, [moduleId])

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
        setKnodeMeta({ title: k.title, summary: k.summary || "" })
        if (tree) {
          const tmodules = (tree as { modules?: ProjectTreeModule[] }).modules || []
          const tstages = (tree as { stages?: ProjectTreeStage[] }).stages || []
          setModules(tmodules)
          setStages(tstages)
        }
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

  const modulesByStage = useMemo(() => {
    const grouped: Record<string, ProjectTreeModule[]> = {}
    for (const m of orderedModules) {
      const k = m.stage_id || "_"
      if (!grouped[k]) grouped[k] = []
      grouped[k].push(m)
    }
    return grouped
  }, [orderedModules])

  const currentIdx = orderedModules.findIndex((m) => m.module_id === moduleId)
  const prev = currentIdx > 0 ? orderedModules[currentIdx - 1] : null
  const next =
    currentIdx >= 0 && currentIdx < orderedModules.length - 1
      ? orderedModules[currentIdx + 1]
      : null

  // 给 CourseContentView 喂一个最简 KnodeInfo (它真用的字段不多)
  const knodeForView: KnodeInfo | null = useMemo(() => {
    if (!knodeMeta) return null
    return {
      id: moduleIdToInt(moduleId),
      title: knodeMeta.title,
      summary: knodeMeta.summary,
      difficulty_level: 0,
      content_type: "knowledge",
      acceptance_type: "",
      estimated_minutes: 0,
      xp_reward: 0,
      prerequisite_indices: [],
      module_id: moduleId,
    } as KnodeInfo
  }, [knodeMeta, moduleId])

  if (loading) {
    return (
      <div className="px-6 py-16 text-center text-sm text-muted-foreground">
        加载中...
      </div>
    )
  }
  if (error || !knodeForView) {
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

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
      <aside className="hidden w-56 shrink-0 md:block xl:w-64">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border/60 bg-card p-4">
          <Link
            href={`/library/${encodeURIComponent(slug)}`}
            className="-ml-2 mb-3 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft size={12} />
            项目首页
          </Link>
          {stages.length > 0 ? (
            <div className="space-y-4">
              {stages.map((s) => (
                <div key={s.stage_id}>
                  <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.stage_id} · {s.title}
                  </div>
                  <ul className="space-y-0.5">
                    {(modulesByStage[s.stage_id] || []).map((m) => (
                      <ModuleLink
                        key={m.module_id}
                        slug={slug}
                        m={m}
                        active={m.module_id === moduleId}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {orderedModules.map((m) => (
                <ModuleLink
                  key={m.module_id}
                  slug={slug}
                  m={m}
                  active={m.module_id === moduleId}
                />
              ))}
            </ul>
          )}
        </div>
      </aside>

      <article className="min-w-0 flex-1">
        {/* CourseContentView 自己渲染整个 plan_markdown + ideas + assignment + audio */}
        <CourseContentView
          projectName={slug}
          nodeId={knodeForView.id}
          knode={knodeForView}
          onClose={() => router.push(`/library/${encodeURIComponent(slug)}`)}
          onMarkComplete={() => {
            myProjects.setProgress(slug, moduleId).catch(() => {})
          }}
        />

        <nav className="mt-8 flex items-center justify-between gap-4">
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
              返回项目首页
            </Link>
          )}
        </nav>

      </article>

      {/* spec 028: AI 助教浮动按钮 + 右侧 drawer */}
      <ChatDock librarySlug={slug} moduleId={moduleId} />
    </div>
  )
}

function ChatDock({
  librarySlug,
  moduleId,
}: {
  librarySlug: string
  moduleId: string
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="AI 助教"
          className="fixed bottom-6 right-6 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-lg transition hover:bg-primary/90 hover:shadow-xl"
        >
          <MessageSquare size={18} />
          AI 助教
        </button>
      )}
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border/60 bg-background shadow-2xl md:max-w-lg">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭"
            className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={16} />
          </button>
          <ChatPanel librarySlug={librarySlug} moduleId={moduleId} />
        </div>
      )}
    </>
  )
}

function ModuleLink({
  slug,
  m,
  active,
}: {
  slug: string
  m: ProjectTreeModule
  active: boolean
}) {
  return (
    <li>
      <Link
        href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(m.module_id)}`}
        className={`block rounded-md px-2 py-1.5 text-sm transition ${
          active
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        <span className="mr-2 font-mono text-[11px]">{m.module_id}</span>
        {m.title}
      </Link>
    </li>
  )
}
