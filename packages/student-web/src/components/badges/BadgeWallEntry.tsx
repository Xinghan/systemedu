/** BadgeWallEntry — 「我的徽章」入口卡片 (spec 042)。
 *
 * 替代原来直铺整面徽章墙: 页面上只放一张摘要卡 (已获徽章总数 + 几枚分会预览小图),
 * 点击才弹出 BadgeWallModal 看完整的八大分会徽章墙。
 * 加载失败/加载中都优雅降级, 不阻塞页面。
 */

"use client"

import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"

import { myBadges } from "@/lib/api"
import type { BadgeChapterWall } from "@/lib/types/api"
import { useT } from "@/lib/i18n/use-t"
import { BADGE_TIERS, badgeImageUrl } from "@/lib/constants/badges"
import { BadgeWallModal } from "@/components/badges/BadgeWallModal"

function totalEarned(chapters: BadgeChapterWall[]): number {
  return chapters.reduce(
    (sum, c) => sum + BADGE_TIERS.reduce((s, tier) => s + (c.counts[tier] || 0), 0),
    0,
  )
}

export function BadgeWallEntry() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [chapters, setChapters] = useState<BadgeChapterWall[] | null>(null)

  useEffect(() => {
    let cancelled = false
    myBadges
      .getWall()
      .then((r) => {
        if (!cancelled) setChapters(r.chapters)
      })
      .catch(() => {
        if (!cancelled) setChapters([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const earned = chapters ? totalEarned(chapters) : 0
  // 预览小图: 取前几个分会, 已解锁的用最高级、未解锁的用铜级作灰蒙预览
  const previews = (chapters ?? []).slice(0, 5)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 flex items-center gap-4 transition hover:border-[var(--sub-2)] hover:shadow-sm cursor-pointer"
      >
        {/* 分会预览小图叠放 */}
        <div className="flex items-center" style={{ flexShrink: 0 }}>
          {previews.map((c, i) => {
            const locked = !c.highest_tier
            const tier = c.highest_tier ?? "bronze"
            return (
              <span
                key={c.chapter}
                className="rounded-full overflow-hidden border-2 border-[var(--card)] bg-[var(--paper-2)] relative"
                style={{
                  width: 40,
                  height: 40,
                  marginLeft: i === 0 ? 0 : -12,
                  zIndex: previews.length - i,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={badgeImageUrl(c.chapter, tier)}
                  alt=""
                  aria-hidden
                  className="w-full h-full object-cover"
                  style={locked ? { filter: "grayscale(1) brightness(0.94)", opacity: 0.5 } : undefined}
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.visibility = "hidden"
                  }}
                />
                {locked && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full"
                    style={{ background: "var(--paper-2)", opacity: 0.4 }}
                  />
                )}
              </span>
            )
          })}
        </div>

        {/* 文案 */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[var(--ink)] text-sm">{t("badges.page_title")}</div>
          <div className="text-xs text-[var(--sub)] mt-0.5">
            {t("badges.total_earned")} · <strong className="text-[var(--ink)]">{earned}</strong>
          </div>
        </div>

        <ChevronRight size={18} strokeWidth={1.5} className="text-[var(--sub-2)]" style={{ flexShrink: 0 }} />
      </button>

      {open && <BadgeWallModal onClose={() => setOpen(false)} />}
    </>
  )
}
