"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Bot,
  CircleCheck,
  Cpu,
  GitBranch,
  Languages,
  Network,
  Rocket,
  Sparkles,
} from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"

// Public landing page — 瀑布流功能介绍, 突出天马行空的项目 / AI agent / 10 岁也能做。
// 设计: docs/superpowers/specs/2026-06-10-landing-page-redesign-design.md
// 手绘水彩科普书插画风 (public/landing/*.webp) + Industrial Atelier 暖纸色 UI。
// 双语: 首页自带局部语言切换 (useState, 不动全局 i18n)。

type Lang = "zh" | "en"

// ── 文案 (中英双份) ──────────────────────────────────────────────
const COPY = {
  zh: {
    eyebrow: "给 10 岁起步的造物者",
    heroTitle1: "造一个",
    heroTitleHi: "真东西",
    heroTitle2: "。",
    heroLine2pre: "一个 ",
    heroLine2hi: "AI agent",
    heroLine2post: " 全程陪你。",
    heroBody:
      "工业级的真实项目 — 火星探测车、会游的机器鱼、复活灭绝动物的声音。卡住了, AI agent 就地把超纲的部分讲清, 不打断你动手。",
    ctaBrowse: "浏览全部项目",
    ctaDash: "我的书架",
    ctaSignIn: "登录",
    stat1: "33 个天马行空的项目",
    stat2: "真硬件 · 真数据 · 真标准",
    stat3: "AI agent 随时教",
    valuesTitle: "为什么孩子能做成",
    streamTitle: "挑一个, 开始造",
    streamEyebrow: "项目库",
    comingSoon: "即将上线",
    live: "现在就能学",
    howEyebrow: "怎么运转",
    howTitle: "一个项目是怎么活起来的",
    agentEyebrow: "AI agent",
    agentTitle: "数学超纲了? agent 接住。",
    agentBody:
      "六年级的孩子做卫星轨道、做脑信号解码 — 数学一定会超纲。AI agent 不降低项目难度, 而是在你卡住的那一刻, 就地把那一小块知识讲清楚, 然后你继续造。它是随叫随到的私人导师, 不是替你做完的外包。",
    footTagline:
      "AI Agent 驱动的项目制学习平台。给 10–18 岁的造物者做工业级真实项目, AI 导师全程苏格拉底式陪伴。",
  },
  en: {
    eyebrow: "For builders starting at age 10",
    heroTitle1: "Build a ",
    heroTitleHi: "real thing",
    heroTitle2: ".",
    heroLine2pre: "An ",
    heroLine2hi: "AI agent",
    heroLine2post: " has your back.",
    heroBody:
      "Industry-grade real projects — a Mars rover, a swimming robotic fish, the resurrected sound of extinct animals. When you get stuck, the AI agent explains the part that's over your head, right where you are — without breaking your flow.",
    ctaBrowse: "Browse all projects",
    ctaDash: "My shelf",
    ctaSignIn: "Sign in",
    stat1: "33 wildly ambitious projects",
    stat2: "Real hardware · real data · real standards",
    stat3: "AI agent always on call",
    valuesTitle: "Why a kid can pull this off",
    streamTitle: "Pick one, start building",
    streamEyebrow: "Project library",
    comingSoon: "Coming soon",
    live: "Learn it now",
    howEyebrow: "How it works",
    howTitle: "How a project comes to life",
    agentEyebrow: "AI agent",
    agentTitle: "Math over your head? The agent catches you.",
    agentBody:
      "A sixth-grader doing satellite orbits or decoding brain signals will hit math that's over their head — guaranteed. The AI agent doesn't dumb the project down. It explains that one small piece, right at the moment you're stuck, then you keep building. A private tutor on call, not an outsourcer that does it for you.",
    footTagline:
      "An AI-agent-driven, project-based learning platform. Industry-grade real projects for builders aged 10–18, with a Socratic AI tutor by your side.",
  },
} as const

// ── 策展项目 (从 systemeduidea 挑) ──────────────────────────────
type Project = {
  slug: string
  domain: string
  domainClass: string
  age: string
  difficulty: number
  live: boolean
  img: string
  ratio: string // 图片宽高比, 差异化制造瀑布错落
  title: { zh: string; en: string }
  hook: { zh: string; en: string }
}

const PROJECTS: Project[] = [
  {
    slug: "mars-analog-rover",
    domain: "Aerospace",
    domainClass: "aerospace",
    age: "10–12",
    difficulty: 4,
    live: false,
    img: "/landing/mars-rover.webp",
    ratio: "3 / 2", // 火星车横构图
    title: {
      zh: "用 NASA 影像训练的火星探测车",
      en: "A Mars rover trained on NASA imagery",
    },
    hook: {
      zh: "用 NASA HiRISE 真实火星影像, 训练你自己的越野探测车。",
      en: "Train your own off-road rover on real NASA HiRISE Mars imagery.",
    },
  },
  {
    slug: "extinct-species-soundscape",
    domain: "CS",
    domainClass: "computing",
    age: "10–12",
    difficulty: 4,
    live: false,
    img: "/landing/extinct-sound.webp",
    ratio: "4 / 5", // 渡渡鸟竖构图
    title: {
      zh: "复活灭绝物种的声音",
      en: "Bring extinct species' sounds back",
    },
    hook: {
      zh: "用 AI 从骨骼与近亲, 重建一只已灭绝动物可能的叫声。",
      en: "Use AI to reconstruct how an extinct animal might have sounded.",
    },
  },
  {
    slug: "bioinspired-sofi-fish",
    domain: "Robotics",
    domainClass: "robotics",
    age: "13–15",
    difficulty: 5,
    live: false,
    img: "/landing/robot-fish.webp",
    ratio: "4 / 3", // 机器鱼横构图
    title: {
      zh: "仿生软体机器鱼",
      en: "A bio-inspired soft robotic fish",
    },
    hook: {
      zh: "造一条会游的软体机器鱼, 潜进池塘做真实生态调查。",
      en: "Build a swimming soft robotic fish to survey a real pond ecosystem.",
    },
  },
]

// ── 能力卡 (穿插在瀑布流里) ─────────────────────────────────────
type Capability = {
  icon: React.ReactNode
  tint: string
  soft: string
  line: string
  title: { zh: string; en: string }
  body: { zh: string; en: string }
}

const CAPABILITIES: Capability[] = [
  {
    icon: <Bot size={18} strokeWidth={1.5} />,
    tint: "var(--primary)",
    soft: "var(--primary-soft)",
    line: "var(--primary-line)",
    title: { zh: "AI agent 随时教", en: "AI agent, always on call" },
    body: {
      zh: "卡住、报错、数学超纲 — agent 就地讲清那一块, 你继续造。",
      en: "Stuck, an error, math over your head — the agent explains that piece on the spot.",
    },
  },
  {
    icon: <Cpu size={18} strokeWidth={1.5} />,
    tint: "var(--climate)",
    soft: "var(--climate-soft)",
    line: "var(--climate-line)",
    title: { zh: "真硬件 · 真数据 · 真标准", en: "Real hardware, data & standards" },
    body: {
      zh: "真实传感器、NASA / EPA 级数据集、学界标准库 — 不是玩具。",
      en: "Real sensors, NASA / EPA-grade datasets, academic-standard libraries — not toys.",
    },
  },
  {
    icon: <Network size={18} strokeWidth={1.5} />,
    tint: "var(--robotics)",
    soft: "var(--robotics-soft)",
    line: "var(--robotics-line)",
    title: { zh: "像树一样长的知识", en: "Knowledge that grows like a tree" },
    body: {
      zh: "知识树 DAG: 你需要什么它解锁什么, 不是从头排到尾的线性课程。",
      en: "A knowledge-tree DAG: it unlocks what you need, not a linear course front to back.",
    },
  },
]

export default function Homepage() {
  const { loggedIn, hydrate } = useAuthStore()
  const [lang, setLang] = useState<Lang>("zh")

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const t = COPY[lang]

  // 瀑布流条目: 错落穿插, 刻意打破 proj/cap 等高配对 → 列高不齐, 出真瀑布感。
  // 顺序: proj, cap, proj, proj, cap, cap (3 列下首屏每列起手不同类型)
  const streamItems = useMemo<
    Array<{ kind: "project"; data: Project } | { kind: "capability"; data: Capability }>
  >(() => {
    const P = PROJECTS
    const C = CAPABILITIES
    return [
      { kind: "project", data: P[0] },
      { kind: "capability", data: C[0] },
      { kind: "project", data: P[1] },
      { kind: "project", data: P[2] },
      { kind: "capability", data: C[1] },
      { kind: "capability", data: C[2] },
    ]
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
            "linear-gradient(135deg, #FFFFFF 0%, #FBF8F1 55%, #F4ECDC 100%)",
          padding: "44px 48px",
          marginBottom: 20,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* 语言切换 */}
        <div style={{ position: "absolute", top: 18, right: 22, zIndex: 3 }}>
          <LangToggle lang={lang} onChange={setLang} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 1fr",
            gap: 40,
            alignItems: "center",
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 22 }}>
              <span className="dot" /> {t.eyebrow}
            </div>
            <h1 className="display" style={{ maxWidth: 640, fontSize: 52 }}>
              {t.heroTitle1}
              <span style={{ color: "var(--primary)" }}>{t.heroTitleHi}</span>
              {t.heroTitle2}
              <br />
              {t.heroLine2pre}
              <span style={{ color: "var(--aerospace)" }}>{t.heroLine2hi}</span>
              {t.heroLine2post}
            </h1>
            <p
              style={{
                maxWidth: 520,
                marginTop: 20,
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--sub)",
              }}
            >
              {t.heroBody}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
              <Link href="/library" className="btn btn-violet btn-lg">
                {t.ctaBrowse}
                <ArrowRight size={15} strokeWidth={1.5} />
              </Link>
              {loggedIn ? (
                <Link href="/home" className="btn btn-ghost btn-lg">
                  {t.ctaDash}
                </Link>
              ) : (
                <Link href="/login" className="btn btn-ghost btn-lg">
                  {t.ctaSignIn}
                </Link>
              )}
            </div>

            {/* mono 数字条 */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px 22px",
                marginTop: 30,
                fontFamily: "var(--mono)",
                fontSize: 11.5,
                color: "var(--sub)",
              }}
            >
              <HeroStat icon={<Sparkles size={12} strokeWidth={1.5} />} text={t.stat1} />
              <HeroStat icon={<Cpu size={12} strokeWidth={1.5} />} text={t.stat2} />
              <HeroStat icon={<Bot size={12} strokeWidth={1.5} />} text={t.stat3} />
            </div>
          </div>

          {/* 英雄插画 */}
          <div
            style={{
              position: "relative",
              borderRadius: 12,
              overflow: "hidden",
              aspectRatio: "16 / 10",
              border: "1px solid var(--border)",
              background: "var(--paper)",
              boxShadow: "0 12px 28px -18px rgba(0,0,0,.18)",
            }}
          >
            <Image
              src="/landing/hero.webp"
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 640px"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </section>

      {/* ── 价值标题 ── */}
      <SectionRule eyebrow={t.streamEyebrow} title={t.streamTitle} />

      {/* ── 主体瀑布流 (CSS columns) ── */}
      <div
        style={{
          marginTop: 20,
          columnGap: 16,
        }}
        className="masonry"
      >
        {streamItems.map((it, idx) =>
          it.kind === "project" ? (
            <ProjectCard key={`p-${it.data.slug}`} project={it.data} lang={lang} t={t} />
          ) : (
            <CapabilityCard key={`c-${idx}`} cap={it.data} lang={lang} />
          ),
        )}
      </div>

      {/* ── How it works ── */}
      <section style={{ marginTop: 52 }}>
        <SectionRule eyebrow={t.howEyebrow} title={t.howTitle} />
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
            icon={<Sparkles size={18} strokeWidth={1.5} />}
            t={lang === "zh" ? "挑一个项目" : "Pick a project"}
            body={
              lang === "zh"
                ? "从项目库选一个让你心动的, 看清它的目标和清单。"
                : "Choose one that excites you; see its goal and parts list."
            }
          />
          <Step
            n="02"
            icon={<Bot size={18} strokeWidth={1.5} />}
            t={lang === "zh" ? "跟着学 (AI 陪)" : "Learn (with AI)"}
            body={
              lang === "zh"
                ? "短模块一步步来, 卡住了 AI agent 随时把难点讲清。"
                : "Short modules, step by step; the AI agent unblocks the hard parts."
            }
          />
          <Step
            n="03"
            icon={<Network size={18} strokeWidth={1.5} />}
            t={lang === "zh" ? "动手造" : "Build it"}
            body={
              lang === "zh"
                ? "焊接、烧录、接线、组装 — 真硬件, 真失败, 真修好。"
                : "Solder, flash, wire, assemble — real hardware, real fixes."
            }
          />
          <Step
            n="04"
            icon={<Rocket size={18} strokeWidth={1.5} />}
            t={lang === "zh" ? "发布作品" : "Ship it"}
            body={
              lang === "zh"
                ? "把成品发布出来, 提交真实数据, 让世界看到你造的东西。"
                : "Publish your build, submit real data, show the world what you made."
            }
            last
          />
        </div>
      </section>

      {/* ── AI agent 聚焦带 ── */}
      <section
        style={{
          marginTop: 52,
          display: "grid",
          gridTemplateColumns: "1fr 1.15fr",
          gap: 36,
          alignItems: "center",
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #FFFFFF 0%, #FBF8F1 100%)",
          padding: "8px 8px 8px 40px",
        }}
      >
        <div style={{ padding: "28px 0" }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            <span className="dot" /> {t.agentEyebrow}
          </div>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-.025em",
              lineHeight: 1.2,
              marginBottom: 14,
            }}
          >
            {t.agentTitle}
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--sub)", maxWidth: 460 }}>
            {t.agentBody}
          </p>
        </div>
        <div
          style={{
            position: "relative",
            aspectRatio: "16 / 9",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--paper)",
          }}
        >
          <Image
            src="/landing/agent.webp"
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 720px"
            style={{ objectFit: "cover" }}
          />
        </div>
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
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>SystemEdu</span>
          </div>
          <p style={{ marginTop: 10, maxWidth: 340, color: "var(--sub)" }}>
            {t.footTagline}
          </p>
          <div className="mono" style={{ marginTop: 14, color: "var(--sub-2)", fontSize: 11 }}>
            © 2026 SystemEdu Labs
          </div>
        </div>
        <FootCol
          t={lang === "zh" ? "项目库" : "Library"}
          items={["Aerospace", "Robotics", "Bioscience", "Climate"]}
        />
        <FootCol
          t={lang === "zh" ? "平台" : "Platform"}
          items={
            lang === "zh"
              ? ["知识树", "AI 导师", "硬件套件"]
              : ["Knowledge tree", "AI tutor", "Hardware kits"]
          }
        />
        <FootCol
          t={lang === "zh" ? "关于" : "Company"}
          items={lang === "zh" ? ["关于我们", "开源", "加入我们"] : ["About", "Open source", "Careers"]}
        />
      </footer>

      {/* masonry 响应式 */}
      <style jsx>{`
        .masonry {
          column-count: 3;
        }
        @media (max-width: 1000px) {
          .masonry {
            column-count: 2;
          }
        }
        @media (max-width: 640px) {
          .masonry {
            column-count: 1;
          }
        }
      `}</style>
    </main>
  )
}

// ── 子组件 ──────────────────────────────────────────────────────

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        border: "1px solid var(--border-2)",
        borderRadius: 999,
        background: "rgba(255,255,255,.7)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Languages size={13} strokeWidth={1.5} style={{ color: "var(--sub-2)", margin: "0 4px" }} />
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          style={{
            border: 0,
            borderRadius: 999,
            padding: "4px 11px",
            fontFamily: "var(--mono)",
            fontSize: 11.5,
            fontWeight: 500,
            background: lang === l ? "var(--ink)" : "transparent",
            color: lang === l ? "#fff" : "var(--sub)",
            transition: "background var(--t-fast), color var(--t-fast)",
          }}
        >
          {l === "zh" ? "中" : "EN"}
        </button>
      ))}
    </div>
  )
}

function HeroStat({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ color: "var(--primary)" }}>{icon}</span>
      {text}
    </span>
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
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.025em" }}>{title}</h2>
      </div>
      {right}
    </div>
  )
}

type Copy = (typeof COPY)[Lang]

function ProjectCard({
  project,
  lang,
  t,
}: {
  project: Project
  lang: Lang
  t: Copy
}) {
  const inner = (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        breakInside: "avoid",
        marginBottom: 16,
        cursor: project.live ? "pointer" : "default",
        transition: "box-shadow var(--t-med), transform var(--t-med)",
      }}
    >
      <div style={{ position: "relative", aspectRatio: project.ratio, background: "var(--paper-2)" }}>
        <Image
          src={project.img}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          style={{ objectFit: "cover" }}
        />
        {/* 状态角标 */}
        <span
          className="tag"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: project.live ? "var(--emerald-soft)" : "rgba(255,255,255,.85)",
            borderColor: project.live ? "var(--emerald)" : "var(--border-2)",
            color: project.live ? "var(--bio-ink)" : "var(--sub)",
            backdropFilter: "blur(6px)",
          }}
        >
          {project.live ? (
            <>
              <CircleCheck size={11} strokeWidth={1.8} /> {t.live}
            </>
          ) : (
            t.comingSoon
          )}
        </span>
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className={`tag ${project.domainClass}`}>{project.domain}</span>
          <span className="tag">{project.age}</span>
          <span className="tag" aria-label={`difficulty ${project.difficulty} of 5`}>
            <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background:
                      i < project.difficulty ? "var(--primary)" : "var(--border-2)",
                  }}
                />
              ))}
            </span>
          </span>
        </div>
        <h3 style={{ fontSize: 17, lineHeight: 1.35, fontWeight: 600, letterSpacing: "-.015em" }}>
          {project.title[lang]}
        </h3>
        <p className="body" style={{ fontSize: 13.5, color: "var(--sub)" }}>
          {project.hook[lang]}
        </p>
      </div>
    </div>
  )

  if (project.live) {
    return (
      <Link
        href={`/library/${encodeURIComponent(project.slug)}`}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        {inner}
      </Link>
    )
  }
  return inner
}

function CapabilityCard({ cap, lang }: { cap: Capability; lang: Lang }) {
  return (
    <div
      className="card"
      style={{
        padding: 22,
        breakInside: "avoid",
        marginBottom: 16,
        background: cap.soft,
        borderColor: cap.line,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "rgba(255,255,255,.6)",
          border: `1px solid ${cap.line}`,
          display: "grid",
          placeItems: "center",
          color: cap.tint,
        }}
      >
        {cap.icon}
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.015em", color: "var(--ink)" }}>
        {cap.title[lang]}
      </h3>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" }}>{cap.body[lang]}</p>
    </div>
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
        minHeight: 196,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

function FootCol({ t, items }: { t: string; items: string[] }) {
  return (
    <div>
      <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{t}</div>
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
