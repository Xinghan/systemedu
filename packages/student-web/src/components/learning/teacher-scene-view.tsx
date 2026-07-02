"use client"

/**
 * 老师讲课 — 幻灯片播放器 (spec 2026-06-06)。
 * 从 myProjects.getKnode 取 knode.slides, 翻页展示 (标题 + 正文 + 讲稿常显)。
 * 音频占位: 禁用的播放按钮 (音频文件由用户单独生成后接入)。
 */

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { myProjects } from "@/lib/api"
import { getToken } from "@/lib/auth"
import type { CourseIdeaSummary, RenderedSection, SlideEntry } from "@/lib/types/api"
import { useT } from "@/lib/i18n/use-t"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { IdeaBlock } from "./course-content-view"

interface TeacherSceneViewProps {
  knode: unknown
  projectName: string
  nodeId: number
  moduleId: string
  versionLabel: string | null
  courseContent?: unknown
}

export function TeacherSceneView({ projectName, moduleId }: TeacherSceneViewProps) {
  const t = useT()
  const [slides, setSlides] = useState<SlideEntry[] | null>(null)
  const [ideas, setIdeas] = useState<CourseIdeaSummary[]>([])
  const [renderedSections, setRenderedSections] = useState<Record<string, RenderedSection>>({})
  const [idx, setIdx] = useState(0)
  const [err, setErr] = useState(false)
  // 当前 slide 音频的 blob URL。<audio src> 是浏览器原生请求, 带不上 JWT,
  // 而文件代理端点要登录, 故用 fetch (带 Bearer) 取字节再转 blob URL。
  const [audioSrc, setAudioSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSlides(null); setErr(false); setIdx(0)
    myProjects
      .getKnode(projectName, moduleId)
      .then((k) => {
        if (cancelled) return
        setSlides((k.slides as SlideEntry[]) ?? [])
        // rendered_sections 顶层字段自带 ideas + idea_id->渲染结果的映射,
        // 用来把 animation/game slide 的 idea_id 关联回真实生成的 html。
        setIdeas(k.rendered_sections?.ideas ?? [])
        setRenderedSections(k.rendered_sections?.rendered_sections ?? {})
      })
      .catch(() => {
        if (cancelled) return
        setErr(true); setSlides([])
      })
    return () => { cancelled = true }
  }, [projectName, moduleId])

  const ideaMap = useMemo(() => new Map(ideas.map((i) => [i.idea_id, i])), [ideas])

  // 取当前 slide 音频 (带 JWT fetch -> blob URL), 切换/卸载时 revoke 防泄漏
  const audioPath = slides?.[idx]?.audio_path || null
  useEffect(() => {
    if (!audioPath) { setAudioSrc(null); return }
    let revoked = false
    let url: string | null = null
    const token = getToken()
    fetch(myProjects.fileUrl(projectName, audioPath), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`audio ${r.status}`))))
      .then((blob) => {
        if (revoked) return
        url = URL.createObjectURL(blob)
        setAudioSrc(url)
      })
      .catch(() => { if (!revoked) setAudioSrc(null) })
    return () => {
      revoked = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [projectName, audioPath])

  if (slides === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="md" label={t("teacher.loading_slides")} />
      </div>
    )
  }

  if (err || slides.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--paper-2)] text-sm text-[var(--sub)]">
        <p>{t("teacher.no_slides")}</p>
      </div>
    )
  }

  const slide = slides[idx]
  const atFirst = idx === 0
  const atLast = idx === slides.length - 1

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        <h2 className="mb-4 text-2xl font-semibold text-[var(--ink)]">{slide.title}</h2>
        <SlideBody slide={slide} ideaMap={ideaMap} renderedSections={renderedSections} />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-4">
        <div className="mb-2 flex items-center gap-2">
          {slide.audio_path ? (
            audioSrc ? (
              <audio
                key={slide.slide_id}
                controls
                autoPlay
                src={audioSrc}
                className="h-8 w-full max-w-md"
              >
                {t("teacher.audio_unsupported")}
              </audio>
            ) : (
              <LoadingSpinner size="xs" inline label={t("teacher.audio_loading")} />
            )
          ) : (
            <span className="text-xs text-[var(--sub)]">{t("teacher.no_audio")}</span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">
          {slide.audio_script || t("teacher.no_script")}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="btn btn-ghost btn-sm" disabled={atFirst}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}>
          <ChevronLeft size={14} /> {t("teacher.prev_slide")}
        </button>
        <span className="text-sm text-[var(--sub)]">{idx + 1} / {slides.length}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={atLast}
          onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}>
          {t("teacher.next_slide")} <ChevronRight size={14} /></button>
      </div>
    </div>
  )
}

/** 按 slide.kind 渲染 payload 正文 + inline_svg 配图。
 *  数据里 body_markdown 一直为空, 真内容在 payload (spec 039 修)。 */
function SlideBody({
  slide, ideaMap, renderedSections,
}: {
  slide: SlideEntry
  ideaMap: Map<string, CourseIdeaSummary>
  renderedSections: Record<string, RenderedSection>
}) {
  const t = useT()
  const p = slide.payload || {}
  const svg = p.inline_svg ? (
    <div
      className="my-4 flex justify-center [&_svg]:h-auto [&_svg]:max-h-[320px] [&_svg]:w-full [&_svg]:max-w-xl"
      dangerouslySetInnerHTML={{ __html: p.inline_svg }}
    />
  ) : null

  switch (slide.kind) {
    case "intro":
      return (
        <div className="text-[var(--ink)]">
          {p.hero_title && <p className="text-xl font-semibold">{p.hero_title}</p>}
          {p.hero_subtitle && <p className="mt-2 text-[var(--sub)]">{p.hero_subtitle}</p>}
          {svg}
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
          {svg}
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
          {svg}
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
            <pre className="mb-3 overflow-x-auto rounded-lg bg-[var(--paper-2)] p-3 text-sm">
              {p.formula}
            </pre>
          )}
          {(p.bullets || []).length > 0 && (
            <ul className="ml-5 list-disc space-y-1 text-[var(--ink)]">
              {(p.bullets || []).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          {svg}
        </div>
      )
    case "animation":
    case "game": {
      // idea_id 关联回真实生成的 course_content, 复用 IdeaBlock 打开同一套
      // iframe 弹窗; 拿不到数据(老版本 slide/生成失败)才退回纯文字兜底。
      const idea = p.idea_id ? ideaMap.get(p.idea_id) : undefined
      const section = p.idea_id ? renderedSections[p.idea_id] : undefined
      if (idea && section) {
        return <IdeaBlock idea={idea} section={section} />
      }
      return (
        <div className="text-[var(--ink)]">
          {p.short_desc && <p>{p.short_desc}</p>}
          {p.call_to_action && (
            <p className="mt-2 text-sm font-medium text-[var(--primary)]">{p.call_to_action}</p>
          )}
          {svg}
        </div>
      )
    }
    default:
      return svg || <p className="text-sm text-[var(--sub)]">{t("teacher.no_content")}</p>
  }
}
