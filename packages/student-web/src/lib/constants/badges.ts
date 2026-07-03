/**
 * spec 042: 先驱者协会徽章 — 前端常量.
 *
 * domain -> chapter 映射必须与后端保持一致:
 * packages/student-app/src/systemedu/student/badges/chapters.py 的 CHAPTER_BY_DOMAIN。
 * 两处独立维护, 新增分会时两边都要改。
 */

import type { BadgeTier } from "@/lib/types/api"

export const CHAPTER_BY_DOMAIN: Record<string, string> = {
  Biotech: "bio-forge",
  Aerospace: "skyward",
  Climate: "verdant",
  Robotics: "mecha-core",
  AI: "mind-forge",
  CS: "codex",
  Neuroscience: "neural-spire",
  Paleontology: "deep-time",
}

export const BADGE_TIERS: BadgeTier[] = ["bronze", "silver", "gold", "master"]

/** 项目 domain -> 分会 slug, 映射不到返回 null (该项目暂无对应分会, 不掉落徽章)。 */
export function chapterForDomain(domain?: string | null): string | null {
  if (!domain) return null
  return CHAPTER_BY_DOMAIN[domain] ?? null
}

/** 徽章图片路径。 */
export function badgeImageUrl(chapter: string, tier: BadgeTier): string {
  return `/badges/${chapter}-${tier}.png`
}
