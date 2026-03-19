"use client"

import { useEffect, useRef, useMemo, useCallback, useState } from "react"
import * as d3 from "d3"
import type { MilestoneInfo, KnodeInfo } from "@/lib/types/api"
import type { NodeProgress } from "@/lib/types/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { gateway } from "@/lib/api"

interface D3KnowledgeTreeProps {
  milestones: MilestoneInfo[]
  progress: NodeProgress[]
  onNodeClick?: (nodeId: number) => void
  projectName?: string
  onTreeChange?: (milestones: MilestoneInfo[]) => void
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
  nodeIdx: number  // index within the milestone
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

interface ContextMenuState {
  node: GraphNode
  x: number
  y: number
}

interface EditState {
  node: GraphNode | null  // null = new node mode
  isNew: boolean
  parentNode?: GraphNode  // set when isNew, used to determine placement
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
  { fill: "#e0e7ff", stroke: "#94a3b8", text: "#4338ca", bg: "#eef2ff" },
]

const CARD_W = 120
const CARD_H = 44
const X_SPACING = 220
const Y_SPACING = 180

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function D3KnowledgeTree({
  milestones,
  progress,
  onNodeClick,
  projectName,
  onTreeChange,
  className,
}: D3KnowledgeTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [minimapTransform, setMinimapTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity)
  const containerSizeRef = useRef({ w: 0, h: 0 })
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const applyHighlightRef = useRef<(ids: Set<string>) => void>(() => {})
  const clearHighlightRef = useRef<() => void>(() => {})

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [detailNode, setDetailNode] = useState<GraphNode | null>(null)
  const [saving, setSaving] = useState(false)
  // Pinned highlight: set of node ids that stay highlighted until manually cleared
  const pinnedPathIdsRef = useRef<Set<string>>(new Set())
  const [hasPinnedPath, setHasPinnedPath] = useState(false)

  // localMilestones is the source of truth for rendering once user edits
  const [localMilestones, setLocalMilestones] = useState<MilestoneInfo[]>(milestones)
  // Sync if parent milestones prop changes (e.g. initial load)
  useEffect(() => { setLocalMilestones(milestones) }, [milestones])

  const progressMap = useMemo(() => new Map(progress.map((p) => [p.knode_id, p])), [progress])

  const { graphNodes, graphLinks } = useMemo(() => {
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []
    const depthMap = new Map<number, number>()

    let globalIdx = 0
    for (const ms of localMilestones) {
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
    for (let msIdx = 0; msIdx < localMilestones.length; msIdx++) {
      const ms = localMilestones[msIdx]
      for (let nodeIdx = 0; nodeIdx < ms.knodes.length; nodeIdx++) {
        const knode = ms.knodes[nodeIdx]
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
          nodeIdx,
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
  }, [localMilestones, progressMap])

  const handleNodeClick = useCallback(
    (globalId: number) => {
      const node = graphNodes.find((n) => n.globalId === globalId) ?? null
      setDetailNode(node)
    },
    [graphNodes],
  )

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null) }
    window.addEventListener("click", handleClick)
    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("click", handleClick)
      window.removeEventListener("keydown", handleKey)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || graphNodes.length === 0) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight
    containerSizeRef.current = { w: width, h: height }

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()
    svg.attr("width", width).attr("height", height)

    const g = svg.append("g").attr("class", "main-g")

    // zoom only triggers on non-node areas (filter out events on .node-drag-handle)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .filter((event) => {
        // Allow wheel zoom everywhere; block pan (mousedown/touchstart) on node drag handles
        if (event.type === "wheel") return true
        return !(event.target as Element).closest?.(".node-drag-handle")
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
        currentTransformRef.current = event.transform
        setMinimapTransform(event.transform)
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
    setMinimapTransform(initTransform)
    svg.call(zoom.transform, initTransform)

    // Defs
    const defs = svg.append("defs")

    // Arrow marker (default)
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 8).attr("refY", 0)
      .attr("markerWidth", 6).attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", "#cbd5e1")

    // Arrow marker (highlighted path)
    defs.append("marker")
      .attr("id", "arrow-hl")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 8).attr("refY", 0)
      .attr("markerWidth", 6).attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", "#94a3b8")

    // Drop shadow filter
    const filter = defs.append("filter").attr("id", "card-shadow").attr("x", "-10%").attr("y", "-10%").attr("width", "130%").attr("height", "140%")
    filter.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 2).attr("flood-color", "#000").attr("flood-opacity", 0.08)

    const nodeMap = new Map(graphNodes.map((n) => [n.id, n]))

    // Helper: recompute all link paths based on current node x/y
    function updateLinks() {
      g.select(".links").selectAll<SVGPathElement, GraphLink>("path")
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
    }

    // Helper: sync click-overlay positions to current node x/y + zoom transform
    function updateOverlay() {
      const t = currentTransformRef.current
      d3.select(svgRef.current).select(".click-overlay")
        .selectAll<SVGRectElement, GraphNode>("rect")
        .attr("x", (d) => t.applyX((d.x ?? 0) - CARD_W / 2 - 4))
        .attr("y", (d) => t.applyY((d.y ?? 0) - CARD_H / 2 - 4))
        .attr("width", (CARD_W + 8) * t.k)
        .attr("height", (CARD_H + 8) * t.k)
    }

    function renderGraph(target: d3.Selection<SVGGElement, unknown, null, undefined>) {
      // Links (rendered first so nodes appear on top)
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
        .attr("class", "node-group")
        .attr("transform", (d) => `translate(${(d.x ?? 0) - CARD_W / 2},${(d.y ?? 0) - CARD_H / 2})`)

      // Card background (also acts as drag handle — full card area)
      nodeGroups
        .append("rect")
        .attr("class", "card-bg node-drag-handle")
        .attr("width", CARD_W)
        .attr("height", CARD_H)
        .attr("rx", 8)
        .attr("fill", (d) => d.passed ? "#d1fae5" : MILESTONE_PALETTE[d.milestoneIdx % MILESTONE_PALETTE.length].fill)
        .attr("stroke", (d) => d.passed ? "#10b981" : MILESTONE_PALETTE[d.milestoneIdx % MILESTONE_PALETTE.length].stroke)
        .attr("stroke-width", 1.5)
        .attr("filter", "url(#card-shadow)")
        .attr("cursor", "grab")

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

      // Build adjacency for path highlighting
      // ancestors: set of node ids reachable by following sources backwards
      // descendants: set of node ids reachable by following targets forward
      // Returns self + direct parents + direct children (no recursive traversal)
      function getPathNodeIds(rootId: string): Set<string> {
        const result = new Set<string>([rootId])
        for (const lk of graphLinks) {
          const srcId = typeof lk.source === "string" ? lk.source : (lk.source as GraphNode).id
          const tgtId = typeof lk.target === "string" ? lk.target : (lk.target as GraphNode).id
          if (tgtId === rootId) result.add(srcId)  // direct parent
          if (srcId === rootId) result.add(tgtId)  // direct child
        }
        return result
      }

      function applyPathHighlight(pathIds: Set<string>) {
        g.select(".nodes").selectAll<SVGGElement, GraphNode>("g.node-group")
          .attr("opacity", (d) => pathIds.has(d.id) ? 1 : 0.15)
        g.select(".links").selectAll<SVGPathElement, GraphLink>("path")
          .each(function (lk) {
            const srcId = typeof lk.source === "string" ? lk.source : (lk.source as GraphNode).id
            const tgtId = typeof lk.target === "string" ? lk.target : (lk.target as GraphNode).id
            const onPath = pathIds.has(srcId) && pathIds.has(tgtId)
            d3.select(this)
              .attr("stroke", onPath ? "#94a3b8" : "#cbd5e1")
              .attr("stroke-width", onPath ? 2.5 : 1.5)
              .attr("opacity", onPath ? 1 : 0.15)
              .attr("marker-end", onPath ? "url(#arrow-hl)" : "url(#arrow)")
          })
      }

      function clearPathHighlight() {
        g.select(".nodes").selectAll<SVGGElement, GraphNode>("g.node-group")
          .attr("opacity", 1)
        g.select(".links").selectAll<SVGPathElement, GraphLink>("path")
          .attr("stroke", "#cbd5e1")
          .attr("stroke-width", 1.5)
          .attr("opacity", 1)
          .attr("marker-end", "url(#arrow)")
      }

      // Expose to React callbacks
      applyHighlightRef.current = applyPathHighlight
      clearHighlightRef.current = clearPathHighlight

      // Restore pinned highlight if any (after re-render)
      if (pinnedPathIdsRef.current.size > 0) {
        applyPathHighlight(pinnedPathIdsRef.current)
      }

      // Hover + context menu on node groups
      nodeGroups
        .on("mouseenter", function (event, d) {
          d3.select(this).select(".card-bg").attr("stroke-width", 2.5)
          // If pinned, don't override with hover
          if (pinnedPathIdsRef.current.size === 0) {
            applyPathHighlight(getPathNodeIds(d.id))
          }
          const containerRect = container.getBoundingClientRect()
          setHover({ node: d, x: event.clientX - containerRect.left, y: event.clientY - containerRect.top })
        })
        .on("mouseleave", function () {
          d3.select(this).select(".card-bg").attr("stroke-width", 1.5)
          // Only clear if nothing is pinned; otherwise restore pinned
          if (pinnedPathIdsRef.current.size === 0) {
            clearPathHighlight()
          } else {
            applyPathHighlight(pinnedPathIdsRef.current)
          }
          setHover(null)
        })
        .on("contextmenu", function (event, d) {
          event.preventDefault()
          event.stopPropagation()
          const containerRect = container.getBoundingClientRect()
          setContextMenu({
            node: d,
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top,
          })
        })

      // Drag behavior: drag individual nodes
      let dragMoved = false
      const drag = d3.drag<SVGGElement, GraphNode>()
        .on("start", function () {
          dragMoved = false
          d3.select(this).select(".card-bg").attr("cursor", "grabbing")
          setHover(null)
        })
        .on("drag", function (event, d) {
          dragMoved = true
          const t = currentTransformRef.current
          // Convert screen delta to graph space
          d.x = (d.x ?? 0) + event.dx / t.k
          d.y = (d.y ?? 0) + event.dy / t.k
          d3.select(this).attr("transform", `translate(${(d.x ?? 0) - CARD_W / 2},${(d.y ?? 0) - CARD_H / 2})`)
          updateLinks()
        })
        .on("end", function (event, d) {
          d3.select(this).select(".card-bg").attr("cursor", "grab")
          if (!dragMoved) {
            // treat short press as click
            handleNodeClick(d.globalId)
          }
        })

      nodeGroups.call(drag)
    }

    renderGraph(g)

    // Clip-path ids for left strips
    g.selectAll<SVGGElement, GraphNode>(".nodes > g").each(function (_, i) {
      const el = d3.select(this)
      defs.append("clipPath").attr("id", `clip-${i}`)
        .append("rect").attr("width", CARD_W).attr("height", CARD_H).attr("rx", 8)
      el.select("rect:nth-child(2)").attr("clip-path", `url(#clip-${i})`)
    })

    // Milestone legend
    const legendData = localMilestones.map((ms, i) => ({
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

  }, [graphNodes, graphLinks, handleNodeClick, localMilestones])

  // Save handler: edit or add node
  const handleSave = useCallback(async (fields: {
    title: string
    summary: string
    difficulty_level: number
    estimated_minutes: number
    xp_reward: number
    milestoneIdx: number
  }) => {
    if (!projectName || !editState) return
    setSaving(true)
    try {
      const updated = deepClone(localMilestones)
      if (editState.isNew) {
        const newKnode: KnodeInfo = {
          id: 0,
          title: fields.title,
          summary: fields.summary,
          difficulty_level: fields.difficulty_level,
          content_type: "text",
          acceptance_type: "auto",
          estimated_minutes: fields.estimated_minutes,
          xp_reward: fields.xp_reward,
          prerequisite_indices: editState.parentNode
            ? [editState.parentNode.globalId]
            : [],
        }
        updated[fields.milestoneIdx].knodes.push(newKnode)
      } else if (editState.node) {
        const node = editState.node
        const knode = updated[node.milestoneIdx].knodes[node.nodeIdx]
        knode.title = fields.title
        knode.summary = fields.summary
        knode.difficulty_level = fields.difficulty_level
        knode.estimated_minutes = fields.estimated_minutes
        knode.xp_reward = fields.xp_reward
      }
      await gateway.updateTree(projectName, updated)
      setLocalMilestones(updated)
      onTreeChange?.(updated)
      setEditState(null)
    } catch (e) {
      console.error("Failed to save tree:", e)
    } finally {
      setSaving(false)
    }
  }, [projectName, editState, localMilestones, onTreeChange])

  // Delete handler
  const handleDelete = useCallback(async (node: GraphNode) => {
    if (!projectName) return
    setSaving(true)
    try {
      const updated = deepClone(localMilestones)
      const gid = node.globalId

      // Remove node from its milestone
      updated[node.milestoneIdx].knodes.splice(node.nodeIdx, 1)

      // Rebuild prerequisite_indices for all remaining nodes:
      // 1. Remove any reference to gid
      // 2. Decrement indices > gid (since the global numbering shifts)
      let idx = 0
      for (const ms of updated) {
        for (const kn of ms.knodes) {
          // Remove reference to deleted gid
          kn.prerequisite_indices = kn.prerequisite_indices.filter((p) => p !== gid)
          // Decrement indices that came after the removed node
          kn.prerequisite_indices = kn.prerequisite_indices.map((p) => p > gid ? p - 1 : p)
          idx++
        }
      }

      await gateway.updateTree(projectName, updated)
      setLocalMilestones(updated)
      onTreeChange?.(updated)
    } catch (e) {
      console.error("Failed to delete node:", e)
    } finally {
      setSaving(false)
      setContextMenu(null)
    }
  }, [projectName, localMilestones, onTreeChange])

  return (
    <div ref={containerRef} className={`relative w-full h-full min-h-[300px] ${className ?? ""}`}>
      <svg ref={svgRef} className="w-full h-full" />

      {/* Minimap - top right */}
      <MinimapOverlay
        graphNodes={graphNodes}
        graphLinks={graphLinks}
        transform={minimapTransform}
        viewportW={containerSizeRef.current.w}
        viewportH={containerSizeRef.current.h}
      />

      {hover && !contextMenu && <HoverTooltip info={hover} />}

      {/* Clear pinned highlight button — shown top-right below minimap when path is pinned */}
      {hasPinnedPath && (
        <div
          className="absolute top-[116px] right-3 z-30"
          style={{ pointerEvents: "auto" }}
        >
          <button
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-card/90 backdrop-blur border shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => {
              pinnedPathIdsRef.current = new Set()
              setHasPinnedPath(false)
              clearHighlightRef.current()
            }}
          >
            <span className="inline-block w-2 h-2 rounded-sm bg-slate-400/60" />
            取消固定高亮
          </button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <NodeContextMenu
          node={contextMenu.node}
          x={contextMenu.x}
          y={contextMenu.y}
          canEdit={!!projectName}
          isPinned={hasPinnedPath && pinnedPathIdsRef.current.has(contextMenu.node.id)}
          onPinPath={() => {
            const ids = (() => {
              const result = new Set<string>([contextMenu.node.id])
              for (const lk of graphLinks) {
                const srcId = typeof lk.source === "string" ? lk.source : (lk.source as GraphNode).id
                const tgtId = typeof lk.target === "string" ? lk.target : (lk.target as GraphNode).id
                if (tgtId === contextMenu.node.id) result.add(srcId)
                if (srcId === contextMenu.node.id) result.add(tgtId)
              }
              return result
            })()
            pinnedPathIdsRef.current = ids
            setHasPinnedPath(true)
            applyHighlightRef.current(ids)
            setContextMenu(null)
          }}
          onEdit={() => {
            setEditState({ node: contextMenu.node, isNew: false })
            setContextMenu(null)
          }}
          onAddChild={() => {
            setEditState({ node: null, isNew: true, parentNode: contextMenu.node })
            setContextMenu(null)
          }}
          onDelete={() => handleDelete(contextMenu.node)}
        />
      )}

      {/* Node detail popup */}
      {detailNode && (
        <NodeDetailDialog
          node={detailNode}
          onClose={() => setDetailNode(null)}
          onLearn={onNodeClick ? () => { onNodeClick(detailNode.globalId); setDetailNode(null) } : undefined}
          onEdit={projectName ? () => { setEditState({ node: detailNode, isNew: false }); setDetailNode(null) } : undefined}
        />
      )}

      {/* Edit dialog */}
      {editState && (
        <NodeEditDialog
          node={editState.node}
          isNew={editState.isNew}
          milestones={localMilestones}
          saving={saving}
          onSave={handleSave}
          onClose={() => setEditState(null)}
        />
      )}
    </div>
  )
}

// ─── Minimap ──────────────────────────────────────────────────────────────────

interface MinimapProps {
  graphNodes: GraphNode[]
  graphLinks: GraphLink[]
  transform: d3.ZoomTransform
  viewportW: number
  viewportH: number
}

const MINIMAP_W = 160
const MINIMAP_H = 100
const MINIMAP_PAD = 4

function MinimapOverlay({ graphNodes, graphLinks, transform, viewportW, viewportH }: MinimapProps) {
  if (graphNodes.length === 0) return null

  const allX = graphNodes.map((n) => n.x ?? 0)
  const allY = graphNodes.map((n) => n.y ?? 0)
  const gMinX = Math.min(...allX) - CARD_W / 2 - 20
  const gMaxX = Math.max(...allX) + CARD_W / 2 + 20
  const gMinY = Math.min(...allY) - CARD_H / 2 - 20
  const gMaxY = Math.max(...allY) + CARD_H / 2 + 20
  const gW = gMaxX - gMinX || 1
  const gH = gMaxY - gMinY || 1

  const innerW = MINIMAP_W - MINIMAP_PAD * 2
  const innerH = MINIMAP_H - MINIMAP_PAD * 2
  const ms = Math.min(innerW / gW, innerH / gH)

  // Viewport rect in graph space
  const vpLeft = -transform.x / transform.k
  const vpTop = -transform.y / transform.k
  const vpW = viewportW / transform.k
  const vpH = viewportH / transform.k

  // Viewport rect in minimap space
  const mvpX = (vpLeft - gMinX) * ms + MINIMAP_PAD
  const mvpY = (vpTop - gMinY) * ms + MINIMAP_PAD
  const mvpW = vpW * ms
  const mvpH = vpH * ms

  const nodeMap = new Map(graphNodes.map((n) => [n.id, n]))

  return (
    <div
      className="absolute top-3 right-3 bg-card/80 backdrop-blur border rounded-lg overflow-hidden shadow-sm"
      style={{ width: MINIMAP_W, height: MINIMAP_H, pointerEvents: "none" }}
    >
      <svg width={MINIMAP_W} height={MINIMAP_H}>
        {/* Links */}
        <g>
          {graphLinks.map((d) => {
            const src = nodeMap.get(typeof d.source === "string" ? d.source : (d.source as GraphNode).id)
            const tgt = nodeMap.get(typeof d.target === "string" ? d.target : (d.target as GraphNode).id)
            if (!src || !tgt) return null
            const sx = ((src.x ?? 0) + CARD_W / 2 - gMinX) * ms + MINIMAP_PAD
            const sy = ((src.y ?? 0) - gMinY) * ms + MINIMAP_PAD
            const ex = ((tgt.x ?? 0) - CARD_W / 2 - gMinX) * ms + MINIMAP_PAD
            const ey = ((tgt.y ?? 0) - gMinY) * ms + MINIMAP_PAD
            const mx2 = (sx + ex) / 2
            return (
              <path
                key={d.id}
                d={`M${sx},${sy} C${mx2},${sy} ${mx2},${ey} ${ex},${ey}`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={0.8}
              />
            )
          })}
        </g>
        {/* Nodes */}
        <g>
          {graphNodes.map((n) => {
            const palette = MILESTONE_PALETTE[n.milestoneIdx % MILESTONE_PALETTE.length]
            const nx = ((n.x ?? 0) - CARD_W / 2 - gMinX) * ms + MINIMAP_PAD
            const ny = ((n.y ?? 0) - CARD_H / 2 - gMinY) * ms + MINIMAP_PAD
            const nw = Math.max(CARD_W * ms, 4)
            const nh = Math.max(CARD_H * ms, 3)
            return (
              <rect
                key={n.id}
                x={nx} y={ny}
                width={nw} height={nh}
                rx={2}
                fill={n.passed ? "#d1fae5" : palette.fill}
                stroke={n.passed ? "#10b981" : palette.stroke}
                strokeWidth={0.5}
              />
            )
          })}
        </g>
        {/* Viewport indicator */}
        <rect
          x={mvpX} y={mvpY}
          width={Math.max(mvpW, 4)} height={Math.max(mvpH, 4)}
          fill="rgba(59,130,246,0.12)"
          stroke="#3b82f6"
          strokeWidth={1.2}
          rx={2}
        />
      </svg>
    </div>
  )
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface NodeContextMenuProps {
  node: GraphNode
  x: number
  y: number
  canEdit: boolean
  isPinned: boolean
  onPinPath: () => void
  onEdit: () => void
  onAddChild: () => void
  onDelete: () => void
}

function NodeContextMenu({ node, x, y, canEdit, isPinned, onPinPath, onEdit, onAddChild, onDelete }: NodeContextMenuProps) {
  return (
    <div
      style={{ position: "absolute", left: x, top: y, zIndex: 60 }}
      className="rounded-lg border bg-popover shadow-lg py-1 min-w-[150px] text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-xs text-muted-foreground border-b mb-1 font-medium truncate max-w-[170px]">
        {node.label}
      </div>
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-accent rounded transition-colors"
        onClick={onPinPath}
      >
        {isPinned ? "更新固定高亮" : "固定高亮路径"}
      </button>
      {canEdit && (
        <>
          <div className="border-t my-1" />
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-accent rounded transition-colors"
            onClick={onEdit}
          >
            编辑节点
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-accent rounded transition-colors"
            onClick={onAddChild}
          >
            添加后继节点
          </button>
          <div className="border-t my-1" />
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-destructive/10 text-destructive rounded transition-colors"
            onClick={onDelete}
          >
            删除节点
          </button>
        </>
      )}
    </div>
  )
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

interface NodeEditDialogProps {
  node: GraphNode | null
  isNew: boolean
  milestones: MilestoneInfo[]
  saving: boolean
  onSave: (fields: {
    title: string
    summary: string
    difficulty_level: number
    estimated_minutes: number
    xp_reward: number
    milestoneIdx: number
  }) => void
  onClose: () => void
}

function NodeEditDialog({ node, isNew, milestones, saving, onSave, onClose }: NodeEditDialogProps) {
  const [title, setTitle] = useState(node?.label ?? "")
  const [summary, setSummary] = useState(node?.summary ?? "")
  const [difficulty, setDifficulty] = useState(String(node?.difficulty ?? 3))
  const [minutes, setMinutes] = useState(String(node?.minutes ?? 15))
  const [xp, setXp] = useState(String(node?.xp ?? 100))
  const [milestoneIdx, setMilestoneIdx] = useState(node?.milestoneIdx ?? 0)

  const handleSubmit = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      summary: summary.trim(),
      difficulty_level: Math.min(10, Math.max(1, parseInt(difficulty) || 3)),
      estimated_minutes: Math.max(1, parseInt(minutes) || 15),
      xp_reward: Math.max(0, parseInt(xp) || 100),
      milestoneIdx,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "添加新节点" : "编辑节点"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="node-title">标题</Label>
            <Input
              id="node-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="节点标题"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="node-summary">简介</Label>
            <textarea
              id="node-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="节点内容简介"
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="node-diff">难度 (1-10)</Label>
              <Input
                id="node-diff"
                type="number"
                min={1} max={10}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="node-min">时长 (分钟)</Label>
              <Input
                id="node-min"
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="node-xp">经验值</Label>
              <Input
                id="node-xp"
                type="number"
                min={0}
                value={xp}
                onChange={(e) => setXp(e.target.value)}
              />
            </div>
          </div>

          {isNew && (
            <div className="grid gap-1.5">
              <Label htmlFor="node-ms">所属里程碑</Label>
              <select
                id="node-ms"
                value={milestoneIdx}
                onChange={(e) => setMilestoneIdx(parseInt(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {milestones.map((ms, i) => (
                  <option key={i} value={i}>{ms.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>取消</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Node Detail Dialog ───────────────────────────────────────────────────────

interface NodeDetailDialogProps {
  node: GraphNode
  onClose: () => void
  onLearn?: () => void
  onEdit?: () => void
}

function NodeDetailDialog({ node, onClose, onLearn, onEdit }: NodeDetailDialogProps) {
  const palette = MILESTONE_PALETTE[node.milestoneIdx % MILESTONE_PALETTE.length]

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 rounded-sm shrink-0" style={{ backgroundColor: palette.stroke }} />
            <DialogTitle className="text-base leading-snug">{node.label}</DialogTitle>
            {node.passed && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0 font-normal">
                已完成
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="grid gap-3">
          {node.summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{node.summary}</p>
          )}

          <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-muted-foreground mb-0.5">难度</div>
              <div className="font-semibold text-foreground">{node.difficulty} / 10</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">时长</div>
              <div className="font-semibold text-foreground">{node.minutes} 分钟</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">经验值</div>
              <div className="font-semibold text-foreground">{node.xp}</div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: palette.stroke }} />
            {node.milestone}
          </div>
        </div>

        <DialogFooter>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>编辑</Button>
          )}
          {onLearn && (
            <Button size="sm" onClick={onLearn}>进入学习</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <span>{node.xp} 经验值</span>
      </div>
    </div>
  )
}
