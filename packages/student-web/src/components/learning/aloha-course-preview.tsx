"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { CourseContent, KnodeInfo, KnowledgeLevel, SlideEntry } from "@/lib/types/api"
import { roboticsContext } from "@/lib/project-lines/robotics-mission"
import { RoboticsLessonBrief, RoboticsLessonFooter } from "@/components/mission/robotics-mission-lesson"
import { CourseContentView } from "./course-content-view"
import { CourseMediaContext } from "./course-media-context"

const slug = "aloha-bimanual-apprentice"

/** Local source review uses the same reader, slideshow and inline media as enrollment. */
export function AlohaCoursePreview({ moduleId, modules, stages, knodeDir, content, slides, images, audio, assignment, initialTab = "reading", initialLabMode = "game" }: {
  moduleId: string; modules: { id: string; title: string; stage: string }[]; stages: { id: string; title: string }[]
  knodeDir: string; content: CourseContent; slides: SlideEntry[]; images: Record<string, string>; audio: Record<string, string>; assignment: string
  initialTab?: "reading" | "lab"
  initialLabMode?: "game" | "animation"
}) {
  const router = useRouter(), search = useSearchParams()
  const context = roboticsContext(slug, moduleId, search.get("mission") === "robotics")
  const [level, setLevel] = useState<KnowledgeLevel>("K1")
  const index = modules.findIndex(module => module.id === moduleId), current = modules[index]
  const href = (id: string) => `/preview/aloha/${id}${context ? "?mission=robotics" : ""}`
  const view = search.get("view") || initialTab, mode = search.get("mode") || initialLabMode
  const idea = view === "lab" ? content.ideas.find(item => item.mode === mode && content.rendered_sections[item.idea_id]?.html) : undefined
  const target = idea ? `idea-${idea.idea_id}` : view === "assignment" ? "course-assignment" : view === "slides" ? "lesson-player" : null
  useEffect(() => { if (target) document.getElementById(target)?.scrollIntoView({ block: "center" }) }, [target])
  const data = useMemo(() => ({ status: "ready" as const, course_content: content, knode_dir: knodeDir,
    slides: slides.map(slide => ({ ...slide, payload: { ...slide.payload, images: slide.payload.images?.map(image => ({ ...image, src: images[image.src] || image.src })) } })),
  }), [content, knodeDir, slides, images])
  const knode: KnodeInfo = { id: 0, module_id: moduleId, title: current.title, summary: "本地原课程教材预览", difficulty_level: 0, content_type: "lesson", acceptance_type: "artifact", estimated_minutes: 0, xp_reward: 0, prerequisite_indices: [] }
  const assignmentContent = <section id="course-assignment" className="space-y-5 p-5" data-preview-assignment>
    <h2 className="text-xl font-semibold">本节作业与交付要求</h2>
    <div className="prose max-w-none text-[var(--ink)]"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{assignment}</ReactMarkdown></div>
    <p className="text-sm text-[var(--sub)]">这里用于本地教材验收。正式作业、实验产物与历史记录仍在原课堂中提交和恢复。</p>
    <Link className="inline-block rounded-lg bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary-ink)]" href={`/learn/${slug}/${moduleId}${context ? "?mission=robotics" : ""}`}>进入原课堂与学习记录 →</Link>
    <a href="/project-lines/neuro-bionics/aloha/aloha-practice-kit.zip" className="ml-4 text-sm underline">下载完整实践包</a>
  </section>
  return <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]" data-aloha-preview={moduleId}>
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-8">
      {context && <RoboticsLessonBrief context={context}/>}
      <header className="space-y-4 border-b border-[var(--border)] pb-5">
        <div className="flex flex-wrap justify-between gap-3 text-sm"><Link href={`/library/${slug}`} className="text-[var(--sub)] hover:underline">← 返回项目介绍</Link><span>本地教材预览 · 保留全部 {modules.length} 节</span></div>
        <h1 className="text-2xl font-semibold">{moduleId} · {current.title}</h1>
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-0 flex-1 space-y-1 text-sm">切换课程节点<select aria-label="切换课程节点" value={moduleId} onChange={event => router.push(href(event.target.value))} className="block w-full rounded-lg border border-[var(--border-2)] bg-[var(--card)] p-3">{stages.map(stage => <optgroup key={stage.id} label={`${stage.id} · ${stage.title}`}>{modules.filter(module => module.stage === stage.id).map(module => <option key={module.id} value={module.id}>{module.id} · {module.title}</option>)}</optgroup>)}</select></label>
          <label className="space-y-1 text-sm">理论深度<select aria-label="理论深度" value={level} onChange={event => setLevel(event.target.value as KnowledgeLevel)} className="block rounded-lg border border-[var(--border-2)] bg-[var(--card)] p-3"><option value="K1">K1 · 直观理解</option><option value="K3">K3 · 推导与计算</option><option value="K5">K5 · 深入研究</option></select></label>
        </div>
      </header>
      <div data-unified-course><CourseMediaContext.Provider value={{ initialIdeaId: idea?.idea_id }}>
        <CourseContentView projectName={slug} nodeId={0} knode={knode} knowledgeLevel={level} onClose={() => router.push(`/library/${slug}`)} preparedLesson={{ data, previewAudioSources: audio, assignment: assignmentContent }}/>
      </CourseMediaContext.Provider></div>
      <nav aria-label="原课程顺序浏览" className="flex justify-between gap-4 border-t border-[var(--border)] py-6 text-sm">{index > 0 ? <Link href={href(modules[index - 1].id)}>← 原课 {modules[index - 1].id}</Link> : <span/>}<span>{index + 1} / {modules.length}</span>{index + 1 < modules.length ? <Link href={href(modules[index + 1].id)}>原课 {modules[index + 1].id} →</Link> : <span>原课程终点</span>}</nav>
      {context && <RoboticsLessonFooter context={context}/>}
    </div>
  </main>
}
