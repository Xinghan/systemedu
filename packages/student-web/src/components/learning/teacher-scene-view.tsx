"use client"

/** Shared teaching surfaces and the authenticated, audio-enabled slide player. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { myProjects } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { MOLECULE_NUMBERING_VERSION } from "@/lib/course-numbering"
import { normalizeSlides } from "@/lib/normalize-slides"
import type { CourseIdeaSummary, RenderedSection, SlideEntry, SlideTeachingSequence } from "@/lib/types/api"
import { useT } from "@/lib/i18n/use-t"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { IdeaBlock } from "./course-content-view"
import { FormulaVisual, TechnicalVisual } from "./technical-visual"
import { ReadonlyPresentation, PresentationPlaybackControls, hasReadonlyAnimation } from "./readonly-presentation"

export interface LessonSlideDeck {
  slides: SlideEntry[]
  ideas: CourseIdeaSummary[]
  renderedSections: Record<string, RenderedSection>
  knodeDir: string
}

interface TeacherSceneViewProps {
  knode: unknown
  projectName: string
  nodeId: number
  moduleId: string
  versionLabel: string | null
  courseContent?: unknown
}

/** Legacy entry point; unified lessons pass their already-loaded deck directly. */
export function TeacherSceneView({ projectName, moduleId }: TeacherSceneViewProps) {
  return <FetchedSlidePlayer key={projectName + "/" + moduleId} projectName={projectName} moduleId={moduleId} />
}

function FetchedSlidePlayer({ projectName, moduleId }: { projectName: string; moduleId: string }) {
  const t = useT()
  const [deck, setDeck] = useState<LessonSlideDeck | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    myProjects.getKnode(projectName, moduleId).then(k => {
      if (cancelled) return
      setDeck({
        slides: normalizeSlides(k.slides, moduleId),
        knodeDir: k.knode_dir || `knodes/${moduleId}`,
        ideas: k.rendered_sections?.ideas || [],
        renderedSections: k.rendered_sections?.rendered_sections || {},
      })
    }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [projectName, moduleId])
  if (error) return <p role="alert" className="p-6 text-sm text-[var(--sub)]">{t("teacher.load_failed")}</p>
  if (!deck) return <div className="p-6"><LoadingSpinner label={t("teacher.loading_slides")} /></div>
  return <SlideDeckPlayer deck={deck} projectName={projectName} moduleId={moduleId} />
}

export function SlideDeckPlayer({ deck, projectName, moduleId, initialIndex = 0, currentIndex, onIndexChange, autoPlay = true, layout = "fit", previewAudioSources, previewImageSources }: {
  deck: LessonSlideDeck
  projectName: string
  moduleId: string
  initialIndex?: number
  currentIndex?: number
  onIndexChange?: (index: number) => void
  autoPlay?: boolean
  layout?: "content" | "fit"
  previewAudioSources?: Record<string, string>
  previewImageSources?: Record<string, string>
}) {
  const t = useT()
  const [localIndex, setLocalIndex] = useState(initialIndex)
  const idx = Math.max(0, Math.min(currentIndex ?? localIndex, deck.slides.length - 1))
  const [playbackRequested, setPlaybackRequested] = useState(autoPlay)
  const changeSlide = (next: number) => {
    const target = Math.max(0, Math.min(next, deck.slides.length - 1))
    if (onIndexChange) onIndexChange(target)
    else setLocalIndex(target)
  }
  const [retry, setRetry] = useState(0)
  const [audioState, setAudioState] = useState<{ key: string; url?: string; error?: boolean } | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const slide = deck.slides[Math.min(idx, deck.slides.length - 1)]
  const audioPath = slide?.audio_path || null
  const audioKey = projectName + "/" + audioPath + "/" + retry
  const audio = audioState?.key === audioKey ? audioState : null
  const ideaMap = useMemo(() => new Map(deck.ideas.map(i => [i.idea_id, i])), [deck.ideas])
  const previewUrl = process.env.NODE_ENV === "development" && audioPath ? previewAudioSources?.[audioPath] : undefined

  useEffect(() => {
    if (!audioPath) return
    const controller = new AbortController()
    let url: string | null = null
    const token = getToken()
    fetch(previewUrl || myProjects.fileUrl(projectName, audioPath), {
      signal: controller.signal,
      headers: !previewUrl ? { "X-Course-Numbering": MOLECULE_NUMBERING_VERSION, ...(token ? { Authorization: `Bearer ${token}` } : {}) } : undefined,
    }).then(r => r.ok ? r.blob() : Promise.reject(new Error("audio " + r.status)))
      .then(blob => {
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setAudioState({ key: audioKey, url })
      })
      .catch(() => { if (!controller.signal.aborted) setAudioState({ key: audioKey, error: true }) })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [projectName, audioPath, audioKey, previewUrl])

  useEffect(() => {
    const element = audioRef.current
    const stopForSection = (event: Event) => {
      if ((event as CustomEvent).detail === "section") element?.pause()
    }
    window.addEventListener("systemedu:lesson-audio-focus", stopForSection)
    return () => {
      element?.pause()
      if (element) element.removeAttribute("src")
      window.removeEventListener("systemedu:lesson-audio-focus", stopForSection)
    }
  }, [audio?.url])

  if (!slide) return <p className="p-6 text-sm text-[var(--sub)]">{t("teacher.no_slides")}</p>
  return (
    <div className={`flex min-w-0 flex-col gap-3 p-3 sm:p-5 ${layout === "fit" ? "h-full min-h-0" : "h-auto"}`} data-slide-player data-slide-index={idx} data-slide-layout={layout}
      tabIndex={0} aria-label={t("teacher.page_navigation")}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault(); changeSlide(idx + (event.key === "ArrowLeft" ? -1 : 1))
        }
      }}>
      <ReadonlyPresentation key={moduleId + slide.slide_id + idx}>
      <SlideSurface fit={layout === "fit"}>
        <h2 className="mb-4 text-xl font-semibold text-[var(--ink)]">{slide.title}</h2>
        <SlideBody key={moduleId + slide.slide_id + idx} slide={slide} ideaMap={ideaMap} previewImageSources={previewImageSources}
          renderedSections={deck.renderedSections} projectName={projectName} knodeDir={deck.knodeDir} />
      </SlideSurface>
      <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-3">
        {hasReadonlyAnimation(slide.payload.technical_visual) && <PresentationPlaybackControls />}
        {audioPath ? audio?.url ? (
          <audio ref={audioRef} key={audioKey} controls autoPlay={playbackRequested} src={audio.url} className="h-9 w-full"
            aria-label={t("teacher.narration_audio")}
            onPlay={() => {
              setPlaybackRequested(true)
              window.dispatchEvent(new CustomEvent("systemedu:lesson-audio-focus", { detail: "slides" }))
            }}
            onError={() => setAudioState({ key: audioKey, error: true })}>
            {t("teacher.audio_unsupported")}
          </audio>
        ) : audio?.error ? (
          <div role="status" className="flex items-center justify-between gap-3 text-sm text-[var(--sub)]">
            <span>{t("teacher.audio_failed")}</span>
            <button type="button" className="underline" onClick={() => setRetry(r => r + 1)}>{t("course.retry")}</button>
          </div>
        ) : <LoadingSpinner size="xs" inline label={t("teacher.audio_loading")} />
        : <p className="text-xs text-[var(--sub)]">{t("teacher.no_audio")}</p>}
        <details key={slide.slide_id} className="mt-2 text-sm text-[var(--sub)]">
          <summary className="cursor-pointer">{t("teacher.narration_script")}</summary>
          <p className={`mt-2 whitespace-pre-wrap leading-relaxed ${layout === "fit" ? "max-h-28 overflow-auto" : ""}`}>{slide.audio_script || t("teacher.no_script")}</p>
        </details>
      </div>
      </ReadonlyPresentation>
      <nav aria-label={t("teacher.page_navigation")} className="flex shrink-0 items-center justify-between gap-3">
        <button type="button" className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => changeSlide(idx - 1)}>
          <ChevronLeft size={16} />{t("teacher.prev_slide")}
        </button>
        <span aria-live="polite" className="text-sm text-[var(--sub)]">{idx + 1} / {deck.slides.length}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={idx >= deck.slides.length - 1} onClick={() => changeSlide(idx + 1)}>
          {t("teacher.next_slide")}<ChevronRight size={16} />
        </button>
      </nav>
    </div>
  )
}

/** Reading mode grows naturally; a bounded floating window fits the whole teaching surface. */
function SlideSurface({ fit, children }: { fit: boolean; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 960, scale: 1, ready: false })
  useEffect(() => {
    if (!fit || !viewport.current || !content.current) return
    const frame = viewport.current
    const sheet = content.current
    let raf = 0
    const measure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        // Keep multi-column science diagrams readable before fitting them; do not
        // reflow the entire slide into a very tall mobile column inside the window.
        const width = Math.max(960, frame.clientWidth)
        if (Math.abs(sheet.offsetWidth - width) > 1) {
          setSize(previous => ({ ...previous, width, ready: false }))
          return // ResizeObserver measures the new natural height on the next pass.
        }
        const height = Math.max(sheet.offsetHeight, sheet.scrollHeight, 1)
        const scale = Math.min(1, frame.clientWidth / width, frame.clientHeight / height)
        setSize(previous => previous.width === width && Math.abs(previous.scale - scale) < 0.0001 && previous.ready
          ? previous : { width, scale, ready: true })
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    observer.observe(sheet)
    measure()
    return () => { cancelAnimationFrame(raf); observer.disconnect() }
  }, [fit])
  const sheetClass = "min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6"
  if (!fit) return <div data-slide-surface className={sheetClass}>{children}</div>
  return <div ref={viewport} data-slide-viewport className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
    <div ref={content} data-slide-surface className={`absolute left-1/2 top-0 ${sheetClass}`}
      style={{ width: size.width, transformOrigin: "top center", transform: `translateX(-50%) scale(${size.scale})`,
        visibility: size.ready ? "visible" : "hidden" }}>
      {children}
    </div>
  </div>
}
/** 按 slide.kind 渲染 payload 正文 + inline_svg 配图。
 *  数据里 body_markdown 一直为空, 真内容在 payload (spec 039 修)。 */
export function SlideBody({
  slide, ideaMap, renderedSections, projectName, knodeDir, previewImageSources,
}: {
  slide: SlideEntry
  ideaMap: Map<string, CourseIdeaSummary>
  renderedSections: Record<string, RenderedSection>
  projectName: string
  knodeDir: string
  previewImageSources?: Record<string, string>
}) {
  const t = useT()
  const p = slide.payload || {}
  const rasterFirst = p.technical_visual?.renderer === "tendon-torque" && p.technical_visual.scene === "material"
  const imageVisual = (
      <AuthenticatedSlideVisual
        key={slide.slide_id}
        projectName={projectName}
        knodeDir={knodeDir}
        title={slide.title}
        images={p.images}
        inlineSvg={p.technical_visual ? undefined : p.inline_svg}
        showInlineSvgWithImage={p.visual_mode === "hybrid"}
        previewImageSources={process.env.NODE_ENV === "development" ? previewImageSources : undefined}
      />
  )
  const visual = (
    <>
      {rasterFirst && imageVisual}
      <TechnicalVisual visual={p.technical_visual} />
      {!rasterFirst && imageVisual}
      <TeachingSequence sequence={p.teaching_sequence} />
    </>
  )

  switch (slide.kind) {
    case "intro":
      return (
        <div className="text-[var(--ink)]">
          {p.hero_title && <p className="text-xl font-semibold">{p.hero_title}</p>}
          {p.hero_subtitle && <p className="mt-2 text-[var(--sub)]">{p.hero_subtitle}</p>}
          {visual}
        </div>
      )
    case "outro":
      return (
        <div className="text-[var(--ink)]">
          {p.hero_title && <p className="text-xl font-semibold">{p.hero_title}</p>}
          {p.key_takeaway && (
            <p className="mt-3 rounded-lg bg-[var(--paper-2)] p-3 text-[var(--ink)]">
              {p.key_takeaway}
            </p>
          )}
          <SlideBulletList bullets={p.bullets} />
          {visual}
        </div>
      )
    case "bullet":
      return (
        <div className="text-[var(--ink)]">
          {p.hero_title && <p className="mb-3 text-lg font-semibold">{p.hero_title}</p>}
          {(p.concept_cards || []).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(p.concept_cards || []).map((c, i) => (
                <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--paper-2)] p-3">
                  <p className="font-medium text-[var(--ink)]">{c.title}</p>
                  <p className="mt-1 text-sm text-[var(--sub)]">{c.body}</p>
                </div>
              ))}
            </div>
          )}
          <SlideBulletList bullets={p.bullets} />
          {visual}
        </div>
      )
    case "theory":
      return (
        <div className="text-[var(--ink)]">
          {p.layman_analogy && (
            <p className="mb-3 rounded-lg bg-[var(--primary-soft)] p-3 text-[var(--ink)]">
              {p.layman_analogy}
            </p>
          )}
          {p.formula && (
            <FormulaVisual latex={p.formula} />
          )}
          {(p.bullets || []).length > 0 && (
            <ul className="ml-5 list-disc space-y-1 text-[var(--ink)]">
              {(p.bullets || []).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {visual}
        </div>
      )
    case "animation":
    case "game":
    case "diagram": {
      // An explicitly reviewed replacement takes precedence over an outdated
      // linked activity; other existing lesson activities are unchanged.
      if (p.technical_visual) return visual
      // idea_id 关联回真实生成的 course_content, 复用 IdeaBlock 打开同一套
      // iframe 弹窗; 拿不到数据(老版本 slide/生成失败)才退回纯文字兜底。
      const ideaId = p.idea_id || p.diagram_html_id
      const idea = ideaId ? ideaMap.get(ideaId) : undefined
      const section = ideaId ? renderedSections[ideaId] : undefined
      if (idea && section) {
        return <IdeaBlock idea={idea} section={section} />
      }
      return (
        <div className="text-[var(--ink)]">
          {p.short_desc && <p>{p.short_desc}</p>}
          {p.call_to_action && (
            <p className="mt-2 text-sm font-medium text-[var(--primary)]">{p.call_to_action}</p>
          )}
          {visual}
        </div>
      )
    }
    default:
      return p.images?.[0] || p.inline_svg || p.technical_visual || p.teaching_sequence
        ? visual
        : <p className="text-sm text-[var(--sub)]">{t("teacher.no_content")}</p>
  }
}

function SlideBulletList({ bullets }: { bullets?: string[] }) {
  if (!bullets?.length) return null
  return (
    <ul className="my-3 ml-5 list-disc space-y-2 text-[var(--ink)]">
      {bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
    </ul>
  )
}

/**
 * A small process playback surface for slides where the learner must follow
 * an ordered change of state. The content comes from slide payload data, so
 * the animation remains semantically specific instead of decorative.
 */
function TeachingSequence({ sequence }: { sequence?: SlideTeachingSequence }) {
  const steps = sequence?.steps ?? []
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (steps.length < 2) return
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % steps.length)
    }, 2400)
    return () => window.clearInterval(timer)
  }, [steps.length])

  if (steps.length < 2) return null

  return (
    <section
      aria-label={sequence?.label || "讲解过程演示"}
      className="my-4 overflow-hidden rounded-xl border border-[#BFD2E0] bg-[#F6FAFC]"
    >
      <div className="flex items-center justify-between border-b border-[#D6E1EA] bg-white/80 px-4 py-2.5">
        <p className="text-xs font-semibold tracking-wide text-[#315F7A]">
          {sequence?.label || "过程演示"}
        </p>
        <span className="rounded-full bg-[#E2F1F8] px-2 py-0.5 text-[11px] font-medium text-[#315F7A]">
          自动演示
        </span>
      </div>
      <ol className="grid gap-px bg-[#D6E1EA] sm:grid-cols-3">
        {steps.map((step, index) => {
          const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "waiting"
          const isActive = state === "active"
          return (
            <li
              key={`${step.title}-${index}`}
              className={`min-h-28 bg-[#F6FAFC] p-3 transition-colors duration-500 ${
                isActive ? "bg-[#FFF9EA]" : state === "done" ? "bg-[#F2FBF7]" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isActive ? "bg-[#E5AE31] text-white" : state === "done" ? "bg-[#4DAE8B] text-white" : "bg-[#DDE6EC] text-[#607287]"
                }`}>
                  {state === "done" ? "✓" : index + 1}
                </span>
                <p className="text-sm font-semibold text-[#17324D]">{step.title}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#607287]">{step.detail}</p>
              <p className={`mt-2 text-[11px] font-semibold ${
                isActive ? "text-[#A56A10]" : state === "done" ? "text-[#23725D]" : "text-[#8392A1]"
              }`}>
                {isActive ? "正在展示" : state === "done" ? "已保留为证据" : "等待下一步"}
              </p>
            </li>
          )
        })}
      </ol>
      <p className="border-t border-[#D6E1EA] bg-white px-4 py-2 text-xs text-[#466275]" aria-live="polite">
        当前状态：{steps[activeIndex]?.title} · {steps[activeIndex]?.detail}
      </p>
    </section>
  )
}

function AuthenticatedSlideVisual({
  projectName, knodeDir, title, images, inlineSvg, showInlineSvgWithImage = false, previewImageSources,
}: {
  projectName: string
  knodeDir: string
  title: string
  images?: { src: string; caption?: string }[]
  inlineSvg?: string
  showInlineSvgWithImage?: boolean
  previewImageSources?: Record<string, string>
}) {
  const [imageIndex, setImageIndex] = useState(0)
  const imageCount = images?.length ?? 0
  const currentImageIndex = Math.min(imageIndex, Math.max(0, imageCount - 1))
  const image = images?.[currentImageIndex]
  const imagePath = image?.src
    ? image.src.startsWith("knodes/")
      ? image.src
      : `${knodeDir.replace(/\/$/, "")}/${image.src.replace(/^\//, "")}`
    : null
  const hasMultipleImages = imageCount > 1

  if (image && imagePath) {
    return (
      <div className="my-4 space-y-4">
        {previewImageSources?.[image.src] ? <figure className="overflow-hidden rounded-xl border border-[var(--border)] bg-[#FFFEFB]">
          <Image unoptimized src={previewImageSources[image.src]} alt={image.caption || title} width={1672} height={941} className="aspect-video max-h-[520px] w-full object-contain" />
          {image.caption && <figcaption className="px-4 py-3 text-xs text-[#617E90]">{image.caption}</figcaption>}
        </figure> : <AuthenticatedSlideImage
          key={imagePath}
          projectName={projectName}
          imagePath={imagePath}
          title={title}
          caption={image.caption}
          inlineSvg={inlineSvg}
        />}
        {showInlineSvgWithImage && inlineSvg && (
          <div
            className="flex justify-center rounded-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-3 [&_svg]:h-auto [&_svg]:max-h-[320px] [&_svg]:w-full [&_svg]:max-w-xl"
            dangerouslySetInnerHTML={{ __html: inlineSvg }}
          />
        )}
        {hasMultipleImages && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="上一张图片"
              disabled={currentImageIndex === 0}
              onClick={() => setImageIndex((index) => Math.max(0, index - 1))}
            >
              <ChevronLeft size={14} /> 上一张
            </button>
            <span className="text-xs text-[var(--sub)]">{currentImageIndex + 1} / {imageCount}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="下一张图片"
              disabled={currentImageIndex === imageCount - 1}
              onClick={() => setImageIndex((index) => Math.min(imageCount - 1, index + 1))}
            >
              下一张 <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    )
  }

  return inlineSvg ? (
    <div
      className="my-4 flex justify-center [&_svg]:h-auto [&_svg]:max-h-[320px] [&_svg]:w-full [&_svg]:max-w-xl"
      dangerouslySetInnerHTML={{ __html: inlineSvg }}
    />
  ) : null
}

function AuthenticatedSlideImage({
  projectName, imagePath, title, caption, inlineSvg,
}: {
  projectName: string
  imagePath: string
  title: string
  caption?: string
  inlineSvg?: string
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let revoked = false
    let url: string | null = null
    const token = getToken()
    fetch(myProjects.fileUrl(projectName, imagePath), {
      headers: { "X-Course-Numbering": MOLECULE_NUMBERING_VERSION, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((response) => (
        response.ok ? response.blob() : Promise.reject(new Error(`image ${response.status}`))
      ))
      .then((blob) => {
        if (revoked) return
        url = URL.createObjectURL(blob)
        setImageSrc(url)
      })
      .catch(() => { if (!revoked) setFailed(true) })
    return () => {
      revoked = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [projectName, imagePath])

  if (imageSrc && !failed) {
    return (
      <figure className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--paper-2)]">
        <Image
          unoptimized
          src={imageSrc}
          alt={caption || title}
          width={1672}
          height={941}
          className="aspect-video max-h-[520px] w-full object-contain"
        />
        {caption && (
          <figcaption className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--sub)]">
            {caption}
          </figcaption>
        )}
      </figure>
    )
  }

  if (!failed) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--paper-2)]">
        <LoadingSpinner size="sm" label="正在加载图片" />
      </div>
    )
  }

  return inlineSvg ? (
    <div
      className="flex justify-center [&_svg]:h-auto [&_svg]:max-h-[320px] [&_svg]:w-full [&_svg]:max-w-xl"
      dangerouslySetInnerHTML={{ __html: inlineSvg }}
    />
  ) : null
}
