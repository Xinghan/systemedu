// 2D speaking lizard scene: 沙漠背景 + 左侧投影屏幕 (slide 占位区) + 右侧蜥蜴 + 字幕。
// Adapted from ~/Dev/systemdighuman/packages/client/src/ui/Scene2D.tsx — the
// scene structure (background + projector + character + subtitle) is preserved
// so we have a fixed slot for future slide content. demo 的眼睛扫描小卡片移除,
// 投影屏暴露一个 `slide` slot 供调用方注入 (nullable 时显示占位提示)。
"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useDighumanAvatarStore, useDighumanPlaybackStore } from "./store"

type MouthShape = "SIL" | "AA" | "OH" | "IH" | "UH" | "PP" | "FF" | "E"

function pickMouthShape(weights: Record<string, number>): {
  shape: MouthShape
  intensity: number
} {
  const jaw = weights.jawOpen ?? 0
  const funnel = weights.mouthFunnel ?? 0
  const stretch = (weights.mouthStretchLeft ?? 0) + (weights.mouthStretchRight ?? 0)
  const close = weights.mouthClose ?? 0
  const pucker = weights.mouthPucker ?? 0
  const roll = weights.mouthRollLower ?? 0

  if (close > 0.4) return { shape: "PP", intensity: close }
  if (roll > 0.4) return { shape: "FF", intensity: roll }
  if (pucker > 0.4) return { shape: "UH", intensity: pucker }
  if (funnel > 0.4 && jaw > 0.2) return { shape: "OH", intensity: Math.max(funnel, jaw) }
  if (stretch > 0.5) return { shape: "IH", intensity: stretch / 2 }
  if (jaw > 0.5) return { shape: "AA", intensity: jaw }
  if (jaw > 0.15) return { shape: "E", intensity: jaw }
  return { shape: "SIL", intensity: 0 }
}

export interface LizardSceneProps {
  /** Show the bottom subtitle. */
  showSubtitle?: boolean
  /** Render content inside the projector screen (e.g. a slide). When null, shows placeholder. */
  slide?: ReactNode
  /** Custom background image url; defaults to bundled lizard background. */
  backgroundUrl?: string
  /** Custom body image url (full lizard, static base layer). */
  bodyUrl?: string
  /** Custom head image url (head/hat overlay, animated layer). */
  headUrl?: string
  /** className for outer container. */
  className?: string
}

export function LizardScene({
  showSubtitle = true,
  slide = null,
  backgroundUrl = "/dighuman/figure/background.png",
  bodyUrl = "/dighuman/figure/body.png",
  headUrl = "/dighuman/figure/head.png",
  className = "",
}: LizardSceneProps) {
  const weights = useDighumanAvatarStore((s) => s.blendshapeWeights)
  const { intensity } = pickMouthShape(weights)
  const subtitle = useDighumanPlaybackStore((s) => s.subtitleText)
  const isSpeaking = useDighumanPlaybackStore((s) => s.isSpeaking)
  const [mounted, setMounted] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setMounted(true)
    let raf = 0
    const loop = () => {
      setTick((v) => (v + 1) % 100000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Head-only animation (mirrors ~/Dev/systemdighuman commit 7e86cf7):
  // body stays static; only head.png layer rotates/bobs around the neck.
  // Speaking adds a base pulse so head keeps nodding even between visemes.
  const t = mounted ? (performance.now() / 1000) * Math.PI * 2 : 0
  const idleSway = mounted ? Math.sin(t * 0.15) * 1.2 : 0 // ±1.2°, ~6.7s
  const idleBob = mounted ? Math.sin(t * 0.25) * 2 : 0 // 2 px, ~4s
  // Base pulse during speech keeps motion even when viseme is SIL between words.
  const speechBase = isSpeaking && mounted ? 0.3 : 0
  const visemeBoost = mounted ? intensity * 0.7 : 0
  const speakPulse = (speechBase + visemeBoost) * (0.5 + 0.5 * Math.sin(t * 6))
  const speakNod = speakPulse * 2.5 // up to 2.5° downward head dip
  const speakBob = -speakPulse * 6 // up to 6 px upward when emphatic
  const headRot = idleSway - speakNod
  const headY = idleBob + speakBob
  void tick

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#1a1f2e",
      }}
    >
      {/* Speaking indicator (top-right) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/70 z-20">
        <span
          className={`w-2 h-2 rounded-full ${isSpeaking ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`}
        />
        {isSpeaking ? "speaking" : "idle"}
      </div>

      {/* Projector screen (slide slot) — left half */}
      <ProjectorScreen>{slide}</ProjectorScreen>

      {/* Lizard (right bottom) — body static, head animated overlay */}
      <div className="absolute right-[2%] bottom-0 w-[34%] max-w-[480px] z-10">
        <div className="relative w-full">
          {/* Static body — full image, never moves. */}
          <img
            src={bodyUrl}
            alt="lizard teacher"
            className="w-full h-auto drop-shadow-2xl select-none pointer-events-none"
            draggable={false}
          />
          {/* Animated head overlay — same canvas size, only head pixels opaque. */}
          <img
            src={headUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-auto pointer-events-none select-none"
            draggable={false}
            style={{
              transform: `translateY(${headY}px) rotate(${headRot}deg)`,
              // Pivot at neck base (~50% horizontally, ~46% vertically since head
              // crop ends at y=760 in a 1536-tall image).
              transformOrigin: "50% 46%",
              willChange: "transform",
            }}
          />
        </div>
      </div>

      {/* Subtitle */}
      {showSubtitle && subtitle && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 max-w-[60%] z-20">
          <div className="bg-black/70 backdrop-blur-sm rounded-md px-4 py-2 text-center">
            <p className="text-white text-sm md:text-base leading-relaxed">{subtitle}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Projector screen with tripod legs. Holds a slide (children) in 2-pane layout. */
function ProjectorScreen({ children }: { children?: ReactNode }) {
  return (
    <div
      className="absolute"
      style={{ left: "5%", top: "12%", width: "55%", height: "68%" }}
    >
      {/* Tripod legs (sketched lines) */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[-48px] w-[2px] h-12 bg-slate-800/70" />
      <div className="absolute left-1/2 bottom-[-58px] w-[80px] h-[2px] bg-slate-800/70 -translate-x-1/2 rotate-[8deg]" />
      <div className="absolute left-1/2 bottom-[-58px] w-[80px] h-[2px] bg-slate-800/70 -translate-x-1/2 -rotate-[8deg]" />

      {/* Frame */}
      <div className="absolute inset-0 rounded-md bg-slate-900 p-2 shadow-2xl">
        <div className="w-full h-full rounded bg-indigo-500/95 overflow-hidden flex items-center justify-center">
          {children ?? <SlidePlaceholder />}
        </div>
      </div>
    </div>
  )
}

function SlidePlaceholder() {
  return (
    <div className="text-white/60 text-center px-6 text-sm">
      <div className="text-[10px] uppercase tracking-widest mb-2 opacity-70">Slide area</div>
      <div className="text-white/80 text-base">幻灯片将显示在这里 / Slides will appear here</div>
      <div className="text-[10px] mt-2 opacity-50">(slide functionality coming soon)</div>
    </div>
  )
}
