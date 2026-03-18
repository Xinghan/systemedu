"use client"

import { useEffect, useState } from "react"
import { Bot } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        {loading ? (
          <PageLoading />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card key={agent.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bot className="h-5 w-5" />
                    {agent.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    {agent.description}
                  </p>
                  <Badge variant="secondary">{agent.type}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
