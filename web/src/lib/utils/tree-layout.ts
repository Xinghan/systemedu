/** Convert knowledge tree milestones + progress into React Flow nodes/edges. */

import type { Edge, Node } from "@xyflow/react"
import type { KnodeInfo, MilestoneInfo, NodeProgress } from "@/lib/types/api"

export interface KnodeNodeData {
  knode: KnodeInfo
  progress?: NodeProgress
  milestone: string
  milestoneId: string
  [key: string]: unknown
}

export interface MilestoneNodeData {
  milestone: MilestoneInfo
  milestoneIndex: number
  totalNodes: number
  passedNodes: number
  totalXp: number
  earnedXp: number
  /** IDs of child knode nodes for fitView */
  childNodeIds: string[]
  [key: string]: unknown
}

export function buildFlowGraph(
  milestones: MilestoneInfo[],
  progress: NodeProgress[]
): { nodes: Node<KnodeNodeData>[]; edges: Edge[] } {
  const nodes: Node<KnodeNodeData>[] = []
  const edges: Edge[] = []
  const progressMap = new Map(progress.map((p) => [p.knode_id, p]))

  // Assign layers via topological sort
  let globalIdx = 0
  const nodeDepths = new Map<number, number>()

  // First pass: compute depths
  for (const ms of milestones) {
    for (const knode of ms.knodes) {
      const id = globalIdx++
      let depth = 0
      for (const preIdx of knode.prerequisite_indices) {
        depth = Math.max(depth, (nodeDepths.get(preIdx) ?? 0) + 1)
      }
      nodeDepths.set(id, depth)
    }
  }

  // Group by depth for x positioning
  const depthBuckets = new Map<number, number[]>()
  for (const [id, depth] of nodeDepths) {
    if (!depthBuckets.has(depth)) depthBuckets.set(depth, [])
    depthBuckets.get(depth)!.push(id)
  }

  // Second pass: create nodes + edges
  globalIdx = 0
  const seenSimpleEdges = new Set<string>()
  for (const ms of milestones) {
    for (const knode of ms.knodes) {
      const id = globalIdx++
      const depth = nodeDepths.get(id) ?? 0
      const bucket = depthBuckets.get(depth) ?? [id]
      const yIndex = bucket.indexOf(id)
      const p = progressMap.get(id)
      const status = p?.status ?? "locked"

      nodes.push({
        id: String(id),
        type: "knode",
        position: { x: depth * 280, y: yIndex * 120 },
        data: {
          knode: { ...knode, id },
          progress: p,
          milestone: ms.title,
          milestoneId: "",
        },
      })

      for (const preIdx of knode.prerequisite_indices) {
        const edgeId = `e${preIdx}-${id}`
        if (!seenSimpleEdges.has(edgeId)) {
          seenSimpleEdges.add(edgeId)
          edges.push({
            id: edgeId,
            source: String(preIdx),
            target: String(id),
            animated: status === "available",
          })
        }
      }
    }
  }

  return { nodes, edges }
}

// --- Semantic Zoom Layout ---

const MS_PADDING = 32
const MS_GAP_X = 60
const MS_GAP_Y = 60
const KNODE_W = 220
const KNODE_H = 90
const KNODE_GAP_X = 32
const KNODE_GAP_Y = 16
const MS_HEADER = 44

// Max milestones per row — keeps total width manageable for fitView
const MS_COLS = 5

/**
 * Build a semantic-zoom flow graph with milestone container nodes.
 * Milestones are laid out in a grid (MS_COLS per row) so the total canvas
 * stays compact and fitView can show everything at a readable zoom level.
 */
export function buildSemanticFlowGraph(
  milestones: MilestoneInfo[],
  progress: NodeProgress[]
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const progressMap = new Map(progress.map((p) => [p.knode_id, p]))

  // Build global knode index → milestone index mapping
  let globalIdx = 0
  const knodeToMs = new Map<number, number>()
  const knodeMetas: { globalId: number; knode: KnodeInfo; msIdx: number; localIdx: number }[] = []

  for (let msIdx = 0; msIdx < milestones.length; msIdx++) {
    const ms = milestones[msIdx]
    for (let li = 0; li < ms.knodes.length; li++) {
      knodeToMs.set(globalIdx, msIdx)
      knodeMetas.push({ globalId: globalIdx, knode: ms.knodes[li], msIdx, localIdx: li })
      globalIdx++
    }
  }

  // Compute local depth per milestone for internal layout
  const localDepths = new Map<number, number>()
  for (const meta of knodeMetas) {
    let depth = 0
    for (const preIdx of meta.knode.prerequisite_indices) {
      if (knodeToMs.get(preIdx) === meta.msIdx) {
        depth = Math.max(depth, (localDepths.get(preIdx) ?? 0) + 1)
      }
    }
    localDepths.set(meta.globalId, depth)
  }

  // Group knodes by milestone and local depth
  const msDepthBuckets = new Map<number, Map<number, number[]>>()
  for (const meta of knodeMetas) {
    if (!msDepthBuckets.has(meta.msIdx)) msDepthBuckets.set(meta.msIdx, new Map())
    const depthMap = msDepthBuckets.get(meta.msIdx)!
    const d = localDepths.get(meta.globalId) ?? 0
    if (!depthMap.has(d)) depthMap.set(d, [])
    depthMap.get(d)!.push(meta.globalId)
  }

  // Calculate milestone container sizes
  const milestoneSizes: { w: number; h: number }[] = []
  for (let msIdx = 0; msIdx < milestones.length; msIdx++) {
    const depthMap = msDepthBuckets.get(msIdx) ?? new Map()
    const maxDepth = depthMap.size > 0 ? Math.max(...depthMap.keys()) : 0
    let maxBucketSize = 1
    for (const bucket of depthMap.values()) {
      maxBucketSize = Math.max(maxBucketSize, bucket.length)
    }
    const w = (maxDepth + 1) * (KNODE_W + KNODE_GAP_X) - KNODE_GAP_X + MS_PADDING * 2
    const h = maxBucketSize * (KNODE_H + KNODE_GAP_Y) - KNODE_GAP_Y + MS_HEADER + MS_PADDING * 2
    milestoneSizes.push({ w, h })
  }

  // Grid layout: compute (col, row) position for each milestone
  // Use uniform cell size based on max milestone dimensions for clean alignment
  const maxW = Math.max(...milestoneSizes.map((s) => s.w))
  const maxH = Math.max(...milestoneSizes.map((s) => s.h))
  const cellW = maxW + MS_GAP_X
  const cellH = maxH + MS_GAP_Y

  const milestonePositions: { x: number; y: number }[] = milestones.map((_, i) => ({
    x: (i % MS_COLS) * cellW,
    y: Math.floor(i / MS_COLS) * cellH,
  }))

  // Create milestone container nodes
  for (let msIdx = 0; msIdx < milestones.length; msIdx++) {
    const ms = milestones[msIdx]
    const pos = milestonePositions[msIdx]
    const size = milestoneSizes[msIdx]
    const childIds: string[] = []

    let totalXp = ms.xp_reward ?? 0
    let earnedXp = 0
    let passedNodes = 0
    const msKnodes = knodeMetas.filter((m) => m.msIdx === msIdx)

    for (const meta of msKnodes) {
      childIds.push(String(meta.globalId))
      totalXp += meta.knode.xp_reward ?? 0
      const p = progressMap.get(meta.globalId)
      if (p?.status === "passed") {
        passedNodes++
        earnedXp += meta.knode.xp_reward ?? 0
      }
    }

    nodes.push({
      id: `ms-${msIdx}`,
      type: "milestone",
      position: { x: pos.x, y: pos.y },
      style: { width: size.w, height: size.h },
      data: {
        milestone: ms,
        milestoneIndex: msIdx,
        totalNodes: msKnodes.length,
        passedNodes,
        totalXp,
        earnedXp,
        childNodeIds: childIds,
      } satisfies MilestoneNodeData,
    })
  }

  // Create knode nodes with parentId
  for (const meta of knodeMetas) {
    const depth = localDepths.get(meta.globalId) ?? 0
    const depthMap = msDepthBuckets.get(meta.msIdx) ?? new Map()
    const bucket = depthMap.get(depth) ?? [meta.globalId]
    const yIndex = bucket.indexOf(meta.globalId)
    const p = progressMap.get(meta.globalId)

    nodes.push({
      id: String(meta.globalId),
      type: "knode",
      position: {
        x: MS_PADDING + depth * (KNODE_W + KNODE_GAP_X),
        y: MS_HEADER + MS_PADDING + yIndex * (KNODE_H + KNODE_GAP_Y),
      },
      parentId: `ms-${meta.msIdx}`,
      extent: "parent" as const,
      data: {
        knode: { ...meta.knode, id: meta.globalId },
        progress: p,
        milestone: milestones[meta.msIdx].title,
        milestoneId: `ms-${meta.msIdx}`,
      } satisfies KnodeNodeData,
    })
  }

  // Create knode-level edges (prerequisite dependencies)
  const seenKnodeEdges = new Set<string>()
  for (const meta of knodeMetas) {
    const p = progressMap.get(meta.globalId)
    const status = p?.status ?? "locked"
    for (const preIdx of meta.knode.prerequisite_indices) {
      const edgeId = `e${preIdx}-${meta.globalId}`
      if (seenKnodeEdges.has(edgeId)) continue
      seenKnodeEdges.add(edgeId)
      edges.push({
        id: edgeId,
        source: String(preIdx),
        target: String(meta.globalId),
        animated: status === "available",
        className: "edge-knode",
      })
    }
  }

  // Create milestone-level edges (aggregated cross-milestone dependencies)
  const msCrossEdges = new Set<string>()
  for (const meta of knodeMetas) {
    for (const preIdx of meta.knode.prerequisite_indices) {
      const preMsIdx = knodeToMs.get(preIdx)
      if (preMsIdx !== undefined && preMsIdx !== meta.msIdx) {
        const edgeKey = `ms-${preMsIdx}->ms-${meta.msIdx}`
        if (!msCrossEdges.has(edgeKey)) {
          msCrossEdges.add(edgeKey)
          edges.push({
            id: `ems-${preMsIdx}-${meta.msIdx}`,
            source: `ms-${preMsIdx}`,
            target: `ms-${meta.msIdx}`,
            className: "edge-milestone",
          })
        }
      }
    }
  }

  return { nodes, edges }
}
