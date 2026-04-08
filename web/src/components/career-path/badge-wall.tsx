"use client"

import { Award, Lock } from "lucide-react"
import type { CareerPathDetail } from "@/lib/api"
import type { TranslationKey } from "@/lib/i18n"

interface Props {
  detail: CareerPathDetail
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

export function BadgeWall({ detail, t }: Props) {
  const earnedSet = new Set(detail.earned_badges.map((b) => b.stage_order))

  return (
    <div className="mt-12">
      <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
        <Award className="w-5 h-5 text-primary" />
        {t("career.badges")}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {detail.stages.map((stage) => {
          if (!stage.badge) return null
          const earned = earnedSet.has(stage.order)
          const earnedInfo = detail.earned_badges.find((b) => b.stage_order === stage.order)

          return (
            <div
              key={stage.order}
              className={`relative p-5 rounded-xl border text-center transition-all duration-300 ${
                earned
                  ? "bg-card border-amber-200/50 dark:border-amber-800/30 shadow-sm hover:shadow-md"
                  : "bg-muted/30 border-border/20 opacity-50 grayscale"
              }`}
            >
              {/* Badge icon */}
              <div
                className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center ${
                  earned
                    ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20"
                    : "bg-muted border-2 border-border"
                }`}
              >
                {earned ? (
                  <Award className="w-7 h-7 text-white" />
                ) : (
                  <Lock className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {/* Badge name */}
              <h4 className={`text-sm font-bold mb-1 ${earned ? "text-foreground" : "text-muted-foreground"}`}>
                {stage.badge.name}
              </h4>

              {/* Badge description or lock message */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                {earned && earnedInfo?.earned_at
                  ? t("career.earned_at", { date: new Date(earnedInfo.earned_at).toLocaleDateString() })
                  : earned
                    ? stage.badge.description
                    : t("career.badge_locked")}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
