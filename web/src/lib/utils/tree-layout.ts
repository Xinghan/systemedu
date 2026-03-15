/** Convert knowledge tree milestones + progress into React Flow nodes/edges. */

import type { Edge, Node } from "@xyflow/react"
import type { KnodeInfo, MilestoneInfo, NodeProgress } from "@/lib/types/api"

export interface KnodeNodeData {
  knode: KnodeInfo
  progress?: NodeProgress
  milestone: string
  [key: string]: unknown
}

const STATUS_COLORS: Record<string, string> = {
  locked: "#6b7280",     // gray
  available: "#3b82f6",  // blue
  in_progress: "#f59e0b", // amber
  passed: "#22c55e",     // green
  submitted: "#a855f7",  // purple
  failed: "#ef4444",     // red
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
        },
        style: {
          borderColor: STATUS_COLORS[status] ?? STATUS_COLORS.locked,
        },
      })

      for (const preIdx of knode.prerequisite_indices) {
        edges.push({
          id: `e${preIdx}-${id}`,
          source: String(preIdx),
          target: String(id),
          animated: status === "available",
        })
      }
    }
  }

  return { nodes, edges }
}
