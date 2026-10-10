"use client"

/* eslint-disable @next/next/no-img-element -- Precompressed, responsive scene assets. */
import { useEffect, useRef, useState, type RefObject } from "react"
import { ArrowRight } from "lucide-react"
import type { MissionStation } from "@/lib/project-lines/space-curriculum"
import s from "./mission-room-environment.module.css"

const FALLBACK = "/mission/space/research-control-room-v1"
const ROOMS: Record<string, string> = {
  "first-contact": "OBSERVATION PORT",
  "mission-design": "MISSION PLANNING",
  mechanics: "STRUCTURES LAB",
  build: "ADDITIVE FABRICATION",
  perception: "PERCEPTION LAB",
  autonomy: "SYSTEMS INTEGRATION",
  expedition: "FIELD OPERATIONS",
  delivery: "MISSION REVIEW",
}
export const missionRoomLabel = (station: string) => ROOMS[station] || "RESEARCH CONTROL"

export function MissionRoomBackdrop({ station, className, imageRef, fullViewport = false }: {
  station: string; className?: string; imageRef?: RefObject<HTMLImageElement | null>; fullViewport?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const localImage = useRef<HTMLImageElement>(null)
  const base = failed || !ROOMS[station] ? FALLBACK : `/mission/space/stations/${station}-v1`
  useEffect(() => {
    let active = true
    // A server-rendered image can fail before React attaches its error listener.
    void localImage.current?.decode().catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [station])
  return <picture className={className} aria-hidden="true" data-room-background={station}>
    <source media="(max-width: 760px)" srcSet={fullViewport ? `${base}-1536.webp` : `${base}-640.webp 1x, ${base}-960.webp 2x`} />
    <img ref={node => { localImage.current = node; if (imageRef) imageRef.current = node }} src={`${base}-1536.webp`} srcSet={`${base}-960.webp 960w, ${base}-1536.webp 1536w`} sizes="100vw" width={1536} height={864} alt="" fetchPriority="high" decoding="async" onError={() => setFailed(true)} />
  </picture>
}

/** Only this transient visual layer remounts; forms, clocks and record hooks stay alive. */
export function MissionRoomArrival({ station, moduleName, root }: {
  station: MissionStation; moduleName: string; root: RefObject<HTMLElement | null>
}) {
  const layer = useRef<HTMLDivElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const skip = useRef<() => void>(() => {})

  useEffect(() => {
    const element = layer.current
    if (!element) return
    element.hidden = false
    element.dataset.phase = "preparing"
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let stopped = false, started = false
    const animations: Animation[] = []
    let finishTimer: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      stopped = true
      clearTimeout(finishTimer); clearTimeout(loadTimer)
      animations.forEach(animation => animation.cancel())
      element.hidden = true
      element.dataset.phase = "finished"
    }
    skip.current = finish
    const start = () => {
      if (stopped || started) return
      started = true
      clearTimeout(loadTimer)
      if (motion.matches) { finish(); return }
      element.dataset.phase = "playing"
      const panels = root.current?.querySelectorAll<HTMLElement>("[data-room-reveal]") || []
      panels.forEach(panel => {
        const direction = panel.dataset.roomReveal
        const offset = direction === "left" ? "translateX(-38px)" : direction === "right" ? "translateX(38px)" : "translateY(26px)"
        const delay = direction === "title" ? 700 : direction === "chrome" ? 800 : direction === "left" ? 950 : direction === "right" ? 1100 : 1000
        animations.push(panel.animate([
          { opacity: 0, transform: offset },
          { opacity: 1, transform: "translate(0,0)" },
        ], { duration: 580, delay, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" }))
      })
      finishTimer = setTimeout(finish, 1720)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Tab") finish()
    }
    const onMotion = () => { if (motion.matches) finish() }
    window.addEventListener("keydown", onKey)
    motion.addEventListener("change", onMotion)
    // Image decoding is bounded; slow or failed media never blocks access to work.
    const loadTimer = setTimeout(start, 450)
    if (motion.matches) finish()
    else if (image.current) void image.current.decode().then(start, start)
    else start()
    return () => {
      finish()
      window.removeEventListener("keydown", onKey)
      motion.removeEventListener("change", onMotion)
    }
  }, [root])

  return <div ref={layer} className={s.arrival} data-room-arrival={station.id} data-phase="preparing" aria-label="任务舱入场">
    <MissionRoomBackdrop station={station.id} className={s.scene} imageRef={image} fullViewport />
    <div className={s.frame} aria-hidden="true" />
    <div className={s.coordinates} aria-hidden="true"><span>星际远航 / 研究基地</span><span>{station.code} — {missionRoomLabel(station.id)}</span></div>
    <div className={s.caption}>
      <p>{station.code} <span>/</span> {missionRoomLabel(station.id)}</p>
      <h2>{station.place}</h2>
      <div className={s.module}><span />进入{moduleName}<ArrowRight size={17} /></div>
    </div>
    <button type="button" className={s.skip} onClick={() => skip.current()}>跳过入场 <span>Esc</span></button>
    <small className={s.disclaimer}>科研场景示意 · AI 生成</small>
  </div>
}
