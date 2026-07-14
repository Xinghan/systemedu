"use client"

import { useEffect, useMemo, useState } from "react"
import type { GalaxyPayload, GradeBand } from "@/lib/galaxy/types"
import { useT } from "@/lib/i18n/use-t"
import styles from "@/app/(home)/galaxy/galaxy.module.css"

interface Props {
  payload: GalaxyPayload
  litByConcept: Set<string>
  initialProject?: string
  loggedIn: boolean
}

const NS = "http://www.w3.org/2000/svg"
const BANDS: GradeBand[] = ["university", "high", "middle", "elementary"]

// 概念中文名去括号 + 截断, 作节点标签
function shortLabel(zh: string): string {
  const stripped = zh.replace(/（[^）]*）|\([^)]*\)/g, "")
  return stripped.length > 7 ? stripped.slice(0, 6) + "…" : stripped
}

export function ConceptGalaxy({ payload, litByConcept, initialProject, loggedIn }: Props) {
  const t = useT()
  const L = payload.layout
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
      <svg
        className={styles.galaxy}
        viewBox={`0 0 ${L.VW} ${L.VH}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        xmlns={NS}
      >
        {/* 学段带 */}
        <g>
          {BANDS.map((b) => {
            const y = L.bandY[b]
            return (
              <g key={b}>
                <line className={styles.bandline} x1={L.VW * 0.28} y1={y - 64} x2={L.VW - 6} y2={y - 64} />
                <text className={styles.bandtick} x={L.VW - 10} y={y - 52} textAnchor="end">
                  {L.band_label[b]}
                </text>
              </g>
            )
          })}
        </g>
        {/* 边 */}
        <g>
          {payload.edges.map(([a, b], i) => {
            const pa = byId[a], pb = byId[b]
            if (!pa || !pb) return null
            const hot = highlightSet.has(a) && highlightSet.has(b)
            return (
              <line
                key={i}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke={hot ? "#D97757" : "#9D978A"}
                strokeOpacity={hot ? 0.45 : dimOthers ? 0.04 : 0.1}
              />
            )
          })}
        </g>
        {/* 节点 */}
        <g>
          {payload.concepts.map((c) => {
            const col = payload.subj_color[c.subj] || "#888"
            const r = 3 + Math.min(5, (c.p.length - 1) * 1.5)
            const on = highlightSet.has(c.id)
            const opacity = dimOthers ? (on ? 1 : 0.12) : litByConcept.has(c.id) ? 1 : 0.85
            const rr = on && dimOthers ? r + 1.4 : r
            return (
              <circle
                key={c.id}
                cx={c.x}
                cy={c.y}
                r={rr}
                fill={col}
                opacity={opacity}
                stroke={selId === c.id ? "#191814" : "none"}
                strokeWidth={selId === c.id ? 1.5 : 0}
                style={{ cursor: "pointer", transition: "opacity .3s" }}
                onClick={() => setSelId(c.id)}
              />
            )
          })}
        </g>
        {/* 高亮态显示标签 (被 >=2 项目共享的点) */}
        <g>
          {dimOthers &&
            payload.concepts
              .filter((c) => highlightSet.has(c.id) && c.p.length >= 2)
              .map((c) => {
                const r = 3 + Math.min(5, (c.p.length - 1) * 1.5)
                return (
                  <text
                    key={c.id}
                    x={c.x}
                    y={c.y - (r + 4)}
                    textAnchor="middle"
                    style={{
                      fontSize: "9.5px",
                      fill: "#191814",
                      paintOrder: "stroke",
                      stroke: "#FAF9F5",
                      strokeWidth: "3px",
                      strokeLinejoin: "round",
                      pointerEvents: "none",
                    }}
                  >
                    {shortLabel(c.zh)}
                  </text>
                )
              })}
        </g>
      </svg>

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
