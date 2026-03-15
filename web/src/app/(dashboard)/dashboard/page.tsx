"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Activity,
  Bot,
  FolderKanban,
  GraduationCap,
  MessageSquare,
  Plug,
  Sparkles,
  Timer,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/layout/app-header"
import { useAppStore } from "@/lib/stores/app-store"
import { gateway } from "@/lib/api"
import type { ProjectSummary } from "@/lib/types/api"

export default function DashboardPage() {
  const { status, config, gatewayConnected } = useAppStore()
  const [projects, setProjects] = useState<ProjectSummary[]>([])

  useEffect(() => {
    if (gatewayConnected) {
      gateway.projects().then(setProjects).catch(() => {})
    }
  }, [gatewayConnected])

  return (
    <>
      <AppHeader title="仪表盘" />
      <div className="p-6 space-y-6">
        {/* Status cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">系统状态</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {gatewayConnected ? (
                  <span className="text-green-500">运行中</span>
                ) : (
                  <span className="text-red-500">离线</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {status ? `版本 ${status.version} · 运行 ${status.uptime}` : "无法连接 Gateway"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">LLM 提供商</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {config?.llm.default ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                {status?.llm.providers.length ?? 0} 个提供商已配置
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">活跃会话</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status?.sessions ?? 0}</div>
              <p className="text-xs text-muted-foreground">端口 {status?.port ?? 18820}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">项目</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.length}</div>
              <p className="text-xs text-muted-foreground">本地项目</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick launch */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:border-primary/50 transition-colors">
            <Link href="/chat" className="block">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  开始聊天
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  与 AI 助手进行对话，获取帮助和指导
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:border-primary/50 transition-colors">
            <Link href="/projects" className="block">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5" />
                  浏览项目
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  查看和管理学习项目，开始新的学习旅程
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:border-primary/50 transition-colors">
            <Link href="/config" className="block">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  系统配置
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  管理 LLM、MCP 服务器、Agent 等系统设置
                </p>
              </CardContent>
            </Link>
          </Card>
        </div>

        {/* Recent projects */}
        {projects.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">最近的项目</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 6).map((p) => (
                <Card key={p.name} className="hover:border-primary/50 transition-colors">
                  <Link href={`/projects/${p.name}`} className="block">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{p.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {p.description}
                      </p>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{p.category}</Badge>
                        <Badge variant="outline">{p.estimated_hours}h</Badge>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
