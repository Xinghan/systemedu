"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { AggregatedTheory } from "@/lib/types/api"

interface FoundationGraphProps {
  theories: AggregatedTheory[]
  subjectColors: Record<string, string>
  onNodeClick: (t: AggregatedTheory) => void
}

interface Node {
  id: string
  theory: AggregatedTheory
  x: number
  y: number
  vx: number
  vy: number
}

interface Edge {
  a: string
  b: string
  kind: "subproject" | "tag"
  weight: number
}

function tagSharedDepth(a: string[], b: string[]): number {
  let best = 0
  for (const ta of a) {
    for (const tb of b) {
      if (ta === tb) return ta.split("/").length
      const pa = ta.split("/")
      const pb = tb.split("/")
      let d = 0
      while (d < pa.length && d < pb.length && pa[d] === pb[d]) d++
      if (d > best) best = d
    }
  }
  return best
}

const W = 880
const H = 520

export function FoundationGraph({ theories, subjectColors, onNodeClick }: FoundationGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [tick, setTick] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)

  // Build nodes + edges
  const nodesRef = useRef<Node[]>([])
  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = []
    const idOf = (th: AggregatedTheory) => `${th.theory_id}-${th.knode_id}`

    // 1) Sub-project co-occurrence: full mesh for small groups, hub+chain for large
    const bySub: Record<string, { id: string; th: AggregatedTheory }[]> = {}
    for (const th of theories) {
      const k = th.sub_project_id || `stage-${th.stage_idx}`
      if (!bySub[k]) bySub[k] = []
      bySub[k].push({ id: idOf(th), th })
    }
    for (const group of Object.values(bySub)) {
      if (group.length <= 6) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            list.push({ a: group[i].id, b: group[j].id, kind: "subproject", weight: 1 })
          }
        }
      } else {
        // Chain + spoke (first as hub) to avoid dense clumping
        const hub = group[0]
        for (let i = 1; i < group.length; i++) {
          list.push({ a: hub.id, b: group[i].id, kind: "subproject", weight: 1 })
          if (i > 1) {
            list.push({ a: group[i - 1].id, b: group[i].id, kind: "subproject", weight: 1 })
          }
        }
      }
    }

    // 2) Tag intersection across sub_projects (don't duplicate same-sub edges)
    const sameSubSet = new Set<string>()
    for (const e of list) sameSubSet.add(e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`)
    const items = theories.map((th) => ({ id: idOf(th), th }))
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j]
        const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
        if (sameSubSet.has(key)) continue
        const depth = tagSharedDepth(a.th.tags || [], b.th.tags || [])
        if (depth >= 2) list.push({ a: a.id, b: b.id, kind: "tag", weight: depth })
      }
    }
    return list
  }, [theories])

  // Initialise nodes when theories change
  useEffect(() => {
    const map: Record<string, Node> = {}
    const existing: Record<string, Node> = {}
    for (const n of nodesRef.current) existing[n.id] = n
    for (const th of theories) {
      const id = `${th.theory_id}-${th.knode_id}`
      if (existing[id]) {
        existing[id].theory = th
        map[id] = existing[id]
      } else {
        map[id] = {
          id,
          theory: th,
          x: W / 2 + (Math.random() - 0.5) * 60,
          y: H / 2 + (Math.random() - 0.5) * 60,
          vx: 0,
          vy: 0,
        }
      }
    }
    nodesRef.current = Object.values(map)
  }, [theories])

  // Force simulation
  useEffect(() => {
    let raf = 0
    let steps = 0
    const MAX_STEPS = 380
    const step = () => {
      const nodes = nodesRef.current
      const idIndex: Record<string, Node> = {}
      for (const n of nodes) idIndex[n.id] = n

      // Repulsion between all nodes
      const K = 1800
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          let dx = a.x - b.x, dy = a.y - b.y
          const d2 = dx * dx + dy * dy + 0.01
          const d = Math.sqrt(d2)
          const f = K / d2
          const fx = (dx / d) * f
          const fy = (dy / d) * f
          a.vx += fx; a.vy += fy
          b.vx -= fx; b.vy -= fy
        }
      }

      // Spring on edges
      for (const e of edges) {
        const a = idIndex[e.a], b = idIndex[e.b]
        if (!a || !b) continue
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01
        const target = e.kind === "subproject" ? 90 : 150
        const k = e.kind === "subproject" ? 0.025 : 0.008 * e.weight
        const f = (d - target) * k
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        a.vx += fx; a.vy += fy
        b.vx -= fx; b.vy -= fy
      }

      // Centering + damping + integrate
      const cx = W / 2, cy = H / 2
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.0025
        n.vy += (cy - n.y) * 0.0025
        n.vx *= 0.82
        n.vy *= 0.82
        n.x += Math.max(-6, Math.min(6, n.vx))
        n.y += Math.max(-6, Math.min(6, n.vy))
        n.x = Math.max(24, Math.min(W - 24, n.x))
        n.y = Math.max(24, Math.min(H - 24, n.y))
      }

      steps += 1
      setTick((x) => x + 1)
      if (steps < MAX_STEPS) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [edges, theories])

  const nodes = nodesRef.current

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[520px]"
        data-tick={tick}
      >
        {edges.map((e, i) => {
          const a = nodes.find((n) => n.id === e.a)
          const b = nodes.find((n) => n.id === e.b)
          if (!a || !b) return null
          const isHighlight = hovered === e.a || hovered === e.b
          const isSub = e.kind === "subproject"
          const baseOpacity = isSub ? 0.5 : 0.15 + 0.15 * Math.min(e.weight, 3)
          const baseWidth = isSub ? 1.4 : 0.6 + 0.3 * Math.min(e.weight, 3)
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={isSub ? "#a78bfa" : "#94a3b8"}
              strokeOpacity={isHighlight ? 0.9 : baseOpacity}
              strokeWidth={isHighlight ? baseWidth + 0.6 : baseWidth}
              strokeDasharray={isSub ? undefined : "3 3"}
            />
          )
        })}
        {nodes.map((n) => {
          // Prefer tag top-level; fallback to legacy subject
          const firstTag = (n.theory.tags || [])[0] || ""
          const topLevel = firstTag.split("/")[0] || n.theory.subject || "other"
          const color = subjectColors[topLevel] || subjectColors[n.theory.subject || "other"] || "#6b7280"
          const isHovered = hovered === n.id
          const r = isHovered ? 11 : 8
          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onNodeClick(n.theory)}
            >
              <circle r={r} fill={color} opacity={0.9} />
              <circle r={r} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={isHovered ? 8 : 4} />
              {isHovered && (
                <g>
                  <rect
                    x={-110} y={r + 4} width={220} height={52} rx={6}
                    fill="#ffffff" stroke={color} strokeOpacity={0.35}
                  />
                  <text x={0} y={r + 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="#111827">
                    {n.theory.title.slice(0, 22)}
                  </text>
                  <text x={0} y={r + 31} textAnchor="middle" fontSize="9" fill="#6b7280">
                    {(n.theory.sub_project_title || n.theory.knode_title).slice(0, 28)}
                  </text>
                  <text x={0} y={r + 45} textAnchor="middle" fontSize="8" fill="#9ca3af">
                    {(n.theory.tags || []).slice(0, 2).join(" · ").slice(0, 40)}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
      <div className="px-4 py-2 border-t border-border/50 flex items-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-[2px] rounded" style={{ background: "#a78bfa" }} />
          <span>同子项目</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-[2px] rounded" style={{ background: "#94a3b8", borderTop: "1px dashed" }} />
          <span>同 tag（粗细 = 共享层级深度）</span>
        </div>
        <span className="ml-auto">{nodes.length} 个理论 · {edges.length} 条连边</span>
      </div>
    </div>
  )
}
