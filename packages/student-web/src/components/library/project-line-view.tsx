import Link from "next/link"
import { ArrowUpRight, Camera, Flag, Orbit, Rocket, Telescope } from "lucide-react"
import type { Locale } from "@/lib/i18n/locales"
import { SPACE_LINE } from "@/lib/project-lines/catalog"
import styles from "./project-line-view.module.css"

const COPY = {
  zh: {
    first: "第一站 / 先动手试试", title: "一个小项目，一件自己的作品。", available: "首个项目已开放体验",
    domain: "天文 · 空间观察", minutes: "约 3 分钟", preview: "月球已入镜 · 等你按下快门",
    photoTitle: "我的第一张星球照片", photoBody: "移动镜头，拉近一个世界。带走你亲手取景的照片和观测记录。", start: "打开观测台",
    planned: "筹备中", plannedWork: "计划带走：", independent: "独立入口 · 约 3 分钟的设计目标",
    next: [
      { title: "把探测器稳稳送下去", domain: "航天 · 控制", work: "一份自己的着陆记录" },
      { title: "开车找到观察点", domain: "机械 · 视觉", work: "一张地形照片和自己的路线" },
    ],
    journey: "远征路线 / 内容规划", journeyTitle: "小发现，慢慢拼成大远征。", journeyBody: "每一步都有作品。按兴趣探索，准备好了再挑战下一站。",
    stages: [
      { title: "短体验", detail: "3 个独立入口", status: "首个已可体验" },
      { title: "引导小项目", detail: "5 个不同领域的任务", status: "约 15 分钟 / 个 · 筹备中" },
      { title: "组装与验证", detail: "让自己的作品一起运行", status: "筹备中" },
      { title: "终极宝藏 · 火星车", detail: "进入完整工程项目", status: "查看现有完整课程" },
    ],
    note: "当前短体验无需登录，作品保存在本机浏览器，也可以下载。时长为设计目标；筹备中的节点尚未开放。",
  },
  en: {
    first: "FIRST STOP / TRY SOMETHING", title: "A small project. Something of your own.", available: "The first experience is ready",
    domain: "Astronomy · Observation", minutes: "About 3 min", preview: "The Moon is in frame. Your turn to take the photo.",
    photoTitle: "My first photo of a world", photoBody: "Move the telescope and bring a world closer. Take home your own photo and observation record.", start: "Open the observatory",
    planned: "In preparation", plannedWork: "Planned creation: ", independent: "An independent entry · 3-minute design target",
    next: [
      { title: "Bring a lander down safely", domain: "Spaceflight · Control", work: "your own landing record" },
      { title: "Drive to an observation point", domain: "Mechanics · Vision", work: "a terrain photo and your own route" },
    ],
    journey: "EXPEDITION ROUTE / PLANNED CONTENT", journeyTitle: "Small discoveries. A bigger expedition.", journeyBody: "Make something at each stop. Follow your interests and take on the next challenge when you feel ready.",
    stages: [
      { title: "Quick experiences", detail: "3 independent starting points", status: "The first is ready to try" },
      { title: "Guided projects", detail: "5 tasks across different fields", status: "About 15 min each · In preparation" },
      { title: "Assembly and testing", detail: "Make your creations work together", status: "In preparation" },
      { title: "The destination · A Mars rover", detail: "Explore a full engineering project", status: "View the existing course" },
    ],
    note: "The quick experience needs no login. Creations stay in this browser and can be downloaded. Durations are design targets; planned stops are not yet available.",
  },
}

const ENTRY_ICONS = [Rocket, Camera]
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
            <div className={styles.preview} aria-hidden="true"><span className={styles.previewMoon} /><span className={styles.previewFrame} /><span className={styles.previewCaption}>{c.preview}</span></div>
            <div className={styles.cardCopy}><h3>{c.photoTitle}</h3><p>{c.photoBody}</p><span className={styles.start}>{c.start}<ArrowUpRight size={19} aria-hidden="true" /></span></div>
          </Link>
          {c.next.map(({ title, domain, work }, i) => {
            const Icon = ENTRY_ICONS[i]
            return <article className={styles.planned} key={i}>
              <div className={styles.cardTop}><span>0{i + 2} / {domain}</span><span>{c.planned}</span></div>
              <Icon className={styles.plannedIcon} size={42} strokeWidth={1} aria-hidden="true" />
              <div className={styles.cardCopy}><h3>{title}</h3><p>{c.plannedWork}{work}</p><span className={styles.notYet}>{c.independent}</span></div>
            </article>
          })}
        </div>
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
