"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { CourseContent, KnowledgeLevel, SlideEntry } from "@/lib/types/api"
import { CourseReadingBody, ScaledIframe } from "./course-content-view"
import { SlideDeckPlayer } from "./teacher-scene-view"

const slug = "aloha-bimanual-apprentice"
const tabs = [{ id: "reading", title: "课程内容" }, { id: "lab", title: "互动实验" }, { id: "slides", title: "讲课幻灯片" }, { id: "assignment", title: "作业与交付" }] as const

export function AlohaCoursePreview({ moduleId, modules, stages, knodeDir, content, slides, images, audio, assignment, initialTab = "reading", initialLabMode = "game" }: {
  moduleId: string; modules: { id: string; title: string; stage: string }[]; stages: { id: string; title: string }[]
  knodeDir: string; content: CourseContent; slides: SlideEntry[]; images: Record<string, string>; audio: Record<string, string>; assignment: string
  initialTab?: "reading" | "lab"
  initialLabMode?: "game" | "animation"
}) {
  const router = useRouter()
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>(initialTab)
  const [labMode, setLabMode] = useState<"game" | "animation">(initialLabMode)
  const href = (id: string) => `/preview/aloha/${id}${tab === "lab" ? `?view=lab&mode=${labMode}#interactive-lab` : ""}`
  const [level, setLevel] = useState<KnowledgeLevel>("K1")
  const [slideIndex, setSlideIndex] = useState(0)
  const index = modules.findIndex(m => m.id === moduleId), current = modules[index]
  const labIdeas = content.ideas.filter(idea => ["game", "animation"].includes(idea.mode) && content.rendered_sections[idea.idea_id]?.html)
  const labIdea = labIdeas.find(idea => idea.mode === labMode) || labIdeas[0]
  return <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]" data-aloha-preview={moduleId}>
    <header className="border-b border-[var(--border)] bg-[var(--paper-2)] px-4 py-5 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          <Link href={`/library/${slug}`} className="text-[var(--sub)] hover:underline">← 返回项目介绍</Link>
          <span className="text-[var(--primary-ink)]">本地预览 · 全部 {modules.length} 节已开放</span>
        </div>
        <h1 className="text-2xl font-semibold">{moduleId} · {current.title}</h1>
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-0 flex-1 space-y-1 text-sm">切换课程节点
            <select aria-label="切换课程节点" value={moduleId} onChange={event => router.push(href(event.target.value))} className="block w-full rounded-lg border border-[var(--border-2)] bg-[var(--card)] p-3">
              {stages.map(stage => <optgroup key={stage.id} label={`${stage.id} · ${stage.title}`}>{modules.filter(m => m.stage === stage.id).map(m => <option key={m.id} value={m.id}>{m.id} · {m.title}</option>)}</optgroup>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">理论深度
            <select aria-label="理论深度" value={level} onChange={event => setLevel(event.target.value as KnowledgeLevel)} className="block rounded-lg border border-[var(--border-2)] bg-[var(--card)] p-3">
              <option value="K1">K1 · 直观理解</option><option value="K3">K3 · 推导与计算</option><option value="K5">K5 · 深入研究</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-[var(--sub)]">无需登录即可查看教材、资料与互动。正式学习记录请在登录后的课堂提交。</p>
      </div>
    </header>
    <div className={`mx-auto px-4 py-6 sm:px-8 ${tab === "lab" ? "max-w-[1600px]" : "max-w-5xl"}`}>
      <nav aria-label="课程内容视图" className="mb-6 flex flex-wrap gap-2">
        {tabs.map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-lg border px-4 py-2 text-sm ${tab === item.id ? "border-[var(--primary-line)] bg-[var(--primary-soft)] text-[var(--primary-ink)]" : "border-[var(--border)] bg-[var(--card)]"}`}>{item.title}</button>)}
      </nav>
      {tab === "reading" && <div data-preview-reading><CourseReadingBody content={content} projectName={slug} moduleId={moduleId} knowledgeLevel={level} /></div>}
      {tab === "lab" && <section id="interactive-lab" data-preview-lab>
        {labIdea ? <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{labIdea.topic}</h2>
            <div className="flex gap-2">{labIdeas.map(idea => <button key={idea.idea_id} type="button" aria-pressed={labIdea.idea_id === idea.idea_id} onClick={() => setLabMode(idea.mode as "game" | "animation")} className={`rounded-lg border px-4 py-2 text-sm ${labIdea.idea_id === idea.idea_id ? "border-[var(--primary-line)] bg-[var(--primary-soft)] text-[var(--primary-ink)]" : "border-[var(--border)] bg-[var(--card)]"}`}>{idea.mode === "game" ? "亲手操作" : "观看演示"}</button>)}</div>
          </div>
          <p className="mb-3 text-sm text-[var(--sub)] sm:hidden">操作台适合电脑或平板横屏使用，可以更清楚地查看模型和调节参数。</p>
          <div className="aspect-[16/10] overflow-hidden rounded-xl border border-[var(--border)] bg-[#090f1d] sm:aspect-auto sm:h-[80vh] sm:min-h-[380px]">
            <ScaledIframe key={labIdea.idea_id} html={content.rendered_sections[labIdea.idea_id].html!} title={labIdea.topic} allowDownloads />
          </div>
          <p className="mt-3 text-xs text-[var(--sub)]">试玩中的操作记录用于教学模型对照；正式实物交付仍按课程要求完成。</p>
        </> : <p>本节没有独立互动，课程内容中保留了学习资料和实践任务。</p>}
      </section>}
      {tab === "slides" && <div className="rounded-2xl border border-[var(--border)]" data-preview-slides><SlideDeckPlayer deck={{ slides, ideas: content.ideas, renderedSections: content.rendered_sections, knodeDir }} projectName={slug} moduleId={moduleId} currentIndex={slideIndex} onIndexChange={setSlideIndex} layout="content" autoPlay={false} previewImageSources={images} previewAudioSources={audio} /></div>}
      {tab === "assignment" && <section className="prose max-w-none space-y-5 text-[var(--ink)]" data-preview-assignment><h2 className="text-xl font-semibold">本节作业与交付要求</h2><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{assignment}</ReactMarkdown><a href="/project-lines/neuro-bionics/aloha/aloha-practice-kit.zip" className="inline-block rounded-lg bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary-ink)]">下载完整实践包</a></section>}
      <nav aria-label="顺序浏览课程" className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-5 text-sm">
        {index > 0 ? <Link href={href(modules[index - 1].id)}>← {modules[index - 1].id} 上一节</Link> : <span />}
        <span className="text-[var(--sub)]">{index + 1} / {modules.length}</span>
        {index + 1 < modules.length ? <Link href={href(modules[index + 1].id)}>{modules[index + 1].id} 下一节 →</Link> : <span>课程终点</span>}
      </nav>
    </div>
  </main>
}
