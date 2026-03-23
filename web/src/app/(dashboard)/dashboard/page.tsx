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
  TrendingUp,
} from "lucide-react"
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
      <AppHeader />
      <div className="p-8 space-y-8 animate-[loading-fade-in_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">
        {error && (
          <div className="p-4 rounded-xl bg-destructive/8 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Welcome section */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back!
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {gatewayConnected
                ? "Your AI ecosystem is optimized and ready for deep learning."
                : "Connect to your local gateway to get started."}
            </p>
          </div>
          {/* System online badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-[var(--font-manrope)] font-semibold uppercase tracking-wider ${
            gatewayConnected
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${gatewayConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            {gatewayConnected ? "System Online" : "Offline"}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="System Status"
            value={gatewayConnected ? "Running" : "Offline"}
            badge={gatewayConnected ? "Healthy" : undefined}
            badgeColor="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
            sub={status ? `v${status.version}` : "Unable to connect"}
            icon={<Activity className="h-5 w-5 text-primary" />}
            iconBg="bg-primary/10"
          />
          <StatCard
            label="LLM Provider"
            value={config?.llm.default ?? "--"}
            badge="Default"
            badgeColor="bg-secondary text-secondary-foreground"
            sub={`${status?.llm.providers.length ?? 0} configured`}
            icon={<Bot className="h-5 w-5 text-primary" />}
            iconBg="bg-primary/10"
          />
          <StatCard
            label="Active Sessions"
            value={String(status?.sessions ?? 0)}
            sub={`Port ${status?.port ?? 18820}`}
            icon={<MessageSquare className="h-5 w-5 text-primary" />}
            iconBg="bg-primary/10"
          />
          <StatCard
            label="Total Projects"
            value={String(projects.length)}
            sub="Local projects"
            icon={<FolderKanban className="h-5 w-5 text-primary" />}
            iconBg="bg-primary/10"
          />
        </div>

        {/* Two columns: Recent Projects + Quick Actions */}
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Recent Projects — wider column */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">Recent Projects</h2>
              <Link href="/projects" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="card-elevated overflow-hidden">
              {projects.length === 0 ? (
                <div className="px-6 py-14 text-center text-muted-foreground">
                  <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No projects yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {projects.slice(0, 5).map((p) => (
                    <Link
                      key={p.name}
                      href={`/projects/${p.name}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/60 transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] group"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <FolderKanban className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{p.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {p.category}
                          </span>
                          <span className="text-xs text-muted-foreground">{p.estimated_hours}h</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-[350ms]" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions + Insight card */}
          <div className="lg:col-span-2 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-5">Quick Actions</h2>
              <div className="space-y-3">
                <QuickAction href="/chat" icon={<MessageSquare className="h-5 w-5 text-primary" />} title="Start Chat" />
                <QuickAction href="/projects" icon={<FolderKanban className="h-5 w-5 text-primary" />} title="Browse Projects" />
                <QuickAction href="/agents" icon={<Bot className="h-5 w-5 text-primary" />} title="Manage Agents" />
                <QuickAction href="/config" icon={<Settings className="h-5 w-5 text-primary" />} title="System Settings" />
              </div>
            </div>

            {/* Neural Efficiency card — teal/purple gradient */}
            <div className="rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 p-5 text-white shadow-[0_4px_32px_0_oklch(0.488_0.258_302_/_0.25)]">
              <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest opacity-70 mb-2">
                Neural Efficiency
              </p>
              <h3 className="text-base font-bold mb-1">
                {projects.length > 0
                  ? `${projects.length} project${projects.length > 1 ? "s" : ""} active`
                  : "Start your first project"}
              </h3>
              <p className="text-xs opacity-75 mb-4">
                {gatewayConnected
                  ? "Your AI ecosystem is running at full capacity."
                  : "Connect your gateway to unlock AI-powered learning."}
              </p>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 opacity-80" />
                <span className="text-xs opacity-80">Gateway {gatewayConnected ? "Connected" : "Offline"}</span>
              </div>
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
  badge,
  badgeColor,
  sub,
  icon,
  iconBg,
}: {
  label: string
  value: string
  badge?: string
  badgeColor?: string
  sub: string
  icon: React.ReactNode
  iconBg: string
}) {
  return (
    <div className="card-elevated p-6 transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] hover:shadow-card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        {badge && (
          <span className={`text-[10px] font-[var(--font-manrope)] uppercase tracking-wider px-2 py-1 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-[11px] font-[var(--font-manrope)] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  )
}

function QuickAction({
  href,
  icon,
  title,
}: {
  href: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <Link href={href}>
      <div className="card-elevated flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:shadow-card-hover transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] group">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <span className="text-sm font-medium text-foreground flex-1">{title}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground/30 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-[350ms]" />
      </div>
    </Link>
  )
}
