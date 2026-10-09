"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowRight, Play, X } from "lucide-react"
import s from "../learning/rover-mission-center.module.css"

export function IntroFilm({ close, description, returnLabel = "回到制造任务", autoPlay = false, onEnded, media }: {
  close: () => void; description?: string; returnLabel?: string; autoPlay?: boolean; onEnded?: () => void; media?: { level: number; title: string; src: string; captions: string }
}) {
  const dialog = useRef<HTMLDialogElement>(null), video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)
  const [needsPlay, setNeedsPlay] = useState(false)
  useEffect(() => {
    let active = true
    const d = dialog.current, v = video.current
    d?.showModal()
    if (autoPlay) void v?.play().catch(reason => {
      if (active && reason?.name !== "AbortError") setNeedsPlay(true)
    })
    const hide = () => { if (document.hidden) v?.pause() }
    document.addEventListener("visibilitychange", hide)
    return () => { active = false; v?.pause(); d?.close(); document.removeEventListener("visibilitychange", hide) }
  }, [autoPlay])
  function play() {
    if (error) { setError(false); video.current?.load() }
    void video.current?.play().catch(() => setNeedsPlay(true))
  }
  return <dialog ref={dialog} className={s.dialog} aria-label={media ? `阶段 0${media.level} 任务短片` : "前导任务短片"} data-stage-film={media?.level} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close() }}>
    <div className={s.filmHeader}><span>{media ? `0${media.level} / ${media.title}` : "前导任务 / 和林岚坐进控制席"}</span><button autoFocus onClick={close} aria-label="关闭任务短片"><X size={20} /></button></div>
    <div className={s.filmStage}><video ref={video} src={media?.src || "/mission/rover/video/rover-briefing-v1.mp4"} poster="/mission/rover/engineer-1920.webp" controls playsInline preload="metadata" onPlay={() => setNeedsPlay(false)} onEnded={onEnded} onError={() => setError(true)}>
      <track default kind="captions" src={media?.captions || "/mission/rover/video/rover-briefing-zh.vtt"} srcLang="zh" label="中文字幕" />
    </video>{needsPlay && !error && <div className={s.playPrompt}><button onClick={play}><Play size={20} />{media ? "播放阶段任务" : "播放任务序章"}</button><span>点击播放，和林岚一起出发</span></div>}</div>
    <p>{description || "这是一次火星地形观察的模拟任务。本课程会进一步带你设计、3D 打印并测试桌面实物车。"}</p>
    {error && <p role="alert">短片未加载成功，可以直接开始课程。<button onClick={play}>重新加载短片</button></p>}
    <div className={s.filmLinks}>{media ? <span>林岚 / AI 生成的虚构任务搭档</span> : <Link href="/mission/rover">先体验 3 分钟前导任务 <ArrowRight size={15} /></Link>}<button onClick={close}>{returnLabel}</button></div>
  </dialog>
}

