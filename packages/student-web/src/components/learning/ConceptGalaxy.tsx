"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import type { GalaxyPayload, GradeBand } from "@/lib/galaxy/types"
import { myProjects } from "@/lib/api"
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

const BANDS_2D = ["university", "high", "middle", "elementary"] as const

function shortLabel(zh: string): string {
  const stripped = zh.replace(/（[^）]*）|\([^)]*\)/g, "")
  return stripped.length > 7 ? stripped.slice(0, 6) + "…" : stripped
}

// 2D 平面视图 (svg, 暖纸配色) — 与 3D 共用同一份 highlight/选中状态
function Svg2D({ payload, highlightSet, dimOthers, filterMode, litByConcept, selId, onSelect }: {
  payload: GalaxyPayload
  highlightSet: Set<string>
  dimOthers: boolean
  filterMode: "dim" | "hide"
  litByConcept: Set<string>
  selId: string | null
  onSelect: (id: string | null) => void
}) {
  const L = payload.layout
  const byId = useMemo(
    () => Object.fromEntries(payload.concepts.map((c) => [c.id, c] as const)),
    [payload.concepts],
  )
  const hide = dimOthers && filterMode === "hide"
  return (
    <svg
      className={styles.galaxy}
      viewBox={`0 0 ${L.VW} ${L.VH}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        {BANDS_2D.map((b) => {
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
      <g>
        {payload.edges.map(([a, b], i) => {
          const pa = byId[a], pb = byId[b]
          if (!pa || !pb) return null
          const hot = highlightSet.has(a) && highlightSet.has(b)
          if (hide && !hot) return null
          return (
            <line
              key={i}
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke={hot ? "#D97757" : "#9D978A"}
              strokeOpacity={hot ? 0.45 : dimOthers ? 0.04 : 0.1}
            />
          )
        })}
      </g>
      <g>
        {payload.concepts.map((c) => {
          const on = highlightSet.has(c.id)
          if (hide && !on) return null
          const col = payload.subj_color[c.subj] || "#888"
          const r = 3 + Math.min(5, (c.p.length - 1) * 1.5)
          const opacity = dimOthers ? (on ? 1 : 0.12) : litByConcept.has(c.id) ? 1 : 0.85
          const rr = on && dimOthers ? r + 1.4 : r
          return (
            <circle
              key={c.id}
              cx={c.x} cy={c.y} r={rr}
              fill={col}
              opacity={opacity}
              stroke={selId === c.id ? "#191814" : "none"}
              strokeWidth={selId === c.id ? 1.5 : 0}
              style={{ cursor: "pointer", transition: "opacity .3s" }}
              onClick={() => onSelect(c.id)}
            />
          )
        })}
      </g>
      <g>
        {dimOthers &&
          payload.concepts
            .filter((c) => highlightSet.has(c.id) && c.p.length >= 2)
            .map((c) => {
              const r = 3 + Math.min(5, (c.p.length - 1) * 1.5)
              return (
                <text
                  key={c.id}
                  x={c.x} y={c.y - (r + 4)}
                  textAnchor="middle"
                  style={{
                    fontSize: "9.5px", fill: "#191814", paintOrder: "stroke",
                    stroke: "#FAF9F5", strokeWidth: "3px", strokeLinejoin: "round", pointerEvents: "none",
                  }}
                >
                  {shortLabel(c.zh)}
                </text>
              )
            })}
      </g>
    </svg>
  )
}

export function ConceptGalaxy({ payload, litByConcept, initialProject, loggedIn }: Props) {
  const t = useT()
  const router = useRouter()
  const byId = useMemo(
    () => Object.fromEntries(payload.concepts.map((c) => [c.id, c] as const)),
    [payload.concepts],
  )

  const [activeProj, setActiveProj] = useState<string | null>(initialProject ?? null)
  const [activeSubj, setActiveSubj] = useState<string | null>(null)
  const [selId, setSelId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d")
  const [filterMode, setFilterMode] = useState<"dim" | "hide">("dim")
  const [spread, setSpread] = useState(1.25)
  const [activeBand, setActiveBand] = useState<GradeBand | null>(null)
  // 我已加入的项目 slugs (决定课节点击直接进学习页还是弹加入引导)
  const [pulledSlugs, setPulledSlugs] = useState<Set<string>>(new Set())
  const [pullModal, setPullModal] = useState<{ slug: string; mid: string } | null>(null)
  const [pulling, setPulling] = useState(false)
  const [pullError, setPullError] = useState(false)

  useEffect(() => {
    if (!loggedIn) { setPulledSlugs(new Set()); return }
    let cancelled = false
    myProjects.list()
      .then((mine) => { if (!cancelled) setPulledSlugs(new Set(mine.map((p) => p.slug))) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [loggedIn])

  // 课节点击: 已加入直接进学习页, 否则弹加入引导
  function goKnode(slug: string, mid: string) {
    if (loggedIn && pulledSlugs.has(slug)) {
      router.push(`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(mid)}`)
    } else {
      setPullError(false)
      setPullModal({ slug, mid })
    }
  }

  async function confirmPull() {
    if (!pullModal) return
    if (!loggedIn) { router.push("/login"); return }
    setPulling(true)
    setPullError(false)
    try {
      await myProjects.pull(pullModal.slug)
      setPulledSlugs((prev) => new Set([...prev, pullModal.slug]))
      router.push(`/learn/${encodeURIComponent(pullModal.slug)}/${encodeURIComponent(pullModal.mid)}`)
    } catch {
      setPullError(true)
    } finally {
      setPulling(false)
    }
  }

  // 深链 ?project= 变化时同步预选 (galaxy→galaxy 客户端导航复用同一组件实例)
  useEffect(() => {
    if (initialProject) {
      setActiveProj(initialProject)
      setActiveSubj(null)
    }
  }, [initialProject])

  // 当前应高亮的概念集合: (学科筛选 > 项目选中) ∩ 学段筛选; 无筛选时 = 我学过
  const highlightSet = useMemo(() => {
    let base: Set<string> | null = null
    if (activeSubj) base = new Set(payload.concepts.filter((c) => c.subj === activeSubj).map((c) => c.id))
    else if (activeProj) base = new Set(payload.proj_concepts[activeProj] || [])
    if (activeBand) {
      const band = new Set(payload.concepts.filter((c) => c.g === activeBand).map((c) => c.id))
      if (!base) return band
      return new Set([...base].filter((id) => band.has(id)))
    }
    return base ?? litByConcept
  }, [activeSubj, activeProj, activeBand, payload, litByConcept])

  const dimOthers = !!activeProj || !!activeSubj || !!activeBand

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
        {viewMode === "3d" ? (
          <Canvas3D
            payload={payload}
            highlightSet={highlightSet}
            dimOthers={dimOthers}
            filterMode={filterMode}
            spread={spread}
            litByConcept={litByConcept}
            selId={selId}
            onSelect={setSelId}
          />
        ) : (
          <Svg2D
            payload={payload}
            highlightSet={highlightSet}
            dimOthers={dimOthers}
            filterMode={filterMode}
            litByConcept={litByConcept}
            selId={selId}
            onSelect={setSelId}
          />
        )}
      </div>

      {/* 视图控制条 (右下): 3D/2D 切换 + 散开滑杆 + 筛选模式 */}
      <div className={styles.viewbar}>
        {dimOthers && (
          <div className={styles.vgroup} role="radiogroup" aria-label={t("galaxy.view.filter_label")}>
            <button
              className={styles.vbtn}
              aria-pressed={filterMode === "dim"}
              onClick={() => setFilterMode("dim")}
            >
              {t("galaxy.view.filter_dim")}
            </button>
            <button
              className={styles.vbtn}
              aria-pressed={filterMode === "hide"}
              onClick={() => setFilterMode("hide")}
            >
              {t("galaxy.view.filter_hide")}
            </button>
          </div>
        )}
        {viewMode === "3d" && (
          <label className={styles.vslider}>
            <span>{t("galaxy.view.spread")}</span>
            <input
              type="range"
              min={0.8}
              max={2.2}
              step={0.05}
              value={spread}
              onChange={(e) => setSpread(Number(e.target.value))}
            />
          </label>
        )}
        <div className={styles.vgroup} role="radiogroup" aria-label="view mode">
          <button className={styles.vbtn} aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}>3D</button>
          <button className={styles.vbtn} aria-pressed={viewMode === "2d"} onClick={() => setViewMode("2d")}>2D</button>
        </div>
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

        {/* 学科图例 + 学段筛选 */}
        <div className={styles.legend}>
          <div className={styles.cap}>{t("galaxy.page.band_cap")}</div>
          <div className={styles.bandrow} role="radiogroup" aria-label={t("galaxy.page.band_cap")}>
            {(["elementary", "middle", "high", "university"] as GradeBand[]).map((b) => (
              <button
                key={b}
                className={styles.bandbtn}
                aria-pressed={activeBand === b}
                onClick={() => setActiveBand(activeBand === b ? null : b)}
              >
                {t(`galaxy.grade.${b}`)}
              </button>
            ))}
          </div>
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
              // 学科色为浅色系, 徽章文字向墨色混合加深保证可读
              background: (payload.subj_color[sel.subj] || "#888") + "38",
              color: `color-mix(in srgb, ${payload.subj_color[sel.subj] || "#888"} 45%, #191814)`,
              border: `1px solid ${(payload.subj_color[sel.subj] || "#888")}`,
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
                return (
                  <button
                    key={s}
                    className={styles.pchip}
                    onClick={() => router.push(`/library/${encodeURIComponent(s)}`)}
                    title={t("galaxy.card.goto_project")}
                  >
                    {pj ? pj.zh : s}
                  </button>
                )
              })}
            </div>
          </div>
          {(() => {
            // covers entry: "slug:M04" 或 "__math__:slug:M06" → (slug, mid) 对, 点击进对应课节
            const seen = new Set<string>()
            const mods: { slug: string; mid: string }[] = []
            for (const entry of payload.covers[sel.id] || []) {
              const mid = entry.slice(entry.lastIndexOf(":") + 1)
              const pj = payload.projects.find((p) => entry.startsWith(p.slug + ":") || entry.includes(":" + p.slug + ":"))
              if (!pj) continue
              const key = pj.slug + ":" + mid
              if (seen.has(key)) continue
              seen.add(key)
              mods.push({ slug: pj.slug, mid })
              if (mods.length >= 12) break
            }
            return mods.length ? (
              <div className={styles.kv}>
                <b>{t("galaxy.card.modules")}</b>
                <div className={styles.mods}>
                  {mods.map(({ slug, mid }) => {
                    const pj = payload.projects.find((p) => p.slug === slug)
                    return (
                      <button
                        key={slug + mid}
                        className={styles.mc}
                        onClick={() => goKnode(slug, mid)}
                        title={`${pj?.zh || slug} · ${mid}`}
                      >
                        {mid}
                      </button>
                    )
                  })}
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

      {/* 加入项目引导弹窗 (课节点击但未加入) */}
      {pullModal && (() => {
        const pj = payload.projects.find((p) => p.slug === pullModal.slug)
        return (
          <div className={styles.pmask} onClick={() => !pulling && setPullModal(null)}>
            <div className={styles.pmodal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h4>{t("galaxy.pull.title")}</h4>
              <p>{t("galaxy.pull.desc", { name: pj?.zh || pullModal.slug })}</p>
              {pullError && <p className={styles.perr}>{t("galaxy.pull.failed")}</p>}
              <div className={styles.pbtns}>
                <button className={styles.pgo} onClick={confirmPull} disabled={pulling}>
                  {pulling ? t("galaxy.pull.pulling") : loggedIn ? t("galaxy.pull.go") : t("galaxy.pull.login")}
                </button>
                <button className={styles.pcancel} onClick={() => setPullModal(null)} disabled={pulling}>
                  {t("galaxy.pull.cancel")}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {!loggedIn && <span className={styles.srOnly}>{t("galaxy.page.login_cta")}</span>}
    </>
  )
}
