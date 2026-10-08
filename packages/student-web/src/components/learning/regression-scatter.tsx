"use client"

import { useEffect, useRef, useState } from "react"
import type { RegressionRow } from "@/lib/regression-evidence"
import "@/styles/vendor/jsxgraph.css"

type Point = { Y: () => number; moveTo: (p: number[]) => void; on: (event: string, handler: () => void) => void }
type Board = { create: (type: string, parents: unknown[], attrs?: Record<string, unknown>) => unknown; update: () => void }
type Runtime = { JSXGraph: { initBoard: (element: HTMLElement, attrs: Record<string, unknown>) => Board; freeBoard: (board: Board) => void } }

/** Inspectable, constrained coordinates; table values remain the source of truth. */
export function RegressionScatter({ rows, editable = false, onMove, onSelect }: {
  rows: RegressionRow[]
  editable?: boolean
  onMove?: (value: number) => void
  onSelect?: (id: string) => void
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<Board | null>(null)
  const gliderRef = useRef<Point | null>(null)
  const stateRef = useRef(rows)
  const callbacks = useRef({ onMove, onSelect })
  const [status, setStatus] = useState("loading")
  const ids = rows.map(row => row.id).join("|")

  useEffect(() => { callbacks.current = { onMove, onSelect } }, [onMove, onSelect])
  useEffect(() => {
    stateRef.current = rows
    const d = rows.find(row => row.id === "D")
    if (d && gliderRef.current) gliderRef.current.moveTo([d.actual, d.predicted])
    boardRef.current?.update()
  }, [rows])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    let cancelled = false
    let runtime: Runtime | null = null
    let board: Board | null = null
    void import("jsxgraph").then(module => {
      if (cancelled) return
      runtime = ((module as unknown as { default?: Runtime }).default ?? module) as unknown as Runtime
      board = runtime.JSXGraph.initBoard(element, {
        boundingbox: [-1.15, 10.8, 10.8, -1.15], keepAspectRatio: true,
        axis: true, grid: true, showCopyright: false, showNavigation: false,
        pan: { enabled: false }, zoom: { enabled: false },
        defaultAxes: { x: { ticks: { minorTicks: 0 } }, y: { ticks: { minorTicks: 0 } } },
      })
      boardRef.current = board
      const fixed = { fixed: true, highlight: false }
      board.create("segment", [[0, 0], [10, 10]], { ...fixed, strokeColor: "#438A77", strokeWidth: 2, dash: 2 })
      board.create("text", [6.2, 9.8, "预测 = 真实"], { ...fixed, fontSize: 12, strokeColor: "#347360" })
      stateRef.current.forEach((row, index) => {
        const current = () => stateRef.current[index]
        const color = row.id === "D" ? "#C75C36" : "#2E6B8A"
        board?.create("segment", [
          [() => current().actual, () => current().actual],
          [() => current().actual, () => current().predicted],
        ], { ...fixed, strokeColor: color, strokeWidth: row.id === "D" ? 3 : 2, dash: 1 })
        let point: Point
        if (editable && row.id === "D") {
          const track = board?.create("segment", [[row.actual, 0], [row.actual, 10]], { ...fixed, visible: false })
          point = board?.create("glider", [row.actual, row.predicted, track], { name: "D", size: 6, fillColor: color, strokeColor: "#FFFFFF", strokeWidth: 2, label: { offset: [10, -12], strokeColor: color } }) as Point
          gliderRef.current = point
          point.on("drag", () => callbacks.current.onMove?.(Math.round(Math.max(0, Math.min(10, point.Y())) * 10) / 10))
        } else {
          point = board?.create("point", [() => current().actual, () => current().predicted], { fixed: true, name: row.id, size: 4, fillColor: color, strokeColor: "#FFFFFF", strokeWidth: 2, label: { offset: [9, 12], strokeColor: color } }) as Point
        }
        point.on("up", () => callbacks.current.onSelect?.(row.id))
      })
      setStatus("ready")
    }).catch(() => { if (!cancelled) setStatus("fallback") })
    return () => {
      cancelled = true
      gliderRef.current = null
      boardRef.current = null
      if (board && runtime) runtime.JSXGraph.freeBoard(board)
    }
  }, [ids, editable])

  return <figure className="re-scatter">
    <figcaption><strong>预测 vs 真实</strong><span>纵轴：预测值 · 横轴：真实值</span></figcaption>
    <div className="re-board-shell">
      <div ref={elementRef} className="re-board" aria-label={editable ? "JSXGraph 散点图，可竖直拖动橙色 D 点改变预测值" : "JSXGraph 散点图，点击样本点查看误差"} />
      {status !== "ready" && <svg className="re-scatter-fallback" viewBox="0 0 380 380" role="img" aria-label="预测与真实散点图静态备份">
        {Array.from({ length: 11 }, (_, value) => <g key={value} stroke="#DCE5E7"><path d={`M ${35 + value * 30} 35 V 335 M 35 ${335 - value * 30} H 335`} /><text x={35 + value * 30} y="354" stroke="none" fill="#536E7B" fontSize="11">{value}</text><text x="14" y={339 - value * 30} stroke="none" fill="#536E7B" fontSize="11">{value}</text></g>)}
        <path d="M 35 335 L 335 35" stroke="#438A77" strokeDasharray="6 5" fill="none" />
        {rows.map(row => <g key={row.id} fill={row.id === "D" ? "#C75C36" : "#2E6B8A"}><path d={`M ${35 + row.actual * 30} ${335 - row.actual * 30} V ${335 - row.predicted * 30}`} stroke={row.id === "D" ? "#C75C36" : "#2E6B8A"} /><circle cx={35 + row.actual * 30} cy={335 - row.predicted * 30} r="5" /><text x={44 + row.actual * 30} y={330 - row.predicted * 30} fontSize="13">{row.id}</text></g>)}
      </svg>}
    </div>
    <p className="re-chart-note" aria-live="polite">{status === "ready" ? editable ? "JSXGraph 已加载 · 可拖动 D 点，或使用下方滑块。" : "JSXGraph 已加载 · 竖直线段表示误差大小，不是到对角线的垂直距离。" : status === "fallback" ? "坐标组件未加载，已显示静态图；下方表格与滑块仍可使用。" : "正在加载专业坐标组件；先显示静态图。"}</p>
  </figure>
}
