"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  FolderKanban,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Brain,
} from "lucide-react"
import { library, type LibraryProjectSummary, auth } from "@/lib/api"

interface PulledProject {
  project_slug: string
  created_at?: string
  last_module_id?: string | null
}

export default function DashboardPage() {
  const [all, setAll] = useState<LibraryProjectSummary[]>([])
  const [pulled, setPulled] = useState<PulledProject[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    setUsername(auth.getCachedUsername())
    void (async () => {
      try {
        const [projects, p] = await Promise.all([
          library.listProjects(),
          library.listPurchases().catch(() => [] as PulledProject[]),
        ])
        setAll(projects)
        setPulled(p)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const pulledSet = new Set(pulled.map((p) => p.project_slug))
  const lastModuleBySlug = new Map(pulled.map((p) => [p.project_slug, p.last_module_id]))
  const mine = all.filter((p) => pulledSet.has(p.slug))
  const recommended = all.filter((p) => !pulledSet.has(p.slug)).slice(0, 5)

  return (
    <div className="p-8 space-y-8 animate-[loading-fade-in_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">
      {/* Welcome hero */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {username ? `欢迎回来，${username}` : "欢迎"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            继续你的工业级 AI 项目学习
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-[var(--font-manrope)] font-semibold uppercase tracking-wider bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          在线
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="我的项目"
          value={String(mine.length)}
          sub={mine.length > 0 ? "学习中" : "尚未开始"}
          icon={<FolderKanban className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="项目库"
          value={String(all.length)}
          sub="工业级项目"
          icon={<Activity className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="推荐"
          value={String(recommended.length)}
          sub="新挑战待解锁"
          icon={<Sparkles className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="AI 导师"
          value="待命"
          sub="右下角聊"
          icon={<MessageSquare className="h-5 w-5 text-primary" />}
        />
      </div>

      {/* Two columns: My projects + Neural Efficiency */}
      <div className="grid gap-8 lg:grid-cols-5">
        {/* My projects — wider column */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-foreground">我的项目</h2>
            <Link
              href="/library"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              全部项目 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="card-elevated overflow-hidden">
            {loading ? (
              <div className="px-6 py-14 text-center text-muted-foreground text-sm">
                加载中...
              </div>
            ) : mine.length === 0 ? (
              <div className="px-6 py-14 text-center text-muted-foreground">
                <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">还没有学习中的项目</p>
                <Link
                  href="/library"
                  className="inline-block mt-3 text-xs font-medium text-primary hover:text-primary/80"
                >
                  浏览项目库 →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {mine.slice(0, 5).map((p) => {
                  const lastMod = lastModuleBySlug.get(p.slug)
                  const cont = lastMod
                    ? `/library/${p.slug}/${lastMod}`
                    : `/library/${p.slug}`
                  return (
                    <Link
                      key={p.slug}
                      href={cont}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/60 transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] group"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <FolderKanban className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {p.title_zh || p.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {p.domain && (
                            <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                              {p.domain}
                            </span>
                          )}
                          {lastMod ? (
                            <span className="text-xs text-muted-foreground">
                              继续 · {lastMod}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {p.knode_count} 个模块
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-[350ms]" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions + Neural Efficiency */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-5">
              快捷操作
            </h2>
            <div className="space-y-3">
              <QuickAction
                href="/library"
                icon={<FolderKanban className="h-5 w-5 text-primary" />}
                title="浏览项目库"
              />
              <QuickAction
                href="/sessions"
                icon={<MessageSquare className="h-5 w-5 text-primary" />}
                title="历史对话"
              />
              <QuickAction
                href="/memory"
                icon={<Sparkles className="h-5 w-5 text-primary" />}
                title="我的记忆"
              />
            </div>
          </div>

          {/* Neural Efficiency card — purple gradient */}
          <div className="rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 p-5 text-white shadow-[0_4px_32px_0_oklch(0.488_0.258_302_/_0.25)]">
            <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest opacity-70 mb-2 flex items-center gap-1.5">
              <Brain className="h-3 w-3" /> Neural Efficiency
            </p>
            <h3 className="text-base font-bold mb-1">
              {mine.length > 0
                ? `${mine.length} 个项目进行中`
                : "开始你的第一个项目"}
            </h3>
            <p className="text-xs opacity-75 mb-4">
              {mine.length > 0
                ? "AI 导师已经熟悉你的学习节奏"
                : "购买项目, 解锁 AI 导师个性化指导"}
            </p>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 opacity-80" />
              <span className="text-xs opacity-80">五层记忆已开启</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended row */}
      {recommended.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-foreground">推荐项目</h2>
            <Link
              href="/library"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              全部 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.slice(0, 3).map((p) => (
              <Link
                key={p.slug}
                href={`/library/${p.slug}`}
                className="card-elevated p-5 group hover:shadow-[0_8px_40px_0_oklch(0.488_0.258_302_/_0.12)] transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/30">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground line-clamp-2">
                      {p.title_zh || p.title}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {p.domain && (
                    <span className="text-[10px] font-[var(--font-manrope)] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                      {p.domain}
                    </span>
                  )}
                  {p.age_band && (
                    <span className="text-[10px] text-muted-foreground">
                      {p.age_band}
                    </span>
                  )}
                  {p.duration_weeks && (
                    <span className="text-[10px] text-muted-foreground">
                      · {p.duration_weeks}周
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label, value, sub, icon,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode
}) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-[var(--font-manrope)] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-extrabold tracking-tight text-foreground leading-none mb-1.5">
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function QuickAction({
  href, icon, title,
}: {
  href: string; icon: React.ReactNode; title: string
}) {
  return (
    <Link
      href={href}
      className="card-elevated p-4 flex items-center gap-3 hover:shadow-[0_4px_24px_0_oklch(0.488_0.258_302_/_0.10)] transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] group"
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground flex-1">{title}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-[350ms]" />
    </Link>
  )
}
