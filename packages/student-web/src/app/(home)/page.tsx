"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowRight,
  Bot,
  CircleCheck,
  GitBranch,
  GitFork,
  Network,
  Rocket,
  Sparkles,
  Star,
  Target,
  Users,
} from "lucide-react"
import { library, type LibraryProjectSummary } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"

// Public landing page — design: main_design/UI/pages/Homepage.jsx
// 任何人都能看, 已登录展示 [My dashboard], 未登录展示 [Sign in]

export default function Homepage() {
  const { loggedIn, hydrate } = useAuthStore()
  const [featured, setFeatured] = useState<LibraryProjectSummary[]>([])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    void (async () => {
      try {
        const all = await library.listProjects()
        setFeatured(all.slice(0, 3))
      } catch {
        /* 不阻塞落地页渲染 */
      }
    })()
  }, [])

  return (
    <main className="page" style={{ paddingTop: 14 }}>
      {/* ── Hero ── */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          border: "1px solid var(--border)",
          borderRadius: 16,
          background:
            "linear-gradient(135deg, #FFFFFF 0%, #FBF8F1 55%, #F1E8D6 100%)",
          padding: "44px 48px",
          marginBottom: 16,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 18,
            right: 22,
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--sub)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: 999,
              background: "var(--violet)",
            }}
          />
          v2.4
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr 1fr",
            gap: 48,
            alignItems: "center",
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 22 }}>
              <span className="dot" /> For builders aged 10–14
            </div>
            <h1 className="display" style={{ maxWidth: 640 }}>
              <span style={{ color: "var(--primary)" }}>Fork</span> a real
              project.
              <br />
              <span style={{ color: "var(--aerospace)" }}>Ship</span> it for
              real.
            </h1>
            <p
              style={{
                maxWidth: 500,
                marginTop: 20,
                fontSize: 15,
                lineHeight: 1.55,
                color: "var(--sub)",
              }}
            >
              Industry-grade STEAM projects packaged as forkable repos. An AI
              agent fills the gap whenever the work outpaces the syllabus.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
              <Link href="/library" className="btn btn-violet btn-lg">
                Browse library
                <ArrowRight size={15} strokeWidth={1.5} />
              </Link>
              {loggedIn ? (
                <Link href="/home" className="btn btn-ghost btn-lg">
                  My dashboard
                </Link>
              ) : (
                <Link href="/login" className="btn btn-ghost btn-lg">
                  Sign in
                </Link>
              )}
            </div>
          </div>

          <div>
            <PackageVisual />
          </div>
        </div>
      </section>

      {/* ── Three-up ── */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <ValueCell
          n="01"
          t="Industry scope"
          icon={<Target size={16} strokeWidth={1.5} />}
          tint="var(--primary)"
          soft="var(--primary-soft)"
          body="Real parts, real datasheets, real failure modes."
        />
        <ValueCell
          n="02"
          t="AI fills the gap"
          icon={<Bot size={16} strokeWidth={1.5} />}
          tint="var(--computing)"
          soft="var(--computing-soft)"
          body="When the math goes past 6th grade, the agent picks it up."
        />
        <ValueCell
          n="03"
          t="Repo, not a course"
          icon={<GitBranch size={16} strokeWidth={1.5} />}
          tint="var(--bio)"
          soft="var(--bio-soft)"
          body="Fork it. Ship it. Open a PR when you're done."
        />
      </section>

      {/* ── Featured projects ── */}
      {featured.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <SectionRule
            eyebrow="Featured"
            title="In the library"
            right={
              <Link href="/library" className="btn btn-ghost btn-sm">
                All {featured.length > 0 ? "" : ""}projects
                <ArrowRight size={13} strokeWidth={1.5} />
              </Link>
            }
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginTop: 16,
            }}
          >
            {featured.map((p) => (
              <FeaturedCard key={p.slug} project={p} />
            ))}
          </div>
        </section>
      )}

      {/* ── How it works ── */}
      <section style={{ marginTop: 48 }}>
        <SectionRule eyebrow="The loop" title="How a project lives" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            marginTop: 18,
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--card)",
          }}
        >
          <Step
            n="01"
            icon={<GitFork size={18} strokeWidth={1.5} />}
            t="Fork"
            body="Clone a project with its module ladder and BOM."
          />
          <Step
            n="02"
            icon={<Bot size={18} strokeWidth={1.5} />}
            t="Learn"
            body="Short modules. AI agent on standby for the hard parts."
          />
          <Step
            n="03"
            icon={<Network size={18} strokeWidth={1.5} />}
            t="Build"
            body="Solder, flash, wire, mount. Real hardware, real failures."
          />
          <Step
            n="04"
            icon={<Rocket size={18} strokeWidth={1.5} />}
            t="Ship"
            body="Submit upstream. Open a PR back to the library."
            last
          />
        </div>
      </section>

      {/* ── Metrics strip ── */}
      <section
        style={{
          marginTop: 32,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        <Stat n={`${featured.length || "—"}`} l="projects" sub="growing" tint="var(--primary)" />
        <Stat n="—" l="modules done" sub="待数据接入" tint="var(--aerospace)" />
        <Stat n="—" l="hardware ships" sub="待数据接入" tint="var(--bio)" />
        <Stat n="—" l="cross-validated" sub="upstream" tint="var(--robotics)" />
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          marginTop: 64,
          paddingTop: 28,
          borderTop: "1px solid var(--border)",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 32,
          color: "var(--sub)",
          fontSize: 13,
        }}
      >
        <div>
          <div className="brand" style={{ marginBottom: 10 }}>
            <span className="brand-mark">
              <span>SE</span>
            </span>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>
              SystemEdu
            </span>
          </div>
          <p style={{ marginTop: 10, maxWidth: 320, color: "var(--sub)" }}>
            本地优先的 AI Agent Sandbox 教育平台。给 10–18 岁的青少年做工业级
            STEAM 项目, AI 助教苏格拉底式陪伴。
          </p>
          <div
            className="mono"
            style={{ marginTop: 14, color: "var(--sub-2)", fontSize: 11 }}
          >
            © 2026 SystemEdu Labs
          </div>
        </div>
        <FootCol t="Library" items={["Climate", "Aerospace", "Bioscience", "Robotics"]} />
        <FootCol
          t="Platform"
          items={["Knowledge tree", "AI tutor", "Hardware kits"]}
        />
        <FootCol t="Company" items={["About", "Open source", "Careers"]} />
      </footer>
    </main>
  )
}

function SectionRule({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string
  title: string
  right?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        paddingBottom: 12,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          <span className="dot" /> {eyebrow}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.025em" }}>
          {title}
        </h2>
      </div>
      {right}
    </div>
  )
}

function ValueCell({
  n,
  t,
  body,
  icon,
  tint,
  soft,
}: {
  n: string
  t: string
  body: string
  icon: React.ReactNode
  tint: string
  soft: string
}) {
  return (
    <div className="card" style={{ padding: 20, position: "relative", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div className="mono" style={{ color: tint, fontWeight: 500, fontSize: 11 }}>
          {n}
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: soft,
            display: "grid",
            placeItems: "center",
            color: tint,
          }}
        >
          {icon}
        </div>
      </div>
      <h3 className="h2" style={{ marginBottom: 6, fontSize: 17 }}>
        {t}
      </h3>
      <p
        className="body"
        style={{ maxWidth: 340, fontSize: 13.5, color: "var(--sub)" }}
      >
        {body}
      </p>
    </div>
  )
}

function FeaturedCard({ project }: { project: LibraryProjectSummary }) {
  const dClass = domainClass(project.domain)
  return (
    <Link
      href={`/library/${encodeURIComponent(project.slug)}`}
      className="card"
      style={{
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        textDecoration: "none",
        color: "var(--ink-2)",
      }}
    >
      <div
        style={{
          height: 168,
          background:
            dClass === "climate"
              ? "linear-gradient(180deg, #F8EDE5 0%, #FBF9FF 100%)"
              : dClass === "aerospace"
                ? "#15131F"
                : dClass === "bio"
                  ? "#EFEBDD"
                  : `repeating-linear-gradient(135deg, var(--paper-2) 0 12px, transparent 12px 24px), var(--paper)`,
          borderBottom: "1px solid var(--border)",
        }}
      />
      <div
        style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {project.domain && <span className={`tag ${dClass}`}>{project.domain}</span>}
          {project.duration_weeks != null && (
            <span className="tag">{project.duration_weeks}w</span>
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
            style={{ fontSize: 13, color: "var(--sub)", flex: 1 }}
          >
            {project.description.slice(0, 80)}
            {project.description.length > 80 ? "…" : ""}
          </p>
        )}
      </div>
    </Link>
  )
}

function Step({
  n,
  icon,
  t,
  body,
  last,
}: {
  n: string
  icon: React.ReactNode
  t: string
  body: string
  last?: boolean
}) {
  return (
    <div
      style={{
        padding: 22,
        borderRight: last ? "0" : "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 200,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className="mono" style={{ color: "var(--sub-2)" }}>
          {n}
        </span>
        <span style={{ color: "var(--violet)" }}>{icon}</span>
      </div>
      <h4 className="h3" style={{ fontSize: 15 }}>
        {t}
      </h4>
      <p className="body" style={{ fontSize: 13.5 }}>
        {body}
      </p>
    </div>
  )
}

function Stat({
  n,
  l,
  sub,
  tint,
}: {
  n: string
  l: string
  sub: string
  tint: string
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--card)",
      }}
    >
      <div
        style={{
          fontSize: 36,
          lineHeight: 1,
          letterSpacing: "-.035em",
          color: tint,
          fontWeight: 600,
        }}
      >
        {n}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-2)" }}>{l}</div>
      <div className="mono" style={{ marginTop: 3, fontSize: 11, color: "var(--sub)" }}>
        {sub}
      </div>
    </div>
  )
}

function FootCol({ t, items }: { t: string; items: string[] }) {
  return (
    <div>
      <div
        style={{
          color: "var(--ink)",
          fontWeight: 600,
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        {t}
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {items.map((i, k) => (
          <li key={k} style={{ fontSize: 13, color: "var(--sub)" }}>
            {i}
          </li>
        ))}
      </ul>
    </div>
  )
}

function PackageVisual() {
  return (
    <div
      style={{
        position: "relative",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
        background: "var(--paper)",
        boxShadow: "0 1px 0 rgba(0,0,0,.02), 0 12px 24px -16px rgba(0,0,0,.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <GitBranch size={15} strokeWidth={1.5} style={{ color: "var(--violet)" }} />
        <span className="mono" style={{ fontSize: 12 }}>
          systemedu/projects
        </span>
        <span className="tag violet" style={{ marginLeft: "auto" }}>
          v1.4.2
        </span>
      </div>
      <div
        style={{
          fontSize: 18,
          letterSpacing: "-.02em",
          lineHeight: 1.2,
          fontWeight: 600,
        }}
      >
        purpleair-airquality-node
      </div>
      <div
        className="sub"
        style={{ marginTop: 4, marginBottom: 14, fontSize: 12.5 }}
      >
        EPA NowCast · Raspberry Pi · PMS5003
      </div>
      <div
        className="mono"
        style={{
          fontSize: 12,
          lineHeight: 1.8,
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 12px",
        }}
      >
        <div style={{ color: "var(--sub-2)" }}>├── README.md</div>
        <div style={{ color: "var(--sub-2)" }}>├── hardware/</div>
        <div style={{ color: "var(--sub-2)" }}>│   ├── BOM.csv</div>
        <div style={{ color: "var(--ink-2)" }}>│   └── enclosure.step</div>
        <div style={{ color: "var(--ink-2)" }}>├── firmware/pms5003_uart.py</div>
        <div style={{ color: "var(--ink-2)" }}>
          ├── calibration/epa_nowcast.py
        </div>
        <div style={{ color: "var(--violet)" }}>└── knowledge.tree.json</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Link
          href="/library/purpleair-airquality-node"
          className="btn btn-violet btn-sm"
          style={{ flex: 1, justifyContent: "center" }}
        >
          <GitFork size={13} strokeWidth={1.5} /> Fork this project
        </Link>
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 14,
          fontSize: 11,
          color: "var(--sub)",
          fontFamily: "var(--mono)",
        }}
      >
        <span>
          <Star
            size={11}
            strokeWidth={1.5}
            style={{ verticalAlign: -1, marginRight: 4 }}
          />
          ready
        </span>
        <span>
          <Users
            size={11}
            strokeWidth={1.5}
            style={{ verticalAlign: -1, marginRight: 4 }}
          />
          early access
        </span>
        <span>
          <CircleCheck
            size={11}
            strokeWidth={1.5}
            style={{ verticalAlign: -1, marginRight: 4 }}
          />
          v0.3.0
        </span>
      </div>
    </div>
  )
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
