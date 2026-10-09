"use client"

import { useCallback, useEffect, useState } from "react"
import { Play } from "lucide-react"
import { hasSeenStageFilm, rememberStageFilm, spaceStageFilm, type SpaceStage } from "@/lib/project-lines/space-stage-films"
import { IntroFilm } from "./mission-film-dialog"
import s from "./space-journey.module.css"

/** Keep this hook above account-keyed content so hydration cannot interrupt playback. */
export function useSpaceStageFilm(level: SpaceStage | null, enabled = true) {
  const [playing, setPlaying] = useState<{ level: SpaceStage; automatic: boolean } | null>(null)
  useEffect(() => {
    let active = true
    const arrive = () => queueMicrotask(() => {
      if (active && enabled && level && !playing && !document.hidden && !hasSeenStageFilm(level)) {
        rememberStageFilm(level)
        setPlaying({ level, automatic: true })
      }
    })
    arrive()
    document.addEventListener("visibilitychange", arrive)
    return () => { active = false; document.removeEventListener("visibilitychange", arrive) }
  }, [level, enabled, playing])
  const replay = useCallback(() => {
    if (level) { rememberStageFilm(level); setPlaying({ level, automatic: false }) }
  }, [level])
  const close = () => {
    const automatic = playing?.automatic
    setPlaying(null)
    if (automatic) requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-stage-replay]")?.focus({ preventScroll: true }))
  }
  const media = playing && spaceStageFilm(playing.level)
  return { replay, dialog: media && <IntroFilm key={media.level} media={media} close={close} autoPlay onEnded={close} description={media.description} returnLabel={playing.automatic ? "跳过短片，开始任务" : "回到当前任务"} /> }
}

export function SpaceStageBriefing({ level, enabled = true }: { level: SpaceStage; enabled?: boolean }) {
  const { replay, dialog } = useSpaceStageFilm(level, enabled)
  return <><button type="button" className={s.stageReplay} data-stage-replay={level} onClick={replay}><Play size={14} />阶段 0{level} · 任务短片</button>{dialog}</>
}
