import Link from "next/link"
import { ArrowDownRight, ArrowRight, ArrowUpRight, Atom, Bot, Check, ChevronDown, Clock3, Globe2, Orbit, Sun } from "lucide-react"
import type { Locale } from "@/lib/i18n/locales"
import { displayOutcome, type DiscoveryEntry } from "@/lib/library-discovery"
import { FUTURE_PATHS, futureCopy, futureHref } from "@/lib/future-paths"
import { lineHref, localized } from "@/lib/project-lines/catalog"
import { projectCoverProps } from "@/lib/project-cover"
import styles from "./future-path-view.module.css"

const ICONS = { robot: Bot, space: Orbit, molecule: Atom, energy: Sun, earth: Globe2 }
const COPY = {
  zh: {
    eyebrow: "职业探索 · 从未来的作品，找到今天的起点",
    heading: "未来的你，想做出什么？",
    intro: "先选一个让你好奇的方向，试做一件小作品。喜欢，就再走一步。",
    choose: "探索你的未来方向", direction: "你正在探索的职业方向", example: "这个方向的工程作品示意",
    abilities: "你会练习的能力", first: "今天，只需迈出这一步", start: "先试 3 分钟", easy: "浏览器即可体验 · 无需先买器材",
    roadmap: "看看怎样一步步走到这里", stops: "件成长作品", routeHint: "这是一条建议路线，可以跨站选择。每一站都留下作品与证据，完整工程按各自课程准备。",
    evidence: "留下的作品", open: "查看项目", planned: "筹备中", loading: "正在读取开放状态…", preparation: "什么时候需要准备器材？",
    family: "给家长：从作品里，看见成长", familyHint: "先把操作交给孩子，再请孩子讲讲：做了什么选择，为什么？",
    more: "查看这个方向的全部项目", flexible: "现在选的是一次探索。你可以随时换一个方向，把学会的方法带过去。",
  },
  en: {
    eyebrow: "CAREER EXPLORATION · FROM A FUTURE CREATION TO A FIRST STEP",
    heading: "What would your future self create?",
    intro: "Choose a direction that makes you curious. Try one small creation, then decide what comes next.",
    choose: "Explore future directions", direction: "A career direction to explore", example: "An illustrative engineering project in this direction",
    abilities: "Abilities you will practice", first: "TODAY, JUST TAKE THIS FIRST STEP", start: "Try 3 minutes", easy: "Start in your browser · No equipment to buy first",
    roadmap: "See how to grow toward this", stops: "creations along the way", routeHint: "A suggested route you can adapt. Keep creations and evidence at each stop; prepare for full projects using their own course guides.",
    evidence: "What you keep", open: "View project", planned: "In preparation", loading: "Checking availability…", preparation: "When will I need equipment?",
    family: "For families: see growth in the work", familyHint: "Let your child take the controls, then ask: what did you choose, and why?",
    more: "Explore all projects in this direction", flexible: "This is an exploration. You can change direction and take the methods you learn with you.",
  },
}

const entryHref = (entry: DiscoveryEntry) => entry.courseHref || entry.local?.href || `/library/${encodeURIComponent(entry.id)}`

export function FuturePathView({ locale, roleId, entries, loading }: {
  locale: Locale; roleId: string | null; entries: DiscoveryEntry[]; loading: boolean
}) {
  const c = COPY[locale]
  const selected = FUTURE_PATHS.find(path => path.id === roleId) || FUTURE_PATHS[0]
  const first = entries.find(entry => entry.id === selected.steps[0].projectId && entry.available)
  const image = projectCoverProps(selected.flagship, selected.imageFallback, "card")
  return <section className={styles.view} aria-labelledby="future-title" data-future-view>
    <header className={styles.intro}>
      <p className={styles.eyebrow}>{c.eyebrow}</p>
      <h2 id="future-title">{c.heading}</h2>
      <p>{c.intro}</p>
    </header>
    <div className={styles.explorer}>
      <nav className={styles.directions} aria-label={c.choose}>
        {FUTURE_PATHS.map((path, index) => {
          const Icon = ICONS[path.icon]
          return <Link key={path.id} href={futureHref(path.id)} scroll={false} aria-current={path.id === selected.id ? "true" : undefined} data-future-role={path.id}>
            <span className={styles.directionNumber}>{String(index + 1).padStart(2, "0")}</span>
            <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
            <div><strong>{futureCopy(path.shortTitle, locale)}</strong><span>{futureCopy(path.invitation, locale)}</span></div>
            <ArrowRight className={styles.selectionArrow} size={16} aria-hidden="true" />
          </Link>
        })}
        <p className={styles.flexible}><ArrowDownRight size={19} aria-hidden="true" />{c.flexible}</p>
      </nav>
      <div className={styles.detail} key={selected.id} data-future-detail={selected.id}>
        <section className={styles.ambition} aria-labelledby="future-role-title">
          <div className={styles.ambitionCopy}>
            <p className={styles.roleLabel}>{c.direction}</p>
            <h3 id="future-role-title">{futureCopy(selected.title, locale)}</h3>
            <p className={styles.quote}>{futureCopy(selected.ambition, locale)}</p>
            <p className={styles.description}>{futureCopy(selected.description, locale)}</p>
          </div>
          <figure className={styles.visual}>
            {/* Use existing responsive, generated project covers; no career stock portraits or large original PNGs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...image} sizes="(max-width: 650px) calc(100vw - 80px), (max-width: 1050px) 34vw, 350px" alt={futureCopy(selected.imageAlt, locale)} width={800} height={533} loading="eager" decoding="async" />
            <figcaption>{c.example}</figcaption>
          </figure>
        </section>
        <section className={styles.firstStep} aria-label={c.first}>
          <div><p><Clock3 size={14} aria-hidden="true" />{c.first}</p><strong>{first?.title || futureCopy(selected.steps[0].title, locale)}</strong><span>{first ? c.easy : loading ? c.loading : c.planned}</span></div>
          {first ? <Link href={entryHref(first)} data-future-start>{c.start}<ArrowUpRight size={18} aria-hidden="true" /></Link> : <Link href={lineHref(selected.lineId)}>{c.more}<ArrowRight size={16} aria-hidden="true" /></Link>}
        </section>
        <section className={styles.abilities} aria-label={c.abilities}>
          <h4>{c.abilities}</h4>
          <ul>{selected.abilities.map((ability, index) => <li key={index}><Check size={15} aria-hidden="true" /><span>{futureCopy(ability, locale)}</span></li>)}</ul>
        </section>
        <details className={styles.roadmap} data-future-roadmap>
          <summary><div><strong>{c.roadmap}</strong><span>{selected.steps.length} {c.stops}</span></div><ChevronDown size={18} aria-hidden="true" /></summary>
          <p className={styles.routeHint}>{c.routeHint}</p>
          <ol>{selected.steps.map((step, index) => {
            const entry = entries.find(item => item.id === step.projectId)
            const outcome = entry?.local ? localized(entry.local.outcome, locale) : entry?.project ? displayOutcome(entry.project) : null
            return <li key={step.projectId} data-future-project={step.projectId} data-available={entry?.available || false}>
              <span className={styles.stopIndex}>{String(index + 1).padStart(2, "0")}</span>
              <div><h4>{entry?.title || futureCopy(step.title, locale)}</h4><p>{futureCopy(step.ability, locale)}</p>{outcome && <p className={styles.evidence}><span>{c.evidence}</span>{outcome}</p>}
                {entry?.available ? <Link href={entryHref(entry)}>{c.open}<ArrowUpRight size={13} aria-hidden="true" /></Link> : <span className={styles.unavailable}>{loading ? c.loading : c.planned}</span>}
              </div>
            </li>
          })}</ol>
          <Link className={styles.lineLink} href={lineHref(selected.lineId)}>{c.more}<ArrowRight size={15} aria-hidden="true" /></Link>
        </details>
        <aside className={styles.family}>
          <h4>{c.family}</h4><p>{futureCopy(selected.family, locale)}</p><p className={styles.familyHint}>{c.familyHint}</p>
          <details><summary>{c.preparation}<ChevronDown size={14} aria-hidden="true" /></summary><p>{futureCopy(selected.preparation, locale)}</p></details>
        </aside>
      </div>
    </div>
  </section>
}
