"use client"

import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import { ArrowRight, ArrowUpRight, Camera, Check, Clock3, Layers3, LayoutGrid, Orbit, Plus, Route, Search, SlidersHorizontal, Telescope, X } from "lucide-react"
import { library, myProjects, type LibraryProjectSummary } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useLocale } from "@/lib/i18n/use-t"
import { makeDiscoveryEntries } from "@/lib/library-discovery"
import { PLANNED_PROJECTS, SPACE_LINE, type DiscoveryKind } from "@/lib/project-lines/catalog"
import { ApplyProjectModal } from "@/components/layout/apply-project-modal"
import { DiscoveryProjectCard } from "@/components/library/discovery-project-card"
import { ProjectLineView } from "@/components/library/project-line-view"
import { DISCOVERY_COPY } from "@/components/library/discovery-copy"
import styles from "@/components/library/discovery.module.css"

const KINDS: DiscoveryKind[] = ["all", "micro", "guided", "integration", "full"]
const KIND_ICONS = { all: Orbit, micro: Telescope, guided: Camera, integration: Layers3, full: Orbit }

export default function LibraryListPage() {
  return <Suspense fallback={<main className={styles.page} aria-busy="true"><div className={styles.loading}><span /></div></main>}><LibraryBrowser /></Suspense>
}

function LibraryBrowser() {
  const locale = useLocale()
  const c = DISCOVERY_COPY[locale]
  const searchParams = useSearchParams()
  const showLines = searchParams.get("view") === "lines"
  const { loggedIn, hydrate } = useAuthStore()
  const [projects, setProjects] = useState<LibraryProjectSummary[]>([])
  const [pulled, setPulled] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const [kind, setKind] = useState<DiscoveryKind>("all")
  const [query, setQuery] = useState("")
  const [domain, setDomain] = useState("all")
  const [difficulty, setDifficulty] = useState("all")
  const [sort, setSort] = useState("recommended")
  const [showPlanned, setShowPlanned] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)

  useEffect(() => { hydrate() }, [hydrate])
  useEffect(() => {
    let active = true
    library.listProjects().then(all => {
      if (active) { setProjects(all); setLoadFailed(false) }
    }).catch(() => { if (active) setLoadFailed(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])
  useEffect(() => {
    if (!loggedIn) return
    let active = true
    myProjects.list().then(mine => { if (active) setPulled(new Set(mine.map(item => item.slug))) }).catch(() => {})
    return () => { active = false }
  }, [loggedIn])

  const entries = useMemo(() => makeDiscoveryEntries(projects, locale), [projects, locale])
  const availableCount = entries.filter(entry => entry.available).length
  const listed = entries.filter(entry => showPlanned || entry.available)
  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const result = entries.filter(entry => {
      if (!showPlanned && !entry.available) return false
      if (kind !== "all" && kind !== entry.kind) return false
      if (domain !== "all" && domain !== entry.domain) return false
      if (difficulty === "light" && entry.kind !== "micro") return false
      if (difficulty === "1-2" && (entry.difficulty == null || entry.difficulty > 2)) return false
      if (difficulty === "3" && entry.difficulty !== 3) return false
      if (difficulty === "4-5" && (entry.difficulty == null || entry.difficulty < 4)) return false
      const domainName = c.domainNames[entry.domain as keyof typeof c.domainNames] || ""
      return terms.every(term => `${entry.searchText} ${domainName.toLowerCase()}`.includes(term))
    })
    return result.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1
      if (sort === "recent") return b.publishedAt - a.publishedAt || a.title.localeCompare(b.title, locale)
      // 轻量起点不映射成旧课程的 1/5 分。
      if (a.kind !== b.kind) return a.kind === "micro" ? -1 : 1
      if (sort === "recommended" && a.id !== b.id && (a.id === SPACE_LINE.flagshipSlug || b.id === SPACE_LINE.flagshipSlug)) return a.id === SPACE_LINE.flagshipSlug ? -1 : 1
      return (a.difficulty ?? 99) - (b.difficulty ?? 99) || a.title.localeCompare(b.title, locale)
    })
  }, [entries, query, showPlanned, kind, domain, difficulty, sort, c, locale])

  const planningKind = kind === "guided" || kind === "integration" ? kind : null
  const showPlan = planningKind && !query.trim() && (domain === "all" || domain === "aerospace") && difficulty === "all"
  const hasFilters = kind !== "all" || query !== "" || domain !== "all" || difficulty !== "all" || showPlanned || sort !== "recommended"
  function reset() { setKind("all"); setQuery(""); setDomain("all"); setDifficulty("all"); setSort("recommended"); setShowPlanned(false) }
  function retry() { setLoading(true); setLoadFailed(false); setReload(value => value + 1) }

  return (
    <main className={styles.page} data-locale={locale}>
      <header className={styles.pageHeader}>
        <div><p className={styles.eyebrow}>{c.eyebrow}</p><div className={styles.titleRow}><h1>{c.title}</h1><p>{c.intro}</p></div></div>
        <span className={styles.libraryCount}><i />{showLines ? <><b>1</b> {c.lineCount}</> : loading ? c.loading : <><b>{availableCount}</b> {c.libraryCount}</>}</span>
      </header>
      <div className={styles.viewBar}>
        <nav className={styles.viewSwitch} aria-label={c.viewLabel}>
          <Link href="/library" scroll={false} aria-current={!showLines ? "page" : undefined}><LayoutGrid size={16} aria-hidden="true" />{c.projectsView}</Link>
          <Link href={SPACE_LINE.href} scroll={false} aria-current={showLines ? "page" : undefined}><Route size={16} aria-hidden="true" />{c.linesView}</Link>
        </nav>
        <p>{showLines ? c.linesHint : c.projectsHint}</p>
      </div>
      <section className={styles.themeHero} aria-labelledby="space-line-title">
        <div className={styles.heroArtwork} aria-hidden="true"><Image src="/landing/mars-rover.webp" alt="" fill priority sizes="(max-width: 680px) 100vw, 65vw" /><div className={styles.artFade} /><span className={styles.destination}>{c.destination}</span></div>
        <div className={styles.heroCopy}>
          <div className={styles.heroEyebrow}><Orbit size={15} strokeWidth={1.4} /><span>{c.lineTag}</span><span>{c.lineNumber}</span></div>
          <h2 id="space-line-title">{c.heroTitle}<span aria-hidden="true">.</span></h2>
          <p className={styles.heroDescription}>{c.heroDescription}</p>
          <p className={styles.heroBody}>{c.heroBody}</p>
          <div className={styles.heroDomains}>{c.heroDomains.map(label => <span key={label}>{label}</span>)}</div>
          <div className={styles.heroActions}><Link href={SPACE_LINE.firstProjectHref} className={styles.primaryAction}><Clock3 size={16} />{c.start}<ArrowUpRight size={17} /></Link><Link href={showLines ? "#space-journey" : SPACE_LINE.href} className={styles.secondaryAction}>{showLines ? c.viewJourney : c.viewLine}<ArrowRight size={15} /></Link></div>
          <p className={styles.startHint}><Check size={12} />{c.instant}<span />{c.browser}</p>
        </div>
        <Link href={SPACE_LINE.firstProjectHref} className={styles.firstStop} aria-label={`${c.firstStop} · ${c.firstWork}`}><div className={styles.miniPhoto} aria-hidden="true"><span /><i /><Camera size={12} /></div><div><small>{c.firstStop} / 3 MIN</small><strong>{c.firstWork}</strong><span>{c.firstWorkHint}</span></div><ArrowUpRight size={17} /></Link>
      </section>
      {showLines ? <ProjectLineView locale={locale} /> : <>
      <ol className={styles.routeStrip} aria-label={c.viewLine}>
        {c.steps.map((step, i) => <li key={step.title}><span className={styles.routeIndex}>{String(i + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><span>{step.detail}</span></div>{i < 3 && <ArrowRight size={14} className={styles.routeArrow} aria-hidden="true" />}</li>)}
      </ol>

      <section className={styles.discovery} aria-labelledby="discovery-title">
        <div className={styles.discoveryHeading}><div><h2 id="discovery-title">{c.discover}</h2><p>{c.discoverHint}</p></div><SlidersHorizontal size={19} strokeWidth={1.3} aria-hidden="true" /></div>
        <div className={styles.kindTabs} role="group" aria-label={locale === "zh" ? "项目类型" : "Project type"}>
          {KINDS.map(value => {
            const Icon = KIND_ICONS[value]
            const count = listed.filter(entry => value === "all" || entry.kind === value).length
            return <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={styles.kindTab} data-kind-filter={value}><div><Icon size={17} strokeWidth={1.5} /><strong>{c.kinds[value]}</strong><span>{value === "guided" || value === "integration" ? c.planning : count}</span></div><small>{c.kindHints[value]}</small></button>
          })}
        </div>
        <div className={styles.filterBar}>
          <label className={styles.search}><Search size={16} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={c.search} aria-label={c.search} />{query && <button type="button" onClick={() => setQuery("")} aria-label={locale === "zh" ? "清空搜索" : "Clear search"}><X size={14} /></button>}</label>
          <label className={styles.select}><span>{c.domain}</span><select value={domain} onChange={event => setDomain(event.target.value)} aria-label={c.domain}><option value="all">{c.allDomains}</option>{Object.entries(c.domainNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className={styles.select}><span>{c.difficulty}</span><select value={difficulty} onChange={event => setDifficulty(event.target.value)} aria-label={c.difficulty}><option value="all">{c.allChallenges}</option><option value="light">{c.light}</option><option value="1-2">{c.score12}</option><option value="3">{c.score3}</option><option value="4-5">{c.score45}</option></select></label>
        </div>
        <div className={styles.resultBar}><p role="status" aria-live="polite"><b>{filtered.length}</b> {c.result}{hasFilters && <button type="button" onClick={reset}>{c.reset}</button>}</p><div><label className={styles.plannedToggle}><input type="checkbox" checked={showPlanned} onChange={event => setShowPlanned(event.target.checked)} />{c.showPlanned}</label><select value={sort} onChange={event => setSort(event.target.value)} aria-label={c.sort}><option value="recommended">{c.recommended}</option><option value="difficulty">{c.difficultyAsc}</option><option value="recent">{c.recent}</option></select></div></div>
        {loadFailed && <div className={styles.error} role="alert"><p>{c.error}</p><button type="button" onClick={retry}>{c.retry}<ArrowRight size={14} /></button></div>}
        {loading && <div className={styles.loading} role="status"><span />{c.loading}</div>}
        {filtered.length > 0 ? <div className={styles.projectGrid}>{filtered.map(entry => <DiscoveryProjectCard key={entry.id} entry={entry} pulled={loggedIn && pulled.has(entry.id)} />)}</div>
          : !loading && <div className={styles.emptyState}>
            {showPlan && planningKind ? <><div className={styles.emptyIcon}><Layers3 size={27} strokeWidth={1.2} /></div><span className={styles.plannedLabel}>{SPACE_LINE.title[locale]} / {c.planning}</span><h3>{c.plannedTitle}</h3><p>{c.plannedBody}</p><div className={styles.plannedTasks}>{PLANNED_PROJECTS[planningKind][locale].map((title, i) => <span key={title}><small>{String(i + 1).padStart(2, "0")}</small>{title}</span>)}</div><Link href={SPACE_LINE.href}>{c.viewLine}<ArrowRight size={15} /></Link></>
              : <><Search size={25} strokeWidth={1.2} /><h3>{c.emptyTitle}</h3><p>{planningKind ? c.plannedFallback : c.emptyBody}</p><button type="button" onClick={reset}>{c.reset}<ArrowRight size={15} /></button></>}
          </div>}
        <p className={styles.timeNote}>{c.timeNote}</p>
      </section>
      </>}
      <aside className={styles.familyNote}><span className={styles.familyMark}><Telescope size={23} strokeWidth={1.3} /></span><div><strong>{c.familyTitle}</strong><p>{c.familyBody}</p></div><Link href={SPACE_LINE.firstProjectHref}>{c.start}<ArrowUpRight size={15} /></Link></aside>
      <section className={styles.request}><div><h2>{c.requestTitle}</h2><p>{c.requestBody}</p></div><button type="button" onClick={() => setApplyOpen(true)}><Plus size={15} />{c.requestAction}</button></section>
      <ApplyProjectModal open={applyOpen} onClose={() => setApplyOpen(false)} />
    </main>
  )
}
