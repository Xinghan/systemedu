"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Maximize2, Minimize2, Presentation, X } from "lucide-react"
import type { CourseContent, SlideEntry } from "@/lib/types/api"
import { useT } from "@/lib/i18n/use-t"
import { SlideDeckPlayer, type LessonSlideDeck } from "./teacher-scene-view"

interface LessonSlidesContextValue {
  deck: LessonSlideDeck
  projectName: string
  moduleId: string
  index: number
  setIndex: (index: number) => void
  open: () => void
  close: () => void
  floating: boolean
  previewAudioSources?: Record<string, string>
}
const LessonSlidesContext = createContext<LessonSlidesContextValue | null>(null)
const EMPTY_SLIDES: SlideEntry[] = []

export function LessonSlidesProvider({ content, slides = EMPTY_SLIDES, projectName, moduleId, knodeDir, title, children, previewAudioSources, currentIndex, onIndexChange }: {
  content?: CourseContent
  slides?: SlideEntry[]
  projectName: string
  moduleId: string
  knodeDir?: string
  title?: string
  children: ReactNode
  previewAudioSources?: Record<string, string>
  currentIndex?: number
  onIndexChange?: (index: number) => void
}) {
  const [localIndex, setLocalIndex] = useState(0)
  const index = currentIndex ?? localIndex
  const setIndex = onIndexChange ?? setLocalIndex
  const [floating, setFloating] = useState(false)
  const close = useCallback(() => setFloating(false), [])
  const deck = useMemo(() => ({ slides, ideas: content?.ideas || [], renderedSections: content?.rendered_sections || {}, knodeDir: knodeDir || `knodes/${moduleId}` }), [slides, content, knodeDir, moduleId])
  const open = () => {
    if (!slides.length) return
    window.dispatchEvent(new CustomEvent("systemedu:lesson-audio-focus", { detail: "slides" }))
    setFloating(true)
  }
  return <LessonSlidesContext.Provider value={{ deck, projectName, moduleId, index, setIndex, open, close, floating, previewAudioSources }}>
    {children}
    {floating && createPortal(
      <FloatingSlideshow title={title || moduleId} onClose={close}>
        <LessonPlayerSurface autoPlay layout="fit" />
      </FloatingSlideshow>, document.body)}
  </LessonSlidesContext.Provider>
}

function LessonPlayerSurface({ autoPlay = false, layout = "content" }: { autoPlay?: boolean; layout?: "content" | "fit" }) {
  const context = useContext(LessonSlidesContext)
  if (!context) return null
  return <SlideDeckPlayer deck={context.deck} projectName={context.projectName} moduleId={context.moduleId}
    currentIndex={context.index} onIndexChange={context.setIndex} autoPlay={autoPlay} layout={layout}
    previewAudioSources={context.previewAudioSources} />
}

export function LessonSlideshowButton() {
  const context = useContext(LessonSlidesContext)
  const t = useT()
  if (!context) return null
  return <button type="button" aria-haspopup="dialog" aria-expanded={context.floating} disabled={!context.deck.slides.length}
    title={t(context.deck.slides.length ? "lesson.open_slides" : "teacher.no_slides")}
    onClick={context.open}
    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--primary-line)] bg-[var(--primary-soft)] px-3 text-sm font-semibold text-[var(--primary-ink)] hover:bg-[var(--paper-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-40">
    <Presentation size={16} aria-hidden="true" />{t("lesson.slideshow")}
  </button>
}

/** One slide + its matching narration. The article below never contains a slide gallery. */
export function LessonSlideCarousel() {
  const context = useContext(LessonSlidesContext)
  const t = useT()
  if (!context?.deck.slides.length) return null
  return <section id="lesson-player" aria-label={t("lesson.carousel_title")} data-lesson-carousel
    className="scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--paper)]">
    <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--primary-soft)] px-4 py-3">
      <div><h2 className="font-semibold text-[var(--ink)]">{t("lesson.carousel_title")}</h2>
        <p className="mt-1 text-xs text-[var(--sub)]">{t("lesson.carousel_hint")}</p></div>
      <span className="shrink-0 text-xs text-[var(--primary-ink)]">{t("lesson.slide_count", { n: context.deck.slides.length })}</span>
    </header>
    <div>
      {context.floating ? <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center text-sm text-[var(--sub)]">
        <Presentation size={32} className="text-[var(--primary-ink)]" />
        <p>{t("lesson.player_in_window")}</p>
        <button type="button" onClick={context.close} className="rounded-lg border border-[var(--border-2)] bg-[var(--card)] px-4 py-3 text-[var(--ink)]">{t("lesson.return_inline")}</button>
      </div> : <LessonPlayerSurface />}
    </div>
  </section>
}

function FloatingSlideshow({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus({ preventScroll: true })
    const escape = (event: KeyboardEvent) => {
      const targetDialog = (event.target as HTMLElement)?.closest?.('[role="dialog"]')
      if (event.key === "Escape" && (!targetDialog || targetDialog === dialog.current)) {
        event.preventDefault(); onClose()
      }
    }
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("keydown", escape); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [onClose])
  return <div ref={dialog} role="dialog" aria-modal="false" aria-label={t("lesson.window_title", { title })} tabIndex={-1}
    className={`fixed z-[80] flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--paper)] shadow-2xl outline-none ${expanded ? "inset-2 sm:inset-3" : "inset-x-2 bottom-2 h-[94dvh] sm:left-auto sm:right-5 sm:bottom-5 sm:h-[92dvh] sm:w-[min(1200px,calc(100vw-40px))]"}`}>
    <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--paper-2)] px-4 py-2">
      <Presentation size={18} className="shrink-0 text-[var(--primary-ink)]" />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--ink)]">{title}</p><p className="text-xs text-[var(--sub)]">{t("lesson.window_hint")}</p></div>
      <button type="button" className="rounded-lg p-3 hover:bg-[var(--card)] focus-visible:outline-2" aria-label={t(expanded ? "lesson.restore" : "lesson.expand")} onClick={() => setExpanded(x => !x)}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
      <button type="button" className="rounded-lg p-3 hover:bg-[var(--card)] focus-visible:outline-2" aria-label={t("lesson.close_slides")} onClick={onClose}><X size={20} /></button>
    </header>
    <div className="min-h-0 flex-1">{children}</div>
  </div>
}
