"use client"

import { useEffect, useState } from "react"
import { Sparkles, Terminal } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/layout/app-header"
import { gateway } from "@/lib/api"
import type { SkillInfo } from "@/lib/types/api"
import { useT } from "@/lib/hooks/use-t"

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const t = useT()

  useEffect(() => {
    gateway
      .skills()
      .then(setSkills)
      .catch((e) => setError(e.message ?? t("skills.load_error")))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <AppHeader title={t("skills.title")} />
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-base border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}
        {loading ? (
          <PageLoading />
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
              <Sparkles className="h-10 w-10 opacity-40" />
            </div>
            <p className="text-lg font-medium">{t("skills.empty")}</p>
            <p className="text-base mt-1">{t("skills.empty_desc")}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => (
              <div key={skill.name} className="rounded-2xl border bg-white dark:bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40">
                    <Sparkles className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-base text-foreground">{skill.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{skill.description || t("skills.no_desc")}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skill.user_invocable && (
                    <Badge className="flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5" />
                      {t("skills.invocable")}
                    </Badge>
                  )}
                  <Badge variant="outline" className="truncate max-w-[200px]">
                    {skill.source.split("/").slice(-2).join("/")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
