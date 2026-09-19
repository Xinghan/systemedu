import Link from "next/link"
import { ArrowUpRight, Flag, Orbit, Rocket, Telescope } from "lucide-react"
import type { Locale } from "@/lib/i18n/locales"
import { SPACE_LINE, MICRO_PROJECTS, GUIDED_PROJECTS, PLANNED_PROJECTS, localized } from "@/lib/project-lines/catalog"
import styles from "./project-line-view.module.css"

const COPY = {
  zh: {
    first: "第一站 / 先动手试试", title: "一个小项目，一件自己的作品。", available: "3 个独立入口已开放体验",
    domain: "天文 · 空间观察", minutes: "约 3 分钟",
    photoTitle: "我的第一张星球照片", photoBody: "移动镜头，拉近一个世界。带走你亲手取景的照片和观测记录。", start: "打开观测台",
    planned: "筹备中", plannedWork: "计划带走：", independent: "独立入口 · 约 3 分钟的设计目标",
    next: [
      { title: "把探测器稳稳送下去", domain: "航天 · 控制", work: "一份自己的着陆记录" },
      { title: "开车找到观察点", domain: "机械 · 视觉", work: "一张地形照片和自己的路线" },
    ],
    journey: "远征路线 / 内容规划", journeyTitle: "小发现，慢慢拼成大远征。", journeyBody: "每一步都有作品。按兴趣探索，准备好了再挑战下一站。",
    stages: [
      { title: "短体验", detail: "3 个独立入口", status: "3 个入口均可体验" },
      { title: "引导小项目", detail: "5 个不同领域的任务", status: "首个已开放 · 其余筹备中" },
      { title: "组装与验证", detail: "让自己的作品一起运行", status: "筹备中" },
      { title: "终极宝藏 · 火星车", detail: "进入完整工程项目", status: "查看现有完整课程" },
    ],
    note: "当前短体验无需登录，作品保存在本机浏览器，也可以下载。时长为设计目标；筹备中的节点尚未开放。",
  },
  en: {
    first: "FIRST STOP / TRY SOMETHING", title: "A small project. Something of your own.", available: "All 3 starting points are ready",
    domain: "Astronomy · Observation", minutes: "About 3 min",
    photoTitle: "My first photo of a world", photoBody: "Move the telescope and bring a world closer. Take home your own photo and observation record.", start: "Open the observatory",
    planned: "In preparation", plannedWork: "Planned creation: ", independent: "An independent entry · 3-minute design target",
    next: [
      { title: "Bring a lander down safely", domain: "Spaceflight · Control", work: "your own landing record" },
      { title: "Drive to an observation point", domain: "Mechanics · Vision", work: "a terrain photo and your own route" },
    ],
    journey: "EXPEDITION ROUTE / PLANNED CONTENT", journeyTitle: "Small discoveries. A bigger expedition.", journeyBody: "Make something at each stop. Follow your interests and take on the next challenge when you feel ready.",
    stages: [
      { title: "Quick experiences", detail: "3 independent starting points", status: "All 3 are ready to try" },
      { title: "Guided projects", detail: "5 tasks across different fields", status: "First ready · More in preparation" },
      { title: "Assembly and testing", detail: "Make your creations work together", status: "In preparation" },
      { title: "The destination · A Mars rover", detail: "Explore a full engineering project", status: "View the existing course" },
    ],
    note: "The quick experience needs no login. Creations stay in this browser and can be downloaded. Durations are design targets; planned stops are not yet available.",
  },
}

const STAGE_ICONS = [Orbit, Telescope, Rocket, Flag]

export function ProjectLineView({ locale }: { locale: Locale }) {
  const c = COPY[locale]
  return (
    <div className={styles.lineView}>
      <section className={styles.launch} aria-labelledby="start-title">
        <div className={styles.sectionHead}>
          <div><p className={styles.eyebrow}>{c.first}</p><h2 id="start-title">{c.title}</h2></div>
          <span className={styles.available}>{c.available}</span>
        </div>
        <div className={styles.projectGrid}>
          <Link className={styles.featured} href={SPACE_LINE.firstProjectHref}>
            <div className={styles.cardTop}><span>01 / {c.domain}</span><span>{c.minutes}</span></div>
            <div className={styles.preview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MICRO_PROJECTS[0].coverImage} alt="" className={styles.sceneCover} />
            </div>
            <div className={styles.cardCopy}><h3>{c.photoTitle}</h3><p>{c.photoBody}</p><span className={styles.start}>{c.start}<ArrowUpRight size={19} aria-hidden="true" /></span></div>
          </Link>
          {MICRO_PROJECTS.slice(1).map((entry, i) => <Link className={styles.featured} href={entry.href} key={entry.id}>
            <div className={styles.cardTop}><span>0{i + 2} / {c.next[i].domain}</span><span>{c.minutes}</span></div>
            <div className={styles.preview}>
              {/* 生成插画用于项目封面，体验内的照片仍来自实际取景。 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.coverImage} alt="" className={styles.sceneCover} />
            </div>
            <div className={styles.cardCopy}><h3>{localized(entry.title, locale)}</h3><p>{localized(entry.outcome, locale)}</p><span className={styles.start}>{localized(entry.startLabel, locale)}<ArrowUpRight size={19} aria-hidden="true" /></span></div>
          </Link>)}
        </div>
      </section>
      <section className={styles.guided} aria-labelledby="guided-title">
        <p className={styles.eyebrow}>{locale === "zh" ? "下一站 / 从操作到制作" : "NEXT STOP / MAKE IT YOUR OWN"}</p>
        <h2 id="guided-title">{locale === "zh" ? "让探测车，按你的规则行动。" : "Let the rover follow your rules."}</h2>
        {GUIDED_PROJECTS.map(entry => <Link key={entry.id} href={entry.href} className={styles.guidedCard}>
          <div className={styles.guidedPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.coverImage} alt="" />
          </div>
          <div className={styles.guidedCopy}><small>{locale === "zh" ? "引导小项目 / 约 15 分钟" : "GUIDED PROJECT / ABOUT 15 MIN"}</small><h3>{localized(entry.title, locale)}</h3><p>{localized(entry.action, locale)}</p><strong>{localized(entry.startLabel, locale)}<ArrowUpRight size={16} /></strong></div>
        </Link>)}
        <p className={styles.note}>{locale === "zh" ? "其他引导作品筹备中：" : "More guided creations in preparation: "}{PLANNED_PROJECTS.guided[locale].join(" / ")}</p>
      </section>
      <section className={styles.journey} id="space-journey" aria-labelledby="journey-title">
        <p className={styles.eyebrow}>{c.journey}</p><h2 id="journey-title">{c.journeyTitle}</h2><p className={styles.journeyIntro}>{c.journeyBody}</p>
        <ol className={styles.journeySteps}>
          {c.stages.map((stage, i) => {
            const Icon = STAGE_ICONS[i]
            return <li key={i}><Icon size={23} strokeWidth={1.2} aria-hidden="true" /><strong>{stage.title}</strong><span>{stage.detail}</span>
              {i === 3 ? <Link href={`/library/${SPACE_LINE.flagshipSlug}`}>{stage.status}<ArrowUpRight size={12} aria-hidden="true" /></Link> : <small>{stage.status}</small>}
            </li>
          })}
        </ol>
      </section>
      <p className={styles.note}>{c.note}</p>
    </div>
  )
}
