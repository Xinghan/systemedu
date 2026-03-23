"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { ArrowLeft, Clock, Play, GraduationCap, Highlighter, FolderOpen, Palette, Pencil, Save, X, Package, ChevronUp, BookOpen } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { AppHeader } from "@/components/layout/app-header"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { IconTree, IconNote, IconScroll, IconBlueprint } from "@/components/learning/cartoon-icons"
import { gateway } from "@/lib/api"
import type { FactoryQueueItem, ProjectDetail } from "@/lib/types/api"

const CATEGORY_OPTIONS = [
  { value: "ai", label: "人工智能" },
  { value: "biotech", label: "生物技术" },
  { value: "aerospace", label: "航天航空" },
  { value: "music", label: "音乐" },
  { value: "climate", label: "气候" },
  { value: "robotics", label: "机器人" },
  { value: "chemistry", label: "化学" },
  { value: "math", label: "数学" },
  { value: "cs", label: "计算机" },
  { value: "other", label: "其他" },
]

const D3KnowledgeTree = dynamic(
  () => import("@/components/knowledge-tree/d3-knowledge-tree").then((m) => m.D3KnowledgeTree),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><LoadingSpinner size="sm" label="加载知识树" /></div> },
)

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "-"
  return new Date(isoString).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

interface ModuleCardProps {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
  onClick?: () => void
  disabled?: boolean
  badge?: string
}

function ModuleCard({ icon, iconBg, title, description, onClick, disabled, badge }: ModuleCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-4 p-5 rounded-xl border bg-card text-left transition-all ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:shadow-md hover:border-primary/30 cursor-pointer"
      }`}
    >
      <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
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
  // Lesson batch generation state (running badge only)
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

    gateway
      .objectQueue(params.name)
      .then((r) => {
        const active = r.items.filter((i) => i.status === "pending" || i.status === "in_progress")
        setQueueItems(active)
      })
      .catch(() => {/* non-fatal */})

    gateway
      .getLessonQueue(params.name)
      .then((r) => setLessonQueueRunning(r.running))
      .catch(() => {/* non-fatal */})
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
        prev
          ? {
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
            }
          : prev
      )
      setEditOpen(false)
      toast.success("项目信息已保存")
    } catch (e: unknown) {
      toast.error(`保存失败: ${e instanceof Error ? e.message : "未知错误"}`)
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

  if (loading) {
    return (
      <>
        <AppHeader title="项目详情" />
        <PageLoading />
      </>
    )
  }

  if (error || !detail) {
    return (
      <>
        <AppHeader title="项目详情" />
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p>{error ?? "项目未找到"}</p>
          <Link href="/projects">
            <Button variant="link" className="mt-2">
              返回项目列表
            </Button>
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

  const buttonLabel = isCompleted ? "再次学习" : isActive ? "继续学习" : "开始学习"
  const ButtonIcon = isCompleted ? Play : isActive ? Play : GraduationCap

  return (
    <>
      <AppHeader title={detail.project.title} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Header: title + action */}
          <div className="flex items-start gap-4">
            <Link href="/projects">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{detail.project.title}</h1>
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger render={
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground shrink-0">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  } />
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>编辑项目信息</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div>
                        <Label htmlFor="edit-title">项目标题</Label>
                        <Input
                          id="edit-title"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-desc">项目描述</Label>
                        <textarea
                          id="edit-desc"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full h-24 px-4 py-3 rounded-xl border bg-muted/50 text-base resize-y focus:outline-none focus:ring-2 focus:ring-ring mt-2"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="edit-category">分类</Label>
                          <select
                            id="edit-category"
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full mt-2 h-12 px-4 rounded-xl border bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {CATEGORY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="edit-hours">预计学时 (h)</Label>
                          <Input
                            id="edit-hours"
                            type="number"
                            min={1}
                            value={editHours}
                            onChange={(e) => setEditHours(Number(e.target.value) || 1)}
                            className="mt-2"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="edit-age-min">最小年龄</Label>
                          <Input
                            id="edit-age-min"
                            type="number"
                            min={6}
                            max={18}
                            value={editAgeMin}
                            onChange={(e) => setEditAgeMin(Number(e.target.value) || 6)}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-age-max">最大年龄</Label>
                          <Input
                            id="edit-age-max"
                            type="number"
                            min={6}
                            max={18}
                            value={editAgeMax}
                            onChange={(e) => setEditAgeMax(Number(e.target.value) || 18)}
                            className="mt-2"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="edit-tags">标签 (逗号分隔)</Label>
                        <Input
                          id="edit-tags"
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          placeholder="例: Python, 机器学习, 入门"
                          className="mt-2"
                        />
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setEditOpen(false)}>
                          <X className="h-4 w-4 mr-2" />
                          取消
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                          <Save className="h-4 w-4 mr-2" />
                          {saving ? "保存中..." : "保存"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">{detail.project.description}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge>{detail.project.category}</Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {detail.project.estimated_hours}h
                </Badge>
                {detail.project.tags.map((t) => (
                  <Badge key={t} variant="outline">{t}</Badge>
                ))}
              </div>
            </div>
            <Button
              onClick={handleStartLearning}
              disabled={enrolling}
              size="lg"
              className="flex items-center gap-2 shrink-0"
            >
              <ButtonIcon className="h-4 w-4" />
              {enrolling ? "加载中..." : buttonLabel}
            </Button>
          </div>

          {/* Progress bar */}
          {enrollment && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-4 mb-3">
                <Progress value={pct} className="flex-1" />
                <span className="text-sm font-semibold">{pct}%</span>
                <span className="text-xs text-muted-foreground">
                  {passed}/{total} 节点
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">开始时间</span>
                  <p className="font-medium text-sm">{formatDate(enrollment.started_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">已学时长</span>
                  <p className="font-medium text-sm">{formatDuration(enrollment.total_time_seconds)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">最近活动</span>
                  <p className="font-medium text-sm">{formatDate(enrollment.last_activity_at)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Module cards */}
          <div>
            <h2 className="text-base font-semibold mb-4">快速操作</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ModuleCard
                icon={<IconTree className="h-6 w-6" />}
                iconBg="bg-emerald-100 dark:bg-emerald-500/20"
                title="知识树"
                description="查看完整知识结构和学习路径"
                onClick={() => router.push(`/projects/${params.name}/tree`)}
              />
              <ModuleCard
                icon={<Highlighter className="h-5 w-5 text-amber-600" />}
                iconBg="bg-amber-100 dark:bg-amber-500/20"
                title="笔记"
                description="查看按知识点整理的 Markdown 学习笔记"
                onClick={() => router.push(`/projects/${params.name}/notes`)}
              />
              <ModuleCard
                icon={<FolderOpen className="h-5 w-5 text-blue-600" />}
                iconBg="bg-blue-100 dark:bg-blue-500/20"
                title="资料"
                description="按知识点浏览收集的网页和视频资源"
                onClick={() => router.push(`/projects/${params.name}/resources`)}
              />
              <ModuleCard
                icon={<Palette className="h-5 w-5 text-purple-600" />}
                iconBg="bg-purple-100 dark:bg-purple-500/20"
                title="作品"
                description="展示你的项目成果和作品集"
                disabled
                badge="即将推出"
              />
              <ModuleCard
                icon={<BookOpen className="h-5 w-5 text-cyan-600" />}
                iconBg="bg-cyan-100 dark:bg-cyan-500/20"
                title="预生成课程"
                description="按知识树顺序自动生成课程内容，最多 10 个节点"
                onClick={() => router.push(`/projects/${params.name}/batch-lessons`)}
                badge={lessonQueueRunning ? "生成中" : undefined}
              />
              <ModuleCard
                icon={<Package className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
                iconBg="bg-slate-100 dark:bg-slate-500/20"
                title="对象队列"
                description="查看等待创建的 3D 对象任务"
                onClick={() => setQueueOpen((v) => !v)}
                badge={queueItems.length > 0 ? `${queueItems.length} 待处理` : undefined}
              />
            </div>
          </div>

          {/* Object Queue expandable list */}
          {queueOpen && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">对象队列</h2>
                <div className="flex items-center gap-3">
                  {queueItems.length > 0 && (
                    <button
                      onClick={async () => {
                        setTriggering(true)
                        try {
                          const r = await gateway.objectQueueTrigger(params.name)
                          toast.success(`已触发 ${r.triggered} 个创建任务`)
                          // Refresh queue
                          const fresh = await gateway.objectQueue(params.name)
                          setQueueItems(fresh.items.filter((i) => i.status === "pending" || i.status === "in_progress"))
                        } catch (e: unknown) {
                          toast.error(`触发失败: ${e instanceof Error ? e.message : "未知错误"}`)
                        } finally {
                          setTriggering(false)
                        }
                      }}
                      disabled={triggering}
                      className="text-xs text-primary flex items-center gap-1 hover:opacity-80 disabled:opacity-50"
                    >
                      {triggering ? "触发中..." : "触发创建"}
                    </button>
                  )}
                  <button
                    onClick={() => setQueueOpen(false)}
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    收起
                  </button>
                </div>
              </div>
              {queueItems.length === 0 ? (
                <div className="rounded-xl border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
                  暂无待处理的对象创建任务
                </div>
              ) : (
                <div className="rounded-xl border bg-card divide-y">
                  {queueItems.map((item) => (
                    <div key={item.object_key} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-medium truncate">{item.object_key}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          item.status === "pending"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                        }`}>
                          {item.status === "pending" ? "等待创建" : "创建中"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* D3 Knowledge Tree Visualization */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-semibold">知识树全览</h2>
              <span className="text-xs text-muted-foreground">
                {total} 个知识节点 · 可缩放拖拽
              </span>
            </div>
            <div className="h-[400px]">
              <D3KnowledgeTree
                milestones={detail.milestones}
                progress={detail.progress}
                onNodeClick={() => {
                  handleStartLearning()
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
