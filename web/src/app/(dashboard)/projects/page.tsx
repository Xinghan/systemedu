"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FolderKanban, Clock, Users, Plus } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/layout/app-header"
import { gateway } from "@/lib/api"
import type { ProjectSummary } from "@/lib/types/api"

const CATEGORY_LABELS: Record<string, string> = {
  ai: "人工智能",
  biotech: "生物技术",
  aerospace: "航天航空",
  music: "音乐",
  climate: "气候",
  robotics: "机器人",
  chemistry: "化学",
  math: "数学",
  cs: "计算机",
  other: "其他",
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    gateway
      .projects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <AppHeader title="项目" />
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-base text-muted-foreground">管理你的学习项目</p>
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              新建项目
            </Button>
          </Link>
        </div>
        {loading ? (
          <PageLoading />
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
              <FolderKanban className="h-10 w-10 opacity-40" />
            </div>
            <p className="text-lg font-medium">暂无项目</p>
            <p className="text-base mt-1">在 ./projects/ 目录下创建项目</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.name} href={`/projects/${p.name}`}>
                <div className="group rounded-2xl border bg-white dark:bg-card p-6 shadow-sm hover:shadow-md transition-all cursor-pointer h-full">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/40">
                      <FolderKanban className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-base text-foreground truncate">{p.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary">
                      {CATEGORY_LABELS[p.category] ?? p.category}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {p.estimated_hours}h
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {p.age_range[0]}-{p.age_range[1]}岁
                    </Badge>
                  </div>
                  {p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-lg bg-muted text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
