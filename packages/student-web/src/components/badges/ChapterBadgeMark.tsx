"use client"

/**
 * spec 042: 项目卡片分会角标.
 *
 * 按项目 domain 归属分会, 显示该分会铜级徽章小图 (示意"学这个能拿这个分会的徽章")。
 * domain 映射不到分会时不渲染 (返回 null)。图片加载失败静默隐藏, 不占位。
 * 用法: 放在 position:relative 的封面容器内, 自身 absolute 定位到右上角。
 */

import { useState } from "react"

import { useT } from "@/lib/i18n/use-t"
import { chapterForDomain, badgeImageUrl } from "@/lib/constants/badges"

export function ChapterBadgeMark({
  domain,
  size = 34,
  corner = "top-right",
}: {
  domain?: string | null
  size?: number
  corner?: "top-right" | "top-left"
}) {
  const t = useT()
  const [failed, setFailed] = useState(false)
  const chapter = chapterForDomain(domain)
  if (!chapter || failed) return null

  const chapterName = t(`badges.chapter.${chapter}`)
  const horizontal = corner === "top-left" ? { left: 8 } : { right: 8 }
  return (
    <div
      title={t("card.badge_mark_tooltip", { chapter: chapterName })}
      style={{
        position: "absolute",
        top: 8,
        ...horizontal,
        zIndex: 3,
        width: size,
        height: size,
        borderRadius: 999,
        overflow: "hidden",
        background: "rgba(0,0,0,0.25)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        backdropFilter: "blur(2px)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={badgeImageUrl(chapter, "bronze")}
        alt={chapterName}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
