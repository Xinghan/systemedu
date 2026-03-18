"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { ArrowLeft, Clock, Play, CheckCircle, GraduationCap, Highlighter, FolderOpen, Palette } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AppHeader } from "@/components/layout/app-header"
import { IconTree, IconNote, IconScroll, IconBlueprint } from "@/components/learning/cartoon-icons"
import { gateway } from "@/lib/api"
import type { ProjectDetail } from "@/lib/types/api"

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

  useEffect(() => {
    if (!params.name) return
    gateway
      .project(params.name)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.name])

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

  const buttonLabel = isCompleted ? "已完成" : isActive ? "继续学习" : "开始学习"
  const ButtonIcon = isCompleted ? CheckCircle : isActive ? Play : GraduationCap

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
              <h1 className="text-2xl font-bold">{detail.project.title}</h1>
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
              disabled={enrolling || isCompleted}
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
                onClick={handleStartLearning}
              />
              <ModuleCard
                icon={<Highlighter className="h-5 w-5 text-amber-600" />}
                iconBg="bg-amber-100 dark:bg-amber-500/20"
                title="笔记"
                description="查看高亮标注和学习批注"
                onClick={handleStartLearning}
              />
              <ModuleCard
                icon={<FolderOpen className="h-5 w-5 text-blue-600" />}
                iconBg="bg-blue-100 dark:bg-blue-500/20"
                title="资料"
                description="项目相关学习资料和参考文档"
                disabled
                badge="即将推出"
              />
              <ModuleCard
                icon={<Palette className="h-5 w-5 text-purple-600" />}
                iconBg="bg-purple-100 dark:bg-purple-500/20"
                title="作品"
                description="展示你的项目成果和作品集"
                disabled
                badge="即将推出"
              />
            </div>
          </div>

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
