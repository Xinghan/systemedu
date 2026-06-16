"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  GitFork,
  Grid3X3,
  Library as LibraryIcon,
  Menu,
  Trash2,
  Wind,
  FlaskConical,
} from "lucide-react"
import { library, myProjects, type MyProjectItem } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useT } from "@/lib/i18n/use-t"

type Status = "active" | "paused" | "shipped"
type FilterKey = Status | "all"

interface ForkItem extends MyProjectItem {
  status: Status
  progress: number // 0-100
  completed: number
  total: number
  forkedDays: number
  lastDays: number
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

function deriveStatus(item: MyProjectItem, days: number): Status {
  // 还没开始学 (刚 pull) 算 active 待开始, 不是 paused;
  // paused 专指"学过一半但久未触碰"
  if (!item.last_module_id) return "active"
  const total = item.knode_count ?? 0
  const completed = parseInt(item.last_module_id.replace(/[^\d]/g, "")) || 0
  if (total > 0 && completed >= total) return "shipped"
  if (days > 14) return "paused"
  return "active"
}

function daysAgo(iso: string | null | undefined): number {
  if (!iso) return 999
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86400_000))
}

export default function MyProjectsPage() {
  const t = useT()
  const router = useRouter()
  const { loggedIn, hydrate } = useAuthStore()
  const [items, setItems] = useState<MyProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [filter, setFilter] = useState<FilterKey>("active")

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (loggedIn === false) {
      router.replace("/login?next=/my-projects")
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
        toast.error(err instanceof Error ? err.message : t("myprojects.load_failed"))
      } finally {
        setLoading(false)
      }
    })()
  }, [loggedIn])

  const forks: ForkItem[] = useMemo(() => {
    return items.map((it) => {
      const forkedDays = daysAgo(it.pulled_at)
      // 简化: lastDays 沿用 forkedDays (没有真 last_visited_at 在 list 里)
      const lastDays = forkedDays
      const total = it.knode_count ?? 0
      const completed = it.last_module_id
        ? parseInt(it.last_module_id.replace(/[^\d]/g, "")) || 0
        : 0
      const progress =
        total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
      return {
        ...it,
        status: deriveStatus(it, lastDays),
        progress,
        completed,
        total,
        forkedDays,
        lastDays,
      }
    })
  }, [items])

  const groups = useMemo(
    () => ({
      active: forks.filter((f) => f.status === "active"),
      paused: forks.filter((f) => f.status === "paused"),
      shipped: forks.filter((f) => f.status === "shipped"),
    }),
    [forks],
  )

  const filtered =
    filter === "all" ? forks : groups[filter as Status] || []

  const totalModules = forks.reduce((acc, f) => acc + f.total, 0)
  const doneModules = forks.reduce((acc, f) => acc + f.completed, 0)
  const overallPct =
    totalModules > 0 ? Math.round((doneModules / totalModules) * 100) : 0

  async function handleRemove(slug: string) {
    try {
      await myProjects.remove(slug)
      setItems((prev) => prev.filter((x) => x.slug !== slug))
      toast.success(t("myprojects.remove_success"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("myprojects.remove_failed"))
    }
  }

  return (
    <main className="page-wide" style={{ paddingTop: 20 }}>
      <Crumbs items={[{ label: t("nav.home") }, { label: t("nav.my_projects") }]} />

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
            <span className="dot" />{" "}
            {t("myprojects.forks_shipped", {
              forks: forks.length,
              shipped: groups.shipped.length,
            })}
          </div>
          <h1 className="h1" style={{ fontSize: 30 }}>
            {t("myproj.title")}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/library" className="btn btn-ghost">
            <LibraryIcon size={14} strokeWidth={1.5} /> {t("myprojects.library")}
          </Link>
          <Link href="/library" className="btn btn-violet">
            <GitFork size={14} strokeWidth={1.5} /> {t("myprojects.pull_new")}
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0,
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--card)",
          marginBottom: 20,
        }}
      >
        <MiniStat
          label={t("myprojects.stat_pulled")}
          value={String(forks.length)}
          sub={t("myprojects.stat_all_time")}
        />
        <MiniStat
          label={t("myprojects.stat_active")}
          value={String(groups.active.length)}
          sub={t("myprojects.stat_recently_studied")}
        />
        <MiniStat
          label={t("myprojects.stat_modules")}
          value={totalModules > 0 ? `${doneModules}/${totalModules}` : "—"}
          sub={
            totalModules > 0
              ? t("myprojects.stat_across_all_forks", { pct: overallPct })
              : t("myprojects.stat_no_data")
          }
        />
        <MiniStat
          label={t("myprojects.stat_shipped")}
          value={String(groups.shipped.length)}
          sub={
            groups.shipped[0]?.slug
              ? groups.shipped[0].slug
              : t("myprojects.stat_incomplete")
          }
          last
        />
      </div>

      {/* Filter rail */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 18,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        <FilterTab id="active" current={filter} onClick={setFilter} label={t("myprojects.tab_active")} n={groups.active.length} />
        <FilterTab id="paused" current={filter} onClick={setFilter} label={t("myprojects.tab_paused")} n={groups.paused.length} />
        <FilterTab id="shipped" current={filter} onClick={setFilter} label={t("myprojects.tab_shipped")} n={groups.shipped.length} />
        <FilterTab id="all" current={filter} onClick={setFilter} label={t("myprojects.tab_all")} n={forks.length} />
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className={"nav-tab " + (view === "grid" ? "active" : "")}
          onClick={() => setView("grid")}
        >
          <Grid3X3 size={13} strokeWidth={1.5} /> {t("myprojects.view_grid")}
        </button>
        <button
          type="button"
          className={"nav-tab " + (view === "list" ? "active" : "")}
          onClick={() => setView("list")}
        >
          <Menu size={13} strokeWidth={1.5} /> {t("myprojects.view_list")}
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--sub)" }}>
          {t("myprojects.loading")}
        </div>
      ) : forks.length === 0 ? (
        <EmptyShelf />
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            border: "1px dashed var(--border-2)",
            borderRadius: 12,
          }}
        >
          <div style={{ color: "var(--sub)", fontSize: 13 }}>{t("myprojects.category_empty")}</div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            onClick={() => setFilter("all")}
          >
            {t("myprojects.show_all")}
          </button>
        </div>
      ) : view === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((f) => (
            <ForkCard key={f.slug} f={f} onRemove={() => handleRemove(f.slug)} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <ForkListHead />
          {filtered.map((f, i) => (
            <ForkListRow key={f.slug} f={f} last={i === filtered.length - 1} />
          ))}
        </div>
      )}
    </main>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────────────────

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

function MiniStat({
  label,
  value,
  sub,
  last,
}: {
  label: string
  value: string
  sub: string
  last?: boolean
}) {
  return (
    <div
      style={{
        padding: "14px 18px",
        borderRight: last ? "0" : "1px solid var(--border)",
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 11, color: "var(--sub)", letterSpacing: ".02em" }}
      >
        {label.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-.02em",
          marginTop: 4,
        }}
      >
        {value}
      </div>
      <div
        className="mono"
        style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 3 }}
      >
        {sub}
      </div>
    </div>
  )
}

function FilterTab({
  id,
  label,
  n,
  current,
  onClick,
}: {
  id: FilterKey
  label: string
  n: number
  current: FilterKey
  onClick: (k: FilterKey) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={"nav-tab " + (current === id ? "active" : "")}
    >
      {label}
      <span
        style={{
          color: "var(--sub-2)",
          fontSize: 11,
          marginLeft: 4,
          fontFamily: "var(--mono)",
        }}
      >
        {n}
      </span>
    </button>
  )
}

function statusPip(s: Status, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (s === "active")
    return (
      <span className="pip run" style={{ fontSize: 10.5 }}>
        {t("myprojects.pip_active")}
      </span>
    )
  if (s === "paused")
    return (
      <span className="pip warn" style={{ fontSize: 10.5 }}>
        {t("myprojects.pip_paused")}
      </span>
    )
  return (
    <span className="pip ok" style={{ fontSize: 10.5 }}>
      {t("myprojects.pip_shipped")}
    </span>
  )
}

function ForkCard({ f, onRemove }: { f: ForkItem; onRemove: () => void }) {
  const t = useT()
  const target = f.last_module_id || "M01"
  const dClass = domainClass(f.domain)
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--card)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Link
        href={`/library/${encodeURIComponent(f.slug)}`}
        style={{ position: "relative", textDecoration: "none" }}
      >
        {f.cover_image_path ? (
          <CoverPhoto slug={f.slug} dClass={dClass} />
        ) : (
          <CoverArt kind={dClass} />
        )}
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          {statusPip(f.status, t)}
        </div>
      </Link>
      <div
        style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {f.domain && <span className={`tag ${dClass}`}>{f.domain}</span>}
          {f.age_band && <span className="tag">{f.age_band}</span>}
        </div>
        <div className="mono" style={{ color: "var(--sub-2)", fontSize: 11 }}>
          {f.slug}
        </div>
        <h3 className="h3" style={{ fontSize: 15, lineHeight: 1.35 }}>
          {f.title_zh || f.title}
        </h3>

        {f.status === "shipped" ? (
          <div
            style={{
              marginTop: 4,
              padding: "10px 12px",
              background: "var(--emerald-soft)",
              border: "1px solid #DCC4A6",
              borderRadius: 7,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#5E412A",
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              <Check size={13} strokeWidth={1.8} /> {t("myprojects.all_chapters_done")}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--sub)",
                fontFamily: "var(--mono)",
                marginBottom: 5,
              }}
            >
              <span>
                {f.completed}/{f.total || "—"}
              </span>
              <span>{f.progress}%</span>
            </div>
            <div className="bar violet">
              <i style={{ width: `${f.progress}%` }} />
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: f.status === "paused" ? "var(--amber)" : "var(--ink-2)",
                marginTop: 8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {(f.status === "paused" ? t("myprojects.paused_at") : t("myprojects.next")) + " · "}
              {f.last_module_id || "M01"}
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 10,
            borderTop: "1px dashed var(--border)",
            gap: 6,
          }}
        >
          <span className="mono" style={{ fontSize: 10.5, color: "var(--sub)" }}>
            {f.forkedDays === 0
              ? t("myprojects.pulled_today")
              : t("myprojects.pulled_days_ago", { n: f.forkedDays })}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                if (confirm(t("myprojects.remove_confirm"))) onRemove()
              }}
              aria-label={t("myprojects.remove")}
              style={{
                border: 0,
                background: "transparent",
                color: "var(--sub-2)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <Trash2 size={13} strokeWidth={1.5} />
            </button>
            <Link
              href={`/learn/${encodeURIComponent(f.slug)}/${encodeURIComponent(target)}`}
              className="btn btn-violet btn-sm"
            >
              {f.last_module_id ? t("myproj.continue") : t("myproj.start")}
              <ArrowRight size={12} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ForkListHead() {
  const t = useT()
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 100px 1fr 110px 90px 80px",
        gap: 12,
        padding: "10px 18px",
        fontFamily: "var(--mono)",
        fontSize: 10.5,
        color: "var(--sub)",
        letterSpacing: ".05em",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span>{t("myprojects.col_project")}</span>
      <span>{t("myprojects.col_domain")}</span>
      <span>{t("myprojects.col_progress")}</span>
      <span>{t("myprojects.col_status")}</span>
      <span style={{ textAlign: "right" }}>{t("myprojects.col_pulled")}</span>
      <span />
    </div>
  )
}

function ForkListRow({ f, last }: { f: ForkItem; last: boolean }) {
  const t = useT()
  const target = f.last_module_id || "M01"
  const dClass = domainClass(f.domain)
  return (
    <Link
      href={`/learn/${encodeURIComponent(f.slug)}/${encodeURIComponent(target)}`}
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 100px 1fr 110px 90px 80px",
        gap: 12,
        alignItems: "center",
        padding: "14px 18px",
        borderBottom: last ? "0" : "1px solid var(--border)",
        textDecoration: "none",
        color: "var(--ink-2)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {f.title_zh || f.title}
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 2 }}>
          {f.slug}
        </div>
      </div>
      <span className={`tag ${dClass}`}>{f.domain || "—"}</span>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10.5,
            color: "var(--sub)",
            fontFamily: "var(--mono)",
            marginBottom: 4,
          }}
        >
          <span>
            {f.completed}/{f.total || "—"}
          </span>
          <span>{f.progress}%</span>
        </div>
        <div className="bar violet">
          <i style={{ width: `${f.progress}%` }} />
        </div>
      </div>
      <span>{statusPip(f.status, t)}</span>
      <span
        className="mono"
        style={{ fontSize: 10.5, color: "var(--sub)", textAlign: "right" }}
      >
        {f.forkedDays === 0
          ? t("myprojects.today")
          : t("myprojects.days_ago", { n: f.forkedDays })}
      </span>
      <ArrowRight
        size={13}
        strokeWidth={1.5}
        style={{ color: "var(--sub-2)", justifySelf: "end" }}
      />
    </Link>
  )
}

function EmptyShelf() {
  const t = useT()
  return (
    <div
      className="card"
      style={{
        padding: 48,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div className="eyebrow">
        <span className="dot" />
        {t("myprojects.empty_shelf")}
      </div>
      <h2 className="h2">{t("myproj.empty.title")}</h2>
      <p className="sub">{t("myproj.empty.desc")}</p>
      <Link href="/library" className="btn btn-violet" style={{ marginTop: 6 }}>
        <Download size={14} strokeWidth={1.5} /> {t("myproj.empty.cta")}
      </Link>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// 真封面图(有 cover_image_path 时使用),加载失败降级回 CoverArt
// ──────────────────────────────────────────────────────────────────────────

function CoverPhoto({ slug, dClass }: { slug: string; dClass: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <CoverArt kind={dClass} />
  return (
    <div
      style={{
        height: 168,
        position: "relative",
        overflow: "hidden",
        background: "#15110d",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={library.coverUrl(slug)}
        alt=""
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 48%",
          display: "block",
        }}
      />
      {/* 底部柔和渐变, 让卡片内容区过渡自然 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(21,17,13,0) 55%, rgba(21,17,13,0.5) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Cover art (按 domain)
// ──────────────────────────────────────────────────────────────────────────

function CoverArt({ kind }: { kind: string }) {
  if (kind === "climate") {
    return (
      <div
        style={{
          height: 140,
          background: "linear-gradient(180deg, #F8EDE5 0%, #FBF9FF 100%)",
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <svg
          viewBox="0 0 320 140"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <linearGradient id="mp-aq" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#D97757" stopOpacity=".25" />
              <stop offset="1" stopColor="#D97757" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[35, 70, 105].map((y, i) => (
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
            d="M0 90 L30 80 L60 85 L90 65 L120 60 L150 45 L180 55 L210 35 L240 40 L270 25 L300 30 L320 22 L320 140 L0 140 Z"
            fill="url(#mp-aq)"
          />
          <path
            d="M0 90 L30 80 L60 85 L90 65 L120 60 L150 45 L180 55 L210 35 L240 40 L270 25 L300 30 L320 22"
            fill="none"
            stroke="#D97757"
            strokeWidth="1.5"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 14,
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <Wind size={14} strokeWidth={1.5} style={{ color: "var(--violet-ink)" }} />
        </div>
      </div>
    )
  }
  if (kind === "aerospace") {
    return (
      <div
        style={{
          height: 140,
          background: "#15131F",
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <svg viewBox="0 0 320 140" width="100%" height="100%" preserveAspectRatio="none">
          {Array.from({ length: 32 }).map((_, i) => {
            const x = (i * 37) % 320
            const y = (i * 23) % 140
            const r = i % 7 === 0 ? 1.5 : 0.8
            return (
              <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={r === 1.5 ? 0.9 : 0.4} />
            )
          })}
          <circle cx="240" cy="50" r="14" fill="#D97757" opacity=".15" />
          <circle cx="240" cy="50" r="3" fill="#D97757" />
        </svg>
      </div>
    )
  }
  if (kind === "bio") {
    return (
      <div
        style={{
          height: 140,
          background: "#EFEBDD",
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <svg viewBox="0 0 320 140" width="100%" height="100%" preserveAspectRatio="none">
          <circle cx="160" cy="70" r="60" fill="none" stroke="#A67B5B" strokeOpacity=".25" />
          <circle cx="160" cy="70" r="45" fill="none" stroke="#A67B5B" strokeOpacity=".4" />
          {[
            [130, 50, 5],
            [155, 65, 3],
            [170, 50, 4],
            [180, 80, 6],
            [150, 90, 3.5],
            [135, 80, 2.5],
            [195, 65, 4],
            [205, 85, 2.5],
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
            top: 12,
            left: 14,
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <FlaskConical size={14} strokeWidth={1.5} style={{ color: "#5E412A" }} />
        </div>
      </div>
    )
  }
  return (
    <div
      style={{
        height: 140,
        background: `repeating-linear-gradient(135deg, var(--paper-2) 0 12px, transparent 12px 24px), var(--paper)`,
        borderBottom: "1px solid var(--border)",
      }}
    />
  )
}
