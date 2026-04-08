"use client"

import Link from "next/link"
import { CheckCircle2, Circle, Lock, ChevronRight, Award } from "lucide-react"
import type { CareerPathDetail } from "@/lib/api"
import type { TranslationKey } from "@/lib/i18n"

type TFunc = (key: TranslationKey, vars?: Record<string, string | number>) => string

interface Props {
  detail: CareerPathDetail
  t: TFunc
}

const PHASE_ICONS = ["bolt", "science", "psychology", "auto_awesome", "rocket_launch", "military_tech"]

export function CareerTimeline({ detail, t }: Props) {
  const stages = detail.stages

  return (
    <div className="relative">
      {/* Center line (desktop) */}
      <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent -translate-x-1/2 z-0" />

      {stages.map((stage, idx) => {
        const isLeft = idx % 2 === 0
        const isCompleted = stage.completed
        const isLast = idx === stages.length - 1
        const badgeEarned = detail.earned_badges.some(
          (b) => b.stage_order === stage.order
        )

        return (
          <section
            key={stage.order}
            className={`relative z-10 mb-16 md:mb-24 flex flex-col md:flex-row items-center gap-6 md:gap-10 group ${
              isLeft ? "" : "md:flex-row-reverse"
            }`}
          >
            {/* Card */}
            <div className="w-full md:w-[calc(50%-2rem)]">
              <div className="p-6 md:p-8 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
                {/* Phase label */}
                <span className="text-xs font-bold uppercase tracking-[0.15em] mb-2 block text-primary/70">
                  {isLast ? t("career.peak") : t("career.phase", { n: idx + 1 })}
                </span>

                {/* Project name */}
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">
                  {stage.project_name}
                </h2>

                {/* Badge info */}
                {stage.badge && (
                  <div className="flex items-center gap-2 mb-4">
                    <Award className={`w-4 h-4 ${badgeEarned ? "text-amber-500" : "text-muted-foreground/40"}`} />
                    <span className={`text-sm ${badgeEarned ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {stage.badge.name}
                    </span>
                    {badgeEarned && (
                      <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                        {t("career.completed")}
                      </span>
                    )}
                  </div>
                )}

                {/* Status + action */}
                <div className="flex items-center justify-between mt-4">
                  <StatusBadge completed={isCompleted} t={t} />
                  <Link
                    href={`/projects/${stage.project_name}`}
                    className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    {isCompleted ? t("career.view_project") : t("career.start_project")}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Center node */}
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full items-center justify-center z-20 shadow-lg transition-all duration-300">
              {isCompleted ? (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-primary/30 shadow-lg">
                  <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                  <Circle className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Spacer for the other side */}
            <div className="hidden md:block w-[calc(50%-2rem)]" />
          </section>
        )
      })}
    </div>
  )
}

function StatusBadge({ completed, t }: { completed: boolean; t: TFunc }) {
  if (completed) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle2 className="w-3 h-3" />
        {t("career.completed")}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
      <Circle className="w-3 h-3" />
      {t("career.in_progress")}
    </span>
  )
}
