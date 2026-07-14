"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import type { GalaxyPayload } from "@/lib/galaxy/types"
import { useT } from "@/lib/i18n/use-t"
import styles from "@/app/(home)/galaxy/galaxy.module.css"

// three.js 不可 SSR
const Canvas3D = dynamic(() => import("./ConceptGalaxyCanvas3D"), { ssr: false })

interface Props {
  payload: GalaxyPayload
  litByConcept: Set<string>
  initialProject?: string
  loggedIn: boolean
}

export function ConceptGalaxy({ payload, litByConcept, initialProject, loggedIn }: Props) {
  const t = useT()
  const byId = useMemo(
    () => Object.fromEntries(payload.concepts.map((c) => [c.id, c] as const)),
    [payload.concepts],
  )

  const [activeProj, setActiveProj] = useState<string | null>(initialProject ?? null)
  const [activeSubj, setActiveSubj] = useState<string | null>(null)
  const [selId, setSelId] = useState<string | null>(null)

  // 深链 ?project= 变化时同步预选 (galaxy→galaxy 客户端导航复用同一组件实例)
  useEffect(() => {
    if (initialProject) {
      setActiveProj(initialProject)
      setActiveSubj(null)
    }
  }, [initialProject])

  // 当前应高亮的概念集合: 学科筛选 > 项目选中 > 我学过
  const highlightSet = useMemo(() => {
    if (activeSubj) return new Set(payload.concepts.filter((c) => c.subj === activeSubj).map((c) => c.id))
    if (activeProj) return new Set(payload.proj_concepts[activeProj] || [])
    return litByConcept
  }, [activeSubj, activeProj, payload, litByConcept])

  const dimOthers = !!activeProj || !!activeSubj

  // 学科统计 (图例, 按数量降序)
  const subjOrder = useMemo(() => {
    const cnt: Record<string, number> = {}
    for (const c of payload.concepts) cnt[c.subj] = (cnt[c.subj] || 0) + 1
    return { cnt, order: Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]) }
  }, [payload.concepts])

  const sel = selId ? byId[selId] : null

  function toggleProj(slug: string) {
    setActiveProj(activeProj === slug ? null : slug)
    setActiveSubj(null)
  }
  function toggleSubj(s: string) {
    setActiveSubj(activeSubj === s ? null : s)
  }

  return (
    <>
      <div className={styles.galaxy}>
        <Canvas3D
          payload={payload}
          highlightSet={highlightSet}
          dimOthers={dimOthers}
          litByConcept={litByConcept}
          selId={selId}
          onSelect={setSelId}
        />
      </div>

      {/* 左列: 标题 + KPI + 项目 chip + 学科图例 */}
      <div className={styles.leftcol}>
        <div className={styles.lede}>
          <h1>
            {t("galaxy.page.title_a")}<br />{t("galaxy.page.title_b")}<br />{t("galaxy.page.title_c")}
          </h1>
          <p className={styles.desc}>{t("galaxy.page.desc")}</p>
          <div className={styles.kpis}>
            <div>
              <div className={styles.n}>{payload.concepts.length}</div>
              <div className={styles.l}>{t("galaxy.page.kpi_concepts")}</div>
            </div>
            <div>
              <div className={styles.n}>{subjOrder.order.length}</div>
              <div className={styles.l}>{t("galaxy.page.kpi_subjects")}</div>
            </div>
            <div>
              <div className={styles.n}>{payload.concepts.filter((c) => c.g === "university").length}</div>
              <div className={styles.l}>{t("galaxy.page.kpi_university")}</div>
            </div>
          </div>
          {!loggedIn && (
            <p className={styles.desc} style={{ marginTop: 10 }}>{t("galaxy.page.login_cta")}</p>
          )}
        </div>

        {/* 项目 chip 栏 */}
        <div className={styles.projwrap}>
          <div className={styles.tag}>{t("galaxy.page.pick_project")}</div>
          <div className={styles.chips}>
            {payload.projects.map((p) => (
              <button
                key={p.slug}
                className={styles.chip}
                aria-pressed={activeProj === p.slug}
                onClick={() => toggleProj(p.slug)}
              >
                <span className={styles.dot} />
                {p.zh}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.spacer} />

        {/* 学科图例 */}
        <div className={styles.legend}>
          <div className={styles.cap}>{t("galaxy.page.legend_cap")}</div>
          <div className={styles.lgrid}>
            {subjOrder.order.map((s) => (
              <button
                key={s}
                className={styles.lg}
                aria-pressed={activeSubj === s}
                onClick={() => toggleSubj(s)}
              >
                <span className={styles.sw} style={{ background: payload.subj_color[s], color: payload.subj_color[s] }} />
                <span className={styles.nm}>{payload.subj_zh[s] || s}</span>
                <span className={styles.ct}>{subjOrder.cnt[s]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 提示 */}
      <div className={styles.hint}>{t("galaxy.page.hint")}</div>

      {/* 概念卡片 */}
      {sel && (
        <div className={`${styles.card} ${styles.show}`}>
          <button className={styles.x} onClick={() => setSelId(null)} aria-label="close">×</button>
          <span
            className={styles.subj}
            style={{
              background: (payload.subj_color[sel.subj] || "#888") + "20",
              color: payload.subj_color[sel.subj] || "#888",
              border: `1px solid ${(payload.subj_color[sel.subj] || "#888")}55`,
            }}
          >
            {payload.subj_zh[sel.subj] || sel.subj}
          </span>
          <h3>{sel.zh}</h3>
          <div className={styles.en}>{sel.en}</div>
          <div className={styles.kv}>
            <b>{t("galaxy.card.grade")}</b>
            <span>{t(`galaxy.grade.${sel.g}`)} · {sel.t.toLowerCase()}</span>
          </div>
          <div className={styles.kv}>
            <b>{t("galaxy.card.used_by")}</b>
            <div className={styles.projwrp}>
              {sel.p.map((s) => {
                const pj = payload.projects.find((x) => x.slug === s)
                return <span key={s} className={styles.pchip}>{pj ? pj.zh : s}</span>
              })}
            </div>
          </div>
          {(() => {
            const mods = [...new Set((payload.covers[sel.id] || []).map((m) => m.slice(m.lastIndexOf(":") + 1)))].slice(0, 12)
            return mods.length ? (
              <div className={styles.kv}>
                <b>{t("galaxy.card.modules")}</b>
                <div className={styles.mods}>
                  {mods.map((m) => <span key={m} className={styles.mc}>{m}</span>)}
                </div>
              </div>
            ) : null
          })()}
          <div className={styles.stub}>{t("galaxy.card.stub")}</div>
          {sel.q ? (
            <a className={styles.wd} href={`https://www.wikidata.org/wiki/${sel.q}`} target="_blank" rel="noopener">
              Wikidata ↗ {sel.q}
            </a>
          ) : (
            <a className={`${styles.wd} ${styles.disabled}`} href="#" onClick={(e) => e.preventDefault()}>
              Wikidata ↗ {t("galaxy.card.wikidata_pending")}
            </a>
          )}
        </div>
      )}

      {!loggedIn && <span className={styles.srOnly}>{t("galaxy.page.login_cta")}</span>}
    </>
  )
}
