"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ExternalLink, Play, X } from "lucide-react"
import type { LearningResource } from "@/lib/project-lines/guided-course"
import styles from "./course-video-resource.module.css"
import courseStyles from "./guided-project-course.module.css"

// Matches the cover / play overlay / dark player used by the full course reader.
// A native modal also keeps keyboard focus inside and returns it to the cover.
function VideoPlayer({ resource, onClose }: { resource: LearningResource; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const element = dialog.current!
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = "hidden"
    return () => {
      element.close()
      document.body.style.overflow = overflow
    }
  }, [])

  function dismiss() {
    // Close while still attached so the browser can restore the invoking button.
    dialog.current?.close()
    onClose()
  }

  return <dialog
    ref={dialog}
    className={styles.dialog}
    aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); dismiss() }}
    onClick={event => { if (event.target === event.currentTarget) dismiss() }}
  >
    <div className={styles.playerContent}>
      <header className={styles.playerHeading}>
        <h4 id={titleId}>{resource.title}</h4>
        <button type="button" onClick={dismiss} aria-label="关闭视频"><X size={18} /></button>
      </header>
      {resource.youtube_id ? <iframe
        className={styles.player}
        src={`https://www.youtube-nocookie.com/embed/${resource.youtube_id}?autoplay=1&rel=0`}
        title={resource.title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      /> : <video
        key={attempt}
        className={styles.player}
        src={resource.media_url}
        controls
        autoPlay
        playsInline
        preload="metadata"
        aria-label={resource.title}
        onError={() => setFailed(true)}
      />}
      <div className={styles.playerNotes}>
        {failed && <div className={styles.playbackError} role="status">
          <p>此视频暂时无法播放。可以重试、打开官方来源，或关闭视频后阅读中文要点。</p>
          <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1) }}>重新加载视频</button>
        </div>}
        <p><strong>带着问题看</strong>{resource.prompt}</p>
        <a href={resource.url} target="_blank" rel="noreferrer">无法播放？打开原始视频与说明 <ExternalLink size={14} /></a>
      </div>
    </div>
  </dialog>
}

export function CourseVideoResource({ resource }: { resource: LearningResource }) {
  const [playing, setPlaying] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const poster = resource.poster_url ?? (resource.youtube_id ? `https://i.ytimg.com/vi/${resource.youtube_id}/hqdefault.jpg` : undefined)
  const canPlay = Boolean(resource.youtube_id || resource.media_url)

  return <article className={styles.card} data-course-video>
    {canPlay && <button type="button" className={styles.preview} onClick={() => setPlaying(true)} aria-label={`播放视频：${resource.title}`}>
      {poster && !posterFailed ? (
        // Official source thumbnails, not generated illustrations of the video.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          loading="lazy"
          ref={element => {
            // A cached failure can occur before React attaches the error handler.
            if (element?.complete && element.naturalWidth === 0) setPosterFailed(true)
          }}
          onError={() => setPosterFailed(true)}
        />
      ) : <span className={styles.missingCover}>视频预览<span>{resource.title}</span></span>}
      <span className={styles.playIcon}><Play size={27} fill="currentColor" /></span>
      <span className={styles.previewCaption}><span>{resource.publisher}</span><span>播放视频</span></span>
    </button>}
    <div className={styles.body}>
      <div className={styles.meta}><span><Play size={12} />课程视频</span><span>{resource.language === "en" ? "英文资源 · 中文引导" : "中文资源"}</span></div>
      <h4>{resource.title}</h4>
      <p className={styles.purpose}>{resource.purpose}</p>
      <div className={courseStyles.watchTask}><strong>带着问题看</strong><p>{resource.prompt}</p></div>
      <details className={styles.fallback}><summary>中文要点 / 视频无法播放时</summary><p>{resource.fallback}</p></details>
      <a className={styles.source} href={resource.url} target="_blank" rel="noreferrer">打开原始视频与说明 <ExternalLink size={13} /></a>
    </div>
    {playing && <VideoPlayer resource={resource} onClose={() => setPlaying(false)} />}
  </article>
}
