"use client"

/**
 * 径向放射树 2D — 单学科: 中心学科 → 子域 (中圈) → 概念叶 (外圈), 辐条连线。
 * 点亮概念叶填学科色, 未点亮灰。hover 显示节点名。
 */

import { useMemo, useState } from "react"
import type { PlatformSubject } from "@/lib/api"
import { subdomainName } from "@/lib/subdomain-names"

interface LitInfo {
  sources: string[]
  detail: string
}

interface Props {
  subject: PlatformSubject
  litByNodeId: Map<string, LitInfo>
  onNodeClick?: (knodeId: string, slug?: string) => void
  size?: number
}

export function KnowledgeRadialTree({ subject, litByNodeId, onNodeClick, size = 640 }: Props) {
  const [hover, setHover] = useState<{ name: string; x: number; y: number; lit: boolean } | null>(null)

  const layout = useMemo(() => {
    // 按子域分组
    const groups = new Map<string, typeof subject.nodes>()
    for (const n of subject.nodes) {
      const sub = n.id.split(".")[1] || "_"
      if (!groups.has(sub)) groups.set(sub, [])
      groups.get(sub)!.push(n)
    }
    const subs = [...groups.entries()]
    const cx = size / 2
    const cy = size / 2
    const R_SUB = size * 0.20 // 子域圈半径
    const R_LEAF = size * 0.40 // 概念叶圈半径

    const subNodes: { x: number; y: number; name: string; ang: number; span: number }[] = []
    const leaves: { x: number; y: number; id: string; name: string; lit: boolean; sx: number; sy: number }[] = []

    const nSub = subs.length
    subs.forEach(([sub, nodes], si) => {
      const ang = (si / nSub) * Math.PI * 2 - Math.PI / 2
      const span = (Math.PI * 2) / nSub
      const sx = cx + Math.cos(ang) * R_SUB
      const sy = cy + Math.sin(ang) * R_SUB
      subNodes.push({ x: sx, y: sy, name: subdomainName(subject.id, sub), ang, span })
      // 概念叶在该子域角度附近扇区散开
      const k = nodes.length
      nodes.forEach((n, li) => {
        const spread = span * 0.8
        const a = ang - spread / 2 + (k > 1 ? (li / (k - 1)) * spread : 0)
        const r = R_LEAF + (li % 2) * (size * 0.045) // 双层错开防重叠
        leaves.push({
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          id: n.id,
          name: n.name_zh,
          lit: litByNodeId.has(n.id),
          sx, sy,
        })
      })
    })
    return { cx, cy, subNodes, leaves }
  }, [subject, litByNodeId, size])

  const color = subject.color || "#888"

  return (
    <div
      style={{
        position: "relative", width: "100%", overflow: "auto",
        borderRadius: 16, border: "1px solid var(--border)", background: "var(--card)",
        display: "grid", placeItems: "center", padding: 8,
      }}
    >
      <svg width={size} height={size} style={{ maxWidth: "100%", height: "auto" }}>
        {/* 学科→子域 辐条 */}
        {layout.subNodes.map((s, i) => (
          <line key={"ss" + i} x1={layout.cx} y1={layout.cy} x2={s.x} y2={s.y}
            stroke="var(--border-2)" strokeWidth={1.5} />
        ))}
        {/* 子域→概念叶 连线 */}
        {layout.leaves.map((l, i) => (
          <line key={"sl" + i} x1={l.sx} y1={l.sy} x2={l.x} y2={l.y}
            stroke={l.lit ? color : "var(--hairline)"} strokeWidth={l.lit ? 1.2 : 0.6}
            opacity={l.lit ? 0.7 : 0.4} />
        ))}
        {/* 概念叶 */}
        {layout.leaves.map((l, i) => (
          <circle key={"lf" + i} cx={l.x} cy={l.y} r={l.lit ? 6 : 3.2}
            fill={l.lit ? color : "var(--border-2)"}
            stroke={l.lit ? "#fff" : "none"} strokeWidth={l.lit ? 1 : 0}
            style={{ cursor: l.lit ? "pointer" : "default" }}
            onMouseEnter={() => setHover({ name: l.name, x: l.x, y: l.y, lit: l.lit })}
            onMouseLeave={() => setHover(null)}
            onClick={() => { if (l.lit && onNodeClick) onNodeClick(l.id) }} />
        ))}
        {/* 子域节点 + 名 */}
        {layout.subNodes.map((s, i) => (
          <g key={"sg" + i}>
            <circle cx={s.x} cy={s.y} r={5} fill={color} opacity={0.85} />
            <text x={s.x} y={s.y - 9} textAnchor="middle"
              style={{ fontSize: 11, fontWeight: 600, fill: "var(--ink-2)" }}>{s.name}</text>
          </g>
        ))}
        {/* 中心学科 */}
        <circle cx={layout.cx} cy={layout.cy} r={16} fill={color} />
        <text x={layout.cx} y={layout.cy + 4} textAnchor="middle"
          style={{ fontSize: 12, fontWeight: 700, fill: "#fff" }}>{subject.name_zh}</text>
      </svg>
      {hover && (
        <div style={{
          position: "absolute", left: `calc(${(hover.x / size) * 100}% )`, top: `calc(${(hover.y / size) * 100}% - 28px)`,
          transform: "translateX(-50%)", background: "var(--ink)", color: "#fff",
          fontSize: 11.5, padding: "3px 8px", borderRadius: 6, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
        }}>
          {hover.name}{hover.lit ? "" : " (未学)"}
        </div>
      )}
    </div>
  )
}
