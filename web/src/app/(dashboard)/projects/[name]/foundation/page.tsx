"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import { ArrowLeft, BookOpen, LayoutGrid, Share2, ListTree, X, Search, Sparkles } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { PageLoading } from "@/components/ui/page-loading"
import { gateway } from "@/lib/api"
import type { AggregatedTheory, KnowledgeLevel, ProjectDetail, ProjectTheoriesResponse } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

type T = (k: string, p?: Record<string, unknown>) => string

const FoundationGraph = dynamic(
  () => import("@/components/foundation/foundation-graph").then((m) => m.FoundationGraph),
  { ssr: false, loading: () => <div className="h-[520px] flex items-center justify-center text-xs text-muted-foreground">loading graph...</div> },
)

const SUBJECT_LABELS_ZH: Record<string, string> = {
  math: "数学",
  physics: "物理",
  chemistry: "化学",
  biology: "生物",
  cs: "计算机科学",
  engineering: "工程",
  geography: "地理",
  history: "历史",
  philosophy: "哲学",
  methodology: "方法论",
  other: "其它",
}

const SUBJECT_COLORS: Record<string, string> = {
  math: "#6366f1",
  physics: "#3b82f6",
  chemistry: "#14b8a6",
  biology: "#22c55e",
  cs: "#a855f7",
  engineering: "#f97316",
  geography: "#0ea5e9",
  history: "#eab308",
  philosophy: "#8b5cf6",
  methodology: "#ec4899",
  other: "#6b7280",
}

const LEVELS: KnowledgeLevel[] = ["K1", "K2", "K3", "K4", "K5"]
const LEVEL_DESC: Record<KnowledgeLevel, string> = {
  K1: "K1 生活化",
  K2: "K2 入门",
  K3: "K3 初高中",
  K4: "K4 高中进阶",
  K5: "K5 大学",
}

type Tab = "cards" | "graph" | "chapters"

function pickBody(theory: AggregatedTheory, level: KnowledgeLevel): { level: string; body: string } {
  const exact = theory.levels.find((lb) => lb.level === level)
  if (exact) return { level: exact.level, body: exact.body_markdown }
  const order = LEVELS
  const targetIdx = order.indexOf(level)
  for (let i = targetIdx - 1; i >= 0; i--) {
    const fb = theory.levels.find((lb) => lb.level === order[i])
    if (fb) return { level: fb.level, body: fb.body_markdown }
  }
  for (let i = targetIdx + 1; i < order.length; i++) {
    const fb = theory.levels.find((lb) => lb.level === order[i])
    if (fb) return { level: fb.level, body: fb.body_markdown }
  }
  return { level: theory.levels[0]?.level ?? "K1", body: theory.levels[0]?.body_markdown ?? "" }
}

function subjectLabel(s: string, t: T): string {
  return SUBJECT_LABELS_ZH[s] || t("foundation.subject_other")
}

export default function FoundationPage() {
  const params = useParams<{ name: string }>()
  const router = useRouter()
  const t = useT() as unknown as T
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [data, setData] = useState<ProjectTheoriesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("cards")
  const [level, setLevel] = useState<KnowledgeLevel>("K1")
  const [savingLevel, setSavingLevel] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [activeTheory, setActiveTheory] = useState<AggregatedTheory | null>(null)

  useEffect(() => {
    if (!params.name) return
    let cancelled = false
    ;(async () => {
      try {
        const [d, th] = await Promise.all([
          gateway.project(params.name),
          gateway.projectTheories(params.name),
        ])
        if (cancelled) return
        setDetail(d)
        setData(th)
        const projLevel = (d.project as { knowledge_level?: KnowledgeLevel }).knowledge_level || "K1"
        setLevel(projLevel)
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [params.name])

  const handleLevelChange = useCallback(async (next: KnowledgeLevel) => {
    setLevel(next)
    setSavingLevel(true)
    try {
      await gateway.updateProject(params.name, { knowledge_level: next })
    } catch { /* non-fatal */ }
    setSavingLevel(false)
  }, [params.name])

  const filtered = useMemo(() => {
    if (!data) return []
    let list = data.theories
    if (selectedSubject) {
      // selectedSubject may be a tag path or a legacy subject keyword
      list = list.filter((x) => {
        const tagMatch = (x.tags || []).some(
          (t) => t === selectedSubject || t.startsWith(selectedSubject + "/"),
        )
        return tagMatch || (x.subject || "other") === selectedSubject
      })
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((x) =>
        x.title.toLowerCase().includes(q) ||
        x.knode_title.toLowerCase().includes(q) ||
        (x.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        x.levels.some((lb) => lb.body_markdown.toLowerCase().includes(q)),
      )
    }
    return list
  }, [data, selectedSubject, query])

  const bySubject = useMemo(() => {
    const m: Record<string, AggregatedTheory[]> = {}
    for (const th of filtered) {
      const firstTag = (th.tags || [])[0] || ""
      const key = firstTag.split("/")[0] || th.subject || "other"
      if (!m[key]) m[key] = []
      m[key].push(th)
    }
    return m
  }, [filtered])

  const byStage = useMemo(() => {
    const m: Record<string, { title: string; idx: number; theories: AggregatedTheory[] }> = {}
    for (const th of filtered) {
      const key = String(th.stage_idx)
      if (!m[key]) m[key] = { title: th.stage_title, idx: th.stage_idx, theories: [] }
      m[key].theories.push(th)
    }
    return Object.values(m).sort((a, b) => a.idx - b.idx)
  }, [filtered])

  if (loading) return <PageLoading />

  const totalTheories = data?.total ?? 0
  // Derive top-level tag buckets (fallback to legacy subject)
  const topLevelCounts: Record<string, number> = {}
  for (const th of data?.theories ?? []) {
    const firstTag = (th.tags || [])[0] || ""
    const key = firstTag.split("/")[0] || th.subject || "other"
    topLevelCounts[key] = (topLevelCounts[key] ?? 0) + 1
  }
  const subjectKeys = Object.keys(topLevelCounts).sort((a, b) => (topLevelCounts[b] ?? 0) - (topLevelCounts[a] ?? 0))
  const subjectCounts = topLevelCounts

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Back + title */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.push(`/projects/${params.name}`)}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-violet-600" />
            <h1 className="text-xl font-extrabold text-foreground">{t("foundation.title")}</h1>
            <span className="text-xs text-muted-foreground ml-2">
              {detail?.project.title} · {t("foundation.theory_count", { n: totalTheories })}
            </span>
          </div>
        </div>

        {/* Level selector + search */}
        <div className="flex flex-wrap items-center gap-3 mb-5 rounded-2xl border border-border/60 bg-card px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("foundation.level_label")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => handleLevelChange(l)}
                className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all ${
                  level === l
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                }`}
                title={LEVEL_DESC[l]}
              >
                {l}
              </button>
            ))}
          </div>
          {savingLevel && <span className="text-[10px] text-muted-foreground">{t("foundation.saving")}</span>}
          <span className="text-[10px] text-muted-foreground ml-1">{LEVEL_DESC[level]}</span>

          <div className="flex-1 min-w-[180px] flex items-center gap-2 ml-auto">
            <div className="relative flex-1 max-w-xs ml-auto">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("foundation.search_placeholder")}
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-secondary/60 border border-border/40 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/40"
              />
            </div>
          </div>
        </div>

        {/* Subject filter pills */}
        {subjectKeys.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-5">
            <button
              onClick={() => setSelectedSubject(null)}
              className={`h-7 px-3 rounded-full text-xs font-semibold transition-all ${
                selectedSubject === null
                  ? "bg-foreground text-background"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {t("foundation.all_subjects")} · {totalTheories}
            </button>
            {subjectKeys.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSubject(s === selectedSubject ? null : s)}
                style={{
                  background: selectedSubject === s ? SUBJECT_COLORS[s] || "#6b7280" : undefined,
                }}
                className={`h-7 px-3 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  selectedSubject === s
                    ? "text-white"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: SUBJECT_COLORS[s] || "#6b7280" }}
                />
                {subjectLabel(s, t)} · {subjectCounts[s]}
              </button>
            ))}
          </div>
        )}

        {/* Sub-tag drill-down (shown when a top-level is selected) */}
        {selectedSubject && data && (() => {
          const subCounts: Record<string, number> = {}
          for (const th of data.theories) {
            for (const tg of (th.tags || [])) {
              if (tg === selectedSubject || tg.startsWith(selectedSubject + "/")) {
                const rest = tg.slice(selectedSubject.length).replace(/^\//, "")
                const next = rest.split("/")[0]
                if (next) subCounts[next] = (subCounts[next] ?? 0) + 1
              }
            }
          }
          const subKeys = Object.keys(subCounts).sort((a, b) => subCounts[b] - subCounts[a])
          if (subKeys.length === 0) return null
          return (
            <div className="flex flex-wrap items-center gap-1.5 mb-5 pl-2">
              <span className="text-[10px] text-muted-foreground">↳</span>
              {subKeys.map((sub) => {
                const path = `${selectedSubject}/${sub}`
                const active = selectedSubject === path
                return (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(active ? selectedSubject : path)}
                    className={`h-6 px-2.5 rounded-full text-[10px] font-medium transition-all ${
                      active
                        ? "bg-violet-600 text-white"
                        : "bg-secondary/40 text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {sub} · {subCounts[sub]}
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-border/50">
          <TabButton active={tab === "cards"} icon={<LayoutGrid className="h-3.5 w-3.5" />} onClick={() => setTab("cards")}>
            {t("foundation.tab_cards")}
          </TabButton>
          <TabButton active={tab === "graph"} icon={<Share2 className="h-3.5 w-3.5" />} onClick={() => setTab("graph")}>
            {t("foundation.tab_graph")}
          </TabButton>
          <TabButton active={tab === "chapters"} icon={<ListTree className="h-3.5 w-3.5" />} onClick={() => setTab("chapters")}>
            {t("foundation.tab_chapters")}
          </TabButton>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-sm text-muted-foreground">
            {totalTheories === 0 ? t("foundation.empty_no_theories") : t("foundation.empty_no_match")}
          </div>
        ) : tab === "cards" ? (
          <div className="space-y-6">
            {Object.entries(bySubject).map(([sub, items]) => (
              <section key={sub}>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: SUBJECT_COLORS[sub] || "#6b7280" }}
                  />
                  <h2 className="text-sm font-bold text-foreground">{subjectLabel(sub, t)}</h2>
                  <span className="text-xs text-muted-foreground">· {items.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((th) => (
                    <TheoryCard key={th.theory_id + "-" + th.knode_id} theory={th} level={level} onClick={() => setActiveTheory(th)} t={t} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : tab === "chapters" ? (
          <div className="space-y-6">
            {byStage.map((st) => (
              <section key={st.idx}>
                <h2 className="text-sm font-bold text-foreground mb-3">{st.title}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {st.theories.map((th) => (
                    <TheoryCard key={th.theory_id + "-" + th.knode_id} theory={th} level={level} onClick={() => setActiveTheory(th)} t={t} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <FoundationGraph theories={filtered} subjectColors={SUBJECT_COLORS} onNodeClick={(th) => setActiveTheory(th)} />
        )}
      </div>

      {/* Modal */}
      {activeTheory && (
        <TheoryModal theory={activeTheory} level={level} onClose={() => setActiveTheory(null)} t={t} projectName={params.name} router={router} />
      )}
    </div>
  )
}

function TabButton({ active, icon, onClick, children }: { active: boolean; icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
        active ? "border-violet-600 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function TheoryCard({ theory, level, onClick, t }: { theory: AggregatedTheory; level: KnowledgeLevel; onClick: () => void; t: (k: string, p?: Record<string, unknown>) => string }) {
  const { level: usedLevel, body } = pickBody(theory, level)
  const preview = body.replace(/[#*_`$\[\]()]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
  const color = SUBJECT_COLORS[theory.subject] || "#6b7280"

  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-border/60 bg-card hover:border-violet-400/40 hover:shadow-[0_4px_16px_rgba(139,92,246,0.08)] p-4 transition-all group"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
          {theory.subject || "other"}
        </span>
        <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded ${
          usedLevel === level ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        }`}>
          {usedLevel}
          {usedLevel !== level && " ≈"}
        </span>
      </div>
      <h3 className="text-sm font-bold text-foreground mb-1 group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors line-clamp-2">
        {theory.title}
      </h3>
      <p className="text-[11px] text-muted-foreground mb-2 line-clamp-3">{preview}</p>
      <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1.5">
        <BookOpen className="h-3 w-3" />
        <span className="truncate">{theory.knode_title}</span>
      </div>
    </button>
  )
}

function TheoryModal({ theory, level, onClose, t, projectName, router }: {
  theory: AggregatedTheory
  level: KnowledgeLevel
  onClose: () => void
  t: (k: string, p?: Record<string, unknown>) => string
  projectName: string
  router: ReturnType<typeof useRouter>
}) {
  const { level: usedLevel, body } = pickBody(theory, level)
  const color = SUBJECT_COLORS[theory.subject] || "#6b7280"
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] rounded-2xl bg-card shadow-2xl border border-border/60 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 py-4 border-b border-border/60 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
                {theory.subject || "other"}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                {usedLevel}
              </span>
              {usedLevel !== level && (
                <span className="text-[10px] text-amber-600">{t("foundation.fallback_level")}</span>
              )}
            </div>
            <h2 className="text-lg font-extrabold text-foreground">{theory.title}</h2>
            <button
              onClick={() => router.push(`/learn/${projectName}?node=${theory.knode_id}`)}
              className="mt-1 text-xs text-violet-600 hover:underline"
            >
              {t("foundation.go_to_knode", { title: theory.knode_title })}
            </button>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {body}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
