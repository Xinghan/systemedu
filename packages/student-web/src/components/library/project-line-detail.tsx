import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import type { Locale } from "@/lib/i18n/locales"
import { sortDiscoveryEntries, type DiscoveryEntry } from "@/lib/library-discovery"
import { LINES_HREF, localized, type ProjectLine } from "@/lib/project-lines/catalog"
import { DiscoveryProjectCard } from "./discovery-project-card"
import gridStyles from "./discovery.module.css"
import styles from "./project-line-view.module.css"

export function ProjectLineDetail({ line, locale, entries, pulled }: { line: ProjectLine; locale: Locale; entries: DiscoveryEntry[]; pulled: Set<string> }) {
  const own = sortDiscoveryEntries(entries.filter(entry => entry.lineId === line.id), "difficulty", locale)
  const first = own.find(entry => entry.local && entry.available)
  const stages = [
    { kind: "micro", title: { zh: "先动手，发现一点新东西", en: "Try something and make a discovery" }, hint: { zh: "约 3 分钟目标 / 可以从任意一个开始", en: "About 3 minutes / Choose any starting point" } },
    { kind: "guided", title: { zh: "做一件自己的作品", en: "Make something of your own" }, hint: { zh: "多节点课程 / 阅读、观看、动手，再留下自己的解释", en: "Multiple learning nodes / Read, watch, practice and explain" } },
    { kind: "integration", title: { zh: "让作品一起工作", en: "Make your creations work together" }, hint: { zh: "多节点整合课程 / 理解接口、逐步组合，再验证系统", en: "Assembly and testing / Combine your own modules" } },
    { kind: "full", title: { zh: "走向完整工程与研究", en: "Explore a full project" }, hint: { zh: "按实际准备与能力选择 / 无需先完成所有小游戏", en: "Choose by readiness / Quick projects are not prerequisites" } },
  ]
  return <div data-line-detail={line.id}>
    <Link href={LINES_HREF} className={styles.back}><ArrowLeft size={14} />{locale === "zh" ? "所有项目线" : "All project lines"}</Link>
    <section className={styles.detailHero}>
      <div className={styles.detailCopy}><p className={styles.eyebrow}>{locale === "zh" ? "主题项目线" : "PROJECT LINE"}</p><h2>{localized(line.title, locale)}</h2><p>{localized(line.description, locale)}</p><p className={styles.domains}>{localized(line.domains, locale)}</p><Link className={styles.detailAction} href={first?.local?.href || "#line-route"}>{first ? (locale === "zh" ? "从 3 分钟开始" : "Start with 3 minutes") : (locale === "zh" ? "查看这条探索路线" : "See this exploration route")}<ArrowRight size={16} /></Link></div>
      <div className={styles.detailImage}><Image src={line.image} alt="" fill priority sizes="(max-width: 650px) 100vw, 50vw" className={styles.cover} /></div>
    </section>
    <div id="line-route">
      {stages.map((stage, index) => {
        const available = own.filter(entry => entry.kind === stage.kind)
        const planned = line.planned.filter(node => node.kind === stage.kind)
        return <section key={stage.kind} className={styles.routeSection} data-line-stage={stage.kind}>
          <header className={styles.routeHead}><span className={styles.stageIndex}>0{index + 1}</span><div><h3>{localized(stage.title, locale)}</h3><p>{localized(stage.hint, locale)}</p></div></header>
          {available.length > 0 && <div className={gridStyles.projectGrid}>{available.map(entry => <DiscoveryProjectCard key={entry.id} entry={entry} pulled={pulled.has(entry.id)} />)}</div>}
          {planned.length > 0 && <div className={styles.plannedGrid}>{planned.map(node => <article key={node.id} className={styles.plannedCard} data-planned-project={node.id}><div><span>{locale === "zh" ? "筹备中" : "In preparation"}</span><span>{node.learningNodes.length > 0 && `${node.learningNodes.length} ${locale === "zh" ? "学习节点 · " : "nodes · "}`}{node.estimatedMinutes} {locale === "zh" ? "分钟目标" : "min target"}</span></div><h4>{localized(node.title, locale)}</h4><p>{localized(node.outcome, locale)}</p>{locale === "zh" && node.learningNodes.length > 0 && <p>{node.learningNodes.join(" → ")}</p>}</article>)}</div>}
        </section>
      })}
    </div>
    <p className={styles.note}>{locale === "zh" ? "路线是探索建议，可以跨站选择。筹备节点尚不能开始；时长是累计设计目标，可分次学习。已有短体验保存在本机浏览器，实物项目按原课程准备设备与成人支持。" : "The route is a suggestion, not a lock. Planned stops cannot be started yet. Short durations are design targets; existing quick experiences save in this browser. Prepare equipment and adult support as described in each full course."}</p>
  </div>
}
