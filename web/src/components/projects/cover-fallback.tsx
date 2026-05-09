"use client"

/** spec 022: 项目封面 CSS fallback (无 LLM 调用)
 *
 * 用项目标题第一个字 + slug-hash 选定颜色, 渲染纯 CSS 封面。
 * Wanx 多模态生成 (image_gen.py) 已在 spec 022 删除; 等加回多模态
 * 配置后再恢复 LLM 生成的真实封面。
 */

import { cn } from "@/lib/utils"

const PALETTE = [
  // 10 色板, 跟首页 logo 紫调和谐
  { bg: "#6a1cf6", fg: "#ffffff" }, // violet
  { bg: "#0ea5e9", fg: "#ffffff" }, // sky
  { bg: "#10b981", fg: "#ffffff" }, // emerald
  { bg: "#f59e0b", fg: "#ffffff" }, // amber
  { bg: "#ef4444", fg: "#ffffff" }, // red
  { bg: "#ec4899", fg: "#ffffff" }, // pink
  { bg: "#14b8a6", fg: "#ffffff" }, // teal
  { bg: "#8b5cf6", fg: "#ffffff" }, // purple
  { bg: "#3b82f6", fg: "#ffffff" }, // blue
  { bg: "#f97316", fg: "#ffffff" }, // orange
] as const

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export interface CoverFallbackProps {
  title: string
  slug: string
  className?: string
  /** 字体大小相对容器 (em); 默认 4em */
  fontEm?: number
}

export function CoverFallback({ title, slug, className, fontEm = 4 }: CoverFallbackProps) {
  const initial = (title || slug || "?").trim().charAt(0) || "?"
  const palette = PALETTE[hashStr(slug || title) % PALETTE.length]

  return (
    <div
      className={cn(
        "w-full h-full flex items-center justify-center select-none",
        className,
      )}
      style={{
        backgroundColor: palette.bg,
        color: palette.fg,
        fontSize: `${fontEm}em`,
        fontWeight: 800,
        fontFamily: "var(--font-headline, 'Plus Jakarta Sans', system-ui, sans-serif)",
        letterSpacing: "-0.02em",
      }}
      aria-label={title}
    >
      {initial}
    </div>
  )
}
