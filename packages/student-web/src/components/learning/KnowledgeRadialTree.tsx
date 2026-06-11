"use client"

/**
 * 可折叠层级树 2D — 学科 → 子域 → 概念叶, 横向 (左根右叶)。
 * 点学科/子域展开或收起 (下钻); d3-hierarchy 算坐标, SVG 渲染 + 平滑过渡。
 * 配色严格走系统 Industrial Atelier (暖纸 + 珊瑚点亮 + 学科色)。
 *
 * 组件名保留 KnowledgeRadialTree (调用方 KnowledgeTreeView 不变)。
 */

import { useMemo, useState } from "react"
import { hierarchy, tree as d3tree, type HierarchyPointNode } from "d3-hierarchy"
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
}

// 树数据节点
interface TNode {
  id: string
  name: string
  kind: "subject" | "subdomain" | "leaf"
  lit?: boolean
  litCount?: number
  total?: number
  children?: TNode[]
}

export function KnowledgeRadialTree({ subject, litByNodeId, onNodeClick }: Props) {
  // 构建完整三层数据
  const fullData = useMemo<TNode>(() => {
    const groups = new Map<string, typeof subject.nodes>()
    for (const n of subject.nodes) {
      const sub = n.id.split(".")[1] || "_"
      if (!groups.has(sub)) groups.set(sub, [])
      groups.get(sub)!.push(n)
    }
    const subdomains: TNode[] = [...groups.entries()]
      .map(([sub, nodes]) => {
        const leaves: TNode[] = nodes.map((n) => ({
          id: n.id,
          name: n.name_zh,
          kind: "leaf" as const,
          lit: litByNodeId.has(n.id),
        }))
        const litCount = leaves.filter((l) => l.lit).length
        return {
          id: `${subject.id}.${sub}`,
          name: subdomainName(subject.id, sub),
          kind: "subdomain" as const,
          litCount,
          total: leaves.length,
          children: leaves,
        }
      })
      .sort((a, b) => (b.litCount || 0) - (a.litCount || 0) || (b.total || 0) - (a.total || 0))
    return { id: subject.id, name: subject.name_zh, kind: "subject", children: subdomains }
  }, [subject, litByNodeId])

  // 展开状态: 默认展开根 + 有点亮的子域
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>([subject.id])
    for (const sd of fullData.children || []) if ((sd.litCount || 0) > 0) s.add(sd.id)
    return s
  })

  // 按展开状态裁剪 children → d3 布局
  const { nodes, links, width, height } = useMemo(() => {
    const prune = (n: TNode): TNode => {
      if (n.kind === "leaf" || !expanded.has(n.id)) {
        return { ...n, children: undefined }
      }
      return { ...n, children: (n.children || []).map(prune) }
    }
    const root = hierarchy(prune(fullData))
    // 行高随叶子数; 横向树
    const leafCount = root.leaves().length
    const H = Math.max(leafCount * 26 + 40, 200)
    const W = 760
    d3tree<TNode>().size([H - 40, W - 260])(root as never)
    const ns = (root.descendants() as HierarchyPointNode<TNode>[])
    const ls = (root.links() as { source: HierarchyPointNode<TNode>; target: HierarchyPointNode<TNode> }[])
    return { nodes: ns, links: ls, width: W, height: H }
  }, [fullData, expanded])

  const color = subject.color || "#888"

  function toggle(id: string, kind: TNode["kind"]) {
    if (kind === "leaf") return
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // d3 横向树: node.x=纵向, node.y=横向; 偏移 20/130
  const OX = 130
  const OY = 20

  return (
    <div
      style={{
        width: "100%", overflow: "auto", borderRadius: 16,
        border: "1px solid var(--border)", background: "var(--paper)", padding: 16,
      }}
    >
      <svg width={width} height={height} style={{ maxWidth: "100%", minWidth: width }}>
        {/* 连线 */}
        {links.map((l, i) => {
          const litLink = l.target.data.kind === "leaf"
            ? l.target.data.lit
            : (l.target.data.litCount || 0) > 0
          const x1 = l.source.y + OX, y1 = l.source.x + OY
          const x2 = l.target.y + OX, y2 = l.target.x + OY
          const mx = (x1 + x2) / 2
          return (
            <path
              key={i}
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none"
              stroke={litLink ? color : "var(--border-2)"}
              strokeWidth={litLink ? 1.6 : 1}
              opacity={litLink ? 0.7 : 0.45}
            />
          )
        })}
        {/* 节点 */}
        {nodes.map((n, i) => {
          const d = n.data
          const x = n.y + OX, y = n.x + OY
          const isLeaf = d.kind === "leaf"
          const isSubject = d.kind === "subject"
          const lit = isLeaf ? d.lit : (d.litCount || 0) > 0
          const canExpand = !isLeaf && (d.children?.length || 0) > 0
          const open = expanded.has(d.id)
          const r = isSubject ? 9 : isLeaf ? (d.lit ? 5.5 : 3.5) : 6.5
          return (
            <g key={d.id + i} transform={`translate(${x},${y})`} style={{ cursor: isLeaf ? (d.lit ? "pointer" : "default") : "pointer" }}
               onClick={() => { if (isLeaf) { if (d.lit && onNodeClick) onNodeClick(d.id) } else toggle(d.id, d.kind) }}>
              <circle
                r={r}
                fill={isLeaf ? (d.lit ? color : "var(--card)") : (lit ? color : "var(--card)")}
                stroke={isLeaf ? (d.lit ? "#fff" : "var(--border-2)") : color}
                strokeWidth={isLeaf ? (d.lit ? 1 : 1) : 1.6}
              />
              {/* 折叠指示 (子域/学科未展开且有 children) */}
              {canExpand && !open && (
                <text x={0} y={3.5} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: lit ? "#fff" : color, pointerEvents: "none" }}>+</text>
              )}
              {/* 文字标签 */}
              <text
                x={isSubject ? -14 : r + 6}
                y={isSubject ? 4 : isLeaf ? 3.5 : 3.5}
                textAnchor={isSubject ? "end" : "start"}
                style={{
                  fontSize: isSubject ? 13.5 : isLeaf ? 12 : 12.5,
                  fontWeight: isSubject || (!isLeaf) ? 600 : (d.lit ? 500 : 400),
                  fill: isLeaf ? (d.lit ? "var(--ink)" : "var(--sub-2)") : "var(--ink-2)",
                  pointerEvents: "none",
                }}
              >
                {d.name}
                {!isLeaf && !isSubject && (
                  <tspan dx={6} style={{ fontSize: 10.5, fill: "var(--sub)", fontWeight: 400 }}>
                    {d.litCount}/{d.total}
                  </tspan>
                )}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
