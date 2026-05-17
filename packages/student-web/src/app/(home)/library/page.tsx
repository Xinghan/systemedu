"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Filter,
  FlaskConical,
  Grid3X3,
  Plus,
  Sparkles,
  Wind,
} from "lucide-react"
import { library, myProjects, type LibraryProjectSummary } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"

// Crumbs
function Crumbs({ items }: { items: { label: string }[] }) {
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
          <span style={{ color: i === items.length - 1 ? "var(--ink-2)" : "var(--sub)" }}>
            {it.label}
          </span>
        </span>
      ))}
    </div>
  )
}

const DOMAIN_LABELS = [
  "All",
  "Climate",
  "Aerospace",
  "Bioscience",
  "Robotics",
  "Materials",
  "Energy",
  "Computing",
] as const

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

export default function LibraryListPage() {
  const { loggedIn, hydrate } = useAuthStore()
  const [projects, setProjects] = useState<LibraryProjectSummary[]>([])
  const [pulled, setPulled] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("All")

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const all = await library.listProjects()
        setProjects(all)
        if (loggedIn) {
          try {
            const mine = await myProjects.list()
            setPulled(new Set(mine.map((m) => m.slug)))
          } catch {
            /* 401 ignored */
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [loggedIn])

  const filtered = useMemo(() => {
    if (filter === "All") return projects
    const f = filter.toLowerCase()
    return projects.filter((p) =>
      (p.domain || "").toLowerCase().includes(f.slice(0, 5)),
    )
  }, [projects, filter])

  // 按 domain 统计
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of projects) {
      const d = (p.domain || "Other").trim()
      c[d] = (c[d] || 0) + 1
    }
    return c
  }, [projects])

  return (
    <main className="page-wide" style={{ paddingTop: 20 }}>
      <Crumbs items={[{ label: "Home" }, { label: "Library" }]} />

      {/* heading */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          margin: "12px 0 20px",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            <span className="dot" />
            {projects.length} projects · {Object.keys(counts).length} domains
          </div>
          <h1 className="h1" style={{ fontSize: 30 }}>
            Project library
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost">
            <Filter size={14} strokeWidth={1.5} /> Filters
          </button>
          <button className="btn btn-ghost">
            <Grid3X3 size={14} strokeWidth={1.5} /> Grid
          </button>
        </div>
      </div>

      {/* Filter rail */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 22,
          paddingBottom: 14,
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        {DOMAIN_LABELS.map((c) => {
          const cnt =
            c === "All"
              ? projects.length
              : projects.filter((p) =>
                  (p.domain || "").toLowerCase().includes(c.toLowerCase().slice(0, 5)),
                ).length
          return (
            <button
              key={c}
              type="button"
              className={"nav-tab " + (filter === c ? "active" : "")}
              onClick={() => setFilter(c)}
            >
              {c}
              {c !== "All" && (
                <span
                  style={{
                    color: "var(--sub-2)",
                    fontSize: 11,
                    marginLeft: 4,
                    fontFamily: "var(--mono)",
                  }}
                >
                  {cnt}
                </span>
              )}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 11.5, color: "var(--sub)" }}>
          SORT
        </span>
        <button className="btn btn-ghost btn-sm">
          Most recent
          <ChevronDown size={12} strokeWidth={1.5} />
        </button>
      </div>

      {/* Project grid */}
      {loading ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--sub)" }}>
          加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--sub)" }}>
          没有匹配项目
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((p) => (
            <ProjectCard key={p.slug} project={p} pulled={pulled.has(p.slug)} />
          ))}
        </div>
      )}

      {/* request a project */}
      <div
        style={{
          marginTop: 24,
          border: "1px dashed var(--border-2)",
          borderRadius: 10,
          padding: "18px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 className="h3">没找到想做的?</h3>
          <p
            className="body"
            style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}
          >
            导师会跟行业作者一起为你定一个项目。
          </p>
        </div>
        <button className="btn btn-ghost">
          <Plus size={14} strokeWidth={1.5} /> Request a project
        </button>
      </div>
    </main>
  )
}

function ProjectCard({
  project,
  pulled,
}: {
  project: LibraryProjectSummary
  pulled: boolean
}) {
  const dClass = domainClass(project.domain)
  return (
    <Link
      href={`/library/${encodeURIComponent(project.slug)}`}
      style={{
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--card)",
        boxShadow: "var(--shadow-sm)",
        textDecoration: "none",
        color: "var(--ink-2)",
        transition: "transform var(--t-med), box-shadow var(--t-med)",
      }}
    >
      <CoverArt kind={dClass} />
      <div
        style={{
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flex: 1,
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {project.domain && <span className={`tag ${dClass}`}>{project.domain}</span>}
          {project.duration_weeks != null && (
            <span className="tag">{project.duration_weeks}w</span>
          )}
          {project.difficulty != null && (
            <span className="tag">diff {project.difficulty}</span>
          )}
          {pulled && (
            <span className="tag violet">
              <Sparkles size={11} strokeWidth={1.5} style={{ marginRight: 2 }} />
              在我的书架
            </span>
          )}
        </div>
        <div className="mono" style={{ color: "var(--sub-2)", fontSize: 11 }}>
          {project.slug}
        </div>
        <h3 className="h3" style={{ fontSize: 16, lineHeight: 1.35 }}>
          {project.title_zh || project.title}
        </h3>
        {project.description && (
          <p
            className="body"
            style={{ fontSize: 13.5, color: "var(--sub)", flex: 1 }}
          >
            {project.description.length > 90
              ? project.description.slice(0, 90) + "…"
              : project.description}
          </p>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 12,
            borderTop: "1px dashed var(--border)",
          }}
        >
          <span
            className="mono"
            style={{ fontSize: 11, color: "var(--sub)" }}
          >
            {project.stage_count ?? 0}S · {project.knode_count ?? 0}K
          </span>
          <span
            style={{
              color: "var(--violet)",
              fontSize: 13,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Open <ArrowRight size={13} strokeWidth={1.5} />
          </span>
        </div>
      </div>
    </Link>
  )
}

// ---- 封面 ----
// 跟设计稿 Homepage.jsx CoverArt 同源, 但 student-app 没有项目特定数据,
// 用 domain 选 climate/space/bio/violet 抽象图案
function CoverArt({ kind }: { kind: string }) {
  if (kind === "climate") {
    return (
      <div
        style={{
          height: 168,
          background: "linear-gradient(180deg, #F8EDE5 0%, #FBF9FF 100%)",
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--border)",
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
            <linearGradient id="aqg-climate" x1="0" x2="0" y1="0" y2="1">
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
            fill="url(#aqg-climate)"
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
            PM2.5 · μg/m³
          </span>
        </div>
      </div>
    )
  }
  if (kind === "aerospace") {
    return (
      <div
        style={{
          height: 168,
          background: "#15131F",
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <svg viewBox="0 0 320 168" width="100%" height="100%" preserveAspectRatio="none">
          {Array.from({ length: 40 }).map((_, i) => {
            const x = (i * 37) % 320
            const y = (i * 23) % 168
            const r = i % 7 === 0 ? 1.5 : 0.8
            return (
              <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={r === 1.5 ? 0.9 : 0.4} />
            )
          })}
          <ellipse cx="240" cy="60" rx="55" ry="55" fill="none" stroke="#D97757" strokeOpacity=".5" />
          <ellipse cx="240" cy="60" rx="38" ry="38" fill="none" stroke="#D97757" strokeOpacity=".7" />
          <circle cx="240" cy="60" r="14" fill="#D97757" opacity=".15" />
          <circle cx="240" cy="60" r="3" fill="#D97757" />
        </svg>
      </div>
    )
  }
  if (kind === "bio") {
    return (
      <div
        style={{
          height: 168,
          background: "#EFEBDD",
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <svg viewBox="0 0 320 168" width="100%" height="100%" preserveAspectRatio="none">
          <circle cx="160" cy="84" r="74" fill="none" stroke="#A67B5B" strokeOpacity=".25" />
          <circle cx="160" cy="84" r="55" fill="none" stroke="#A67B5B" strokeOpacity=".4" />
          {[
            [120, 60, 5],
            [145, 75, 3],
            [170, 55, 4],
            [180, 90, 6],
            [150, 100, 3.5],
            [135, 90, 2.5],
            [195, 75, 4],
            [205, 95, 2.5],
            [125, 105, 4],
            [175, 115, 3],
          ].map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill="#A67B5B" opacity=".15" />
              <circle cx={x} cy={y} r={r} fill="none" stroke="#A67B5B" strokeWidth="0.8" />
            </g>
          ))}
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
          <FlaskConical size={16} strokeWidth={1.5} style={{ color: "#5E412A" }} />
          <span
            style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#5E412A" }}
          >
            field study
          </span>
        </div>
      </div>
    )
  }
  // default: 抽象斜纹
  return (
    <div
      style={{
        height: 168,
        background: `repeating-linear-gradient(135deg, var(--paper-2) 0 12px, transparent 12px 24px), var(--paper)`,
        borderBottom: "1px solid var(--border)",
      }}
    />
  )
}
