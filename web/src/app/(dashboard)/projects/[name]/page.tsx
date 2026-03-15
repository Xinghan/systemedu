"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, GraduationCap, Clock, Trophy, Play, CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AppHeader } from "@/components/layout/app-header"
import { KnowledgeTreeView } from "@/components/knowledge-tree/knowledge-tree-view"
import { gateway } from "@/lib/api"
import type { ProjectDetail } from "@/lib/types/api"

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
      // Still navigate even if enroll fails
      router.push(`/learn/${params.name}`)
    } finally {
      setEnrolling(false)
    }
  }

  if (loading) {
    return (
      <>
        <AppHeader title="项目详情" />
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          加载中...
        </div>
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

  const buttonLabel = isCompleted
    ? "已完成"
    : isActive
    ? "继续学习"
    : "开始学习"

  const ButtonIcon = isCompleted ? CheckCircle : isActive ? Play : GraduationCap

  return (
    <>
      <AppHeader title={detail.project.title} />
      <div className="p-6 space-y-6">
        {/* Project info */}
        <div className="flex items-start gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{detail.project.title}</h1>
            <p className="text-muted-foreground mt-1">{detail.project.description}</p>
            <div className="flex gap-2 mt-3">
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
            className="flex items-center gap-2"
          >
            <ButtonIcon className="h-4 w-4" />
            {enrolling ? "加载中..." : buttonLabel}
          </Button>
        </div>

        {/* Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              学习进度
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <Progress value={pct} className="flex-1" />
              <span className="text-sm font-medium">{pct}%</span>
              <span className="text-xs text-muted-foreground">
                {passed}/{total} 节点
              </span>
            </div>
            {enrollment && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">开始时间</span>
                  <p className="font-medium">{formatDate(enrollment.started_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">已学时长</span>
                  <p className="font-medium">{formatDuration(enrollment.total_time_seconds)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">最近活动</span>
                  <p className="font-medium">{formatDate(enrollment.last_activity_at)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Knowledge tree */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">知识树</CardTitle>
          </CardHeader>
          <CardContent>
            <KnowledgeTreeView
              milestones={detail.milestones}
              progress={detail.progress}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
