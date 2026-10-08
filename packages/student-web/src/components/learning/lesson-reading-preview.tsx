"use client"

import { useState } from "react"
import type { CourseContent, SlideEntry } from "@/lib/types/api"
import { AudioProvider, PlanWithIdeas } from "./course-content-view"
import { LessonSlidesProvider, LessonSlideCarousel, LessonSlideshowButton } from "./lesson-slides"

export interface ReadingPreviewNode {
  id: string
  title: string
  content: CourseContent
  slides: SlideEntry[]
  audioSources?: Record<string, string>
}

export function LessonReadingPreview({ nodes }: { nodes: ReadingPreviewNode[] }) {
  const [index, setIndex] = useState(0)
  const node = nodes[index]
  return <AudioProvider key={node.id}>
    <LessonSlidesProvider key={node.id} content={node.content} slides={node.slides} projectName="molecule-monster-hunter" moduleId={node.id}
      title={node.title} previewAudioSources={node.audioSources}>
      <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--paper)]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-medium text-[var(--primary-ink)]">学习界面已上线 · 此页为本地样例</p>
              <h1 className="mt-1 text-lg font-semibold">{node.title}</h1></div>
            <LessonSlideshowButton />
          </div>
        </header>
        <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-8" data-lesson-reading>
          <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--paper-2)] p-4 text-sm text-[var(--sub)]">
            <p>上方是一个可以左右翻页的讲课组件，一次只显示一张幻灯片和对应音频；下方是课程正文。“幻灯片”按钮把当前页切到浮窗，不会另外展开整套 slide。<a href="#lesson-player" className="ml-2 font-semibold text-[var(--primary-ink)] underline">查看翻页播放器</a></p>
            <nav aria-label="预览节点" className="flex flex-wrap gap-2">{nodes.map((n, i) => <button type="button" key={n.id} aria-pressed={i === index} onClick={() => setIndex(i)}
              className={`rounded-lg border px-3 py-2 ${i === index ? "border-[var(--primary-line)] bg-[var(--primary-soft)] text-[var(--primary-ink)]" : "border-[var(--border-2)] bg-[var(--card)]"}`}>{i === 0 ? "M03 · 新图解与正文" : "M04 · 原有语音验证"}</button>)}</nav>
            <p className="text-xs">{index === 0 ? "M03 使用上一批新图解；新讲稿尚未配音，因此浮窗会提示暂无语音。" : "M04 使用已有课文、已有幻灯片和已有语音，只验证合并阅读与浮窗播放，不代表本次重新制作了画面。"}</p>
          </section>
          <LessonSlideCarousel />
          <div className="mx-auto max-w-4xl space-y-10">
            <h2 className="border-t border-[var(--border)] pt-8 text-xl font-semibold">课程正文</h2>
            <PlanWithIdeas content={node.content} />
          </div>
        </div>
      </main>
    </LessonSlidesProvider>
  </AudioProvider>
}
