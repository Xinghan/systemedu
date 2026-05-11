"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { library, type LibraryKnodeContent } from "@/lib/api"
import { ApiError } from "@/lib/api/client"
import { getToken } from "@/lib/auth"

type Idea = {
  idea_id?: string
  mode?: string
  topic?: string
  animation_path?: string
  game_path?: string
  [k: string]: unknown
}

type Module = { module_id: string; title?: string; sequence_order?: number; stage_id?: string }

export default function LearnPage() {
  const router = useRouter()
  const params = useParams<{ slug: string; knode_id: string }>()
  const slug = decodeURIComponent(params.slug)
  const knodeId = decodeURIComponent(params.knode_id)

  const [knode, setKnode] = useState<LibraryKnodeContent | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [authedUrls, setAuthedUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login")
      return
    }
    void (async () => {
      setLoading(true)
      try {
        const [k, tree] = await Promise.all([
          library.getKnode(slug, knodeId),
          library.getTree(slug).catch(() => ({}) as Record<string, unknown>),
        ])
        setKnode(k)
        const treeModules = (tree.modules as Module[] | undefined) || []
        treeModules.sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
        setModules(treeModules)
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 403) {
            toast.error("需要购买该项目才能学习")
            router.replace(`/library/${slug}`)
            return
          }
        }
        toast.error((err as Error).message || "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [slug, knodeId, router])

  // 媒体文件需要带 Authorization, iframe/img src 不能加 header,
  // 所以 fetch 下来转 blob URL
  useEffect(() => {
    if (!knode) return
    const token = getToken()
    if (!token) return
    const ideas = (knode.rendered_sections?.ideas || []) as Idea[]
    const pathsToFetch: string[] = []
    for (const idea of ideas) {
      if (typeof idea.animation_path === "string") pathsToFetch.push(idea.animation_path)
      if (typeof idea.game_path === "string") pathsToFetch.push(idea.game_path)
    }
    if (knode.knode_dir) {
      // paths in idea.animation_path 是相对 knode_dir 的, 拼起来
    }
    const created: string[] = []
    let alive = true

    void (async () => {
      const next: Record<string, string> = {}
      for (const relPath of pathsToFetch) {
        const fullPath = knode.knode_dir ? `${knode.knode_dir}/${relPath}` : relPath
        const url = library.fileUrl(slug, fullPath)
        try {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
          if (!res.ok) continue
          const blob = await res.blob()
          const blobUrl = URL.createObjectURL(blob)
          created.push(blobUrl)
          next[relPath] = blobUrl
        } catch {
          // ignore
        }
      }
      if (alive) setAuthedUrls(next)
    })()

    return () => {
      alive = false
      for (const u of created) URL.revokeObjectURL(u)
    }
  }, [knode, slug])

  const prevNext = useMemo(() => {
    if (modules.length === 0) return { prev: null as Module | null, next: null as Module | null }
    const idx = modules.findIndex((m) => m.module_id === knodeId)
    if (idx < 0) return { prev: null, next: null }
    return {
      prev: idx > 0 ? modules[idx - 1] : null,
      next: idx < modules.length - 1 ? modules[idx + 1] : null,
    }
  }, [modules, knodeId])

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12 text-sm text-muted-foreground">加载中...</main>
    )
  }
  if (!knode) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-muted-foreground text-sm mb-3">无法加载课程内容.</p>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/library/${slug}`}><ArrowLeft className="size-4" />返回项目</Link>
        </Button>
      </main>
    )
  }

  const ideas = (knode.rendered_sections?.ideas || []) as Idea[]

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={`/library/${slug}`}><ArrowLeft className="size-4" />返回项目</Link>
        </Button>
        <h1 className="text-2xl font-semibold">{knode.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
          <Badge variant="outline">{knode.knode_id}</Badge>
          {knode.week != null && <Badge variant="outline">第 {knode.week} 周</Badge>}
          {knode.stage && <Badge variant="outline">{knode.stage}</Badge>}
          {knode.duration_minutes != null && <Badge variant="outline">{knode.duration_minutes} 分钟</Badge>}
        </div>
      </div>

      {knode.plan_markdown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">学习计划</CardTitle>
          </CardHeader>
          <CardContent>
            <article className="prose prose-stone max-w-none text-sm [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{knode.plan_markdown}</ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      )}

      {ideas.length > 0 && (
        <div className="space-y-4">
          {ideas.map((idea, i) => {
            const animKey = idea.animation_path as string | undefined
            const gameKey = idea.game_path as string | undefined
            const blobUrl = (animKey && authedUrls[animKey]) || (gameKey && authedUrls[gameKey])
            const mode = (idea.mode as string) || ""
            const isInteractive = mode === "animation" || mode === "game"
            return (
              <Card key={idea.idea_id || i}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {mode && <Badge variant="secondary">{mode}</Badge>}
                    <span>{(idea.topic as string) || `富媒体 ${i + 1}`}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isInteractive ? (
                    blobUrl ? (
                      <iframe
                        src={blobUrl}
                        className="w-full bg-white rounded-lg border"
                        style={{ height: "70vh" }}
                        sandbox="allow-scripts allow-same-origin"
                        title={(idea.topic as string) || mode}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground py-12 text-center">
                        {animKey || gameKey ? "加载中..." : "暂无可播放内容"}
                      </div>
                    )
                  ) : (
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                      {JSON.stringify(idea, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {knode.assignment_md && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">本周作业</CardTitle>
          </CardHeader>
          <CardContent>
            <article className="prose prose-stone max-w-none text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{knode.assignment_md}</ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center pt-4">
        {prevNext.prev ? (
          <Button variant="outline" asChild>
            <Link href={`/library/${slug}/${prevNext.prev.module_id}`}>
              <ArrowLeft className="size-4" />
              上一节: {prevNext.prev.title}
            </Link>
          </Button>
        ) : <div />}
        {prevNext.next ? (
          <Button asChild>
            <Link href={`/library/${slug}/${prevNext.next.module_id}`}>
              下一节: {prevNext.next.title}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : <div />}
      </div>
    </main>
  )
}
