"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Sparkles, ArrowRight, TrendingUp, Brain, Trash2 } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { AppHeader } from "@/components/layout/app-header"
import { toast } from "sonner"
import { gateway } from "@/lib/api"
import type { ProjectSummary } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

// Category icon SVGs — matching UI mockup style (symbol on light purple bg)
function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, React.ReactNode> = {
    math: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round">
        <path d="M4 7h16M4 12h10M4 17h7" />
        <path d="M18 10l3 3-3 3" />
      </svg>
    ),
    aerospace: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path d="M12 2C8 2 5 8 5 12c0 2 .5 3.5 1.5 5L12 22l5.5-5c1-1.5 1.5-3 1.5-5 0-4-3-10-7-10z" fill="#7c3aed" fillOpacity="0.15" stroke="#7c3aed" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="2" fill="#7c3aed"/>
      </svg>
    ),
    ai: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <circle cx="12" cy="12" r="3" fill="#7c3aed" fillOpacity="0.2" stroke="#7c3aed" strokeWidth="1.5"/>
        <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.05 7.05l1.41 1.41M15.54 15.54l1.41 1.41M7.05 16.95l1.41-1.41M15.54 8.46l1.41-1.41" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    biotech: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <circle cx="12" cy="8" r="3" stroke="#7c3aed" strokeWidth="1.5" fill="#7c3aed" fillOpacity="0.15"/>
        <path d="M12 11v6M9 14h6M7 19h10" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    cs: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="#7c3aed" strokeWidth="1.5" fill="#7c3aed" fillOpacity="0.1"/>
        <path d="M8 10l-2 2 2 2M16 10l2 2-2 2M13 9l-2 6" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    chemistry: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path d="M9 3h6M10 3v5l-4 8a2 2 0 001.8 3h8.4a2 2 0 001.8-3l-4-8V3" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="#7c3aed" fillOpacity="0.1"/>
      </svg>
    ),
    music: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path d="M9 18V5l12-2v13" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="6" cy="18" r="3" stroke="#7c3aed" strokeWidth="1.5" fill="#7c3aed" fillOpacity="0.15"/>
        <circle cx="18" cy="16" r="3" stroke="#7c3aed" strokeWidth="1.5" fill="#7c3aed" fillOpacity="0.15"/>
      </svg>
    ),
    climate: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <circle cx="12" cy="12" r="4" stroke="#7c3aed" strokeWidth="1.5" fill="#7c3aed" fillOpacity="0.15"/>
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    robotics: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <rect x="7" y="9" width="10" height="8" rx="2" stroke="#7c3aed" strokeWidth="1.5" fill="#7c3aed" fillOpacity="0.1"/>
        <path d="M12 5v4M9.5 13h.01M14.5 13h.01M10 17v2M14 17v2M3 13h4M17 13h4" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="4" r="1.5" fill="#7c3aed"/>
      </svg>
    ),
    other: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <circle cx="12" cy="12" r="1.5" fill="#7c3aed"/>
        <circle cx="6" cy="12" r="1.5" fill="#7c3aed"/>
        <circle cx="18" cy="12" r="1.5" fill="#7c3aed"/>
      </svg>
    ),
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
      {icons[category] ?? icons.other}
    </div>
  )
}

// Category tag color mapping
const CATEGORY_TAG_COLOR: Record<string, string> = {
  math:      "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400",
  aerospace: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  ai:        "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  biotech:   "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  cs:        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  chemistry: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  music:     "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400",
  climate:   "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  robotics:  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
  other:     "bg-secondary text-secondary-foreground",
}

const CATEGORY_TAG_LABELS: Record<string, string> = {
  math: "MATH", aerospace: "AEROSPACE", ai: "AI", biotech: "BIOLOGY",
  cs: "CS", chemistry: "CHEMISTRY", music: "MUSIC", climate: "CLIMATE",
  robotics: "ROBOTICS", other: "",
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const t = useT()

  const CATEGORY_FILTER_OPTIONS = [
    { value: "all", label: t("projects.all_categories") },
    { value: "math", label: t("projects.mathematics") },
    { value: "aerospace", label: t("projects.aerospace") },
    { value: "ai", label: t("projects.ai") },
    { value: "cs", label: t("projects.cs") },
    { value: "biotech", label: t("projects.biology") },
    { value: "chemistry", label: t("projects.chemistry") },
  ]

  useEffect(() => {
    gateway
      .projects()
      .then((list) => {
        setProjects(list)
        // Silently generate icons for projects that don't have one yet
        const missing = list.filter((p) => !p.icon_svg)
        missing.forEach((p) => {
          gateway.generateProjectIcon(p.name)
            .then((res) => {
              if (res.icon_svg) {
                setProjects((prev) =>
                  prev.map((x) => x.name === p.name ? { ...x, icon_svg: res.icon_svg } : x)
                )
              }
            })
            .catch(() => {})
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter((p) => {
    const matchCategory = selectedCategory === "all" || p.category === selectedCategory
    const matchSearch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  return (
    <>
      <AppHeader />

      {/* Hero Section: left big card + right two small cards */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex gap-4 items-stretch">
          {/* Left: main hero card */}
          <div className="flex-1 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 p-8 relative overflow-hidden min-h-[260px] flex flex-col justify-between">
            {/* Decorative diagonal shimmer */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-[35%] w-[200px] h-[400px] bg-white/30 rotate-[20deg] translate-y-[-30%]" />
            </div>
            <div className="relative">
              <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight mb-3">
                {t("projects.explore")}
              </h1>
              <p className="text-sm text-white/75 leading-relaxed max-w-md">
                {t("projects.subtitle")}
              </p>
            </div>
            <div className="relative mt-6">
              <Link href="/projects/new">
                <button className="h-11 px-6 rounded-xl bg-white text-violet-700 text-sm font-semibold flex items-center gap-2 hover:bg-white/90 transition-all duration-[350ms] shadow-sm w-fit">
                  <Plus className="h-4 w-4" />
                  {t("projects.create_new")}
                  <Sparkles className="h-3.5 w-3.5 opacity-60" />
                </button>
              </Link>
            </div>
          </div>

          {/* Right: two small cards stacked */}
          <div className="w-64 shrink-0 flex flex-col gap-4">
            {/* Popular card */}
            <div className="flex-1 rounded-2xl bg-cyan-100 dark:bg-cyan-950/40 p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                <span className="text-base font-bold text-foreground">{t("projects.popular")}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("projects.popular_desc")}
              </p>
            </div>
            {/* AI Mentor card */}
            <div className="flex-1 rounded-2xl bg-card border border-border/60 p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <span className="text-base font-bold text-foreground">{t("projects.ai_mentor")}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("projects.ai_mentor_desc")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 pb-6">
        {/* Category filter row */}
        <div className="flex items-center gap-3 flex-wrap mb-6 border-b border-border/40 pb-4">
          <span className="text-[11px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground font-semibold shrink-0">
            {t("projects.filter_by")}
          </span>
          {CATEGORY_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedCategory(opt.value)}
              className={`h-8 px-4 rounded-full text-xs font-medium transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] ${
                selectedCategory === opt.value
                  ? "bg-primary text-primary-foreground shadow-[0_2px_12px_0_oklch(0.488_0.258_302_/_0.25)]"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {/* Search — right-aligned */}
          <div className="ml-auto flex items-center gap-2 h-8 px-3 rounded-full bg-secondary text-sm">
            <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              className="bg-transparent outline-none placeholder:text-muted-foreground text-foreground text-xs w-36"
              placeholder={t("projects.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <PageLoading />
        ) : filtered.length === 0 && projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectCard key={p.name} project={p} onDelete={(name) => setProjects((prev) => prev.filter((x) => x.name !== name))} />
            ))}
            {/* "Start Custom Project" card */}
            <Link href="/projects/new">
              <div className="rounded-2xl border-2 border-dashed border-primary/30 p-6 h-full min-h-[240px] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary/60 hover:bg-primary/4 transition-all duration-[350ms] group bg-white/50 dark:bg-card/50">
                <div className="h-12 w-12 rounded-full border-2 border-primary/30 group-hover:border-primary/60 flex items-center justify-center transition-colors">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground mb-1.5">{t("projects.start_custom")}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[180px]">
                    {t("projects.custom_desc")}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

function ProjectCard({ project: p, onDelete }: { project: ProjectSummary; onDelete: (name: string) => void }) {
  const t = useT()
  const tagColor = CATEGORY_TAG_COLOR[p.category] ?? CATEGORY_TAG_COLOR.other
  const categoryLabel = CATEGORY_TAG_LABELS[p.category] ?? p.category.toUpperCase()
  const extraTag = p.tags[0]?.toUpperCase()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const levelLabel = p.age_range[1] >= 16
    ? `Ages ${p.age_range[0]}+`
    : `Ages ${p.age_range[0]}-${p.age_range[1]}`

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      await gateway.deleteProject(p.name)
      toast.success(t("project.deleted"))
      onDelete(p.name)
    } catch (err: unknown) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="relative group">
      <Link href={`/projects/${p.name}`}>
        <div className="bg-white dark:bg-card rounded-2xl p-6 h-full flex flex-col cursor-pointer shadow-[0_2px_12px_0_rgba(0,0,0,0.06)] hover:shadow-[0_6px_24px_0_rgba(109,40,217,0.12)] transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] border border-border/30">
          {/* Project icon — LLM-generated SVG or category fallback */}
          <div className="mb-4">
            {p.icon_svg ? (
              <div
                className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: p.icon_svg }}
              />
            ) : (
              <CategoryIcon category={p.category} />
            )}
          </div>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {categoryLabel && (
            <span className={`text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${tagColor}`}>
              {categoryLabel}
            </span>
          )}
          {extraTag && (
            <span className={`text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${tagColor}`}>
              {extraTag}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[1.1rem] font-extrabold text-[#1e2d6b] dark:text-foreground leading-snug mb-2 group-hover:text-primary transition-colors duration-[350ms]">
          {p.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1 mb-4">
          {p.description}
        </p>

          {/* Footer: DURATION + LEVEL */}
          <div className="border-t border-border/40 pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-[var(--font-manrope)] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1">
                {t("projects.duration")}
              </p>
              <p className="text-sm font-bold text-[#1e2d6b] dark:text-foreground">
                {p.estimated_hours} {t("projects.hours")}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-[var(--font-manrope)] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1">
                {t("projects.level")}
              </p>
              <p className="text-sm font-bold text-[#1e2d6b] dark:text-foreground">
                {levelLabel}
              </p>
            </div>
          </div>
        </div>
      </Link>
      {/* Delete button — top-right corner, appears on hover */}
      <button
        onClick={handleDelete}
        onBlur={() => setConfirmDelete(false)}
        disabled={deleting}
        className={`absolute top-3 right-3 z-10 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
          confirmDelete
            ? "opacity-100 bg-destructive text-white shadow-md"
            : "opacity-0 group-hover:opacity-100 bg-white/90 dark:bg-card/90 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shadow-sm border border-border/40"
        }`}
      >
        <Trash2 className="h-3 w-3" />
        {confirmDelete ? (deleting ? t("project.deleting") : t("project.delete_confirm_btn")) : ""}
      </button>
    </div>
  )
}

function EmptyState() {
  const t = useT()
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-5">
        <Sparkles className="h-9 w-9 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">{t("projects.no_projects")}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {t("projects.no_projects_desc")}
      </p>
      <Link href="/projects/new">
        <button className="h-11 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold flex items-center gap-2 shadow-[0_2px_16px_0_oklch(0.488_0.258_302_/_0.30)] hover:shadow-[0_4px_24px_0_oklch(0.488_0.258_302_/_0.40)] transition-all duration-[350ms]">
          <Plus className="h-4 w-4" />
          {t("projects.create_new")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </Link>
    </div>
  )
}
