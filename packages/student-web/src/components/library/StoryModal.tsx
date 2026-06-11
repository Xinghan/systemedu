/** StoryModal — 项目开篇连环画弹窗 (spec 040)。
 *
 * 逐帧显示「纯插画图 + 下方双语标题/说明」, 像连环画/故事板一样几屏讲清楚
 * 这个项目是什么、目的、大概怎么实现。图来自 library files 端点。
 *
 * 交互: 左右箭头 / 键盘 ←→ 翻页, 底部圆点进度可跳页, ESC / 点遮罩关闭。
 * 文案按全局 locale 取 zh/en, 缺一语言时回落到另一语言。
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { library, type StoryFrame } from "@/lib/api"
import { useT, useLocale } from "@/lib/i18n/use-t"

function pick(zh?: string, en?: string, locale: "zh" | "en" = "zh"): string {
  if (locale === "en") return en || zh || ""
  return zh || en || ""
}

export function StoryModal({
  slug,
  frames,
  onClose,
}: {
  slug: string
  frames: StoryFrame[]
  onClose: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const [idx, setIdx] = useState(0)
  const total = frames.length

  const go = useCallback(
    (next: number) => setIdx((cur) => Math.max(0, Math.min(total - 1, next))),
    [total],
  )

  // 键盘: ← → 翻页, ESC 关闭
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft") setIdx((c) => Math.max(0, c - 1))
      else if (e.key === "ArrowRight") setIdx((c) => Math.min(total - 1, c + 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, total])

  // 锁背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (total === 0) return null
  const frame = frames[idx]
  const title = pick(frame.title_zh, frame.title_en, locale)
  const caption = pick(frame.caption_zh, frame.caption_en, locale)
  const atStart = idx === 0
  const atEnd = idx === total - 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("story.title")}
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
          width: "min(720px, 94vw)",
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
        {/* 顶栏: 标题 eyebrow + 关闭 */}
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
            {t("story.title")}
          </div>
          <button
            onClick={onClose}
            aria-label={t("story.close")}
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: "1px solid var(--border, rgba(0,0,0,0.1))",
              background: "var(--card, #fff)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "var(--sub, #6b6259)",
            }}
          >
            <X size={16} strokeWidth={1.6} />
          </button>
        </div>

        {/* 图区 */}
        <div
          style={{
            position: "relative",
            background: "var(--paper-2, #F2EFE8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
            flex: "1 1 auto",
          }}
        >
          <img
            key={frame.image}
            src={library.fileUrl(slug, frame.image)}
            alt={title}
            style={{
              maxWidth: "100%",
              maxHeight: "min(56vh, 560px)",
              objectFit: "contain",
              display: "block",
            }}
          />

          {/* 左右翻页箭头 (叠在图上) */}
          {!atStart && (
            <ArrowButton side="left" label={t("story.prev")} onClick={() => go(idx - 1)} />
          )}
          {!atEnd && (
            <ArrowButton side="right" label={t("story.next")} onClick={() => go(idx + 1)} />
          )}
        </div>

        {/* 文案区: 双语标题 + 说明 */}
        <div
          style={{
            padding: "20px 26px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {title && (
            <h3
              className="h3"
              style={{
                fontSize: 19,
                lineHeight: 1.3,
                fontWeight: 600,
                color: "var(--ink, #1f1a15)",
                margin: 0,
              }}
            >
              {title}
            </h3>
          )}
          {caption && (
            <p
              className="body"
              style={{
                fontSize: 14.5,
                lineHeight: 1.6,
                color: "var(--sub, #5a5249)",
                margin: 0,
              }}
            >
              {caption}
            </p>
          )}
        </div>

        {/* 底栏: 圆点进度 + 页码 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 22px 18px",
            borderTop: "1px solid var(--border, rgba(0,0,0,0.06))",
          }}
        >
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {frames.map((_, i) => (
              <button
                key={i}
                aria-label={`${i + 1}`}
                onClick={() => go(i)}
                style={{
                  width: i === idx ? 22 : 8,
                  height: 8,
                  borderRadius: 999,
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background:
                    i === idx ? "var(--primary, #D97757)" : "var(--border-2, rgba(0,0,0,0.16))",
                  transition: "width var(--t-med, .25s), background var(--t-med, .25s)",
                }}
              />
            ))}
          </div>
          <span
            className="mono"
            style={{ fontSize: 11.5, color: "var(--sub-2, #8a8178)" }}
          >
            {t("story.frame_of", { cur: idx + 1, total })}
          </span>
        </div>
      </div>
    </div>
  )
}

function ArrowButton({
  side,
  label,
  onClick,
}: {
  side: "left" | "right"
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        [side]: 14,
        width: 40,
        height: 40,
        borderRadius: 999,
        border: "1px solid var(--border, rgba(0,0,0,0.1))",
        background: "rgba(255,255,255,0.92)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        color: "var(--ink-2, #2a241e)",
      }}
    >
      {side === "left" ? (
        <ChevronLeft size={20} strokeWidth={1.8} />
      ) : (
        <ChevronRight size={20} strokeWidth={1.8} />
      )}
    </button>
  )
}
