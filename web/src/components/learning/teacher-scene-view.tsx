// "老师讲课" mode: 全屏 LizardScene + slides 系统 (按页讲解 + 自动翻页).
// slide 内容显示在 LizardScene 的投影屏 slot 内, 蜥蜴说当前 slide 的 audio_script.
// 当一页说完 (isSpeaking 由 true → false), 自动翻下一页继续讲. 提供手动控制.
//
// UI 风格: 用 systemedu 主站 shadcn <Button> 组件 + 暖色 (sand/amber) 配色,
// 与红沙漠场景调性一致, 不用蓝紫硬撞。
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { LizardScene } from "@/components/dighuman/LizardScene"
import { useDighumanSession } from "@/components/dighuman/use-dighuman-session"
import { useDighumanPlaybackStore } from "@/components/dighuman/store"
import { gateway } from "@/lib/api"
import type { CourseContent, KnodeInfo, SlideEntry } from "@/lib/types/api"
import { SlideContent } from "@/components/learning/slide-content"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft, ChevronRight, Play, Pause, RotateCw, Square, Volume2, Loader2,
} from "lucide-react"

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
  const startedSpeakingRef = useRef(false)

  // 自取 v3 course_content (rendered_sections 在 v3 才有, 父组件 versionMode=v2
  // 时拿不到; 直接 fetch v3 不依赖 versionMode 状态).
  const [v3Content, setV3Content] = useState<CourseContent | null>(null)

  const reloadSlides = useCallback(async () => {
    setError(null)
    setLoadingSlides(true)
    try {
      const [slidesData, courseData] = await Promise.all([
        gateway.getCourseV3Slides(projectName, nodeId, versionLabel ?? undefined),
        gateway.getCourseV3(projectName, nodeId, versionLabel ?? undefined).catch(() => null),
      ])
      setSlides(slidesData.slides ?? [])
      setCurrent(0)
      const cc = courseData?.course_content as CourseContent | undefined
      if (cc) setV3Content(cc)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingSlides(false)
    }
  }, [projectName, nodeId, versionLabel])

  useEffect(() => {
    reloadSlides()
  }, [reloadSlides])

  // 当前页变化 + 已连接 + autoplay → 让蜥蜴讲
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

  // 监听 speaking 完成: true → false 后自动翻下一页
  useEffect(() => {
    if (isSpeaking) {
      startedSpeakingRef.current = true
      return
    }
    if (!startedSpeakingRef.current) return
    if (!autoplay) return
    if (slides.length === 0) return
    if (current >= slides.length - 1) return
    const t = setTimeout(() => setCurrent((i) => Math.min(i + 1, slides.length - 1)), 700)
    return () => clearTimeout(t)
  }, [isSpeaking, autoplay, slides.length, current])

  const goToSlide = useCallback((target: number) => {
    stop().catch(() => {})
    startedSpeakingRef.current = false
    setCurrent(target)
  }, [stop])

  const handleManualSpeak = useCallback(() => {
    if (slides.length === 0) return
    const slide = slides[current]
    if (!slide) return
    const text = (slide.audio_script || slide.body_markdown || "").trim()
    if (text) {
      stop().catch(() => {})
      startedSpeakingRef.current = false
      speak(text, "zh").catch((e) => setError((e as Error).message))
    }
  }, [slides, current, speak, stop])

  const handleTogglePlayback = useCallback(() => {
    setAutoplay((v) => {
      const next = !v
      if (!next) {
        stop().catch(() => {})
        startedSpeakingRef.current = false
      }
      return next
    })
  }, [stop])

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
  // 优先用自取的 v3 content, fallback 到父组件传入的 (向后兼容)
  const renderedSections = ((v3Content ?? courseContent)?.rendered_sections as
    | Record<string, { html?: string | null }>
    | undefined) ?? undefined

  return (
    <div className="flex flex-col h-full bg-stone-100 text-stone-900">
      {/* Status strip — 暖灰 + amber 强调 */}
      <div className="flex items-center gap-3 px-6 py-2.5 text-xs border-b border-stone-200 bg-white/80 backdrop-blur shrink-0">
        <span
          className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
        />
        <span className="text-stone-700 font-medium">
          {connected ? "蜥蜴老师已就位" : "正在连接..."}
        </span>
        {slides.length > 0 && (
          <span className="ml-2 text-stone-500">
            第 <strong className="text-stone-900">{current + 1}</strong> / {slides.length} 页
            <span className="ml-1.5 text-amber-700 uppercase tracking-wider text-[10px] font-semibold">
              {slide?.kind ?? ""}
            </span>
          </span>
        )}
        <Button
          variant="ghost"
          size="xs"
          onClick={handleRegenerate}
          disabled={regenerating || !versionLabel}
          className="ml-auto text-stone-600 hover:text-amber-800"
          title="用 LLM 重新生成 slides (整组覆盖)"
        >
          {regenerating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RotateCw className="size-3.5" />
          )}
          重生 slides
        </Button>
      </div>

      {/* Main scene — 蜥蜴 + 投影屏 */}
      <div className="relative flex-1 min-h-0">
        <LizardScene
          slide={
            loadingSlides ? (
              <SlideLoading />
            ) : slides.length === 0 ? (
              <NoSlides
                versionLabel={versionLabel}
                onRegenerate={handleRegenerate}
                regenerating={regenerating}
              />
            ) : slide ? (
              <SlideContent slide={slide} renderedSections={renderedSections} />
            ) : null
          }
        />
      </div>

      {/* Playback controls — shadcn Button + 暖白 chrome */}
      {slides.length > 0 && (
        <div className="border-t border-stone-200 bg-white/85 backdrop-blur px-6 py-3 flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goToSlide(Math.max(0, current - 1))}
            disabled={current === 0}
            title="上一页"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Button
            variant={autoplay ? "default" : "outline"}
            size="sm"
            onClick={handleTogglePlayback}
            title={autoplay ? "暂停 (停止讲话, 不再自动翻页)" : "继续自动播放"}
            className={autoplay ? "" : "text-stone-700"}
          >
            {autoplay ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {autoplay ? "自动播放中" : "已暂停"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSpeak}
            disabled={!connected || slides.length === 0}
            title="重新讲当前页"
            className="text-stone-700"
          >
            <Volume2 className="size-3.5" />
            重讲此页
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => stop()}
            title="停止讲话"
            className="text-stone-700"
          >
            <Square className="size-3.5" />
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <SlideDots count={slides.length} current={current} onJump={goToSlide} />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => goToSlide(Math.min(slides.length - 1, current + 1))}
              disabled={current >= slides.length - 1}
              title="下一页"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-6 py-2 text-xs text-red-700 shrink-0">
          {error}
        </div>
      )}
    </div>
  )
}

function SlideLoading() {
  return (
    <div className="text-stone-500 text-center">
      <Loader2 className="size-6 animate-spin mx-auto mb-2 text-amber-600" />
      <div className="text-xs uppercase tracking-wider">加载 slides...</div>
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
    <div className="text-center px-8 py-10 max-w-md">
      <div className="text-base font-semibold text-stone-800 mb-1.5">本节课暂无幻灯片</div>
      <div className="text-xs text-stone-600 mb-4">
        {versionLabel ? (
          <>
            版本 <code className="px-1 py-0.5 rounded bg-stone-100 text-amber-800 text-[11px]">{versionLabel}</code> 还没有 slides
          </>
        ) : (
          "请先生成 v3 课程版本"
        )}
      </div>
      {versionLabel && (
        <Button onClick={onRegenerate} disabled={regenerating} size="sm">
          {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          {regenerating ? "生成中..." : "立即生成 slides"}
        </Button>
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
            "h-1.5 rounded-full transition-all",
            i === current
              ? "bg-amber-500 w-4"
              : "bg-stone-300 hover:bg-stone-500 w-1.5",
          ].join(" ")}
          title={`跳到第 ${i + 1} 页`}
          aria-label={`Slide ${i + 1}`}
        />
      ))}
    </div>
  )
}
