"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, CheckCircle2, Loader2, BookOpen, Zap, Gamepad2, BookMarked, Terminal, ChevronDown, ChevronRight } from "lucide-react"
import { gateway } from "@/lib/api"
import type {
  CourseContent,
  CourseContentData,
  CourseIdeaSummary,
  KnodeInfo,
  RenderedSection,
} from "@/lib/types/api"
import { IframeStepView } from "./iframe-step-view"

interface AgentLogEntry {
  agent: string
  phase: "input" | "output"
  input: string
  output: string
  timestamp: string
}

interface CourseContentViewProps {
  projectName: string
  nodeId: number
  knode: KnodeInfo | null
  onClose: () => void
  onMarkComplete?: () => void
}

const MODE_ICONS = {
  animation: Zap,
  game: Gamepad2,
  story: BookMarked,
}

const MODE_LABELS = {
  animation: "动画演示",
  game: "互动游戏",
  story: "故事引入",
}

function IdeaBlock({
  idea,
  section,
}: {
  idea: CourseIdeaSummary
  section: RenderedSection | null
}) {
  const Icon = MODE_ICONS[idea.mode]
  const label = MODE_LABELS[idea.mode]

  if (!section) {
    // Loading skeleton
    return (
      <div className="my-6 rounded-2xl border border-border/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-secondary/40 border-b border-border/30">
          <div className="h-3.5 w-3.5 rounded-full bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted-foreground/20 animate-pulse" />
        </div>
        <div className="h-48 bg-secondary/20 animate-pulse" />
      </div>
    )
  }

  if (section.status === "failed") {
    return (
      <div className="my-6 rounded-2xl border border-border/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-secondary/40 border-b border-border/30">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">{label} - {idea.topic}</span>
        </div>
        <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
          内容生成失败
        </div>
      </div>
    )
  }

  if (idea.mode === "story" && section.story_paragraphs) {
    return (
      <div className="my-6 rounded-2xl border border-border/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200/50 dark:border-amber-500/20">
          <BookMarked className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{label} - {idea.topic}</span>
        </div>
        <div className="divide-y divide-border/30">
          {section.story_paragraphs.map((para, idx) => (
            <div key={idx} className="flex gap-4 p-4">
              {para.image_url ? (
                <img
                  src={para.image_url}
                  alt={`故事插图 ${idx + 1}`}
                  className="w-28 h-20 rounded-lg object-cover shrink-0 bg-secondary"
                />
              ) : (
                <div className="w-28 h-20 rounded-lg bg-secondary shrink-0 flex items-center justify-center">
                  <BookMarked className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
              <p className="text-sm text-foreground leading-relaxed">{para.text}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if ((idea.mode === "animation" || idea.mode === "game") && section.html) {
    const bgColor = idea.mode === "animation" ? "bg-blue-50 dark:bg-blue-500/10" : "bg-purple-50 dark:bg-purple-500/10"
    const borderColor = idea.mode === "animation" ? "border-blue-200/50 dark:border-blue-500/20" : "border-purple-200/50 dark:border-purple-500/20"
    const textColor = idea.mode === "animation" ? "text-blue-700 dark:text-blue-300" : "text-purple-700 dark:text-purple-300"
    const iconColor = idea.mode === "animation" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400"

    return (
      <div className="my-6 rounded-2xl border border-border/50 overflow-hidden">
        <div className={`flex items-center gap-2 px-4 py-3 ${bgColor} border-b ${borderColor}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          <span className={`text-xs font-semibold ${textColor}`}>{label} - {idea.topic}</span>
        </div>
        <div className="h-[380px]">
          <IframeStepView html={section.html} onComplete={() => {}} />
        </div>
      </div>
    )
  }

  return null
}

function PlanWithIdeas({
  content,
  loadedSections,
}: {
  content: CourseContent
  loadedSections: Record<string, RenderedSection | null>
}) {
  // Split plan by placeholders and render ideas inline
  const parts = content.plan_markdown.split(/(\[\[IDEA:[^\]]+\]\])/g)

  const ideaMap = new Map(content.ideas.map((i) => [i.idea_id, i]))

  return (
    <div>
      {parts.map((part, idx) => {
        const match = part.match(/^\[\[IDEA:([^\]]+)\]\]$/)
        if (match) {
          const ideaId = match[1]
          const idea = ideaMap.get(ideaId)
          if (!idea) return null
          const section = loadedSections[ideaId] ?? null
          return <IdeaBlock key={idx} idea={idea} section={section} />
        }
        // Render markdown text
        if (!part.trim()) return null
        return (
          <div
            key={idx}
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{
              __html: renderSimpleMarkdown(part),
            }}
          />
        )
      })}
    </div>
  )
}

/** Very simple Markdown-to-HTML converter for plan text. */
function renderSimpleMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold mt-5 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-4 mb-1">$1</h3>')
    .replace(/^\- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="text-sm text-foreground leading-relaxed my-2">')
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match
      return `<p class="text-sm text-foreground leading-relaxed my-2">${match}</p>`
    })
}

export function CourseContentView({
  projectName,
  nodeId,
  knode,
  onClose,
  onMarkComplete,
}: CourseContentViewProps) {
  const [courseData, setCourseData] = useState<CourseContentData | null>(null)
  const [loadedSections, setLoadedSections] = useState<Record<string, RenderedSection | null>>({})
  const [generationStatus, setGenerationStatus] = useState<
    "idle" | "generating" | "ready" | "failed"
  >("idle")
  const [generationProgress, setGenerationProgress] = useState<string>("")
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([])
  const [isCompleted, setIsCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const content = courseData?.course_content as CourseContent | undefined

  const startGeneration = useCallback(
    async (regenerate = false) => {
      setError(null)
      setGenerationStatus("generating")
      setGenerationProgress("正在规划学习内容...")
      setCourseData(null)
      setLoadedSections({})
      setAgentLogs([])

      try {
        await gateway.generateCourseV2(projectName, nodeId, regenerate)
      } catch (e) {
        setError(e instanceof Error ? e.message : "生成失败")
        setGenerationStatus("failed")
        return
      }

      // Connect SSE
      if (esRef.current) {
        esRef.current.close()
      }
      const es = gateway.streamCourse(projectName, nodeId)
      esRef.current = es

      es.addEventListener("plan_ready", () => {
        setGenerationProgress("学习计划已生成，正在识别富媒体知识点...")
      })

      es.addEventListener("ideas_identified", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { count: number }
        setGenerationProgress(`已识别 ${data.count} 个知识点，正在并行生成内容...`)
        // Pre-fill loadedSections with null (loading state)
        if (courseData?.course_content) {
          const c = courseData.course_content as CourseContent
          const initial: Record<string, RenderedSection | null> = {}
          c.ideas.forEach((i) => { initial[i.idea_id] = null })
          setLoadedSections(initial)
        }
      })

      es.addEventListener("agent_log", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { agent: string; phase: string; input: string; output: string }
        setAgentLogs((prev) => [
          ...prev,
          {
            agent: data.agent,
            phase: data.phase as "input" | "output",
            input: data.input,
            output: data.output,
            timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          },
        ])
      })

      es.addEventListener("idea_complete", (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { idea_id: string; mode: string; status: string }
        // Reload course v2 to get latest section data
        gateway.getCourseV2(projectName, nodeId).then((latest) => {
          const c = latest.course_content as CourseContent
          if (c?.rendered_sections) {
            setLoadedSections((prev) => ({
              ...prev,
              [data.idea_id]: c.rendered_sections[data.idea_id] ?? null,
            }))
          }
          setCourseData(latest)
        }).catch(() => {})
        setGenerationProgress(`已完成: ${data.mode} (${data.status})`)
      })

      es.addEventListener("done", () => {
        setGenerationStatus("ready")
        setGenerationProgress("")
        gateway.getCourseV2(projectName, nodeId).then((latest) => {
          setCourseData(latest)
          const c = latest.course_content as CourseContent
          if (c?.rendered_sections) {
            setLoadedSections(c.rendered_sections)
          }
        }).catch(() => {})
        es.close()
      })

      es.addEventListener("error", (e: MessageEvent) => {
        const data = e.data ? JSON.parse(e.data) as { message?: string } : {}
        setError(data.message || "生成过程出错")
        setGenerationStatus("failed")
        es.close()
      })

      es.onerror = () => {
        // Connection lost - check DB state
        gateway.getCourseV2(projectName, nodeId).then((latest) => {
          if (latest.status === "ready") {
            setCourseData(latest)
            const c = latest.course_content as CourseContent
            if (c?.rendered_sections) {
              setLoadedSections(c.rendered_sections)
            }
            setGenerationStatus("ready")
          } else {
            setError("连接中断，请刷新重试")
            setGenerationStatus("failed")
          }
        }).catch(() => {
          setError("连接中断，请刷新重试")
          setGenerationStatus("failed")
        })
        es.close()
      }
    },
    [projectName, nodeId, courseData]
  )

  // On mount: check if already generated, otherwise trigger generation
  useEffect(() => {
    setCurrentScrollTop(0)
    setIsCompleted(false)
    setError(null)
    setCourseData(null)
    setLoadedSections({})
    setGenerationStatus("idle")

    gateway.getCourseV2(projectName, nodeId).then((data) => {
      if (data.status === "ready" && Object.keys(data.course_content).length > 0) {
        setCourseData(data)
        const c = data.course_content as CourseContent
        if (c?.rendered_sections) {
          setLoadedSections(c.rendered_sections)
        }
        setGenerationStatus("ready")
      } else {
        startGeneration(false)
      }
    }).catch(() => {
      startGeneration(false)
    })

    return () => {
      esRef.current?.close()
    }
  }, [projectName, nodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [currentScrollTop, setCurrentScrollTop] = useState(0)

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header knode={knode} onClose={onClose} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <p className="text-sm">{error}</p>
          <button
            onClick={() => startGeneration(true)}
            className="text-xs text-primary hover:underline"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className="flex flex-col h-full">
        <Header knode={knode} onClose={onClose} />
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-xl font-extrabold text-foreground">恭喜完成！</h3>
            <p className="text-sm text-muted-foreground">你已完成《{knode?.title}》的全部学习内容</p>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              返回
            </button>
            <button
              onClick={() => { onMarkComplete?.(); onClose() }}
              className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
            >
              标记完成
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header knode={knode} onClose={onClose} />

      {/* Generation progress indicator */}
      {generationStatus === "generating" && (
        <div className="px-6 py-2.5 border-b border-border/30 flex items-center gap-2 bg-primary/5 shrink-0">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">
            {generationProgress || "内容生成中..."}
          </span>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        {generationStatus === "generating" && !content && (
          <>
            <GeneratingSkeleton />
            {agentLogs.length > 0 && (
              <AgentDebugPanel logs={agentLogs} />
            )}
          </>
        )}

        {content && (
          <>
            <PlanWithIdeas
              content={content}
              loadedSections={loadedSections}
            />
            {agentLogs.length > 0 && (
              <AgentDebugPanel logs={agentLogs} />
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {generationStatus === "ready" && (
        <div className="px-6 py-4 border-t border-border/50 shrink-0">
          <div className="flex items-center justify-end">
            <button
              onClick={() => setIsCompleted(true)}
              className="flex items-center gap-1.5 px-6 h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              完成学习
            </button>
          </div>
        </div>
      )}
    </div>
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

function GeneratingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 w-2/3 bg-secondary rounded" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-secondary/70 rounded" />
        <div className="h-3 w-5/6 bg-secondary/70 rounded" />
        <div className="h-3 w-4/5 bg-secondary/70 rounded" />
      </div>
      <div className="h-5 w-1/2 bg-secondary rounded mt-4" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-secondary/70 rounded" />
        <div className="h-3 w-3/4 bg-secondary/70 rounded" />
      </div>
      <div className="h-48 rounded-2xl bg-secondary/40 mt-6" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-secondary/70 rounded" />
        <div className="h-3 w-2/3 bg-secondary/70 rounded" />
      </div>
      <div className="h-48 rounded-2xl bg-secondary/40 mt-6" />
    </div>
  )
}

function AgentLogRow({ log }: { log: AgentLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const isOutput = log.phase === "output"

  return (
    <div className={`border-b border-border/20 last:border-0 ${isOutput ? "bg-secondary/10" : ""}`}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-secondary/20 transition-colors"
      >
        <div className="shrink-0 mt-0.5">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
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

function AgentDebugPanel({ logs }: { logs: AgentLogEntry[] }) {
  const [collapsed, setCollapsed] = useState(false)

  // Group logs: pair input+output for same agent call
  // Show logs in order received
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
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {!collapsed && (
        <div className="divide-y divide-border/20 max-h-[500px] overflow-y-auto">
          {logs.map((log, idx) => (
            <AgentLogRow key={idx} log={log} />
          ))}
        </div>
      )}
    </div>
  )
}
