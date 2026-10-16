"use client"

import { useEffect, useRef, useState } from "react"
import { Play } from "lucide-react"
import { useLearningIdentity } from "@/lib/hooks/use-learning-record"
import { ROBOTICS_MISSION } from "@/lib/project-lines/robotics-mission"
const roboticsStation=(id:string)=>ROBOTICS_MISSION.stations.find(s=>s.id===id)
import { roboticsStageFilm, hasSeenRoboticsFilm, rememberRoboticsFilm } from "@/lib/project-lines/robotics-stage-films"
import { IntroFilm } from "./mission-film-dialog"
import s from "./energy-journey.module.css"

export function RoboticsBriefing({ stationId, auto = true }: { stationId: string; auto?: boolean }) {
  const { owner } = useLearningIdentity()
  return <BriefingSession key={owner+stationId} stationId={stationId} owner={owner} auto={auto}/>
}

function BriefingSession({ stationId, owner, auto }: { stationId: string; owner: string; auto: boolean }) {
  const station = roboticsStation(stationId)!, media = roboticsStageFilm(stationId)
  const trigger = useRef<HTMLButtonElement>(null)
  const openedOwner = useRef(owner)
  const [playing, setPlaying] = useState<{ automatic: boolean; autoplay: boolean } | null>(null)
  useEffect(() => {
    let active = true
    const arrive = () => queueMicrotask(() => {
      if (!active || !auto || playing || document.hidden || hasSeenRoboticsFilm(owner, stationId)) return
      openedOwner.current = owner
      setPlaying({ automatic: true, autoplay: !matchMedia("(prefers-reduced-motion: reduce)").matches })
    })
    arrive()
    document.addEventListener("visibilitychange", arrive)
    return () => { active = false; document.removeEventListener("visibilitychange", arrive) }
  }, [auto, owner, stationId, playing])
  const close = () => {
    rememberRoboticsFilm(openedOwner.current, stationId)
    // Identity hydration must not immediately reopen a dismissed briefing.
    rememberRoboticsFilm(owner, stationId)
    setPlaying(null)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  return <>
    <button type="button" ref={trigger} className={s.textButton} data-robotics-briefing-replay onClick={() => {
      openedOwner.current = owner
      setPlaying({ automatic: false, autoplay: true })
    }}><Play size={15}/>任务短片 · {station.place}</button>
    {playing && <IntroFilm media={media} stationId={stationId} companion="机器人实验室"
      poster={media.poster}
      autoPlay={playing.autoplay} close={close} onEnded={close}
      returnLabel={playing.automatic ? "跳过短片，开始任务" : "回到当前任务"}
      description={`这一站带走：${station.handoff}。交接前检查：${station.gate}。`}
      transcript={`${media.dialogue}\n\n${media.brief}`}/>
    }
  </>
}
