"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import {
  ArrowLeft, Clock, Play, GraduationCap, Highlighter,
  Pencil, Save, X, ChevronUp, ArrowRight, Zap,
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
import type { FactoryQueueItem, ProjectDetail } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

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

// Gradient icon components matching the project_resources_icons design
function IconKnowledgeTree() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
      <rect width="56" height="56" rx="16" fill="url(#grad-tree)" />
      <defs>
        <linearGradient id="grad-tree" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <circle cx="28" cy="16" r="4" fill="white" fillOpacity="0.9" />
      <circle cx="18" cy="30" r="3.5" fill="white" fillOpacity="0.75" />
      <circle cx="38" cy="30" r="3.5" fill="white" fillOpacity="0.75" />
      <circle cx="13" cy="42" r="3" fill="white" fillOpacity="0.6" />
      <circle cx="23" cy="42" r="3" fill="white" fillOpacity="0.6" />
      <circle cx="33" cy="42" r="3" fill="white" fillOpacity="0.6" />
      <circle cx="43" cy="42" r="3" fill="white" fillOpacity="0.6" />
      <line x1="28" y1="20" x2="18" y2="26.5" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
      <line x1="28" y1="20" x2="38" y2="26.5" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
      <line x1="18" y1="33.5" x2="13" y2="39" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <line x1="18" y1="33.5" x2="23" y2="39" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <line x1="38" y1="33.5" x2="33" y2="39" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <line x1="38" y1="33.5" x2="43" y2="39" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
    </svg>
  )
}

function IconNotesGradient() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
      <rect width="56" height="56" rx="16" fill="url(#grad-notes)" />
      <defs>
        <linearGradient id="grad-notes" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0d9488" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      <rect x="16" y="13" width="24" height="30" rx="3" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <line x1="21" y1="21" x2="35" y2="21" stroke="white" strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="21" y1="27" x2="35" y2="27" stroke="white" strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="21" y1="33" x2="29" y2="33" stroke="white" strokeOpacity="0.85" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="38" cy="39" r="6" fill="white" fillOpacity="0.25" />
      <path d="M35.5 39.5l2 2 4-4" stroke="white" strokeOpacity="0.95" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconResourcesGradient() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
      <rect width="56" height="56" rx="16" fill="url(#grad-res)" />
      <defs>
        <linearGradient id="grad-res" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <path d="M16 36V22a3 3 0 013-3h5l2 3h11a3 3 0 013 3v11a3 3 0 01-3 3H19a3 3 0 01-3-3z" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
      <line x1="22" y1="29" x2="34" y2="29" stroke="white" strokeOpacity="0.9" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="22" y1="33" x2="30" y2="33" stroke="white" strokeOpacity="0.7" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconStudentWorks() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
      <rect width="56" height="56" rx="16" fill="url(#grad-sw)" />
      <defs>
        <linearGradient id="grad-sw" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#db2777" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      <circle cx="28" cy="22" r="6" fill="white" fillOpacity="0.25" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
      <circle cx="19" cy="23" r="4" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx="37" cy="23" r="4" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M14 40c0-5.5 6.3-9 14-9s14 3.5 14 9" stroke="white" strokeOpacity="0.75" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconAICourse() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
      <rect width="56" height="56" rx="16" fill="url(#grad-ai)" />
      <defs>
        <radialGradient id="grad-ai" cx="30%" cy="30%" r="80%" fx="30%" fy="30%">
          <stop stopColor="#7c3aed" />
          <stop offset="1" stopColor="#4c1d95" />
        </radialGradient>
      </defs>
      <circle cx="28" cy="24" r="8" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="28" cy="24" r="3" fill="white" fillOpacity="0.9" />
      <line x1="28" y1="16" x2="28" y2="14" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="28" y1="32" x2="28" y2="34" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="24" x2="18" y2="24" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="36" y1="24" x2="38" y2="24" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M23 38h10M25 41h6" stroke="white" strokeOpacity="0.75" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="28" y1="34" x2="28" y2="38" stroke="white" strokeOpacity="0.65" strokeWidth="1.5" />
    </svg>
  )
}

function IconObjectQueue() {
  return (
    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
      <rect width="56" height="56" rx="16" fill="url(#grad-obj)" />
      <defs>
        <linearGradient id="grad-obj" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#64748b" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
      </defs>
      <path d="M28 14l12 7v14l-12 7-12-7V21z" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.65" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28 28l12-7M28 28V42M28 28l-12-7" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M34 17.5l12 7v14l-12 7-12-7V24.5z" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeLinejoin="round" transform="translate(5 -3) scale(0.6) translate(-15 8)" />
    </svg>
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
  const [queueItems, setQueueItems] = useState<FactoryQueueItem[]>([])
  const [queueOpen, setQueueOpen] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [lessonQueueRunning, setLessonQueueRunning] = useState(false)

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
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    gateway.objectQueue(params.name)
      .then((r) => setQueueItems(r.items.filter((i) => i.status === "pending" || i.status === "in_progress")))
      .catch(() => {})

    gateway.getLessonQueue(params.name)
      .then((r) => setLessonQueueRunning(r.running))
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
      })
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
          },
        } : prev
      )
      setEditOpen(false)
      toast.success(t("project.saved"))
    } catch (e: unknown) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : "Unknown error"}`)
    } finally {
      setSaving(false)
    }
  }

  const handleStartLearning = async () => {
    if (!params.name) return
    setEnrolling(true)
    try {
      await gateway.enroll(params.name)
      router.push(`/learn/${params.name}`)
    } catch {
      router.push(`/learn/${params.name}`)
    } finally {
      setEnrolling(false)
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

  const enrollment = detail.enrollment
  const isCompleted = enrollment?.status === "completed"
  const isActive = enrollment?.status === "active"

  const buttonLabel = isCompleted ? t("project.study_again") : isActive ? t("project.continue_learning") : t("project.start_learning")
  const ButtonIcon = isActive ? Play : GraduationCap

  const categoryTags = CATEGORY_TAGS[detail.project.category] ?? []
  const allTags = [...categoryTags, ...detail.project.tags.map((t) => t.toUpperCase())].slice(0, 4)

  const coverUrl = detail.project.cover_image_url
    ? `${process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:18820"}${detail.project.cover_image_url}`
    : null

  return (
    <>
      <AppHeader />
      <div className="flex-1 overflow-y-auto animate-[loading-fade-in_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">
        {/* Hero section */}
        <div className="px-8 pt-6 pb-2">
          <div className="max-w-5xl mx-auto">
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
                  {allTags.map((tag) => (
                    <span key={tag} className="text-[11px] font-[var(--font-manrope)] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full bg-emerald-200/80 text-emerald-800 dark:bg-emerald-800/40 dark:text-emerald-300">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <div className="flex items-center gap-2 mb-4">
                  <h1 className="text-[2.75rem] font-extrabold text-[#1e2d6b] dark:text-white leading-tight tracking-tight">
                    {detail.project.title}
                  </h1>
                  <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger render={
                      <button className="p-1.5 rounded-lg text-[#1e2d6b]/40 hover:text-[#1e2d6b] hover:bg-white/30 dark:text-white/40 dark:hover:text-white transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                    } />
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
                        <div className="flex justify-end gap-3 pt-2">
                          <Button variant="outline" onClick={() => setEditOpen(false)}>
                            <X className="h-4 w-4 mr-2" />{t("project.cancel")}
                          </Button>
                          <Button onClick={handleSaveEdit} disabled={saving}>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? t("project.saving") : t("project.save")}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Description */}
                <p className="text-base text-[#3d4f7c]/80 dark:text-white/60 max-w-lg leading-relaxed mb-8">
                  {detail.project.description}
                </p>

                {/* CTA button — wide purple pill */}
                <button
                  onClick={handleStartLearning}
                  disabled={enrolling}
                  className="h-14 px-10 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-base font-bold flex items-center gap-3 shadow-[0_4px_20px_0_rgba(109,40,217,0.35)] hover:shadow-[0_6px_28px_0_rgba(109,40,217,0.45)] transition-all duration-[350ms] disabled:opacity-60"
                >
                  {enrolling ? t("project.loading") : buttonLabel}
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>

              {/* Right: cover image card — white border, large rounded */}
              <div className="shrink-0">
                {coverUrl ? (
                  <div className="bg-white rounded-[20px] p-3 shadow-[0_8px_40px_0_rgba(109,40,217,0.18)]">
                    <img
                      src={coverUrl}
                      alt={detail.project.title}
                      className="w-[260px] h-[220px] rounded-[14px] object-cover"
                    />
                  </div>
                ) : (
                  <div className="bg-white rounded-[20px] p-3 shadow-[0_8px_40px_0_rgba(109,40,217,0.18)]">
                    <div className="w-[260px] h-[220px] rounded-[14px] bg-gradient-to-br from-violet-600 via-purple-600 to-purple-800 flex items-center justify-center">
                      <span className="text-6xl font-extrabold text-white/80 tracking-tight">
                        {detail.project.title.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
          {/* Overall Mastery */}
          {enrollment && (
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
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700"
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
              <ResourceCard
                icon={<IconAICourse />}
                title={t("project.ai_course")}
                description={t("project.ai_course_desc")}
                onClick={() => router.push(`/projects/${params.name}/batch-lessons`)}
                badge={lessonQueueRunning ? "Active" : undefined}
              />
              <ResourceCard
                icon={<IconObjectQueue />}
                title={t("project.object_queue")}
                description={t("project.object_queue_desc")}
                onClick={() => setQueueOpen((v) => !v)}
                badge={queueItems.length > 0 ? `${queueItems.length}` : undefined}
              />
            </div>
          </div>

          {/* Object Queue expandable */}
          {queueOpen && (
            <div className="card-elevated overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                <h3 className="text-sm font-semibold">{t("project.object_queue")}</h3>
                <div className="flex items-center gap-3">
                  {queueItems.length > 0 && (
                    <button
                      onClick={async () => {
                        setTriggering(true)
                        try {
                          const r = await gateway.objectQueueTrigger(params.name)
                          toast.success(`Triggered ${r.triggered} tasks`)
                          const fresh = await gateway.objectQueue(params.name)
                          setQueueItems(fresh.items.filter((i) => i.status === "pending" || i.status === "in_progress"))
                        } catch (e: unknown) {
                          toast.error(`Trigger failed: ${e instanceof Error ? e.message : "Unknown error"}`)
                        } finally {
                          setTriggering(false)
                        }
                      }}
                      disabled={triggering}
                      className="text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                    >
                      {triggering ? t("project.triggering") : t("project.trigger_build")}
                    </button>
                  )}
                  <button onClick={() => setQueueOpen(false)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <ChevronUp className="h-3.5 w-3.5" />{t("project.collapse")}
                  </button>
                </div>
              </div>
              {queueItems.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">{t("project.no_pending")}</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {queueItems.map((item) => (
                    <div key={item.object_key} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-medium truncate">{item.object_key}</p>
                        {item.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>}
                      </div>
                      <span className={`text-[10px] font-[var(--font-manrope)] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        item.status === "pending"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                          : "bg-primary/15 text-primary"
                      }`}>
                        {item.status === "pending" ? t("project.pending") : t("project.building")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Active Roadmap — Knowledge Tree preview */}
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
        </div>
      </div>
    </>
  )
}
