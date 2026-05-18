"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"

export type PageKind = "global" | "home" | "library_detail" | "learn"

export interface PageContext {
  page_kind: PageKind
  library_slug?: string
  module_id?: string
}

/**
 * spec 032 P6: 按当前 pathname 派生 page_kind + library_slug/module_id,
 * 用于 ChatPayload.
 *
 * Matrix:
 *   /                              -> global
 *   /dashboard | /sessions | /memory -> home
 *   /library                       -> home (项目库列表)
 *   /library/[slug]                -> library_detail
 *   /library/[slug]/[knode_id]     -> learn
 */
export function usePageKind(): PageContext {
  const pathname = usePathname() || "/"
  return useMemo(() => {
    if (pathname === "/" || pathname.startsWith("/dashboard") ||
        pathname.startsWith("/sessions") || pathname.startsWith("/memory")) {
      return { page_kind: pathname === "/" ? "global" : "home" }
    }
    if (pathname === "/library" || pathname.startsWith("/library?")) {
      return { page_kind: "home" }
    }
    // /library/[slug]
    const m1 = pathname.match(/^\/library\/([^/]+)$/)
    if (m1) return { page_kind: "library_detail", library_slug: m1[1] }
    // /library/[slug]/[knode_id]
    const m2 = pathname.match(/^\/library\/([^/]+)\/([^/]+)/)
    if (m2) return {
      page_kind: "learn", library_slug: m2[1], module_id: m2[2],
    }
    return { page_kind: "global" }
  }, [pathname])
}
