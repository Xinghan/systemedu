/** BadgeWallModal — 先驱者协会徽章墙弹窗 (spec 042)。
 *
 * 点击「我的徽章」入口卡片后弹出, 居中 modal 里完整展示八大分会徽章墙。
 * 交互对齐 StoryModal: ESC / 点遮罩关闭, 打开时锁定 body 滚动。
 */

"use client"

import { useEffect } from "react"
import { X } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { BadgeWall } from "@/components/badges/BadgeWall"

export function BadgeWallModal({ onClose }: { onClose: () => void }) {
  const t = useT()

  // ESC 关闭
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // 打开时锁 body 滚动
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("badges.wall_title")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(28,22,17,0.62)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "min(5vw, 48px)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(920px, 96vw)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--paper, #FAF9F5)",
          borderRadius: 16,
          border: "1px solid var(--border, rgba(0,0,0,0.08))",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        {/* 顶栏: eyebrow 标题 + 关闭 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border, rgba(0,0,0,0.06))",
          }}
        >
          <div
            className="mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11.5,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--sub, #6b6259)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--primary, #D97757)",
                display: "inline-block",
              }}
            />
            {t("badges.wall_title")}
          </div>
          <button
            onClick={onClose}
            aria-label={t("badges.close")}
            style={{
              width: 30,
              height: 30,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              border: "1px solid var(--border, rgba(0,0,0,0.08))",
              background: "var(--card, #fff)",
              color: "var(--sub, #6b6259)",
              cursor: "pointer",
            }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* 徽章墙主体 (可滚动) */}
        <div style={{ overflowY: "auto", padding: 18 }}>
          <BadgeWall />
        </div>
      </div>
    </div>
  )
}
