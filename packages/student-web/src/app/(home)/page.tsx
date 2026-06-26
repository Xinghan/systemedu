"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect } from "react"
import {
  ArrowRight,
  Bot,
  Cpu,
  Network,
  Sparkles,
} from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useLocale } from "@/lib/i18n/use-t"
import { useLocaleStore } from "@/lib/i18n/store"

// Public landing page — 长滚动营销页, 从精神层面切节: 好奇心 / 科技感 / 陪伴 / 记忆 / 路径。
// 设计: docs/superpowers/specs/2026-06-10-landing-page-redesign-design.md
// 手绘水彩科普书插画风 (public/landing/*.webp), 图片 mask 渐隐与暖纸色背景融为一体。
// 项目只在"好奇心"节用一行例子带过; 双语首页局部切换 (useState, 不动全局 i18n)。

type Lang = "zh" | "en"

// 四边羽化遮罩: 让插画无硬边地溶进暖纸色背景。
// 实现: 水平方向 linear mask ∩ 垂直方向 linear mask (maskComposite intersect),
// 四条边都从实色渐隐到透明; 朝文字侧 (towards) 那条边羽化范围更大, 与文字区衔接。
function edgeFadeMask(towards?: "left" | "right"): React.CSSProperties {
  // 朝文字侧更早淡出 (该侧 35% 起羽化), 其余三边 12% 边距起羽化
  const left = towards === "right" ? "35%" : "12%"
  const right = towards === "left" ? "35%" : "12%"
  const horiz = `linear-gradient(to right, transparent 0%, #000 ${left}, #000 calc(100% - ${right}), transparent 100%)`
  const vert = `linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%)`
  const mask = `${horiz}, ${vert}`
  return {
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskComposite: "source-in", // Safari 旧语法
    maskComposite: "intersect",
  } as React.CSSProperties
}

// ── 文案 (中英双份) ──────────────────────────────────────────────
const COPY = {
  zh: {
    eyebrow: "给 10 岁起步的造物者",
    heroTitle1: "他们说，这是",
    heroTitleHi: "大人的工程",
    heroTitle2: "。",
    heroLine2pre: "",
    heroLine2hi: "AI",
    heroLine2post: " 说，从 10 岁开始。",
    heroBody:
      "真火星车、会游的机器鱼、复活灭绝动物的声音 — 你亲手造。卡住时, AI agent 就地把超纲的那一块讲清, 不替你动手。",
    ctaBrowse: "浏览全部项目",
    ctaDash: "我的书架",
    ctaSignIn: "登录",
    stat1: "33 个天马行空的项目",
    stat2: "真硬件 · 真数据 · 真标准",
    stat3: "AI agent 随时教",
    comingSoon: "即将上线",
    live: "现在就能学",

    // ① 好奇心
    curiEyebrow: "好奇心",
    curiTitle: "那些你以为只有大人能碰的东西。",
    curiBody:
      "脑波控制游戏、给地球防御小行星、复活一只灭绝动物的叫声 — 这些不是科普视频里看看而已的东西, 而是你亲手从零做出来的真项目。好奇心有多大, 能造的就有多大。",
    curiMore: "看看全部 33 个项目",

    // ② 科技感
    hwEyebrow: "科技感",
    hwTitle: "真硬件 · 真数据 · 真标准。",
    hwBody:
      "不是模拟、不是玩具。你用真实的传感器和电路, 接 NASA、EPA、GBIF 级别的公开数据集, 跑学界都在用的标准库。做出来的东西, 是本科论文级别的真工作。",
    hwMore: "看真实数据源",

    // ③ 陪伴 (AI agent tutor)
    agentEyebrow: "陪伴",
    agentTitle: "永远有人接住你。",
    agentBody:
      "六年级的孩子做卫星轨道、做脑信号解码 — 数学一定会超纲。AI agent 导师不降低难度, 而是在你卡住的那一刻, 就地把那一小块讲清, 然后你继续造。随叫随到的私人导师, 不是替你做完的外包。",
    agentMore: "了解 AI 导师",

    // ④ 记忆 (memory)
    memEyebrow: "记忆",
    memTitle: "它记得你走过的每一步。",
    memBody:
      "你上周焊过的电路、卡过的那道公式、做成的那个小东西 — AI 都记得。它认得你, 接得上你, 不会每次都从头问起。你的学习是一条连续生长的线, 不是一次次断片。",
    memMore: "了解记忆系统",

    // ⑤ 路径 (知识树)
    treeEyebrow: "路径",
    treeTitle: "像树一样长出来的知识。",
    treeBody:
      "不是从第一课排到最后一课的线性课程。知识树是一张 DAG: 你当前的项目需要哪块知识, 它就解锁哪块。你永远在为眼前要造的东西学习, 而不是为了考试囤积。",
    treeMore: "了解知识树",

    // 项目一行例子 (好奇心节内)
    projEyebrow: "项目库",
    projExamples: "一行例子, 还有 30 个在库里",

    // How / CTA
    howEyebrow: "怎么运转",
    howTitle: "一个项目是怎么活起来的",
    ctaTitle: "准备好造点真东西了吗?",
    ctaBody: "免费注册, 把第一个项目 Pull 到你的书架。AI agent 全程陪你。",
    ctaStart: "免费开始",
    footTagline:
      "AI Agent 驱动的项目制学习平台。给 10–18 岁的造物者做工业级真实项目, AI 导师全程苏格拉底式陪伴。",
  },
  en: {
    eyebrow: "For builders starting at age 10",
    heroTitle1: "They call it ",
    heroTitleHi: "grown-up engineering",
    heroTitle2: ".",
    heroLine2pre: "",
    heroLine2hi: "AI",
    heroLine2post: " says: start at 10.",
    heroBody:
      "A real Mars rover, a swimming robotic fish, the resurrected sound of extinct animals — built by your own hands. When you get stuck, the AI agent explains the over-your-head part right there, without doing it for you.",
    ctaBrowse: "Browse all projects",
    ctaDash: "My shelf",
    ctaSignIn: "Sign in",
    stat1: "33 wildly ambitious projects",
    stat2: "Real hardware · real data · real standards",
    stat3: "AI agent always on call",
    comingSoon: "Coming soon",
    live: "Learn it now",

    curiEyebrow: "Curiosity",
    curiTitle: "The stuff you thought only grown-ups could touch.",
    curiBody:
      "Control a game with your brainwaves, defend Earth from asteroids, bring an extinct animal's call back to life — not videos you watch, but real projects you build from scratch with your own hands. How far you go is how far your curiosity reaches.",
    curiMore: "See all 33 projects",

    hwEyebrow: "Real tech",
    hwTitle: "Real hardware. Real data. Real standards.",
    hwBody:
      "Not simulations, not toys. You use real sensors and circuits, plug into NASA / EPA / GBIF-grade open datasets, and run the same standard libraries academics use. What you build is genuine undergraduate-thesis-level work.",
    hwMore: "See the data sources",

    agentEyebrow: "Always with you",
    agentTitle: "Someone always catches you.",
    agentBody:
      "A sixth-grader doing satellite orbits or brain signals will hit math over their head — guaranteed. The AI tutor doesn't dumb things down. It explains that one small piece the moment you're stuck, then you keep building. A private tutor on call, not an outsourcer.",
    agentMore: "Meet the AI tutor",

    memEyebrow: "Memory",
    memTitle: "It remembers every step you've taken.",
    memBody:
      "The circuit you soldered last week, the equation that stumped you, the little thing you finished — the AI remembers it all. It knows you, picks up where you left off, never starts from zero. Your learning is one continuous, growing thread.",
    memMore: "How memory works",

    treeEyebrow: "Your path",
    treeTitle: "Knowledge that grows like a tree.",
    treeBody:
      "Not a course that runs lesson 1 to lesson N. The knowledge tree is a DAG: it unlocks exactly the piece your current project needs. You always learn for the thing in front of you, never hoarding for an exam.",
    treeMore: "How the tree works",

    projEyebrow: "Project library",
    projExamples: "A taste — 30 more in the library",

    howEyebrow: "How it works",
    howTitle: "How a project comes to life",
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

// How 节四阶段文字标签 (对齐流程大图 how-v1.webp 里的四个阶段)
const HOW_STEPS: { title: { zh: string; en: string }; body: { zh: string; en: string } }[] = [
  {
    title: { zh: "挑一个项目", en: "Pick a project" },
    body: {
      zh: "从项目库选一个让你心动的, 看清它的目标和清单。",
      en: "Choose one that excites you; see its goal and parts list.",
    },
  },
  {
    title: { zh: "跟着学 (AI 陪)", en: "Learn (with AI)" },
    body: {
      zh: "短模块一步步来, 卡住了 AI agent 随时把难点讲清。",
      en: "Short modules, step by step; the AI agent unblocks the hard parts.",
    },
  },
  {
    title: { zh: "动手造", en: "Build it" },
    body: {
      zh: "焊接、烧录、接线、组装 — 真硬件, 真失败, 真修好。",
      en: "Solder, flash, wire, assemble — real hardware, real fixes.",
    },
  },
  {
    title: { zh: "发布作品", en: "Ship it" },
    body: {
      zh: "把成品发布出来, 提交真实数据, 让世界看到你造的东西。",
      en: "Publish your build, submit real data, show the world what you made.",
    },
  },
]

export default function Homepage() {
  const { loggedIn, hydrate } = useAuthStore()
  const lang = useLocale()
  const hydrateLocale = useLocaleStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
    hydrateLocale()
  }, [hydrate, hydrateLocale])

  const t = COPY[lang]

  return (
    <main style={{ width: "100%", overflow: "hidden" }}>
      {/* ── Hero ── (语言切换在顶栏全局 LangSwitch) */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 32px 64px", position: "relative" }}>
        <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="eyebrow" style={{ marginBottom: 22, justifyContent: "center" }}>
            <span className="dot" /> {t.eyebrow}
          </div>
          <h1 className="display" style={{ fontSize: 60, lineHeight: 1.04, margin: "0 auto" }}>
            {t.heroTitle1}
            <span style={{ color: "var(--primary)" }}>{t.heroTitleHi}</span>
            {t.heroTitle2}
            <br />
            {t.heroLine2pre}
            <span style={{ color: "var(--aerospace)" }}>{t.heroLine2hi}</span>
            {t.heroLine2post}
          </h1>
          <p style={{ maxWidth: 560, margin: "22px auto 0", fontSize: 16, lineHeight: 1.6, color: "var(--sub)" }}>
            {t.heroBody}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 30, justifyContent: "center" }}>
            <Link href={loggedIn ? "/home" : "/login"} className="btn btn-violet btn-lg">
              {loggedIn ? t.ctaDash : t.ctaStart}
              <ArrowRight size={15} strokeWidth={1.5} />
            </Link>
            <Link href="/library" className="btn btn-ghost btn-lg">
              {t.ctaBrowse}
            </Link>
          </div>
        </div>

        {/* hero 大插画 — 四周羽化融入背景 (mask 作用在填满容器的图上) */}
        <div
          style={{
            position: "relative",
            maxWidth: 1120,
            margin: "36px auto 0",
            aspectRatio: "16 / 9",
            ...edgeFadeMask(),
          }}
        >
          <Image
            src="/landing/hero.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 940px) 100vw, 920px"
            style={{ objectFit: "cover" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px 28px",
            justifyContent: "center",
            marginTop: 8,
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

      {/* ── ① 好奇心 (右图) + 项目一行例子 ── */}
      <FeatureSection
        eyebrow={t.curiEyebrow}
        title={t.curiTitle}
        body={t.curiBody}
        more={t.curiMore}
        moreHref="/library"
        img="/landing/extinct-sound.webp"
        ratio="4 / 5"
        imgSide="right"
        accent="var(--computing)"
        icon={<Sparkles size={18} strokeWidth={1.5} />}
      >
        <ProjectStrip lang={lang} t={t} />
      </FeatureSection>

      {/* ── ② 科技感 (左图) ── */}
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
      />

      {/* ── ③ 陪伴 / AI agent tutor (右图) ── */}
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

      {/* ── ④ 记忆 / memory (左图) ── */}
      <FeatureSection
        eyebrow={t.memEyebrow}
        title={t.memTitle}
        body={t.memBody}
        more={t.memMore}
        img="/landing/memory-v2.webp"
        ratio="3 / 2"
        imgSide="left"
        accent="var(--energy)"
        icon={<Sparkles size={18} strokeWidth={1.5} />}
      />

      {/* ── ⑤ 路径 / 知识树 (右图) ── */}
      <FeatureSection
        eyebrow={t.treeEyebrow}
        title={t.treeTitle}
        body={t.treeBody}
        more={t.treeMore}
        img="/landing/tree-v1.webp"
        ratio="3 / 2"
        imgSide="right"
        accent="var(--robotics)"
        icon={<Network size={18} strokeWidth={1.5} />}
      />

      {/* ── How it works — 一张横向流程大图 + 下方四阶段文字标签 ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 32px" }}>
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 24px" }}>
          <div className="eyebrow" style={{ marginBottom: 12, justifyContent: "center" }}>
            <span className="dot" /> {t.howEyebrow}
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.15 }}>
            {t.howTitle}
          </h2>
        </div>

        {/* 流程大图 (无文字), 四边羽化融入背景 */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "3 / 1",
            ...edgeFadeMask(),
          }}
        >
          <Image
            src="/landing/how-v1.webp"
            alt=""
            fill
            sizes="(max-width: 1240px) 100vw, 1200px"
            style={{ objectFit: "cover" }}
          />
        </div>

        {/* 图下方对齐四阶段的文字标签 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 24,
            marginTop: 8,
          }}
          className="how-labels"
        >
          {HOW_STEPS.map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "0 8px" }}>
              <div
                className="mono"
                style={{ color: "var(--primary)", fontSize: 12, fontWeight: 500, marginBottom: 6 }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <h4 className="h3" style={{ fontSize: 15.5, marginBottom: 6 }}>
                {s.title[lang]}
              </h4>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--sub)" }}>
                {s.body[lang]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 大 CTA ── */}
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
            <Link href={loggedIn ? "/home" : "/login"} className="btn btn-violet btn-lg">
              {loggedIn ? t.ctaDash : t.ctaStart}
              <ArrowRight size={15} strokeWidth={1.5} />
            </Link>
            <Link href="/library" className="btn btn-ghost btn-lg">
              {t.ctaBrowse}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
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
          <FootCol t={lang === "zh" ? "平台" : "Platform"} items={lang === "zh" ? ["知识树", "AI 导师", "记忆系统"] : ["Knowledge tree", "AI tutor", "Memory"]} />
          <FootCol t={lang === "zh" ? "关于" : "Company"} items={lang === "zh" ? ["关于我们", "开源", "加入我们"] : ["About", "Open source", "Careers"]} />
        </div>
      </footer>

      <style jsx>{`
        @media (max-width: 820px) {
          .how-labels { grid-template-columns: 1fr 1fr !important; row-gap: 28px !important; }
          .foot-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </main>
  )
}

// ── 子组件 ──────────────────────────────────────────────────────

// 功能节: 左右文图交替, 图片用 mask 朝文字侧渐隐, 与背景融为一体 (无卡片边框)
function FeatureSection({
  eyebrow,
  title,
  body,
  more,
  moreHref,
  img,
  ratio,
  imgSide,
  accent,
  icon,
  children,
}: {
  eyebrow: string
  title: string
  body: string
  more: string
  moreHref?: string
  img: string
  ratio: string
  imgSide: "left" | "right"
  accent: string
  icon: React.ReactNode
  children?: React.ReactNode
}) {
  const text = (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "8px 0" }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          background: "var(--card)",
          border: "1px solid var(--border)",
          display: "grid",
          placeItems: "center",
          color: accent,
          marginBottom: 18,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {icon}
      </div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        <span className="dot" style={{ background: accent }} /> {eyebrow}
      </div>
      <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-.03em", lineHeight: 1.18, marginBottom: 16 }}>
        {title}
      </h2>
      <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--sub)", maxWidth: 460 }}>{body}</p>
      {children}
      <div style={{ marginTop: 22 }}>
        <OptionalLink href={moreHref}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 500, color: accent }}>
            {more}
            <ArrowRight size={15} strokeWidth={1.8} />
          </span>
        </OptionalLink>
      </div>
    </div>
  )

  const picture = (
    <div
      style={{
        position: "relative",
        aspectRatio: ratio,
        ...edgeFadeMask(imgSide),
      }}
    >
      <Image src={img} alt="" fill sizes="(max-width: 820px) 100vw, 560px" style={{ objectFit: "cover" }} />
    </div>
  )

  // 图侧占比加大 (图更大, 覆盖范围更广), 文侧收窄
  const cols = imgSide === "left" ? "1.4fr 1fr" : "1fr 1.4fr"
  return (
    <section>
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "44px 32px",
          display: "grid",
          gridTemplateColumns: cols,
          gap: 36,
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
            gap: 20px !important;
          }
        }
      `}</style>
    </section>
  )
}

function OptionalLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none" }}>
        {children}
      </Link>
    )
  }
  return <>{children}</>
}

// 好奇心节里的项目一行例子 (3 个小卡, 紧凑)
function ProjectStrip({ lang, t }: { lang: Lang; t: Copy }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--sub-2)", marginBottom: 10 }}>
        {t.projExamples}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {PROJECTS.map((p) => {
          const chip = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px 8px 8px",
                border: "1px solid var(--border)",
                borderRadius: 999,
                background: "var(--card)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <span
                style={{
                  position: "relative",
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "var(--paper-2)",
                }}
              >
                <Image src={p.img} alt="" fill sizes="30px" style={{ objectFit: "cover" }} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-2)", whiteSpace: "nowrap" }}>
                {p.title[lang]}
              </span>
            </div>
          )
          return p.live ? (
            <Link key={p.slug} href={`/library/${encodeURIComponent(p.slug)}`} style={{ textDecoration: "none" }}>
              {chip}
            </Link>
          ) : (
            <div key={p.slug}>{chip}</div>
          )
        })}
      </div>
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
