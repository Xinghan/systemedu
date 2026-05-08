// React hook: connect WebSocket + audio playback + viseme scheduler.
// Returns { speak, stop, connected }.
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DighumanWsClient } from "./ws/client"
import { PlaybackScheduler } from "./playback/scheduler"
import { useDighumanAvatarStore, useDighumanPlaybackStore } from "./store"
import type { Lang, VisemeFrame } from "./shared/ws-messages"
import { randomUUID } from "@/lib/utils/uuid"

const SERVER_ORIGIN =
  process.env.NEXT_PUBLIC_DIGHUMAN_URL ?? "http://localhost:8787"

export interface UseDighumanResult {
  /** WS open + ready for /api/speak. */
  connected: boolean
  /** Trigger TTS + viseme. text is what to say, lang en/zh. */
  speak: (text: string, lang?: Lang) => Promise<void>
  /** Interrupt current utterance. */
  stop: () => Promise<void>
}

export function useDighumanSession(): UseDighumanResult {
  const [connected, setConnected] = useState(false)
  const sessionIdRef = useRef<string>("")
  const wsRef = useRef<DighumanWsClient | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const schedulerRef = useRef<PlaybackScheduler | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setBlend = useDighumanAvatarStore((s) => s.setBlendshapeWeight)
  const setSpeaking = useDighumanPlaybackStore((s) => s.setSpeaking)
  const setVisemeTrack = useDighumanPlaybackStore((s) => s.setVisemeTrack)

  useEffect(() => {
    if (typeof window === "undefined") return

    const sessionId = randomUUID()
    sessionIdRef.current = sessionId
    const wsOrigin = SERVER_ORIGIN.replace(/^http/, "ws")
    const wsUrl = `${wsOrigin}/ws?session_id=${sessionId}`
    const ws = new DighumanWsClient(wsUrl)
    wsRef.current = ws

    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx

    const sched = new PlaybackScheduler({
      onBlendshape: (name, weight) => setBlend(name, weight),
    })
    schedulerRef.current = sched

    let pendingTrack: VisemeFrame[] = []
    let pendingDurationMs = 0

    const cleanupCurrentPlayback = () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current)
        stopTimerRef.current = null
      }
      if (currentSourceRef.current) {
        try { currentSourceRef.current.stop() } catch { /* already stopped */ }
        try { currentSourceRef.current.disconnect() } catch {}
        currentSourceRef.current = null
      }
      sched.stop()
      setSpeaking(null)
    }

    ws.on("speech_start", (f) => {
      setSpeaking(f.utterance_id)
      pendingDurationMs = f.duration_ms
    })
    ws.on("audio_header", () => {
      // header arrives before binary chunk, no-op needed beyond logging
    })
    ws.on("viseme_track", (f) => {
      pendingTrack = f.frames
      setVisemeTrack(f.frames)
    })
    ws.on("speech_end", () => {
      // Server queues speech_end immediately; audio start triggers scheduler.
    })
    ws.on("speech_interrupt", () => {
      cleanupCurrentPlayback()
    })
    ws.on("error", (f) => console.warn("[dighuman] error", f.code, f.message))

    ws.onBinary(async (buf) => {
      const trackStartMs = performance.now()
      sched.setTrack(pendingTrack, trackStartMs)
      const durationMs = pendingDurationMs || 3000
      // 新音频前先停掉旧的 (防上一段没说完用户切了页)
      if (currentSourceRef.current) {
        try { currentSourceRef.current.stop() } catch {}
        try { currentSourceRef.current.disconnect() } catch {}
        currentSourceRef.current = null
      }
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      stopTimerRef.current = setTimeout(() => {
        sched.stop()
        setSpeaking(null)
        currentSourceRef.current = null
      }, durationMs + 200)
      try {
        const decoded = await audioCtx.decodeAudioData(buf.slice(0))
        const src = audioCtx.createBufferSource()
        src.buffer = decoded
        src.connect(audioCtx.destination)
        src.onended = () => {
          if (currentSourceRef.current === src) currentSourceRef.current = null
        }
        currentSourceRef.current = src
        src.start()
      } catch (err) {
        console.warn("[dighuman] audio decode failed:", err)
      }
    })

    ws.connect()
    ws.ready().then(() => setConnected(true))

    let raf = 0
    const loop = () => {
      sched.tick(performance.now())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ws.close()
      sched.stop()
      if (currentSourceRef.current) {
        try { currentSourceRef.current.stop() } catch {}
        try { currentSourceRef.current.disconnect() } catch {}
        currentSourceRef.current = null
      }
      audioCtx.close().catch(() => {})
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current)
        stopTimerRef.current = null
      }
    }
  }, [setBlend, setSpeaking, setVisemeTrack])

  const speak = useCallback(async (text: string, lang: Lang = "zh") => {
    if (!sessionIdRef.current) throw new Error("dighuman session not initialized")
    // Audio context can only start after a user gesture; resume on speak.
    try { await audioCtxRef.current?.resume() } catch {}
    useDighumanPlaybackStore.getState().setSubtitleText(text)
    const res = await fetch(`${SERVER_ORIGIN}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionIdRef.current, text, lang }),
    })
    if (!res.ok) throw new Error(`speak failed: ${res.status} ${await res.text()}`)
  }, [])

  const stop = useCallback(async () => {
    // 立即停掉浏览器侧正在播放的音频 + scheduler + 状态, 不等服务端往返。
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop() } catch { /* already stopped */ }
      try { currentSourceRef.current.disconnect() } catch {}
      currentSourceRef.current = null
    }
    schedulerRef.current?.stop()
    useDighumanPlaybackStore.getState().setSpeaking(null)
    if (!sessionIdRef.current) return
    // 顺便通知服务端中断该 utterance (释放服务端资源/防 viseme_track 后续帧)
    await fetch(`${SERVER_ORIGIN}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionIdRef.current }),
    }).catch(() => {})
  }, [])

  return { connected, speak, stop }
}
