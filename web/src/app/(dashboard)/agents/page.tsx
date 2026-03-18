"use client"

import { useEffect, useState } from "react"
import { Bot } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/layout/app-header"
import { gateway } from "@/lib/api"
import type { AgentInfo } from "@/lib/types/api"

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    gateway
      .agents()
      .then(setAgents)
      .catch((e) => setError(e.message ?? "无法加载 Agents"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <AppHeader title="Agents" />
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-base border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}
        {loading ? (
          <PageLoading />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div key={agent.name} className="rounded-2xl border bg-white dark:bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
                    <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-base text-foreground">{agent.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
                  </div>
                </div>
                <Badge variant="secondary">{agent.type}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
