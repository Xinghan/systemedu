// "老师讲课" mode: 全屏 LizardScene + slides 系统 (按页讲解 + 自动翻页).
// slide 内容显示在 LizardScene 的投影屏 slot 内, 蜥蜴说当前 slide 的 audio_script.
// 当一页说完 (isSpeaking 由 true → false), 自动翻下一页继续讲. 提供手动控制.
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { LizardScene } from "@/components/dighuman/LizardScene"
import { useDighumanSession } from "@/components/dighuman/use-dighuman-session"
import { useDighumanPlaybackStore } from "@/components/dighuman/store"
import { gateway } from "@/lib/api"
import type { CourseContent, KnodeInfo, SlideEntry } from "@/lib/types/api"
import { SlideContent } from "@/components/learning/slide-content"
import { ChevronLeft, ChevronRight, Play, Pause, RotateCw, Loader2 } from "lucide-react"

export interface TeacherSceneViewProps {
  knode: KnodeInfo | null
  /** Project slug, used to fetch slides + idea html. */
  projectName: string
  /** Knode global index. */
  nodeId: number
  /** Active v3 version_label; slides are scoped to this version. */
  versionLabel: string | null
  /** course_content (for rendered_sections fallback when slides reference an idea_id). */
  courseContent?: CourseContent | null
}

export function TeacherSceneView({
  knode,
  projectName,
  nodeId,
  versionLabel,
  courseContent,
}: TeacherSceneViewProps) {
  const { connected, speak, stop } = useDighumanSession()
  const isSpeaking = useDighumanPlaybackStore((s) => s.isSpeaking)
  const [slides, setSlides] = useState<SlideEntry[]>([])
  const [loadingSlides, setLoadingSlides] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  // Track wether we've finished speaking the *current* page so the auto-advance
  // effect doesn't fire before the lizard ever starts.
  const startedSpeakingRef = useRef(false)

  // Fetch slides
  const reloadSlides = useCallback(async () => {
    setError(null)
    setLoadingSlides(true)
    try {
      const data = await gateway.getCourseV3Slides(projectName, nodeId, versionLabel ?? undefined)
      setSlides(data.slides ?? [])
      setCurrent(0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingSlides(false)
    }
  }, [projectName, nodeId, versionLabel])

  useEffect(() => {
    reloadSlides()
  }, [reloadSlides])

  // Speak the current slide whenever it changes (and connection is ready + autoplay).
  useEffect(() => {
    if (!connected) return
    if (!autoplay) return
    if (slides.length === 0) return
    const slide = slides[current]
    if (!slide) return
    const text = (slide.audio_script || slide.body_markdown || slide.title || "").trim()
    if (!text) return
    startedSpeakingRef.current = false
    speak(text, "zh").catch((e) => {
      console.warn("[teacher] speak failed:", e)
      setError((e as Error).message)
    })
  }, [current, connected, autoplay, slides, speak])

  // Track speak state; once it goes from speaking → idle, advance to next slide.
  useEffect(() => {
    if (isSpeaking) {
      startedSpeakingRef.current = true
      return
    }
    if (!startedSpeakingRef.current) return
    if (!autoplay) return
    if (slides.length === 0) return
    if (current >= slides.length - 1) return
    // Small pause before advancing so the previous audio settles + the user
    // sees the page's last frame for a moment.
    const t = setTimeout(() => setCurrent((i) => Math.min(i + 1, slides.length - 1)), 700)
    return () => clearTimeout(t)
  }, [isSpeaking, autoplay, slides.length, current])

  const handleManualSpeak = useCallback(() => {
    if (slides.length === 0) return
    const slide = slides[current]
    if (!slide) return
    const text = (slide.audio_script || slide.body_markdown || "").trim()
    if (text) {
      startedSpeakingRef.current = false
      speak(text, "zh").catch((e) => setError((e as Error).message))
    }
  }, [slides, current, speak])

  const handleRegenerate = useCallback(async () => {
    if (!versionLabel) {
      setError("no active version_label to regenerate against")
      return
    }
    setRegenerating(true)
    setError(null)
    try {
      stop().catch(() => {})
      await gateway.regenerateCourseV3Slides(projectName, nodeId, versionLabel)
      await reloadSlides()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRegenerating(false)
    }
  }, [projectName, nodeId, versionLabel, stop, reloadSlides])

  const slide = slides[current] ?? null
  const renderedSections = (courseContent?.rendered_sections as
    | Record<string, { html?: string | null }>
    | undefined) ?? undefined

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white">
      {/* Status strip */}
      <div className="flex items-center gap-3 px-6 py-2 text-xs text-white/60 border-b border-white/5 shrink-0">
        <span
          className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
        />
        <span>{connected ? "蜥蜴老师已就位" : "正在连接 dighuman..."}</span>
        {slides.length > 0 && (
          <span className="ml-2 opacity-70">
            第 {current + 1} / {slides.length} 页 · {slide?.kind ?? ""}
          </span>
        )}
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating || !versionLabel}
          className="ml-auto inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-white/15 hover:bg-white/10 disabled:opacity-40"
          title="用 LLM 重新生成 slides (整组覆盖)"
        >
          {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
          重生 slides
        </button>
      </div>

      {/* Main scene */}
      <div className="relative flex-1 min-h-0">
        <LizardScene
          slide={
            loadingSlides ? (
              <SlideLoading />
            ) : slides.length === 0 ? (
              <NoSlides versionLabel={versionLabel} onRegenerate={handleRegenerate} regenerating={regenerating} />
            ) : slide ? (
              <SlideContent slide={slide} renderedSections={renderedSections} />
            ) : null
          }
        />
      </div>

      {/* Playback controls */}
      {slides.length > 0 && (
        <div className="border-t border-white/5 bg-slate-900/60 px-6 py-3 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              stop().catch(() => {})
              startedSpeakingRef.current = false
              setCurrent((i) => Math.max(0, i - 1))
            }}
            disabled={current === 0}
            className="p-2 rounded hover:bg-white/10 disabled:opacity-30"
            title="上一页"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoplay((v) => {
                const next = !v
                if (!next) {
                  // 切到暂停: 立刻停掉音频 + scheduler + speaking 状态
                  stop().catch(() => {})
                  startedSpeakingRef.current = false
                }
                return next
              })
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-xs font-medium"
            title={autoplay ? "暂停 (停止讲话, 不再自动翻页)" : "继续自动播放当前页"}
          >
            {autoplay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoplay ? "自动播放中" : "已暂停"}
          </button>

          <button
            type="button"
            onClick={handleManualSpeak}
            disabled={!connected || slides.length === 0}
            className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-medium disabled:opacity-40"
            title="重新讲当前页"
          >
            重讲此页
          </button>

          <button
            type="button"
            onClick={() => stop()}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium"
          >
            停止
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <SlideDots count={slides.length} current={current} onJump={(i) => {
              stop().catch(() => {})
              startedSpeakingRef.current = false
              setCurrent(i)
            }} />
            <button
              type="button"
              onClick={() => {
                stop().catch(() => {})
                startedSpeakingRef.current = false
                setCurrent((i) => Math.min(slides.length - 1, i + 1))
              }}
              disabled={current >= slides.length - 1}
              className="p-2 rounded hover:bg-white/10 disabled:opacity-30"
              title="下一页"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="border-t border-red-900/50 bg-red-950/60 px-6 py-2 text-xs text-red-200 shrink-0">
          {error}
        </div>
      )}
    </div>
  )
}

function SlideLoading() {
  return (
    <div className="text-white/60 text-center">
      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
      <div className="text-xs">加载 slides...</div>
    </div>
  )
}

function NoSlides({
  versionLabel,
  onRegenerate,
  regenerating,
}: {
  versionLabel: string | null
  onRegenerate: () => void
  regenerating: boolean
}) {
  return (
    <div className="text-white/80 text-center px-8">
      <div className="text-base font-medium mb-1">本节课暂无幻灯片</div>
      <div className="text-xs opacity-60 mb-3">
        {versionLabel
          ? `版本 ${versionLabel} 还没有 slides, 点下方生成`
          : "请先生成 v3 课程版本"}
      </div>
      {versionLabel && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium disabled:opacity-50"
        >
          {regenerating ? "生成中..." : "立即生成"}
        </button>
      )}
    </div>
  )
}

function SlideDots({
  count,
  current,
  onJump,
}: {
  count: number
  current: number
  onJump: (i: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onJump(i)}
          className={[
            "w-1.5 h-1.5 rounded-full transition-all",
            i === current ? "bg-emerald-400 w-3" : "bg-white/30 hover:bg-white/60",
          ].join(" ")}
          title={`跳到第 ${i + 1} 页`}
        />
      ))}
    </div>
  )
}
