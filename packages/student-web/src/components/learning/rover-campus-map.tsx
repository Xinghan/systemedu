"use client"

/* One authored background; navigation and progress remain accessible HTML. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link"
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ArrowRight, Check, ChevronLeft, ChevronRight, Compass, FileCheck2, List, LocateFixed, MapPin, Minus, Plus } from "lucide-react"
import type { GuidedCourse } from "@/lib/project-lines/guided-course"
import type { CourseRecord } from "@/lib/project-lines/guided-progress"
import { MISSION_STATUS_LABEL, ROVER_BRIEFS, missionNodeHref, missionNodeStatus } from "@/lib/project-lines/rover-mission"
import s from "./rover-campus-map.module.css"

export type RoverMapProps = { course: GuidedCourse; record: CourseRecord; loaded: boolean; failed: string[]; current?: string }

// Coordinates and paths follow the entrances in campus-map-v1, in a 1536 × 1024 plane.
const STATIONS = [
  { id: "M01", x: 230, y: 302, path: "M230 302 Q320 308 385 265 Q475 224 599 245" },
  { id: "M02", x: 599, y: 245, path: "M599 245 Q720 234 780 238 Q855 272 952 286" },
  { id: "M03", x: 952, y: 286, path: "M952 286 Q1110 291 1200 346 Q1265 369 1321 369" },
  { id: "M04", x: 1321, y: 369, path: "M1321 369 Q1433 401 1437 473 Q1456 541 1494 573 Q1540 680 1321 741" },
  { id: "M05", x: 1321, y: 741, path: "M1321 741 Q1244 740 1188 746 Q1105 790 952 794" },
  { id: "M06", x: 952, y: 794, path: "M952 794 Q825 786 750 766 Q642 753 553 753" },
  { id: "M07", x: 553, y: 753, path: "M553 753 Q411 722 374 668 Q337 628 215 655" },
  { id: "M08", x: 215, y: 655 },
] as const

export function RoverCampusMap({ course, record, loaded, failed, current = "M01", children }: RoverMapProps & { children: ReactNode }) {
  const [selected, setSelected] = useState(current)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading")
  const [dragging, setDragging] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const background = useRef<HTMLImageElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const manualSelection = useRef(false)
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const pendingCenter = useRef<{ x: number; y: number } | null>(null)
  const uid = useId().replace(/:/g, "")
  const mapWidth = Math.max(880, width) * zoom
  const mapHeight = mapWidth * 2 / 3
  const index = Math.max(0, STATIONS.findIndex(n => n.id === selected))
  const node = course.modules.find(n => n.module_id === STATIONS[index].id)!
  const brief = ROVER_BRIEFS[node.module_id]
  const statusFor = (id: string) => missionNodeStatus(record.nodes[id], loaded, failed.includes(id))
  const status = statusFor(node.module_id)
  const stageIndex = course.stages.findIndex(stage => stage.stage_id === node.stage_id)

  useEffect(() => {
    // A cached image can finish before React hydrates its load/error handlers.
    if (background.current?.complete) setImageState(background.current.naturalWidth ? "ready" : "error")
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0) setWidth(entry.contentRect.width) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { if (!manualSelection.current) setSelected(current) }, [current])

  // Also runs when an initially closed in-lesson map becomes measurable.
  useLayoutEffect(() => {
    if (!width) return
    const station = STATIONS.find(n => n.id === current) ?? STATIONS[0]
    const element = viewport.current
    if (element) element.scrollTo({ left: station.x / 1536 * element.scrollWidth - element.clientWidth / 2, top: station.y / 1024 * element.scrollHeight - element.clientHeight / 2 })
  }, [current, width])

  useLayoutEffect(() => {
    const element = viewport.current, point = pendingCenter.current
    if (element && point) {
      element.scrollTo({ left: point.x * mapWidth - element.clientWidth / 2, top: point.y * mapHeight - element.clientHeight / 2 })
      pendingCenter.current = null
    }
  }, [mapWidth, mapHeight])

  function locate(id: string) {
    const station = STATIONS.find(n => n.id === id) ?? STATIONS[0]
    const element = viewport.current
    if (element) element.scrollTo({ left: station.x / 1536 * mapWidth - element.clientWidth / 2, top: station.y / 1024 * mapHeight - element.clientHeight / 2 })
  }
  function select(nextIndex: number, focus = false) {
    const i = Math.max(0, Math.min(STATIONS.length - 1, nextIndex))
    manualSelection.current = true
    setSelected(STATIONS[i].id)
    if (focus) buttons.current[i]?.focus({ preventScroll: true })
    locate(STATIONS[i].id)
  }
  function changeZoom(delta: number) {
    const element = viewport.current
    if (element) pendingCenter.current = { x: (element.scrollLeft + element.clientWidth / 2) / mapWidth, y: (element.scrollTop + element.clientHeight / 2) / mapHeight }
    setZoom(value => Math.max(1, Math.min(1.75, value + delta)))
  }

  return <div className={s.campus} data-campus-map>
    <header className={s.toolbar}>
      <div><Compass size={18} /><span><strong>晨光探测车研发基地</strong><small>8 个地点 · 一辆你亲手造的车</small></span></div>
      <div className={s.controls}>
        <button onClick={() => { manualSelection.current = false; setSelected(current); locate(current) }} disabled={imageState === "error"} aria-label="定位当前任务"><LocateFixed size={16} /><span>当前任务</span></button>
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
          <img ref={background} src="/mission/rover/campus-map-v1.webp" width={1536} height={1024} alt="沙漠研发基地鸟瞰图：道路依次连接控制室、系统实验室、设计与诊断车间、户外试验场、3D 打印间、装配台和交付广场。" draggable={false} loading="lazy" onLoad={() => setImageState("ready")} onError={() => setImageState("error")} />
          <svg className={s.routes} viewBox="0 0 1536 1024" aria-hidden="true">
            <defs><marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1 L8 5 L2 9" fill="none" stroke="#f5efdb" strokeWidth="1.8" /></marker></defs>
            {STATIONS.map(station => "path" in station && <g key={station.id} data-submitted={statusFor(station.id) === "submitted"}>
              <path d={station.path} className={s.routeShadow} />
              <path d={station.path} className={s.route} pathLength={100} markerMid={`url(#${uid}-arrow)`} />
            </g>)}
          </svg>
          <div className={s.terrainNote} aria-hidden="true"><span>晨光 / ROVER CAMPUS</span><strong>从想法，到第一辆实物车。</strong><small>控制与设计 → 验证 → 制造与交付</small></div>
          {STATIONS.map((station, i) => {
            const state = statusFor(station.id)
            return <button key={station.id} ref={el => { buttons.current[i] = el }} className={s.station} style={{ left: `${station.x / 1536 * 100}%`, top: `${station.y / 1024 * 100}%` }}
              data-mission-node={station.id} data-status={state} aria-pressed={selected === station.id} aria-current={current === station.id ? "step" : undefined} aria-controls={`${uid}-task`}
              aria-label={`${station.id} ${ROVER_BRIEFS[station.id].place}，${MISSION_STATUS_LABEL[state]}${current === station.id ? "，当前任务" : ""}`}
              onFocus={e => { if (e.currentTarget.matches(":focus-visible")) locate(station.id) }} onClick={() => select(i)} onKeyDown={e => {
                const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? STATIONS.length - 1 : null
                if (next !== null) { e.preventDefault(); select(next, true) }
              }}>
              <span className={s.stationTop}><span className={s.number}>{state === "submitted" ? <Check size={15} /> : String(i + 1).padStart(2, "0")}</span><strong>{ROVER_BRIEFS[station.id].place}</strong></span>
              <span className={s.stationStatus}>{current === station.id && <MapPin size={11} />}{current === station.id ? "当前 · " : ""}{MISSION_STATUS_LABEL[state]}</span>
            </button>
          })}
        </div>
      </div>
      {imageState === "loading" && <div className={s.loading} role="status"><Compass size={24} /><span>正在展开基地地图…</span></div>}
    </div>
    {imageState === "error" && <p className={s.error} role="status">基地图片暂时无法加载。你可以用下方目录继续进入课程，学习记录不受影响。</p>}
    <div className={s.mapFooter}><span>拖动探索 · ＋ / − 缩放 · 点击地点查看任务</span><div><span><i className={s.submittedDot} />记录已提交</span><span><i className={s.draftDot} />有草稿</span><span><i className={s.currentDot} />当前任务</span></div></div>
    <section id={`${uid}-task`} className={s.task} aria-label="所选地点的任务" data-campus-task={node.module_id}>
      <div className={s.taskNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
      <div className={s.taskBody}>
        <p className={s.eyebrow}>阶段 {String(stageIndex + 1).padStart(2, "0")} / {course.stages[stageIndex]?.title} <span aria-live="polite">{MISSION_STATUS_LABEL[status]}</span></p>
        <h3>{brief.place}<span>{node.title}</span></h3>
        <p className={s.action}>{brief.action}</p>
        <div className={s.output}><FileCheck2 size={16} /><span><small>这次带回的作品</small>{node.output}</span></div>
      </div>
      <div className={s.taskActions}>
        <Link href={missionNodeHref(node.module_id)} data-campus-enter>{status === "submitted" ? "回看任务" : "进入任务"}<ArrowRight size={17} /></Link>
        <span>{node.estimated_minutes} 分钟目标 · 可分次完成</span>
        <div className={s.nextPrevious}><button aria-label="上一个地点" disabled={index === 0} onClick={() => select(index - 1)}><ChevronLeft size={16} /></button><small>{index + 1} / 8</small><button aria-label="下一个地点" disabled={index === 7} onClick={() => select(index + 1)}><ChevronRight size={16} /></button></div>
      </div>
    </section>
    <details key={imageState === "error" ? "fallback" : "directory"} className={s.directory} open={imageState === "error" || undefined}><summary><List size={16} />简洁目录 · 查看全部 8 个节点</summary>{children}</details>
    <p className={s.caption}>AI 生成的虚构研发基地，用来呈现学习路线。地图标记学习记录，作品验收以实际提交的材料为准。</p>
  </div>
}
