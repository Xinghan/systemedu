"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FolderKanban, Clock, Users, Plus } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      <div className="p-6">
        <div className="flex justify-end mb-4">
          <Link href="/projects/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              新建项目
            </Button>
          </Link>
        </div>
        {loading ? (
          <PageLoading />
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FolderKanban className="h-12 w-12 mb-4" />
            <p className="text-lg">暂无项目</p>
            <p className="text-sm">在 ./projects/ 目录下创建项目</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.name} href={`/projects/${p.name}`}>
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{p.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {p.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[p.category] ?? p.category}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {p.estimated_hours}h
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {p.age_range[0]}-{p.age_range[1]}岁
                      </Badge>
                    </div>
                    {p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
