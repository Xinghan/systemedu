"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  CircleCheck,
  CircleDot,
  Circle,
  Download,
  FileText,
  Flag,
  Globe,
  GraduationCap,
  Lock,
  Network,
  Wind,
  Wrench,
} from "lucide-react"
import {
  library,
  myProjects,
  type FinalOutcome,
  type FinalOutcomeKind,
  type LibraryProjectSummary,
} from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { KnowledgeTreeModal } from "@/components/learning/knowledge-tree-modal"

type Stage = { stage_id: string; title: string; stage_goal?: string }
type Module = {
  module_id: string
  title: string
  stage_id?: string
  summary?: string
  sequence_order?: number
  week?: number | null
  core_question?: string
}

type DetailProject = LibraryProjectSummary & {
  knowledge_tree?: {
    stages?: Stage[]
    modules?: Module[]
  } | null
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function stripFrontmatter(md: string): string {
  if (!md.startsWith("---")) return md
  const end = md.indexOf("\n---", 3)
  if (end < 0) return md
  return md.slice(end + 4).replace(/^\n+/, "")
}

function firstParagraph(md: string, maxLen = 380): string {
  const stripped = stripFrontmatter(md)
  // 去标题, 取首段
  const lines = stripped.split("\n")
  const buf: string[] = []
  for (const l of lines) {
    if (l.startsWith("#")) continue
    if (l.trim() === "" && buf.length > 0) break
    buf.push(l)
  }
  let para = buf.join(" ").trim()
  if (para.length > maxLen) para = para.slice(0, maxLen) + "…"
  return para
}

function domainClass(domain?: string | null): string {
  if (!domain) return "violet"
  const d = domain.toLowerCase()
  if (d.includes("climate")) return "climate"
  if (d.includes("aero") || d.includes("space")) return "aerospace"
  if (d.includes("bio")) return "bio"
  if (d.includes("robot")) return "robotics"
  if (d.includes("comput") || d.includes("ai")) return "computing"
  if (d.includes("material")) return "materials"
  if (d.includes("energy")) return "energy"
  return "violet"
}

function initials(name?: string | null): string {
  if (!name) return "SE"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// 计算 module 状态: 已 visited (last_module 之前的都算 done) / current / locked
function moduleStatus(
  modIdx: number,
  lastModuleId: string | null,
  modules: Module[],
): "done" | "current" | "locked" | "available" {
  if (!lastModuleId) return modIdx === 0 ? "current" : "locked"
  const lastIdx = modules.findIndex((m) => m.module_id === lastModuleId)
  if (lastIdx < 0) return "locked"
  if (modIdx < lastIdx) return "done"
  if (modIdx === lastIdx) return "current"
  return "available" // pulled 项目所有 modules 都可访问
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

export default function ProjectHome() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = decodeURIComponent(params.slug)
  const { loggedIn, hydrate } = useAuthStore()

  const [project, setProject] = useState<DetailProject | null>(null)
  const [blueprint, setBlueprint] = useState("")
  const [pulled, setPulled] = useState(false)
  const [lastModuleId, setLastModuleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulling, setPulling] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [p, bp] = await Promise.all([
          library.getProject(slug),
          library.getBlueprint(slug, "zh-CN").catch(() => ({ content: "" })),
        ])
        setProject(p as DetailProject)
        setBlueprint(bp.content || "")
        if (loggedIn) {
          try {
            const mine = await myProjects.list()
            const item = mine.find((m) => m.slug === slug)
            if (item) {
              setPulled(true)
              setLastModuleId(item.last_module_id ?? null)
            }
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [slug, loggedIn])

  const stages = project?.knowledge_tree?.stages || []
  const modules = useMemo(() => {
    const m = project?.knowledge_tree?.modules || []
    return [...m].sort(
      (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0),
    )
  }, [project])

  const modulesByStage = useMemo(() => {
    const grouped: Record<string, Module[]> = {}
    for (const m of modules) {
      const k = m.stage_id || "_"
      if (!grouped[k]) grouped[k] = []
      grouped[k].push(m)
    }
    return grouped
  }, [modules])

  const firstModuleId = modules[0]?.module_id
  const targetModuleId = lastModuleId || firstModuleId
  const completed = lastModuleId
    ? modules.findIndex((m) => m.module_id === lastModuleId)
    : 0
  const pct = modules.length > 0 ? Math.round((completed / modules.length) * 100) : 0

  async function handlePull() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/library/${slug}`)}`)
      return
    }
    setPulling(true)
    try {
      await myProjects.pull(slug)
      setPulled(true)
      toast.success("已加入我的书架")
      router.push("/home")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pull 失败")
    } finally {
      setPulling(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wide" style={{ maxWidth: 1100, paddingTop: 18 }}>
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--sub)" }}>
          加载中…
        </div>
      </main>
    )
  }
  if (!project) {
    return (
      <main className="page-wide" style={{ maxWidth: 1100, paddingTop: 18 }}>
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--sub)", marginBottom: 12 }}>项目不存在</p>
          <Link href="/library" className="btn btn-ghost btn-sm">
            返回 Library
          </Link>
        </div>
      </main>
    )
  }

  const dClass = domainClass(project.domain)

  return (
    <main className="page-wide" style={{ paddingTop: 18, maxWidth: 1100 }}>
      <Crumbs
        items={[
          { label: "Home" },
          { label: "Library" },
          { label: project.slug, mono: true },
        ]}
      />

      {/* Hero header */}
      <header
        style={{
          marginTop: 16,
          paddingBottom: 22,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 36,
            alignItems: "start",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              {project.domain && (
                <span className={`tag ${dClass}`}>{project.domain}</span>
              )}
              {project.age_band && <span className="tag">{project.age_band}</span>}
              {project.duration_weeks != null && (
                <span className="tag">{project.duration_weeks}w</span>
              )}
              {project.difficulty != null && (
                <span className="tag">diff {project.difficulty}/10</span>
              )}
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--sub)" }}>
              {project.slug}
            </div>
            <h1
              style={{
                fontSize: 34,
                lineHeight: 1.1,
                letterSpacing: "-.03em",
                fontWeight: 600,
                marginTop: 8,
                maxWidth: 640,
              }}
            >
              {project.title_zh || project.title}
            </h1>

            {/* meta line */}
            <div
              style={{
                marginTop: 18,
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "var(--sub)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    background: "var(--primary-soft)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--mono)",
                    fontSize: 9.5,
                    color: "var(--primary-ink)",
                    fontWeight: 600,
                  }}
                >
                  SE
                </div>
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                  by{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    SystemEdu Library
                  </strong>
                </span>
              </div>
              {project.published_at && (
                <>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span className="mono" style={{ fontSize: 11.5 }}>
                    published{" "}
                    {new Date(project.published_at).toLocaleDateString("zh-CN")}
                  </span>
                </>
              )}
              {project.version && (
                <>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span className="mono" style={{ fontSize: 11.5 }}>
                    v{project.version}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action panel */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              background: "var(--card)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div className="eyebrow">
                <span className="dot" />
                {pulled ? "Your shelf" : "Library"}
              </div>
              {pulled ? (
                <span className="pip run" style={{ fontSize: 10.5 }}>
                  IN PROGRESS
                </span>
              ) : (
                <span className="pip idle" style={{ fontSize: 10.5 }}>
                  NOT PULLED
                </span>
              )}
            </div>

            {pulled && modules.length > 0 && (
              <div style={{ marginTop: 2 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--sub)",
                    fontFamily: "var(--mono)",
                    marginBottom: 6,
                  }}
                >
                  <span>
                    {completed} / {modules.length} modules
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="bar violet">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {!loggedIn ? (
              <Link
                href={`/login?next=${encodeURIComponent(`/library/${slug}`)}`}
                className="btn btn-violet btn-lg"
                style={{ justifyContent: "center" }}
              >
                <Lock size={14} strokeWidth={1.5} /> 登录后 Pull
              </Link>
            ) : !pulled ? (
              <button
                type="button"
                onClick={handlePull}
                disabled={pulling}
                className="btn btn-violet btn-lg"
                style={{ justifyContent: "center" }}
              >
                <Download size={15} strokeWidth={1.5} />
                {pulling ? "Pulling..." : "Pull to my shelf"}
              </button>
            ) : targetModuleId ? (
              <Link
                href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(targetModuleId)}`}
                className="btn btn-violet btn-lg"
                style={{ justifyContent: "center" }}
              >
                <CirclePlay size={15} strokeWidth={1.5} /> Continue ·{" "}
                {targetModuleId}
              </Link>
            ) : null}

            <button
              type="button"
              className="btn btn-ghost"
              style={{ justifyContent: "center" }}
              onClick={() => setTreeOpen(true)}
              disabled={modules.length === 0}
            >
              <Network size={14} strokeWidth={1.5} /> Open knowledge tree
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 0,
          maxWidth: 880,
        }}
      >
        {/* §01 About */}
        <Block n="01" t="About">
          {blueprint ? (
            <>
              <article
                className="prose prose-stone prose-sm max-w-none prose-p:leading-relaxed prose-strong:font-semibold prose-strong:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none"
                style={{ fontSize: 14.5 }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {firstParagraph(blueprint)}
                </ReactMarkdown>
              </article>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <CoverArt kind={dClass} />
                <StripeArt label={`${project.slug} · v${project.version || "—"}`} />
              </div>
              <details
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1px dashed var(--border)",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--violet)",
                    fontWeight: 500,
                    marginBottom: 12,
                  }}
                >
                  展开完整介绍
                </summary>
                <article
                  className="prose prose-stone prose-sm max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:mt-6 prose-h2:text-xl prose-h3:text-base prose-p:leading-relaxed prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-muted prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {stripFrontmatter(blueprint)}
                  </ReactMarkdown>
                </article>
              </details>
            </>
          ) : (
            <p className="body" style={{ color: "var(--sub)" }}>
              暂无介绍
            </p>
          )}
        </Block>

        {/* §02 What you'll ship — spec 030: 真数据 final_outcomes, 老项目退回 stub */}
        <Block n="02" t="What you'll ship">
          {project.final_outcomes && project.final_outcomes.length > 0 ? (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {project.final_outcomes.map((fo, i) => (
                <FinalOutcomeCard key={i} outcome={fo} />
              ))}
            </ul>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <Outcome
                t={
                  modules.length > 0
                    ? `${modules.length} 个章节走完`
                    : "全部章节走完"
                }
                sub="按知识树顺序完成"
              />
              <Outcome t="AI 助教共学记录" sub="苏格拉底式问答陪伴整个项目" />
              <Outcome
                t={
                  project.duration_weeks
                    ? `${project.duration_weeks} 周完整学习路径`
                    : "完整学习路径"
                }
                sub="按节奏 weekly 推进"
              />
              <Outcome t="项目成果交付" sub="动手输出 + 作业提交" />
            </ul>
          )}
        </Block>

        {/* §03 Curriculum */}
        <Block
          n="03"
          t={`Curriculum · ${stages.length} stages · ${modules.length} modules`}
          last
        >
          {stages.length === 0 ? (
            <p className="body" style={{ color: "var(--sub)" }}>
              暂无章节数据
            </p>
          ) : (
            <Curriculum
              slug={slug}
              stages={stages}
              modulesByStage={modulesByStage}
              orderedModules={modules}
              lastModuleId={lastModuleId}
              pulled={pulled}
            />
          )}
        </Block>
      </div>

      {treeOpen && (
        <KnowledgeTreeModal
          slug={slug}
          projectTitle={project.title_zh || project.title}
          stages={stages}
          modules={modules}
          lastModuleId={lastModuleId}
          pulled={pulled}
          onClose={() => setTreeOpen(false)}
        />
      )}
    </main>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────────

function Crumbs({ items }: { items: { label: string; mono?: boolean }[] }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "var(--sub)",
        fontSize: 12.5,
      }}
    >
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {i > 0 && (
            <ChevronRight size={12} strokeWidth={1.5} style={{ color: "var(--sub-2)" }} />
          )}
          <span
            style={{
              color: i === items.length - 1 ? "var(--ink-2)" : "var(--sub)",
              fontFamily: it.mono ? "var(--mono)" : "inherit",
            }}
          >
            {it.label}
          </span>
        </span>
      ))}
    </div>
  )
}

function Block({
  n,
  t,
  children,
  last,
}: {
  n: string
  t: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <section
      style={{
        paddingBottom: 28,
        marginBottom: 28,
        borderBottom: last ? "0" : "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "baseline",
          marginBottom: 14,
        }}
      >
        <span className="mono" style={{ fontSize: 11, color: "var(--sub-2)" }}>
          § {n}
        </span>
        <h2 className="h2">{t}</h2>
      </div>
      {children}
    </section>
  )
}

function Outcome({ t, sub }: { t: string; sub: string }) {
  return (
    <li
      style={{
        padding: 14,
        border: "1px solid var(--border)",
        borderRadius: 9,
        background: "var(--card)",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span style={{ color: "var(--emerald)", marginTop: 2 }}>
        <Flag size={15} strokeWidth={1.5} />
      </span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
          {t}
        </div>
        <div
          className="body"
          style={{ fontSize: 12.5, color: "var(--sub)", marginTop: 4 }}
        >
          {sub}
        </div>
      </div>
    </li>
  )
}

// spec 030: FinalOutcome 卡 (4 类 kind 各自 icon + tint)
const KIND_META: Record<
  FinalOutcomeKind,
  { Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; tint: string; soft: string }
> = {
  capability: {
    Icon: GraduationCap,
    label: "能力",
    tint: "var(--computing)",
    soft: "var(--computing-soft)",
  },
  artifact: {
    Icon: Wrench,
    label: "制品",
    tint: "var(--aerospace)",
    soft: "var(--aerospace-soft)",
  },
  service: {
    Icon: Globe,
    label: "服务",
    tint: "var(--climate)",
    soft: "var(--climate-soft)",
  },
  publication: {
    Icon: FileText,
    label: "出版",
    tint: "var(--bio)",
    soft: "var(--bio-soft)",
  },
}

function FinalOutcomeCard({ outcome }: { outcome: FinalOutcome }) {
  const meta = KIND_META[outcome.kind] || KIND_META.artifact
  const Icon = meta.Icon
  return (
    <li
      style={{
        padding: 14,
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--card)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: meta.soft,
            color: meta.tint,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} strokeWidth={1.5} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 4,
            }}
          >
            <span
              className="mono"
              style={{ fontSize: 10.5, color: meta.tint, fontWeight: 500 }}
            >
              {meta.label.toUpperCase()}
            </span>
            {outcome.related_stage_id && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--sub-2)",
                  padding: "1px 5px",
                  border: "1px solid var(--border-2)",
                  borderRadius: 4,
                }}
              >
                {outcome.related_stage_id}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
            {outcome.title}
          </div>
          <div
            className="body"
            style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.5 }}
          >
            {outcome.description}
          </div>
        </div>
      </div>
      {outcome.evidence && (
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            color: "var(--sub)",
            padding: "6px 10px",
            background: "var(--paper)",
            border: "1px dashed var(--border-2)",
            borderRadius: 6,
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          <span style={{ color: "var(--sub-2)", flexShrink: 0 }}>evidence ·</span>
          <span>{outcome.evidence}</span>
        </div>
      )}
    </li>
  )
}

function Curriculum({
  slug,
  stages,
  modulesByStage,
  orderedModules,
  lastModuleId,
  pulled,
}: {
  slug: string
  stages: Stage[]
  modulesByStage: Record<string, Module[]>
  orderedModules: Module[]
  lastModuleId: string | null
  pulled: boolean
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    // 默认展开包含 current module 的 stage
    if (!lastModuleId) {
      return stages.length > 0 ? { [stages[0].stage_id]: true } : {}
    }
    const m = orderedModules.find((x) => x.module_id === lastModuleId)
    return m?.stage_id ? { [m.stage_id]: true } : {}
  })

  return (
    <div>
      {stages.map((s) => {
        const mods = modulesByStage[s.stage_id] || []
        const isOpen = !!open[s.stage_id]

        // count done in this stage
        let done = 0
        let hasCurrent = false
        if (lastModuleId) {
          const lastIdx = orderedModules.findIndex((m) => m.module_id === lastModuleId)
          done = mods.filter((m) => {
            const i = orderedModules.findIndex((x) => x.module_id === m.module_id)
            return i >= 0 && i < lastIdx
          }).length
          hasCurrent = mods.some((m) => m.module_id === lastModuleId)
        }

        return (
          <div
            key={s.stage_id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              marginBottom: 10,
              background: "var(--card)",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [s.stage_id]: !o[s.stage_id] }))}
              style={{
                display: "grid",
                gridTemplateColumns: "auto auto 1fr auto auto",
                gap: 12,
                alignItems: "center",
                padding: "14px 18px",
                width: "100%",
                border: 0,
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--sub-2)", width: 28 }}
              >
                {s.stage_id}
              </span>
              <span style={{ fontWeight: 600, fontSize: 14.5 }}>{s.title}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--sub)" }}>
                {mods.length > 0 ? `${mods.length} modules` : ""}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color:
                    done === mods.length && mods.length > 0
                      ? "var(--emerald)"
                      : "var(--ink-2)",
                }}
              >
                {done}/{mods.length || "—"}
              </span>
              {isOpen ? (
                <ChevronDown
                  size={14}
                  strokeWidth={1.5}
                  style={{ color: "var(--sub-2)" }}
                />
              ) : (
                <ChevronRight
                  size={14}
                  strokeWidth={1.5}
                  style={{ color: "var(--sub-2)" }}
                />
              )}
            </button>
            {isOpen && mods.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)" }}>
                {mods.map((m, i) => {
                  const modIdx = orderedModules.findIndex(
                    (x) => x.module_id === m.module_id,
                  )
                  const status = moduleStatus(modIdx, lastModuleId, orderedModules)
                  const clickable = pulled
                  const inner = (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto auto 1fr auto",
                        gap: 12,
                        alignItems: "center",
                        padding: "10px 18px",
                        cursor: clickable ? "pointer" : "default",
                        background:
                          status === "current"
                            ? "var(--violet-soft)"
                            : "transparent",
                        borderBottom:
                          i === mods.length - 1
                            ? "0"
                            : "1px dashed var(--border)",
                      }}
                    >
                      {status === "done" ? (
                        <CircleCheck
                          size={15}
                          strokeWidth={1.5}
                          style={{ color: "var(--emerald)" }}
                        />
                      ) : status === "current" ? (
                        <CircleDot
                          size={15}
                          strokeWidth={1.5}
                          style={{ color: "var(--violet)" }}
                        />
                      ) : pulled ? (
                        <Circle
                          size={15}
                          strokeWidth={1.5}
                          style={{ color: "var(--sub-2)" }}
                        />
                      ) : (
                        <Lock
                          size={14}
                          strokeWidth={1.5}
                          style={{ color: "var(--sub-2)" }}
                        />
                      )}
                      <span
                        className="mono"
                        style={{
                          fontSize: 11.5,
                          color: "var(--sub-2)",
                          width: 32,
                        }}
                      >
                        {m.module_id}
                      </span>
                      <span
                        style={{
                          fontSize: 13.5,
                          color:
                            status === "done"
                              ? "var(--sub)"
                              : status === "locked" || !pulled
                                ? "var(--sub-2)"
                                : "var(--ink-2)",
                        }}
                      >
                        {m.title}
                      </span>
                      {status === "current" && (
                        <span className="tag violet" style={{ fontSize: 10 }}>
                          NEXT
                        </span>
                      )}
                    </div>
                  )
                  return clickable ? (
                    <Link
                      key={m.module_id}
                      href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(m.module_id)}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={m.module_id}>{inner}</div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Cover & Stripe art
// ──────────────────────────────────────────────────────────────────────────

function CoverArt({ kind }: { kind: string }) {
  if (kind === "climate") {
    return (
      <div
        style={{
          height: 168,
          background: "linear-gradient(180deg, #F8EDE5 0%, #FBF9FF 100%)",
          position: "relative",
          overflow: "hidden",
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}
      >
        <svg
          viewBox="0 0 320 168"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <linearGradient id="ph-aq" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#D97757" stopOpacity=".25" />
              <stop offset="1" stopColor="#D97757" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 80, 120].map((y, i) => (
            <line
              key={i}
              x1="0"
              x2="320"
              y1={y}
              y2={y}
              stroke="#ECCFB8"
              strokeDasharray="2 4"
            />
          ))}
          <path
            d="M0 110 L30 95 L60 100 L90 80 L120 70 L150 55 L180 65 L210 45 L240 50 L270 35 L300 40 L320 30 L320 168 L0 168 Z"
            fill="url(#ph-aq)"
          />
          <path
            d="M0 110 L30 95 L60 100 L90 80 L120 70 L150 55 L180 65 L210 45 L240 50 L270 35 L300 40 L320 30"
            fill="none"
            stroke="#D97757"
            strokeWidth="1.5"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 16,
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <Wind size={16} strokeWidth={1.5} style={{ color: "var(--violet-ink)" }} />
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--violet-ink)",
              fontWeight: 500,
            }}
          >
            project · live
          </span>
        </div>
      </div>
    )
  }
  return <StripeArt label="cover" />
}

function StripeArt({ label, color = "var(--paper-2)" }: { label?: string; color?: string }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 168,
        borderRadius: 10,
        background: `repeating-linear-gradient(135deg, ${color} 0 12px, transparent 12px 24px), var(--paper)`,
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      {label && (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 10,
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--sub)",
            padding: "3px 7px",
            background: "rgba(255,255,255,.85)",
            borderRadius: 5,
            border: "1px solid var(--border)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}
