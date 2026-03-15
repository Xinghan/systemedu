"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, GraduationCap, Clock, Trophy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AppHeader } from "@/components/layout/app-header"
import { TreeFlow } from "@/components/knowledge-tree/tree-flow"
import { gateway } from "@/lib/api"
import type { ProjectDetail } from "@/lib/types/api"

export default function ProjectDetailPage() {
  const params = useParams<{ name: string }>()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params.name) return
    gateway
      .project(params.name)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.name])

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
          <Link href={`/learn/${params.name}`}>
            <Button className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              开始学习
            </Button>
          </Link>
        </div>

        {/* Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              学习进度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={pct} className="flex-1" />
              <span className="text-sm font-medium">{pct}%</span>
              <span className="text-xs text-muted-foreground">
                {passed}/{total} 节点
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge tree DAG */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">知识树</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] rounded-md border">
              <TreeFlow
                milestones={detail.milestones}
                progress={detail.progress}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
