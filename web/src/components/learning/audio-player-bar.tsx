"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react"
import { GATEWAY_URL } from "@/lib/api/client"
import { useT } from "@/lib/hooks/use-t"

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

const SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0]

export function AudioPlayerBar({ audioUrl, script, timestamps }: AudioPlayerBarProps) {
  const t = useT()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [activeWordIndex, setActiveWordIndex] = useState(-1)
  const [speed, setSpeed] = useState(1.0)
  const [speedOpen, setSpeedOpen] = useState(false)

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
    if (isPlaying) audio.pause()
    else audio.play()
  }, [isPlaying])

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds))
  }, [])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }, [duration])

  const handleSpeedChange = useCallback((s: number) => {
    const audio = audioRef.current
    if (audio) audio.playbackRate = s
    setSpeed(s)
    setSpeedOpen(false)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => { setIsPlaying(false); setActiveWordIndex(-1) }
    const onLoaded = () => setDuration(audio.duration)
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      const ms = audio.currentTime * 1000
      const idx = words.findIndex((w) => ms >= w.begin_time && ms < w.end_time)
      setActiveWordIndex(idx)
    }

    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("loadedmetadata", onLoaded)
    audio.addEventListener("timeupdate", onTimeUpdate)
    return () => {
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("loadedmetadata", onLoaded)
      audio.removeEventListener("timeupdate", onTimeUpdate)
    }
  }, [words])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`

  return (
    <div className="shrink-0 mx-4 mb-3">
      <audio ref={audioRef} src={fullUrl} preload="metadata" />

      {/* Glass card */}
      <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl px-5 py-4 shadow-[0_8px_32px_-8px_rgba(25,34,125,0.10)] border border-white/40 dark:border-white/10">
        <div className="flex flex-col md:flex-row items-center gap-4">

          {/* Left: play button + label */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={togglePlayPause}
              className="h-12 w-12 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-primary/30"
            >
              {isPlaying
                ? <Pause className="h-5 w-5" />
                : <Play className="h-5 w-5 ml-0.5" />
              }
            </button>
            <div>
              <p className="text-sm font-bold text-foreground font-[var(--font-manrope)]">{t("audio.ai_narration")}</p>
              <p className="text-[11px] text-muted-foreground italic font-[var(--font-manrope)]">{t("audio.neural_voice")}</p>
            </div>
          </div>

          {/* Center: timestamps + progress bar */}
          <div className="flex-1 w-full min-w-0 flex flex-col gap-1.5">
            <div className="flex justify-between text-[10px] font-[var(--font-manrope)] text-muted-foreground uppercase tracking-widest">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>
            <div
              className="relative w-full h-1.5 bg-secondary/20 dark:bg-white/10 rounded-full overflow-hidden cursor-pointer group"
              onClick={handleSeek}
            >
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-violet-400 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
              {/* Thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
          </div>

          {/* Right: skip + speed */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => skip(-10)}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
              title="后退 10 秒"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => skip(10)}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
              title="前进 10 秒"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-border/50 mx-1" />

            {/* Speed selector */}
            <div className="relative">
              <button
                onClick={() => setSpeedOpen((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold font-[var(--font-manrope)] text-foreground hover:bg-secondary/40 transition-colors"
              >
                {speed}x Speed
                <svg className={`h-3 w-3 transition-transform ${speedOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {speedOpen && (
                <div className="absolute bottom-full right-0 mb-1 bg-white dark:bg-card border border-border/50 rounded-xl shadow-xl overflow-hidden z-50 min-w-[110px]">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSpeedChange(s)}
                      className={`w-full px-4 py-2 text-xs text-left font-[var(--font-manrope)] font-medium transition-colors hover:bg-secondary/40 ${
                        s === speed ? "text-primary font-bold bg-primary/5" : "text-foreground"
                      }`}
                    >
                      {s}x Speed
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
