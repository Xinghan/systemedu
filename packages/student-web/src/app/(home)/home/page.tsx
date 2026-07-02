"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ArrowUpRight,
  Brain,
  ChevronRight,
  CirclePlay,
  Gauge,
  Layers,
  Sparkles,
} from "lucide-react"
import { library, myKnodes, myProjects, type MyProjectItem } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useT } from "@/lib/i18n/use-t"

// ── 面包屑 ──
function Crumbs({ items }: { items: { label: string }[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--sub)", fontSize: 12.5 }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {i > 0 && <ChevronRight size={12} strokeWidth={1.5} style={{ color: "var(--sub-2)" }} />}
          <span style={{ color: i === items.length - 1 ? "var(--ink-2)" : "var(--sub)" }}>{it.label}</span>
        </span>
      ))}
    </div>
  )
}

function domainClass(domain: string): string {
  const d = (domain || "").toLowerCase()
  if (d.includes("climate")) return "climate"
  if (d.includes("aero") || d.includes("space")) return "aerospace"
  if (d.includes("bio") || d.includes("neuro")) return "bio"
  if (d.includes("robot")) return "robotics"
  if (d.includes("comput") || d.includes("ai")) return "computing"
  if (d.includes("material")) return "materials"
  if (d.includes("energy")) return "energy"
  return "violet"
}

// 每项目真实完成数 (按 slug 缓存于 state)
type ProgressMap = Record<string, number>

export default function HomePage() {
  const router = useRouter()
  const t = useT()
  const { loggedIn, username, hydrate } = useAuthStore()
  const [items, setItems] = useState<MyProjectItem[]>([])
  const [progress, setProgress] = useState<ProgressMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    if (loggedIn === false) router.replace("/login?next=/home")
  }, [loggedIn, router])

  useEffect(() => {
    if (!loggedIn) return
    void (async () => {
      setLoading(true)
      try {
        const list = await myProjects.list()
        const active = list.filter((p) => !p.removed_at)
        setItems(active)
        // 并发拉每个项目的真实完成节点数
        const entries = await Promise.all(
          active.map(async (p) => {
            try {
              const st = await myKnodes.getCompleteStatus(p.slug)
              return [p.slug, st.completed_knode_ids.length] as const
            } catch {
              return [p.slug, 0] as const
            }
          }),
        )
        setProgress(Object.fromEntries(entries))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("home.load_failed"))
      } finally {
        setLoading(false)
      }
    })()
  }, [loggedIn])

  // 真实统计
  const projectCount = items.length
  const totalDone = Object.values(progress).reduce((a, b) => a + b, 0)

  return (
    <main className="page-wide" style={{ paddingTop: 20 }}>
      <Crumbs items={[{ label: t("nav.home") }, { label: t("home.breadcrumb") }]} />

      {/* 欢迎 */}
      <div style={{ margin: "12px 0 24px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>
          {t("home.welcome_back")}，{username || t("home.default_name")}
        </h1>
        <p style={{ marginTop: 6, color: "var(--sub)", fontSize: 14 }}>
          {projectCount > 0 ? t("home.studying_n", { n: projectCount }) : t("home.empty_subtitle")}
        </p>
      </div>

      {/* 真实统计 3 格 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <StatCard icon={<Layers size={15} strokeWidth={1.5} />} label={t("home.stat_active")} value={String(projectCount)} sub={t("home.stat_active_sub")} />
        <StatCard icon={<Sparkles size={15} strokeWidth={1.5} />} label={t("home.stat_mastered")} value={String(totalDone)} sub={t("home.stat_mastered_sub")} />
        <Link
          href="/brain"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "16px 18px",
            background: "var(--card)",
            textDecoration: "none",
            color: "inherit",
            display: "block",
            transition: "box-shadow var(--t-med), border-color var(--t-med)",
          }}
          className="brain-card"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--sub)", fontSize: 12.5, marginBottom: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Brain size={15} strokeWidth={1.5} /> {t("brain.card.title")}
            </span>
            <ArrowUpRight size={15} strokeWidth={1.6} style={{ color: "var(--sub-2)" }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>
            {t("nav.brain")}
          </div>
          <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--sub-2)" }}>
            {t("brain.card.sub")}
          </div>
        </Link>
      </div>

      {/* 我的项目网格 */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="h2">{t("home.my_projects")}{projectCount > 0 ? ` (${projectCount})` : ""}</h2>
        <Link href="/library" className="btn btn-ghost btn-sm">
          {t("home.browse_all")} <ArrowUpRight size={13} strokeWidth={1.5} />
        </Link>
      </div>

      {loading && <p style={{ color: "var(--sub)", fontSize: 14, padding: "32px 0" }}>{t("home.loading")}</p>}

      {!loading && items.length === 0 && (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 14,
            padding: "48px 24px",
            textAlign: "center",
            background: "var(--paper-2)",
          }}
        >
          <p style={{ color: "var(--ink-2)", fontSize: 15, marginBottom: 14 }}>{t("home.empty.title")}</p>
          <Link href="/library" className="btn btn-primary">
            {t("home.empty.cta")} <ArrowUpRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {items.map((p) => (
            <ProjectCard key={p.slug} project={p} done={progress[p.slug] ?? 0} />
          ))}
        </div>
      )}

      <style jsx>{`
        .brain-card:hover {
          border-color: var(--primary-line) !important;
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </main>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", background: "var(--card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--sub)", fontSize: 12.5, marginBottom: 8 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--sub-2)" }}>{sub}</div>
    </div>
  )
}

function ProjectCard({ project: p, done }: { project: MyProjectItem; done: number }) {
  const t = useT()
  const total = p.knode_count ?? 0
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const nextModuleId = p.last_module_id || "M01"
  const title = p.title_zh || p.title || p.slug
  const dcls = domainClass(p.domain || "")
  const unavailable = p.unavailable

  return (
    <Link
      href={`/library/${encodeURIComponent(p.slug)}`}
      style={{
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--card)",
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
      }}
      className="my-project-card"
    >
      {/* 封面 */}
      <Cover slug={p.slug} hasCover={!!p.cover_image_path} />

      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {p.domain && <span className={`tag ${dcls}`}>{t(`domain.${p.domain.toLowerCase()}`)}</span>}
          {p.difficulty != null && (
            <span className="tag" title={t("card.difficulty")}>
              <Gauge size={11} strokeWidth={1.7} />
              {p.difficulty}
            </span>
          )}
          {p.upgrade_available && <span className="tag violet">{t("home.tag_update")}</span>}
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35, marginBottom: 12 }}>
          {title}
        </h3>

        {/* 真实进度 */}
        <div style={{ marginTop: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--sub)", marginBottom: 5 }}>
            <span>{done} / {total} {t("home.nodes_suffix")}</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--paper-2)", overflow: "hidden", marginBottom: 12 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--primary)", borderRadius: 999 }} />
          </div>

          {unavailable ? (
            <div className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", opacity: 0.6, cursor: "default" }}>
              {t("home.project_unavailable")}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Link
                href={`/learn/${encodeURIComponent(p.slug)}/${encodeURIComponent(nextModuleId)}`}
                className="btn btn-primary btn-sm"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={(e) => e.stopPropagation()}
              >
                <CirclePlay size={13} strokeWidth={1.5} /> {t("home.continue")} {nextModuleId}
              </Link>
              <span
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: "center" }}
              >
                {t("home.details")}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function Cover({ slug, hasCover }: { slug: string; hasCover: boolean }) {
  const [failed, setFailed] = useState(false)
  if (!hasCover || failed) {
    return (
      <div style={{ height: 120, background: "linear-gradient(135deg, #FBF8F1 0%, #F1E8D6 100%)", borderBottom: "1px solid var(--border)" }} />
    )
  }
  return (
    <div style={{ position: "relative", height: 120, overflow: "hidden", background: "#15110d", borderBottom: "1px solid var(--border)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={library.coverUrl(slug)}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 48%", display: "block" }}
      />
    </div>
  )
}
