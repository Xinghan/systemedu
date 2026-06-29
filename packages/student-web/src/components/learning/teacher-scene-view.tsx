"use client"

/**
 * 老师讲课 — 幻灯片播放器 (spec 2026-06-06)。
 * 从 myProjects.getKnode 取 knode.slides, 翻页展示 (标题 + 正文 + 讲稿常显)。
 * 音频占位: 禁用的播放按钮 (音频文件由用户单独生成后接入)。
 */

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { myProjects } from "@/lib/api"
import type { SlideEntry } from "@/lib/types/api"
import { MarkdownRenderer } from "@/components/chat/markdown-renderer"

interface TeacherSceneViewProps {
  knode: unknown
  projectName: string
  nodeId: number
  moduleId: string
  versionLabel: string | null
  courseContent?: unknown
}

export function TeacherSceneView({ projectName, moduleId }: TeacherSceneViewProps) {
  const [slides, setSlides] = useState<SlideEntry[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSlides(null); setErr(false); setIdx(0)
    myProjects
      .getKnode(projectName, moduleId)
      .then((k) => {
        if (cancelled) return
        setSlides((k.slides as SlideEntry[]) ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setErr(true); setSlides([])
      })
    return () => { cancelled = true }
  }, [projectName, moduleId])

  if (slides === null) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--sub)]">
        加载讲课幻灯片...
      </div>
    )
  }

  if (err || slides.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--paper-2)] text-sm text-[var(--sub)]">
        <p>本节暂无讲课幻灯片</p>
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
        <div className="prose prose-sm max-w-none text-[var(--ink)]">
          <MarkdownRenderer content={slide.body_markdown || ""} />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-4">
        <div className="mb-2 flex items-center gap-2">
          {slide.audio_path ? (
            <audio
              key={slide.slide_id}
              controls
              preload="none"
              src={myProjects.fileUrl(projectName, slide.audio_path)}
              className="h-8 w-full max-w-md"
            >
              你的浏览器不支持音频播放。
            </audio>
          ) : (
            <span className="text-xs text-[var(--sub)]">本张暂无语音</span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap">
          {slide.audio_script || "(本张无讲稿)"}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="btn btn-ghost btn-sm" disabled={atFirst}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}>
          <ChevronLeft size={14} /> 上一张
        </button>
        <span className="text-sm text-[var(--sub)]">{idx + 1} / {slides.length}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={atLast}
          onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}>
          下一张 <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
