"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BookOpen } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { gateway } from "@/lib/api"
import type { LessonQueueItem } from "@/lib/types/api"

export default function BatchLessonsPage() {
  const params = useParams<{ name: string }>()
  const [items, setItems] = useState<LessonQueueItem[]>([])
  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load initial queue state
  useEffect(() => {
    if (!params.name) return
    gateway
      .getLessonQueue(params.name)
      .then((r) => {
        setItems(r.items)
        setRunning(r.running)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [params.name])

  // Poll while running
  useEffect(() => {
    if (!running || !params.name) return
    const interval = setInterval(async () => {
      try {
        const r = await gateway.getLessonQueue(params.name)
        setItems(r.items)
        setRunning(r.running)
        if (!r.running) clearInterval(interval)
      } catch {
        // non-fatal
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [running, params.name])

  const handleStart = async () => {
    if (!params.name) return
    setStarting(true)
    try {
      await gateway.batchGenerateLessons(params.name)
      setRunning(true)
      const r = await gateway.getLessonQueue(params.name)
      setItems(r.items)
    } catch (e: unknown) {
      toast.error(`启动失败: ${e instanceof Error ? e.message : "未知错误"}`)
    } finally {
      setStarting(false)
    }
  }

  const doneCount = items.filter((i) => i.status === "done").length
  const totalCount = items.length
  const hasPending = items.some((i) => i.status === "pending" || i.status === "generating")

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href={`/projects/${params.name}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">预生成课程</h1>
              <p className="text-xs text-muted-foreground">按知识树顺序批量生成课程内容</p>
            </div>
          </div>
        </div>

        {/* Action area */}
        <div className="rounded-xl border bg-card p-5 mb-6">
          <p className="text-sm text-muted-foreground mb-4">
            将按知识树顺序，为最多 10 个尚未生成课程的节点自动生成内容。每节点约需 2-3 分钟，全程后台运行。
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleStart}
              disabled={starting || running}
              className="gap-2"
            >
              {running ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  生成中...
                </>
              ) : starting ? (
                "启动中..."
              ) : (
                "开始生成"
              )}
            </Button>
            {running && (
              <span className="text-sm text-muted-foreground">
                {doneCount}/{totalCount} 已完成
              </span>
            )}
            {!running && !hasPending && totalCount > 0 && (
              <span className="text-sm text-muted-foreground">
                本批次已完成，可再次触发生成下一批
              </span>
            )}
          </div>
        </div>

        {/* Queue list */}
        {loaded && (
          <div>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              {totalCount > 0 ? `当前批次 · ${totalCount} 个节点` : "暂无生成记录"}
            </h2>
            {totalCount > 0 && (
              <div className="rounded-xl border bg-card divide-y">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.knode_title || `节点 ${item.knode_id}`}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {item.status === "pending" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          等待中
                        </span>
                      )}
                      {item.status === "generating" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                          生成中
                        </span>
                      )}
                      {item.status === "done" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                          已完成
                        </span>
                      )}
                      {item.status === "failed" && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 cursor-help"
                          title={item.error || "未知错误"}
                        >
                          失败
                        </span>
                      )}
                      {item.status === "skipped" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          已跳过
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
