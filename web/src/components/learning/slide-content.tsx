// 渲染单张 slide 的内容到投影屏区域。LizardScene 的 `slide` slot 接受任意
// ReactNode, 这里根据 slide.kind 选不同模板。
//
// 设计原则: 内容显示在投影屏 (沙漠场景中央), 配色用暖色纸张感 (米白底 + 沙金
// 强调色), 与红沙漠背景调子一致, 不再用蓝紫硬撞。markdown 用 stone/amber
// tokens 自然融入。
"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import { ExternalLink, PlayCircle } from "lucide-react"
import type { SlideEntry } from "@/lib/types/api"

export interface SlideContentProps {
  slide: SlideEntry
  /** Map idea_id → rendered html string (anim/game). When the kind is animation/game/diagram
   *  this hook gets used to embed the actual content via iframe srcDoc. */
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
    <div className="w-full h-full flex flex-col text-stone-900 bg-gradient-to-br from-stone-50 to-amber-50/70 overflow-hidden">
      {/* Slide header — 顶部一条窄 chrome, 类似 keynote slide 标题栏 */}
      <header className="shrink-0 px-5 py-3 flex items-center gap-3 border-b border-stone-200/70 bg-white/60 backdrop-blur-sm">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase border ${badge.cls}`}
        >
          {badge.label}
        </span>
        {slide.title && (
          <h2 className="text-base md:text-lg font-bold text-stone-800 leading-tight truncate flex-1">
            {slide.title}
          </h2>
        )}
      </header>

      {/* Slide body — 占满剩余, 滚动 */}
      <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
        <SlideBody slide={slide} renderedSections={renderedSections} />
      </div>
    </div>
  )
}

function SlideBody({ slide, renderedSections }: SlideContentProps) {
  switch (slide.kind) {
    case "intro":
    case "bullet":
    case "outro":
      return <BulletBody body={slide.body_markdown} />
    case "theory":
      return <BulletBody body={slide.body_markdown} accent />
    case "animation":
    case "game": {
      const ideaId = (slide.payload?.idea_id as string | undefined) ?? ""
      const html = renderedSections?.[ideaId]?.html ?? ""
      return <MediaIframeBody html={html} fallback={slide.body_markdown} kind={slide.kind} />
    }
    case "diagram": {
      const ideaId =
        (slide.payload?.diagram_html_id as string | undefined) ??
        (slide.payload?.idea_id as string | undefined) ??
        ""
      const html = renderedSections?.[ideaId]?.html ?? ""
      return <MediaIframeBody html={html} fallback={slide.body_markdown} kind="diagram" />
    }
    case "image":
      return <ImageGridBody payload={slide.payload} fallback={slide.body_markdown} />
    case "videos":
      return <VideosBody payload={slide.payload} fallback={slide.body_markdown} />
    case "labxchange":
      return <LabxchangeBody payload={slide.payload} fallback={slide.body_markdown} />
    default:
      return <BulletBody body={slide.body_markdown} />
  }
}

function BulletBody({ body, accent = false }: { body: string; accent?: boolean }) {
  return (
    <div
      className={[
        "prose prose-stone max-w-none",
        // tighten markdown spacing for slide deck context
        "prose-p:my-1.5 prose-li:my-1 prose-headings:my-2 prose-headings:font-bold",
        "text-sm md:text-[15px] leading-relaxed",
        accent
          ? "prose-strong:text-amber-700 prose-headings:text-amber-900"
          : "prose-strong:text-stone-900 prose-headings:text-stone-800",
        // bullets get amber color so they match the desert tone
        "marker:text-amber-600",
      ].join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {body || "(no content)"}
      </ReactMarkdown>
    </div>
  )
}

function MediaIframeBody({
  html,
  fallback,
  kind,
}: {
  html: string
  fallback: string
  kind: string
}) {
  if (!html) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-stone-500">
        <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center">
          <PlayCircle className="size-6 text-stone-400" />
        </div>
        <div className="text-xs uppercase tracking-wider">{kind} 暂未生成</div>
        <div className="max-w-md text-center text-sm text-stone-700">
          <BulletBody body={fallback} />
        </div>
      </div>
    )
  }
  return (
    <iframe
      title={kind}
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      className="w-full h-full bg-white rounded-lg border border-stone-200 shadow-sm"
      style={{ border: 0 }}
    />
  )
}

interface ImagePayload {
  src: string
  caption?: string
  source_url?: string
}
function ImageGridBody({
  payload,
  fallback,
}: {
  payload: Record<string, unknown>
  fallback: string
}) {
  const images = (payload?.images as ImagePayload[] | undefined) ?? []
  if (images.length === 0) return <BulletBody body={fallback} />
  return (
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
  )
}

interface VideoPayload {
  title: string
  url: string
  thumbnail?: string
}
function VideosBody({
  payload,
  fallback,
}: {
  payload: Record<string, unknown>
  fallback: string
}) {
  const videos = (payload?.videos as VideoPayload[] | undefined) ?? []
  if (videos.length === 0) return <BulletBody body={fallback} />
  return (
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
              className="w-28 h-16 object-cover rounded shrink-0 bg-stone-100"
            />
          ) : (
            <div className="w-28 h-16 rounded bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
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
  )
}

interface LabxPayload {
  title: string
  url: string
  description?: string
}
function LabxchangeBody({
  payload,
  fallback,
}: {
  payload: Record<string, unknown>
  fallback: string
}) {
  const items = (payload?.labxchange as LabxPayload[] | undefined) ?? []
  if (items.length === 0) return <BulletBody body={fallback} />
  return (
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
            <div className="opacity-70 text-[11px] mt-0.5 line-clamp-2 text-stone-700">{it.description}</div>
          )}
          <div className="opacity-50 text-[10px] mt-1 truncate inline-flex items-center gap-1">
            <ExternalLink className="size-3" />
            {it.url}
          </div>
        </a>
      ))}
    </div>
  )
}
