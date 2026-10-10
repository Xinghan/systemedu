"use client"

import { useEffect, useRef, useState } from "react"
import { Play } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { bioStation } from "@/lib/project-lines/biomed-mission"
import { biomedStageFilm, hasSeenBiomedFilm, rememberBiomedFilm } from "@/lib/project-lines/biomed-stage-films"
import { IntroFilm } from "./mission-film-dialog"
import s from "./biomed-journey.module.css"

export function BiomedBriefing({ stationId, auto = true }: { stationId: string; auto?: boolean }) {
  const { owner } = useLearningIdentity()
  return <BriefingSession key={stationId} stationId={stationId} owner={owner} auto={auto}/>
}

function BriefingSession({ stationId, owner, auto }: { stationId: string; owner: string; auto: boolean }) {
  const station = bioStation(stationId)!, media = biomedStageFilm(stationId)
  const trigger = useRef<HTMLButtonElement>(null)
  const openedOwner = useRef(owner)
  const [playing, setPlaying] = useState<{ automatic: boolean; autoplay: boolean } | null>(null)
  useEffect(() => {
    let active = true
    const arrive = () => queueMicrotask(() => {
      if (!active || !auto || playing || document.hidden || hasSeenBiomedFilm(owner, stationId)) return
      openedOwner.current = owner
      setPlaying({ automatic: true, autoplay: !matchMedia("(prefers-reduced-motion: reduce)").matches })
    })
    arrive()
    document.addEventListener("visibilitychange", arrive)
    return () => { active = false; document.removeEventListener("visibilitychange", arrive) }
  }, [auto, owner, stationId, playing])
  const close = () => {
    rememberBiomedFilm(openedOwner.current, stationId)
    // Identity hydration must not immediately reopen a dismissed briefing.
    rememberBiomedFilm(owner, stationId)
    setPlaying(null)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  return <>
    <button type="button" ref={trigger} className={s.textButton} data-biomed-briefing-replay onClick={() => {
      openedOwner.current = owner
      setPlaying({ automatic: false, autoplay: true })
    }}><Play size={15}/>任务短片 · {station.place}</button>
    {playing && <IntroFilm media={media} stationId={stationId} companion="陈澄"
      poster="/mission/biomedicine/stations/observation-v1-1536.webp"
      autoPlay={playing.autoplay} close={close} onEnded={close}
      returnLabel={playing.automatic ? "跳过短片，开始任务" : "回到当前任务"}
      description={`这一站带走：${station.handoff}。交接前检查：${station.gate}。`}
      transcript={`${media.dialogue}\n\n${media.brief}`}/>
    }
  </>
}
