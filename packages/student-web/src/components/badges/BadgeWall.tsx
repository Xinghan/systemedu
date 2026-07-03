"use client"

/**
 * spec 042: 先驱者协会徽章墙.
 *
 * 按分会分组展示当前持有的铜/银/金/大师徽章数量, 卡片主图用当前最高等级的图。
 * 图片资源命名约定: /badges/<chapter>-<tier>.png (chapter/tier 均为连字符英文名,
 * 见 packages/student-app .../badges/chapters.py)。图片未就位前用锁图标占位, 不因
 * 404 报错影响页面渲染 (<img onError> 兜底切换到占位态)。
 */

import { useEffect, useState } from "react"
import { Lock } from "lucide-react"

import { myBadges } from "@/lib/api"
import type { BadgeChapterWall } from "@/lib/types/api"
import { useT } from "@/lib/i18n/use-t"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { BADGE_TIERS as TIER_ORDER, badgeImageUrl } from "@/lib/constants/badges"

function ChapterCard({ chapter }: { chapter: BadgeChapterWall }) {
  const t = useT()
  const [imgFailed, setImgFailed] = useState(false)
  const highest = chapter.highest_tier

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col items-center gap-3">
      <div className="w-24 h-24 rounded-full flex items-center justify-center bg-[var(--paper-2)] overflow-hidden">
        {highest && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={badgeImageUrl(chapter.chapter, highest)}
            alt={chapter.display_name}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Lock className="h-8 w-8 text-[var(--sub-2)]" />
        )}
      </div>
      <h3 className="font-bold text-[var(--ink)] text-sm text-center">{chapter.display_name}</h3>
      <div className="flex items-center gap-2 text-xs">
        {TIER_ORDER.map((tier) => (
          <span
            key={tier}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: "var(--paper-2)", color: "var(--sub)" }}
          >
            {t(`badges.tier.${tier}`)}
            <strong style={{ color: "var(--ink)" }}>{chapter.counts[tier]}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

export function BadgeWall() {
  const t = useT()
  const [data, setData] = useState<BadgeChapterWall[] | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    myBadges
      .getWall()
      .then((r) => {
        if (cancelled) return
        setData(r.chapters)
      })
      .catch(() => {
        if (cancelled) return
        setErr(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (err) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--paper-2)] p-8 text-sm text-[var(--sub)]">
        {t("badges.load_failed")}
      </div>
    )
  }

  if (data === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="md" label={t("badges.loading")} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {data.map((chapter) => (
        <ChapterCard key={chapter.chapter} chapter={chapter} />
      ))}
    </div>
  )
}
