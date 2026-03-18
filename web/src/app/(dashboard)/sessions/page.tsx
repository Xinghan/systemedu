"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { History, MessageSquare } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/layout/app-header"
import { gateway } from "@/lib/api"
import type { SessionSummary } from "@/lib/types/api"

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    gateway
      .sessions()
      .then(setSessions)
      .catch((e) => setError(e.message ?? "无法加载会话"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <AppHeader title="会话历史" />
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-base border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}
        {loading ? (
          <PageLoading />
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
              <History className="h-10 w-10 opacity-40" />
            </div>
            <p className="text-lg font-medium">暂无会话</p>
            <p className="text-base mt-1">开始聊天后会话会显示在这里</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <Link key={s.id} href={`/chat/${s.id}`}>
                <div className="rounded-2xl border bg-white dark:bg-card p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                      <MessageSquare className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-base text-foreground font-mono">{s.id.slice(0, 8)}...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(s.created_at).toLocaleString("zh-CN")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{s.agent}</Badge>
                    {s.project && <Badge variant="outline">{s.project}</Badge>}
                    <span className="text-sm text-muted-foreground ml-auto">{s.messages} 条消息</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
