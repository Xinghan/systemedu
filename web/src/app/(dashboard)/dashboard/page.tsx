"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  Bot,
  FolderKanban,
  MessageSquare,
  Settings,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/layout/app-header"
import { useAppStore } from "@/lib/stores/app-store"
import { gateway } from "@/lib/api"
import type { ProjectSummary } from "@/lib/types/api"

export default function DashboardPage() {
  const { status, config, gatewayConnected } = useAppStore()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (gatewayConnected) {
      gateway.projects().then(setProjects).catch((e) => setError(e.message ?? "无法加载项目"))
    }
  }, [gatewayConnected])

  return (
    <>
      <AppHeader title="仪表盘" />
      <div className="p-8 space-y-8 animate-[loading-fade-in_0.35s_ease-out]">
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-base border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* Welcome */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">欢迎回来!</h1>
          <p className="text-base text-muted-foreground mt-2">这是你的 SystemEdu 控制面板概览</p>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="系统状态"
            value={gatewayConnected ? "运行中" : "离线"}
            valueColor={gatewayConnected ? "text-emerald-600" : "text-red-500"}
            sub={status ? `v${status.version} · ${status.uptime}` : "无法连接"}
            icon={<Activity className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          />
          <StatCard
            label="LLM 提供商"
            value={config?.llm.default ?? "--"}
            sub={`${status?.llm.providers.length ?? 0} 个已配置`}
            icon={<Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
            iconBg="bg-blue-50 dark:bg-blue-950/40"
          />
          <StatCard
            label="活跃会话"
            value={String(status?.sessions ?? 0)}
            sub={`端口 ${status?.port ?? 18820}`}
            icon={<MessageSquare className="h-6 w-6 text-amber-600 dark:text-amber-400" />}
            iconBg="bg-amber-50 dark:bg-amber-950/40"
          />
          <StatCard
            label="项目"
            value={String(projects.length)}
            sub="本地项目"
            icon={<FolderKanban className="h-6 w-6 text-violet-600 dark:text-violet-400" />}
            iconBg="bg-violet-50 dark:bg-violet-950/40"
          />
        </div>

        {/* Two columns */}
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Quick actions */}
          <div className="lg:col-span-3">
            <h2 className="text-lg font-bold text-foreground mb-5">快速操作</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <QuickAction
                href="/chat"
                icon={<MessageSquare className="h-6 w-6" />}
                iconBg="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                title="开始聊天"
                desc="与 AI 助手进行对话，获取学习帮助"
              />
              <QuickAction
                href="/projects"
                icon={<FolderKanban className="h-6 w-6" />}
                iconBg="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                title="浏览项目"
                desc="查看和管理学习项目"
              />
              <QuickAction
                href="/agents"
                icon={<Bot className="h-6 w-6" />}
                iconBg="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                title="管理 Agents"
                desc="查看 AI 代理状态"
              />
              <QuickAction
                href="/config"
                icon={<Settings className="h-6 w-6" />}
                iconBg="bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
                title="系统配置"
                desc="LLM 与服务设置"
              />
            </div>
          </div>

          {/* Recent projects */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-foreground mb-5">最近项目</h2>
            <div className="rounded-2xl border bg-white dark:bg-card shadow-sm overflow-hidden">
              {projects.length === 0 ? (
                <div className="px-6 py-16 text-center text-muted-foreground">
                  <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-base">暂无项目</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {projects.slice(0, 5).map((p) => (
                    <Link
                      key={p.name}
                      href={`/projects/${p.name}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/40">
                        <FolderKanban className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium text-foreground truncate">{p.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary">{p.category}</Badge>
                          <span className="text-sm text-muted-foreground">{p.estimated_hours}h</span>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground/30 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  valueColor,
  sub,
  icon,
  iconBg,
}: {
  label: string
  value: string
  valueColor?: string
  sub: string
  icon: React.ReactNode
  iconBg: string
}) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`mt-3 text-3xl font-bold ${valueColor ?? "text-foreground"}`}>{value}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>
        </div>
        <div className={`flex h-13 w-13 items-center justify-center rounded-2xl ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function QuickAction({
  href,
  icon,
  iconBg,
  title,
  desc,
}: {
  href: string
  icon: React.ReactNode
  iconBg: string
  title: string
  desc: string
}) {
  return (
    <Link href={href}>
      <div className="group rounded-2xl border bg-white dark:bg-card p-6 shadow-sm hover:shadow-md transition-all cursor-pointer">
        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} mb-4`}>
          {icon}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground mt-1">{desc}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground/30 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </div>
      </div>
    </Link>
  )
}
