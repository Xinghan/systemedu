// 个人点亮: 我完成的 knode → 我点亮的概念。
// 纯前端 join, 零后端: completed_knode_ids (裸 M##) × payload.covers (概念→slug:M##)。

import { myProjects, myKnodes } from "@/lib/api"
import type { GalaxyPayload } from "./types"

/**
 * 纯函数: 给定 payload.covers 和"每项目我完成的 module id 集合", 算出我点亮的概念 id 集合。
 * @param covers payload.covers: conceptId → ["slug:M##" 或 "slug:slug:M##"(stirling 双写)]
 * @param completedBySlug slug → Set<module id 裸 M##>
 */
export function computeLitConcepts(
  covers: Record<string, string[]>,
  completedBySlug: Record<string, Set<string>>,
): Set<string> {
  const lit = new Set<string>()
  const knownSlugs = Object.keys(completedBySlug)
  for (const [conceptId, entries] of Object.entries(covers)) {
    for (const entry of entries) {
      // module id = 最后一段 (兼容 stirling 双写前缀)
      const mid = entry.slice(entry.lastIndexOf(":") + 1)
      // slug = entry 里出现的已知 slug (取匹配的第一个)
      const slug = knownSlugs.find((s) => entry.startsWith(s + ":") || entry.includes(":" + s + ":"))
      if (slug && completedBySlug[slug]?.has(mid)) {
        lit.add(conceptId)
        break
      }
    }
  }
  return lit
}

/** 登录时调: 拉我书架项目 + 每项目完成状态 → 算 litByConcept。失败返回空集 (退化成探索模式)。 */
export async function fetchLitByConcept(payload: GalaxyPayload): Promise<Set<string>> {
  try {
    const mine = await myProjects.list()
    const slugs = mine.map((p) => p.slug)
    const completedBySlug: Record<string, Set<string>> = {}
    await Promise.all(
      slugs.map(async (slug) => {
        try {
          const st = await myKnodes.getCompleteStatus(slug)
          completedBySlug[slug] = new Set(st.completed_knode_ids)
        } catch {
          completedBySlug[slug] = new Set()
        }
      }),
    )
    return computeLitConcepts(payload.covers, completedBySlug)
  } catch {
    return new Set()
  }
}
