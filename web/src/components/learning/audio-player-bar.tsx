"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { GATEWAY_URL } from "@/lib/api/client"

interface WordTimestamp {
  text: string
  begin_time: number
  end_time: number
}

interface AudioPlayerBarProps {
  audioUrl: string
  script: string
  timestamps: string
}

export function AudioPlayerBar({ audioUrl, script, timestamps }: AudioPlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const subtitleRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [activeWordIndex, setActiveWordIndex] = useState(-1)

  // Parse timestamps
  const words: WordTimestamp[] = (() => {
    try {
      const parsed = JSON.parse(timestamps)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })()

  const fullUrl = `${GATEWAY_URL}/api/media/${audioUrl}`

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }, [isPlaying])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      setIsPlaying(false)
      setActiveWordIndex(-1)
    }
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      // Find active word based on current time in ms
      const currentMs = audio.currentTime * 1000
      const idx = words.findIndex(
        (w) => currentMs >= w.begin_time && currentMs < w.end_time,
      )
      setActiveWordIndex(idx)
    }

    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    audio.addEventListener("timeupdate", onTimeUpdate)

    return () => {
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("loadedmetadata", onLoadedMetadata)
      audio.removeEventListener("timeupdate", onTimeUpdate)
    }
  }, [words])

  // Auto-scroll active word into view
  useEffect(() => {
    if (activeWordIndex < 0) return
    const container = subtitleRef.current
    if (!container) return
    const activeEl = container.querySelector("[data-active='true']")
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    }
  }, [activeWordIndex])

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * duration
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Format time as m:ss
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  // Build subtitle display: if we have word timestamps, show word-by-word;
  // otherwise show script as fallback
  const hasTimestamps = words.length > 0

  return (
    <div className="border-t bg-muted/30">
      <audio ref={audioRef} src={fullUrl} preload="metadata" />

      <div className="max-w-5xl mx-auto px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Teacher avatar */}
          <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-primary">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Subtitle area */}
          <div className="flex-1 min-w-0">
            <div
              ref={subtitleRef}
              className="overflow-x-auto whitespace-nowrap text-sm leading-relaxed scrollbar-hide"
            >
              {hasTimestamps ? (
                words.map((word, i) => (
                  <span
                    key={i}
                    data-active={i === activeWordIndex ? "true" : "false"}
                    className={`transition-colors ${
                      i === activeWordIndex
                        ? "text-primary font-medium"
                        : i < activeWordIndex
                          ? "text-muted-foreground"
                          : "text-foreground/70"
                    }`}
                  >
                    {word.text}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-xs truncate block">
                  {script.slice(0, 80)}...
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div
              className="mt-1.5 h-1 bg-muted rounded-full cursor-pointer group"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-primary rounded-full transition-all group-hover:h-1.5"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Time display */}
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {formatTime(currentTime)}/{formatTime(duration)}
          </span>

          {/* Play/Pause button */}
          <button
            onClick={togglePlayPause}
            className="shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
