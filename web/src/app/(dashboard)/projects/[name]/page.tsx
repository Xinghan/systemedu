"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import {
  ArrowLeft, Clock, Play, GraduationCap, Highlighter, FolderOpen,
  Palette, Pencil, Save, X, Package, ChevronUp, BookOpen, ArrowRight,
  Zap,
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
import { IconTree, IconNote, IconScroll } from "@/components/learning/cartoon-icons"
import { gateway } from "@/lib/api"
import type { FactoryQueueItem, ProjectDetail } from "@/lib/types/api"

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
  iconBg: string
  title: string
  description: string
  onClick?: () => void
  disabled?: boolean
  badge?: string
}

function ResourceCard({ icon, iconBg, title, description, onClick, disabled, badge }: ResourceCardProps) {
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
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
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

export default function ProjectDetailPage() {
  const params = useParams<{ name: string }>()
  const router = useRouter()
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
      toast.success("Project saved")
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
          <p>{error ?? "Project not found"}</p>
          <Link href="/projects">
            <Button variant="outline" size="sm">Back to Projects</Button>
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

  const buttonLabel = isCompleted ? "Study Again" : isActive ? "Continue Learning" : "Start Learning"
  const ButtonIcon = isActive ? Play : GraduationCap

  const categoryTags = CATEGORY_TAGS[detail.project.category] ?? []
  const allTags = [...categoryTags, ...detail.project.tags.map((t) => t.toUpperCase())].slice(0, 4)

  return (
    <>
      <AppHeader />
      <div className="flex-1 overflow-y-auto animate-[loading-fade-in_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">
        {/* Hero section */}
        <div className="bg-gradient-to-br from-secondary/60 via-background to-background px-8 pt-8 pb-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-[80px]" />
          <div className="relative max-w-4xl">
            <Link href="/projects">
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Library
              </button>
            </Link>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {allTags.map((tag) => (
                <span key={tag} className="text-[10px] font-[var(--font-manrope)] uppercase tracking-wider px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{detail.project.title}</h1>
                  <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger render={
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                    } />
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Edit Project</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div>
                          <Label htmlFor="edit-title">Title</Label>
                          <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-2" />
                        </div>
                        <div>
                          <Label htmlFor="edit-desc">Description</Label>
                          <textarea id="edit-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full h-24 px-4 py-3 rounded-xl bg-secondary/60 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring mt-2 border-0" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="edit-category">Category</Label>
                            <select id="edit-category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full mt-2 h-11 px-3 rounded-xl bg-secondary/60 text-sm focus:outline-none focus:ring-2 focus:ring-ring border-0">
                              {CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label htmlFor="edit-hours">Hours</Label>
                            <Input id="edit-hours" type="number" min={1} value={editHours} onChange={(e) => setEditHours(Number(e.target.value) || 1)} className="mt-2" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="edit-age-min">Min Age</Label>
                            <Input id="edit-age-min" type="number" min={6} max={18} value={editAgeMin} onChange={(e) => setEditAgeMin(Number(e.target.value) || 6)} className="mt-2" />
                          </div>
                          <div>
                            <Label htmlFor="edit-age-max">Max Age</Label>
                            <Input id="edit-age-max" type="number" min={6} max={18} value={editAgeMax} onChange={(e) => setEditAgeMax(Number(e.target.value) || 18)} className="mt-2" />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="edit-tags">Tags (comma separated)</Label>
                          <Input id="edit-tags" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="e.g. Python, Machine Learning" className="mt-2" />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                          <Button variant="outline" onClick={() => setEditOpen(false)}>
                            <X className="h-4 w-4 mr-2" />Cancel
                          </Button>
                          <Button onClick={handleSaveEdit} disabled={saving}>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">{detail.project.description}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-[var(--font-manrope)] font-semibold text-foreground">{detail.project.estimated_hours}h</span>
                  </span>
                  <span className="font-[var(--font-manrope)]">Ages {detail.project.age_range[0]}-{detail.project.age_range[1]}</span>
                </div>
              </div>

              {/* CTA button */}
              <button
                onClick={handleStartLearning}
                disabled={enrolling}
                className="shrink-0 h-11 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold flex items-center gap-2 shadow-[0_2px_16px_0_oklch(0.488_0.258_302_/_0.30)] hover:shadow-[0_4px_24px_0_oklch(0.488_0.258_302_/_0.40)] transition-all duration-[350ms] disabled:opacity-60"
              >
                <ButtonIcon className="h-4 w-4" />
                {enrolling ? "Loading..." : buttonLabel}
              </button>
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
                    <h2 className="text-base font-bold text-foreground">Overall Mastery</h2>
                    <p className="text-xs text-muted-foreground">Course progress tracking</p>
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
                    { label: "START DATE", value: formatDate(enrollment.started_at) },
                    { label: "TOTAL TIME", value: formatDuration(enrollment.total_time_seconds) },
                    { label: "LAST ACTIVE", value: formatDate(enrollment.last_activity_at) },
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
                <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest opacity-70 mb-2">Daily Insight</p>
                <h3 className="text-base font-bold mb-3">
                  {passed > 0 ? `${passed}/${total} nodes mastered` : "Begin your journey"}
                </h3>
                <button
                  onClick={handleStartLearning}
                  className="w-full h-9 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="h-3.5 w-3.5" />
                  View Performance Data
                </button>
              </div>
            </div>
          )}

          {/* Project Resources */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Project Resources</h2>
              <button className="text-xs text-primary hover:text-primary/80 transition-colors">
                Manage Workspace
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <ResourceCard
                icon={<IconTree className="h-6 w-6 text-primary" />}
                iconBg="bg-primary/10"
                title="Knowledge Tree"
                description="Visualize your learning nodes."
                onClick={() => router.push(`/projects/${params.name}/tree`)}
              />
              <ResourceCard
                icon={<IconNote className="h-5 w-5 text-amber-600" />}
                iconBg="bg-amber-100 dark:bg-amber-500/15"
                title="Notes"
                description="Project journals & research."
                onClick={() => router.push(`/projects/${params.name}/notes`)}
              />
              <ResourceCard
                icon={<FolderOpen className="h-5 w-5 text-blue-600" />}
                iconBg="bg-blue-100 dark:bg-blue-500/15"
                title="Resources"
                description="External libraries & papers."
                onClick={() => router.push(`/projects/${params.name}/resources`)}
              />
              <ResourceCard
                icon={<Palette className="h-5 w-5 text-pink-500" />}
                iconBg="bg-pink-100 dark:bg-pink-500/15"
                title="Student Works"
                description="Peer reviews & submissions."
                disabled
                badge="Soon"
              />
              <ResourceCard
                icon={<BookOpen className="h-5 w-5 text-cyan-600" />}
                iconBg="bg-cyan-100 dark:bg-cyan-500/15"
                title="AI Course"
                description="Adaptive curriculum builder."
                onClick={() => router.push(`/projects/${params.name}/batch-lessons`)}
                badge={lessonQueueRunning ? "Active" : undefined}
              />
              <ResourceCard
                icon={<Package className="h-5 w-5 text-violet-600" />}
                iconBg="bg-violet-100 dark:bg-violet-500/15"
                title="Object Queue"
                description="Next topics in line."
                onClick={() => setQueueOpen((v) => !v)}
                badge={queueItems.length > 0 ? `${queueItems.length}` : undefined}
              />
            </div>
          </div>

          {/* Object Queue expandable */}
          {queueOpen && (
            <div className="card-elevated overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
                <h3 className="text-sm font-semibold">Object Queue</h3>
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
                      {triggering ? "Triggering..." : "Trigger Build"}
                    </button>
                  )}
                  <button onClick={() => setQueueOpen(false)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <ChevronUp className="h-3.5 w-3.5" />Collapse
                  </button>
                </div>
              </div>
              {queueItems.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">No pending object tasks</div>
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
                        {item.status === "pending" ? "Pending" : "Building"}
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
                  Active Roadmap
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-foreground mb-1">
                Your Knowledge Tree
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                {total} knowledge nodes · Click any node to continue learning
              </p>
              <button
                onClick={() => router.push(`/projects/${params.name}/tree`)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Open Full Knowledge Map
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
