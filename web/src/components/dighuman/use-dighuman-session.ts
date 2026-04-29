// React hook: connect WebSocket + audio playback + viseme scheduler.
// Returns { speak, stop, connected }.
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DighumanWsClient } from "./ws/client"
import { PlaybackScheduler } from "./playback/scheduler"
import { useDighumanAvatarStore, useDighumanPlaybackStore } from "./store"
import type { Lang, VisemeFrame } from "./shared/ws-messages"

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
  const setBlend = useDighumanAvatarStore((s) => s.setBlendshapeWeight)
  const setSpeaking = useDighumanPlaybackStore((s) => s.setSpeaking)
  const setVisemeTrack = useDighumanPlaybackStore((s) => s.setVisemeTrack)

  useEffect(() => {
    if (typeof window === "undefined") return

    const sessionId = crypto.randomUUID()
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
    let stopTimer: ReturnType<typeof setTimeout> | null = null

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
      setSpeaking(null)
      if (stopTimer) clearTimeout(stopTimer)
      sched.stop()
    })
    ws.on("error", (f) => console.warn("[dighuman] error", f.code, f.message))

    ws.onBinary(async (buf) => {
      const trackStartMs = performance.now()
      sched.setTrack(pendingTrack, trackStartMs)
      const durationMs = pendingDurationMs || 3000
      if (stopTimer) clearTimeout(stopTimer)
      stopTimer = setTimeout(() => {
        sched.stop()
        setSpeaking(null)
      }, durationMs + 200)
      try {
        const decoded = await audioCtx.decodeAudioData(buf.slice(0))
        const src = audioCtx.createBufferSource()
        src.buffer = decoded
        src.connect(audioCtx.destination)
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
      audioCtx.close().catch(() => {})
      if (stopTimer) clearTimeout(stopTimer)
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
    if (!sessionIdRef.current) return
    await fetch(`${SERVER_ORIGIN}/api/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionIdRef.current }),
    })
  }, [])

  return { connected, speak, stop }
}
