"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, ArrowUpRight, BookOpen, Clock3, Layers3, Orbit, Telescope } from "lucide-react"
import { library } from "@/lib/api"
import { useT, useLocale } from "@/lib/i18n/use-t"
import { displayOutcome, discoveryLevel, type DiscoveryEntry } from "@/lib/library-discovery"
import { PROJECT_LINES, lineHref, localized } from "@/lib/project-lines/catalog"
import { StoryModal } from "@/components/library/StoryModal"
import { ChapterBadgeMark } from "@/components/badges/ChapterBadgeMark"
import { DISCOVERY_COPY } from "./discovery-copy"
import styles from "./discovery.module.css"

export function DiscoveryProjectCard({ entry, pulled }: { entry: DiscoveryEntry; pulled: boolean }) {
  const locale = useLocale()
  const c = DISCOVERY_COPY[locale]
  const t = useT()
  const [coverFailed, setCoverFailed] = useState(false)
  const [storyOpen, setStoryOpen] = useState(false)
  const project = entry.project
  const micro = entry.local
  const isMicro = entry.kind === "micro"
  const isLocal = Boolean(micro)
  const href = micro?.href || `/library/${encodeURIComponent(entry.id)}`
  const line = PROJECT_LINES.find(item => item.id === entry.lineId)
  const statusLabel = entry.source === "snapshot" ? (locale === "zh" ? "待接入" : "Not connected yet") : c.planning
  const hasStory = Boolean(project?.story?.length)
  const outcome = micro ? localized(micro.outcome, locale) : project ? displayOutcome(project) : null
  const domain = c.domainNames[entry.domain as keyof typeof c.domainNames] || project?.domain || c.domainNames.other
  const duration = project?.duration_weeks

  return (
    <article className={`${styles.projectCard} ${isMicro ? styles.microCard : ""} ${!entry.available ? styles.draftCard : ""}`} data-project-card={entry.id} data-kind={entry.kind} data-difficulty={entry.difficulty ?? (isMicro ? "light" : "unspecified")} data-available={entry.available}>
      <div className={`${styles.cardVisual} ${isMicro ? styles.microVisual : ""}`}>
        {entry.coverImage ? (
          // 项目使用独立生成的插画封面。
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.coverImage} alt="" className={styles.coverPhoto} />
        ) : project?.cover_image_path && !coverFailed ? (
            // 封面由现有内容服务提供，失败时回落到领域图形。
            // eslint-disable-next-line @next/next/no-img-element
            <img src={library.coverUrl(entry.id)} alt="" onError={() => setCoverFailed(true)} className={styles.coverPhoto} />
          ) : <div className={styles.coverFallback} data-domain={entry.domain} aria-hidden="true"><Orbit size={85} strokeWidth={.55} /><span>{String(discoveryLevel(entry) + 1).padStart(2, "0")} · {domain}</span></div>}
        {entry.available && <Link href={href} className={styles.coverLink} tabIndex={-1} aria-label={entry.title} />}
        {!isLocal && <ChapterBadgeMark domain={project?.domain} corner="top-left" />}
        {hasStory && <button type="button" className={styles.storyButton} onClick={() => setStoryOpen(true)} aria-label={`${t("story.view")} · ${entry.title}`} title={t("story.view")}><BookOpen size={17} strokeWidth={1.6} /></button>}
        <span className={`${styles.cardKind} ${isMicro ? styles.microKind : ""}`}>
          {isMicro ? <Telescope size={12} /> : isLocal ? <BookOpen size={12} /> : <Layers3 size={12} />}{isMicro ? c.microTag : entry.kind === "integration" ? (discoveryLevel(entry) === 3 ? (locale === "zh" ? "独立挑战" : "Challenge") : (locale === "zh" ? "系统课程" : "System course")) : isLocal ? c.guidedTag : c.fullTag}
        </span>
        {!entry.available && <span className={styles.draftTag}>{statusLabel}</span>}
      </div>
      <div className={styles.cardContent}>
        <div className={styles.cardOverline}><span>{String(discoveryLevel(entry) + 1).padStart(2, "0")} · {domain}</span>{pulled && entry.available && <span className={styles.added}>{c.onShelf}</span>}</div>
        <h3>{entry.available ? <Link href={href}>{entry.title}</Link> : entry.title}</h3>
        <div className={styles.outcome}><span>{c.outcome}</span><p>{outcome || c.noOutcome}</p></div>
        <div className={styles.cardMetrics}>
          <div><small><Clock3 size={12} />{isMicro ? c.minutesTarget : c.schedule}</small><strong>{micro ? (locale === "zh" ? `约 ${micro.estimatedMinutes} 分钟` : `About ${micro.estimatedMinutes} min`) : duration && duration > 0 ? `${duration} ${c.weeks}` : c.noSchedule}</strong></div>
          <div><small>{isLocal ? isMicro ? c.light : c.guidedChallenge : c.challenge}</small><strong>{micro ? localized(micro.challenge, locale) : entry.difficulty ? <><span className={styles.depthBars} aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <i key={n} data-filled={n <= entry.difficulty!} />)}</span>{entry.difficulty} / 5</> : c.unspecified}</strong></div>
        </div>
        <p className={styles.preparation}>{micro?.preparation ? localized(micro.preparation, locale) : isLocal ? c.microPreparation : c.preparation}</p>
        {line && <Link href={lineHref(line.id)} className={styles.lineAssociation}><Orbit size={13} />{localized(line.title, locale)}<ArrowUpRight size={12} /></Link>}
        <div className={styles.cardFooter}>
          <span>{micro?.learningNodes ? `${micro.learningNodes} ${locale === "zh" ? "学习节点 · 可分次完成" : "nodes · Learn at your pace"}` : isLocal ? c.instant : project?.knode_count ? `${project.knode_count} ${c.chapters}` : project?.age_band ? `${project.age_band} ${c.age}` : c.fullTag}</span>
          {entry.available ? <Link href={href} className={isLocal ? styles.startCard : styles.openCard}>{micro && micro.kind !== "micro" ? (locale === "zh" ? "进入课程" : "Start course") : isLocal ? c.startProject : pulled ? c.continueProject : c.viewProject}<ArrowRight size={14} /></Link> : <span className={styles.comingSoon}>{statusLabel}</span>}
        </div>
      </div>
      {project && hasStory && storyOpen && <StoryModal slug={project.slug} frames={project.story!} onClose={() => setStoryOpen(false)} />}
    </article>
  )
}
