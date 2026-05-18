"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, BookOpen, Sparkles, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { library, type LibraryProjectSummary } from "@/lib/api"
import { auth } from "@/lib/api"

export default function DashboardPage() {
  const [all, setAll] = useState<LibraryProjectSummary[]>([])
  const [purchased, setPurchased] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    setUsername(auth.getCachedUsername())
    void (async () => {
      try {
        const [projects, ps] = await Promise.all([
          library.listProjects(),
          library.listPurchases().catch(() => []),
        ])
        setAll(projects)
        setPurchased(new Set(ps.map((p) => p.project_slug)))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const mine = all.filter((p) => purchased.has(p.slug))
  const recommended = all.filter((p) => !purchased.has(p.slug)).slice(0, 3)

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {username ? `欢迎回来，${username}` : "首页"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          继续学习或探索新项目
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5 text-violet-600" />}
          label="我的项目"
          value={String(mine.length)}
          hint={mine.length > 0 ? "继续学习" : "去购买"}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          label="项目库"
          value={String(all.length)}
          hint="个工业级项目"
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5 text-amber-600" />}
          label="推荐"
          value={String(recommended.length)}
          hint="待你解锁"
        />
      </div>

      {/* My projects */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">我的项目</h2>
          <Link
            href="/library?view=mine"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            全部 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : mine.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">还没有学习中的项目</p>
              <Button asChild className="mt-4">
                <Link href="/library">浏览项目库</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mine.map((p) => (
              <ProjectCard key={p.slug} p={p} variant="owned" />
            ))}
          </div>
        )}
      </section>

      {/* Recommended */}
      {recommended.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">推荐</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommended.map((p) => (
              <ProjectCard key={p.slug} p={p} variant="discover" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({
  icon, label, value, hint,
}: {
  icon: React.ReactNode; label: string; value: string; hint?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
            {icon}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold leading-tight">{value}</p>
          </div>
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function ProjectCard({
  p, variant,
}: {
  p: LibraryProjectSummary; variant: "owned" | "discover"
}) {
  const title = p.title_zh || p.title
  const href = variant === "owned" ? `/library/${p.slug}` : `/library/${p.slug}`
  return (
    <Link href={href} className="block group">
      <Card className="h-full transition-all group-hover:border-primary/40 group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {variant === "owned" && (
              <Badge variant="secondary" className="shrink-0">学习中</Badge>
            )}
          </div>
          {p.description && (
            <CardDescription className="line-clamp-2 mt-1">
              {p.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {p.domain && <Badge variant="outline" className="text-xs">{p.domain}</Badge>}
            {p.age_band && <Badge variant="outline" className="text-xs">{p.age_band}</Badge>}
            {p.duration_weeks && (
              <Badge variant="outline" className="text-xs">{p.duration_weeks}周</Badge>
            )}
            {p.knode_count && (
              <Badge variant="outline" className="text-xs">{p.knode_count}个模块</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
