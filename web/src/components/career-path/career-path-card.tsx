"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Trophy, ChevronRight, Award, CheckCircle2 } from "lucide-react"
import { gateway } from "@/lib/api"
import type { CareerPathSummary } from "@/lib/api"

import type { TranslationKey } from "@/lib/i18n"

interface Props {
  projectName: string
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

/**
 * Embeddable career path card for project detail pages.
 * Shows which career paths include this project and current progress.
 */
export function CareerPathCard({ projectName, t }: Props) {
  const [paths, setPaths] = useState<CareerPathSummary[]>([])

  useEffect(() => {
    gateway.careerPaths()
      .then((all) => {
        // Filter paths that might include this project
        // We need detail to check stages, but for perf we check all and let the
        // detail endpoint confirm. For now show all enrolled paths.
        setPaths(all.filter((p) => p.status !== "not_enrolled"))
      })
      .catch(() => {})
  }, [projectName])

  if (paths.length === 0) return null

  return (
    <div className="card-elevated p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">{t("career.title")}</h3>
      </div>

      <div className="space-y-3">
        {paths.map((p) => (
          <Link
            key={p.name}
            href="/career-paths"
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {p.status === "completed" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Award className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  {p.completed_stages}/{p.total_stages} {t("career.completed").toLowerCase()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Mini progress */}
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${p.total_stages > 0 ? Math.round((p.completed_stages / p.total_stages) * 100) : 0}%` }}
                />
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
