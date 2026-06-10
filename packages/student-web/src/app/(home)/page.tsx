"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowRight,
  Bot,
  CircleCheck,
  Cpu,
  Languages,
  Network,
  Rocket,
  Sparkles,
} from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"

// Public landing page — GitHub 式长滚动营销页: Hero + 逐节功能展示。
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
    agentMore: "了解 AI 导师",
    // 真硬件节
    hwEyebrow: "真实工程",
    hwTitle: "真硬件 · 真数据 · 真标准。",
    hwBody:
      "不是模拟、不是玩具。你用真实的传感器和电路, 接 NASA、EPA、GBIF 级别的公开数据集, 跑学界都在用的标准库。做出来的东西, 是本科论文级别的真工作。",
    hwMore: "看真实数据源",
    // 知识树节
    treeEyebrow: "知识树",
    treeTitle: "像树一样长的知识。",
    treeBody:
      "不是从第一课排到最后一课的线性课程。知识树是一张 DAG: 你当前的项目需要哪块知识, 它就解锁哪块。你永远在为眼前要造的东西学习, 而不是为了考试囤积。",
    treeMore: "了解知识树",
    // 项目展示节
    projEyebrow: "项目库",
    projTitle: "天马行空, 但都是真的。",
    projBody: "从 33 个工业级项目里挑一个让你心动的, 开始造。",
    // 大 CTA 节
    ctaTitle: "准备好造点真东西了吗?",
    ctaBody: "免费注册, 把第一个项目 Pull 到你的书架。AI agent 全程陪你。",
    ctaStart: "免费开始",
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
    agentMore: "Meet the AI tutor",
    hwEyebrow: "Real engineering",
    hwTitle: "Real hardware. Real data. Real standards.",
    hwBody:
      "Not simulations, not toys. You use real sensors and circuits, plug into NASA / EPA / GBIF-grade open datasets, and run the same standard libraries academics use. What you build is genuine undergraduate-thesis-level work.",
    hwMore: "See the data sources",
    treeEyebrow: "Knowledge tree",
    treeTitle: "Knowledge that grows like a tree.",
    treeBody:
      "Not a course that runs lesson 1 to lesson N. The knowledge tree is a DAG: it unlocks exactly the piece your current project needs. You always learn for the thing in front of you, never hoarding for an exam.",
    treeMore: "How the tree works",
    projEyebrow: "Project library",
    projTitle: "Wildly ambitious — and all real.",
    projBody: "Pick one of 33 industry-grade projects that excites you, and start building.",
    ctaTitle: "Ready to build a real thing?",
    ctaBody: "Sign up free and pull your first project onto your shelf. The AI agent is with you the whole way.",
    ctaStart: "Start free",
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

type Copy = (typeof COPY)[Lang]

export default function Homepage() {
  const { loggedIn, hydrate } = useAuthStore()
  const [lang, setLang] = useState<Lang>("zh")

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const t = COPY[lang]

  return (
    <main style={{ width: "100%" }}>
      {/* ── ① Hero ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 32px 72px", position: "relative" }}>
        <div style={{ position: "absolute", top: 20, right: 32, zIndex: 3 }}>
          <LangToggle lang={lang} onChange={setLang} />
        </div>

        <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="eyebrow" style={{ marginBottom: 22, justifyContent: "center" }}>
            <span className="dot" /> {t.eyebrow}
          </div>
          <h1
            className="display"
            style={{ fontSize: 60, lineHeight: 1.04, margin: "0 auto" }}
          >
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
              maxWidth: 560,
              margin: "22px auto 0",
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--sub)",
            }}
          >
            {t.heroBody}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 30, justifyContent: "center" }}>
            {loggedIn ? (
              <Link href="/home" className="btn btn-violet btn-lg">
                {t.ctaDash}
                <ArrowRight size={15} strokeWidth={1.5} />
              </Link>
            ) : (
              <Link href="/register" className="btn btn-violet btn-lg">
                {t.ctaStart}
                <ArrowRight size={15} strokeWidth={1.5} />
              </Link>
            )}
            <Link href="/library" className="btn btn-ghost btn-lg">
              {t.ctaBrowse}
            </Link>
          </div>
        </div>

        {/* hero 大插画 */}
        <div
          style={{
            position: "relative",
            maxWidth: 900,
            margin: "48px auto 0",
            aspectRatio: "16 / 10",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--paper)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <Image
            src="/landing/hero.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 940px) 100vw, 900px"
            style={{ objectFit: "cover" }}
          />
        </div>

        {/* 信任条 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px 28px",
            justifyContent: "center",
            marginTop: 34,
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--sub)",
          }}
        >
          <TrustItem icon={<Sparkles size={13} strokeWidth={1.5} />} text={t.stat1} />
          <TrustItem icon={<Cpu size={13} strokeWidth={1.5} />} text={t.stat2} />
          <TrustItem icon={<Bot size={13} strokeWidth={1.5} />} text={t.stat3} />
        </div>
      </section>

      {/* ── ② AI agent 节 (左文右图) ── */}
      <FeatureSection
        eyebrow={t.agentEyebrow}
        title={t.agentTitle}
        body={t.agentBody}
        more={t.agentMore}
        img="/landing/agent.webp"
        ratio="16 / 9"
        imgSide="right"
        accent="var(--primary)"
        icon={<Bot size={18} strokeWidth={1.5} />}
      />

      {/* ── ③ 真硬件真数据 节 (右文左图) ── */}
      <FeatureSection
        eyebrow={t.hwEyebrow}
        title={t.hwTitle}
        body={t.hwBody}
        more={t.hwMore}
        img="/landing/mars-rover.webp"
        ratio="3 / 2"
        imgSide="left"
        accent="var(--climate)"
        icon={<Cpu size={18} strokeWidth={1.5} />}
        tinted
      />

      {/* ── ④ 知识树 节 (左文右图) ── */}
      <FeatureSection
        eyebrow={t.treeEyebrow}
        title={t.treeTitle}
        body={t.treeBody}
        more={t.treeMore}
        img="/landing/robot-fish.webp"
        ratio="4 / 3"
        imgSide="right"
        accent="var(--robotics)"
        icon={<Network size={18} strokeWidth={1.5} />}
      />

      {/* ── ⑤ 项目展示 节 ── */}
      <section style={{ background: "var(--paper-2)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 32px" }}>
          <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 40px" }}>
            <div className="eyebrow" style={{ marginBottom: 12, justifyContent: "center" }}>
              <span className="dot" /> {t.projEyebrow}
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.15 }}>
              {t.projTitle}
            </h2>
            <p style={{ marginTop: 14, fontSize: 15, color: "var(--sub)", lineHeight: 1.6 }}>
              {t.projBody}
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 18,
            }}
            className="proj-grid"
          >
            {PROJECTS.map((p) => (
              <ProjectCard key={p.slug} project={p} lang={lang} t={t} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <Link href="/library" className="btn btn-ghost btn-lg">
              {t.ctaBrowse}
              <ArrowRight size={15} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── ⑥ How it works 节 ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 32px" }}>
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 36px" }}>
          <div className="eyebrow" style={{ marginBottom: 12, justifyContent: "center" }}>
            <span className="dot" /> {t.howEyebrow}
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.15 }}>
            {t.howTitle}
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            border: "1px solid var(--border)",
            borderRadius: 14,
            overflow: "hidden",
            background: "var(--card)",
          }}
          className="how-grid"
        >
          <Step n="01" icon={<Sparkles size={18} strokeWidth={1.5} />}
            t={lang === "zh" ? "挑一个项目" : "Pick a project"}
            body={lang === "zh" ? "从项目库选一个让你心动的, 看清它的目标和清单。" : "Choose one that excites you; see its goal and parts list."} />
          <Step n="02" icon={<Bot size={18} strokeWidth={1.5} />}
            t={lang === "zh" ? "跟着学 (AI 陪)" : "Learn (with AI)"}
            body={lang === "zh" ? "短模块一步步来, 卡住了 AI agent 随时把难点讲清。" : "Short modules, step by step; the AI agent unblocks the hard parts."} />
          <Step n="03" icon={<Network size={18} strokeWidth={1.5} />}
            t={lang === "zh" ? "动手造" : "Build it"}
            body={lang === "zh" ? "焊接、烧录、接线、组装 — 真硬件, 真失败, 真修好。" : "Solder, flash, wire, assemble — real hardware, real fixes."} />
          <Step n="04" icon={<Rocket size={18} strokeWidth={1.5} />}
            t={lang === "zh" ? "发布作品" : "Ship it"}
            body={lang === "zh" ? "把成品发布出来, 提交真实数据, 让世界看到你造的东西。" : "Publish your build, submit real data, show the world what you made."}
            last />
        </div>
      </section>

      {/* ── ⑦ 大 CTA 节 ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 32px 80px" }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 20,
            border: "1px solid var(--primary-line)",
            background: "linear-gradient(135deg, #FFFFFF 0%, #FBF1E9 60%, #F4D9C9 100%)",
            padding: "56px 48px",
            textAlign: "center",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <h2 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.12, maxWidth: 640, margin: "0 auto" }}>
            {t.ctaTitle}
          </h2>
          <p style={{ marginTop: 16, fontSize: 15.5, color: "var(--sub)", maxWidth: 520, margin: "16px auto 0", lineHeight: 1.6 }}>
            {t.ctaBody}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 30, justifyContent: "center" }}>
            <Link href={loggedIn ? "/home" : "/register"} className="btn btn-violet btn-lg">
              {loggedIn ? t.ctaDash : t.ctaStart}
              <ArrowRight size={15} strokeWidth={1.5} />
            </Link>
            <Link href="/library" className="btn btn-ghost btn-lg">
              {t.ctaBrowse}
            </Link>
          </div>
        </div>
      </section>

      {/* ── ⑧ Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "40px 32px 48px",
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 32,
            color: "var(--sub)",
            fontSize: 13,
          }}
          className="foot-grid"
        >
          <div>
            <div className="brand" style={{ marginBottom: 10 }}>
              <span className="brand-mark"><span>SE</span></span>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>SystemEdu</span>
            </div>
            <p style={{ marginTop: 10, maxWidth: 340, color: "var(--sub)" }}>{t.footTagline}</p>
            <div className="mono" style={{ marginTop: 14, color: "var(--sub-2)", fontSize: 11 }}>
              © 2026 SystemEdu Labs
            </div>
          </div>
          <FootCol t={lang === "zh" ? "项目库" : "Library"} items={["Aerospace", "Robotics", "Bioscience", "Climate"]} />
          <FootCol t={lang === "zh" ? "平台" : "Platform"} items={lang === "zh" ? ["知识树", "AI 导师", "硬件套件"] : ["Knowledge tree", "AI tutor", "Hardware kits"]} />
          <FootCol t={lang === "zh" ? "关于" : "Company"} items={lang === "zh" ? ["关于我们", "开源", "加入我们"] : ["About", "Open source", "Careers"]} />
        </div>
      </footer>

      {/* 响应式 */}
      <style jsx>{`
        @media (max-width: 820px) {
          .proj-grid { grid-template-columns: 1fr !important; }
          .how-grid { grid-template-columns: 1fr 1fr !important; }
          .foot-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </main>
  )
}

// ── 子组件 ──────────────────────────────────────────────────────

function FeatureSection({
  eyebrow,
  title,
  body,
  more,
  img,
  ratio,
  imgSide,
  accent,
  icon,
  tinted,
}: {
  eyebrow: string
  title: string
  body: string
  more: string
  img: string
  ratio: string
  imgSide: "left" | "right"
  accent: string
  icon: React.ReactNode
  tinted?: boolean
}) {
  const text = (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "var(--card)",
          border: "1px solid var(--border)",
          display: "grid",
          placeItems: "center",
          color: accent,
          marginBottom: 18,
        }}
      >
        {icon}
      </div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        <span className="dot" style={{ background: accent }} /> {eyebrow}
      </div>
      <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.15, marginBottom: 16 }}>
        {title}
      </h2>
      <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--sub)", maxWidth: 460 }}>{body}</p>
      <div style={{ marginTop: 22 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 14,
            fontWeight: 500,
            color: accent,
          }}
        >
          {more}
          <ArrowRight size={15} strokeWidth={1.8} />
        </span>
      </div>
    </div>
  )

  const picture = (
    <div
      style={{
        position: "relative",
        aspectRatio: ratio,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--paper)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <Image src={img} alt="" fill sizes="(max-width: 820px) 100vw, 540px" style={{ objectFit: "cover" }} />
    </div>
  )

  return (
    <section style={{ background: tinted ? "var(--paper-2)" : "transparent" }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "72px 32px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 56,
          alignItems: "center",
        }}
        className="feat-grid"
      >
        {imgSide === "left" ? (
          <>
            {picture}
            {text}
          </>
        ) : (
          <>
            {text}
            {picture}
          </>
        )}
      </div>
      <style jsx>{`
        @media (max-width: 820px) {
          .feat-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
        }
      `}</style>
    </section>
  )
}

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

function TrustItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ color: "var(--primary)" }}>{icon}</span>
      {text}
    </span>
  )
}

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
        height: "100%",
        cursor: project.live ? "pointer" : "default",
      }}
    >
      <div style={{ position: "relative", aspectRatio: "4 / 3", background: "var(--paper-2)" }}>
        <Image src={project.img} alt="" fill sizes="(max-width: 820px) 100vw, 340px" style={{ objectFit: "cover" }} />
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
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>
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
                    background: i < project.difficulty ? "var(--primary)" : "var(--border-2)",
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
      <Link href={`/library/${encodeURIComponent(project.slug)}`} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
        {inner}
      </Link>
    )
  }
  return inner
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
        padding: 24,
        borderRight: last ? "0" : "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 200,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="mono" style={{ color: "var(--sub-2)" }}>{n}</span>
        <span style={{ color: "var(--violet)" }}>{icon}</span>
      </div>
      <h4 className="h3" style={{ fontSize: 15 }}>{t}</h4>
      <p className="body" style={{ fontSize: 13.5 }}>{body}</p>
    </div>
  )
}

function FootCol({ t, items }: { t: string; items: string[] }) {
  return (
    <div>
      <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{t}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 7 }}>
        {items.map((i, k) => (
          <li key={k} style={{ fontSize: 13, color: "var(--sub)" }}>{i}</li>
        ))}
      </ul>
    </div>
  )
}
