"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import {
  ArrowLeft, Clock, Play, GraduationCap, Highlighter,
  Pencil, Save, X, ChevronUp, ArrowRight, Zap, ImageIcon, Upload, Wand2, Trash2,
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
    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-400/10 flex items-center justify-center">
      <div className="absolute inset-0 bg-emerald-400/8 rounded-2xl blur-xl" />
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

function IconObjectQueue() {
  return (
    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400/10 to-purple-300/10 flex items-center justify-center">
      <div className="absolute inset-0 bg-violet-400/8 rounded-2xl blur-xl" />
      <div className="relative w-12 h-12 rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-[0_8px_32px_rgba(167,139,250,0.1)] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <path d="M12 3l9 5v8l-9 5-9-5V8l9-5z" />
          <line x1="12" y1="13" x2="12" y2="21" />
          <line x1="12" y1="13" x2="3" y2="8" />
          <line x1="12" y1="13" x2="21" y2="8" />
        </svg>
      </div>
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
  const [queueItems, setQueueItems] = useState<FactoryQueueItem[]>([])
  const [queueOpen, setQueueOpen] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [lessonQueueRunning, setLessonQueueRunning] = useState(false)
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null)
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null)
  const [generatingEditCover, setGeneratingEditCover] = useState(false)
  const [coverCacheBust, setCoverCacheBust] = useState(Date.now())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

        // If no cover yet, poll until backend finishes generating it
        if (!d.project.cover_image_url) {
          let attempts = 0
          const timer = setInterval(async () => {
            attempts++
            if (attempts > 20) { clearInterval(timer); return }
            try {
              const latest = await gateway.project(params.name)
              if (latest.project.cover_image_url) {
                clearInterval(timer)
                setCoverCacheBust(Date.now())
                setDetail((prev) => prev ? { ...prev, project: { ...prev.project, cover_image_url: latest.project.cover_image_url } } : prev)
              }
            } catch { clearInterval(timer) }
          }, 5000)
          return () => clearInterval(timer)
        }
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
      let newCoverUrl = detail.project.cover_image_url
      if (editCoverFile) {
        try {
          const r = await gateway.uploadProjectCover(params.name, editCoverFile)
          newCoverUrl = r.url
        } catch { /* non-fatal */ }
      } else if (editCoverPreview === "__generate__") {
        try { await gateway.generateProjectCover(params.name) } catch { /* non-fatal */ }
        // Cover URL will update after generation completes in background
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
                    <span key={`${tag}-${i}`} className="text-[11px] font-[var(--font-manrope)] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full bg-emerald-200/80 text-emerald-800 dark:bg-emerald-800/40 dark:text-emerald-300">
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
                        {/* Cover image */}
                        <div>
                          <Label>{t("project.cover_image")}</Label>
                          <div className="mt-2 flex items-center gap-3">
                            {/* Preview */}
                            <div className="w-24 h-16 rounded-xl overflow-hidden bg-secondary/60 shrink-0 flex items-center justify-center border border-border/40">
                              {editCoverPreview && editCoverPreview !== "__generate__" ? (
                                <img src={editCoverPreview} alt="cover" className="w-full h-full object-cover" />
                              ) : editCoverPreview === "__generate__" ? (
                                <div className="flex flex-col items-center gap-1 text-primary">
                                  <Wand2 className="h-4 w-4 animate-pulse" />
                                  <span className="text-[9px] font-[var(--font-manrope)] uppercase tracking-wider">AI Gen</span>
                                </div>
                              ) : detail?.project.cover_image_url ? (
                                <img src={`${process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:18820"}${detail.project.cover_image_url}`} alt="cover" className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                  <ImageIcon className="h-4 w-4" />
                                  <span className="text-[9px] font-[var(--font-manrope)] uppercase tracking-wider">Default</span>
                                </div>
                              )}
                            </div>
                            {/* Actions */}
                            <div className="flex flex-col gap-1.5">
                              {/* AI Generate */}
                              <button
                                type="button"
                                disabled={generatingEditCover}
                                onClick={async () => {
                                  if (!params.name) return
                                  setEditCoverFile(null)
                                  setEditCoverPreview("__generate__")
                                  setGeneratingEditCover(true)
                                  // Record current cover URL to detect change
                                  const prevCoverUrl = detail?.project.cover_image_url ?? null
                                  const generationStartTime = Date.now()
                                  try {
                                    await gateway.generateProjectCover(params.name)
                                    // Poll for result every 6s, up to 24 attempts (2min)
                                    const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:18820"
                                    for (let i = 0; i < 24; i++) {
                                      await new Promise((r) => setTimeout(r, 6000))
                                      const d = await gateway.project(params.name)
                                      const newCoverUrl = d.project.cover_image_url
                                      // Accept if: URL is set AND (URL changed OR enough time has passed that it's a fresh generation)
                                      if (newCoverUrl && (newCoverUrl !== prevCoverUrl || Date.now() - generationStartTime > 20000)) {
                                        const ts = Date.now()
                                        const url = `${GATEWAY}${newCoverUrl}?t=${ts}`
                                        setEditCoverPreview(url)
                                        setCoverCacheBust(ts)
                                        setDetail((prev) => prev ? { ...prev, project: { ...prev.project, cover_image_url: newCoverUrl } } : prev)
                                        break
                                      }
                                    }
                                  } catch {
                                    // non-fatal
                                  } finally {
                                    setGeneratingEditCover(false)
                                  }
                                }}
                                className="inline-flex h-8 px-3 items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium transition-colors w-fit disabled:opacity-60"
                              >
                                {generatingEditCover ? (
                                  <><div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />{t("project.generating_cover")}</>
                                ) : (
                                  <><Wand2 className="h-3 w-3" />{t("project.ai_generate_cover")}</>
                                )}
                              </button>
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
                    <div className="w-[260px] h-[220px] rounded-[14px] bg-gradient-to-br from-violet-600 via-purple-600 to-purple-800 flex flex-col items-center justify-center gap-3">
                      <span className="text-7xl font-extrabold text-white/80 tracking-tight leading-none">
                        {detail.project.title.charAt(0).toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1.5 text-white/50 text-[11px]">
                        <div className="h-3 w-3 rounded-full border-2 border-white/40 border-t-transparent animate-spin" />
                        <span style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>生成封面中...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>
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
