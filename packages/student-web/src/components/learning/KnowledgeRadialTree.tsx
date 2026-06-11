"use client"

/**
 * 可折叠层级树 2D — 学科 → 子域 → 概念叶, 横向 (左根右叶)。
 * 点学科/子域展开或收起 (下钻); d3-hierarchy 算坐标, SVG 渲染 + 平滑过渡。
 * 配色严格走系统 Industrial Atelier (暖纸 + 珊瑚点亮 + 学科色)。
 *
 * 组件名保留 KnowledgeRadialTree (调用方 KnowledgeTreeView 不变)。
 */

import { useEffect, useMemo, useState } from "react"
import { hierarchy, tree as d3tree, type HierarchyPointNode } from "d3-hierarchy"
import type { PlatformSubject } from "@/lib/api"
import { subdomainName } from "@/lib/subdomain-names"

interface LitInfo {
  sources: string[]
  detail: string
}

type GrownChild = { node_id: string; name_zh: string; depth: number; lit: boolean }

interface Props {
  subject: PlatformSubject
  litByNodeId: Map<string, LitInfo>
  grownByParent?: Map<string, GrownChild[]>
  onNodeClick?: (knodeId: string, slug?: string) => void
}

// 树数据节点
interface TNode {
  id: string
  name: string
  kind: "subject" | "subdomain" | "leaf" | "grown"
  lit?: boolean
  litCount?: number
  total?: number
  children?: TNode[]
}

export function KnowledgeRadialTree({ subject, litByNodeId, grownByParent, onNodeClick }: Props) {
  // 构建完整数据 (三层 + 生长节点任意深度)
  const fullData = useMemo<TNode>(() => {
    // 递归把某节点的生长子节点建成 TNode children
    const buildGrown = (parentId: string): TNode[] => {
      const kids = grownByParent?.get(parentId) || []
      return kids.map((c) => ({
        id: c.node_id,
        name: c.name_zh,
        kind: "grown" as const,
        lit: c.lit,
        children: buildGrown(c.node_id),
      }))
    }
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
          children: buildGrown(n.id),  // spec 039: 概念叶下挂生长节点
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
  }, [subject, litByNodeId, grownByParent])

  // 展开状态: 默认展开根 + 有点亮的子域
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>([subject.id])
    for (const sd of fullData.children || []) if ((sd.litCount || 0) > 0) s.add(sd.id)
    return s
  })

  // 数据异步到达后补充展开 (初始 state 算时 litByNodeId 可能为空)。幂等, 只增不减。
  const litSubKey = (fullData.children || [])
    .filter((sd) => (sd.litCount || 0) > 0).map((sd) => sd.id).join(",")
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      let changed = false
      if (!next.has(subject.id)) { next.add(subject.id); changed = true }
      for (const id of litSubKey ? litSubKey.split(",") : []) {
        if (!next.has(id)) { next.add(id); changed = true }
      }
      return changed ? next : prev
    })
  }, [subject.id, litSubKey])

  // 按展开状态裁剪 children → d3 布局
  const { nodes, links, width, height } = useMemo(() => {
    const prune = (n: TNode): TNode => {
      // 无 children 的节点 (叶/无生长) 直接返回; 有 children 但未展开 → 折叠 (砍 children)
      const kids = n.children || []
      if (!kids.length || !expanded.has(n.id)) {
        return { ...n, children: undefined }
      }
      return { ...n, children: kids.map(prune) }
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

  // 哪些节点有子 (可展开) — 从完整 fullData 收集 (prune 后的 children 不可靠)
  const hasKids = useMemo(() => {
    const s = new Set<string>()
    const walk = (n: TNode) => {
      if (n.children && n.children.length) { s.add(n.id); n.children.forEach(walk) }
    }
    walk(fullData)
    return s
  }, [fullData])

  function toggle(id: string) {
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
          const td = l.target.data
          const litLink = (td.kind === "leaf" || td.kind === "grown")
            ? td.lit
            : (td.litCount || 0) > 0
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
          const isSubject = d.kind === "subject"
          const isSub = d.kind === "subdomain"
          const isGrown = d.kind === "grown"
          const isLeafLike = d.kind === "leaf" || isGrown
          const lit = isLeafLike ? !!d.lit : (d.litCount || 0) > 0
          const canExpand = hasKids.has(d.id)
          const open = expanded.has(d.id)
          const r = isSubject ? 9 : isSub ? 6.5 : isGrown ? 4 : (d.lit ? 5.5 : 3.5)
          return (
            <g key={d.id + i} transform={`translate(${x},${y})`}
               style={{ cursor: canExpand || (isLeafLike && d.lit) ? "pointer" : "default" }}
               onClick={() => {
                 if (canExpand) toggle(d.id)
                 else if (isLeafLike && d.lit && onNodeClick) onNodeClick(d.id)
               }}>
              <circle
                r={r}
                fill={lit ? color : "var(--card)"}
                stroke={isGrown ? (lit ? color : "var(--border-2)") : (isLeafLike ? (d.lit ? "#fff" : "var(--border-2)") : color)}
                strokeWidth={isGrown ? 1.2 : (isLeafLike ? 1 : 1.6)}
                strokeDasharray={isGrown ? "2 2" : undefined}  /* 虚线 = 个人生长 */
              />
              {canExpand && !open && (
                <text x={0} y={3.5} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: lit ? "#fff" : color, pointerEvents: "none" }}>+</text>
              )}
              <text
                x={isSubject ? -14 : r + 6}
                y={isSubject ? 4 : 3.5}
                textAnchor={isSubject ? "end" : "start"}
                style={{
                  fontSize: isSubject ? 13.5 : isLeafLike ? 12 : 12.5,
                  fontWeight: isSubject || isSub ? 600 : (d.lit ? 500 : 400),
                  fontStyle: isGrown ? "italic" : "normal",
                  fill: isLeafLike ? (d.lit ? "var(--ink)" : "var(--sub-2)") : "var(--ink-2)",
                  pointerEvents: "none",
                }}
              >
                {d.name}
                {isSub && (
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
