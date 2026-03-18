"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { History, MessageSquare } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        {loading ? (
          <PageLoading />
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <History className="h-12 w-12 mb-4" />
            <p>暂无会话</p>
            <p className="text-sm">开始聊天后会话会显示在这里</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <Link key={s.id} href={`/chat/${s.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4" />
                      {s.id.slice(0, 8)}...
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="secondary">{s.agent}</Badge>
                      {s.project && <Badge variant="outline">{s.project}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>{s.messages} 条消息</span>
                      <span className="mx-1">·</span>
                      <span>{new Date(s.created_at).toLocaleString("zh-CN")}</span>
                    </div>
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
