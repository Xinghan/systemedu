"use client"

import { useMemo } from "react"
import type { GalaxyPayload, GradeBand } from "@/lib/galaxy/types"
import styles from "@/app/(home)/galaxy/galaxy.module.css"

interface Props {
  payload: GalaxyPayload
  litByConcept: Set<string>
  initialProject?: string
  loggedIn: boolean
}

const NS = "http://www.w3.org/2000/svg"
const BANDS: GradeBand[] = ["university", "high", "middle", "elementary"]

export function ConceptGalaxy({ payload, litByConcept }: Props) {
  const L = payload.layout
  const byId = useMemo(
    () => Object.fromEntries(payload.concepts.map((c) => [c.id, c])),
    [payload.concepts],
  )

  return (
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
          return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#8ea3c8" strokeOpacity={0.05} />
        })}
      </g>
      {/* 节点 */}
      <g>
        {payload.concepts.map((c) => {
          const col = payload.subj_color[c.subj] || "#888"
          const r = 3 + Math.min(5, (c.p.length - 1) * 1.5)
          const lit = litByConcept.has(c.id)
          return (
            <circle
              key={c.id}
              cx={c.x}
              cy={c.y}
              r={r}
              fill={col}
              opacity={lit ? 1 : 0.85}
              style={{ cursor: "pointer" }}
            />
          )
        })}
      </g>
    </svg>
  )
}
