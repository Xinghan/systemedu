"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, BookOpen, Lock, ShoppingCart } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth, library } from "@/lib/api"
import { getToken } from "@/lib/auth"

type Stage = { stage_id: string; title: string; stage_goal?: string }
type Module = {
  module_id: string
  title: string
  stage_id?: string
  summary?: string
  sequence_order?: number
  week?: number | null
  core_question?: string
}

export default function LibraryProjectDetail() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = decodeURIComponent(params.slug)

  const [project, setProject] = useState<{
    slug: string
    title: string
    title_zh?: string | null
    description?: string
    domain?: string | null
    age_band?: string | null
    duration_weeks?: number | null
    difficulty?: number | null
    stage_count?: number
    knode_count?: number
    knowledge_tree?: { stages?: Stage[]; modules?: Module[]; description?: string }
  } | null>(null)
  const [blueprint, setBlueprint] = useState<string>("")
  const [purchased, setPurchased] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)

  useEffect(() => {
    setLoggedIn(!!getToken())
    void (async () => {
      setLoading(true)
      try {
        const [p, bp] = await Promise.all([
          library.getProject(slug),
          library.getBlueprint(slug, "zh-CN").catch(() => ({ content: "" } as { content: string })),
        ])
        setProject(p)
        setBlueprint(bp.content || "")
        if (getToken()) {
          try {
            const ps = await library.listPurchases()
            setPurchased(ps.some((x) => x.project_slug === slug))
          } catch {
            // ignore
          }
        }
      } catch (err) {
        toast.error((err as Error).message || "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [slug])

  const stages = project?.knowledge_tree?.stages || []
  const modules = project?.knowledge_tree?.modules || []
  const modulesByStage = useMemo(() => {
    const grouped: Record<string, Module[]> = {}
    for (const m of modules) {
      const k = m.stage_id || "_"
      if (!grouped[k]) grouped[k] = []
      grouped[k].push(m)
    }
    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
    }
    return grouped
  }, [modules])

  async function handleBuy() {
    setBuying(true)
    try {
      const r = await library.buy(slug)
      if (r.already_owned) toast.info("你已经拥有这个项目")
      else toast.success("购买成功 (本期免费解锁)")
      setPurchased(true)
    } catch (err) {
      toast.error((err as Error).message || "购买失败")
    } finally {
      setBuying(false)
    }
  }

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-12 text-sm text-muted-foreground">
        加载中...
      </main>
    )
  }
  if (!project) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-muted-foreground text-sm mb-3">项目不存在.</p>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/library"><ArrowLeft className="size-4" />返回列表</Link>
        </Button>
      </main>
    )
  }

  const firstModuleId = modules[0]?.module_id

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/library"><ArrowLeft className="size-4" />返回列表</Link>
        </Button>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">{project.title_zh || project.title}</h1>
            <div className="text-sm text-muted-foreground mt-1 font-mono">{project.slug}</div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {project.domain && <Badge variant="outline">{project.domain}</Badge>}
              {project.age_band && <Badge variant="outline">{project.age_band} 岁</Badge>}
              {project.duration_weeks != null && (
                <Badge variant="outline">{project.duration_weeks} 周</Badge>
              )}
              {project.difficulty != null && (
                <Badge variant="outline">难度 {project.difficulty}/10</Badge>
              )}
              <Badge variant="outline">
                {project.stage_count}S · {project.knode_count}K
              </Badge>
            </div>
          </div>
          <div className="shrink-0">
            {!loggedIn ? (
              <Button asChild>
                <Link href="/login">
                  <Lock className="size-4" />
                  登录后购买
                </Link>
              </Button>
            ) : !purchased ? (
              <Button onClick={handleBuy} disabled={buying}>
                <ShoppingCart className="size-4" />
                {buying ? "处理中..." : "立即购买 (本期免费)"}
              </Button>
            ) : (
              <Button asChild disabled={!firstModuleId}>
                <Link href={firstModuleId ? `/library/${slug}/${firstModuleId}` : "#"}>
                  <BookOpen className="size-4" />
                  开始学习
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 蓝图 / 项目概述 */}
      {blueprint && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">项目介绍</CardTitle>
          </CardHeader>
          <CardContent>
            <article className="prose prose-stone max-w-none text-sm [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_table]:text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{blueprint}</ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      )}

      {/* 知识树 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">知识树</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {stages.length === 0 ? (
              <p className="text-muted-foreground text-sm">没有 stage 数据.</p>
            ) : (
              stages.map((s) => (
                <div key={s.stage_id}>
                  <div className="font-medium mb-2">
                    <span className="text-primary font-mono mr-2">{s.stage_id}</span>
                    {s.title}
                  </div>
                  {s.stage_goal && (
                    <p className="text-xs text-muted-foreground mb-3">{s.stage_goal}</p>
                  )}
                  <div className="space-y-2">
                    {(modulesByStage[s.stage_id] || []).map((m) => {
                      const locked = !purchased
                      return (
                        <div
                          key={m.module_id}
                          className={`border rounded-lg px-3 py-2.5 transition-colors ${
                            locked ? "border-border" : "border-border hover:border-primary/40 hover:bg-muted/30"
                          }`}
                        >
                          {locked ? (
                            <div className="flex items-start gap-3 text-sm cursor-not-allowed opacity-70">
                              <Lock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div>
                                  <span className="font-mono text-xs text-muted-foreground mr-2">{m.module_id}</span>
                                  <span>{m.title}</span>
                                </div>
                                {m.summary && (
                                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                    {m.summary}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <Link
                              href={`/library/${slug}/${m.module_id}`}
                              className="flex items-start gap-3 text-sm group"
                            >
                              <BookOpen className="size-4 text-primary shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div>
                                  <span className="font-mono text-xs text-muted-foreground mr-2">{m.module_id}</span>
                                  <span className="group-hover:text-primary">{m.title}</span>
                                </div>
                                {m.summary && (
                                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                    {m.summary}
                                  </div>
                                )}
                              </div>
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
