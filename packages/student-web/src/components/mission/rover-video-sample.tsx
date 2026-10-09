"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, LoaderCircle, Play, RotateCcw, Volume2 } from "lucide-react"
import s from "./rover-video-sample.module.css"

export function RoverVideoSample() {
  const video = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [error, setError] = useState("")
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    // A failed metadata fetch can finish before React hydrates the video element.
    let active = true
    if (video.current?.error) queueMicrotask(() => {
      if (active) setError("视频暂时没有加载成功，请重试。")
    })
    return () => { active = false }
  }, [])

  function play(restart = false) {
    const node = video.current
    if (!node) return
    setError("")
    if (restart) node.currentTime = 0
    node.muted = false
    void node.play().then(() => {
      setStarted(true)
      setEnded(false)
    }).catch(reason => {
      if (reason.name !== "AbortError") setError("视频未能播放，请重试或使用播放器控制按钮。")
    })
  }
  function retry() {
    video.current?.load()
    play()
  }

  return <main className={s.page}>
    <header className={s.header}>
      <Link href="/mission/rover"><ArrowLeft size={17} /> 返回任务开场</Link>
      <span>晨光计划 <i>/</i> MOTION STUDY 01</span>
    </header>
    <section className={s.content}>
      <div className={s.titleRow}>
        <div><p className={s.eyebrow}>第一人称 · 角色表演样片</p><h1>她在跟你说话。</h1></div>
        <span className={s.spec}>约 9 秒 <i>·</i> 1080P <i>·</i> 中文对白</span>
      </div>
      <div className={s.screen}>
        <video ref={video} controls playsInline preload="metadata" src="/mission/rover/video/lin-lan-welcome-v1.mp4"
          poster="/mission/rover/engineer-1920.webp"
          onPlay={() => { setStarted(true); setEnded(false) }}
          onPlaying={() => { setBuffering(false); setError("") }}
          onWaiting={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onPause={() => setBuffering(false)}
          onEnded={() => { setEnded(true); setBuffering(false) }}
          onError={() => { setError("视频暂时没有加载成功，请重试。"); setBuffering(false) }}
          aria-label="林岚工程师面对学生讲述任务的视频样片">
          <track kind="captions" src="/mission/rover/video/lin-lan-welcome-zh.vtt" srcLang="zh" label="中文字幕" />
        </video>
        {!started && !error && <button className={s.start} onClick={() => play()}><span><Play size={25} fill="currentColor" /></span>播放有声样片</button>}
        {buffering && <div className={s.buffering} role="status"><LoaderCircle className={s.spin} size={23} /> 正在缓冲</div>}
        {error && <div className={s.failure} role="alert"><p>{error}</p><button onClick={retry}>重新加载</button></div>}
      </div>
      <div className={s.belowScreen}>
        <div><Volume2 size={15} /><span>建议打开声音，观察她的口型、眼神和动作。</span></div>
        <button onClick={() => play(true)}><RotateCcw size={15} /> {ended ? "再看一遍" : "从头播放"}</button>
      </div>
      <div className={s.dialogue}><span>林岚 / 任务工程师</span><p>“你来了，坐我旁边。我是林岚。今天，晨光号的下一段任务，由我们一起完成。”</p></div>
      <footer className={s.footer}><p>AI 生成的虚构人物与场景 · 本片用于开场效果验收</p><Link href="/mission/rover">进入可操作的火星任务 <ArrowRight size={16} /></Link></footer>
    </section>
  </main>
}
