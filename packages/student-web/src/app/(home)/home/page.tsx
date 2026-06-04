"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Calendar,
  ChevronRight,
  CirclePlay,
  Clock,
  GitBranch,
  Layers,
  Network,
  Sparkles,
  TrendingUp,
  Waves,
  Wind,
} from "lucide-react"
import { myProjects, type MyProjectItem } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"

// 设计稿的 Crumbs
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

export default function HomePage() {
  const router = useRouter()
  const { loggedIn, username, hydrate } = useAuthStore()
  const [items, setItems] = useState<MyProjectItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (loggedIn === false) {
      router.replace("/login?next=/home")
    }
  }, [loggedIn, router])

  useEffect(() => {
    if (!loggedIn) return
    void (async () => {
      setLoading(true)
      try {
        const list = await myProjects.list()
        setItems(list)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "加载失败")
      } finally {
        setLoading(false)
      }
    })()
  }, [loggedIn])

  // 主项目: 最后访问过的 (有 last_module_id 的最近 pulled)
  const activeProject = items
    .filter((p) => p.last_module_id)
    .sort(
      (a, b) =>
        new Date(b.pulled_at || 0).getTime() - new Date(a.pulled_at || 0).getTime(),
    )[0]
    ?? items[0]

  // mock 用占位 (字段 student-app 暂未实现)
  const completedCount = activeProject?.last_module_id
    ? parseInt(activeProject.last_module_id.replace(/[^\d]/g, "")) || 0
    : 0
  const totalKnodes = activeProject?.knode_count ?? 0
  const pct =
    totalKnodes > 0 ? Math.round((completedCount / totalKnodes) * 100) : 0
  const nextModuleId = activeProject?.last_module_id
    ? activeProject.last_module_id
    : "M01"

  return (
    <main className="page-wide" style={{ paddingTop: 20 }}>
      <Crumbs items={[{ label: "Home" }, { label: "Dashboard" }]} />

      {/* greeting */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          margin: "12px 0 24px",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            <span className="dot" />
            {new Date().toLocaleDateString("zh-CN", { weekday: "long" })}
          </div>
          <h1 className="h1" style={{ fontSize: 30 }}>
            欢迎回来, {username ?? "学生"}
          </h1>
          <p
            className="body"
            style={{
              maxWidth: 540,
              marginTop: 6,
              color: "var(--sub)",
              fontSize: 13.5,
            }}
          >
            {activeProject
              ? `${pct}% through ${activeProject.slug}.`
              : "去 Library 看看，挑一个项目开始。"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost">
            <Calendar size={14} strokeWidth={1.5} /> Schedule
          </button>
          {activeProject && (
            <Link
              className="btn btn-violet"
              href={`/learn/${encodeURIComponent(activeProject.slug)}/${encodeURIComponent(nextModuleId)}`}
            >
              <CirclePlay size={14} strokeWidth={1.5} /> Continue {nextModuleId}
            </Link>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 0,
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          background: "var(--card)",
          marginBottom: 24,
        }}
      >
        <DashStat
          icon={<Layers size={13} strokeWidth={1.5} />}
          label="Modules done"
          value={activeProject ? `${completedCount} / ${totalKnodes}` : "—"}
          sub={
            activeProject?.last_module_id
              ? `last: ${activeProject.last_module_id}`
              : "—"
          }
        />
        <DashStat
          icon={<Clock size={13} strokeWidth={1.5} />}
          label="Time on project"
          value="—"
          sub="进度统计待接入"
        />
        <DashStat
          icon={<TrendingUp size={13} strokeWidth={1.5} />}
          label="Concepts mastered"
          value="—"
          sub="知识图谱待接入"
        />
        <DashStat
          icon={<Waves size={13} strokeWidth={1.5} />}
          label="Projects pulled"
          value={String(items.length)}
          sub="书架数"
        />
        <DashStat
          icon={<Sparkles size={13} strokeWidth={1.5} />}
          label="AI 助教"
          value="ready"
          sub="spec 028 已启用"
          last
        />
      </div>

      {loading && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--sub)" }}>
          加载中…
        </div>
      )}

      {!loading && !activeProject && (
        <div
          className="card"
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--sub)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div className="eyebrow">
            <span className="dot" />
            empty shelf
          </div>
          <h2 className="h2">你的书架还是空的</h2>
          <p className="sub">去 Library 看看，把感兴趣的项目 Pull 到这里开始学习。</p>
          <Link href="/library" className="btn btn-violet" style={{ marginTop: 6 }}>
            去 Library 看看
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      )}

      {!loading && activeProject && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.55fr 1fr",
            gap: 18,
          }}
        >
          {/* Continue learning panel */}
          <section className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  <span className="dot" /> Continue
                </div>
                <h2 className="h2">Active project</h2>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link
                  href={`/library/${encodeURIComponent(activeProject.slug)}`}
                  className="btn btn-ghost btn-sm"
                >
                  Project home
                  <ArrowRight size={13} strokeWidth={1.5} />
                </Link>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {/* left: project meta */}
              <div style={{ padding: 22, borderRight: "1px solid var(--border)" }}>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {activeProject.domain && (
                    <span className={`tag ${domainClass(activeProject.domain)}`}>
                      {activeProject.domain}
                    </span>
                  )}
                  {activeProject.age_band && (
                    <span className="tag">{activeProject.age_band}</span>
                  )}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 11.5, color: "var(--sub-2)" }}
                >
                  {activeProject.slug}
                </div>
                <h3
                  style={{
                    fontSize: 19,
                    lineHeight: 1.25,
                    marginTop: 6,
                    letterSpacing: "-.02em",
                    fontWeight: 600,
                  }}
                >
                  {activeProject.title_zh || activeProject.title}
                </h3>

                {/* Progress */}
                <div style={{ marginTop: 22 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span className="mono" style={{ fontSize: 11, color: "var(--sub)" }}>
                      Overall
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink)" }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="bar violet">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--sub)",
                      fontFamily: "var(--mono)",
                    }}
                  >
                    <span>
                      {completedCount} / {totalKnodes} modules
                    </span>
                    {activeProject.knode_count && (
                      <span>{activeProject.knode_count - completedCount} 待学</span>
                    )}
                  </div>
                </div>

                <Link
                  href={`/learn/${encodeURIComponent(activeProject.slug)}/${encodeURIComponent(nextModuleId)}`}
                  className="btn btn-violet"
                  style={{
                    marginTop: 20,
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  <CirclePlay size={14} strokeWidth={1.5} /> {nextModuleId} ·{" "}
                  {activeProject.last_module_id ? "继续学习" : "开始学习"}
                </Link>
              </div>

              {/* right: my project list */}
              <div style={{ padding: 22 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 11.5, color: "var(--sub)" }}
                  >
                    ALL PROJECTS · {items.length}
                  </span>
                  <Link
                    href="/my-projects"
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--violet)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    查看全部
                    <ArrowRight size={11} strokeWidth={1.5} />
                  </Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {items.slice(0, 5).map((p) => (
                    <ProjectRow key={p.slug} project={p} active={p.slug === activeProject.slug} />
                  ))}
                </div>
                {items.length > 5 && (
                  <Link
                    href="/my-projects"
                    className="mono"
                    style={{
                      display: "block",
                      marginTop: 10,
                      fontSize: 11,
                      color: "var(--sub)",
                      textAlign: "center",
                    }}
                  >
                    还有 {items.length - 5} 个项目 →
                  </Link>
                )}
              </div>
            </div>

            {/* footer */}
            <div
              style={{
                display: "flex",
                borderTop: "1px solid var(--border)",
                padding: "12px 22px",
                gap: 24,
                fontSize: 12.5,
                color: "var(--sub)",
                flexWrap: "wrap",
              }}
            >
              <span>
                <Calendar
                  size={12}
                  strokeWidth={1.5}
                  style={{ verticalAlign: -1, marginRight: 6 }}
                />
                pulled{" "}
                {activeProject.pulled_at
                  ? new Date(activeProject.pulled_at).toLocaleDateString("zh-CN")
                  : "—"}
              </span>
              <span>
                <GitBranch
                  size={12}
                  strokeWidth={1.5}
                  style={{ verticalAlign: -1, marginRight: 6 }}
                />
                v{activeProject.library_version || "—"}
              </span>
              <span style={{ marginLeft: "auto" }}>
                <Link
                  href={`/library/${encodeURIComponent(activeProject.slug)}`}
                  style={{ color: "var(--violet)" }}
                >
                  <Network
                    size={12}
                    strokeWidth={1.5}
                    style={{ verticalAlign: -1, marginRight: 6 }}
                  />
                  Knowledge tree
                  <ArrowUpRight
                    size={11}
                    strokeWidth={1.5}
                    style={{ verticalAlign: -1, marginLeft: 4 }}
                  />
                </Link>
              </span>
            </div>
          </section>

          {/* right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Agent flags — 占位 */}
            <section className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--border)" }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  <span className="dot" /> Agent
                </div>
                <h3 className="h3">AI 助教随时待命</h3>
              </div>
              <div
                style={{
                  padding: 20,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: "var(--violet-soft)",
                    color: "var(--violet-ink)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Bot size={14} strokeWidth={1.5} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.4 }}>
                    进入任意章节，右下角点开 AI 助教，苏格拉底式陪你想清楚。
                  </div>
                  <div
                    className="mono"
                    style={{ marginTop: 4, fontSize: 10.5, color: "var(--sub)" }}
                  >
                    spec 028 · GLM-5.1
                  </div>
                </div>
              </div>
            </section>

            {/* Adjacent — recommendations from library 后续 */}
            <section className="card" style={{ padding: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                <span className="dot" /> 探索
              </div>
              <h3 className="h3" style={{ marginBottom: 14 }}>
                Library 里更多项目
              </h3>
              <Link
                href="/library"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  color: "var(--ink-2)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 7,
                    background: "var(--paper-2)",
                    border: "1px solid var(--border)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Wind size={15} strokeWidth={1.5} style={{ color: "var(--ink-2)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--ink-2)" }}>浏览所有项目</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--sub)" }}>
                    去 Library
                  </div>
                </div>
                <ArrowUpRight size={13} strokeWidth={1.5} style={{ color: "var(--sub-2)" }} />
              </Link>
            </section>
          </div>
        </div>
      )}
    </main>
  )
}

function DashStat({
  icon,
  label,
  value,
  sub,
  last,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  last?: boolean
}) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderRight: last ? "0" : "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--sub)",
        }}
      >
        {icon}
        <span
          style={{
            fontSize: 11.5,
            fontFamily: "var(--mono)",
            letterSpacing: ".02em",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 22,
          letterSpacing: "-.02em",
          lineHeight: 1,
          color: "var(--ink)",
          fontWeight: 600,
        }}
      >
        {value}
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--sub)" }}>
        {sub}
      </div>
    </div>
  )
}

function ProjectRow({ project, active }: { project: MyProjectItem; active: boolean }) {
  // 已开始学的(有 last_module_id)直接续学; 还没开始的先回项目主页, 不直接钻进学习页
  const href = project.last_module_id
    ? `/learn/${encodeURIComponent(project.slug)}/${encodeURIComponent(project.last_module_id)}`
    : `/library/${encodeURIComponent(project.slug)}`
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        margin: "0 -12px",
        borderRadius: 8,
        background: active ? "var(--violet-soft)" : "transparent",
        color: "var(--ink-2)",
      }}
    >
      <CirclePlay
        size={16}
        strokeWidth={1.5}
        style={{ color: active ? "var(--violet)" : "var(--sub-2)" }}
      />
      <span
        className="mono"
        style={{ fontSize: 11, color: "var(--sub-2)", width: 32 }}
      >
        {project.last_module_id || "—"}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {project.title_zh || project.title}
      </span>
      <span className="mono" style={{ fontSize: 11, color: "var(--sub-2)" }}>
        {project.knode_count ?? 0}k
      </span>
    </Link>
  )
}

function domainClass(domain: string): string {
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
