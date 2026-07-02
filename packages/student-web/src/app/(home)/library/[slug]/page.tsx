"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  CircleCheck,
  CircleDot,
  Circle,
  Download,
  FileText,
  Flag,
  Gauge,
  Globe,
  GraduationCap,
  Lock,
  Network,
  Wrench,
} from "lucide-react"
import {
  library,
  myProjects,
  myKnodes,
  type FinalOutcome,
  type FinalOutcomeKind,
  type LibraryProjectSummary,
} from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { KnowledgeTreeModal } from "@/components/learning/knowledge-tree-modal"
import { KnowledgeTreeView } from "@/components/learning/KnowledgeTreeView"
import { StoryModal } from "@/components/library/StoryModal"
import { useT } from "@/lib/i18n/use-t"
import type { PlatformTree, ProjectKnowledgeTree } from "@/lib/api"

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
  const t = useT()
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
  const [storyOpen, setStoryOpen] = useState(false) // spec 040: 开篇连环画弹窗
  // spec 036: 用户完成 knode 列表 (用于 Curriculum 显示勾)
  const [completedKnodeIds, setCompletedKnodeIds] = useState<string[]>([])

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
          // spec 036: 拉取本项目已完成 knode 列表
          try {
            const status = await myKnodes.getCompleteStatus(slug)
            setCompletedKnodeIds(status.completed_knode_ids)
          } catch {
            /* ignore — 老 user 没数据 */
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("session.load_failed"))
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
      toast.success(t("library.pulled_toast"))
      router.push("/home")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("library.pull_failed"))
    } finally {
      setPulling(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wide" style={{ maxWidth: 1100, paddingTop: 18 }}>
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--sub)" }}>
          {t("home.loading")}
        </div>
      </main>
    )
  }
  if (!project) {
    return (
      <main className="page-wide" style={{ maxWidth: 1100, paddingTop: 18 }}>
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--sub)", marginBottom: 12 }}>{t("library.not_found")}</p>
          <Link href="/library" className="btn btn-ghost btn-sm">
            {t("library.back_to_library")}
          </Link>
        </div>
      </main>
    )
  }

  const dClass = domainClass(project.domain)
  const hasCover = Boolean(project.cover_image_path)

  return (
    <main className="page-wide" style={{ paddingTop: 18, maxWidth: 1100 }}>
      <Crumbs
        items={[
          { label: t("nav.home") },
          { label: t("library.title") },
          { label: project.slug, mono: true },
        ]}
      />

      {/* Hero header — 有封面时整幅海报做背景 + 暖色渐变蒙层, 文字反白 */}
      <header
        style={{
          marginTop: 16,
          position: "relative",
          overflow: "hidden",
          borderRadius: hasCover ? 16 : 0,
          border: hasCover ? "1px solid var(--border)" : undefined,
          borderBottom: hasCover ? "1px solid var(--border)" : "1px solid var(--border)",
          background: hasCover ? "#15110d" : undefined,
          padding: hasCover ? 28 : 0,
          paddingBottom: hasCover ? 28 : 22,
          color: hasCover ? "#fff" : undefined,
        }}
      >
        {hasCover && (
          <>
            {/* 海报背景 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={library.coverUrl(slug)}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center 42%",
                opacity: 0.95,
                pointerEvents: "none",
              }}
            />
            {/* 左侧深→右透明的暖色渐变蒙层, 保证左栏白字可读 */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(100deg, rgba(15,11,8,0.94) 0%, rgba(15,11,8,0.82) 34%, rgba(15,11,8,0.42) 60%, rgba(15,11,8,0.12) 100%)",
                pointerEvents: "none",
              }}
            />
          </>
        )}
        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 36,
            alignItems: hasCover ? "stretch" : "start",
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
              {(() => {
                // 有封面时标签在深色背景上, 用半透明白底反白字
                const tagStyle = hasCover
                  ? ({
                      background: "rgba(255,255,255,0.14)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.22)",
                    } as const)
                  : undefined
                return (
                  <>
                    {project.domain && (
                      <span
                        className={hasCover ? "tag" : `tag ${dClass}`}
                        style={tagStyle}
                      >
                        {t(`domain.${project.domain.toLowerCase()}`)}
                      </span>
                    )}
                    {project.difficulty != null && (
                      <span className="tag" style={tagStyle} title={t("card.difficulty")}>
                        <Gauge size={11} strokeWidth={1.7} />
                        {project.difficulty}
                      </span>
                    )}
                  </>
                )
              })()}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11.5,
                color: hasCover ? "rgba(255,255,255,0.6)" : "var(--sub)",
              }}
            >
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
                color: hasCover ? "#fff" : undefined,
                textShadow: hasCover ? "0 1px 16px rgba(0,0,0,0.5)" : undefined,
              }}
            >
              {project.title_zh || project.title}
            </h1>

            {/* spec 040: 看项目故事 (开篇连环画), 仅当项目有 story 时显示 */}
            {Array.isArray(project.story) && project.story.length > 0 && (
              <button
                onClick={() => setStoryOpen(true)}
                style={{
                  marginTop: 22,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start",
                  padding: "9px 16px",
                  borderRadius: 999,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: hasCover
                    ? "1px solid rgba(255,255,255,0.4)"
                    : "1px solid var(--primary)",
                  background: hasCover ? "rgba(255,255,255,0.16)" : "var(--primary-soft)",
                  color: hasCover ? "#fff" : "var(--primary-ink)",
                  backdropFilter: hasCover ? "blur(8px)" : undefined,
                }}
              >
                <BookOpen size={15} strokeWidth={1.8} />
                {t("story.view")}
              </button>
            )}
          </div>

          {/* Right column: action panel (封面已作为整块 hero 背景, 不再放独立图) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: hasCover ? "flex-end" : "flex-start",
            }}
          >
          {/* Action panel */}
          <div
            style={{
              border: hasCover ? "1px solid rgba(255,255,255,0.18)" : "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              background: hasCover ? "rgba(15,11,8,0.66)" : "var(--card)",
              backdropFilter: hasCover ? "blur(10px)" : undefined,
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
              <div
                className="eyebrow"
                style={hasCover ? { color: "rgba(255,255,255,0.7)" } : undefined}
              >
                <span className="dot" />
                {pulled ? t("nav.my_projects") : t("library.title")}
              </div>
              {pulled ? (
                <span className="pip run" style={{ fontSize: 10.5 }}>
                  {t("library.pip_in_progress")}
                </span>
              ) : (
                <span className="pip idle" style={{ fontSize: 10.5 }}>
                  {t("library.pip_not_added")}
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
                    color: hasCover ? "rgba(255,255,255,0.7)" : "var(--sub)",
                    fontFamily: "var(--mono)",
                    marginBottom: 6,
                  }}
                >
                  <span>
                    {completed} / {t("library.modules_count", { n: modules.length })}
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
                <Lock size={14} strokeWidth={1.5} /> {t("library.login_first")}
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
                {pulling ? t("library.pulling") : t("library.pull")}
              </button>
            ) : targetModuleId ? (
              <Link
                href={`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(targetModuleId)}`}
                className="btn btn-violet btn-lg"
                style={{ justifyContent: "center" }}
              >
                <CirclePlay size={15} strokeWidth={1.5} />{" "}
                {t("library.continue_module", { m: targetModuleId })}
              </Link>
            ) : null}

            <button
              type="button"
              className="btn btn-ghost"
              style={{
                justifyContent: "center",
                ...(hasCover
                  ? {
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.25)",
                      color: "#fff",
                    }
                  : {}),
              }}
              onClick={() => setTreeOpen(true)}
              disabled={modules.length === 0}
            >
              <Network size={14} strokeWidth={1.5} /> {t("library.open_knowledge_tree")}
            </button>
          </div>
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
                  {t("project_detail.expand_intro")}
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
              {t("project_detail.no_intro")}
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
                    ? t("project_detail.outcome.chapters_done", { n: modules.length })
                    : t("project_detail.outcome.all_chapters_done")
                }
                sub={t("project_detail.outcome.tree_order_sub")}
              />
              <Outcome t={t("project_detail.outcome.ai_record")} sub={t("project_detail.outcome.ai_record_sub")} />
              <Outcome
                t={
                  project.duration_weeks
                    ? t("project_detail.outcome.weeks_path", { n: project.duration_weeks })
                    : t("project_detail.outcome.full_path")
                }
                sub={t("project_detail.outcome.weekly_sub")}
              />
              <Outcome t={t("project_detail.outcome.delivery")} sub={t("project_detail.outcome.delivery_sub")} />
            </ul>
          )}
        </Block>

        {/* §03 Curriculum */}
        <Block
          n="03"
          t={`Curriculum · ${stages.length} stages · ${modules.length} modules`}
        >
          {stages.length === 0 ? (
            <p className="body" style={{ color: "var(--sub)" }}>
              {t("project_detail.no_chapters")}
            </p>
          ) : (
            <Curriculum
              slug={slug}
              stages={stages}
              modulesByStage={modulesByStage}
              orderedModules={modules}
              lastModuleId={lastModuleId}
              pulled={pulled}
              completedKnodeIds={completedKnodeIds}
            />
          )}
        </Block>

        {/* §04 Knowledge Tree (spec 035) */}
        <Block n="04" t={`Knowledge Tree · ${t("project_detail.knowledge_tree_sub")}`} last>
          <KnowledgeTreeSection slug={slug} />
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

      {/* spec 040: 开篇连环画弹窗 */}
      {storyOpen && Array.isArray(project.story) && project.story.length > 0 && (
        <StoryModal
          slug={slug}
          frames={project.story}
          onClose={() => setStoryOpen(false)}
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
    label: "project_detail.kind.capability",
    tint: "var(--computing)",
    soft: "var(--computing-soft)",
  },
  artifact: {
    Icon: Wrench,
    label: "project_detail.kind.artifact",
    tint: "var(--aerospace)",
    soft: "var(--aerospace-soft)",
  },
  service: {
    Icon: Globe,
    label: "project_detail.kind.service",
    tint: "var(--climate)",
    soft: "var(--climate-soft)",
  },
  publication: {
    Icon: FileText,
    label: "project_detail.kind.publication",
    tint: "var(--bio)",
    soft: "var(--bio-soft)",
  },
}

function FinalOutcomeCard({ outcome }: { outcome: FinalOutcome }) {
  const t = useT()
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
              {t(meta.label).toUpperCase()}
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
  completedKnodeIds = [],
}: {
  slug: string
  stages: Stage[]
  modulesByStage: Record<string, Module[]>
  orderedModules: Module[]
  lastModuleId: string | null
  pulled: boolean
  completedKnodeIds?: string[]
}) {
  const completedSet = new Set(completedKnodeIds)
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
                  let status = moduleStatus(modIdx, lastModuleId, orderedModules)
                  // spec 036: 用户已 mark complete → 强制 done
                  if (completedSet.has(m.module_id)) status = "done"
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
// spec 035: Knowledge Tree Section
// ──────────────────────────────────────────────────────────────────────────

function KnowledgeTreeSection({ slug }: { slug: string }) {
  const t = useT()
  const router = useRouter()
  const [platformTree, setPlatformTree] = useState<PlatformTree | null>(null)
  const [projectTree, setProjectTree] = useState<ProjectKnowledgeTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      library.getPlatformKnowledgeTree(),
      library.getProjectKnowledgeTree(slug),
    ])
      .then(([p, proj]) => {
        if (cancelled) return
        setPlatformTree(p)
        setProjectTree(proj)
        setErr(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : t("project_detail.tree_load_failed")
        setErr(msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <p className="body" style={{ color: "var(--sub)" }}>
        {t("project_detail.loading_platform_tree")}
      </p>
    )
  }
  if (err) {
    return (
      <p className="body" style={{ color: "var(--sub)" }}>
        {err}
      </p>
    )
  }
  if (!platformTree || !projectTree) {
    return null
  }
  if (projectTree.lit_nodes.length === 0) {
    return (
      <p className="body" style={{ color: "var(--sub)" }}>
        {t("project_detail.tree_not_mapped_cli")}
      </p>
    )
  }
  return (
    <KnowledgeTreeView
      platformTree={platformTree}
      projectTree={projectTree}
      onNodeClick={(knodeId) => router.push(`/library/${slug}/${knodeId}`)}
    />
  )
}
