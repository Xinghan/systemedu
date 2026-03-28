"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import {
  X, CheckCircle2, Loader2, BookOpen, Zap, Gamepad2, BookMarked,
  Terminal, ChevronDown, ChevronRight, Circle, Play, Square,
  ClipboardList, CheckCircle, XCircle, Lightbulb,
} from "lucide-react"
import { gateway } from "@/lib/api"
import type {
  CourseContent,
  CourseContentData,
  CourseIdeaSummary,
  CourseSection,
  InlineExercise,
  KnodeInfo,
  RenderedSection,
} from "@/lib/types/api"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface CourseContentViewProps {
  projectName: string
  nodeId: number
  knode: KnodeInfo | null
  onClose: () => void
  onMarkComplete?: () => void
}

// ---------------------------------------------------------------------------
// Audio Context — ensures only one section plays at a time
// ---------------------------------------------------------------------------
interface AudioCtxValue {
  playing: string | null
  play: (sectionId: string, url: string) => void
  stop: () => void
}

const AudioPlayContext = createContext<AudioCtxValue>({
  playing: null,
  play: () => {},
  stop: () => {},
})

function AudioProvider({ children }: { children: React.ReactNode }) {
  const [playing, setPlaying] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
      audioRef.current = null
    }
    setPlaying(null)
  }

  const play = (sectionId: string, url: string) => {
    stop()
    const gatewayBase = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18820"
    const audio = new Audio(`${gatewayBase}/api/media/${url}`)
    audioRef.current = audio
    audio.play().catch((e) => console.error("[audio] play failed:", e))
    audio.onended = () => setPlaying(null)
    setPlaying(sectionId)
  }

  return (
    <AudioPlayContext.Provider value={{ playing, play, stop }}>
      {children}
    </AudioPlayContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// i18n hook (re-exported for use within this file)
// ---------------------------------------------------------------------------
import { useT } from "@/lib/hooks/use-t"

// ---------------------------------------------------------------------------
// SSE / pipeline types
// ---------------------------------------------------------------------------
interface AgentLogEntry {
  agent: string
  phase: "input" | "output"
  input: string
  output: string
  timestamp: string
}

type PipelineStage =
  | "connecting"
  | "planning"
  | "ideating"
  | "detailing"
  | "generating"
  | "assignment"
  | "audio"
  | "done"

const PIPELINE_STAGE_KEYS: PipelineStage[] = [
  "planning", "ideating", "detailing", "generating", "assignment", "audio",
]

const STAGE_ORDER: PipelineStage[] = [
  "connecting", "planning", "ideating", "detailing", "generating", "assignment", "audio", "done",
]

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------
function renderSimpleMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-3 text-on-surface tracking-tight">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2 text-on-surface">$1</h3>')
    .replace(/^\- (.+)$/gm, '<li class="ml-5 list-disc text-base text-on-surface leading-relaxed">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-5 list-decimal text-base text-on-surface leading-relaxed">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\n\n/g, '</p><p class="text-base text-on-surface leading-relaxed my-3">')
    .replace(/^([^<\n].+)$/gm, (match) => {
      if (match.startsWith("<") || match.startsWith("-") || /^\d+\./.test(match)) return match
      return `<p class="text-base text-on-surface leading-relaxed my-3">${match}</p>`
    })
}

// ---------------------------------------------------------------------------
// SectionAudioButton — circular hover button in right gutter
// ---------------------------------------------------------------------------
function SectionAudioButton({ sectionId, audioUrl }: { sectionId: string; audioUrl: string }) {
  const { playing, play, stop } = useContext(AudioPlayContext)
  const isPlaying = playing === sectionId

  if (!audioUrl) return null

  return (
    <button
      onClick={() => isPlaying ? stop() : play(sectionId, audioUrl)}
      title={isPlaying ? "停止播放" : "播放讲解音频"}
      className={[
        "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm border",
        isPlaying
          ? "bg-primary text-white border-primary/40 scale-110"
          : "bg-white border-outline-variant/20 text-primary hover:bg-primary-container/20",
      ].join(" ")}
    >
      {isPlaying ? (
        <div className="flex gap-0.5 items-end h-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-0.5 bg-white rounded-full animate-pulse"
              style={{ height: `${[10, 14, 8, 12][i]}px`, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      ) : (
        <Play className="h-4 w-4 fill-current ml-0.5" />
      )}
    </button>
  )
}

function backendBadgeLabel(backend?: string): string {
  if (backend === "manim") return "Manim"
  if (backend === "html_svg") return "SVG/HTML"
  return ""
}

// ---------------------------------------------------------------------------
// IdeaIframeBlock (animation / game)
// ---------------------------------------------------------------------------
function IdeaIframeBlock({
  idea, html, darkMode, backend,
}: {
  idea: CourseIdeaSummary
  html: string
  darkMode: boolean
  backend?: string
}) {
  const [resetKey, setResetKey] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const backendLabel = backendBadgeLabel(backend)

  if (darkMode) {
    // Animation block — inverse-surface deep dark style (#000341)
    return (
      <section
        className="rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{ background: "#000341" }}
      >
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between p-8 hover:bg-white/10 transition-colors"
          style={{ backdropFilter: "blur(20px)", background: "rgba(255,255,255,0.05)" }}
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
              <Zap className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-bold text-white text-xl leading-tight">动画演示</h3>
                {backendLabel && (
                  <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {backendLabel}
                  </span>
                )}
              </div>
              <p className="text-white/60 text-sm">{idea.topic}</p>
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-white/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        {expanded && (
          <div className="p-8 pt-4">
            <iframe
              key={resetKey}
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin"
              className="w-full rounded-xl block"
              style={{ height: 460, border: "none" }}
              title={`动画演示 - ${idea.topic}`}
            />
          </div>
        )}
        {!expanded && (
          <div className="px-8 py-4 text-white/30 text-sm">点击展开查看动画演示</div>
        )}
      </section>
    )
  }

  // Game block — surface-container-low light style
  return (
    <section className="rounded-2xl overflow-hidden shadow-lg bg-surface-container-low border border-outline-variant/10">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-8 bg-white/50 hover:bg-white transition-colors"
      >
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center border border-secondary/20 shrink-0">
            <Gamepad2 className="h-7 w-7 text-secondary" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-on-surface text-xl leading-tight mb-0.5">互动游戏</h3>
            <p className="text-on-surface-variant text-sm">{idea.topic}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {expanded && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); setResetKey((k) => k + 1) }}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors px-3 py-1.5 rounded-lg border border-outline-variant/30"
            >
              重置游戏
            </span>
          )}
          <ChevronDown
            className={`h-5 w-5 text-on-surface-variant/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {expanded && (
        <iframe
          key={resetKey}
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin"
          className="w-full block"
          style={{ height: 560, border: "none" }}
          title={`互动游戏 - ${idea.topic}`}
        />
      )}
      {!expanded && (
        <div className="px-8 py-4 text-on-surface-variant text-sm opacity-60">点击展开开始游戏</div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// StoryBlock
// ---------------------------------------------------------------------------
function StoryBlock({
  idea, section,
}: {
  idea: CourseIdeaSummary
  section: RenderedSection
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="rounded-2xl overflow-hidden shadow-lg bg-surface-container-low border border-outline-variant/10">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-8 bg-white/50 hover:bg-white transition-colors"
      >
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 rounded-xl bg-tertiary/10 flex items-center justify-center border border-tertiary/20 shrink-0">
            <BookMarked className="h-7 w-7 text-tertiary" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-on-surface text-xl leading-tight mb-0.5">故事引入</h3>
            <p className="text-on-surface-variant text-sm">{idea.topic}</p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-on-surface-variant/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && section.story_paragraphs && (
        <div className="divide-y divide-outline-variant/20">
          {section.story_paragraphs.map((para, idx) => (
            <div key={idx} className="flex gap-6 p-6">
              {para.image_url ? (
                <img
                  src={`${process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18820"}${para.image_url}`}
                  alt={`故事插图 ${idx + 1}`}
                  className="w-36 h-28 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-36 h-28 rounded-xl bg-surface-container shrink-0 flex items-center justify-center">
                  <BookMarked className="h-7 w-7 text-on-surface-variant/20" />
                </div>
              )}
              <p className="text-base text-on-surface leading-relaxed">{para.text}</p>
            </div>
          ))}
        </div>
      )}
      {!expanded && (
        <div className="px-8 py-4 text-on-surface-variant text-sm opacity-60">点击展开阅读故事</div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// ExerciseBlock — lightweight inline quiz (choice questions only, pop-up)
// ---------------------------------------------------------------------------
function ExerciseBlock({
  idea, exercises,
}: {
  idea: CourseIdeaSummary
  exercises: InlineExercise[]
}) {
  // Filter to choice questions only — inline exercises are lightweight
  const choiceExercises = exercises.filter((e) => e.type === "choice")
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)

  const total = choiceExercises.length
  const ex = choiceExercises[current]

  const handleOpen = () => {
    setOpen(true)
    setCurrent(0)
    setSelected(null)
    setAnswered(false)
    setScore(0)
    setFinished(false)
  }

  const handleChoice = (idx: number) => {
    if (answered) return
    setSelected(idx)
    setAnswered(true)
    if (idx === ex.correct) setScore((s) => s + 1)
  }

  const handleNext = () => {
    if (current + 1 >= total) {
      setFinished(true)
    } else {
      setCurrent((c) => c + 1)
      setSelected(null)
      setAnswered(false)
    }
  }

  if (total === 0) return null

  return (
    <>
      {/* Inline trigger — compact strip */}
      <div className="flex items-center gap-4 px-6 py-4 rounded-2xl border border-secondary/20 bg-secondary/5 hover:bg-secondary/10 transition-colors cursor-pointer" onClick={handleOpen}>
        <div className="w-9 h-9 rounded-xl bg-secondary/15 flex items-center justify-center shrink-0">
          <ClipboardList className="h-4.5 w-4.5 text-secondary" style={{ width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-on-surface">即时检测</span>
          <span className="ml-2 text-xs text-on-surface-variant">{idea.topic}</span>
        </div>
        <span className="text-xs font-medium text-secondary shrink-0">{total} 道选择题 &rarr;</span>
      </div>

      {/* Pop-up modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-secondary" />
                <span className="font-semibold text-sm text-on-surface">{idea.topic}</span>
              </div>
              {!finished && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-on-surface-variant">{current + 1} / {total}</span>
                  <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-surface-container transition-colors">
                    <X className="h-4 w-4 text-on-surface-variant" />
                  </button>
                </div>
              )}
              {finished && (
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-surface-container transition-colors">
                  <X className="h-4 w-4 text-on-surface-variant" />
                </button>
              )}
            </div>

            {/* Progress bar */}
            {!finished && (
              <div className="h-0.5 bg-outline-variant/20">
                <div
                  className="h-full bg-secondary transition-all duration-300"
                  style={{ width: `${(current / total) * 100}%` }}
                />
              </div>
            )}

            {/* Body */}
            <div className="px-6 py-5">
              {finished ? (
                <div className="text-center py-3 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-7 w-7 text-secondary" />
                  </div>
                  <p className="text-lg font-bold text-on-surface">
                    {score} / {total} 答对
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    {score === total ? "全部答对，掌握得很好！" : score >= total / 2 ? "做得不错，继续加油！" : "可以再回顾一下上方的内容哦"}
                  </p>
                  <button
                    onClick={() => setOpen(false)}
                    className="mt-1 px-7 h-10 rounded-xl bg-secondary text-on-secondary font-semibold text-sm hover:bg-secondary/90 transition-colors"
                  >
                    继续学习
                  </button>
                </div>
              ) : ex ? (
                <div className="space-y-4">
                  <p className="text-base font-semibold text-on-surface leading-relaxed">{ex.question}</p>
                  <div className="space-y-2">
                    {(ex.options ?? []).map((opt, i) => {
                      const isCorrect = i === ex.correct
                      const isSelected = selected === i
                      let cls = "bg-surface-container-low border-outline-variant/30 text-on-surface hover:border-secondary/40 hover:bg-secondary/5"
                      if (answered && isCorrect) cls = "bg-secondary/10 border-secondary text-secondary"
                      else if (answered && isSelected && !isCorrect) cls = "bg-error/10 border-error/60 text-error"
                      return (
                        <button
                          key={i}
                          onClick={() => handleChoice(i)}
                          disabled={answered}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all ${cls}`}
                        >
                          <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${answered && isCorrect ? "border-secondary bg-secondary text-on-secondary" : answered && isSelected ? "border-error bg-error/10 text-error" : "border-outline-variant/40"}`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="flex-1">{opt.replace(/^[A-D]\.\s*/, "")}</span>
                          {answered && isCorrect && <CheckCircle className="h-4 w-4 shrink-0 text-secondary" />}
                          {answered && isSelected && !isCorrect && <XCircle className="h-4 w-4 shrink-0 text-error" />}
                        </button>
                      )
                    })}
                  </div>
                  {answered && ex.explanation && (
                    <div className="flex gap-2 px-4 py-3 rounded-xl bg-secondary/5 border border-secondary/20 text-sm text-on-surface-variant">
                      <Lightbulb className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span>{ex.explanation}</span>
                    </div>
                  )}
                  {answered && (
                    <div className="flex justify-end">
                      <button
                        onClick={handleNext}
                        className="px-5 h-9 rounded-xl bg-secondary text-on-secondary text-sm font-semibold hover:bg-secondary/90 transition-colors"
                      >
                        {current + 1 < total ? "下一题" : "查看结果"}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// IdeaBlock (dispatcher)
// ---------------------------------------------------------------------------
function IdeaBlock({
  idea, section,
}: {
  idea: CourseIdeaSummary
  section: RenderedSection | null
}) {
  if (!section) {
    return (
      <div className="rounded-2xl border border-border/50 overflow-hidden animate-pulse">
        <div className="flex items-center gap-3 px-5 py-4 bg-secondary/30">
          <div className="h-5 w-5 rounded-full bg-muted-foreground/20" />
          <div className="h-3 w-32 rounded bg-muted-foreground/20" />
        </div>
        <div className="h-20 bg-secondary/20" />
      </div>
    )
  }

  if (section.status === "failed") {
    return (
      <div className="rounded-2xl border border-border/50 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 bg-secondary/30">
          <span className="text-sm text-muted-foreground">{idea.topic}</span>
        </div>
        <div className="h-14 flex items-center justify-center text-sm text-muted-foreground">
          内容生成失败
        </div>
      </div>
    )
  }

  if (idea.mode === "animation" && section.html) {
    return (
      <IdeaIframeBlock
        idea={idea}
        html={section.html}
        darkMode={true}
        backend={section.generation_backend || idea.generation_backend}
      />
    )
  }

  if (idea.mode === "game" && section.html) {
    return (
      <IdeaIframeBlock
        idea={idea}
        html={section.html}
        darkMode={false}
        backend={section.generation_backend || idea.generation_backend}
      />
    )
  }

  if (idea.mode === "story" && section.story_paragraphs) {
    return <StoryBlock idea={idea} section={section} />
  }

  if (idea.mode === "exercise" && section.exercises && section.exercises.length > 0) {
    return <ExerciseBlock idea={idea} exercises={section.exercises} />
  }

  return null
}

// ---------------------------------------------------------------------------
// SectionBlock: one section of plan_markdown + right-gutter audio button
// ---------------------------------------------------------------------------
function SectionBlock({
  section, ideaMap, renderedSections,
}: {
  section: CourseSection
  ideaMap: Map<string, CourseIdeaSummary>
  renderedSections: Record<string, RenderedSection>
}) {
  const parts = section.body_markdown.split(/(\[\[IDEA:[^\]]+\]\])/g)

  // Separate text parts from idea placeholders
  const textParts = parts.filter((p) => !p.match(/^\[\[IDEA:[^\]]+\]\]$/))
  const hasText = textParts.some((p) => p.replace(/^##\s+.+\n?/, "").trim())

  return (
    <div className="space-y-6">
      {/* Text content with right-gutter audio button */}
      {hasText && (
        <div className="group relative flex gap-8 items-start">
          <div className="flex-1 space-y-4 min-w-0">
            {section.heading && (
              <h2 className="text-2xl font-bold text-on-surface tracking-tight">{section.heading}</h2>
            )}
            {parts.map((part, idx) => {
              if (part.match(/^\[\[IDEA:[^\]]+\]\]$/)) return null
              const stripped = part.replace(/^##\s+.+\n?/, "")
              if (!stripped.trim()) return null
              return (
                <div
                  key={idx}
                  dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(stripped) }}
                />
              )
            })}
          </div>
          {/* Right gutter — visible on hover */}
          <div className="w-16 flex flex-col gap-3 opacity-40 group-hover:opacity-100 transition-opacity duration-300 sticky top-24 shrink-0 pt-1">
            <SectionAudioButton
              sectionId={section.section_id}
              audioUrl={section.audio_url}
            />
          </div>
        </div>
      )}

      {/* Idea blocks (animation / game / story) */}
      {parts.map((part, idx) => {
        const match = part.match(/^\[\[IDEA:([^\]]+)\]\]$/)
        if (!match) return null
        const ideaId = match[1]
        const idea = ideaMap.get(ideaId)
        if (!idea) return null
        const rendered = renderedSections[ideaId] ?? null
        return <IdeaBlock key={idx} idea={idea} section={rendered} />
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PlanWithSections: new layout using CourseSection[]
// ---------------------------------------------------------------------------
function PlanWithSections({ content }: { content: CourseContent }) {
  const ideaMap = new Map(content.ideas.map((i) => [i.idea_id, i]))

  return (
    <div className="space-y-16">
      {content.sections!.map((section) => (
        <SectionBlock
          key={section.section_id}
          section={section}
          ideaMap={ideaMap}
          renderedSections={content.rendered_sections}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PlanWithIdeas: fallback for old data (no sections)
// ---------------------------------------------------------------------------
function PlanWithIdeas({ content }: { content: CourseContent }) {
  const parts = content.plan_markdown.split(/(\[\[IDEA:[^\]]+\]\])/g)
  const ideaMap = new Map(content.ideas.map((i) => [i.idea_id, i]))

  return (
    <div className="space-y-10">
      {/* Upgrade notice */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-outline-variant/20 bg-surface-container-low text-on-surface-variant text-xs">
        <Play className="h-3 w-3" />
        点击「重新生成」以获得分段音频讲解
      </div>
      {parts.map((part, idx) => {
        const match = part.match(/^\[\[IDEA:([^\]]+)\]\]$/)
        if (match) {
          const ideaId = match[1]
          const idea = ideaMap.get(ideaId)
          if (!idea) return null
          const section = content.rendered_sections[ideaId] ?? null
          return <IdeaBlock key={idx} idea={idea} section={section} />
        }
        if (!part.trim()) return null
        return (
          <div
            key={idx}
            dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(part) }}
          />
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EditorialHeader
// ---------------------------------------------------------------------------
function EditorialHeader({ knode }: { knode: KnodeInfo | null }) {
  if (!knode) return null
  return (
    <header className="space-y-6">
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container rounded-full text-on-secondary-container text-xs font-bold tracking-widest uppercase">
        难度 {knode.difficulty_level} / 5 · {knode.estimated_minutes} 分钟
      </div>
      <h1 className="font-extrabold text-3xl text-on-surface tracking-tight leading-[1.2]">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-tertiary">
          {knode.title}
        </span>
      </h1>
      {knode.summary && (
        <p className="text-base text-on-surface-variant leading-relaxed max-w-2xl">
          {knode.summary}
        </p>
      )}
    </header>
  )
}

// ---------------------------------------------------------------------------
// GeneratingProgress — Lumina Nexus design
// ---------------------------------------------------------------------------

function GeneratingProgress({
  stage, ideaProgress, agentLogs, onStop,
}: {
  stage: PipelineStage
  ideaProgress: { done: number; total: number }
  agentLogs: AgentLogEntry[]
  onStop?: () => void
}) {
  const t = useT()
  const currentIdx = STAGE_ORDER.indexOf(stage)

  const PIPELINE_STAGES = PIPELINE_STAGE_KEYS.map((key) => ({
    key,
    label: t(`gen.stage_${key}_name`),
  }))

  const STAGE_SUBTITLES: Partial<Record<PipelineStage, string>> = {
    planning:   t("gen.stage_planning_active"),
    ideating:   t("gen.stage_ideating_active"),
    detailing:  t("gen.stage_detailing_active"),
    generating: t("gen.stage_generating_active"),
    assignment: t("gen.stage_assignment_active"),
    audio:      t("gen.stage_audio_active"),
  }
  const STAGE_COMPLETED_LABELS: Partial<Record<PipelineStage, string>> = {
    planning:   t("gen.stage_planning_done"),
    ideating:   t("gen.stage_ideating_done"),
    detailing:  t("gen.stage_detailing_done"),
    generating: t("gen.stage_generating_done"),
    assignment: t("gen.stage_assignment_done"),
    audio:      t("gen.stage_audio_done"),
  }
  const doneCount = PIPELINE_STAGES.filter((s) => STAGE_ORDER.indexOf(s.key) < currentIdx).length
  const progressPct = PIPELINE_STAGES.length > 0
    ? Math.round((doneCount / PIPELINE_STAGES.length) * 100)
    : 0

  const M = {
    bg: "#f8f7ff",
    surface: "#ffffff",
    primary: "#6a1cf6",
    teal: "#00c9a7",
    onBg: "#19227d",
    muted: "#9ea6ff",
    mutedFg: "#4953ac",
    border: "rgba(158,166,255,0.18)",
  }

  return (
    <div style={{ fontFamily: "var(--font-manrope, 'Inter', sans-serif)" }} className="px-8 py-6">

      {/* ── Version badge ── */}
      <div className="flex items-center gap-2 mb-5">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.25em] px-2.5 py-1 rounded-full"
          style={{ background: "rgba(106,28,246,0.08)", color: M.mutedFg }}
        >
          SYSTEMEDU AI {/* brand name — intentionally not translated */}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#00c9a7] animate-pulse" />
      </div>

      {/* ── Hero header: title + progress number ── */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex-1 min-w-0">
          <h2
            className="font-extrabold leading-tight tracking-tight"
            style={{ fontSize: "clamp(1.4rem, 3.5vw, 2.2rem)", color: M.onBg }}
          >
            {t("gen.title_line1")}
          </h2>
          <h2
            className="font-extrabold leading-tight tracking-tight italic"
            style={{
              fontSize: "clamp(1.4rem, 3.5vw, 2.2rem)",
              background: "linear-gradient(90deg, #6a1cf6 0%, #4f8ef7 60%, #00c9a7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              paddingBottom: "0.1em",
              display: "block",
              overflow: "visible",
            }}
          >
            {t("gen.title_line2")}
          </h2>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: M.muted }}
          >
            {t("gen.system_progress")}
          </p>
          <p
            className="font-extrabold leading-none"
            style={{ fontSize: "clamp(2rem, 5vw, 3rem)", color: M.onBg }}
          >
            {progressPct}
            <span className="text-xl font-bold" style={{ color: M.mutedFg }}>%</span>
          </p>
          {onStop && (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-semibold transition-colors"
              style={{
                borderColor: "rgba(239,68,68,0.3)",
                color: "#ef4444",
                background: "rgba(239,68,68,0.06)",
              }}
            >
              <Square className="h-3 w-3 fill-current" />
              停止
            </button>
          )}
        </div>
      </div>

      {/* ── Agent steps ── */}
      <div className="space-y-3">
        {PIPELINE_STAGES.map((s) => {
          const stageIdx = STAGE_ORDER.indexOf(s.key)
          const isDone = currentIdx > stageIdx
          const isActive = currentIdx === stageIdx
          const showProgress = isActive && s.key === "generating" && ideaProgress.total > 0
          const pct = showProgress ? Math.round((ideaProgress.done / ideaProgress.total) * 100) : 0

          if (isActive) {
            return (
              <div
                key={s.key}
                className="relative overflow-hidden rounded-2xl"
                style={{
                  background: M.surface,
                  border: `1px solid ${M.border}`,
                  boxShadow: "0 8px 32px -8px rgba(106,28,246,0.10)",
                }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 w-1 h-full rounded-l-2xl"
                  style={{ background: "linear-gradient(to bottom, #6a1cf6, #4f8ef7)" }}
                />
                <div className="flex items-center gap-4 px-6 py-5 ml-1">
                  {/* Dual-ring spinner */}
                  <div className="relative shrink-0 w-11 h-11">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ border: "2px solid rgba(106,28,246,0.10)" }}
                    />
                    <div
                      className="absolute inset-[3px] rounded-full animate-spin"
                      style={{
                        border: "2px solid transparent",
                        borderTopColor: M.primary,
                        borderRightColor: M.primary,
                      }}
                    />
                    <div
                      className="absolute inset-0 rounded-full animate-pulse"
                      style={{ background: "rgba(106,28,246,0.06)" }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold" style={{ color: M.onBg }}>{s.label}</span>
                      {s.key === "generating" && (
                        <span
                          className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(106,28,246,0.08)", color: M.primary }}
                        >
                          {t("gen.high_compute")}
                        </span>
                      )}
                    </div>
                    {showProgress ? (
                      <div>
                        <p className="text-xs mb-1.5" style={{ color: M.mutedFg }}>
                          {STAGE_SUBTITLES[s.key]} {ideaProgress.done} {t("gen.of")} {ideaProgress.total}
                        </p>
                        <div
                          className="h-1 rounded-full overflow-hidden"
                          style={{ background: "rgba(106,28,246,0.10)", width: 160 }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: "linear-gradient(90deg, #6a1cf6, #4f8ef7)",
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: M.mutedFg }}>{STAGE_SUBTITLES[s.key]}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest animate-pulse"
                      style={{ color: M.primary }}
                    >
                      {t("gen.processing")}
                    </p>
                    {showProgress && (
                      <p className="text-[10px] mt-0.5" style={{ color: M.muted }}>
                        ~ {Math.max(0, ideaProgress.total - ideaProgress.done) * 25}s {t("gen.remaining")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          }

          if (isDone) {
            return (
              <div
                key={s.key}
                className="flex items-center justify-between px-5 py-4 rounded-2xl"
                style={{ background: "rgba(0,201,167,0.04)", border: `1px solid transparent` }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(0,201,167,0.12)" }}
                  >
                    <CheckCircle2 className="h-4 w-4" style={{ color: M.teal }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: M.onBg }}>{s.label}</p>
                    <p className="text-xs" style={{ color: M.mutedFg }}>{STAGE_COMPLETED_LABELS[s.key]}</p>
                  </div>
                </div>
                <span
                  className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0"
                  style={{ color: M.teal, background: "rgba(0,201,167,0.10)" }}
                >
                  {t("gen.completed")}
                </span>
              </div>
            )
          }

          // Pending
          return (
            <div
              key={s.key}
              className="flex items-center justify-between px-5 py-4 rounded-2xl opacity-50"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(158,166,255,0.10)" }}
                >
                  <Circle className="h-3 w-3" style={{ color: M.muted }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: M.mutedFg }}>{s.label}</p>
                  <p className="text-xs" style={{ color: M.muted }}>{STAGE_SUBTITLES[s.key]}</p>
                </div>
              </div>
              <span
                className="text-[9px] font-bold uppercase tracking-widest shrink-0"
                style={{ color: M.muted }}
              >
                {t("gen.queued")}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── System core footer bar ── */}
      <div
        className="flex items-center justify-between mt-6 px-5 py-4 rounded-2xl"
        style={{ background: M.surface, border: `1px solid ${M.border}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #6a1cf6 0%, #4f8ef7 100%)" }}
          >
            <span className="text-white text-xs font-bold">AI</span>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-[#00c9a7]"
            />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: M.muted }}>{t("gen.system_core")}</p>
            <p className="text-sm font-semibold" style={{ color: M.onBg }}>{t("gen.syncing")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agentLogs.length > 0 && (
            <span className="text-xs font-semibold" style={{ color: M.mutedFg }}>
              {agentLogs.length} {t("gen.logs")}
            </span>
          )}
        </div>
      </div>

      {/* ── Feature cards row ── */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        {[
          {
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ),
            label: t("gen.feat_adaptive_label"),
            desc: t("gen.feat_adaptive_desc"),
          },
          {
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
              </svg>
            ),
            label: t("gen.feat_render_label"),
            desc: t("gen.feat_render_desc"),
          },
          {
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-.1-9.999 5.002 5.002 0 0 0-9.78 2.096A4.001 4.001 0 0 0 3 15z" />
              </svg>
            ),
            label: t("gen.feat_sync_label"),
            desc: t("gen.feat_sync_desc"),
          },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-start gap-2 pt-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(158,166,255,0.12)", color: M.mutedFg }}
            >
              {item.icon}
            </div>
            <p className="text-sm font-bold" style={{ color: M.onBg }}>{item.label}</p>
            <p className="text-xs leading-relaxed" style={{ color: M.mutedFg }}>{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Agent logs — collapsed by default */}
      {agentLogs.length > 0 && (
        <div className="rounded-xl border overflow-hidden mt-5" style={{ borderColor: M.border }}>
          <div
            className="px-4 py-3 flex items-center gap-2 border-b"
            style={{ background: "rgba(158,166,255,0.06)", borderColor: M.border }}
          >
            <Terminal className="h-3.5 w-3.5" style={{ color: M.mutedFg }} />
            <span className="text-xs font-semibold" style={{ color: M.mutedFg }}>{t("gen.agent_logs")}</span>
            <span className="text-[10px] ml-1" style={{ color: M.muted }}>({agentLogs.length})</span>
          </div>
          <div className="max-h-[200px] overflow-y-auto divide-y" style={{ borderColor: M.border }}>
            {agentLogs.map((log, idx) => (
              <AgentLogRow key={idx} log={log} defaultExpanded={idx === agentLogs.length - 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AgentLogRow
// ---------------------------------------------------------------------------
function AgentLogRow({ log, defaultExpanded = false }: { log: AgentLogEntry; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const isOutput = log.phase === "output"

  return (
    <div className={`border-b border-border/20 last:border-0 ${isOutput ? "bg-secondary/10" : ""}`}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-secondary/20 transition-colors"
      >
        <div className="shrink-0 mt-0.5">
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold font-mono ${isOutput ? "text-cyan-500" : "text-blue-500"}`}>
              {isOutput ? "OUT" : "IN"}
            </span>
            <span className="text-xs font-semibold text-foreground">{log.agent}</span>
            <span className="text-[10px] text-muted-foreground">{log.timestamp}</span>
          </div>
          {!expanded && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-mono">
              {isOutput ? log.output : log.input}
            </p>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <div className="text-[10px] font-bold text-blue-500 mb-1">INPUT</div>
            <pre className="text-[10px] text-muted-foreground bg-secondary/30 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
              {log.input}
            </pre>
          </div>
          {log.output !== "(pending...)" && (
            <div>
              <div className="text-[10px] font-bold text-cyan-500 mb-1">OUTPUT</div>
              <pre className="text-[10px] text-foreground bg-secondary/30 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
                {log.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AgentDebugPanel
// ---------------------------------------------------------------------------
function AgentDebugPanel({ logs }: { logs: AgentLogEntry[] }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="mt-8 rounded-xl border border-border/40 overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors border-b border-border/30"
      >
        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">Agent Debug Log</span>
        <span className="text-[10px] text-muted-foreground/60 ml-1">({logs.length} 条)</span>
        <div className="flex-1" />
        {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {!collapsed && (
        <div className="divide-y divide-border/20 max-h-[500px] overflow-y-auto">
          {logs.map((log, idx) => <AgentLogRow key={idx} log={log} />)}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main: CourseContentView
// ---------------------------------------------------------------------------
export function CourseContentView({
  projectName,
  nodeId,
  knode,
  onClose,
  onMarkComplete,
}: CourseContentViewProps) {
  const [courseData, setCourseData] = useState<CourseContentData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [stopped, setStopped] = useState(false)   // user explicitly stopped, backend task cancelled
  const [stage, setStage] = useState<PipelineStage>("connecting")
  const [ideaProgress, setIdeaProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)
  const loadIdRef = useRef(0)

  const content = courseData?.course_content as CourseContent | undefined

  const handleStop = async () => {
    abortRef.current = true          // stop SSE reader loop
    setStopped(true)
    setGenerating(false)
    try {
      await gateway.cancelCourseV2(projectName, nodeId)
    } catch { /* ignore */ }
  }

  const handleResume = () => {
    setStopped(false)
    load(false)   // reconnect SSE — backend will restart generation
  }

  const load = async (regenerate = false) => {
    // Abort any in-flight load before starting a new one
    abortRef.current = true
    const myLoadId = ++loadIdRef.current
    abortRef.current = false
    setStopped(false)
    setError(null)
    setGenerating(true)
    setStage("connecting")
    setIdeaProgress({ done: 0, total: 0 })
    setCourseData(null)
    setAgentLogs([])

    try {
      const res = await gateway.streamCourseV2(projectName, nodeId, regenerate)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
      }
      if (!res.body) throw new Error("no response body")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let buffer_event = ""

      const handleLine = (line: string) => {
        if (!line.startsWith("data: ")) return
        const dataStr = line.slice(6)
        let data: Record<string, unknown> = {}
        try { data = JSON.parse(dataStr) } catch { return }

        const evt = buffer_event || "message"
        buffer_event = ""

        if (evt === "plan_ready") {
          setStage("ideating")
        } else if (evt === "ideas_identified") {
          setStage("detailing")
          setIdeaProgress({ done: 0, total: (data.count as number) || 0 })
        } else if (evt === "details_ready") {
          setStage("generating")
          setIdeaProgress({ done: 0, total: (data.count as number) || 0 })
        } else if (evt === "idea_complete") {
          setStage("generating")
          setIdeaProgress((prev) => ({ ...prev, done: Math.min(prev.done + 1, prev.total) }))
        } else if (evt === "assignment_start") {
          setStage("assignment")
        } else if (evt === "audio_ready") {
          setStage("audio")
        } else if (evt === "agent_log") {
          const now = new Date().toLocaleTimeString("zh-CN", { hour12: false })
          setAgentLogs((prev) => [
            ...prev,
            {
              agent: data.agent as string,
              phase: data.phase as "input" | "output",
              input: data.input as string,
              output: data.output as string,
              timestamp: now,
            },
          ])
        } else if (evt === "done") {
          setStage("done")
        } else if (evt === "error") {
          throw new Error((data.message as string) || "生成失败")
        }
      }

      const processChunk = (text: string) => {
        buffer += text
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith("event: ")) {
            buffer_event = trimmed.slice(7).trim()
          } else if (trimmed.startsWith("data: ")) {
            handleLine(trimmed)
          }
        }
      }

      setStage("planning")

      while (true) {
        const { done, value } = await reader.read()
        if (abortRef.current || loadIdRef.current !== myLoadId) { reader.cancel(); return }
        if (done) break
        processChunk(decoder.decode(value, { stream: true }))
      }

      if (!abortRef.current && loadIdRef.current === myLoadId) {
        const data = await gateway.getCourseV2(projectName, nodeId)
        setCourseData(data)
      }
    } catch (e) {
      if (!abortRef.current && loadIdRef.current === myLoadId) {
        setError(e instanceof Error ? e.message : "生成失败")
      }
    } finally {
      if (!abortRef.current && loadIdRef.current === myLoadId) setGenerating(false)
    }
  }

  useEffect(() => {
    setError(null)
    gateway.getCourseV2(projectName, nodeId).then((data) => {
      if (data.status === "ready" && data.course_content && Object.keys(data.course_content).length > 0) {
        setCourseData(data)
        setGenerating(false)
      } else {
        load(false)
      }
    }).catch(() => {
      load(false)
    })

    return () => { abortRef.current = true }
  }, [projectName, nodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header knode={knode} onClose={onClose} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <p className="text-sm">{error}</p>
          <button onClick={() => load(true)} className="text-xs text-primary hover:underline">重试</button>
        </div>
      </div>
    )
  }

  return (
    <AudioProvider>
      <div className="flex flex-col h-full">
        <Header knode={knode} onClose={onClose} />

        <div className="flex-1 min-h-0 overflow-y-auto">
          {generating && (
            <div className="px-6 py-5">
              <GeneratingProgress
                stage={stage}
                ideaProgress={ideaProgress}
                agentLogs={agentLogs}
                onStop={handleStop}
              />
            </div>
          )}

          {stopped && !generating && (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Square className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">生成已停止</p>
                <p className="text-xs text-muted-foreground mt-1">后台任务已取消，点击恢复重新生成</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleResume}
                  className="flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Play className="h-4 w-4 fill-current" />
                  恢复生成
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-5 h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          )}

          {!generating && content && (
            <div className="max-w-4xl mx-auto px-8 py-12 space-y-16">
              <EditorialHeader knode={knode} />

              {/* Content sections */}
              {content.sections && content.sections.length > 0 ? (
                <PlanWithSections content={content} />
              ) : (
                <PlanWithIdeas content={content} />
              )}

              {agentLogs.length > 0 && <AgentDebugPanel logs={agentLogs} />}
            </div>
          )}
        </div>

        {!generating && content && (
          <div className="px-6 py-4 border-t border-border/50 shrink-0 flex items-center justify-end gap-3">
            <p className="text-xs text-muted-foreground mr-auto">
              学完后，点击右侧面板的「标记完成」继续下一节
            </p>
            <button
              onClick={() => load(true)}
              className="flex items-center gap-1.5 px-4 h-9 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              重新生成
            </button>
          </div>
        )}
      </div>
    </AudioProvider>
  )
}

function Header({ knode, onClose }: { knode: KnodeInfo | null; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <h2 className="text-sm font-semibold text-foreground truncate">{knode?.title}</h2>
      </div>
      <button onClick={onClose} className="ml-3 p-1 rounded-lg hover:bg-secondary transition-colors shrink-0">
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  )
}
