"use client"

import { useCallback, useMemo } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useOnViewportChange,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"

import type { MilestoneInfo, NodeProgress } from "@/lib/types/api"
import { buildSemanticFlowGraph } from "@/lib/utils/tree-layout"
import { useViewportStore } from "@/lib/stores/viewport-store"
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

  const layer = useViewportStore((s) => s.layer)

  return (
    <div className={`w-full h-full semantic-layer-${layer} relative`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <ViewportSync />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-40" />
        <CustomControls />
      </ReactFlow>
      <style>{semanticLayerCSS}</style>
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
        onClick={() => fitView({ duration: 300, padding: 0.1 })}
        className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background shadow-sm hover:bg-muted transition-colors text-foreground"
        title="适应窗口"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** Syncs ReactFlow viewport zoom → viewport store */
function ViewportSync() {
  const setZoom = useViewportStore((s) => s.setZoom)

  useOnViewportChange({
    onChange: useCallback(
      (viewport: { zoom: number }) => {
        setZoom(viewport.zoom)
      },
      [setZoom]
    ),
  })

  return null
}

const semanticLayerCSS = `
  .semantic-layer-overview .edge-knode {
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease;
  }
  .semantic-layer-overview .edge-milestone {
    opacity: 1;
    transition: opacity 200ms ease;
  }
  .semantic-layer-milestone .edge-milestone,
  .semantic-layer-detail .edge-milestone {
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease;
  }
  .semantic-layer-milestone .edge-knode,
  .semantic-layer-detail .edge-knode {
    opacity: 1;
    transition: opacity 200ms ease;
  }
`
