"use client"

import { useCallback, useMemo } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import type { MilestoneInfo, NodeProgress } from "@/lib/types/api"
import { buildFlowGraph } from "@/lib/utils/tree-layout"
import { KnodeNode } from "./knode-node"

const nodeTypes: NodeTypes = {
  knode: KnodeNode,
}

interface TreeFlowProps {
  milestones: MilestoneInfo[]
  progress: NodeProgress[]
  onNodeClick?: (nodeId: number) => void
}

export function TreeFlow({ milestones, progress, onNodeClick }: TreeFlowProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildFlowGraph(milestones, progress),
    [milestones, progress]
  )

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      onNodeClick?.(parseInt(node.id))
    },
    [onNodeClick]
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          className="!bg-card !border-border"
          maskColor="var(--muted)"
        />
      </ReactFlow>
    </div>
  )
}
