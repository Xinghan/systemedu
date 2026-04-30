// Slide content renderer — 富 payload 版.
// 每个 kind 用专属布局, LLM 现场画的 inline_svg 作为视觉锚点, anim/game/diagram
// 走"缩略图卡片 + 全屏弹窗"模式 (按节点页 IframeModal 同款体验).
"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import { ExternalLink, PlayCircle, Maximize2, Sparkles, Lightbulb } from "lucide-react"
import type { SlideEntry, SlideConceptCard } from "@/lib/types/api"
import { Button } from "@/components/ui/button"
import { IframeModal } from "@/components/learning/iframe-modal"

export interface SlideContentProps {
  slide: SlideEntry
  /** Map idea_id → rendered html string (anim/game). For full-screen modal. */
  renderedSections?: Record<string, { html?: string | null }>
}

const KIND_BADGE: Record<string, { label: string; cls: string }> = {
  intro:      { label: "导入",   cls: "bg-amber-100 text-amber-800 border-amber-200" },
  bullet:     { label: "概念",   cls: "bg-stone-100 text-stone-700 border-stone-200" },
  theory:     { label: "基础理论", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  animation:  { label: "动画",   cls: "bg-orange-100 text-orange-800 border-orange-200" },
  game:       { label: "互动",   cls: "bg-orange-100 text-orange-800 border-orange-200" },
  image:      { label: "图片",   cls: "bg-stone-100 text-stone-700 border-stone-200" },
  diagram:    { label: "示意图", cls: "bg-stone-100 text-stone-700 border-stone-200" },
  videos:     { label: "视频",   cls: "bg-stone-100 text-stone-700 border-stone-200" },
  labxchange: { label: "扩展",   cls: "bg-stone-100 text-stone-700 border-stone-200" },
  outro:      { label: "总结",   cls: "bg-amber-100 text-amber-800 border-amber-200" },
}

export function SlideContent({ slide, renderedSections }: SlideContentProps) {
  const badge = KIND_BADGE[slide.kind] ?? KIND_BADGE.bullet
  return (
    <div className="w-full h-full flex flex-col text-stone-900 bg-gradient-to-br from-stone-50 via-stone-50 to-amber-50/70 overflow-hidden">
      <header className="shrink-0 px-5 py-2.5 flex items-center gap-3 border-b border-stone-200/70 bg-white/60 backdrop-blur-sm">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase border ${badge.cls}`}
        >
          {badge.label}
        </span>
        {slide.title && (
          <h2 className="text-sm font-bold text-stone-700 leading-tight truncate flex-1">
            {slide.title}
          </h2>
        )}
      </header>
      <div className="flex-1 min-h-0 overflow-auto">
        <SlideBody slide={slide} renderedSections={renderedSections} />
      </div>
    </div>
  )
}

function SlideBody({ slide, renderedSections }: SlideContentProps) {
  switch (slide.kind) {
    case "intro":   return <IntroBody slide={slide} />
    case "outro":   return <OutroBody slide={slide} />
    case "bullet":  return <BulletBody slide={slide} />
    case "theory":  return <TheoryBody slide={slide} />
    case "animation":
    case "game":
    case "diagram": return <MediaCardBody slide={slide} renderedSections={renderedSections} />
    case "image":   return <ImageGridBody slide={slide} />
    case "videos":  return <VideosBody slide={slide} />
    case "labxchange": return <LabxchangeBody slide={slide} />
    default:        return <FallbackBody slide={slide} />
  }
}

// ─── Intro ─────────────────────────────────────────────────────────────────
function IntroBody({ slide }: { slide: SlideEntry }) {
  const pl = slide.payload
  const heroTitle = pl.hero_title || slide.title
  const heroSub = pl.hero_subtitle || ""
  return (
    <div className="h-full flex items-center justify-center px-8 py-6 anim-fade-up">
      <div className="max-w-2xl text-center space-y-5">
        {pl.inline_svg && <SvgBlock svg={pl.inline_svg} className="w-32 h-32 mx-auto" />}
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight text-stone-900 tracking-tight">
          {heroTitle}
        </h1>
        {heroSub && (
          <p className="text-base md:text-lg text-stone-600 leading-relaxed">{heroSub}</p>
        )}
      </div>
    </div>
  )
}

// ─── Outro ─────────────────────────────────────────────────────────────────
function OutroBody({ slide }: { slide: SlideEntry }) {
  const pl = slide.payload
  return (
    <div className="h-full flex items-center justify-center px-8 py-6 anim-fade-up">
      <div className="max-w-2xl text-center space-y-5">
        {pl.inline_svg && <SvgBlock svg={pl.inline_svg} className="w-28 h-28 mx-auto" />}
        <h1 className="text-2xl md:text-3xl font-extrabold leading-tight text-stone-900">
          {pl.hero_title || slide.title}
        </h1>
        {pl.hero_subtitle && (
          <p className="text-base text-stone-600">{pl.hero_subtitle}</p>
        )}
        {pl.key_takeaway && (
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-100 border border-amber-300/70 text-amber-900 text-base font-semibold shadow-sm">
            <Sparkles className="size-4 text-amber-600 shrink-0" />
            {pl.key_takeaway}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bullet (concept) ──────────────────────────────────────────────────────
function BulletBody({ slide }: { slide: SlideEntry }) {
  const pl = slide.payload
  const cards = pl.concept_cards ?? []
  return (
    <div className="px-6 py-5 anim-fade-up">
      <div className="flex items-start gap-5 mb-5">
        {pl.inline_svg && <SvgBlock svg={pl.inline_svg} className="w-20 h-20 shrink-0" />}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-extrabold text-stone-900 leading-tight">
            {pl.hero_title || slide.title}
          </h2>
        </div>
      </div>
      {cards.length > 0 ? (
        <div className={`grid ${cards.length >= 3 ? "grid-cols-3" : `grid-cols-${cards.length}`} gap-3`}>
          {cards.map((c, i) => (
            <ConceptCard key={i} card={c} />
          ))}
        </div>
      ) : (
        <FallbackMarkdown body={slide.body_markdown} />
      )}
    </div>
  )
}

function ConceptCard({ card }: { card: SlideConceptCard }) {
  return (
    <div className="rounded-xl bg-white border border-stone-200 p-3.5 shadow-sm hover:shadow-md hover:border-amber-300 transition-all anim-fade-up">
      <div className="flex items-center gap-2 mb-1.5">
        {card.icon_svg && <SvgBlock svg={card.icon_svg} className="w-7 h-7 shrink-0" />}
        <h3 className="text-sm font-bold text-stone-800 leading-tight">{card.title}</h3>
      </div>
      <p className="text-xs text-stone-600 leading-relaxed">{card.body}</p>
    </div>
  )
}

// ─── Theory ────────────────────────────────────────────────────────────────
function TheoryBody({ slide }: { slide: SlideEntry }) {
  const pl = slide.payload
  return (
    <div className="px-6 py-5 anim-fade-up">
      <div className="flex items-start gap-5 mb-5">
        {pl.inline_svg && <SvgBlock svg={pl.inline_svg} className="w-24 h-24 shrink-0" />}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-extrabold text-amber-900 leading-tight mb-1.5">
            {slide.title}
          </h2>
          {pl.layman_analogy && (
            <div className="inline-flex items-start gap-1.5 text-sm text-amber-800 italic">
              <Lightbulb className="size-4 mt-0.5 shrink-0 text-amber-600" />
              <span>{pl.layman_analogy}</span>
            </div>
          )}
        </div>
      </div>
      {pl.formula && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-stone-100/70 border border-stone-200 text-center font-mono text-base text-stone-800">
          {pl.formula}
        </div>
      )}
      {pl.bullets && pl.bullets.length > 0 ? (
        <ul className="space-y-2">
          {pl.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-stone-700 leading-relaxed">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : (
        <FallbackMarkdown body={slide.body_markdown} />
      )}
    </div>
  )
}

// ─── Animation / Game / Diagram (缩略图 + 全屏按钮) ──────────────────────
function MediaCardBody({
  slide,
  renderedSections,
}: {
  slide: SlideEntry
  renderedSections?: Record<string, { html?: string | null }>
}) {
  const pl = slide.payload
  const ideaId = pl.idea_id || pl.diagram_html_id || ""
  const html = (ideaId && renderedSections?.[ideaId]?.html) || ""
  const [open, setOpen] = useState(false)
  const [reset, setReset] = useState(0)
  const cta = pl.call_to_action || (slide.kind === "game" ? "▶ 全屏体验" : "▶ 打开动画")
  const desc = pl.short_desc || slide.body_markdown || ""

  const openModal = () => {
    setReset((k) => k + 1)
    setOpen(true)
  }

  return (
    <div className="px-6 py-5 anim-fade-up">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-center">
        {/* 左侧大缩略图 */}
        <button
          type="button"
          onClick={openModal}
          disabled={!html}
          className="md:col-span-3 group relative aspect-video rounded-xl bg-stone-200 overflow-hidden border border-stone-200 hover:border-amber-400 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {pl.thumbnail_url ? (
            <img
              src={pl.thumbnail_url}
              alt={slide.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-500">
              <PlayCircle className="size-12" />
            </div>
          )}
          {/* Hover overlay with maximize hint */}
          <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/30 flex items-center justify-center transition-colors">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold">
              <Maximize2 className="size-3.5" />
              {cta}
            </div>
          </div>
        </button>

        {/* 右侧描述 + 按钮 */}
        <div className="md:col-span-2 space-y-3">
          <p className="text-sm text-stone-700 leading-relaxed">{desc}</p>
          <Button onClick={openModal} disabled={!html} size="sm" className="w-full">
            <Maximize2 className="size-3.5" />
            {cta}
          </Button>
          {!html && (
            <p className="text-[10px] text-stone-500 italic">媒体内容尚未生成</p>
          )}
        </div>
      </div>

      <IframeModal
        open={open}
        onClose={() => setOpen(false)}
        html={html}
        title={slide.title || slide.kind}
        resetKey={reset}
      />
    </div>
  )
}

// ─── Image grid ────────────────────────────────────────────────────────────
function ImageGridBody({ slide }: { slide: SlideEntry }) {
  const pl = slide.payload
  const images = pl.images ?? []
  if (images.length === 0) return <FallbackMarkdown body={slide.body_markdown} />
  return (
    <div className="px-6 py-5 anim-fade-up">
      {pl.intro_text && (
        <p className="text-sm text-stone-700 mb-4 leading-relaxed">{pl.intro_text}</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((img) => (
          <a
            key={img.src}
            href={img.source_url || img.src}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-video bg-stone-100 rounded-lg overflow-hidden border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all"
          >
            <img src={img.src} alt={img.caption || ""} className="w-full h-full object-cover" />
            {img.caption && (
              <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-gradient-to-t from-stone-900/80 to-transparent text-[10px] text-white truncate">
                {img.caption}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── Videos ───────────────────────────────────────────────────────────────
function VideosBody({ slide }: { slide: SlideEntry }) {
  const pl = slide.payload
  const videos = pl.videos ?? []
  if (videos.length === 0) return <FallbackMarkdown body={slide.body_markdown} />
  return (
    <div className="px-6 py-5 anim-fade-up">
      {pl.intro_text && (
        <p className="text-sm text-stone-700 mb-4 leading-relaxed">{pl.intro_text}</p>
      )}
      <div className="space-y-2">
        {videos.map((v) => (
          <a
            key={v.url}
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-3 items-start p-2 rounded-lg border border-stone-200 hover:border-amber-400 hover:bg-amber-50/50 transition-colors"
          >
            {v.thumbnail ? (
              <img
                src={v.thumbnail}
                alt=""
                className="w-32 h-20 object-cover rounded shrink-0 bg-stone-100"
              />
            ) : (
              <div className="w-32 h-20 rounded bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
                <PlayCircle className="size-5" />
              </div>
            )}
            <div className="flex-1 min-w-0 text-xs leading-relaxed">
              <div className="font-semibold text-stone-800 line-clamp-2 group-hover:text-amber-800">
                {v.title || v.url}
              </div>
              <div className="opacity-50 truncate text-[10px] mt-0.5 inline-flex items-center gap-1">
                <ExternalLink className="size-3" />
                {v.url}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── LabXchange ───────────────────────────────────────────────────────────
function LabxchangeBody({ slide }: { slide: SlideEntry }) {
  const pl = slide.payload
  const items = pl.labxchange ?? []
  if (items.length === 0) return <FallbackMarkdown body={slide.body_markdown} />
  return (
    <div className="px-6 py-5 anim-fade-up">
      {pl.intro_text && (
        <p className="text-sm text-stone-700 mb-4 leading-relaxed">{pl.intro_text}</p>
      )}
      <div className="space-y-2">
        {items.map((it) => (
          <a
            key={it.url}
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-3 rounded-lg border border-stone-200 hover:border-amber-400 hover:bg-amber-50/50 transition-colors text-xs"
          >
            <div className="font-semibold text-stone-800 group-hover:text-amber-800">{it.title}</div>
            {it.description && (
              <div className="opacity-70 text-[11px] mt-0.5 line-clamp-2 text-stone-700">
                {it.description}
              </div>
            )}
            <div className="opacity-50 text-[10px] mt-1 truncate inline-flex items-center gap-1">
              <ExternalLink className="size-3" />
              {it.url}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function SvgBlock({ svg, className }: { svg: string; className?: string }) {
  // LLM-authored inline SVG. Trusted because we author the prompt + run server-side.
  return (
    <div
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: server-authored SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function FallbackMarkdown({ body }: { body: string }) {
  return (
    <div className="prose prose-stone max-w-none prose-p:my-1.5 prose-li:my-1 text-sm leading-relaxed marker:text-amber-600">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {body || "(no content)"}
      </ReactMarkdown>
    </div>
  )
}

function FallbackBody({ slide }: { slide: SlideEntry }) {
  return (
    <div className="px-6 py-5">
      <FallbackMarkdown body={slide.body_markdown} />
    </div>
  )
}
