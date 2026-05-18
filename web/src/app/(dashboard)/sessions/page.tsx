"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MessageSquare, ArrowRight } from "lucide-react"
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

  const grouped: Record<string, ChatSessionSummary[]> = {}
  for (const s of sessions) {
    const k = s.library_slug || "(无项目)"
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(s)
  }

  return (
    <div className="p-8 space-y-8 animate-[loading-fade-in_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          对话历史
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          你跟 AI 导师的所有对话
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : sessions.length === 0 ? (
        <div className="card-elevated p-14 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">还没有对话</p>
          <p className="text-xs text-muted-foreground mt-1">
            进入学习页跟 AI 导师聊聊吧
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([slug, list]) => (
            <section key={slug} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground">
                  {slug}
                </span>
                <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {list.length}
                </span>
              </div>
              <div className="card-elevated overflow-hidden">
                <div className="divide-y divide-border/60">
                  {list.map((s) => (
                    <Link
                      key={s.id}
                      href={`/sessions/${s.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/60 transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] group"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {s.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.module_id && (
                            <span className="font-[var(--font-manrope)] uppercase tracking-wider mr-2">
                              {s.module_id}
                            </span>
                          )}
                          {new Date(s.updated_at).toLocaleString("zh-CN")}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-[350ms]" />
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
