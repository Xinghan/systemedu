"use client"

import { useEffect, useRef, useState } from "react"
import type { RocPoint } from "@/lib/roc-evidence"
import "@/styles/vendor/jsxgraph.css"
type Board = { create: (type: string, parents: unknown[], attrs?: Record<string, unknown>) => unknown; update: () => void }
type Runtime = { JSXGraph: { initBoard: (element: HTMLElement, attrs: Record<string, unknown>) => Board; freeBoard: (board: Board) => void } }

export function RocPlot({ points, current, revealed = points.length, area = false, onPick }: { points: RocPoint[]; current: RocPoint; revealed?: number; area?: boolean; onPick?: (index: number) => void }) {
  const el = useRef<HTMLDivElement>(null), boardRef = useRef<Board | null>(null), state = useRef({ points, current, revealed }), pickRef = useRef(onPick)
  const [status, setStatus] = useState("loading")
  const signature = points.map(p => `${p.fpr}:${p.tpr}`).join("|")
  useEffect(() => { state.current = { points, current, revealed }; pickRef.current = onPick; boardRef.current?.update() }, [points, current, revealed, onPick])
  useEffect(() => {
    const element = el.current
    if (!element) return
    let cancelled = false, runtime: Runtime | undefined, board: Board | undefined
    import("jsxgraph").then(module => {
      if (cancelled) return
      runtime = ((module as unknown as { default?: Runtime }).default ?? module) as unknown as Runtime
      board = runtime.JSXGraph.initBoard(element, { boundingbox: [-.17, 1.15, 1.10, -.16], keepAspectRatio: true, axis: false, showCopyright: false, showNavigation: false, pan: { enabled: false }, zoom: { enabled: false } })
      boardRef.current = board
      const fixed = { fixed: true, highlight: false }
      for (const v of [0, .25, .5, .75, 1]) {
        board.create("segment", [[v, 0], [v, 1]], { ...fixed, strokeColor: "#DBE5E9", strokeWidth: 1 })
        board.create("segment", [[0, v], [1, v]], { ...fixed, strokeColor: "#DBE5E9", strokeWidth: 1 })
        board.create("text", [v, -.065, String(v)], { ...fixed, fontSize: 11, anchorX: "middle", strokeColor: "#5F7783" })
        board.create("text", [-.04, v, String(v)], { ...fixed, fontSize: 11, anchorX: "right", strokeColor: "#5F7783" })
      }
      board.create("segment", [[0, 0], [1, 0]], { ...fixed, strokeColor: "#456375", strokeWidth: 2 })
      board.create("segment", [[0, 0], [0, 1]], { ...fixed, strokeColor: "#456375", strokeWidth: 2 })
      board.create("text", [.5, -.12, "FPR · 误报率"], { ...fixed, anchorX: "middle", fontSize: 12, strokeColor: "#375B70" })
      board.create("text", [0, 1.095, "TPR · 召回率"], { ...fixed, fontSize: 12, strokeColor: "#375B70" })
      board.create("segment", [[0, 0], [1, 1]], { ...fixed, dash: 2, strokeColor: "#A4B6BF", strokeWidth: 2 })
      if (area) board.create("polygon", [...points.map(p => [p.fpr, p.tpr]), [1, 0]], { ...fixed, fillColor: "#59A794", fillOpacity: .17, vertices: { visible: false }, borders: { strokeOpacity: 0 } })
      points.slice(1).forEach((p, i) => board?.create("segment", [[points[i].fpr, points[i].tpr], [p.fpr, p.tpr]], { ...fixed, strokeColor: "#287966", strokeWidth: 3, visible: () => i + 1 < state.current.revealed }))
      points.forEach((p, i) => {
        const point = board?.create("point", [p.fpr, p.tpr], { name: "", fixed: true, size: 3, fillColor: "#FFFFFF", strokeColor: "#287966", visible: () => i < state.current.revealed }) as { on: (event: string, fn: () => void) => void }
        point.on("up", () => pickRef.current?.(i))
      })
      board.create("point", [() => state.current.current.fpr, () => state.current.current.tpr], { fixed: true, name: "", size: 7, fillColor: "#C25B39", strokeColor: "#FFFFFF", strokeWidth: 2 })
      setStatus("ready")
    }).catch(() => { if (!cancelled) setStatus("fallback") })
    return () => { cancelled = true; boardRef.current = null; if (board && runtime) runtime.JSXGraph.freeBoard(board) }
    // The curve's numerical geometry owns this board; current state uses callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, area])
  return <figure className="se-plot" data-chart-status={status}><div ref={el} className="se-roc-board" aria-label="ROC 坐标图，横轴 FPR、纵轴 TPR" />{status !== "ready" && <><p role="status">{status === "loading" ? "坐标组件正在加载。" : "图形组件未加载。"} 坐标备份表与阈值计算仍然可用。</p><table><thead><tr><th>阈值</th><th>FPR</th><th>TPR</th></tr></thead><tbody>{points.slice(0, revealed).map((p, i) => <tr key={i}><td>{Number.isFinite(p.threshold) ? p.threshold : "+∞"}</td><td>{p.fpr}</td><td>{p.tpr}</td></tr>)}</tbody></table></>}<figcaption>橙点：当前阈值 · 绿线：ROC · 虚线：对角参考线<br />JSXGraph 精确坐标{onPick ? " · 可点选绿线上的阈值点" : " · 由上方分数方案计算"}</figcaption></figure>
}
