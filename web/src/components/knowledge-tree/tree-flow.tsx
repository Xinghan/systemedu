"use client"

import { useCallback, useMemo } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"

import type { MilestoneInfo, NodeProgress } from "@/lib/types/api"
import { buildSemanticFlowGraph } from "@/lib/utils/tree-layout"
import { KnodeNode } from "./knode-node"
import { MilestoneNode } from "./milestone-node"

const nodeTypes: NodeTypes = {
  knode: KnodeNode,
  milestone: MilestoneNode,
}

interface TreeFlowProps {
  milestones: MilestoneInfo[]
  progress: NodeProgress[]
  onNodeClick?: (nodeId: number) => void
}

export function TreeFlow({ milestones, progress, onNodeClick }: TreeFlowProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildSemanticFlowGraph(milestones, progress),
    [milestones, progress]
  )

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      if (!node.id.startsWith("ms-")) {
        onNodeClick?.(parseInt(node.id))
      }
    },
    [onNodeClick]
  )

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, duration: 0 }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-40" />
        <CustomControls />
      </ReactFlow>
      {/* Always show knode edges, hide milestone-level cross-edges */}
      <style>{`
        .edge-milestone { opacity: 0; pointer-events: none; }
        .edge-knode { opacity: 1; }
      `}</style>
    </div>
  )
}

function CustomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
      <button
        onClick={() => zoomIn({ duration: 200 })}
        className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background shadow-sm hover:bg-muted transition-colors text-foreground"
        title="放大"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      <button
        onClick={() => zoomOut({ duration: 200 })}
        className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background shadow-sm hover:bg-muted transition-colors text-foreground"
        title="缩小"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <button
        onClick={() => fitView({ duration: 300, padding: 0.15 })}
        className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background shadow-sm hover:bg-muted transition-colors text-foreground"
        title="适应窗口"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
