"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronRight, LoaderCircle, Pause, Play, RotateCcw } from "lucide-react"
import { DIALOGUE } from "@/lib/rover-opening"
import s from "./rover-opening.module.css"
import f from "./rover-briefing-film.module.css"

const CHAPTERS = [
  { start: 0, title: "你的任务搭档", text: DIALOGUE.welcome },
  { start: 8.6, title: "带回岩层的照片", text: DIALOGUE.mission },
  { start: 18.6, title: "现在，交给你", text: DIALOGUE.handover },
]

export function RoverBriefingFilm({ sound, suspended, disabled, onComplete }: {
  sound: boolean; suspended: boolean; disabled: boolean; onComplete: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(28.6)
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [error, setError] = useState(false)
  const [ended, setEnded] = useState(false)
  const chapter = time < 8.6 ? 0 : time < 18.6 ? 1 : 2

  function play(restart = false) {
    const node = video.current
    if (!node) return
    if (restart) node.currentTime = 0
    void node.play().catch(reason => {
      if (reason.name !== "AbortError") { setPlaying(false); setWaiting(false) }
    })
  }
  useEffect(() => {
    const node = video.current
    heading.current?.focus({ preventScroll: true })
    if (node?.error) queueMicrotask(() => { setError(true); setWaiting(false) })
    else play()
    const hide = () => { if (document.hidden) node?.pause() }
    document.addEventListener("visibilitychange", hide)
    return () => { node?.pause(); document.removeEventListener("visibilitychange", hide) }
  }, [])
  useEffect(() => { if (suspended) video.current?.pause() }, [suspended])

  return <>
    <div className={f.filmBackdrop}>
      <video ref={video} src="/mission/rover/video/rover-briefing-v1.mp4" poster="/mission/rover/engineer-1920.webp"
        playsInline muted={!sound} preload="metadata" aria-label="林岚讲述完整火星任务"
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
        onPlay={() => { setPlaying(true); setEnded(false) }}
        onPlaying={() => { setWaiting(false); setError(false) }}
        onWaiting={() => setWaiting(true)} onCanPlay={() => setWaiting(false)}
        onPause={() => { setPlaying(false); setWaiting(false) }}
        onEnded={() => { setEnded(true); setPlaying(false); setWaiting(false) }}
        onError={() => { setError(true); setWaiting(false); setPlaying(false) }}>
        <track kind="captions" src="/mission/rover/video/rover-briefing-zh.vtt" srcLang="zh" label="中文字幕" />
      </video>
    </div>
    <div className={s.sceneLabel}><span className={s.dot} /> MISSION BRIEFING <span>{CHAPTERS[chapter].title}</span></div>
    <div className={s.briefCount}>0{chapter + 1}<span> / 03</span></div>
    <section className={`${s.briefing} ${f.panel}`}>
      <h1 ref={heading} tabIndex={-1} className={s.srOnly}>任务简报</h1>
      <div className={s.speaker}><strong>林岚</strong><span>{chapter === 1 ? "画外讲述 · 晨光号前视相机" : "任务工程师"}</span></div>
      <p className={s.dialogue} aria-live="polite">{CHAPTERS[chapter].text}</p>
      {error && <div className={f.error} role="alert"><p>视频暂时没有加载成功。任务是：先观察三处地形，再选择路线，让晨光号自主执行，带回岩层照片。</p><button onClick={() => { setError(false); setWaiting(true); video.current?.load(); play() }}>重新加载视频</button></div>}
      <div className={f.transport}>
        <button aria-label={playing ? "暂停简报" : ended ? "重播简报" : "播放简报"} disabled={error}
          onClick={() => playing ? video.current?.pause() : play(ended)}>
          {waiting ? <LoaderCircle className={s.spin} size={17} /> : playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <input type="range" min="0" max={duration} step="0.1" value={Math.min(time, duration)} aria-label="简报播放进度" disabled={error}
          onChange={e => { const next = Number(e.target.value); if (video.current) video.current.currentTime = next; setTime(next); setEnded(false) }} />
        <span>{Math.floor(time).toString().padStart(2, "0")} / {Math.ceil(duration)} 秒</span>
        <button aria-label="从头播放简报" disabled={error} onClick={() => play(true)}><RotateCcw size={16} /></button>
      </div>
      <div className={s.dialogueActions}>
        <button className={s.reply} onClick={onComplete} disabled={disabled}><span className={s.replyTag}>我</span>打开前视相机。<ChevronRight size={19} /></button>
        {!ended && <button className={s.quiet} onClick={onComplete} disabled={disabled}>跳过简报</button>}
      </div>
    </section>
  </>
}
