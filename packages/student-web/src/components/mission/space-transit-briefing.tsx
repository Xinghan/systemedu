"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, FileText, X } from "lucide-react"
import { routeStations } from "@/lib/project-lines/space-curriculum"
import { TRANSIT_ACTS } from "@/lib/project-lines/space-transit-presentation"
import s from "./space-journey.module.css"
import b from "./space-transit-briefing.module.css"

export function TransitBriefingDialog({ stationId, close }: { stationId: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const act = TRANSIT_ACTS.find(item => item.id === stationId) || TRANSIT_ACTS[0]
  const station = routeStations("transit").find(item => item.id === act.id)!
  useEffect(() => {
    const element = dialog.current, opener = document.activeElement
    element?.showModal()
    return () => { element?.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={dialog} className={b.dialog} aria-labelledby="transit-briefing-title" data-transit-briefing={act.id} onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }}>
    <header><span>{station.code} / 任务简报 · 文字</span><button aria-label="关闭任务简报" onClick={close}><X size={20}/></button></header>
    <div className={b.body}><p className={b.kicker}>任务搭档 / 林岚</p><h2 id="transit-briefing-title">{station.place}</h2><p className={b.message}>{act.briefing}</p><dl><div><dt>带着什么来</dt><dd>{station.input}</dd></div><div><dt>这一站带走什么</dt><dd>{station.handoff}</dd></div><div><dt>怎样检查</dt><dd>{station.gate}</dd></div></dl></div>
    <footer><small>林岚 / AI 生成的虚构任务搭档</small><button onClick={close}>回到当前任务<ArrowRight size={16}/></button></footer>
  </dialog>
}

export function TransitStageBriefing({ stationId }: { stationId: string; auto?: boolean }) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className={s.stageReplay} onClick={() => setOpen(true)} data-stage-briefing={stationId}><FileText size={14}/>阅读本站任务简报</button>{open && <TransitBriefingDialog stationId={stationId} close={() => setOpen(false)}/>}</>
}
