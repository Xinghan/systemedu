"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { TreeGraph, TreeGraphNode, TreeGraphEdge } from "@/lib/types";

interface TreePreviewProps {
  graph: TreeGraph;
}

const NODE_W = 180;
const NODE_H = 60;
const GAP_X = 60;
const GAP_Y = 40;
const PADDING = 40;

// Color per milestone
const MILESTONE_COLORS = [
  "#4f6ef7", "#22c55e", "#f59e0b", "#ef4444", "#a855f7",
  "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#6366f1",
];

interface LayoutNode {
  node: TreeGraphNode;
  x: number;
  y: number;
  color: string;
}

function layoutNodes(graph: TreeGraph): { nodes: LayoutNode[]; width: number; height: number } {
  if (graph.nodes.length === 0) return { nodes: [], width: 400, height: 200 };

  // Group by milestone
  const milestoneIds = [...new Set(graph.nodes.map((n) => n.milestone_id))];
  const groups = new Map<number, TreeGraphNode[]>();
  for (const node of graph.nodes) {
    if (!groups.has(node.milestone_id)) groups.set(node.milestone_id, []);
    groups.get(node.milestone_id)!.push(node);
  }

  const layoutNodes: LayoutNode[] = [];
  let currentX = PADDING;
  let maxY = 0;

  for (let mIdx = 0; mIdx < milestoneIds.length; mIdx++) {
    const msId = milestoneIds[mIdx];
    const nodes = groups.get(msId) || [];
    const color = MILESTONE_COLORS[mIdx % MILESTONE_COLORS.length];

    for (let nIdx = 0; nIdx < nodes.length; nIdx++) {
      const y = PADDING + nIdx * (NODE_H + GAP_Y);
      layoutNodes.push({ node: nodes[nIdx], x: currentX, y, color });
      maxY = Math.max(maxY, y + NODE_H);
    }
    currentX += NODE_W + GAP_X;
  }

  return {
    nodes: layoutNodes,
    width: currentX - GAP_X + PADDING,
    height: maxY + PADDING,
  };
}

export default function TreePreview({ graph }: TreePreviewProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const { nodes: layoutData, width: svgWidth, height: svgHeight } = useMemo(
    () => layoutNodes(graph),
    [graph],
  );

  const nodeMap = useMemo(() => {
    const m = new Map<number, LayoutNode>();
    for (const ln of layoutData) m.set(ln.node.id, ln);
    return m;
  }, [layoutData]);

  // Auto-fit on first render
  useEffect(() => {
    if (!svgRef.current || layoutData.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = rect.width / svgWidth;
    const scaleY = rect.height / svgHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    setZoom(scale);
    setPan({
      x: (rect.width - svgWidth * scale) / 2,
      y: (rect.height - svgHeight * scale) / 2,
    });
  }, [layoutData, svgWidth, svgHeight]);

  // Connected edges for hover
  const hoveredEdges = useMemo(() => {
    if (hoveredId === null) return new Set<string>();
    const set = new Set<string>();
    for (const e of graph.edges) {
      if (e.source === hoveredId || e.target === hoveredId) {
        set.add(`${e.source}-${e.target}`);
      }
    }
    return set;
  }, [hoveredId, graph.edges]);

  const connectedNodes = useMemo(() => {
    if (hoveredId === null) return new Set<number>();
    const set = new Set<number>([hoveredId]);
    for (const e of graph.edges) {
      if (e.source === hoveredId) set.add(e.target);
      if (e.target === hoveredId) set.add(e.source);
    }
    return set;
  }, [hoveredId, graph.edges]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * delta, 0.2), 3));
  }, []);

  if (graph.nodes.length === 0) {
    return (
      <div className="border border-border rounded-lg p-12 text-center">
        <p className="text-text-secondary text-sm">No knowledge tree to preview.</p>
        <p className="text-text-muted text-xs mt-1">Import a tree JSON to see the visualization.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg-primary">
      {/* Zoom controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-surface">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}
          className="w-7 h-7 flex items-center justify-center rounded bg-bg-elevated text-text-secondary hover:text-text-primary text-sm cursor-pointer"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.8, 0.2))}
          className="w-7 h-7 flex items-center justify-center rounded bg-bg-elevated text-text-secondary hover:text-text-primary text-sm cursor-pointer"
        >
          -
        </button>
        <span className="text-xs text-text-muted">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="text-xs text-text-secondary hover:text-text-primary ml-2 cursor-pointer"
        >
          Reset
        </button>
        <span className="text-xs text-text-muted ml-auto">{graph.nodes.length} nodes, {graph.edges.length} edges</span>
      </div>

      <svg
        ref={svgRef}
        className="w-full cursor-grab active:cursor-grabbing"
        style={{ height: "500px" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {graph.edges.map((edge: TreeGraphEdge) => {
            const from = nodeMap.get(edge.source);
            const to = nodeMap.get(edge.target);
            if (!from || !to) return null;

            const edgeKey = `${edge.source}-${edge.target}`;
            const highlighted = hoveredEdges.has(edgeKey);
            const dimmed = hoveredId !== null && !highlighted;

            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            const cx1 = x1 + (x2 - x1) * 0.4;
            const cx2 = x2 - (x2 - x1) * 0.4;

            return (
              <path
                key={edgeKey}
                d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={highlighted ? from.color : "#2a2e3e"}
                strokeWidth={highlighted ? 2 : 1.5}
                opacity={dimmed ? 0.2 : 1}
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Nodes */}
          {layoutData.map((ln: LayoutNode) => {
            const isHovered = hoveredId === ln.node.id;
            const isConnected = connectedNodes.has(ln.node.id);
            const dimmed = hoveredId !== null && !isConnected;

            return (
              <g
                key={ln.node.id}
                transform={`translate(${ln.x}, ${ln.y})`}
                onMouseEnter={() => setHoveredId(ln.node.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: "pointer" }}
                opacity={dimmed ? 0.3 : 1}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  fill={isHovered ? ln.color + "30" : "#1a1d27"}
                  stroke={isHovered ? ln.color : "#2a2e3e"}
                  strokeWidth={isHovered ? 2 : 1}
                />
                <text
                  x={NODE_W / 2}
                  y={22}
                  textAnchor="middle"
                  fill="#e2e4e9"
                  fontSize={12}
                  fontWeight={500}
                >
                  {ln.node.title.length > 20
                    ? ln.node.title.slice(0, 18) + "..."
                    : ln.node.title}
                </text>
                <text
                  x={NODE_W / 2}
                  y={40}
                  textAnchor="middle"
                  fill="#8b8fa3"
                  fontSize={10}
                >
                  {ln.node.milestone_title} | Lvl {ln.node.difficulty_level}
                </text>
                {/* Left connector dot */}
                <circle cx={0} cy={NODE_H / 2} r={3} fill={ln.color} />
                {/* Right connector dot */}
                <circle cx={NODE_W} cy={NODE_H / 2} r={3} fill={ln.color} />
              </g>
            );
          })}

          {/* Arrow marker */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#2a2e3e" />
            </marker>
          </defs>
        </g>
      </svg>
    </div>
  );
}
