"use client"

/**
 * spec 042: 独立徽章页 — 完整展示先驱者协会八大分会徽章墙.
 * 首页"我的徽章"卡片等入口的统一目的地。
 */

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { useAuthStore } from "@/lib/stores/auth-store"
import { useT } from "@/lib/i18n/use-t"
import { BadgeWallEntry } from "@/components/badges/BadgeWallEntry"

export default function BadgesPage() {
  const t = useT()
  const router = useRouter()
  const { loggedIn, hydrate } = useAuthStore()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (loggedIn === false) {
      router.replace("/login?next=/badges")
    }
  }, [loggedIn, router])

  return (
    <main className="page-wide" style={{ paddingTop: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--sub)",
          fontSize: 12.5,
          marginBottom: 12,
        }}
      >
        <span style={{ color: "var(--sub)" }}>{t("nav.home")}</span>
        <ChevronRight size={12} strokeWidth={1.5} style={{ color: "var(--sub-2)" }} />
        <span style={{ color: "var(--ink-2)" }}>{t("nav.badges")}</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          <span className="dot" /> {t("badges.wall_title")}
        </div>
        <h1 className="h1" style={{ fontSize: 30 }}>
          {t("badges.page_title")}
        </h1>
        <p className="body" style={{ color: "var(--sub)", marginTop: 8, fontSize: 13.5 }}>
          {t("badges.page_subtitle")}
        </p>
      </div>

      <BadgeWallEntry />
    </main>
  )
}
