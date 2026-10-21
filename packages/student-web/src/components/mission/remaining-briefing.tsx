"use client"

import { useEffect, useRef, useState } from "react"
import { Play } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { REMAINING_MISSIONS, type RemainingMissionId } from "@/lib/project-lines/remaining-missions"
import { remainingStageFilm, hasSeenRemainingFilm, rememberRemainingFilm } from "@/lib/project-lines/remaining-stage-films"
import { IntroFilm } from "./mission-film-dialog"
import s from "./energy-journey.module.css"

export function RemainingBriefing({ missionId, stationId, auto = true }: { missionId: RemainingMissionId; stationId: string; auto?: boolean }) {
  const { owner } = useLearningIdentity()
  return <BriefingSession key={owner+missionId+stationId} missionId={missionId} stationId={stationId} owner={owner} auto={auto}/>
}

function BriefingSession({ missionId, stationId, owner, auto }: { missionId: RemainingMissionId; stationId: string; owner: string; auto: boolean }) {
  const station = REMAINING_MISSIONS[missionId].stations.find(s=>s.id===stationId)!, media = remainingStageFilm(missionId, stationId)
  const trigger = useRef<HTMLButtonElement>(null)
  const openedOwner = useRef(owner)
  const [playing, setPlaying] = useState<{ automatic: boolean; autoplay: boolean } | null>(null)
  useEffect(() => {
    let active = true
    const arrive = () => queueMicrotask(() => {
      if (!active || !auto || playing || document.hidden || hasSeenRemainingFilm(missionId, owner, stationId)) return
      openedOwner.current = owner
      setPlaying({ automatic: true, autoplay: !matchMedia("(prefers-reduced-motion: reduce)").matches })
    })
    arrive()
    document.addEventListener("visibilitychange", arrive)
    return () => { active = false; document.removeEventListener("visibilitychange", arrive) }
  }, [auto, owner, missionId, stationId, playing])
  const close = () => {
    rememberRemainingFilm(missionId, openedOwner.current, stationId)
    // Identity hydration must not immediately reopen a dismissed briefing.
    rememberRemainingFilm(missionId, owner, stationId)
    setPlaying(null)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  return <>
    <button type="button" ref={trigger} className={s.textButton} data-remaining-briefing-replay onClick={() => {
      openedOwner.current = owner
      setPlaying({ automatic: false, autoplay: true })
    }}><Play size={15}/>任务短片 · {station.place}</button>
    {playing && <IntroFilm media={media} stationId={stationId} companion={media.presenterName}
      poster={media.poster}
      autoPlay={playing.autoplay} close={close} onEnded={close}
      returnLabel={playing.automatic ? "跳过短片，开始任务" : "回到当前任务"}
      description={`这一站带走：${station.handoff}。交接前检查：${station.gate}。`}
      transcript={`${media.dialogue}\n\n${media.brief}`}/>
    }
  </>
}
