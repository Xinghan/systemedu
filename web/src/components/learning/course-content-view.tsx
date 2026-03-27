"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import {
  X, CheckCircle2, Loader2, BookOpen, Zap, Gamepad2, BookMarked,
  Terminal, ChevronDown, ChevronRight, Circle, Play, Square,
} from "lucide-react"
import { gateway } from "@/lib/api"
import type {
  CourseContent,
  CourseContentData,
  CourseIdeaSummary,
  CourseSection,
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
  | "audio"
  | "done"

const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "planning", label: "CoursePlannerAgent" },
  { key: "ideating", label: "CourseIdeaAgent" },
  { key: "detailing", label: "CourseIdeaDetailAgent" },
  { key: "generating", label: "AnimationGen / GameGen / StoryGen" },
  { key: "audio", label: "TTS 音频生成" },
]

const STAGE_ORDER: PipelineStage[] = [
  "connecting", "planning", "ideating", "detailing", "generating", "audio", "done",
]

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------
function renderSimpleMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-3 text-on-surface">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2 text-on-surface">$1</h3>')
    .replace(/^\- (.+)$/gm, '<li class="ml-5 list-disc text-base text-on-surface leading-relaxed">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-5 list-decimal text-base text-on-surface leading-relaxed">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\n\n/g, '</p><p class="text-base text-on-surface leading-loose my-3">')
    .replace(/^([^<\n].+)$/gm, (match) => {
      if (match.startsWith("<") || match.startsWith("-") || /^\d+\./.test(match)) return match
      return `<p class="text-base text-on-surface leading-loose my-3">${match}</p>`
    })
}

// ---------------------------------------------------------------------------
// SectionAudioBar — inline audio player shown at top of each section
// ---------------------------------------------------------------------------
function SectionAudioBar({ sectionId, audioUrl }: { sectionId: string; audioUrl: string }) {
  const { playing, play, stop } = useContext(AudioPlayContext)
  const isPlaying = playing === sectionId

  // No audio generated — show disabled placeholder
  if (!audioUrl) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border/20 bg-secondary/20 opacity-40 cursor-not-allowed select-none">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-card border border-border/30 text-muted-foreground">
          <Play className="h-3.5 w-3.5 ml-0.5" />
        </div>
        <span className="text-xs text-muted-foreground">讲解音频未生成</span>
      </div>
    )
  }

  return (
    <div
      className={[
        "flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer select-none",
        isPlaying
          ? "bg-primary/10 border-primary/30"
          : "bg-secondary/40 border-border/30 hover:bg-secondary/70 hover:border-border/50",
      ].join(" ")}
      onClick={() => isPlaying ? stop() : play(sectionId, audioUrl)}
    >
      <div className={[
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
        isPlaying ? "bg-primary text-primary-foreground" : "bg-card border border-border/40 text-primary",
      ].join(" ")}>
        {isPlaying
          ? <Square className="h-3.5 w-3.5 fill-current" />
          : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
        }
      </div>
      <div className="flex-1 min-w-0">
        {isPlaying ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-primary">正在播放讲解</span>
            <div className="flex gap-0.5 items-end h-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-0.5 bg-primary rounded-full animate-pulse"
                  style={{ height: `${[8, 12, 6, 10][i]}px`, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">点击播放本节讲解音频</span>
        )}
      </div>
    </div>
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
    // Animation block — deep dark style matching code.html inverse-surface
    return (
      <section className="rounded-2xl overflow-hidden shadow-2xl bg-slate-950 border border-white/10">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between p-6 bg-white/5 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-lg leading-tight">动画演示</h3>
                {backendLabel && (
                  <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {backendLabel}
                  </span>
                )}
              </div>
              <p className="text-white/60 text-sm mt-0.5">{idea.topic}</p>
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-white/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        {expanded && (
          <div className="p-6 pt-2">
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
          <div className="px-6 py-3 text-white/40 text-sm">点击展开查看动画演示</div>
        )}
      </section>
    )
  }

  // Game block — light surface style
  return (
    <section className="rounded-2xl overflow-hidden shadow-lg bg-secondary/20 border border-border/20">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-6 bg-card hover:bg-card/80 transition-colors"
      >
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <Gamepad2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
            <div className="text-left">
              <h3 className="font-bold text-foreground text-lg leading-tight">互动游戏</h3>
              <p className="text-muted-foreground text-sm mt-0.5">{idea.topic}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {expanded && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); setResetKey((k) => k + 1) }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border/40"
            >
              重置游戏
            </span>
          )}
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
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
        <div className="px-6 py-3 text-muted-foreground text-sm opacity-60">点击展开开始游戏</div>
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
    <section className="rounded-2xl overflow-hidden shadow-lg bg-secondary/20 border border-border/20">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-6 bg-card hover:bg-card/80 transition-colors"
      >
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
            <BookMarked className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-foreground text-lg leading-tight">故事引入</h3>
            <p className="text-muted-foreground text-sm mt-0.5">{idea.topic}</p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && section.story_paragraphs && (
        <div className="divide-y divide-border/30">
          {section.story_paragraphs.map((para, idx) => (
            <div key={idx} className="flex gap-4 p-5">
              {para.image_url ? (
                <img
                  src={`${process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18820"}${para.image_url}`}
                  alt={`故事插图 ${idx + 1}`}
                  className="w-32 h-24 rounded-xl object-cover shrink-0 bg-secondary"
                />
              ) : (
                <div className="w-32 h-24 rounded-xl bg-secondary/30 shrink-0 flex items-center justify-center">
                  <BookMarked className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
              <p className="text-base text-foreground leading-relaxed">{para.text}</p>
            </div>
          ))}
        </div>
      )}
      {!expanded && (
        <div className="px-6 py-3 text-muted-foreground text-sm opacity-60">点击展开阅读故事</div>
      )}
    </section>
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

  return null
}

// ---------------------------------------------------------------------------
// SectionBlock: one section of plan_markdown + inline audio bar
// ---------------------------------------------------------------------------
function SectionBlock({
  section, ideaMap, renderedSections,
}: {
  section: CourseSection
  ideaMap: Map<string, CourseIdeaSummary>
  renderedSections: Record<string, RenderedSection>
}) {
  // Split body_markdown by [[IDEA:xxx]] placeholders
  const parts = section.body_markdown.split(/(\[\[IDEA:[^\]]+\]\])/g)

  return (
    <div className="space-y-4">
      {/* Section heading (if any) extracted from body_markdown heading */}
      {section.heading && (
        <h2 className="text-2xl font-bold text-foreground">{section.heading}</h2>
      )}

      {/* Inline audio bar — always visible when audio_url present */}
      <SectionAudioBar
        sectionId={section.section_id}
        audioUrl={section.audio_url}
      />

      {/* Content: text + idea blocks */}
      <div className="space-y-4">
        {parts.map((part, idx) => {
          const match = part.match(/^\[\[IDEA:([^\]]+)\]\]$/)
          if (match) {
            const ideaId = match[1]
            const idea = ideaMap.get(ideaId)
            if (!idea) return null
            const rendered = renderedSections[ideaId] ?? null
            return <IdeaBlock key={idx} idea={idea} section={rendered} />
          }
          if (!part.trim()) return null
          // Strip leading ## heading from body_markdown since we render it above
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
    <div>
      {/* Upgrade notice for old content without audio sections */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border/20 bg-secondary/20 mb-8">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-card border border-border/30 text-muted-foreground">
          <Play className="h-3.5 w-3.5 ml-0.5" />
        </div>
        <span className="text-xs text-muted-foreground">点击「重新生成」以获得分段音频讲解</span>
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
            className="prose prose-sm dark:prose-invert max-w-none"
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
    <header className="space-y-4 pb-8 border-b border-border/30">
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent rounded-full text-accent-foreground text-xs font-bold tracking-wide uppercase">
        难度 {knode.difficulty_level} / 5 · {knode.estimated_minutes} 分钟
      </div>
      <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-400 leading-tight">
        {knode.title}
      </h1>
      {knode.summary && (
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
          {knode.summary}
        </p>
      )}
    </header>
  )
}

// ---------------------------------------------------------------------------
// GeneratingProgress — redesigned to match Lumina Nexus reference
// ---------------------------------------------------------------------------

const STAGE_SUBTITLES: Partial<Record<PipelineStage, string>> = {
  planning: "分析知识节点，生成详细学习计划",
  ideating: "识别适合做成动画、游戏、故事的知识点",
  detailing: "为每个知识点细化媒体方案",
  generating: "并行生成动画 / 游戏 / 故事内容",
  audio: "为每段文字生成讲解音频",
}

function GeneratingProgress({
  stage, ideaProgress, agentLogs,
}: {
  stage: PipelineStage
  ideaProgress: { done: number; total: number }
  agentLogs: AgentLogEntry[]
}) {
  const currentIdx = STAGE_ORDER.indexOf(stage)
  const progressPct = PIPELINE_STAGES.length > 0
    ? Math.round((PIPELINE_STAGES.filter((s) => STAGE_ORDER.indexOf(s.key) < currentIdx).length / PIPELINE_STAGES.length) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-semibold text-foreground">AI 生成进度</span>
        </div>
        <span className="text-xs font-bold text-muted-foreground">{progressPct}%</span>
      </div>

      {/* Agent steps */}
      <div className="space-y-2">
        {PIPELINE_STAGES.map((s) => {
          const stageIdx = STAGE_ORDER.indexOf(s.key)
          const isDone = currentIdx > stageIdx
          const isActive = currentIdx === stageIdx
          const isPending = currentIdx < stageIdx

          if (isActive) {
            // Active step — elevated card with left gradient bar + large spinner
            const showProgress = (s.key === "generating") && ideaProgress.total > 0
            const pct = showProgress ? Math.round((ideaProgress.done / ideaProgress.total) * 100) : 0

            return (
              <div
                key={s.key}
                className="relative flex items-center justify-between px-6 py-5 rounded-xl bg-card border border-primary/15 shadow-[0_8px_30px_-8px_rgba(124,58,237,0.12)] overflow-hidden"
              >
                {/* Left accent bar */}
                <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-primary to-violet-400 rounded-l-xl" />

                <div className="flex items-center gap-5 ml-2">
                  {/* Spinner */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full border-2 border-primary/10 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full border-2 border-t-primary border-r-primary border-b-transparent border-l-transparent animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-foreground">{s.label}</span>
                      {showProgress && (
                        <span className="text-[10px] bg-primary/8 text-primary font-bold px-2 py-0.5 rounded-full">
                          {ideaProgress.done} / {ideaProgress.total}
                        </span>
                      )}
                    </div>
                    {showProgress ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1 w-36 bg-primary/8 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-violet-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{pct}%</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{STAGE_SUBTITLES[s.key]}</p>
                    )}
                  </div>
                </div>

                <span className="text-[11px] font-bold text-primary uppercase tracking-widest animate-pulse shrink-0">
                  运行中
                </span>
              </div>
            )
          }

          if (isDone) {
            return (
              <div
                key={s.key}
                className="flex items-center justify-between px-6 py-4 rounded-xl bg-secondary/20 border border-transparent hover:bg-secondary/30 transition-colors duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                  </div>
                  <span className="text-sm font-medium text-foreground/70">{s.label}</span>
                </div>
                <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest bg-cyan-500/8 px-2.5 py-1 rounded-full">
                  完成
                </span>
              </div>
            )
          }

          // Pending
          return (
            <div
              key={s.key}
              className="flex items-center justify-between px-6 py-4 rounded-xl bg-secondary/10 border border-transparent opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-muted-foreground/8 flex items-center justify-center shrink-0">
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                等待中
              </span>
            </div>
          )
        })}
      </div>

      {/* Agent logs (collapsible) */}
      {agentLogs.length > 0 && (
        <div className="rounded-xl border border-border/40 overflow-hidden mt-4">
          <div className="px-4 py-3 bg-secondary/30 border-b border-border/30 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Agent 实时日志</span>
            <span className="text-[10px] text-muted-foreground/60 ml-1">({agentLogs.length} 条)</span>
          </div>
          <div className="max-h-[260px] overflow-y-auto divide-y divide-border/20">
            {agentLogs.map((log, idx) => (
              <AgentLogRow key={idx} log={log} defaultExpanded={idx === agentLogs.length - 1} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 animate-pulse mt-2">
        <div className="h-4 w-2/3 bg-secondary rounded" />
        <div className="space-y-1.5">
          <div className="h-2.5 w-full bg-secondary/70 rounded" />
          <div className="h-2.5 w-5/6 bg-secondary/70 rounded" />
          <div className="h-2.5 w-4/5 bg-secondary/70 rounded" />
        </div>
        <div className="h-32 rounded-xl bg-secondary/40 mt-4" />
      </div>
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
            <span className={`text-[10px] font-bold font-mono ${isOutput ? "text-emerald-500" : "text-blue-500"}`}>
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
              <div className="text-[10px] font-bold text-emerald-500 mb-1">OUTPUT</div>
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
  const [stage, setStage] = useState<PipelineStage>("connecting")
  const [ideaProgress, setIdeaProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)
  const loadIdRef = useRef(0)

  const content = courseData?.course_content as CourseContent | undefined

  const load = async (regenerate = false) => {
    // Abort any in-flight load before starting a new one
    abortRef.current = true
    const myLoadId = ++loadIdRef.current
    abortRef.current = false
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
              />
            </div>
          )}

          {!generating && content && (
            <div className="max-w-3xl mx-auto px-8 py-10 space-y-16">
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
