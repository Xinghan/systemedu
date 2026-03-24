"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Clock, Users, Plus, Sparkles, ArrowRight, Search } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { AppHeader } from "@/components/layout/app-header"
import { gateway } from "@/lib/api"
import type { ProjectSummary } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

const CATEGORY_ICONS: Record<string, string> = {
  ai: "AI",
  math: "MATH",
  aerospace: "AERO",
  biotech: "BIO",
  cs: "CS",
  chemistry: "CHEM",
  music: "MUS",
  climate: "ENV",
  robotics: "ROBO",
  other: "...",
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
      .then(setProjects)
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

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-violet-700 via-purple-700 to-purple-600 px-8 py-10 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 right-24 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative max-w-2xl">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            {t("projects.explore")}
          </h1>
          <p className="text-sm text-white/75 mb-6">
            {t("projects.subtitle")}
          </p>
          <div className="flex items-center gap-3">
            <Link href="/projects/new">
              <button className="h-10 px-5 rounded-xl bg-white text-violet-700 text-sm font-semibold flex items-center gap-2 hover:bg-white/90 transition-all duration-[350ms] shadow-sm">
                <Plus className="h-4 w-4" />
                {t("projects.create_new")}
              </button>
            </Link>
            <div className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white/15 backdrop-blur-sm text-white/80 text-sm">
              <Search className="h-3.5 w-3.5" />
              <input
                className="bg-transparent outline-none placeholder:text-white/50 text-white text-sm w-44"
                placeholder={t("projects.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Category filter chips */}
        <div className="flex items-center gap-3 flex-wrap mb-8">
          <span className="text-[11px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground">
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
        </div>

        {loading ? (
          <PageLoading />
        ) : filtered.length === 0 && projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectCard key={p.name} project={p} />
            ))}
            {/* "Start Custom Project" card */}
            <Link href="/projects/new">
              <div className="rounded-xl border-2 border-dashed border-primary/25 p-6 h-full min-h-[220px] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/4 transition-all duration-[350ms] group">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{t("projects.start_custom")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
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

function ProjectCard({ project: p }: { project: ProjectSummary }) {
  const iconLabel = CATEGORY_ICONS[p.category] ?? "..."
  const t = useT()

  return (
    <Link href={`/projects/${p.name}`}>
      <div className="card-elevated p-6 h-full flex flex-col cursor-pointer hover:shadow-card-hover transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] group">
        {/* Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
          <span className="text-[10px] font-[var(--font-manrope)] font-bold text-primary tracking-wider">
            {iconLabel}
          </span>
        </div>

        {/* Category chip */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
            {(t as (key: string) => string)(`cat.${p.category}`) || p.category}
          </span>
          {p.tags.slice(0, 1).map((tag) => (
            <span key={tag} className="text-[10px] font-[var(--font-manrope)] uppercase tracking-wider px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
              {tag}
            </span>
          ))}
        </div>

        {/* Title + description */}
        <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors duration-[350ms]">
          {p.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{p.description}</p>

        {/* Footer meta */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/50">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-[var(--font-manrope)] font-semibold text-foreground">{p.estimated_hours} {t("projects.hours")}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="font-[var(--font-manrope)]">{t("projects.ages")} {p.age_range[0]}-{p.age_range[1]}</span>
          </div>
        </div>
      </div>
    </Link>
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
