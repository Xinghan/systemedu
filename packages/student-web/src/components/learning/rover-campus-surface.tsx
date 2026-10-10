"use client"

/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { Check, Compass, LocateFixed, MapPin, Minus, Plus } from "lucide-react"
import type { MissionNodeStatus } from "@/lib/project-lines/rover-mission"
import s from "./rover-campus-map.module.css"

export type CampusStop = { id: string; x: number; y: number; path?: string; label: string; statusLabel: string; state: MissionNodeStatus }
export const ROVER_CAMPUS_POINTS = [
  { id: "M01", x: 230, y: 302, path: "M230 302 Q320 308 385 265 Q475 224 599 245" },
  { id: "M02", x: 599, y: 245, path: "M599 245 Q720 234 780 238 Q855 272 952 286" },
  { id: "M03", x: 952, y: 286, path: "M952 286 Q1110 291 1200 346 Q1265 369 1321 369" },
  { id: "M04", x: 1321, y: 369, path: "M1321 369 Q1433 401 1437 473 Q1456 541 1494 573 Q1540 680 1321 741" },
  { id: "M05", x: 1321, y: 741, path: "M1321 741 Q1244 740 1188 746 Q1105 790 952 794" },
  { id: "M06", x: 952, y: 794, path: "M952 794 Q825 786 750 766 Q642 753 553 753" },
  { id: "M07", x: 553, y: 753, path: "M553 753 Q411 722 374 668 Q337 628 215 655" },
  { id: "M08", x: 215, y: 655 },
] as const

export function RoverCampusSurface({ stops, current, selected, onSelect, onUnavailable, title, subtitle, mapMotto, taskId, imageSrc = "/mission/rover/campus-map-v1.webp", imageAlt = "研发基地鸟瞰图，八个任务站由道路相连。" }: {
  stops: CampusStop[]; current: string; selected: string; onSelect: (id: string) => void; onUnavailable?: () => void
  title: string; subtitle: string; mapMotto: string; taskId: string; imageSrc?: string; imageAlt?: string
}) {
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading")
  const [dragging, setDragging] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const background = useRef<HTMLImageElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const pendingCenter = useRef<{ x: number; y: number } | null>(null)
  const uid = useId().replace(/:/g, "")
  const mapWidth = Math.max(880, width) * zoom
  const mapHeight = mapWidth * 2 / 3

  useEffect(() => {
    // A cached image can finish before React hydrates its load/error handlers.
    if (background.current?.complete) setImageState(background.current.naturalWidth ? "ready" : "error")
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0) setWidth(entry.contentRect.width) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { if (imageState === "error") onUnavailable?.() }, [imageState, onUnavailable])

  const { x: selectedX, y: selectedY } = stops.find(n => n.id === selected) ?? stops[0]
  // Also runs when an initially closed in-lesson map becomes measurable.
  useLayoutEffect(() => {
    if (!width) return
    const element = viewport.current
    if (element) element.scrollTo({ left: selectedX / 1536 * element.scrollWidth - element.clientWidth / 2, top: selectedY / 1024 * element.scrollHeight - element.clientHeight / 2 })
  }, [selectedX, selectedY, width])

  useLayoutEffect(() => {
    const element = viewport.current, point = pendingCenter.current
    if (element && point) {
      element.scrollTo({ left: point.x * mapWidth - element.clientWidth / 2, top: point.y * mapHeight - element.clientHeight / 2 })
      pendingCenter.current = null
    }
  }, [mapWidth, mapHeight])

  function locate(id: string) {
    const station = stops.find(n => n.id === id) ?? stops[0]
    const element = viewport.current
    if (element) element.scrollTo({ left: station.x / 1536 * mapWidth - element.clientWidth / 2, top: station.y / 1024 * mapHeight - element.clientHeight / 2 })
  }
  function select(nextIndex: number, focus = false) {
    const i = Math.max(0, Math.min(stops.length - 1, nextIndex))
    onSelect(stops[i].id)
    if (focus) buttons.current[i]?.focus({ preventScroll: true })
    locate(stops[i].id)
  }
  function changeZoom(delta: number) {
    const element = viewport.current
    if (element) pendingCenter.current = { x: (element.scrollLeft + element.clientWidth / 2) / mapWidth, y: (element.scrollTop + element.clientHeight / 2) / mapHeight }
    setZoom(value => Math.max(1, Math.min(1.75, value + delta)))
  }

  return <>
    <header className={s.toolbar}>
      <div><Compass size={18} /><span><strong>{title}</strong><small>{subtitle}</small></span></div>
      <div className={s.controls}>
        <button onClick={() => { onSelect(current); locate(current) }} disabled={imageState === "error"} aria-label="定位当前任务"><LocateFixed size={16} /><span>当前任务</span></button>
        <div className={s.zoom}><button aria-label="缩小地图" onClick={() => changeZoom(-.25)} disabled={zoom === 1 || imageState === "error"}><Minus size={16} /></button><output aria-label="地图缩放比例">{Math.round(zoom * 100)}%</output><button aria-label="放大地图" onClick={() => changeZoom(.25)} disabled={zoom === 1.75 || imageState === "error"}><Plus size={16} /></button></div>
      </div>
    </header>
    <div className={s.mapFrame} hidden={imageState === "error"}>
      <div className={s.viewport} ref={viewport} data-campus-viewport data-dragging={dragging} style={{ height: width ? Math.min(760, Math.max(400, width * 2 / 3)) : 500 }} aria-label="可拖动的研发基地地图" role="group"
        onPointerDown={e => {
          suppressClick.current = false
          if (e.pointerType !== "mouse" || e.button !== 0) return
          drag.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop, moved: false }
        }}
        onPointerMove={e => {
          const start = drag.current
          if (!start || e.buttons !== 1) return
          const dx = e.clientX - start.x, dy = e.clientY - start.y
          if (!start.moved && Math.hypot(dx, dy) > 6) { start.moved = true; e.currentTarget.setPointerCapture(e.pointerId); setDragging(true) }
          if (start.moved) { e.currentTarget.scrollLeft = start.left - dx; e.currentTarget.scrollTop = start.top - dy }
        }}
        onPointerUp={() => { suppressClick.current = !!drag.current?.moved; drag.current = null; setDragging(false) }}
        onPointerCancel={() => { drag.current = null; suppressClick.current = false; setDragging(false) }}
        onClickCapture={e => { if (suppressClick.current && e.detail !== 0) { e.preventDefault(); e.stopPropagation() }; suppressClick.current = false }}>
        <div className={s.surface} style={{ width: mapWidth, height: mapHeight }}>
          <img ref={background} src={imageSrc} width={1536} height={1024} alt={imageAlt} draggable={false} loading="lazy" onLoad={() => setImageState("ready")} onError={() => setImageState("error")} />
          <svg className={s.routes} viewBox="0 0 1536 1024" aria-hidden="true">
            <defs><marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1 L8 5 L2 9" fill="none" stroke="#f5efdb" strokeWidth="1.8" /></marker></defs>
            {stops.map(station => station.path && <g key={station.id} data-submitted={station.state === "submitted"}>
              <path d={station.path} className={s.routeShadow} />
              <path d={station.path} className={s.route} pathLength={100} markerMid={`url(#${uid}-arrow)`} />
            </g>)}
          </svg>
          <div className={s.terrainNote} aria-hidden="true"><span>晨光 / EXPLORATION CAMPUS</span><strong>{mapMotto}</strong></div>
          {stops.map((station, i) => {
            const state = station.state
            return <button key={station.id} ref={el => { buttons.current[i] = el }} className={s.station} style={{ left: `${station.x / 1536 * 100}%`, top: `${station.y / 1024 * 100}%` }}
              data-mission-node={station.id} data-status={state} aria-pressed={selected === station.id} aria-current={current === station.id ? "step" : undefined} aria-controls={taskId}
              aria-label={`${station.id} ${station.label}，${station.statusLabel}${current === station.id ? "，当前任务" : ""}`}
              onFocus={e => { if (e.currentTarget.matches(":focus-visible")) locate(station.id) }} onClick={() => select(i)} onKeyDown={e => {
                const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? stops.length - 1 : null
                if (next !== null) { e.preventDefault(); select(next, true) }
              }}>
              <span className={s.stationTop}><span className={s.number}>{state === "submitted" ? <Check size={15} /> : String(i + 1).padStart(2, "0")}</span><strong>{station.label}</strong></span>
              <span className={s.stationStatus}>{current === station.id && <MapPin size={11} />}{current === station.id ? "当前 · " : ""}{station.statusLabel}</span>
            </button>
          })}
        </div>
      </div>
      {imageState === "loading" && <div className={s.loading} role="status"><Compass size={24} /><span>正在展开基地地图…</span></div>}
    </div>
    {imageState === "error" && <p className={s.error} role="status">基地图片暂时无法加载。你可以用下方目录继续进入课程，学习记录不受影响。</p>}
  </>
}
