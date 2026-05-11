"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { library, type LibraryProjectSummary } from "@/lib/api"
import { getToken } from "@/lib/auth"

export default function LibraryListPage() {
  return (
    <Suspense fallback={<main className="max-w-6xl mx-auto px-6 py-12 text-sm text-muted-foreground">加载中...</main>}>
      <LibraryListInner />
    </Suspense>
  )
}

function LibraryListInner() {
  const params = useSearchParams()
  const viewMine = params.get("view") === "mine"
  const [projects, setProjects] = useState<LibraryProjectSummary[]>([])
  const [purchased, setPurchased] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const all = await library.listProjects()
        setProjects(all)
        if (getToken()) {
          try {
            const ps = await library.listPurchases()
            setPurchased(new Set(ps.map((p) => p.project_slug)))
          } catch {
            // 401 全局已处理, 这里忽略
          }
        }
      } catch (err) {
        toast.error((err as Error).message || "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const list = viewMine
    ? projects.filter((p) => purchased.has(p.slug))
    : projects

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          {viewMine ? "我的课程" : "项目库"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {viewMine
            ? "你已购买的项目, 可以进入学习."
            : "浏览所有项目, 购买后即可进入学习."}
        </p>
      </div>

      {loading && <div className="text-sm text-muted-foreground py-12 text-center">加载中...</div>}

      {!loading && list.length === 0 && (
        <Card className="py-16 items-center">
          <p className="text-muted-foreground text-sm">
            {viewMine ? "你还没有购买任何项目." : "暂无项目, 等管理员上架."}
          </p>
        </Card>
      )}

      {!loading && list.length > 0 && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Link key={p.slug} href={`/library/${p.slug}`} className="block">
              <Card className="h-full hover:ring-primary/30 hover:ring-2 transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">
                      {p.title_zh || p.title}
                    </CardTitle>
                    {purchased.has(p.slug) && (
                      <Badge variant="secondary" className="shrink-0">
                        <Sparkles className="size-3" />
                        已购
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {p.slug}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {p.description && (
                    <p className="text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {p.domain && <Badge variant="outline">{p.domain}</Badge>}
                    {p.age_band && <Badge variant="outline">{p.age_band} 岁</Badge>}
                    {p.duration_weeks != null && (
                      <Badge variant="outline">{p.duration_weeks} 周</Badge>
                    )}
                    {p.difficulty != null && (
                      <Badge variant="outline">难度 {p.difficulty}/10</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground pt-1">
                    {p.stage_count}S · {p.knode_count}K
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
