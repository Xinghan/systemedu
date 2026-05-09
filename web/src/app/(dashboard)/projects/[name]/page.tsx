"use client"

import { useEffect, useRef, useMemo, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import {
  ArrowLeft, Clock, Play, GraduationCap, Highlighter, Settings,
  Pencil, Save, X, ChevronUp, ChevronDown, ArrowRight, Zap, ImageIcon, Upload, Trash2,
  Lock, CheckCircle2, Target, Compass, BookOpen, Search, Layers, Map, BarChart3,
  Puzzle, Cpu, Presentation, Info, Database, FileCheck, Eye,
} from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppHeader } from "@/components/layout/app-header"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { gateway } from "@/lib/api"
import { LearningStatsCard } from "@/components/learning/learning-stats-card"
import { CoverFallback } from "@/components/projects/cover-fallback"
import type { KnowledgeLevel, LessonStatus, MilestoneInfo, ProjectBrief, ProjectDetail, SubProjectInfo } from "@/lib/types/api"
import { KNOWLEDGE_LEVEL_LABELS } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"
import type { TranslationKey } from "@/lib/i18n"
import { CareerPathCard } from "@/components/career-path/career-path-card"

const CATEGORY_OPTIONS = [
  { value: "ai", label: "AI" },
  { value: "biotech", label: "Biology" },
  { value: "aerospace", label: "Aerospace" },
  { value: "music", label: "Music" },
  { value: "climate", label: "Climate" },
  { value: "robotics", label: "Robotics" },
  { value: "chemistry", label: "Chemistry" },
  { value: "math", label: "Mathematics" },
  { value: "cs", label: "Computer Science" },
  { value: "other", label: "Other" },
]

const CATEGORY_TAGS: Record<string, string[]> = {
  aerospace: ["AEROSPACE", "PHYSICS"],
  ai: ["ARTIFICIAL INTELLIGENCE"],
  biotech: ["BIOLOGY", "RESEARCH"],
  math: ["MATHEMATICS"],
  cs: ["COMPUTER SCIENCE"],
  chemistry: ["CHEMISTRY", "SCIENCE"],
  music: ["MUSIC", "ARTS"],
  climate: ["CLIMATE", "ENVIRONMENT"],
  robotics: ["ROBOTICS", "ENGINEERING"],
  other: [],
}

const D3KnowledgeTree = dynamic(
  () => import("@/components/knowledge-tree/d3-knowledge-tree").then((m) => m.D3KnowledgeTree),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><LoadingSpinner size="sm" label="Loading" /></div> },
)

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "-"
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

interface ResourceCardProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick?: () => void
  disabled?: boolean
  badge?: string
}

function ResourceCard({ icon, title, description, onClick, disabled, badge }: ResourceCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-3 p-5 rounded-xl text-center transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] min-w-[120px] ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:shadow-card-hover cursor-pointer"
      } card-elevated`}
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
          {badge && (
            <span className="text-[9px] font-[var(--font-manrope)] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </button>
  )
}

// Icon components — ethereal glass style matching project_new_icon design
function IconKnowledgeTree() {
  return (
    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-indigo-500/10 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/8 rounded-2xl blur-xl" />
      <div className="relative w-12 h-12 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-[0_8px_32px_rgba(98,0,238,0.1)] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#6a1cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <circle cx="12" cy="4" r="2" />
          <circle cx="6" cy="13" r="2" />
          <circle cx="18" cy="13" r="2" />
          <circle cx="4" cy="21" r="1.5" />
          <circle cx="9" cy="21" r="1.5" />
          <circle cx="15" cy="21" r="1.5" />
          <circle cx="20" cy="21" r="1.5" />
          <line x1="12" y1="6" x2="6" y2="11" />
          <line x1="12" y1="6" x2="18" y2="11" />
          <line x1="6" y1="15" x2="4" y2="19.5" />
          <line x1="6" y1="15" x2="9" y2="19.5" />
          <line x1="18" y1="15" x2="15" y2="19.5" />
          <line x1="18" y1="15" x2="20" y2="19.5" />
        </svg>
      </div>
    </div>
  )
}

function IconNotesGradient() {
  return (
    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-400/10 flex items-center justify-center">
      <div className="absolute inset-0 bg-cyan-400/8 rounded-2xl blur-xl" />
      <div className="relative w-12 h-12 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-[0_8px_32px_rgba(16,185,129,0.1)] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3z" />
          <polyline points="15 3 15 9 21 9" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="12" y2="17" />
          <polyline points="12.5 19.5 14 18 16.5 20.5 21 15" strokeWidth="1.8" stroke="#059669" />
        </svg>
      </div>
    </div>
  )
}

function IconResourcesGradient() {
  return (
    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-400/10 flex items-center justify-center">
      <div className="absolute inset-0 bg-blue-400/8 rounded-2xl blur-xl" />
      <div className="relative w-12 h-12 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-[0_8px_32px_rgba(59,130,246,0.1)] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <path d="M2 8a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8z" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="16.5" x2="13" y2="16.5" />
        </svg>
      </div>
    </div>
  )
}

function IconStudentWorks() {
  return (
    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400/10 to-pink-400/10 flex items-center justify-center">
      <div className="absolute inset-0 bg-rose-400/8 rounded-2xl blur-xl" />
      <div className="relative w-12 h-12 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-[0_8px_32px_rgba(251,113,133,0.1)] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <circle cx="12" cy="7" r="3" />
          <circle cx="5.5" cy="8.5" r="2" />
          <circle cx="18.5" cy="8.5" r="2" />
          <path d="M6 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
          <path d="M1 20c0-2.2 1.8-3.5 4.5-3.5" strokeOpacity="0.5" />
          <path d="M23 20c0-2.2-1.8-3.5-4.5-3.5" strokeOpacity="0.5" />
        </svg>
      </div>
    </div>
  )
}

function IconFoundation() {
  return (
    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center">
      <div className="absolute inset-0 bg-violet-400/8 rounded-2xl blur-xl" />
      <div className="relative w-12 h-12 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-[0_8px_32px_rgba(139,92,246,0.1)] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" strokeWidth="1.8" stroke="#7c3aed" />
          <line x1="8" y1="11" x2="14" y2="11" strokeWidth="1.8" stroke="#7c3aed" />
        </svg>
      </div>
    </div>
  )
}

function IconAICourse() {
  return (
    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/10 to-orange-400/10 flex items-center justify-center">
      <div className="absolute inset-0 bg-amber-400/8 rounded-2xl blur-xl" />
      <div className="relative w-12 h-12 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-[0_8px_32px_rgba(251,191,36,0.1)] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <circle cx="12" cy="9" r="3.5" />
          <path d="M12 2a7 7 0 100 14" strokeOpacity="0.4" />
          <path d="M12 2a7 7 0 110 14" />
          <line x1="12" y1="16" x2="12" y2="20" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <path d="M9 9l1.5 1.5L14 7" strokeWidth="1.8" stroke="#d97706" />
        </svg>
      </div>
    </div>
  )
}


type SubProjectStatus = "completed" | "in_progress" | "available" | "locked"

function getSubProjectStatus(
  sp: SubProjectInfo,
  allSubProjects: SubProjectInfo[],
): SubProjectStatus {
  // Use server-provided status if available
  if (sp.status) {
    // Map server status to SubProjectStatus
    if (sp.status === "passed") return "completed"
    if (sp.status === "in_progress") return "in_progress"
    if (sp.status === "available") return "available"
    if (sp.status === "locked") return "locked"
  }
  
  // Fallback to computed status
  if (sp.nodes_total > 0 && sp.nodes_passed >= sp.nodes_total) return "completed"
  if (sp.nodes_passed > 0) return "in_progress"
  if (sp.prerequisite_sub_project_ids.length === 0) return "available"
  const allPrereqsDone = sp.prerequisite_sub_project_ids.every((pid) => {
    const prereq = allSubProjects.find((s) => s.id === pid)
    return prereq && prereq.nodes_total > 0 && prereq.nodes_passed >= prereq.nodes_total
  })
  return allPrereqsDone ? "available" : "locked"
}

const STATUS_STYLES: Record<SubProjectStatus, { bg: string; text: string; labelKey: TranslationKey }> = {
  completed: { bg: "bg-cyan-100 dark:bg-cyan-500/20", text: "text-cyan-700 dark:text-cyan-400", labelKey: "project.sp_status_done" },
  in_progress: { bg: "bg-primary/10", text: "text-primary", labelKey: "project.sp_status_active" },
  available: { bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", labelKey: "project.sp_status_ready" },
  locked: { bg: "bg-secondary", text: "text-muted-foreground", labelKey: "project.sp_status_locked" },
}

// Icon pool for sub-projects — cycles through for 8+ sub-projects
const SP_ICONS: { icon: React.ElementType; gradient: string; iconColor: string }[] = [
  { icon: Compass, gradient: "from-violet-500/15 to-indigo-500/15", iconColor: "text-violet-600" },
  { icon: BookOpen, gradient: "from-cyan-500/15 to-teal-500/15", iconColor: "text-cyan-600" },
  { icon: Search, gradient: "from-blue-500/15 to-cyan-400/15", iconColor: "text-blue-600" },
  { icon: Target, gradient: "from-amber-500/15 to-orange-400/15", iconColor: "text-amber-600" },
  { icon: Map, gradient: "from-emerald-500/15 to-teal-400/15", iconColor: "text-emerald-600" },
  { icon: BarChart3, gradient: "from-rose-500/15 to-pink-400/15", iconColor: "text-rose-600" },
  { icon: Presentation, gradient: "from-indigo-500/15 to-violet-400/15", iconColor: "text-indigo-600" },
  { icon: Cpu, gradient: "from-purple-500/15 to-fuchsia-400/15", iconColor: "text-purple-600" },
]

function getSpIcon(index: number) {
  return SP_ICONS[index % SP_ICONS.length]
}


// Lesson status badge colors
const LESSON_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  not_started: { bg: "bg-secondary", text: "text-muted-foreground", label: "待生成" },
  pending: { bg: "bg-secondary", text: "text-muted-foreground", label: "排队中" },
  generating: { bg: "bg-blue-100 dark:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400", label: "生成中" },
  ready: { bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", label: "已完成" },
  failed: { bg: "bg-red-100 dark:bg-red-500/20", text: "text-red-600 dark:text-red-400", label: "失败" },
}

// Project Brief Card — shows project overview from v2 knowledge tree
function ProjectBriefCard({ brief, t }: {
  brief: ProjectBrief
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}) {
  const [expanded, setExpanded] = useState(false)

  const sections = [
    { key: "real_problem", label: t("project.brief_real_problem"), content: brief.real_problem, icon: Target, always: true },
    { key: "what_we_do", label: t("project.brief_what_we_do"), content: brief.what_we_do, icon: CheckCircle2, always: true },
    { key: "what_we_dont", label: t("project.brief_what_we_dont"), content: brief.what_we_dont, icon: X, always: true },
    { key: "data_sources", label: t("project.brief_data_sources"), content: brief.data_sources, icon: Database, always: false },
    { key: "min_success", label: t("project.brief_min_success"), content: brief.min_success, icon: Target, always: false },
    { key: "rec_success", label: t("project.brief_rec_success"), content: brief.recommended_success, icon: Zap, always: false },
    { key: "deliverables", label: t("project.brief_deliverables"), content: brief.final_deliverables, icon: FileCheck, always: false },
    { key: "final_demo", label: t("project.brief_final_demo"), content: brief.final_demo, icon: Eye, always: false },
    { key: "industry", label: t("project.brief_industry"), content: brief.industry_relation, icon: Compass, always: false },
  ]

  const visibleSections = expanded ? sections : sections.filter((s) => s.always)

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <Info className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-primary font-semibold">
            {t("project.brief_title")}
          </span>
        </div>
        {brief.one_liner && (
          <p className="text-sm text-foreground font-medium leading-relaxed mb-3">{brief.one_liner}</p>
        )}
      </div>

      <div className="px-6 pb-5 space-y-4">
        {visibleSections.map((section) => {
          const IconComp = section.icon
          const content = section.content

          if (!content || (Array.isArray(content) && content.length === 0)) return null

          return (
            <div key={section.key}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <IconComp className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-[var(--font-manrope)]">
                  {section.label}
                </h4>
              </div>

              {typeof content === "string" ? (
                <p className="text-xs text-muted-foreground leading-relaxed pl-5">{content}</p>
              ) : section.key === "data_sources" && Array.isArray(content) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-5">
                  {(content as ProjectBrief["data_sources"]).map((ds, i) => (
                    <div key={i} className="rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs font-semibold text-foreground mb-0.5">{ds.name}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{ds.role}</p>
                      {ds.source && (
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{ds.source}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : Array.isArray(content) ? (
                section.key === "what_we_do" || section.key === "what_we_dont" ? (
                  <ul className="space-y-1 pl-5">
                    {(content as string[]).map((item, i) => (
                      <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                        <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${
                          section.key === "what_we_do" ? "bg-emerald-500" : "bg-rose-400"
                        }`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-1 pl-5">
                    {(content as string[]).map((item, i) => (
                      <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                        <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-primary/40" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          )
        })}

        {sections.some((s) => !s.always) && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors pt-1"
          >
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5" />{t("project.brief_show_less")}</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" />{t("project.brief_show_more")}</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// Sub-project roadmap — vertical timeline with icons
function SubProjectTree({ subProjects, milestones, lessonStatuses, onNodeClick, t }: {
  subProjects: SubProjectInfo[]
  milestones: MilestoneInfo[]
  lessonStatuses: Record<string, string>
  onNodeClick: (spId: string) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}) {
  const [expandedSp, setExpandedSp] = useState<string | null>(null)

  // Build global knode index -> milestone/knode mapping
  const globalKnodes = useMemo(() => {
    const result: { globalIdx: number; title: string; msTitle: string }[] = []
    let idx = 0
    for (const ms of milestones) {
      for (const kn of ms.knodes) {
        result.push({ globalIdx: idx, title: kn.title, msTitle: ms.title })
        idx++
      }
    }
    return result
  }, [milestones])

  // For a sub-project, collect all knodes from its milestone_indices
  const getSpKnodes = useCallback((sp: SubProjectInfo) => {
    const knodes: { globalIdx: number; title: string; msTitle: string }[] = []
    for (const msIdx of sp.milestone_indices) {
      if (msIdx >= milestones.length) continue
      const ms = milestones[msIdx]
      // Find the global start index for this milestone
      let startIdx = 0
      for (let i = 0; i < msIdx; i++) {
        startIdx += milestones[i].knodes.length
      }
      for (let k = 0; k < ms.knodes.length; k++) {
        const gi = startIdx + k
        if (gi < globalKnodes.length) {
          knodes.push(globalKnodes[gi])
        }
      }
    }
    return knodes
  }, [milestones, globalKnodes])

  return (
    <div className="relative">
      {subProjects.map((sp, idx) => {
        const pct = sp.nodes_total > 0 ? Math.round((sp.nodes_passed / sp.nodes_total) * 100) : 0
        const status = getSubProjectStatus(sp, subProjects)
        const isCompleted = status === "completed"
        const isActive = status === "in_progress"
        const isLocked = status === "locked"
        const spIcon = getSpIcon(idx)
        const IconComp = spIcon.icon
        const isLast = idx === subProjects.length - 1
        const isExpanded = expandedSp === sp.id

        // Compute lesson stats for this sub-project
        const spKnodes = getSpKnodes(sp)
        const readyCount = spKnodes.filter((kn) => lessonStatuses[String(kn.globalIdx)] === "ready").length
        const totalCount = spKnodes.length

        return (
          <div key={sp.id} className="relative flex gap-4">
            {/* Left: icon column + vertical line */}
            <div className="flex flex-col items-center shrink-0">
              {/* Icon circle */}
              <button
                onClick={() => !isLocked && onNodeClick(sp.id)}
                disabled={isLocked}
                className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                  isCompleted
                    ? "bg-cyan-100 dark:bg-cyan-500/20 ring-2 ring-cyan-400/50"
                    : isActive
                    ? "bg-primary/15 ring-2 ring-primary/50"
                    : isLocked
                    ? "bg-secondary opacity-50"
                    : "bg-gradient-to-br " + spIcon.gradient + " ring-1 ring-border"
                } ${isLocked ? "cursor-not-allowed" : "cursor-pointer hover:scale-110"}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-cyan-600" />
                ) : (
                  <IconComp className={`h-4.5 w-4.5 ${isLocked ? "text-muted-foreground/40" : spIcon.iconColor}`} />
                )}
              </button>
              {/* Vertical connector line */}
              {!isLast && (
                <div className={`w-px flex-1 min-h-[24px] ${
                  isCompleted ? "bg-cyan-300 dark:bg-cyan-700" : "bg-border"
                }`} />
              )}
            </div>

            {/* Right: content */}
            <div className={`flex-1 min-w-0 pb-6 text-left ${isLocked ? "opacity-40" : ""}`}>
              <button
                onClick={() => !isLocked && onNodeClick(sp.id)}
                disabled={isLocked}
                className={`w-full text-left transition-colors ${
                  isLocked ? "cursor-not-allowed" : "cursor-pointer group"
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-[var(--font-manrope)] font-bold uppercase tracking-wider text-muted-foreground">
                    {sp.id}
                  </span>
                  <span className={`text-[9px] font-[var(--font-manrope)] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${STATUS_STYLES[status].bg} ${STATUS_STYLES[status].text}`}>
                    {t(STATUS_STYLES[status].labelKey)}
                  </span>
                  <span className="text-[10px] font-[var(--font-manrope)] text-muted-foreground ml-auto">
                    {t("project.sp_level", { n: sp.difficulty })} · {sp.estimated_hours}h
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-foreground leading-tight mb-1 group-hover:text-primary transition-colors">
                  {sp.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-1">
                  {sp.description}
                </p>
                {sp.brief && (
                  <p className="text-[11px] italic text-muted-foreground/80 leading-relaxed line-clamp-2 mb-1">
                    {sp.brief}
                  </p>
                )}
                {sp.deliverables && sp.deliverables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {sp.deliverables.map((d, i) => (
                      <span key={i} className="text-[9px] font-[var(--font-manrope)] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </button>

              {/* Lesson progress + expand toggle */}
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden max-w-[200px]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isCompleted ? "bg-cyan-400" : "bg-gradient-to-r from-teal-500 to-cyan-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-[var(--font-manrope)] font-semibold text-foreground">
                  {pct}%
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {sp.nodes_passed}/{sp.nodes_total}
                </span>
                {totalCount > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-2">
                    {readyCount}/{totalCount} 课程已生成
                  </span>
                )}
                {!isLocked && totalCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedSp(isExpanded ? null : sp.id)
                    }}
                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>

              {/* Expanded: stage details + knode list */}
              {isExpanded && (
                <div className="mt-2 ml-1 space-y-3 animate-[loading-fade-in_0.2s_ease-out]">
                  {/* Stage detail fields */}
                  {(sp.core_problem || sp.task || sp.acceptance_criteria?.length) && (
                    <div className="rounded-lg bg-secondary/40 p-3 space-y-2">
                      {sp.core_problem && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary font-[var(--font-manrope)]">
                            {t("project.sp_core_problem")}
                          </span>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{sp.core_problem}</p>
                        </div>
                      )}
                      {sp.task && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary font-[var(--font-manrope)]">
                            {t("project.sp_task")}
                          </span>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{sp.task}</p>
                        </div>
                      )}
                      {sp.acceptance_criteria && sp.acceptance_criteria.length > 0 && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary font-[var(--font-manrope)]">
                            {t("project.sp_acceptance")}
                          </span>
                          <ul className="mt-1 space-y-0.5">
                            {sp.acceptance_criteria.map((c, ci) => (
                              <li key={ci} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {sp.handover && sp.handover.outputs && sp.handover.outputs.length > 0 && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary font-[var(--font-manrope)]">
                            {t("project.sp_handover")}
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {sp.handover.outputs.map((o, oi) => (
                              <span key={oi} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {o}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Knode list */}
                  <div className="space-y-1">
                  {spKnodes.map((kn) => {
                    const lsRaw = lessonStatuses[String(kn.globalIdx)] || "not_started"
                    const ls = LESSON_STATUS_STYLES[lsRaw] || LESSON_STATUS_STYLES.not_started
                    return (
                      <div key={kn.globalIdx} className="flex items-center gap-2 py-0.5">
                        <span className="text-[10px] text-muted-foreground w-6 text-right shrink-0">
                          #{kn.globalIdx}
                        </span>
                        <span className="text-xs text-foreground truncate flex-1">
                          {kn.title}
                        </span>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${ls.bg} ${ls.text}`}>
                          {lsRaw === "generating" && (
                            <span className="inline-block w-2 h-2 border border-current border-t-transparent rounded-full animate-spin mr-1 align-middle" />
                          )}
                          {ls.label}
                        </span>
                      </div>
                    )
                  })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ProjectDetailPage() {
  const params = useParams<{ name: string }>()
  const router = useRouter()
  const t = useT()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editHours, setEditHours] = useState(0)
  const [editAgeMin, setEditAgeMin] = useState(6)
  const [editAgeMax, setEditAgeMax] = useState(18)
  const [editTags, setEditTags] = useState("")
  const [editKnowledgeLevel, setEditKnowledgeLevel] = useState<KnowledgeLevel>("K1")
const [editCoverFile, setEditCoverFile] = useState<File | null>(null)
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null)

  const [coverCacheBust, setCoverCacheBust] = useState(Date.now())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [progressDetailOpen, setProgressDetailOpen] = useState(false)
  const [learningPathExpanded, setLearningPathExpanded] = useState(true)
  const [lessonStatuses, setLessonStatuses] = useState<Record<string, LessonStatus>>({})

  useEffect(() => {
    if (!params.name) return
    gateway
      .project(params.name)
      .then((d) => {
        setDetail(d)
        setEditTitle(d.project.title)
        setEditDescription(d.project.description)
        setEditCategory(d.project.category)
        setEditHours(d.project.estimated_hours)
        setEditAgeMin(d.project.age_range[0] ?? 6)
        setEditAgeMax(d.project.age_range[1] ?? 18)
        setEditTags(d.project.tags.join(", "))
        setEditKnowledgeLevel((d.project as { knowledge_level?: KnowledgeLevel }).knowledge_level || "K1")

        // spec 022: 不再后台生成 cover; 没 cover 时前端 CSS fallback 渲染,
        // 不轮询
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    gateway.lessonStatuses(params.name)
      .then((r) => setLessonStatuses(r.statuses as Record<string, LessonStatus>))
      .catch(() => {})

  }, [params.name])

  const handleSaveEdit = async () => {
    if (!params.name || !detail) return
    setSaving(true)
    try {
      await gateway.updateProject(params.name, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        estimated_hours: editHours,
        age_range: [editAgeMin, editAgeMax],
        tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
        knowledge_level: editKnowledgeLevel,
      })
      let newCoverUrl = detail.project.cover_image_url
      if (editCoverFile) {
        try {
          const r = await gateway.uploadProjectCover(params.name, editCoverFile)
          newCoverUrl = r.url
        } catch { /* non-fatal */ }
      }
      setDetail((prev) =>
        prev ? {
          ...prev,
          project: {
            ...prev.project,
            title: editTitle.trim(),
            description: editDescription.trim(),
            category: editCategory,
            estimated_hours: editHours,
            age_range: [editAgeMin, editAgeMax],
            tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
            cover_image_url: newCoverUrl,
          },
        } : prev
      )
      setEditOpen(false)
      setEditCoverFile(null)
      setEditCoverPreview(null)
      toast.success(t("project.saved"))
    } catch (e: unknown) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : "Unknown error"}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!params.name) return
    setDeleting(true)
    try {
      await gateway.deleteProject(params.name)
      toast.success(t("project.deleted"))
      router.push("/projects")
    } catch (e: unknown) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : "Unknown error"}`)
      setDeleting(false)
    }
  }

  const handleStartLearning = async () => {
    if (!params.name) return
    setEnrolling(true)
    try {
      await gateway.enroll(params.name)
    } catch { /* enroll may already exist */ }
    setEnrolling(false)

    // When sub-projects exist, navigate to the first active/available one
    const sps = detail?.sub_projects ?? []
    if (sps.length > 0) {
      const active = sps.find((sp) => sp.nodes_passed > 0 && sp.nodes_passed < sp.nodes_total)
      const available = sps.find((sp) => {
        if (sp.nodes_passed > 0) return false
        if (sp.prerequisite_sub_project_ids.length === 0) return true
        return sp.prerequisite_sub_project_ids.every((pid) => {
          const prereq = sps.find((s) => s.id === pid)
          return prereq && prereq.nodes_total > 0 && prereq.nodes_passed >= prereq.nodes_total
        })
      })
      const target = active ?? available ?? sps[0]
      router.push(`/learn/${params.name}?sub=${target.id}`)
    } else {
      router.push(`/learn/${params.name}`)
    }
  }

  if (loading) return <><AppHeader /><PageLoading /></>

  if (error || !detail) {
    return (
      <>
        <AppHeader />
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <p>{error ?? t("project.not_found")}</p>
          <Link href="/projects">
            <Button variant="outline" size="sm">{t("project.back_projects")}</Button>
          </Link>
        </div>
      </>
    )
  }

  const passed = detail.progress.filter((p) => p.status === "passed").length
  const total = detail.progress.length
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0
  const subProjects = [...(detail.sub_projects ?? [])].sort((a, b) => (a.display_order ?? 50) - (b.display_order ?? 50))
  const hasSubProjects = subProjects.length > 0

  const enrollment = detail.enrollment
  const isCompleted = enrollment?.status === "completed"
  const isActive = enrollment?.status === "active"

  const buttonLabel = isCompleted ? t("project.study_again") : isActive ? t("project.continue_learning") : t("project.start_learning")
  const ButtonIcon = isActive ? Play : GraduationCap

  const categoryTags = CATEGORY_TAGS[detail.project.category] ?? []
  const allTags = [...new Set([...categoryTags, ...detail.project.tags.map((t) => t.toUpperCase())])].slice(0, 4)

  const coverUrl = detail.project.cover_image_url
    ? `${process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:18820"}${detail.project.cover_image_url}?t=${coverCacheBust}`
    : null

  return (
    <>
      <AppHeader />
      <div className="flex-1 overflow-y-auto animate-[loading-fade-in_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">
        <div className="max-w-5xl mx-auto px-8 pt-6 pb-8 space-y-8">
        {/* Hero section */}
        <div>
            {/* Back link */}
            <Link href="/projects">
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("project.back_library")}
              </button>
            </Link>

            {/* Hero card — lavender gradient background */}
            <div className="rounded-3xl bg-gradient-to-br from-[#e8e6f5] via-[#eceaf8] to-[#f2f0fb] dark:from-[#1e1a2e] dark:via-[#1a1728] dark:to-[#1e1b30] px-10 py-10 flex items-center gap-10 overflow-hidden">
              {/* Left: tags + title + description + button */}
              <div className="flex-1 min-w-0">
                {/* Tags — teal/emerald pill style */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {allTags.map((tag, i) => (
                    <span key={`${tag}-${i}`} className="text-[11px] font-[var(--font-manrope)] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full bg-cyan-200/80 text-cyan-800 dark:bg-cyan-800/40 dark:text-cyan-300">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <div className="flex items-center gap-2 mb-4">
                  <h1 className="text-[2.75rem] font-extrabold text-[#1e2d6b] dark:text-white leading-tight tracking-tight">
                    {detail.project.title}
                  </h1>
                  <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setDeleteConfirmOpen(false) }}>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{t("project.edit")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div>
                          <Label htmlFor="edit-title">{t("project.title")}</Label>
                          <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-2" />
                        </div>
                        <div>
                          <Label htmlFor="edit-desc">{t("project.description")}</Label>
                          <textarea id="edit-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full h-24 px-4 py-3 rounded-xl bg-secondary/60 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring mt-2 border-0" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="edit-category">{t("project.category")}</Label>
                            <select id="edit-category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full mt-2 h-11 px-3 rounded-xl bg-secondary/60 text-sm focus:outline-none focus:ring-2 focus:ring-ring border-0">
                              {CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label htmlFor="edit-hours">{t("project.hours_label")}</Label>
                            <Input id="edit-hours" type="number" min={1} value={editHours} onChange={(e) => setEditHours(Number(e.target.value) || 1)} className="mt-2" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="edit-age-min">{t("project.min_age")}</Label>
                            <Input id="edit-age-min" type="number" min={6} max={18} value={editAgeMin} onChange={(e) => setEditAgeMin(Number(e.target.value) || 6)} className="mt-2" />
                          </div>
                          <div>
                            <Label htmlFor="edit-age-max">{t("project.max_age")}</Label>
                            <Input id="edit-age-max" type="number" min={6} max={18} value={editAgeMax} onChange={(e) => setEditAgeMax(Number(e.target.value) || 18)} className="mt-2" />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="edit-tags">{t("project.tags")}</Label>
                          <Input id="edit-tags" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder={t("project.tags_placeholder")} className="mt-2" />
                        </div>
                        {/* Knowledge level */}
                        <div>
                          <Label htmlFor="edit-knowledge-level">基础知识等级</Label>
                          <select
                            id="edit-knowledge-level"
                            value={editKnowledgeLevel}
                            onChange={(e) => setEditKnowledgeLevel(e.target.value as KnowledgeLevel)}
                            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {(Object.entries(KNOWLEDGE_LEVEL_LABELS) as [KnowledgeLevel, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v} ({k})</option>
                            ))}
                          </select>
                          <p className="text-xs text-muted-foreground mt-1">选择后，基础知识弹窗将显示对应等级的内容</p>
                        </div>
                        {/* Cover image */}
                        <div>
                          <Label>{t("project.cover_image")}</Label>
                          <div className="mt-2 flex items-center gap-3">
                            {/* Preview — square, no white bg */}
                            <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-purple-600/20">
                              {editCoverPreview ? (
                                <img src={editCoverPreview} alt="cover" className="w-full h-full object-cover" />
                              ) : detail?.project.cover_image_url ? (
                                <img src={`${process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:18820"}${detail.project.cover_image_url}`} alt="cover" className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
                                  <ImageIcon className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                            {/* Actions */}
                            <div className="flex flex-col gap-1.5">
                              {/* Upload */}
                              <input type="file" accept="image/*" className="hidden" id="edit-cover-input"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  setEditCoverFile(file)
                                  setEditCoverPreview(URL.createObjectURL(file))
                                }}
                              />
                              <label htmlFor="edit-cover-input" className="cursor-pointer inline-flex h-8 px-3 items-center gap-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-medium transition-colors w-fit">
                                <Upload className="h-3 w-3" />{t("project.upload_cover")}
                              </label>
                              {(editCoverFile || editCoverPreview) && (
                                <button type="button" onClick={() => { setEditCoverFile(null); setEditCoverPreview(null) }} className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left">
                                  {t("project.remove_cover")}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                          <Button variant="outline" onClick={() => setEditOpen(false)}>
                            <X className="h-4 w-4 mr-2" />{t("project.cancel")}
                          </Button>
                          <Button onClick={handleSaveEdit} disabled={saving}>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? t("project.saving") : t("project.save")}
                          </Button>
                        </div>
                        {/* Danger zone */}
                        <div className="pt-3 border-t border-destructive/20">
                          {!deleteConfirmOpen ? (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmOpen(true)}
                              className="flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {t("project.delete")}
                            </button>
                          ) : (
                            <div className="rounded-xl bg-destructive/8 border border-destructive/20 p-3 space-y-2">
                              <p className="text-xs text-destructive font-medium">{t("project.delete_confirm_title")}</p>
                              <p className="text-xs text-muted-foreground">{t("project.delete_confirm_desc")}</p>
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmOpen(false)}
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {t("project.cancel")}
                                </button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={handleDelete}
                                  disabled={deleting}
                                  className="h-7 text-xs"
                                >
                                  {deleting ? t("project.deleting") : t("project.delete_confirm_btn")}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Description */}
                <p className="text-base text-[#3d4f7c]/80 dark:text-white/60 max-w-lg leading-relaxed mb-8">
                  {detail.project.description}
                </p>

                {/* CTA + Settings buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleStartLearning}
                    disabled={enrolling}
                    className="h-14 px-10 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-base font-bold flex items-center gap-3 shadow-[0_4px_20px_0_rgba(109,40,217,0.35)] hover:shadow-[0_6px_28px_0_rgba(109,40,217,0.45)] transition-all duration-[350ms] disabled:opacity-60"
                  >
                    {enrolling ? t("project.loading") : buttonLabel}
                    <ArrowRight className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setEditOpen(true)}
                    className="h-14 px-5 rounded-2xl bg-white/60 hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/20 text-[#3d4f7c] dark:text-white/70 text-sm font-semibold flex items-center gap-2 backdrop-blur-sm transition-all duration-[350ms]"
                  >
                    <Settings className="h-4.5 w-4.5" />
                    {t("project.settings")}
                  </button>
                </div>
              </div>

              {/* Right: cover image card — tilted like design mockup */}
              <div className="shrink-0 rotate-3 translate-y-2">
                {coverUrl ? (
                  <div className="bg-white rounded-[20px] p-3 shadow-[0_8px_40px_0_rgba(109,40,217,0.22)]">
                    <img
                      src={coverUrl}
                      alt={detail.project.title}
                      className="w-[260px] h-[220px] rounded-[14px] object-cover"
                    />
                  </div>
                ) : (
                  <div className="bg-white rounded-[20px] p-3 shadow-[0_8px_40px_0_rgba(109,40,217,0.22)]">
                    <div className="w-[260px] h-[220px] rounded-[14px] overflow-hidden">
                      <CoverFallback title={detail.project.title} slug={detail.project.name} />
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>
          {/* Project Brief Card */}
          {detail.project_brief && (
            <ProjectBriefCard brief={detail.project_brief} t={t} />
          )}

          {/* Sub-projects mode */}
          {hasSubProjects && (
            <>
              {/* Combined: Overall progress + Learning path timeline */}
              <div className="card-elevated overflow-hidden">
                {/* Header — clickable to toggle timeline */}
                <button
                  onClick={() => setLearningPathExpanded((v) => !v)}
                  className="w-full text-left px-6 pt-6 pb-5 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Layers className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-primary font-semibold">
                          {t("project.learning_path")}
                        </span>
                      </div>
                      <h2 className="text-lg font-extrabold text-foreground">{t("project.overall_mastery")}</h2>
                      <p className="text-xs text-muted-foreground">
                        {t("project.nodes_stages", { passed, total, stages: subProjects.length })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-extrabold font-[var(--font-manrope)] text-primary">{pct}%</span>
                      {learningPathExpanded
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      }
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>

                {/* Collapsed: compact icon row */}
                {!learningPathExpanded && (
                  <div className="px-6 pb-5">
                    <div className="flex items-center gap-2">
                      {subProjects.map((sp, idx) => {
                        const status = getSubProjectStatus(sp, subProjects)
                        const spIcon = getSpIcon(idx)
                        const IconComp = spIcon.icon
                        const isCompleted = status === "completed"
                        const isLocked = status === "locked"
                        const pctSp = sp.nodes_total > 0 ? Math.round((sp.nodes_passed / sp.nodes_total) * 100) : 0
                        return (
                          <button
                            key={sp.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!isLocked) {
                                if (!enrollment) gateway.enroll(params.name).catch(() => {})
                                router.push(`/learn/${params.name}?sub=${sp.id}`)
                              }
                            }}
                            disabled={isLocked}
                            title={`${sp.id}: ${sp.title} (${pctSp}%)`}
                            className={`relative flex flex-col items-center gap-1 transition-all ${
                              isLocked ? "opacity-35 cursor-not-allowed" : "cursor-pointer hover:scale-110"
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isCompleted
                                ? "bg-cyan-100 dark:bg-cyan-500/20 ring-2 ring-cyan-400/50"
                                : status === "in_progress"
                                ? "bg-primary/10 ring-2 ring-primary/40"
                                : `bg-gradient-to-br ${spIcon.gradient}`
                            }`}>
                              {isCompleted ? (
                                <CheckCircle2 className="h-4.5 w-4.5 text-cyan-600" />
                              ) : (
                                <IconComp className={`h-4 w-4 ${isLocked ? "text-muted-foreground/40" : spIcon.iconColor}`} />
                              )}
                            </div>
                            <span className="text-[9px] font-[var(--font-manrope)] font-bold text-muted-foreground">{sp.id}</span>
                            {pctSp > 0 && !isCompleted && (
                              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Expanded: full timeline */}
                {learningPathExpanded && (
                  <>
                    <div className="border-t border-border/50" />
                    <div className="px-6 pt-5 pb-6 animate-[loading-fade-in_0.25s_ease-out]">
                      <SubProjectTree
                        subProjects={subProjects}
                        milestones={detail.milestones}
                        lessonStatuses={lessonStatuses}
                        t={t}
                        onNodeClick={(spId) => {
                          const sp = subProjects.find((s) => s.id === spId)
                          if (!sp) return
                          const status = getSubProjectStatus(sp, subProjects)
                          if (status !== "locked") {
                            if (!enrollment) gateway.enroll(params.name).catch(() => {})
                            router.push(`/learn/${params.name}?sub=${spId}`)
                          }
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

            </>
          )}

          {/* Legacy layout: Overall Mastery (when no sub-projects) */}
          {!hasSubProjects && enrollment && (
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2 card-elevated p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-foreground">{t("project.overall_mastery")}</h2>
                    <p className="text-xs text-muted-foreground">{t("project.course_progress")}</p>
                  </div>
                  <span className="text-3xl font-extrabold font-[var(--font-manrope)] text-primary">{pct}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full bg-secondary overflow-hidden mb-5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  {[
                    { label: t("project.start_date"), value: formatDate(enrollment.started_at) },
                    { label: t("project.total_time"), value: formatDuration(enrollment.total_time_seconds) },
                    { label: t("project.last_active"), value: formatDate(enrollment.last_activity_at) },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
                      <p className="font-semibold text-foreground text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Insight card */}
              <div className="rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 p-5 text-white shadow-[0_4px_24px_0_oklch(0.488_0.258_302_/_0.25)]">
                <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest opacity-70 mb-2">{t("project.daily_insight")}</p>
                <h3 className="text-base font-bold mb-3">
                  {passed > 0 ? t("project.nodes_mastered", { n: passed, total }) : t("project.begin_journey")}
                </h3>
                <button
                  onClick={handleStartLearning}
                  className="w-full h-9 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {t("project.view_performance")}
                </button>
              </div>
            </div>
          )}

          {/* Career Path */}
          {enrollment && (
            <CareerPathCard projectName={params.name} t={t} />
          )}

          {/* Learning Stats */}
          {enrollment && (
            <LearningStatsCard projectName={params.name} />
          )}

          {/* Project Resources */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">{t("project.resources")}</h2>
              <button className="text-xs text-primary hover:text-primary/80 transition-colors">
                {t("project.manage_workspace")}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <ResourceCard
                icon={<IconKnowledgeTree />}
                title={t("project.knowledge_tree")}
                description={t("project.knowledge_tree_desc")}
                onClick={() => router.push(`/projects/${params.name}/tree`)}
              />
              <ResourceCard
                icon={<IconFoundation />}
                title={t("project.foundation")}
                description={t("project.foundation_desc")}
                onClick={() => router.push(`/projects/${params.name}/foundation`)}
              />
              <ResourceCard
                icon={<IconNotesGradient />}
                title={t("project.notes")}
                description={t("project.notes_desc")}
                onClick={() => router.push(`/projects/${params.name}/notes`)}
              />
              <ResourceCard
                icon={<IconResourcesGradient />}
                title={t("project.resources_title")}
                description={t("project.resources_desc")}
                onClick={() => router.push(`/projects/${params.name}/resources`)}
              />
              <ResourceCard
                icon={<IconStudentWorks />}
                title={t("project.student_works")}
                description={t("project.student_works_desc")}
                disabled
                badge={t("project.soon")}
              />
            </div>
          </div>

          {/* Active Roadmap — Knowledge Tree preview (only for legacy projects without sub-projects) */}
          {!hasSubProjects && (
            <div className="card-elevated overflow-hidden">
              <div className="px-6 pt-5 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Highlighter className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-primary font-semibold">
                    {t("project.active_roadmap")}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-foreground mb-1">
                  {t("project.knowledge_tree_title")}
                </h2>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("project.nodes_count", { n: total })} · {t("project.click_node")}
                </p>
                <button
                  onClick={() => router.push(`/projects/${params.name}/tree`)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {t("project.open_map")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="h-[360px]">
                <D3KnowledgeTree
                  milestones={detail.milestones}
                  progress={detail.progress}
                  onNodeClick={() => handleStartLearning()}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
