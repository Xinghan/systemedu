"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  Clock,
  Layers,
  Lock,
  Network,
  Search,
} from "lucide-react"
import { library, myProjects, setCurrentModuleId } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { CourseContentView } from "@/components/learning/course-content-view"
import { ChatPanel } from "@/components/chat/chat-panel"
import { KnowledgeTreeModal } from "@/components/learning/knowledge-tree-modal"
import { KnodeCompleteButton } from "@/components/learning/KnodeCompleteButton"
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

  const [knodeMeta, setKnodeMeta] = useState<{
    title: string
    summary: string
    week?: number | null
    duration_minutes?: number | null
  } | null>(null)
  const [projectTitle, setProjectTitle] = useState<string>("")
  const [lastModuleId, setLastModuleId] = useState<string | null>(null)
  const [modules, setModules] = useState<ProjectTreeModule[]>([])
  const [stages, setStages] = useState<ProjectTreeStage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agentOpen, setAgentOpen] = useState(true)
  const [treeOpen, setTreeOpen] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (loggedIn === false) {
      router.replace(`/login?next=${encodeURIComponent(`/learn/${slug}/${moduleId}`)}`)
    }
  }, [loggedIn, slug, moduleId, router])

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
        const [k, tree, projectMeta] = await Promise.all([
          library.getKnode(slug, moduleId),
          library.getTree(slug).catch(() => null),
          library.getProject(slug).catch(() => null),
        ])
        setKnodeMeta({
          title: k.title,
          summary: k.summary || "",
          week: k.week,
          duration_minutes: k.duration_minutes,
        })
        if (projectMeta) setProjectTitle(projectMeta.title_zh || projectMeta.title)
        if (tree) {
          const tmodules = (tree as { modules?: ProjectTreeModule[] }).modules || []
          const tstages = (tree as { stages?: ProjectTreeStage[] }).stages || []
          setModules(tmodules)
          setStages(tstages)
        }
        // 拉自己进度
        myProjects.list().then((mine) => {
          const item = mine.find((m) => m.slug === slug)
          if (item) setLastModuleId(item.last_module_id ?? null)
        }).catch(() => {})
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

  const orderedModules = useMemo(
    () =>
      [...modules].sort(
        (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0),
      ),
    [modules],
  )

  const modulesByStage = useMemo(() => {
    const grouped: Record<string, ProjectTreeModule[]> = {}
    for (const m of orderedModules) {
      const k = m.stage_id || "_"
      if (!grouped[k]) grouped[k] = []
      grouped[k].push(m)
    }
    return grouped
  }, [orderedModules])

  const filteredStages = useMemo(() => {
    if (!search.trim()) return stages
    const q = search.toLowerCase()
    return stages.filter((s) =>
      (modulesByStage[s.stage_id] || []).some(
        (m) =>
          m.module_id.toLowerCase().includes(q) ||
          m.title.toLowerCase().includes(q),
      ),
    )
  }, [stages, modulesByStage, search])

  const currentIdx = orderedModules.findIndex((m) => m.module_id === moduleId)
  const prev = currentIdx > 0 ? orderedModules[currentIdx - 1] : null
  const next =
    currentIdx >= 0 && currentIdx < orderedModules.length - 1
      ? orderedModules[currentIdx + 1]
      : null

  const currentStage = stages.find(
    (s) => s.stage_id === orderedModules[currentIdx]?.stage_id,
  )
  const completedCount = lastModuleId
    ? orderedModules.findIndex((m) => m.module_id === lastModuleId)
    : 0
  const totalModules = orderedModules.length
  const pct = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0

  const knodeForView: KnodeInfo | null = useMemo(() => {
    if (!knodeMeta) return null
    return {
      id: moduleIdToInt(moduleId),
      title: knodeMeta.title,
      summary: knodeMeta.summary,
      difficulty_level: 0,
      content_type: "knowledge",
      acceptance_type: "",
      estimated_minutes: knodeMeta.duration_minutes || 0,
      xp_reward: 0,
      prerequisite_indices: [],
      module_id: moduleId,
    } as KnodeInfo
  }, [knodeMeta, moduleId])

  function moduleStatus(idx: number, code: string): "done" | "current" | "next" {
    if (code === moduleId) return "current"
    if (lastModuleId) {
      const lastIdx = orderedModules.findIndex((m) => m.module_id === lastModuleId)
      if (lastIdx >= 0 && idx < lastIdx) return "done"
    }
    return "next"
  }

  if (loading) {
    return (
      <main
        style={{
          height: "calc(100vh - 57px)",
          display: "grid",
          placeItems: "center",
          color: "var(--sub)",
          fontSize: 14,
        }}
      >
        加载中…
      </main>
    )
  }
  if (error || !knodeForView) {
    return (
      <main style={{ padding: 48, textAlign: "center" }}>
        <p style={{ marginBottom: 12, color: "var(--sub)" }}>
          {error || "无法加载"}
        </p>
        <Link href={`/library/${encodeURIComponent(slug)}`} className="btn btn-ghost btn-sm">
          <ChevronLeft size={13} strokeWidth={1.5} /> 返回项目页
        </Link>
      </main>
    )
  }

  return (
    <main
      style={{
        display: "grid",
        gridTemplateColumns: `300px 1fr ${agentOpen ? "380px" : "56px"}`,
        height: "calc(100vh - 57px)",
      }}
    >
      {/* ============ LEFT — Module nav ============ */}
      <aside
        style={{
          borderRight: "1px solid var(--border)",
          background: "var(--paper-2)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}
        >
          <Link
            href={`/library/${encodeURIComponent(slug)}`}
            style={{
              padding: 0,
              color: "var(--sub)",
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ChevronLeft size={13} strokeWidth={1.5} /> Project home
          </Link>
          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.3,
              letterSpacing: "-.015em",
            }}
          >
            {projectTitle || slug}
          </div>
          <div
            className="mono"
            style={{ fontSize: 10.5, color: "var(--sub-2)", marginTop: 4 }}
          >
            {slug}
          </div>
          {totalModules > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10.5,
                  color: "var(--sub)",
                  fontFamily: "var(--mono)",
                  marginBottom: 5,
                }}
              >
                <span>
                  {completedCount} / {totalModules}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="bar violet">
                <i style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div
          style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}
        >
          <div
            className="kbar"
            style={{
              minWidth: 0,
              width: "100%",
              height: 30,
              padding: "0 8px 0 10px",
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <Search size={13} strokeWidth={1.5} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules…"
              style={{
                flex: 1,
                border: 0,
                outline: "none",
                background: "transparent",
                fontSize: 12,
                color: "var(--ink)",
              }}
            />
          </div>
        </div>

        {/* Modules list */}
        <div style={{ flex: 1, padding: "4px 0 30px" }}>
          {filteredStages.length === 0 && stages.length === 0 && (
            <div style={{ padding: "20px 18px", color: "var(--sub)", fontSize: 12 }}>
              无章节数据
            </div>
          )}
          {filteredStages.map((sec) => (
            <div key={sec.stage_id} style={{ paddingTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 18px",
                  color: "var(--sub-2)",
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 10.5, letterSpacing: ".06em" }}
                >
                  {sec.stage_id} · {sec.title}
                </span>
              </div>
              {(modulesByStage[sec.stage_id] || []).map((m) => {
                const active = m.module_id === moduleId
                const idx = orderedModules.findIndex(
                  (x) => x.module_id === m.module_id,
                )
                const st = moduleStatus(idx, m.module_id)
                return (
                  <Link
                    key={m.module_id}
                    href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(m.module_id)}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto auto 1fr",
                      gap: 10,
                      alignItems: "center",
                      width: "100%",
                      padding: "8px 18px",
                      background: active ? "var(--card)" : "transparent",
                      borderLeft: active
                        ? "2px solid var(--violet)"
                        : "2px solid transparent",
                      textDecoration: "none",
                    }}
                  >
                    {st === "done" ? (
                      <CircleCheck
                        size={14}
                        strokeWidth={1.5}
                        style={{ color: "var(--emerald)" }}
                      />
                    ) : st === "current" ? (
                      <CircleDot
                        size={14}
                        strokeWidth={1.5}
                        style={{ color: "var(--violet)" }}
                      />
                    ) : (
                      <Circle
                        size={14}
                        strokeWidth={1.5}
                        style={{ color: "var(--sub-2)" }}
                      />
                    )}
                    <span
                      className="mono"
                      style={{ fontSize: 10.5, color: "var(--sub-2)", width: 24 }}
                    >
                      {m.module_id}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: active
                          ? "var(--ink)"
                          : st === "done"
                            ? "var(--sub)"
                            : "var(--ink-2)",
                        lineHeight: 1.35,
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {m.title}
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* ============ CENTER — Content ============ */}
      <section
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          background: "var(--paper)",
        }}
      >
        {/* sticky header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "var(--paper)",
            zIndex: 5,
            padding: "14px 36px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="tag violet">
              {currentStage?.stage_id || "—"} · {moduleId}
            </span>
            {knodeMeta?.duration_minutes ? (
              <span className="tag" style={{ background: "var(--paper-2)" }}>
                <Clock size={11} strokeWidth={1.5} /> est. {knodeMeta.duration_minutes} min
              </span>
            ) : null}
            {knodeMeta?.week ? (
              <span className="tag" style={{ background: "var(--paper-2)" }}>
                <Layers size={11} strokeWidth={1.5} /> wk {knodeMeta.week}
              </span>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {prev && (
              <Link
                href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(prev.module_id)}`}
                className="btn btn-ghost btn-sm"
              >
                <ChevronLeft size={13} strokeWidth={1.5} /> {prev.module_id}
              </Link>
            )}
            {next && (
              <Link
                href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(next.module_id)}`}
                className="btn btn-ghost btn-sm"
              >
                {next.module_id} <ChevronRight size={13} strokeWidth={1.5} />
              </Link>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setTreeOpen(true)}
              disabled={modules.length === 0}
            >
              <Network size={13} strokeWidth={1.5} /> Tree
            </button>
            {/* spec 036: 标记完成 toggle (会同步点亮 platform 知识树节点) */}
            <KnodeCompleteButton slug={slug} knodeId={moduleId} />
          </div>
        </div>

        {/* article */}
        <article
          style={{
            padding: "32px 56px 64px",
            maxWidth: 880,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div className="mono" style={{ fontSize: 11, color: "var(--sub)" }}>
            {currentStage?.stage_id || "—"} · {moduleId}
          </div>
          <h1
            style={{
              fontSize: 32,
              lineHeight: 1.15,
              letterSpacing: "-.025em",
              marginTop: 8,
              fontWeight: 600,
            }}
          >
            {knodeMeta?.title}
          </h1>
          {knodeMeta?.summary && (
            <p
              className="body"
              style={{
                fontSize: 15,
                color: "var(--sub)",
                maxWidth: 720,
                marginTop: 10,
                lineHeight: 1.55,
              }}
            >
              {knodeMeta.summary}
            </p>
          )}

          {/* CourseContentView 自己渲染 plan_markdown + ideas + theories + assignment */}
          <div style={{ marginTop: 24 }}>
            <CourseContentView
              projectName={slug}
              nodeId={knodeForView.id}
              knode={knodeForView}
              onClose={() => router.push(`/library/${encodeURIComponent(slug)}`)}
              onMarkComplete={() => {
                myProjects.setProgress(slug, moduleId).catch(() => {})
              }}
            />
          </div>

          {/* footer nav */}
          <div
            style={{
              marginTop: 48,
              paddingTop: 18,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {prev ? (
              <Link
                href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(prev.module_id)}`}
                className="btn btn-ghost"
              >
                <ChevronLeft size={14} strokeWidth={1.5} /> {prev.module_id}
              </Link>
            ) : (
              <span />
            )}
            <span className="mono" style={{ fontSize: 10.5, color: "var(--sub)" }}>
              {moduleId} · auto-saved
            </span>
            {next ? (
              <Link
                href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(next.module_id)}`}
                className="btn btn-violet"
              >
                {next.module_id} <ChevronRight size={14} strokeWidth={1.5} />
              </Link>
            ) : (
              <Link
                href={`/library/${encodeURIComponent(slug)}`}
                className="btn btn-violet"
              >
                返回项目首页
              </Link>
            )}
          </div>
        </article>
      </section>

      {/* ============ RIGHT — AI tutor ============ */}
      <aside
        style={{
          borderLeft: "1px solid var(--border)",
          background: "var(--card)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {agentOpen ? (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* outer header — brand + 折叠 */}
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "var(--ink)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Bot size={15} strokeWidth={1.5} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>AI 助教</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--sub)" }}>
                    GLM · 6 skills · soc/dir/scaff/pbl/refl/err
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAgentOpen(false)}
                aria-label="折叠 AI 助教"
                style={{
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--sub)",
                  padding: 4,
                }}
              >
                <ChevronRight size={14} strokeWidth={1.5} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ChatPanel librarySlug={slug} moduleId={moduleId} />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAgentOpen(true)}
            aria-label="展开 AI 助教"
            style={{
              width: 56,
              padding: "16px 0",
              border: 0,
              background: "transparent",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              color: "var(--sub)",
            }}
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
            <Bot size={18} strokeWidth={1.5} style={{ color: "var(--violet)" }} />
          </button>
        )}
      </aside>

      {treeOpen && (
        <KnowledgeTreeModal
          slug={slug}
          projectTitle={projectTitle || slug}
          stages={stages}
          modules={modules}
          lastModuleId={lastModuleId}
          pulled={true}
          onClose={() => setTreeOpen(false)}
        />
      )}
    </main>
  )
}
