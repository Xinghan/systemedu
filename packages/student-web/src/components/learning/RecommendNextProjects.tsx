"use client"

/**
 * spec 036: 推荐下 N 项目卡片. 调 /api/user/recommendations.
 */

import { useEffect, useState } from "react"
import Link from "next/link"

import { library, userKnowledgeTree, type ProjectRecommendation } from "@/lib/api"
import { useT } from "@/lib/i18n/use-t"

interface Props {
  limit?: number
}

export function RecommendNextProjects({ limit = 3 }: Props) {
  const t = useT()
  const [recs, setRecs] = useState<ProjectRecommendation[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    userKnowledgeTree
      .recommendations(limit)
      .then((r) => {
        if (!cancelled) setRecs(r.recommendations)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setErr(e instanceof Error ? e.message : t("recommend.load_failed"))
      })
    return () => {
      cancelled = true
    }
  }, [limit])

  if (err) {
    return (
      <p className="text-sm text-[var(--sub)]">{err}</p>
    )
  }
  if (recs === null) {
    return <p className="text-sm text-[var(--sub)]">{t("recommend.calculating")}</p>
  }
  if (recs.length === 0) {
    return (
      <p className="text-sm text-[var(--sub)]">
        {t("recommend.empty")}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {recs.map((r) => (
        <Link
          key={r.slug}
          href={`/library/${encodeURIComponent(r.slug)}`}
          className="group flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[var(--primary)] hover:shadow-md"
        >
          {r.cover_image_path && (
            <img
              src={library.coverUrl(r.slug)}
              alt={r.title_zh}
              className="h-24 w-full rounded-lg object-cover"
              loading="lazy"
            />
          )}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--ink)] line-clamp-2">
              {r.title_zh}
            </h3>
            {r.difficulty != null && (
              <span className="rounded-full bg-[var(--paper-2)] px-2 py-0.5 text-xs text-[var(--sub)]">
                {t("recommend.difficulty", { n: r.difficulty })}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 text-xs text-[var(--primary-ink)]">
            <span className="text-lg font-bold">+{r.new_nodes_count}</span>
            <span className="text-[var(--sub)]">{t("recommend.new_nodes")}</span>
          </div>
          {Object.keys(r.new_nodes_subjects).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(r.new_nodes_subjects)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([sid, n]) => (
                  <span
                    key={sid}
                    className="rounded-full border border-[var(--border)] bg-[var(--paper-2)] px-2 py-0.5 text-xs text-[var(--sub)]"
                  >
                    {sid} +{n}
                  </span>
                ))}
            </div>
          )}
        </Link>
      ))}
    </div>
  )
}
