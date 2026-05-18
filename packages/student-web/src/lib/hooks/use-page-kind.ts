"use client"

import { usePathname } from "next/navigation"
import { useMemo } from "react"
import type { PageKind } from "./use-websocket-chat"

export interface PageContext {
  page_kind: PageKind
  library_slug?: string
  module_id?: string
}

/**
 * spec 031: 按 pathname 派生 page_kind + library_slug + module_id 透传给 chat WS.
 *
 *   /                              -> global
 *   /home /sessions /memory        -> home
 *   /library                       -> home
 *   /library/[slug]                -> library_detail
 *   /library/[slug]/[knode_id]     -> learn
 *   /learn/[slug]/[moduleId]       -> learn
 *   /my-projects                   -> home
 */
export function usePageKind(): PageContext {
  const pathname = usePathname() || "/"
  return useMemo(() => {
    if (pathname === "/") return { page_kind: "global" }
    if (
      pathname.startsWith("/home") ||
      pathname.startsWith("/my-projects") ||
      pathname.startsWith("/sessions") ||
      pathname.startsWith("/memory")
    ) {
      return { page_kind: "home" }
    }
    // /library or /library?...
    if (pathname === "/library" || pathname.startsWith("/library?")) {
      return { page_kind: "home" }
    }
    // /learn/[slug]/[moduleId]
    const ml = pathname.match(/^\/learn\/([^/]+)\/([^/?#]+)/)
    if (ml) return { page_kind: "learn", library_slug: ml[1], module_id: ml[2] }
    // /library/[slug]/[knode_id]
    const mlk = pathname.match(/^\/library\/([^/]+)\/([^/?#]+)/)
    if (mlk) return { page_kind: "learn", library_slug: mlk[1], module_id: mlk[2] }
    // /library/[slug]
    const mls = pathname.match(/^\/library\/([^/?#]+)/)
    if (mls) return { page_kind: "library_detail", library_slug: mls[1] }
    return { page_kind: "global" }
  }, [pathname])
}
