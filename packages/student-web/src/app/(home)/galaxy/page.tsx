"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useT } from "@/lib/i18n/use-t"
import { ConceptGalaxy } from "@/components/learning/ConceptGalaxy"
import { fetchLitByConcept } from "@/lib/galaxy/lit"
import type { GalaxyPayload } from "@/lib/galaxy/types"
import styles from "./galaxy.module.css"

export default function GalaxyPage() {
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

  const uniSubjects = new Set(payload.concepts.map((c) => c.subj)).size
  const uniCount = payload.concepts.filter((c) => c.g === "university").length

  return (
    <main className="page-wide">
      <div className={styles.stage}>
        <div className={styles.brand}><span className={styles.fx}>✦</span> SYSTEMEDU · 全学科知识星图</div>
        <ConceptGalaxy payload={payload} litByConcept={litByConcept} initialProject={initialProject} loggedIn={loggedIn} />
        <div className={styles.leftcol}>
          <div className={styles.lede}>
            <h1>{t("galaxy.page.title_a")}<br />{t("galaxy.page.title_b")}<br />{t("galaxy.page.title_c")}</h1>
            <p className={styles.desc}>{t("galaxy.page.desc")}</p>
            <div className={styles.kpis}>
              <div><div className={styles.n}>{payload.concepts.length}</div><div className={styles.l}>{t("galaxy.page.kpi_concepts")}</div></div>
              <div><div className={styles.n}>{uniSubjects}</div><div className={styles.l}>{t("galaxy.page.kpi_subjects")}</div></div>
              <div><div className={styles.n}>{uniCount}</div><div className={styles.l}>{t("galaxy.page.kpi_university")}</div></div>
            </div>
            {!loggedIn && <p className={styles.desc} style={{ marginTop: 10 }}>{t("galaxy.page.login_cta")}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}
