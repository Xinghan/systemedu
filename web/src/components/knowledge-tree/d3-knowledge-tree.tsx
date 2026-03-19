"use client"

import { useEffect, useRef, useMemo, useCallback, useState } from "react"
import * as d3 from "d3"
import type { MilestoneInfo, NodeProgress } from "@/lib/types/api"

interface D3KnowledgeTreeProps {
  milestones: MilestoneInfo[]
  progress: NodeProgress[]
  onNodeClick?: (nodeId: number) => void
  className?: string
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  globalId: number
  label: string
  summary: string
  difficulty: number
  xp: number
  minutes: number
  milestone: string
  milestoneIdx: number
  depth: number
  passed: boolean
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string
}

interface HoverInfo {
  node: GraphNode
  x: number
  y: number
}

interface MagnifierState {
  x: number  // SVG-space mouse x
  y: number  // SVG-space mouse y
  cx: number // screen x relative to container
  cy: number // screen y relative to container
}

const MILESTONE_PALETTE = [
  { fill: "#dbeafe", stroke: "#3b82f6", text: "#1d4ed8", bg: "#eff6ff" },
  { fill: "#dcfce7", stroke: "#22c55e", text: "#15803d", bg: "#f0fdf4" },
  { fill: "#fef9c3", stroke: "#eab308", text: "#a16207", bg: "#fefce8" },
  { fill: "#fce7f3", stroke: "#ec4899", text: "#be185d", bg: "#fdf2f8" },
  { fill: "#ede9fe", stroke: "#8b5cf6", text: "#6d28d9", bg: "#f5f3ff" },
  { fill: "#cffafe", stroke: "#06b6d4", text: "#0e7490", bg: "#ecfeff" },
  { fill: "#ffedd5", stroke: "#f97316", text: "#c2410c", bg: "#fff7ed" },
  { fill: "#ccfbf1", stroke: "#14b8a6", text: "#0f766e", bg: "#f0fdfa" },
  { fill: "#ffe4e6", stroke: "#e11d48", text: "#be123c", bg: "#fff1f2" },
  { fill: "#e0e7ff", stroke: "#6366f1", text: "#4338ca", bg: "#eef2ff" },
]

const CARD_W = 120
const CARD_H = 44
const X_SPACING = 160
const Y_SPACING = 62

// Magnifier parameters
const MAG_R = 90        // radius of the magnifier lens (px)
const MAG_ZOOM = 2.8   // zoom factor inside the lens

export function D3KnowledgeTree({ milestones, progress, onNodeClick, className }: D3KnowledgeTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [magnifier, setMagnifier] = useState<MagnifierState | null>(null)
  // Store current d3 zoom transform so magnifier knows the correct coordinate mapping
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)

  const progressMap = useMemo(() => new Map(progress.map((p) => [p.knode_id, p])), [progress])

  const { graphNodes, graphLinks } = useMemo(() => {
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []
    const depthMap = new Map<number, number>()

    let globalIdx = 0
    for (const ms of milestones) {
      for (const knode of ms.knodes) {
        const id = globalIdx++
        let depth = 0
        for (const preIdx of knode.prerequisite_indices) {
          depth = Math.max(depth, (depthMap.get(preIdx) ?? 0) + 1)
        }
        depthMap.set(id, depth)
      }
    }

    globalIdx = 0
    for (let msIdx = 0; msIdx < milestones.length; msIdx++) {
      const ms = milestones[msIdx]
      for (const knode of ms.knodes) {
        const id = globalIdx++
        const p = progressMap.get(id)
        nodes.push({
          id: `n${id}`,
          globalId: id,
          label: knode.title,
          summary: knode.summary,
          difficulty: knode.difficulty_level,
          xp: knode.xp_reward,
          minutes: knode.estimated_minutes,
          milestone: ms.title,
          milestoneIdx: msIdx,
          depth: depthMap.get(id) ?? 0,
          passed: p?.status === "passed",
        })

        for (const preIdx of knode.prerequisite_indices) {
          links.push({
            id: `e${preIdx}-${id}`,
            source: `n${preIdx}`,
            target: `n${id}`,
          })
        }
      }
    }

    return { graphNodes: nodes, graphLinks: links }
  }, [milestones, progressMap])

  const handleNodeClick = useCallback(
    (globalId: number) => { onNodeClick?.(globalId) },
    [onNodeClick],
  )

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || graphNodes.length === 0) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()
    svg.attr("width", width).attr("height", height)

    const g = svg.append("g").attr("class", "main-g")

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
        currentTransformRef.current = event.transform
      })
    svg.call(zoom)

    // Group by depth
    const depthBuckets = new Map<number, GraphNode[]>()
    for (const node of graphNodes) {
      if (!depthBuckets.has(node.depth)) depthBuckets.set(node.depth, [])
      depthBuckets.get(node.depth)!.push(node)
    }

    for (const [, bucket] of depthBuckets) {
      bucket.sort((a, b) => a.milestoneIdx - b.milestoneIdx || a.globalId - b.globalId)
      for (let i = 0; i < bucket.length; i++) {
        bucket[i].x = bucket[i].depth * X_SPACING + 60
        bucket[i].y = (i - (bucket.length - 1) / 2) * Y_SPACING
      }
    }

    // Center
    const allX = graphNodes.map((n) => n.x ?? 0)
    const allY = graphNodes.map((n) => n.y ?? 0)
    const gMinX = Math.min(...allX) - CARD_W / 2 - 20
    const gMaxX = Math.max(...allX) + CARD_W / 2 + 20
    const gMinY = Math.min(...allY) - CARD_H / 2 - 20
    const gMaxY = Math.max(...allY) + CARD_H / 2 + 20
    const gW = gMaxX - gMinX
    const gH = gMaxY - gMinY

    const scale = Math.min(width / gW, height / gH, 1)
    const tx = (width - gW * scale) / 2 - gMinX * scale
    const ty = (height - gH * scale) / 2 - gMinY * scale
    const initTransform = d3.zoomIdentity.translate(tx, ty).scale(scale)
    currentTransformRef.current = initTransform
    svg.call(zoom.transform, initTransform)

    // Defs
    const defs = svg.append("defs")

    // Arrow marker
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#cbd5e1")

    // Drop shadow filter
    const filter = defs.append("filter").attr("id", "card-shadow").attr("x", "-10%").attr("y", "-10%").attr("width", "130%").attr("height", "140%")
    filter.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 2).attr("flood-color", "#000").attr("flood-opacity", 0.08)

    // Magnifier lens clip path (static circle, translated by CSS/transform)
    defs.append("clipPath").attr("id", "mag-clip")
      .append("circle").attr("r", MAG_R)

    // Magnifier lens border filter
    const magFilter = defs.append("filter").attr("id", "mag-shadow").attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%")
    magFilter.append("feDropShadow").attr("dx", 0).attr("dy", 2).attr("stdDeviation", 6).attr("flood-color", "#000").attr("flood-opacity", 0.18)

    const nodeMap = new Map(graphNodes.map((n) => [n.id, n]))

    function renderGraph(target: d3.Selection<SVGGElement, unknown, null, undefined>) {
      // Links
      target.append("g").attr("class", "links")
        .selectAll("path")
        .data(graphLinks)
        .enter()
        .append("path")
        .attr("fill", "none")
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 1.5)
        .attr("marker-end", "url(#arrow)")
        .attr("d", (d) => {
          const src = nodeMap.get(typeof d.source === "string" ? d.source : (d.source as GraphNode).id)
          const tgt = nodeMap.get(typeof d.target === "string" ? d.target : (d.target as GraphNode).id)
          if (!src || !tgt) return ""
          const sx = (src.x ?? 0) + CARD_W / 2
          const sy = src.y ?? 0
          const tx2 = (tgt.x ?? 0) - CARD_W / 2
          const ty2 = tgt.y ?? 0
          const mx = (sx + tx2) / 2
          return `M${sx},${sy} C${mx},${sy} ${mx},${ty2} ${tx2},${ty2}`
        })

      // Node groups
      const nodeGroups = target.append("g").attr("class", "nodes")
        .selectAll("g")
        .data(graphNodes)
        .enter()
        .append("g")
        .attr("transform", (d) => `translate(${(d.x ?? 0) - CARD_W / 2},${(d.y ?? 0) - CARD_H / 2})`)

      // Card background
      nodeGroups
        .append("rect")
        .attr("class", "card-bg")
        .attr("width", CARD_W)
        .attr("height", CARD_H)
        .attr("rx", 8)
        .attr("fill", (d) => d.passed ? "#d1fae5" : MILESTONE_PALETTE[d.milestoneIdx % MILESTONE_PALETTE.length].fill)
        .attr("stroke", (d) => d.passed ? "#10b981" : MILESTONE_PALETTE[d.milestoneIdx % MILESTONE_PALETTE.length].stroke)
        .attr("stroke-width", 1.5)
        .attr("filter", "url(#card-shadow)")

      // Left color strip
      nodeGroups
        .append("rect")
        .attr("x", 0).attr("y", 0).attr("width", 4).attr("height", CARD_H).attr("rx", 2)
        .attr("fill", (d) => d.passed ? "#10b981" : MILESTONE_PALETTE[d.milestoneIdx % MILESTONE_PALETTE.length].stroke)

      // Text
      nodeGroups.each(function (d) {
        const el = d3.select(this)
        const palette = MILESTONE_PALETTE[d.milestoneIdx % MILESTONE_PALETTE.length]
        const maxChars = 7
        const title = d.label.length > maxChars ? d.label.slice(0, maxChars) + "…" : d.label
        el.append("text").attr("x", 12).attr("y", 18)
          .attr("font-size", "11px").attr("font-weight", "600")
          .attr("fill", d.passed ? "#047857" : palette.text).text(title)
        const msName = d.milestone.length > 10 ? d.milestone.slice(0, 10) + "…" : d.milestone
        el.append("text").attr("x", 12).attr("y", 33)
          .attr("font-size", "8px").attr("fill", "#94a3b8").text(msName)
        if (d.passed) {
          el.append("circle").attr("cx", CARD_W - 12).attr("cy", 14).attr("r", 7).attr("fill", "#10b981")
          el.append("path")
            .attr("d", `M${CARD_W - 15},14 L${CARD_W - 13},16 L${CARD_W - 9},12`)
            .attr("stroke", "white").attr("stroke-width", 1.5)
            .attr("stroke-linecap", "round").attr("stroke-linejoin", "round").attr("fill", "none")
        }
      })
    }

    renderGraph(g)

    // Clip-path ids for left strips (main graph only)
    g.selectAll<SVGGElement, GraphNode>(".nodes > g").each(function (_, i) {
      const el = d3.select(this)
      defs.append("clipPath").attr("id", `clip-${i}`)
        .append("rect").attr("width", CARD_W).attr("height", CARD_H).attr("rx", 8)
      el.select("rect:nth-child(2)").attr("clip-path", `url(#clip-${i})`)
    })

    // Invisible overlay for magnifier mouse tracking
    svg.append("rect")
      .attr("width", width).attr("height", height)
      .attr("fill", "transparent")
      .attr("class", "mag-overlay")
      .on("mousemove", function (event) {
        const [cx, cy] = d3.pointer(event, container)
        const t = currentTransformRef.current
        // Convert screen coords to graph (SVG) coords
        const svgX = (cx - t.x) / t.k
        const svgY = (cy - t.y) / t.k
        setMagnifier({ x: svgX, y: svgY, cx, cy })
      })
      .on("mouseleave", () => setMagnifier(null))

    // Clickable overlay for node clicks
    svg.append("g").attr("class", "click-overlay")
      .selectAll("rect")
      .data(graphNodes)
      .enter()
      .append("rect")
      .attr("fill", "transparent")
      .attr("cursor", "pointer")
      .attr("width", CARD_W + 8)
      .attr("height", CARD_H + 8)
      // position updated by zoom transform via the transform attribute on the group
      .each(function (d) {
        // We can't put these inside zoom-transformed g because overlay is outside,
        // so we update positions via event and store in data
        d3.select(this)
          .attr("data-gid", d.globalId)
      })
      .on("click", (_, d) => handleNodeClick(d.globalId))
      .on("mouseenter", function (event, d) {
        d3.select(svgRef.current)
          .select(`.nodes > g:nth-child(${graphNodes.indexOf(d) + 1}) rect.card-bg`)
          .attr("stroke-width", 2.5)
        const containerRect = container.getBoundingClientRect()
        setHover({ node: d, x: event.clientX - containerRect.left, y: event.clientY - containerRect.top })
      })
      .on("mouseleave", function (_, d) {
        d3.select(svgRef.current)
          .select(`.nodes > g:nth-child(${graphNodes.indexOf(d) + 1}) rect.card-bg`)
          .attr("stroke-width", 1.5)
        setHover(null)
      })

    // Update click overlay positions on zoom
    zoom.on("zoom.overlay", (event) => {
      const t: d3.ZoomTransform = event.transform
      d3.select(svgRef.current).select(".click-overlay")
        .selectAll<SVGRectElement, GraphNode>("rect")
        .attr("x", (d) => t.applyX((d.x ?? 0) - CARD_W / 2 - 4))
        .attr("y", (d) => t.applyY((d.y ?? 0) - CARD_H / 2 - 4))
        .attr("width", (CARD_W + 8) * t.k)
        .attr("height", (CARD_H + 8) * t.k)
    })
    // Init positions
    const t = currentTransformRef.current
    d3.select(svgRef.current).select(".click-overlay")
      .selectAll<SVGRectElement, GraphNode>("rect")
      .attr("x", (d) => t.applyX((d.x ?? 0) - CARD_W / 2 - 4))
      .attr("y", (d) => t.applyY((d.y ?? 0) - CARD_H / 2 - 4))
      .attr("width", (CARD_W + 8) * t.k)
      .attr("height", (CARD_H + 8) * t.k)

    // Milestone legend
    const legendData = milestones.map((ms, i) => ({
      label: ms.title,
      color: MILESTONE_PALETTE[i % MILESTONE_PALETTE.length].stroke,
    }))
    const legend = svg.append("g").attr("transform", `translate(16, ${height - 20})`)
    let lx = 0
    for (const item of legendData) {
      const lg = legend.append("g").attr("transform", `translate(${lx}, 0)`)
      lg.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", item.color).attr("opacity", 0.7)
      const text = lg.append("text").attr("x", 14).attr("dy", "0.7em")
        .attr("font-size", "10px").attr("fill", "#94a3b8")
        .text(item.label.length > 8 ? item.label.slice(0, 8) + "…" : item.label)
      lx += (text.node()?.getBBox().width ?? 40) + 24
    }

  }, [graphNodes, graphLinks, handleNodeClick, milestones])

  return (
    <div ref={containerRef} className={`relative w-full h-full min-h-[300px] ${className ?? ""}`}>
      <svg ref={svgRef} className="w-full h-full" />

      {/* Magnifier lens — rendered as SVG overlay */}
      {magnifier && (
        <MagnifierLens
          cx={magnifier.cx}
          cy={magnifier.cy}
          svgX={magnifier.x}
          svgY={magnifier.y}
          transform={currentTransformRef.current}
          graphNodes={graphNodes}
          graphLinks={graphLinks}
          milestones={milestones}
          radius={MAG_R}
          zoom={MAG_ZOOM}
        />
      )}

      {hover && !magnifier && <HoverTooltip info={hover} />}
    </div>
  )
}

// ─── Magnifier Lens ────────────────────────────────────────────────────────────

interface MagnifierLensProps {
  cx: number
  cy: number
  svgX: number
  svgY: number
  transform: d3.ZoomTransform
  graphNodes: GraphNode[]
  graphLinks: GraphLink[]
  milestones: MilestoneInfo[]
  radius: number
  zoom: number
}

function MagnifierLens({ cx, cy, svgX, svgY, radius, zoom, graphNodes, graphLinks, milestones }: MagnifierLensProps) {
  const lensRef = useRef<SVGSVGElement>(null)

  // The lens shows the graph centered on (svgX, svgY) with MAG_ZOOM scale
  // Transform: scale by zoom, then translate so (svgX, svgY) maps to lens center (radius, radius)
  const lensTransform = `translate(${radius - svgX * zoom}, ${radius - svgY * zoom}) scale(${zoom})`

  const nodeMap = useMemo(() => new Map(graphNodes.map((n) => [n.id, n])), [graphNodes])

  return (
    <svg
      ref={lensRef}
      style={{
        position: "absolute",
        left: cx - radius,
        top: cy - radius,
        width: radius * 2,
        height: radius * 2,
        pointerEvents: "none",
        zIndex: 40,
        overflow: "visible",
      }}
    >
      <defs>
        <clipPath id="lens-clip">
          <circle cx={radius} cy={radius} r={radius - 2} />
        </clipPath>
        <filter id="lens-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#000" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* White background inside lens */}
      <circle cx={radius} cy={radius} r={radius - 2} fill="white" clipPath="url(#lens-clip)" />

      {/* Magnified graph content */}
      <g clipPath="url(#lens-clip)">
        <g transform={lensTransform}>
          {/* Links */}
          <g>
            {graphLinks.map((d) => {
              const src = nodeMap.get(typeof d.source === "string" ? d.source : (d.source as GraphNode).id)
              const tgt = nodeMap.get(typeof d.target === "string" ? d.target : (d.target as GraphNode).id)
              if (!src || !tgt) return null
              const sx = (src.x ?? 0) + CARD_W / 2
              const sy = src.y ?? 0
              const tx = (tgt.x ?? 0) - CARD_W / 2
              const ty = tgt.y ?? 0
              const mx = (sx + tx) / 2
              return (
                <path
                  key={d.id}
                  d={`M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`}
                  fill="none" stroke="#cbd5e1" strokeWidth={1.5}
                />
              )
            })}
          </g>
          {/* Nodes */}
          <g>
            {graphNodes.map((d) => {
              const palette = MILESTONE_PALETTE[d.milestoneIdx % MILESTONE_PALETTE.length]
              const nx = (d.x ?? 0) - CARD_W / 2
              const ny = (d.y ?? 0) - CARD_H / 2
              const maxChars = 7
              const title = d.label.length > maxChars ? d.label.slice(0, maxChars) + "…" : d.label
              const msName = d.milestone.length > 10 ? d.milestone.slice(0, 10) + "…" : d.milestone
              return (
                <g key={d.id} transform={`translate(${nx},${ny})`}>
                  <rect
                    width={CARD_W} height={CARD_H} rx={8}
                    fill={d.passed ? "#d1fae5" : palette.fill}
                    stroke={d.passed ? "#10b981" : palette.stroke}
                    strokeWidth={1.5}
                  />
                  <rect x={0} y={0} width={4} height={CARD_H} rx={2}
                    fill={d.passed ? "#10b981" : palette.stroke}
                  />
                  <text x={12} y={18} fontSize="11px" fontWeight="600"
                    fill={d.passed ? "#047857" : palette.text}>{title}</text>
                  <text x={12} y={33} fontSize="8px" fill="#94a3b8">{msName}</text>
                  {d.passed && (
                    <>
                      <circle cx={CARD_W - 12} cy={14} r={7} fill="#10b981" />
                      <path d={`M${CARD_W - 15},14 L${CARD_W - 13},16 L${CARD_W - 9},12`}
                        stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </>
                  )}
                </g>
              )
            })}
          </g>
        </g>
      </g>

      {/* Lens border ring */}
      <circle
        cx={radius} cy={radius} r={radius - 2}
        fill="none"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth={2}
        filter="url(#lens-shadow)"
      />
      {/* Inner highlight ring */}
      <circle
        cx={radius} cy={radius} r={radius - 2}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={1}
      />
    </svg>
  )
}

// ─── Hover Tooltip ─────────────────────────────────────────────────────────────

function HoverTooltip({ info }: { info: HoverInfo }) {
  const { node, x, y } = info
  const palette = MILESTONE_PALETTE[node.milestoneIdx % MILESTONE_PALETTE.length]
  const tooltipW = 240
  const style: React.CSSProperties = {
    position: "absolute",
    left: x + 16,
    top: y - 10,
    width: tooltipW,
    pointerEvents: "none",
    zIndex: 50,
  }

  return (
    <div style={style} className="rounded-lg border bg-popover shadow-lg p-3 text-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-2 h-5 rounded-sm shrink-0" style={{ backgroundColor: palette.stroke }} />
        <span className="font-semibold text-foreground text-sm leading-tight">{node.label}</span>
        {node.passed && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
            已完成
          </span>
        )}
      </div>
      {node.summary && (
        <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-3">
          {node.summary}
        </p>
      )}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: palette.stroke }} />
          {node.milestone}
        </span>
        <span>难度 {node.difficulty}/10</span>
        <span>{node.minutes}分钟</span>
        <span>{node.xp} XP</span>
      </div>
    </div>
  )
}
