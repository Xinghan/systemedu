"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useT } from "@/lib/i18n/use-t"
import { ConceptGalaxy } from "@/components/learning/ConceptGalaxy"
import { fetchLitByConcept } from "@/lib/galaxy/lit"
import type { GalaxyPayload } from "@/lib/galaxy/types"
import styles from "./galaxy.module.css"

// useSearchParams 需要 Suspense 边界 (Next.js 静态预渲染要求)。缺它会导致
// `next build` 预渲染 /galaxy 时报错 → 整个 build 失败。
export default function GalaxyPage() {
  return (
    <Suspense fallback={null}>
      <GalaxyPageInner />
    </Suspense>
  )
}

function GalaxyPageInner() {
  const t = useT()
  const { loggedIn, hydrate } = useAuthStore()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("project") || undefined
  const [payload, setPayload] = useState<GalaxyPayload | null>(null)
  const [litByConcept, setLitByConcept] = useState<Set<string>>(new Set())

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    let cancelled = false
    fetch("/galaxy/concept-galaxy.json")
      .then((r) => r.json())
      .then(async (p: GalaxyPayload) => {
        if (cancelled) return
        setPayload(p)
        if (loggedIn) {
          const lit = await fetchLitByConcept(p)
          if (!cancelled) setLitByConcept(lit)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [loggedIn])

  if (!payload) {
    return (
      <main className="page-wide">
        <div style={{ height: 560, display: "grid", placeItems: "center", color: "var(--sub)" }}>
          {t("galaxy.page.loading")}
        </div>
      </main>
    )
  }

  return (
    <main className="page-wide">
      <div className={styles.stage}>
        <div className={styles.brand}><span className={styles.fx}>✦</span> SYSTEMEDU · 全学科知识星图</div>
        <ConceptGalaxy payload={payload} litByConcept={litByConcept} initialProject={initialProject} loggedIn={loggedIn} />
      </div>
    </main>
  )
}
