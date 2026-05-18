"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MessageSquare, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { chat, type ChatSessionSummary } from "@/lib/api"
import { toast } from "sonner"

export default function SessionsPage() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const list = await chat.listSessions()
        setSessions(list)
      } catch (e) {
        toast.error((e as Error).message || "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // 按 library_slug 分组
  const grouped: Record<string, ChatSessionSummary[]> = {}
  for (const s of sessions) {
    const k = s.library_slug || "(无项目)"
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(s)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">对话历史</h1>
        <p className="text-sm text-muted-foreground mt-1">
          你跟 AI 导师的所有对话
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">还没有对话</p>
            <p className="text-xs text-muted-foreground mt-1">
              进入学习页跟 AI 导师聊聊吧
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([slug, list]) => (
            <section key={slug} className="space-y-2">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground px-1">
                {slug}
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {list.length}
                </Badge>
              </h2>
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {list.map((s) => (
                    <Link
                      key={s.id}
                      href={`/sessions/${s.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.module_id && <span className="mr-2">{s.module_id}</span>}
                          {new Date(s.updated_at).toLocaleString("zh-CN")}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
