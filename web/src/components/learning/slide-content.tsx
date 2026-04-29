// 渲染单张 slide 的内容到投影屏区域。LizardScene 的 `slide` slot 接受任意
// ReactNode, 这里根据 slide.kind 选不同模板。
"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import type { SlideEntry } from "@/lib/types/api"

export interface SlideContentProps {
  slide: SlideEntry
  /** Map idea_id → rendered html string (anim/game). When the kind is animation/game/diagram
   *  this hook gets used to embed the actual content via iframe srcDoc. */
  renderedSections?: Record<string, { html?: string | null }>
}

export function SlideContent({ slide, renderedSections }: SlideContentProps) {
  return (
    <div className="w-full h-full flex flex-col items-stretch text-white p-5 overflow-hidden">
      {slide.title && (
        <h2 className="text-base md:text-lg font-bold tracking-wide mb-3 shrink-0">
          {slide.title}
        </h2>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
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
      return <BulletBody body={slide.body_markdown} accent="theory" />
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

function BulletBody({ body, accent }: { body: string; accent?: "theory" }) {
  return (
    <div
      className={[
        "prose prose-invert max-w-none",
        "prose-p:my-1 prose-li:my-0.5 prose-headings:my-2",
        "text-sm md:text-base leading-relaxed",
        accent === "theory" ? "prose-strong:text-amber-200" : "",
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
      <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">
        <div className="text-center">
          <div className="opacity-70 mb-1">{kind} not yet ready</div>
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
      className="w-full h-full bg-black/30 rounded"
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
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {images.map((img) => (
        <a
          key={img.src}
          href={img.source_url || img.src}
          target="_blank"
          rel="noopener noreferrer"
          className="relative aspect-video bg-black/30 rounded overflow-hidden hover:ring-2 ring-white/50"
        >
          <img src={img.src} alt={img.caption || ""} className="w-full h-full object-cover" />
          {img.caption && (
            <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/60 text-[10px] truncate">
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
          className="flex gap-3 items-start hover:bg-white/5 p-2 rounded"
        >
          {v.thumbnail ? (
            <img
              src={v.thumbnail}
              alt=""
              className="w-24 h-16 object-cover rounded shrink-0 bg-black/30"
            />
          ) : (
            <div className="w-24 h-16 rounded bg-black/30 flex items-center justify-center text-white/40 text-[10px] shrink-0">
              video
            </div>
          )}
          <div className="flex-1 min-w-0 text-xs leading-relaxed">
            <div className="font-medium line-clamp-2">{v.title || v.url}</div>
            <div className="opacity-50 truncate text-[10px] mt-0.5">{v.url}</div>
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
          className="block hover:bg-white/5 p-2 rounded text-xs"
        >
          <div className="font-medium">{it.title}</div>
          {it.description && (
            <div className="opacity-70 text-[10px] mt-0.5 line-clamp-2">{it.description}</div>
          )}
          <div className="opacity-40 text-[10px] mt-0.5 truncate">{it.url}</div>
        </a>
      ))}
    </div>
  )
}
