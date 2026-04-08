"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Award, ChevronRight, Rocket, Trophy, Sparkles, Zap } from "lucide-react"
import { AppHeader } from "@/components/layout/app-header"
import { useAppStore } from "@/lib/stores/app-store"
import { gateway } from "@/lib/api"
import type { CareerPathDetail, CareerPathSummary } from "@/lib/api"
import { useT } from "@/lib/hooks/use-t"
import type { TranslationKey } from "@/lib/i18n"
import { AchievementTree } from "@/components/career-path/achievement-tree"
import { BadgeWall } from "@/components/career-path/badge-wall"

type TFunc = (key: TranslationKey, vars?: Record<string, string | number>) => string

export default function CareerPathsPage() {
  const { gatewayConnected } = useAppStore()
  const [paths, setPaths] = useState<CareerPathSummary[]>([])
  const [selectedPath, setSelectedPath] = useState<CareerPathDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const t = useT()

  useEffect(() => {
    if (!gatewayConnected) return
    setLoading(true)
    gateway.careerPaths()
      .then((data) => {
        setPaths(data)
        if (data.length > 0) {
          return gateway.careerPathDetail(data[0].name)
        }
        return null
      })
      .then((detail) => {
        if (detail) setSelectedPath(detail)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [gatewayConnected])

  return (
    <>
      <AppHeader />
      <div className="min-h-screen animate-[loading-fade-in_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : paths.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <div className="max-w-7xl mx-auto px-6 md:px-10 pt-8 pb-20">
            {/* Path selector if multiple paths */}
            {paths.length > 1 && (
              <div className="flex gap-3 mb-8 flex-wrap">
                {paths.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      gateway.careerPathDetail(p.name).then(setSelectedPath)
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      selectedPath?.path.name === p.name
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            )}

            {selectedPath && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Achievement Tree (8 cols) */}
                <div className="lg:col-span-8">
                  <AchievementTree detail={selectedPath} t={t} />
                </div>

                {/* Right: Side panels (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                  {/* XP Progress Panel */}
                  <XPProgressPanel detail={selectedPath} t={t} />

                  {/* Milestone Progress Panel */}
                  <MilestonePanel detail={selectedPath} t={t} />

                  {/* Last Achievement Card */}
                  <LastAchievementCard detail={selectedPath} t={t} />
                </div>

                {/* Badge Wall -- full width below */}
                <div className="lg:col-span-12">
                  <BadgeWall detail={selectedPath} t={t} />
                </div>

                {/* CTA */}
                {selectedPath.progress.status !== "completed" && (
                  <div className="lg:col-span-12 mt-4">
                    <div className="p-10 rounded-2xl bg-card/60 backdrop-blur-sm border border-primary/10 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/5 blur-3xl rounded-full" />
                      <div className="relative z-10">
                        <h3 className="text-2xl font-bold mb-4">{t("career.cta_title")}</h3>
                        <p className="text-muted-foreground mb-6 max-w-xl mx-auto">{t("career.cta_desc")}</p>
                        <Link
                          href="/projects"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                        >
                          {t("career.cta_button")}
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/* ---- XP Progress Panel ---- */

function XPProgressPanel({ detail, t }: { detail: CareerPathDetail; t: TFunc }) {
  const { total_xp, next_avatar_xp, current_avatar_stage } = detail.progress
  const currentAvatar = detail.current_avatar
  const nextAvatar = detail.avatar_stages.find((a) => a.stage === current_avatar_stage + 1)

  // XP progress percentage toward next evolution
  const prevThreshold = detail.avatar_stages
    .filter((a) => a.stage <= current_avatar_stage)
    .reduce((max, a) => Math.max(max, a.xp_threshold ?? 0), 0)
  const xpInRange = total_xp - prevThreshold
  const rangeSize = next_avatar_xp ? next_avatar_xp - prevThreshold : 1
  const xpPercent = next_avatar_xp ? Math.min(100, Math.round((xpInRange / rangeSize) * 100)) : 100

  return (
    <div className="p-6 rounded-xl bg-card/60 backdrop-blur-sm border border-border/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          {t("career.xp_progress")}
        </h3>
        <span className="text-lg font-black text-primary">
          {total_xp.toLocaleString()} <span className="text-xs font-semibold text-muted-foreground">{t("career.xp")}</span>
        </span>
      </div>

      {/* Current avatar */}
      {currentAvatar && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/30">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{currentAvatar.title}</p>
            <p className="text-xs text-muted-foreground">{currentAvatar.description}</p>
          </div>
        </div>
      )}

      {/* XP bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{next_avatar_xp ? t("career.next_evolution") : t("career.max_level")}</span>
          {next_avatar_xp && (
            <span>{total_xp} / {next_avatar_xp}</span>
          )}
        </div>
        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-primary via-primary/80 to-primary/50"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
        {nextAvatar && (
          <p className="text-xs text-muted-foreground text-right">
            {nextAvatar.title}
          </p>
        )}
      </div>

      {/* Evolution roadmap */}
      <div className="mt-5 pt-4 border-t border-border/20 space-y-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-3">
          {t("career.evolution_roadmap")}
        </p>
        {detail.avatar_stages.map((av) => {
          const reached = total_xp >= av.xp_threshold
          const isCurrent = av.stage === current_avatar_stage
          return (
            <div key={av.stage} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                reached ? "bg-primary" : "bg-muted-foreground/30"
              } ${isCurrent ? "ring-2 ring-primary/30" : ""}`} />
              <span className={`text-xs flex-1 truncate ${
                isCurrent ? "font-bold text-foreground" : reached ? "text-foreground" : "text-muted-foreground"
              }`}>
                {av.title}
              </span>
              <span className={`text-[10px] tabular-nums ${
                reached ? "text-primary font-semibold" : "text-muted-foreground"
              }`}>
                {av.xp_threshold.toLocaleString()} {t("career.xp")}
              </span>
            </div>
          )
        })}
      </div>

      {/* XP earning rules */}
      <div className="mt-4 pt-3 border-t border-border/20">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-2">
          {t("career.xp_rules_title")}
        </p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{t("career.xp_rule_knode")}</p>
          <p>{t("career.xp_rule_milestone")}</p>
        </div>
      </div>
    </div>
  )
}

/* ---- Milestone Progress Panel ---- */

function MilestonePanel({ detail, t }: { detail: CareerPathDetail; t: TFunc }) {
  const stages = detail.stages

  return (
    <div className="p-6 rounded-xl bg-card/60 backdrop-blur-sm border border-border/30">
      <h3 className="text-sm font-bold text-foreground mb-4">
        {t("career.milestone_progress")}
      </h3>
      <div className="space-y-5">
        {stages.map((stage) => {
          const percent = stage.completed ? 100 : 0
          return (
            <div key={stage.order}>
              <div className="flex justify-between items-end mb-1.5">
                <p className="text-xs font-bold text-foreground truncate max-w-[60%]">
                  {stage.badge?.name ?? stage.project_name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {percent}% {t("career.completed")}
                </p>
              </div>
              <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stage.completed ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---- Last Achievement Card ---- */

function LastAchievementCard({ detail, t }: { detail: CareerPathDetail; t: TFunc }) {
  if (detail.earned_badges.length === 0) return null

  // Most recent badge
  const latest = [...detail.earned_badges].sort((a, b) => {
    if (!a.earned_at || !b.earned_at) return 0
    return new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime()
  })[0]

  const stage = detail.stages.find((s) => s.order === latest.stage_order)

  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -right-6 -bottom-6 opacity-15">
        <Award className="w-24 h-24" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2 opacity-80">
        {t("career.last_achievement")}
      </p>
      <h3 className="text-xl font-bold mb-2">{latest.badge_name}</h3>
      {stage?.badge && (
        <p className="text-sm opacity-80 leading-relaxed mb-4">
          {stage.badge.description}
        </p>
      )}
      {latest.earned_at && (
        <p className="text-xs opacity-60">
          {t("career.earned_at", { date: new Date(latest.earned_at).toLocaleDateString() })}
        </p>
      )}
    </div>
  )
}

/* ---- Empty State ---- */

function EmptyState({ t }: { t: TFunc }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Trophy className="w-10 h-10 text-primary/60" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">{t("career.no_paths")}</h2>
      <p className="text-muted-foreground max-w-md mb-8">{t("career.no_paths_desc")}</p>
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:scale-105 transition-all"
      >
        {t("career.cta_button")}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
